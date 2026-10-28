//! 房間：最多八個座位（真人或電腦對手）、觀眾、聊天、開跑／再跑一次／回大廳。
//! 座位、房主、聊天這些共通的部分在 VirtualCore 的 virtual-room（`Lobby`），這裡只放這款的比賽。
//! 不碰網路，伺服器（VirtualCore 的 virtual-lan）或線上房主（crates/runner-wasm）每 1/60 秒呼叫 `tick()`。
//!
//! 跑酷的玩家之間不會互相碰撞，所以比賽不在這裡跑：每個人在自己的電腦上跑同一條跑道（同一個種子），
//! 每秒幾次回報「跑到哪、分數多少、剩幾顆心、過終點了沒」，房間收齊了再轉給大家（半透明地疊在同一條路上）。
//! 比的是分數（金幣、踩敵人、空中連段、過終點與剩下的心都有分）。
//! 這樣網路慢的人自己的操作也不會卡，人數也可以比較多。電腦對手由房間自己跑。

use crate::ai::{Ai, Difficulty};
use crate::characters::{is_character, random_character};
use crate::course::{Plan, STAGES, WORLDS};
use crate::run::{Phase, Run, COUNTDOWN};
use rand::rngs::SmallRng;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::ops::{Deref, DerefMut};
use virtual_room::{Game, Lobby, RoomGame};

pub use virtual_room::{Seat, SeatKind};

pub const MAX_PLAYERS: usize = 8;
/// 第一個人過終點之後，其他人還有幾秒
const FINISH_GRACE: u32 = 45 * 60;
/// 比賽影格每幾格送一次（60 / 4 = 每秒 15 次）
const FRAME_EVERY: u32 = 4;

/// 跑者回報的進度（真人自己回報，電腦對手由房間算）
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Progress {
    pub x: f32,
    pub y: f32,
    /// 動作（畫面用：run、jump、slide…）
    pub a: String,
    pub hp: i32,
    pub coins: u32,
    pub score: u32,
    pub meters: u32,
    /// 關卡進度 0～1（無盡模式沒有）
    pub prog: Option<f32>,
    /// 過終點的時間（開跑後第幾格）
    pub fin: Option<u32>,
    pub out: bool,
    /// 一起闖關：心沒了變成靈魂，等隊友救
    pub soul: bool,
    /// 受傷次數（隊伍星星「全隊沒受傷」用）
    pub hits: u32,
    /// 自己已經被救回來幾次（跟房間的 revive 次數比，少了就要復活）
    pub rev: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// 電腦對手的強度
    pub difficulty: Difficulty,
    /// 跑哪一種路：true = 無盡模式、false = 關卡（都是比分數）
    pub endless: bool,
    pub world: usize,
    pub stage: usize,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { difficulty: Difficulty::Normal, endless: false, world: 0, stage: 0 }
    }
}

impl Settings {
    pub fn plan(&self) -> Plan {
        if self.endless {
            Plan::Endless
        } else {
            Plan::Level { world: self.world.min(WORLDS - 1), stage: self.stage.min(STAGES - 1) }
        }
    }
}

struct Entry {
    seat: usize,
    bot: Option<(Run, Ai)>,
    p: Progress,
    /// 變成靈魂那一刻全隊的金幣總數（從這裡開始算救援進度）
    soul_from: Option<u32>,
    /// 房間決定救回來幾次了（客戶端看到比自己的 rev 多就復活）
    revives: u32,
}

impl Entry {
    fn done(&self) -> bool {
        self.p.fin.is_some() || self.p.out
    }
    /// 還在跑（沒過終點、沒倒下、不是靈魂）
    fn running(&self) -> bool {
        !self.done() && !self.p.soul
    }
}

/// 一起闖關：隊友合計再吃到幾枚金幣就能救回一個靈魂
pub const REVIVE_COINS: u32 = 20;

pub struct Race {
    pub plan: Plan,
    pub seed: u64,
    /// 開始後第幾格（含倒數）
    pub t: u32,
    entries: Vec<Entry>,
    first_finish: Option<u32>,
    /// 名次（比賽結束後才有）
    pub results: Option<Vec<Value>>,
    /// 一起闖關的隊伍成績（關卡才有）：過關、星星、總分
    pub team: Option<Value>,
    /// 這一關每個人能拿到的金幣數（算隊伍星星用）
    coin_total: u32,
}

/// 這款的房間規則
pub struct Runners;

impl Game for Runners {
    type Settings = Settings;
    type SeatState = ();
    const SEATS: usize = MAX_PLAYERS;

