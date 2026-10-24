//! 把遊戲引擎包成 WebAssembly，在瀏覽器裡跑：
//! - `LocalRun`：自己跑一條跑道（單機、連線時也是自己的那條路在自己的電腦上跑），在主執行緒每 1/60 秒呼叫一次
//! - `HostRoom`：線上房間的房主（瀏覽器就是伺服器），在 Web Worker 裡跑（見 src/lib/local/host-worker.js）
//!
//! LocalRun 的用法（見 src/lib/engine.js）：
//!   const run = new LocalRun('{"kind":"level","world":0,"stage":0}', 'xiaocui', '12345');
//!   run.step(bits);                 // 位元見 runner_core::run::Input::from_bits
//!   const view = JSON.parse(run.state());
//!   const p = run.progress();       // 連線時回報給房主的進度（JSON 文字）

use runner_core::ai::{Ai, Difficulty};
use runner_core::course::Plan;
use runner_core::protocol::{self, Conn};
use runner_core::room::{Progress, Room};
use runner_core::run::{Input, Phase, Run};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct LocalRun {
    run: Run,
    ai: Option<Ai>,
}

#[wasm_bindgen]
impl LocalRun {
    /// plan：{"kind":"level","world":0,"stage":0} 或 {"kind":"endless"}；seed：十進位文字（u64 在 JS 放不下）
    #[wasm_bindgen(constructor)]
    pub fn new(plan: &str, character: &str, seed: &str) -> LocalRun {
        let plan: Plan = serde_json::from_str::<Value>(plan).ok().and_then(|v| parse_plan(&v)).unwrap_or(Plan::Endless);
        let seed = seed.parse::<u64>().unwrap_or_else(|_| js_seed());
        LocalRun { run: Run::new(plan, character, seed), ai: None }
    }

    /// 交給電腦跑（示範用）：difficulty = easy | normal | hard
    #[wasm_bindgen(js_name = setAi)]
    pub fn set_ai(&mut self, difficulty: &str) {
        let d: Difficulty = serde_json::from_value(Value::String(difficulty.into())).unwrap_or_default();
        self.ai = Some(Ai::new(d, js_seed()));
    }

    /// 倒數還剩幾格（連線時照房主的時間對齊）
    #[wasm_bindgen(js_name = setReady)]
    pub fn set_ready(&mut self, frames: i32) {
        if self.run.phase == Phase::Ready {
            self.run.ready = frames.max(1);
        }
    }

    pub fn step(&mut self, bits: u32) {
        let input = match self.ai.as_mut() {
            Some(ai) => ai.think(&self.run),
            None => Input::from_bits(bits),
        };
        self.run.step(input);
    }

    pub fn state(&self) -> String {
        self.run.view().to_string()
    }

    pub fn done(&self) -> bool {
        self.run.done()
    }

    /// 連線時回報給房主的進度
    pub fn progress(&self) -> String {
        let r = &self.run;
        let p = Progress {
            x: r.r.x.round(),
            y: r.r.y.round(),
            a: serde_json::to_value(r.r.act).ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default(),
            hp: r.r.hp,
            coins: r.coins,
            score: r.score,
            meters: r.meters(),
            prog: r.progress(),
            fin: (r.phase == Phase::Goal).then_some(r.t),
            out: r.phase == Phase::Out,
        };
        serde_json::to_string(&p).unwrap_or_default()
    }
}

fn parse_plan(v: &Value) -> Option<Plan> {
    match v.get("kind")?.as_str()? {
        "endless" => Some(Plan::Endless),
        "level" => Some(Plan::Level {
            world: v.get("world")?.as_u64()? as usize,
            stage: v.get("stage")?.as_u64()? as usize,
        }),
        _ => None,
    }
}

/// 線上房間：跟區網伺服器（src-tauri/src/server.rs）一樣的房間與訊息，只是不碰網路。
/// 連線用數字 id（0 是房主自己），JS 把收到的 JSON 交給 `message()`，
/// 每格呼叫 `tick()` 拿影格，再用 `drain()` 拿要送給各連線的訊息。
#[wasm_bindgen]
pub struct HostRoom {
    room: Room,
    host_key: String,
    conns: BTreeMap<u32, Conn>,
    outbox: Vec<Value>,
    /// 大廳資訊有變，下次 drain() 要送給每個人
    dirty: bool,
}

#[wasm_bindgen]
impl HostRoom {
    #[wasm_bindgen(constructor)]
    pub fn new(host_key: &str) -> HostRoom {
        HostRoom { room: Room::default(), host_key: host_key.into(), conns: BTreeMap::new(), outbox: Vec::new(), dirty: false }
    }

    pub fn connect(&mut self, id: u32) {
        self.conns.insert(id, Conn::default());
    }

    /// 連線中斷：比賽中算棄權，拿 token 重新連上就拿回座位
    pub fn disconnect(&mut self, id: u32) {
        if let Some(mut conn) = self.conns.remove(&id) {
            self.dirty |= protocol::drop_conn(&mut self.room, &mut conn);
        }
    }

    /// 收到 id 傳來的一則訊息（JSON 文字）
    pub fn message(&mut self, id: u32, text: &str) {
        let Some(conn) = self.conns.get_mut(&id) else { return };
        let v: Value = serde_json::from_str(text).unwrap_or(Value::Null);
        let (replies, changed) = protocol::handle(&mut self.room, &self.host_key, conn, &v);
        for r in replies {
            self.outbox.push(json!({"to": id, "msg": r}));
        }
        self.dirty |= changed;
        // 跟伺服器一樣：除了進度回報，其他訊息都回一份大廳資訊
        if conn.hello && v.get("type").and_then(|x| x.as_str()) != Some("progress") && !changed {
            self.outbox.push(json!({"to": id, "msg": protocol::room_message(&self.room, conn)}));
        }
    }

    /// 前進一格；要送比賽影格時回傳影格（JSON 文字），否則 undefined
    pub fn tick(&mut self) -> Option<String> {
        let send = self.room.tick();
        self.dirty |= protocol::just_ended(&mut self.room);
        if !send {
            return None;
        }
        self.room.frame().map(|f| f.to_string())
    }

    /// 取出要送的訊息：JSON 陣列 [{ to: 連線 id, msg }]
    pub fn drain(&mut self) -> String {
        if std::mem::take(&mut self.dirty) {
            for (id, conn) in &self.conns {
                if conn.hello {
                    self.outbox.push(json!({"to": id, "msg": protocol::room_message(&self.room, conn)}));
                }
            }
        }
        Value::Array(std::mem::take(&mut self.outbox)).to_string()
    }
}

fn js_seed() -> u64 {
    (js_random() * 9.0e15) as u64
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Math, js_name = random)]
    fn js_random() -> f64;
}
