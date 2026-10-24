//! 房間：最多八個座位（真人或電腦對手）、觀眾、聊天、開跑／再跑一次／回大廳。
//! 不碰網路，伺服器（src-tauri/src/server.rs）或線上房主（crates/runner-wasm）每 1/60 秒呼叫 `tick()`。
//!
//! 跑酷的玩家之間不會互相碰撞，所以比賽不在這裡跑：每個人在自己的電腦上跑同一條跑道（同一個種子），
//! 每秒幾次回報「跑到哪、分數多少、剩幾顆心、過終點了沒」，房間收齊了再轉給大家（半透明地疊在同一條路上）。
//! 比的是分數（金幣、踩敵人、空中連段、過終點與剩下的心都有分）。
//! 這樣網路慢的人自己的操作也不會卡，人數也可以比較多。電腦對手由房間自己跑。

use crate::ai::{Ai, Difficulty};
use crate::characters::{is_character, random_character};
use crate::course::{Plan, STAGES, WORLDS};
use crate::run::{Phase, Run, COUNTDOWN};
use rand::distributions::Alphanumeric;
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const MAX_PLAYERS: usize = 8;
/// 第一個人過終點之後，其他人還有幾秒
const FINISH_GRACE: u32 = 45 * 60;
/// 比賽影格每幾格送一次（60 / 4 = 每秒 15 次）
const FRAME_EVERY: u32 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SeatKind {
    Human,
    Bot,
}

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

pub struct Seat {
    pub name: String,
    pub character: String,
    pub kind: SeatKind,
    pub difficulty: Difficulty,
    pub token: String,
    pub connected: bool,
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

#[derive(Clone, Debug, Serialize)]
struct ChatLine {
    seat: Option<usize>,
    name: String,
    text: String,
    sys: bool,
}

const MAX_CHAT: usize = 60;

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

pub struct Room {
    pub seats: [Option<Seat>; MAX_PLAYERS],
    pub host_seat: Option<usize>,
    pub settings: Settings,
    pub race: Option<Race>,
    chat: Vec<ChatLine>,
    rng: SmallRng,
    /// 這一格比賽剛結束（大廳資訊要更新）
    pub ended_now: bool,
}

impl Default for Room {
    fn default() -> Self {
        Self::new(Settings::default())
    }
}

impl Room {
    pub fn new(settings: Settings) -> Self {
        Room {
            seats: Default::default(),
            host_seat: None,
            settings,
            race: None,
            chat: Vec::new(),
            rng: SmallRng::from_entropy(),
            ended_now: false,
        }
    }

    pub fn playing(&self) -> bool {
        self.race.is_some()
    }

    fn sys(&mut self, text: String) {
        self.chat.push(ChatLine { seat: None, name: String::new(), text, sys: true });
        if self.chat.len() > MAX_CHAT {
            self.chat.remove(0);
        }
    }

    pub fn push_chat(&mut self, seat: Option<usize>, text: &str) {
        let text: String = text.trim().chars().take(300).collect();
        if text.is_empty() {
            return;
        }
        let name = seat.and_then(|s| self.seats[s].as_ref()).map(|s| s.name.clone()).unwrap_or_else(|| "觀眾".into());
        self.chat.push(ChatLine { seat, name, text, sys: false });
        if self.chat.len() > MAX_CHAT {
            self.chat.remove(0);
        }
    }

    fn pick_character(&mut self, wanted: Option<&str>) -> String {
        match wanted {
            Some(c) if is_character(c) => c.to_string(),
            _ => random_character(&mut self.rng, &[]).to_string(),
        }
    }

    /// 真人入席，回傳（座位, 重新連線用的 token）。比賽中不能入席（改成觀戰）。
    pub fn join(&mut self, name: &str, character: Option<&str>) -> Result<(usize, String), String> {
        if self.playing() {
            return Err("比賽進行中".into());
        }
        let seat = self.seats.iter().position(|s| s.is_none()).ok_or("座位已滿")?;
        let name: String = name.trim().chars().take(16).collect();
        let name = if name.is_empty() { format!("玩家{}", seat + 1) } else { name };
        let token: String = (&mut self.rng).sample_iter(&Alphanumeric).take(24).map(char::from).collect();
        let character = self.pick_character(character);
        self.sys(format!("{} 坐到了 {}P", name, seat + 1));
        self.seats[seat] = Some(Seat { name, character, kind: SeatKind::Human, difficulty: self.settings.difficulty, token: token.clone(), connected: false });
        Ok((seat, token))
    }

    pub fn seat_of_token(&self, token: &str) -> Option<usize> {
        if token.is_empty() {
            return None;
        }
        self.seats.iter().position(|s| s.as_ref().is_some_and(|s| s.kind == SeatKind::Human && s.token == token))
    }

    pub fn connect(&mut self, seat: usize) {
        if let Some(s) = self.seats[seat].as_mut() {
            s.connected = true;
        }
    }