    fn joined_text(name: &str, seat: usize) -> String {
        format!("{} 坐到了 {}P", name, seat + 1)
    }
    fn is_character(id: &str) -> bool {
        is_character(id)
    }
    fn random_character(rng: &mut SmallRng, avoid: &[&str]) -> &'static str {
        random_character(rng, avoid)
    }
    fn clamp_settings(settings: Settings) -> Settings {
        Settings { world: settings.world.min(WORLDS - 1), stage: settings.stage.min(STAGES - 1), ..settings }
    }
    fn seat_difficulty(settings: &Settings) -> Difficulty {
        settings.difficulty
    }
}

pub struct Room {
    pub lobby: Lobby<Runners>,
    pub race: Option<Race>,
    /// 這一格比賽剛結束（大廳資訊要更新）
    ended_now: bool,
}

impl Default for Room {
    fn default() -> Self {
        Self::new(Settings::default())
    }
}

// 座位、聊天、入席這些直接用大廳的（room.join(…)、room.seats…）
impl Deref for Room {
    type Target = Lobby<Runners>;
    fn deref(&self) -> &Lobby<Runners> {
        &self.lobby
    }
}

impl DerefMut for Room {
    fn deref_mut(&mut self) -> &mut Lobby<Runners> {
        &mut self.lobby
    }
}

impl Room {
    pub fn new(settings: Settings) -> Self {
        Room { lobby: Lobby::new(settings), race: None, ended_now: false }
    }

    /// 比賽中的這個座位算棄權；有改到就回傳 true
    fn retire(&mut self, seat: usize) -> bool {
        let Some(race) = self.race.as_mut() else { return false };
        match race.entries.iter_mut().find(|e| e.seat == seat && e.bot.is_none()) {
            Some(e) if !e.done() => {
                e.p.out = true;
                true
            }
            _ => false,
        }
    }

    /// 真人回報進度
    pub fn report(&mut self, seat: usize, p: Progress) {
        let Some(race) = self.race.as_mut() else { return };
        let Some(e) = race.entries.iter_mut().find(|e| e.seat == seat && e.bot.is_none()) else { return };
        // 已經結束的就不能再改（例如棄權之後晚到的封包）
        if e.done() {
            return;
        }
        e.p = p;
    }

    /// 一起闖關：往下一關（6-8 之後回到 1-1）再出發
    pub fn next_stage(&mut self) -> Result<(), String> {
        if self.settings.endless {
            return Err("無盡模式沒有下一關".into());
        }
        let i = (self.settings.world * STAGES + self.settings.stage + 1) % (WORLDS * STAGES);
        self.settings.world = i / STAGES;
        self.settings.stage = i % STAGES;
        self.start()
    }
}

impl RoomGame for Room {
    type Rules = Runners;

    fn lobby(&self) -> &Lobby<Runners> {
        &self.lobby
    }
    fn lobby_mut(&mut self) -> &mut Lobby<Runners> {
        &mut self.lobby
    }

    /// 開跑：有人的座位都上場
    fn start(&mut self) -> Result<(), String> {
        let plan = self.lobby.settings.plan();
        let seed: u64 = self.lobby.rng.gen();
        let mut entries = Vec::new();
        for (i, s) in self.lobby.seats.iter().enumerate() {
            let Some(s) = s else { continue };
            let bot = (s.kind == SeatKind::Bot).then(|| {
                let mut run = Run::new(plan, &s.character, seed);
                run.coop = plan != Plan::Endless;
                (run, Ai::new(s.difficulty, seed ^ (i as u64 + 1) * 7919))
            });
            entries.push(Entry { seat: i, bot, p: Progress { hp: 3, a: "ready".into(), ..Progress::default() }, soul_from: None, revives: 0 });
        }
        if entries.is_empty() {
            return Err("沒有人上場".into());
        }
        let coin_total = Run::new(plan, "xiaocui", seed).course.coin_total;
        self.race = Some(Race { plan, seed, t: 0, entries, first_finish: None, results: None, team: None, coin_total });
        self.lobby.playing = true;
        self.lobby.sys(if plan == Plan::Endless { "無盡比分，各就各位……" } else { "一起闖關，出發！" });
        Ok(())
    }

    fn reset_to_lobby(&mut self) {
        self.race = None;
        self.lobby.playing = false;
    }

    /// 真人回報的進度（`progress` 訊息）
    fn input(&mut self, seat: usize, msg: &Value) {
        if let Ok(p) = serde_json::from_value::<Progress>(msg.clone()) {
            self.report(seat, p);
        }
    }

