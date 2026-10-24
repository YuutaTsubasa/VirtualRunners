//! 桌面 App：開視窗，並提供「開房」用的內建伺服器（src/server.rs）。
pub mod server;

use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use runner_core::room::Settings;

#[derive(Default)]
struct HostState(Mutex<Option<server::ServerHandle>>);

#[derive(Serialize)]
struct HostInfo {
    port: u16,
    host_key: String,
    ips: Vec<String>,
}

fn info_of(h: &server::ServerHandle) -> HostInfo {
    HostInfo { port: h.port, host_key: h.host_key.clone(), ips: server::local_ips() }
}

#[tauri::command]
async fn start_host(
    app: AppHandle,
    state: State<'_, HostState>,
    port: u16,
    settings: Option<Settings>,
) -> Result<HostInfo, String> {
    let mut guard = state.0.lock().await;
    if let Some(h) = guard.as_ref() {
        return Ok(info_of(h));
    }
    // 讓朋友用瀏覽器打開房主的網址也能玩：網頁檔直接從 App 內嵌的資源拿
    let app2 = app.clone();
    let assets: server::AssetFn = Arc::new(move |path: &str| {
        app2.asset_resolver()
            .get(path.to_string())
            .map(|a| (a.bytes().to_vec(), a.mime_type().to_string()))
    });
    let h = server::start(port, settings.unwrap_or_default(), Some(assets)).await?;
    let info = info_of(&h);
    *guard = Some(h);
    Ok(info)
}

#[tauri::command]
async fn stop_host(state: State<'_, HostState>) -> Result<(), String> {
    if let Some(h) = state.0.lock().await.take() {
        h.stop();
    }
    Ok(())
}

#[tauri::command]
async fn host_status(state: State<'_, HostState>) -> Result<Option<HostInfo>, String> {
    Ok(state.0.lock().await.as_ref().map(info_of))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(HostState::default())
        .invoke_handler(tauri::generate_handler![start_host, stop_host, host_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
