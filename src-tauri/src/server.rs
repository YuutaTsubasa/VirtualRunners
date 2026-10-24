//! 比賽伺服器（房主的 App 內建，或 `npm run server` 單獨跑）：
//! - `/ws`      玩家與觀眾的 WebSocket
//! - 其他路徑   前端靜態檔（讓沒裝 App 的人用瀏覽器加入）
//!
//! 比賽在伺服器上跑（每秒 60 個影格），玩家只送輸入，伺服器把每個影格的狀態廣播出去。

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{broadcast, watch};
use tower_http::cors::CorsLayer;
use runner_core::protocol::{self, Conn};
use runner_core::room::{Room, Settings};

pub type AssetFn = Arc<dyn Fn(&str) -> Option<(Vec<u8>, String)> + Send + Sync>;

pub struct AppState {
    pub room: Mutex<Room>,
    /// 大廳資訊有變（座位、聊天、設定…）
    notify: watch::Sender<u64>,
    /// 比賽影格（已經是要送出的 JSON 文字）
    frames: broadcast::Sender<Arc<str>>,
    shutdown: watch::Receiver<bool>,
    pub host_key: String,
    assets: Option<AssetFn>,
}

impl AppState {
    pub fn bump(&self) {
        self.notify.send_modify(|v| *v += 1);
    }
}

pub struct ServerHandle {
    pub state: Arc<AppState>,
    shutdown: watch::Sender<bool>,
    pub port: u16,
    pub host_key: String,
}

impl ServerHandle {
    pub fn stop(&self) {
        let _ = self.shutdown.send(true);
    }
}

pub async fn start(port: u16, settings: Settings, assets: Option<AssetFn>) -> Result<ServerHandle, String> {
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .map_err(|e| format!("無法監聽埠 {}：{}", port, e))?;
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
    let (sd_tx, sd_rx) = watch::channel(false);
    let (notify, _) = watch::channel(0u64);
    let (frames, _) = broadcast::channel(16);
    let mut room = Room::default();
    room.update_settings(settings);
    let host_key: String = rand::thread_rng().sample_iter(&Alphanumeric).take(20).map(char::from).collect();
    let state = Arc::new(AppState {
        room: Mutex::new(room),
        notify,
        frames,
        shutdown: sd_rx.clone(),
        host_key: host_key.clone(),
        assets,
    });

    // 比賽時鐘：每 1/60 秒前進一格並廣播
    let st = state.clone();
    let mut sd1 = sd_rx.clone();
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(Duration::from_micros(16_667));
        iv.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                _ = iv.tick() => {
                    let (frame, ended) = {
                        let mut room = st.room.lock().unwrap();
                        let send = room.tick();
                        let ended = protocol::just_ended(&mut room);
                        (if send { room.frame() } else { None }, ended)
                    };
                    if let Some(f) = frame {
                        let _ = st.frames.send(protocol::frame_message(&f).to_string().into());
                    }
                    if ended { st.bump(); }
                }
                _ = sd1.changed() => break,
            }
        }
    });

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .fallback(static_handler)
        .layer(CorsLayer::permissive())
        .with_state(state.clone());
    let mut sd2 = sd_rx.clone();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = sd2.changed().await;
            })
            .await;
    });

    Ok(ServerHandle { state, shutdown: sd_tx, port, host_key })
}

// ───────────── WebSocket ─────────────

async fn ws_handler(ws: WebSocketUpgrade, State(st): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(move |sock| ws_session(sock, st))
}

async fn ws_session(socket: WebSocket, st: Arc<AppState>) {
    let (mut out, mut inp) = socket.split();
    let mut ctx = Conn::default();
    let mut notify = st.notify.subscribe();
    let mut frames = st.frames.subscribe();
    let mut shutdown = st.shutdown.clone();
    let mut ping = tokio::time::interval(Duration::from_secs(20));
    loop {
        let mut msgs: Vec<String> = Vec::new();
        let mut send_room = false;
        tokio::select! {
            m = inp.next() => match m {
                Some(Ok(Message::Text(t))) => {
                    let v: Value = serde_json::from_str(t.as_str()).unwrap_or(Value::Null);
                    let (replies, changed) = protocol::handle(&mut st.room.lock().unwrap(), &st.host_key, &mut ctx, &v);
                    msgs = replies.into_iter().map(|r| r.to_string()).collect();
                    if changed { st.bump(); }
                    // 輸入每秒好幾十次，不用每次都回大廳資訊
                    send_room = v.get("type").and_then(|x| x.as_str()) != Some("progress");
                }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            r = notify.changed() => {
                if r.is_err() { break; }
                notify.borrow_and_update();
                send_room = ctx.hello;
            }
            f = frames.recv() => match f {
                Ok(f) if ctx.hello => msgs.push(f.to_string()),
                Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                Err(_) => break,
            },
            _ = shutdown.changed() => break,
            _ = ping.tick() => {
                if out.send(Message::Ping(Vec::new().into())).await.is_err() { break; }
            }
        }
        if send_room && ctx.hello {
            msgs.push(protocol::room_message(&st.room.lock().unwrap(), &ctx).to_string());
        }
        let mut failed = false;
        for m in msgs {
            if out.send(Message::Text(m.into())).await.is_err() {
                failed = true;
                break;
            }
        }
        if failed {
            break;
        }
    }
    if protocol::drop_conn(&mut st.room.lock().unwrap(), &mut ctx) {
        st.bump();
    }
}

// ───────────── 靜態檔 ─────────────

async fn static_handler(State(st): State<Arc<AppState>>, uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };
    // index.html 不能快取，否則改版後瀏覽器會繼續載入舊的程式；assets/ 的檔名帶雜湊值，可以長期快取
    let cache = if path.starts_with("assets/") {
        "public, max-age=31536000, immutable"
    } else if path.ends_with(".html") {
        "no-cache"
    } else {
        "public, max-age=3600"
    };
    if let Some(f) = &st.assets {
        if let Some((bytes, mime)) = f(path) {
            return ([(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, cache.to_string())], bytes).into_response();
        }
        if !path.contains('.') {
            if let Some((bytes, mime)) = f("index.html") {
                return ([(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, "no-cache".to_string())], bytes)
                    .into_response();
            }
        }
    }
    (
        StatusCode::NOT_FOUND,
        Html(
            "<meta charset=utf-8><title>虛擬跑跑樂伺服器</title>\
             <body style='font-family:sans-serif;max-width:640px;margin:40px auto'>\
             <h1>🏐 虛擬跑跑樂伺服器</h1><p>伺服器運作中，但沒有內建網頁介面（開發模式）。請用 App 的「加入房間」連線。</p>",
        ),
    )
        .into_response()
}

/// 取得本機區網 IP（讓房主把位址告訴朋友）
pub fn local_ips() -> Vec<String> {
    let mut v = Vec::new();
    if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if sock.connect("8.8.8.8:80").is_ok() {
            if let Ok(a) = sock.local_addr() {
                v.push(a.ip().to_string());
            }
        }
    }
    v.push("127.0.0.1".into());
    v
}