    fn input_type() -> &'static str {
        "progress"
    }

    fn host_command(&mut self, cmd: &str, _msg: &Value) -> Option<Result<(), String>> {
        (cmd == "next").then(|| self.next_stage())
    }

    /// 斷線：比賽中就算棄權（各自在自己的電腦上跑，電腦接不了手）
    fn disconnect(&mut self, seat: usize) {
        let Some(s) = self.lobby.seats[seat].as_mut() else { return };
        s.connected = false;
        let name = s.name.clone();
        if self.retire(seat) {
            self.lobby.sys(format!("{} 斷線了，這一場先算棄權", name));
        }
    }

    /// 離開座位（玩家自己離開或房主移除）。比賽中就算棄權，座位直接空出來。
    fn remove_seat(&mut self, seat: usize) -> Result<(), String> {
        if self.lobby.seats.get(seat).and_then(|s| s.as_ref()).is_none() {
            return Err("這個座位沒有人".into());
        }
        self.retire(seat);
        if let Some(race) = self.race.as_mut() {
            race.entries.retain(|e| e.seat != seat);
        }
        self.lobby.vacate(seat).map(|_| ())
    }

    /// 前進一個影格。要送比賽影格的時候回傳 true。
    fn tick(&mut self) -> bool {
        let Some(race) = self.race.as_mut() else { return false };
        race.t += 1;
        if race.results.is_none() {
            for e in race.entries.iter_mut() {
                let Some((run, ai)) = e.bot.as_mut() else { continue };
                if run.done() {
                    continue;
                }
                let input = ai.think(run);
                run.step(input);
                e.p = progress_of(run);
            }
            // 一起闖關：靈魂等隊友合計再吃 REVIVE_COINS 枚金幣就救回來
            if race.plan != Plan::Endless {
                let team_coins: u32 = race.entries.iter().map(|e| e.p.coins).sum();
                let anyone_running = race.entries.iter().any(|e| e.running());
                for e in race.entries.iter_mut() {
                    if !e.p.soul || e.done() {
                        e.soul_from = None;
                        continue;
                    }
                    // 剛變成靈魂（或剛被救、回報還沒更新）：從現在的金幣數開始算
                    if e.p.rev < e.revives {
                        continue;
                    }
                    let from = *e.soul_from.get_or_insert(team_coins);
                    if anyone_running && team_coins >= from + REVIVE_COINS {
                        e.revives += 1;
                        e.soul_from = None;
                        if let Some((run, _)) = e.bot.as_mut() {
                            run.revive();
                            e.p = progress_of(run);
                            e.p.rev = e.revives;
                        }
                    }
                }
            }
            let racing_t = race.t.saturating_sub(COUNTDOWN as u32);
            if race.first_finish.is_none() && race.entries.iter().any(|e| e.p.fin.is_some()) {
                race.first_finish = Some(racing_t);
            }
            let humans_done = race.entries.iter().filter(|e| e.bot.is_none()).all(|e| e.done() || e.p.soul);
            // 沒有人還在跑（剩下的都是靈魂、過終點或倒下）：靈魂救不回來了，結束
            let all_done = race.entries.iter().all(|e| !e.running());
            let grace = race.first_finish.is_some_and(|f| racing_t > f + FINISH_GRACE);
            // 無盡模式：真人都倒了就結束（電腦對手用目前的距離排名）
            let endless_over = race.plan == Plan::Endless && humans_done;
            if all_done || grace || endless_over {
                if race.plan != Plan::Endless {
                    race.team = Some(team_result(race));
                }
                let results = rank(race, &self.lobby.seats);
                let winner = results.first().and_then(|r| r["name"].as_str()).unwrap_or("").to_string();
                race.results = Some(results);
                self.ended_now = true;
                self.lobby.sys(format!("比賽結束！第一名：{}", winner));
            }
        }
        self.race.as_ref().is_some_and(|r| r.t % FRAME_EVERY == 0 || r.t == 1)
    }

    /// 比賽影格：大家的進度
    fn frame(&self) -> Option<Value> {
        let race = self.race.as_ref()?;
        let team_coins: u32 = race.entries.iter().map(|e| e.p.coins).sum();
        let runners: Vec<Value> = race
            .entries
            .iter()
            .map(|e| {
                let s = self.lobby.seats[e.seat].as_ref();
                json!({
                    "seat": e.seat,
                    "name": s.map(|s| s.name.as_str()).unwrap_or(""),
                    "character": s.map(|s| s.character.as_str()).unwrap_or("xiaocui"),
                    "bot": e.bot.is_some(),
                    "p": e.p,
                    "revives": e.revives,
                    // 靈魂的救援進度（隊友合計又吃了幾枚）
                    "rescue": e.soul_from.map(|from| (team_coins.saturating_sub(from)).min(REVIVE_COINS)),
                })
            })
            .collect();
        Some(json!({
            "phase": if race.results.is_some() { "results" } else if race.t < COUNTDOWN as u32 { "countdown" } else { "racing" },
            "t": race.t,
            "seed": race.seed.to_string(),
            "plan": race.plan,
            "runners": runners,
            "results": race.results,
            "team": race.team,
            "revive_coins": REVIVE_COINS,
        }))
    }

    fn just_ended(&mut self) -> bool {
        std::mem::take(&mut self.ended_now)
    }
}

