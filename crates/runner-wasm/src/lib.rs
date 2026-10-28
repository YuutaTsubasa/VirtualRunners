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
use runner_core::room::{progress_of, Room};
use runner_core::run::{Input, Phase, Run};
use serde_json::Value;
use virtual_room::host;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct LocalRun {
    run: Run,
    ai: Option<Ai>,
    revived: u32,
}

#[wasm_bindgen]
impl LocalRun {
    /// plan：{"kind":"level","world":0,"stage":0} 或 {"kind":"endless"}；seed：十進位文字（u64 在 JS 放不下）
    #[wasm_bindgen(constructor)]
    pub fn new(plan: &str, character: &str, seed: &str) -> LocalRun {
        let plan: Plan = serde_json::from_str::<Value>(plan).ok().and_then(|v| parse_plan(&v)).unwrap_or(Plan::Endless);
        let seed = seed.parse::<u64>().unwrap_or_else(|_| js_seed());
        LocalRun { run: Run::new(plan, character, seed), ai: None, revived: 0 }
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

    /// 一起闖關：心沒了變成靈魂（等隊友救），不是直接倒下
    #[wasm_bindgen(js_name = setCoop)]
    pub fn set_coop(&mut self, on: bool) {
        self.run.coop = on;
    }

    /// 被隊友救回來（房主說的救援次數比自己多時呼叫）
    pub fn revive(&mut self) {
        if self.run.phase == Phase::Soul {
            self.run.revive();
            self.revived += 1;
        }
    }

    /// 自己被救回來幾次（跟房主的次數比對用）
    #[wasm_bindgen(getter)]
    pub fn revived(&self) -> u32 {
        self.revived
    }

    /// 連線時回報給房主的進度
    pub fn progress(&self) -> String {
        let mut p = progress_of(&self.run);
        p.rev = self.revived;
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

/// 線上房間：跟區網伺服器（VirtualCore 的 virtual-lan）一樣的房間與訊息，只是不碰網路。
/// 連線用數字 id（0 是房主自己），JS 把收到的 JSON 交給 `message()`，
/// 每格呼叫 `tick()` 拿影格，再用 `drain()` 拿要送給各連線的訊息。
/// 內容在 VirtualCore 的 virtual-room（`host::HostRoom`），這裡只是給 JS 用的外殼。
#[wasm_bindgen]
pub struct HostRoom(host::HostRoom<Room>);

#[wasm_bindgen]
impl HostRoom {
    #[wasm_bindgen(constructor)]
    pub fn new(host_key: &str) -> HostRoom {
        HostRoom(host::HostRoom::new(Room::default(), host_key))
    }

    pub fn connect(&mut self, id: u32) {
        self.0.connect(id);
    }

    /// 連線中斷：比賽中算棄權，拿 token 重新連上就拿回座位
    pub fn disconnect(&mut self, id: u32) {
        self.0.disconnect(id);
    }

    /// 收到 id 傳來的一則訊息（JSON 文字）
    pub fn message(&mut self, id: u32, text: &str) {
        self.0.message(id, text);
    }

    /// 前進一格；比賽中回傳這一格的比賽狀態（JSON 文字），否則 undefined
    pub fn tick(&mut self) -> Option<String> {
        self.0.tick()
    }

    /// 取出要送的訊息：JSON 陣列 [{ to: 連線 id, msg }]
    pub fn drain(&mut self) -> String {
        self.0.drain()
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