    /// 斷線：比賽中就算棄權（自己的跑道在自己的電腦上，接不回來）
    pub fn disconnect(&mut self, seat: usize) {
        let Some(s) = self.seats[seat].as_mut() else { return };
        s.connected = false;
        let name = s.name.clone();
        if self.retire(seat) {
            self.sys(format!("{} 斷線了，這一場先算棄權", name));
        }
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

    pub fn add_bot(&mut self, seat: Option<usize>, difficulty: Difficulty) -> Result<usize, String> {
        if self.playing() {
            return Err("比賽進行中".into());
        }
        let seat = match seat {
            Some(s) if s < MAX_PLAYERS && self.seats[s].is_none() => s,
            Some(_) => return Err("這個座位有人了".into()),
            None => self.seats.iter().position(|s| s.is_none()).ok_or("座位已滿")?,
        };
        let taken: Vec<String> = self.seats.iter().flatten().map(|s| s.character.clone()).collect();
        let taken: Vec<&str> = taken.iter().map(|s| s.as_str()).collect();
        let character = random_character(&mut self.rng, &taken).to_string();
        self.seats[seat] = Some(Seat {
            name: format!("電腦（{}）", difficulty.label()),
            character,
            kind: SeatKind::Bot,
            difficulty,
            token: String::new(),
            connected: true,
        });
        Ok(seat)
    }

    /// 離開座位（玩家自己離開或房主移除）。比賽中就算棄權。
    pub fn remove_seat(&mut self, seat: usize) -> Result<(), String> {
        let Some(s) = self.seats.get(seat).and_then(|s| s.as_ref()) else {
            return Err("這個座位沒有人".into());
        };
        let name = s.name.clone();
        self.retire(seat);
        if let Some(race) = self.race.as_mut() {
            race.entries.retain(|e| e.seat != seat);
        }
        self.seats[seat] = None;
        if self.host_seat == Some(seat) {
            self.host_seat = None;
        }
        self.sys(format!("{} 離開了座位", name));
        Ok(())
    }

    pub fn set_character(&mut self, seat: usize, id: &str) -> Result<(), String> {
        if self.playing() {
            return Err("比賽進行中不能換角色".into());
        }
        if !is_character(id) {
            return Err("沒有這個角色".into());
        }
        let s = self.seats[seat].as_mut().ok_or("你沒有座位")?;
        s.character = id.to_string();
        Ok(())
    }

    pub fn update_settings(&mut self, settings: Settings) {
        self.settings = Settings { world: settings.world.min(WORLDS - 1), stage: settings.stage.min(STAGES - 1), ..settings };
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

    /// 開跑：有人的座位都上場
    pub fn start(&mut self) -> Result<(), String> {
        let plan = self.settings.plan();
        let seed: u64 = self.rng.gen();
        let mut entries = Vec::new();
        for (i, s) in self.seats.iter().enumerate() {
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
        self.sys(if plan == Plan::Endless { "無盡比分，各就各位……".into() } else { "一起闖關，出發！".into() });
        Ok(())
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

    pub fn reset_to_lobby(&mut self) {
        self.race = None;
    }

    /// 前進一個影格。要送比賽影格的時候回傳 true。
    pub fn tick(&mut self) -> bool {
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
                let results = rank(race, &self.seats);
                let winner = results.first().and_then(|r| r["name"].as_str()).unwrap_or("").to_string();
                race.results = Some(results);
                self.ended_now = true;
                self.sys(format!("比賽結束！第一名：{}", winner));
            }
        }
        self.race.as_ref().is_some_and(|r| r.t % FRAME_EVERY == 0 || r.t == 1)
    }

    /// 大廳／房間資訊（有變動時送）
    pub fn view(&self, you: Option<usize>) -> Value {
        let seats: Vec<Value> = self
            .seats
            .iter()
            .map(|s| {
                s.as_ref().map_or(Value::Null, |s| {
                    json!({
                        "name": s.name,
                        "character": s.character,
                        "kind": s.kind,
                        "difficulty": s.difficulty,
                        "connected": s.connected,
                    })
                })
            })
            .collect();
        json!({
            "phase": if self.playing() { "playing" } else { "lobby" },
            "seats": seats,
            "host_seat": self.host_seat,
            "you": you,
            "settings": self.settings,
            "chat": self.chat,
        })
    }

    /// 比賽影格：大家的進度
    pub fn frame(&self) -> Option<Value> {
        let race = self.race.as_ref()?;
        let team_coins: u32 = race.entries.iter().map(|e| e.p.coins).sum();
        let runners: Vec<Value> = race
            .entries
            .iter()
            .map(|e| {
                let s = self.seats[e.seat].as_ref();
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
fn rank(race: &Race, seats: &[Option<Seat>; MAX_PLAYERS]) -> Vec<Value> {
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