/// 一起闖關的隊伍成績：有人過終點就全隊過關；金幣合計達 70%、全隊沒受傷各一顆星
fn team_result(race: &Race) -> Value {
    let n = race.entries.len() as u32;
    let cleared = race.entries.iter().any(|e| e.p.fin.is_some());
    let coins: u32 = race.entries.iter().map(|e| e.p.coins).sum();
    let possible = race.coin_total * n;
    let no_hits = race.entries.iter().all(|e| e.p.hits == 0);
    let stars = if cleared { 1 + (coins * 10 >= possible * 7) as u32 + no_hits as u32 } else { 0 };
    json!({
        "cleared": cleared,
        "stars": stars,
        "coins": coins,
        "coin_total": possible,
        "no_hits": no_hits,
        "score": race.entries.iter().map(|e| e.p.score).sum::<u32>(),
    })
}

/// 跑者的進度（電腦對手由房間算；真人的客戶端用同一個函式回報）
pub fn progress_of(run: &Run) -> Progress {
    Progress {
        x: run.r.x.round(),
        y: run.r.y.round(),
        a: serde_json::to_value(run.r.act).ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default(),
        hp: run.r.hp,
        coins: run.coins,
        score: run.score,
        meters: run.meters(),
        prog: run.progress(),
        fin: (run.phase == Phase::Goal).then_some(run.t),
        out: run.phase == Phase::Out,
        soul: run.phase == Phase::Soul,
        hits: run.hits,
        rev: 0,
    }
}

/// 名次（比賽結束時）
fn rank(race: &Race, seats: &[Option<Seat<()>>]) -> Vec<Value> {
    // 比分數：分數高的贏；一樣高的話先過終點的、再來跑得遠的在前面
    let mut order: Vec<&Entry> = race.entries.iter().collect();
    order.sort_by_key(|e| (std::cmp::Reverse(e.p.score), e.p.fin.unwrap_or(u32::MAX), std::cmp::Reverse(e.p.meters)));
    order
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let s = seats[e.seat].as_ref();
            json!({
                "rank": i + 1,
                "seat": e.seat,
                "name": s.map(|s| s.name.as_str()).unwrap_or(""),
                "character": s.map(|s| s.character.as_str()).unwrap_or("xiaocui"),
                "fin": e.p.fin,
                "out": (e.p.out || e.p.soul) && e.p.fin.is_none(),
                "meters": e.p.meters,
                "coins": e.p.coins,
                "score": e.p.score,
            })
        })
        .collect()
}

#[cfg(test)]
mod coop_tests {
    use super::*;
    use crate::run::Phase;

    /// 一起闖關：有人變成靈魂，隊友合計吃到 REVIVE_COINS 枚金幣就救回來；結束時有隊伍成績
    #[test]
    fn soul_is_revived_by_team_coins() {
        let mut room = Room::new(Settings { difficulty: Difficulty::Hard, ..Settings::default() });
        room.add_bot(None, Difficulty::Hard).unwrap();
        room.add_bot(None, Difficulty::Hard).unwrap();
        room.start().unwrap();
        // 倒數完、跑一下
        for _ in 0..COUNTDOWN + 60 {
            room.tick();
        }
        // 讓第二位直接變成靈魂
        {
            let race = room.race.as_mut().unwrap();
            let (run, _) = race.entries[1].bot.as_mut().unwrap();
            run.phase = Phase::Soul;
        }
        let mut revived = false;
        for _ in 0..60 * 60 {
            room.tick();
            let race = room.race.as_ref().unwrap();
            if race.entries[1].revives > 0 {
                let (run, _) = race.entries[1].bot.as_ref().unwrap();
                assert_eq!(run.phase, Phase::Run, "救回來之後要繼續跑");
                revived = true;
                break;
            }
        }
        assert!(revived, "隊友吃金幣應該能把靈魂救回來");
        while room.race.as_ref().unwrap().results.is_none() {
            room.tick();
        }
        let frame = room.frame().unwrap();
        assert_eq!(frame["team"]["cleared"], true);
        assert!(frame["team"]["stars"].as_u64().unwrap() >= 1);
        // 下一關
        room.next_stage().unwrap();
        assert_eq!(room.settings.stage, 1);
    }

    /// 無盡比分：靈魂規則不適用（心沒了就倒下）
    #[test]
    fn endless_has_no_souls() {
        let mut room = Room::new(Settings { endless: true, ..Settings::default() });
        room.add_bot(None, Difficulty::Easy).unwrap();
        room.start().unwrap();
        let race = room.race.as_ref().unwrap();
        assert!(!race.entries[0].bot.as_ref().unwrap().0.coop);
        assert!(room.next_stage().is_err());
    }
}
