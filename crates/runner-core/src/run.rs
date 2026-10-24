//! 一個跑者跑一條跑道的模擬（確定性：同樣的種子、同樣的輸入，結果一定一樣）。
//! 單機、電腦對手、連線時每個人自己的那條路都是用這個跑。
//!
//! 操作只有三個：跳（可以二段跳）、滑（按住；空中按是快速落下）、衝（地上是衝刺、空中會追擊最近的敵人，
//! 沒有敵人就往前飛一小段）。

use crate::characters::{ability_of, Ability};
use crate::course::{BOUNCE, SPRING, physics_of, endless_speed, level_speed, Course, EnemyKind, ItemKind, ObKind, Physics, Plan, Shot, GROUND, PIT_Y, WORLDS};
use serde::Serialize;
use serde_json::{json, Value};

/// 開跑前的倒數（3、2、1、GO）
pub const COUNTDOWN: i32 = 180;
const W: f32 = 18.0;
const STAND_H: f32 = 84.0;
const SLIDE_H: f32 = 40.0;
/// 跑者在畫面上的位置（鏡頭 = x - 這個）
pub const SCREEN_X: f32 = 230.0;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Input {
    pub jump: bool,
    pub slide: bool,
    pub attack: bool,
}

impl Input {
    /// 前端送來的位元（src/lib/game/input.js 的 toBits）：8 下（按住＝滑）、32 衝、64 跳、128 也當衝（都是「剛按下」）
    pub fn from_bits(b: u32) -> Self {
        Input { jump: b & 64 != 0, slide: b & 8 != 0, attack: b & (32 | 128) != 0 }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Act {
    Ready,
    Run,
    Jump,
    Double,
    Fall,
    Slide,
    Dash,
    Homing,
    AirDash,
    Spring,
    Hurt,
    Goal,
    Out,
    /// 一起闖關時心沒了：變成靈魂跟著飄，等隊友救
    Soul,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Ready,
    Run,
    /// 過關（跑過終點）
    Goal,
    /// 體力用完
    Out,
    /// 一起闖關時體力用完：變成靈魂繼續往前飄（碰不到東西、吃不到金幣），隊友救回來就回到 Run
    Soul,
}

/// 這一格發生的事（音效、特效、台詞用）
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Event {
    Go,
    Jump,
    Double,
    Slide,
    Dash,
    Homing,
    Coin,
    Kill { x: f32, y: f32 },
    Bump { x: f32, y: f32 },
    Break { x: f32, y: f32 },
    Item { item: ItemKind },
    Spring,
    Hurt,
    Shield,
    Fall,
    Shot,
    Boss,
    BossHit,
    BossDown,
    Goal,
    Out,
    /// 變成靈魂（一起闖關）
    Soul,
    /// 被隊友救回來
    Revive,
    /// 無盡模式換場景
    Theme { world: usize },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BossState {
    Enter,
    Hover,
    Swoop,
    Hurt,
    Down,
}

/// 魔王：飛在前面丟東西，偶爾衝下來（這時候用空中追擊打牠）
#[derive(Clone, Debug, Serialize)]
pub struct Boss {
    pub world: usize,
    pub hp: i32,
    pub max: i32,
    /// 跟跑者的距離（魔王跟著跑者一起往前）
    pub off: f32,
    pub y: f32,
    pub state: BossState,
    pub t: i32,
    pub x: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct Runner {
    pub x: f32,
    pub y: f32,
    pub vy: f32,
    pub act: Act,
    /// 這個動作做了幾格
    pub act_t: i32,
    #[serde(skip)]
    pub on_ground: bool,
    #[serde(skip)]
    coyote: i32,
    #[serde(skip)]
    jumps_left: i32,
    #[serde(skip)]
    air_dash_left: i32,
    #[serde(skip)]
    dash_t: i32,
    #[serde(skip)]
    pub dash_cool: i32,
    #[serde(skip)]
    homing: Option<Target>,
    #[serde(skip)]
    slide_lock: i32,
    pub inv: i32,
    pub hp: i32,
    pub max_hp: i32,
    pub shield: bool,
    pub magnet: i32,
    #[serde(skip)]
    regen: i32,
    #[serde(skip)]
    hurt_t: i32,
    #[serde(skip)]
    last_x: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Target {
    Enemy(u32),
    Crate(u32),
    Boss,
}

#[derive(Clone)]
pub struct Run {
    pub plan: Plan,
    pub character: String,
    ab: Ability,
    pub course: Course,
    pub r: Runner,
    pub phase: Phase,
    /// 開跑後經過的影格（倒數不算）
    pub t: u32,
    pub ready: i32,
    pub coins: u32,
    pub kills: u32,
    pub score: u32,
    /// 空中連續打倒幾隻（落地歸零）
    pub combo: u32,
    /// 受傷次數（掉坑也算）
    pub hits: u32,
    pub boss: Option<Boss>,
    pub events: Vec<Event>,
    theme: usize,
    /// 一起闖關：心沒了變成靈魂（等隊友救），不是直接倒下
    pub coop: bool,
}

impl Run {
    pub fn new(plan: Plan, character: &str, seed: u64) -> Self {
        let ab = ability_of(character);
        let course = Course::new(plan, seed);
        let boss = match plan {
            Plan::Level { world, .. } if plan.is_boss() => {
                let max = 3 + world as i32 / 2;
                Some(Boss { world, hp: max, max, off: 900.0, y: 170.0, state: BossState::Enter, t: 0, x: 900.0 })
            }
            _ => None,
        };
        let theme = course.theme_at(0.0);
        Run {
            plan,
            character: character.to_string(),
            ab,
            course,
            r: Runner {
                x: 0.0,
                y: GROUND,
                vy: 0.0,
                act: Act::Ready,
                act_t: 0,
                on_ground: true,
                coyote: 0,
                jumps_left: ab.jumps,
                air_dash_left: 1,
                dash_t: 0,
                dash_cool: 0,
                homing: None,
                slide_lock: 0,
                inv: 0,
                hp: ab.hearts,
                max_hp: ab.hearts + 1,
                shield: ab.start_shield,
                magnet: 0,
                regen: ab.shield_regen,
                hurt_t: 0,
                last_x: 0.0,
            },
            phase: Phase::Ready,
            t: 0,
            ready: COUNTDOWN,
            coins: 0,
            kills: 0,
            score: 0,
            combo: 0,
            hits: 0,
            boss,
            events: Vec::new(),
            theme,
            coop: false,
        }
    }

    pub fn world_at_runner(&self) -> usize {
        self.course.theme_at(self.r.x)
    }

    fn phys(&self) -> Physics {
        physics_of(self.course.theme_at(self.r.x))
    }

    /// 現在的跑速
    pub fn speed(&self) -> f32 {
        let base = match self.plan {
            Plan::Level { world, stage } => level_speed(world, stage),
            Plan::Endless => endless_speed(self.r.x),
        };
        base * self.ab.speed
    }

    /// 跑了幾公尺
    pub fn meters(&self) -> u32 {
        (self.r.x.max(0.0) / 30.0) as u32
    }

    pub fn done(&self) -> bool {
        matches!(self.phase, Phase::Goal | Phase::Out)
    }

    /// 關卡模式的星星：過關 1 顆、金幣拿到七成以上 1 顆、沒受傷 1 顆
    pub fn stars(&self) -> u32 {
        if self.phase != Phase::Goal {
            return 0;
        }
        let total = self.course.coin_total.max(1);
        1 + (self.coins * 10 >= total * 7) as u32 + (self.hits == 0) as u32
    }

    fn set_act(&mut self, a: Act) {
        if self.r.act != a {
            self.r.act = a;
            self.r.act_t = 0;
        }
    }

    fn height(&self) -> f32 {
        if self.r.act == Act::Slide {
            SLIDE_H
        } else if matches!(self.r.act, Act::Homing | Act::Jump | Act::Double) {
            64.0
        } else {
            STAND_H
        }
    }

    /// 跑者的身體範圍 (x0, y0, x1, y1)
    pub fn body(&self) -> (f32, f32, f32, f32) {
        let h = self.height();
        (self.r.x - W, self.r.y - h, self.r.x + W, self.r.y)
    }

    fn attacking(&self) -> bool {
        matches!(self.r.act, Act::Dash | Act::Homing | Act::AirDash)
    }

    pub fn step(&mut self, input: Input) {
        self.events.clear();
        match self.phase {
            Phase::Ready => {
                self.ready -= 1;
                if self.ready <= 0 {
                    self.phase = Phase::Run;
                    self.set_act(Act::Run);
                    self.events.push(Event::Go);
                }
                return;
            }
            Phase::Soul => {
                self.soul_step();
                return;
            }
            Phase::Goal | Phase::Out => {
                // 過關後慢慢停下來
                if self.phase == Phase::Goal {
                    self.r.x += (self.speed() * (1.0 - self.r.act_t as f32 / 60.0)).max(0.0);
                    self.r.act_t += 1;
                }
                return;
            }
            Phase::Run => {}
        }
        self.t += 1;
        self.r.act_t += 1;
        self.course.ensure(self.r.x + 2200.0);
        let theme = self.course.theme_at(self.r.x);
        if theme != self.theme {
            self.theme = theme;
            self.events.push(Event::Theme { world: theme });
        }
        self.timers();
        self.control(input);
        self.physics(input);
        self.world_things();
        self.boss_step();
        self.collide();
        self.collect();
        if let Some(gx) = self.course.goal {
            if self.r.x >= gx && self.phase == Phase::Run {
                self.phase = Phase::Goal;
                self.set_act(Act::Goal);
                self.score += 1000 + self.r.hp.max(0) as u32 * 300;
                self.events.push(Event::Goal);
            }
        }
        if let Plan::Endless = self.plan {
            // 無盡模式：距離也算分（每公尺 10 分）
            let m = self.meters();
            let prev = (self.r.last_x.max(0.0) / 30.0) as u32;
            self.score += (m - prev.min(m)) * 10;
        }
        self.r.last_x = self.r.x;
        self.course.prune(self.r.x);
    }

    fn timers(&mut self) {
        let r = &mut self.r;
        r.inv = (r.inv - 1).max(0);
        r.dash_cool = (r.dash_cool - 1).max(0);
        r.magnet = (r.magnet - 1).max(0);
        r.hurt_t = (r.hurt_t - 1).max(0);
        r.slide_lock = (r.slide_lock - 1).max(0);
        if self.ab.shield_regen > 0 && !r.shield {
            r.regen -= 1;
            if r.regen <= 0 {
                r.shield = true;
                r.regen = self.ab.shield_regen;
                self.events.push(Event::Shield);
            }
        }
    }

    fn control(&mut self, input: Input) {
        let phys = self.phys();
        let ab = self.ab;
        if self.r.act == Act::Homing || self.r.hurt_t > 0 {
            return;
        }
        // 跳
        if input.jump {
            if self.r.on_ground || self.r.coyote > 0 {
                self.r.vy = -phys.jump * ab.jump;
                self.r.on_ground = false;
                self.r.coyote = 0;
                self.r.jumps_left = ab.jumps - 1;
                self.r.dash_t = 0;
                self.set_act(Act::Jump);
                self.events.push(Event::Jump);
            } else if self.r.jumps_left > 0 {
                self.r.vy = -phys.jump2 * ab.jump;
                self.r.jumps_left -= 1;
                self.set_act(Act::Double);
                self.r.act_t = 0;
                self.events.push(Event::Double);
            }
        }
        // 衝
        if input.attack {
            if self.r.on_ground {
                if self.r.dash_cool == 0 && self.r.act != Act::Dash {
                    self.r.dash_t = 18;
                    self.r.dash_cool = ab.dash_cool + 18;
                    self.set_act(Act::Dash);
                    self.events.push(Event::Dash);
                }
            } else if let Some(t) = self.find_target() {
                self.r.homing = Some(t);
                self.set_act(Act::Homing);
                self.events.push(Event::Homing);
                return;
            } else if self.r.air_dash_left > 0 {
                self.r.air_dash_left -= 1;
                self.r.vy = self.r.vy.min(0.0) * 0.2;
                self.set_act(Act::AirDash);
                self.events.push(Event::Dash);
            }
        }
        // 滑（按住）
        if input.slide && self.r.on_ground && self.r.act != Act::Dash {
            if self.r.act != Act::Slide {
                self.events.push(Event::Slide);
            }
            self.set_act(Act::Slide);
            self.r.slide_lock = 8;
        } else if self.r.act == Act::Slide && self.r.slide_lock == 0 && !self.under_bar() {
            self.set_act(Act::Run);
        }
    }

    /// 頭上有橫桿（滑行中不能站起來）
    fn under_bar(&self) -> bool {
        let x0 = self.r.x - W;
        let x1 = self.r.x + W;
        self.course.obstacles.iter().any(|o| o.kind == ObKind::Bar && o.x < x1 && o.x + o.w > x0)
    }

    /// 空中追擊的目標：前方最近的敵人、道具箱或魔王
    fn find_target(&self) -> Option<Target> {
        let range = 300.0 * self.ab.homing;
        let (cx, cy) = (self.r.x, self.r.y - 40.0);
        let ok = |x: f32, y: f32| {
            let dx = x - cx;
            dx > -10.0 && dx < range && (y - cy).abs() < 260.0
        };
        let mut best: Option<(f32, Target)> = None;
        let mut consider = |d: f32, t: Target| {
            if best.is_none_or(|b| d < b.0) {
                best = Some((d, t));
            }
        };
        for e in self.course.enemies.iter().filter(|e| e.alive) {
            let (_, h) = e.size();
            let y = e.y - h * 0.5;
            if ok(e.x, y) {
                consider(e.x - cx, Target::Enemy(e.id));
            }
        }
        for c in self.course.crates.iter().filter(|c| c.alive) {
            if ok(c.x, c.y - 30.0) {
                consider(c.x - cx, Target::Crate(c.id));
            }
        }
        if let Some(b) = &self.boss {
            if matches!(b.state, BossState::Hover | BossState::Swoop) && ok(b.x, b.y) {
                consider(b.x - cx, Target::Boss);
            }
        }
        best.map(|b| b.1)
    }

    fn target_pos(&self, t: Target) -> Option<(f32, f32)> {
        match t {
            Target::Enemy(id) => self.course.enemies.iter().find(|e| e.id == id && e.alive).map(|e| (e.x, e.y - e.size().1 * 0.5)),
            Target::Crate(id) => self.course.crates.iter().find(|c| c.id == id && c.alive).map(|c| (c.x, c.y - 30.0)),
            Target::Boss => self.boss.as_ref().filter(|b| matches!(b.state, BossState::Hover | BossState::Swoop)).map(|b| (b.x, b.y)),
        }
    }

    fn physics(&mut self, input: Input) {
        let phys = self.phys();
        let mut vx = self.speed();
        if self.r.hurt_t > 0 {
            vx *= 0.45;
        }
        // 追擊：直直飛向目標
        if self.r.act == Act::Homing {
            let target = self.r.homing.and_then(|t| self.target_pos(t));
            match target {
                Some((tx, ty)) if self.r.act_t < 28 => {
                    let (cx, cy) = (self.r.x, self.r.y - 32.0);
                    let (dx, dy) = (tx - cx, ty - cy);
                    let dist = (dx * dx + dy * dy).sqrt().max(0.001);
                    let sp = 22.0_f32.min(dist);
                    self.r.x += dx / dist * sp;
                    self.r.y += dy / dist * sp;
                    self.r.vy = 0.0;
                    return;
                }
                _ => {
                    self.r.homing = None;
                    self.set_act(Act::Fall);
                }
            }
        }
        if self.r.act == Act::Dash {
            self.r.dash_t -= 1;
            vx += 4.5;
            if self.r.dash_t <= 0 {
                self.set_act(Act::Run);
            }
        }
        if self.r.act == Act::AirDash {
            vx += 5.5;
            self.r.vy = 0.0;
            if self.r.act_t as f32 > 16.0 * self.ab.air_dash {
                self.set_act(Act::Fall);
            }
        } else if !self.r.on_ground {
            self.r.vy += phys.gravity;
            // 空中按住滑：快速落下
            if input.slide {
                self.r.vy += phys.gravity * 1.6;
            }
            self.r.vy = self.r.vy.min(18.0);
        }
        // 水平移動（撞牆就停住）
        let old_x = self.r.x;
        let new_x = old_x + vx;
        let top = self.r.y - self.height();
        let mut x = new_x;
        for s in self.course.solids.iter().filter(|s| !s.oneway) {
            if s.x0 >= old_x + W - 0.5 && s.x0 < new_x + W && self.r.y > s.y + 4.0 && top < PIT_Y {
                x = x.min(s.x0 - W);
            }
        }
        self.r.x = x;
        // 垂直
        let old_y = self.r.y;
        if !self.r.on_ground {
            self.r.y += self.r.vy;
            if self.r.vy >= 0.0 {
                // 落地：這一格從上面穿過某個平面
                let mut land: Option<f32> = None;
                for s in &self.course.solids {
                    if self.r.x + W * 0.7 > s.x0 && self.r.x - W * 0.7 < s.x1 && old_y <= s.y + 0.5 && self.r.y >= s.y {
                        land = Some(land.map_or(s.y, |l: f32| l.min(s.y)));
                    }
                }
                if let Some(ly) = land {
                    self.r.y = ly;
                    self.r.vy = 0.0;
                    self.r.on_ground = true;
                    self.r.jumps_left = self.ab.jumps;
                    self.r.air_dash_left = 1;
                    self.combo = 0;
                    if !matches!(self.r.act, Act::Dash | Act::Slide) {
                        self.set_act(if input.slide { Act::Slide } else { Act::Run });
                    }
                }
            }
            if !self.r.on_ground && self.r.vy > 0.5 && matches!(self.r.act, Act::Jump | Act::Double | Act::Run | Act::Spring) && self.r.act_t > 4 {
                self.set_act(Act::Fall);
            }
        } else {
            // 走出平台邊緣
            let below = self.course.solids.iter().any(|s| self.r.x + W * 0.7 > s.x0 && self.r.x - W * 0.7 < s.x1 && (s.y - self.r.y).abs() < 1.0);
            if !below {
                self.r.on_ground = false;
                self.r.coyote = 6;
                self.r.vy = 0.0;
                if self.r.act != Act::Dash {
                    self.set_act(Act::Fall);
                }
            }
        }
        if !self.r.on_ground {
            self.r.coyote = (self.r.coyote - 1).max(0);
        }
        // 掉下去了
        if self.r.y > PIT_Y {
            self.events.push(Event::Fall);
            self.damage(true);
            if self.phase == Phase::Run {
                self.respawn();
            }
        }
    }

    /// 掉坑之後：放回前面第一塊地面上
    /// 靈魂：照跑速往前飄，高度慢慢回到跑道上方（不碰東西、不吃金幣）
    fn soul_step(&mut self) {
        self.t += 1;
        self.r.act_t += 1;
        self.r.x += self.speed();
        let target = self.ground_under(self.r.x).unwrap_or(GROUND) - 90.0;
        self.r.y += (target - self.r.y) * 0.08;
        self.r.vy = 0.0;
        self.course.ensure(self.r.x + 2200.0);
        self.course.prune(self.r.x);
        let theme = self.course.theme_at(self.r.x);
        if theme != self.theme {
            self.theme = theme;
            self.events.push(Event::Theme { world: theme });
        }
    }

    /// 被隊友救回來：放回前面的地面上，一顆心＋一段無敵
    pub fn revive(&mut self) {
        if self.phase != Phase::Soul {
            return;
        }
        self.events.clear();
        self.phase = Phase::Run;
        self.r.hp = 1;
        self.r.hurt_t = 0;
        self.respawn();
        self.r.inv = 150;
        self.events.push(Event::Revive);
    }

    fn respawn(&mut self) {
        let x = self.r.x;
        let s = self
            .course
            .solids
            .iter()
            .filter(|s| s.x1 > x + 40.0 && !s.oneway)
            .min_by(|a, b| a.x0.partial_cmp(&b.x0).unwrap())
            .cloned();
        if let Some(s) = s {
            self.r.x = s.x0.max(x) + 40.0;
            self.r.y = s.y;
        } else {
            self.r.y = GROUND;
        }
        self.r.vy = 0.0;
        self.r.on_ground = true;
        self.r.inv = self.r.inv.max(90);
        self.r.homing = None;
        self.set_act(Act::Run);
        self.r.last_x = self.r.x.min(self.r.last_x);
    }

    /// 受傷：pit = 掉坑（護盾擋不住、無敵也沒用）
    fn damage(&mut self, pit: bool) {
        if !pit && self.r.inv > 0 {
            return;
        }
        if !pit && self.r.shield {
            self.r.shield = false;
            self.r.inv = 60;
            self.r.regen = self.ab.shield_regen;
            self.events.push(Event::Shield);
            return;
        }
        self.hits += 1;
        self.r.hp -= 1;
        self.r.inv = self.ab.invuln;
        self.combo = 0;
        self.events.push(Event::Hurt);
        if self.r.hp <= 0 {
            if self.coop {
                self.phase = Phase::Soul;
                self.set_act(Act::Soul);
                self.r.homing = None;
                self.events.push(Event::Soul);
            } else {
                self.phase = Phase::Out;
                self.set_act(Act::Out);
                self.events.push(Event::Out);
            }
            return;
        }
        if !pit {
            self.r.hurt_t = 20;
            self.r.homing = None;
            if !self.r.on_ground {
                self.r.vy = self.r.vy.min(-4.0);
            }
            self.set_act(Act::Hurt);
        }
    }

    /// 敵人、機關、飛行物自己動
    fn world_things(&mut self) {
        let rx = self.r.x;
        let ry = self.r.y;
        let t = self.t as i32;
        let mut new_shots = Vec::new();
        for e in self.course.enemies.iter_mut() {
            e.hurt = (e.hurt - 1).max(0);
            if !e.alive {
                continue;
            }
            e.t += 1;
            let near = e.x - rx;
            match e.kind {
                // 小混混站著不動（金幣與踩踏的節奏是照站著的位置排的）
                EnemyKind::Thug => {}
                EnemyKind::Knife => {
                    if near < 520.0 {
                        e.vx = (e.vx - 0.4).max(-4.5);
                    }
                    e.x += e.vx;
                }
                EnemyKind::Brute => {}
                EnemyKind::Thrower => {
                    // 跑近了每 80 格丟一個（拋物線，落在跑者會經過的地方）
                    if near < 720.0 && near > 140.0 && e.t % 80 == 20 {
                        let vy = -7.0;
                        new_shots.push(Shot { x: e.x - 20.0, y: e.y - 70.0, vx: -2.5, vy, r: 14.0, gravity: true, alive: true });
                    }
                }
            }
        }
        // 走路的敵人走到沒地板的地方就停（不要自己掉下去）
        let solids = self.course.solids.clone();
        for e in self.course.enemies.iter_mut().filter(|e| e.alive && e.kind == EnemyKind::Knife) {
            let on = solids.iter().any(|s| e.x - 10.0 > s.x0 && e.x + 10.0 < s.x1 && (s.y - e.y).abs() < 1.0);
            if !on {
                e.x += if e.kind == EnemyKind::Knife { -e.vx } else { 1.0 };
                e.vx = 0.0;
            }
        }
        if !new_shots.is_empty() {
            self.events.push(Event::Shot);
        }
        self.course.shots.extend(new_shots);
        for s in self.course.shots.iter_mut() {
            s.x += s.vx;
            s.y += s.vy;
            if s.gravity {
                s.vy += 0.3;
            }
            if s.gravity && solids.iter().any(|g| s.x > g.x0 && s.x < g.x1 && s.y + s.r >= g.y && s.y - s.vy + s.r <= g.y + 1.0) {
                s.alive = false;
            }
        }
        for o in self.course.obstacles.iter_mut() {
            match o.kind {
                ObKind::Icicle => {
                    if o.v == 0.0 && o.x - rx < 230.0 {
                        o.v = 0.5;
                    }
                    if o.v > 0.0 {
                        o.v += 0.55;
                        o.y += o.v;
                        if o.y + o.h > ry + 40.0 && o.y > GROUND {
                            o.alive = false;
                        }
                    }
                }
                ObKind::Geyser => {}
                _ => {}
            }
        }
        let _ = t;
    }

    /// 火柱現在有沒有在噴（週期 130 格，噴 50 格；前 30 格是預兆）
    pub fn geyser_on(&self, phase: f32) -> bool {
        let k = (self.t as i32 + phase as i32).rem_euclid(130);
        k >= 80
    }

    fn boss_step(&mut self) {
        let Some(mut b) = self.boss.take() else { return };
        let rx = self.r.x;
        let ground = self.ground_under(rx + 400.0).unwrap_or(GROUND);
        b.t += 1;
        let mut shots = Vec::new();
        let (target, rate): (f32, f32) = match b.state {
            BossState::Enter => {
                if b.t == 1 {
                    self.events.push(Event::Boss);
                }
                if b.t > 120 {
                    b.state = BossState::Hover;
                    b.t = 0;
                }
                (520.0, 0.04)
            }
            BossState::Hover => {
                // 上下飄（用三角波，不用 sin）
                let k = (b.t % 120) as f32 / 120.0;
                let tri = if k < 0.5 { k * 4.0 - 1.0 } else { 3.0 - k * 4.0 };
                b.y = 170.0 + tri * 30.0;
                // 丟東西：低的要跳、高的要滑
                let every = 78 - (b.world as i32 * 5);
                if b.t % every == every / 2 {
                    let low = (b.t / every) % 3 != 2;
                    let y = if low { ground - 20.0 } else { ground - 72.0 };
                    shots.push(Shot { x: b.x - 60.0, y, vx: -3.0 - b.world as f32 * 0.3, vy: 0.0, r: 16.0, gravity: false, alive: true });
                }
                if b.t > 300 {
                    b.state = BossState::Swoop;
                    b.t = 0;
                }
                (520.0, 0.08)
            }
            BossState::Swoop => {
                // 衝下來：這時候最好打（但碰到也會受傷）
                b.y += (ground - 150.0 - b.y) * 0.08;
                if b.t > 150 {
                    b.state = BossState::Hover;
                    b.t = 0;
                }
                (250.0, 0.05)
            }
            BossState::Hurt => {
                b.y += (150.0 - b.y) * 0.08;
                if b.t > 70 {
                    b.state = if b.hp <= 0 { BossState::Down } else { BossState::Hover };
                    b.t = 0;
                    if b.hp <= 0 {
                        self.events.push(Event::BossDown);
                        self.course.boss_down = true;
                        self.score += 3000;
                    }
                }
                (600.0, 0.08)
            }
            BossState::Down => {
                b.y += 6.0;
                (b.off - 2.0, 1.0)
            }
        };
        // 魔王在世界裡往前飛（跟跑者一樣快），再慢慢調整到想要的距離；追擊衝過去才追得上
        b.x += self.speed();
        b.x += (rx + target - b.x) * rate;
        b.off = b.x - rx;
        if !shots.is_empty() {
            self.events.push(Event::Shot);
        }
        self.course.shots.extend(shots);
        self.boss = Some(b);
    }

    /// x 底下最高的地面（沒有就 None）
    pub fn ground_under(&self, x: f32) -> Option<f32> {
        self.course.solids.iter().filter(|s| x >= s.x0 && x <= s.x1).map(|s| s.y).reduce(f32::min)
    }

    fn overlap(a: (f32, f32, f32, f32), b: (f32, f32, f32, f32)) -> bool {
        a.0 < b.2 && a.2 > b.0 && a.1 < b.3 && a.3 > b.1
    }

    fn collide(&mut self) {
        let body = self.body();
        let attacking = self.attacking();
        let falling = self.r.vy > 0.0 && !self.r.on_ground;
        let mut hurt = false;
        let mut bounce = false;
        // 敵人
        let homing = self.r.homing;
        for e in self.course.enemies.iter_mut().filter(|e| e.alive) {
            let (w, h) = e.size();
            let eb = (e.x - w * 0.5, e.y - h, e.x + w * 0.5, e.y);
            if !Self::overlap(body, eb) {
                continue;
            }
            let stomp = falling && body.3 - self.r.vy <= eb.1 + 14.0;
            if attacking || stomp {
                e.hp -= if homing == Some(Target::Enemy(e.id)) || self.r.act == Act::Dash { 2 } else { 1 };
                e.hurt = 18;
                if e.hp <= 0 {
                    e.alive = false;
                    self.kills += 1;
                    self.combo += 1;
                    self.score += 100 * self.combo.min(10);
                    self.events.push(Event::Kill { x: e.x, y: e.y - h * 0.5 });
                } else {
                    self.events.push(Event::Bump { x: e.x, y: e.y - h * 0.5 });
                }
                if !self.r.on_ground {
                    bounce = true;
                }
            } else {
                hurt = true;
            }
        }
        // 道具箱
        let mut items = Vec::new();
        for c in self.course.crates.iter_mut().filter(|c| c.alive) {
            let cb = (c.x - 30.0, c.y - 60.0, c.x + 30.0, c.y);
            if !Self::overlap(body, cb) {
                continue;
            }
            // 從旁邊跑過去也算打破（不要讓箱子變成障礙）
            c.alive = false;
            items.push(c.item);
            self.events.push(Event::Break { x: c.x, y: c.y - 30.0 });
            if !self.r.on_ground && (attacking || falling) {
                bounce = true;
            }
        }
        for it in items {
            self.give(it);
        }
        // 機關
        let breaker = self.ab.breaker && self.r.act == Act::Dash;
        for i in 0..self.course.obstacles.len() {
            let o = &self.course.obstacles[i];
            if !o.alive {
                continue;
            }
            let ob = match o.kind {
                ObKind::Geyser => {
                    if !self.geyser_on(o.v) {
                        continue;
                    }
                    (o.x, o.y, o.x + o.w, o.y + o.h)
                }
                _ => (o.x + 4.0, o.y + 4.0, o.x + o.w - 4.0, o.y + o.h),
            };
            if Self::overlap(body, ob) {
                if breaker && o.kind == ObKind::Spike {
                    let (x, y) = (o.x + o.w * 0.5, o.y);
                    self.course.obstacles[i].alive = false;
                    self.events.push(Event::Break { x, y });
                    self.score += 50;
                } else {
                    hurt = true;
                }
            }
        }
        // 飛行物（衝刺、追擊中可以打掉）
        for s in self.course.shots.iter_mut().filter(|s| s.alive) {
            let sb = (s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
            if Self::overlap(body, sb) {
                s.alive = false;
                if !attacking {
                    hurt = true;
                }
            }
        }
        // 彈簧
        let mut sprung = false;
        for sp in self.course.springs.iter_mut() {
            if (sp.x - self.r.x).abs() < 30.0 && (self.r.y - sp.y).abs() < 14.0 && self.r.vy >= 0.0 {
                sp.t = 12;
                sprung = true;
            }
            sp.t = (sp.t - 1).max(0);
        }
        if sprung {
            self.r.vy = -SPRING;
            self.r.on_ground = false;
            self.r.jumps_left = self.ab.jumps - 1;
            self.r.air_dash_left = 1;
            self.set_act(Act::Spring);
            self.events.push(Event::Spring);
        }
        // 魔王
        if let Some(b) = self.boss.as_mut() {
            if matches!(b.state, BossState::Hover | BossState::Swoop) {
                let bb = (b.x - 60.0, b.y - 60.0, b.x + 60.0, b.y + 60.0);
                if Self::overlap(body, bb) {
                    if attacking || falling {
                        b.hp -= 1;
                        b.state = BossState::Hurt;
                        b.t = 0;
                        self.score += 500;
                        self.events.push(Event::BossHit);
                        bounce = true;
                        self.r.homing = None;
                        // 往後彈開
                        self.r.vy = -9.0;
                    } else {
                        hurt = true;
                    }
                }
            }
        }
        if bounce {
            self.r.vy = -BOUNCE;
            self.r.on_ground = false;
            self.r.homing = None;
            self.r.jumps_left = self.r.jumps_left.max(1);
            self.r.air_dash_left = 1;
            self.set_act(Act::Jump);
        }
        if hurt && !bounce {
            self.damage(false);
        }
    }

    fn give(&mut self, item: ItemKind) {
        match item {
            ItemKind::Meat => {
                if self.r.hp < self.r.max_hp {
                    self.r.hp += 1;
                } else {
                    self.score += 300;
                }
            }
            ItemKind::Gem => self.score += 1000,
            ItemKind::Magnet => self.r.magnet = 60 * 8,
            ItemKind::Shield => self.r.shield = true,
        }
        self.events.push(Event::Item { item });
    }

    fn collect(&mut self) {
        let (cx, cy) = (self.r.x, self.r.y - 40.0);
        let radius = if self.r.magnet > 0 { 200.0 } else { self.ab.magnet };
        let mut got = 0;
        let pull = 16.0 + self.speed();
        for c in self.course.coins.iter_mut().filter(|c| !c.taken) {
            let (dx, dy) = (cx - c.x, cy - c.y);
            let d2 = dx * dx + dy * dy;
            if radius > 0.0 && d2 < radius * radius {
                c.pulled = true;
            }
            if c.pulled {
                let d = d2.sqrt().max(0.001);
                let sp = pull.min(d);
                c.x += dx / d * sp;
                c.y += dy / d * sp;
            }
            if (cx - c.x).abs() < 30.0 && (cy - c.y).abs() < 46.0 {
                c.taken = true;
                got += 1;
            }
        }
        if got > 0 {
            self.coins += got;
            self.score += (got as f32 * 10.0 * self.ab.coin_score) as u32;
            self.events.push(Event::Coin);
        }
    }

    /// 畫面用：跑者附近看得到的東西（JSON）
    pub fn view(&self) -> Value {
        let cam = self.r.x - SCREEN_X;
        let (a, b) = (cam - 160.0, cam + 1160.0);
        let solids: Vec<_> = self.course.solids.iter().filter(|s| s.x1 > a && s.x0 < b).collect();
        let obstacles: Vec<Value> = self
            .course
            .obstacles
            .iter()
            .filter(|o| o.alive && o.x + o.w > a && o.x < b)
            .map(|o| {
                let mut v = serde_json::to_value(o).unwrap_or(Value::Null);
                if o.kind == ObKind::Geyser {
                    let k = (self.t as i32 + o.v as i32).rem_euclid(130);
                    v["on"] = json!(k >= 80);
                    v["warn"] = json!((50..80).contains(&k));
                }
                v
            })
            .collect();
        let enemies: Vec<_> = self.course.enemies.iter().filter(|e| (e.alive || e.hurt > 0) && e.x > a && e.x < b).collect();
        let coins: Vec<_> = self.course.coins.iter().filter(|c| !c.taken && c.x > a && c.x < b).map(|c| [c.x.round(), c.y.round()]).collect();
        let crates: Vec<_> = self.course.crates.iter().filter(|c| c.alive && c.x > a && c.x < b).collect();
        let springs: Vec<_> = self.course.springs.iter().filter(|s| s.x > a && s.x < b).collect();
        let shots: Vec<_> = self.course.shots.iter().filter(|s| s.alive && s.x > a && s.x < b).collect();
        json!({
            "plan": self.plan,
            "character": self.character,
            "phase": self.phase,
            "ready": self.ready,
            "t": self.t,
            "cam": cam,
            "runner": self.r,
            "speed": self.speed(),
            "coins": self.coins,
            "coin_total": self.course.coin_total,
            "kills": self.kills,
            "score": self.score,
            "combo": self.combo,
            "hits": self.hits,
            "meters": self.meters(),
            "stars": self.stars(),
            "world": self.course.theme_at(cam + 480.0),
            "themes": self.course.themes.iter().filter(|t| t.0 > a - 2000.0).map(|t| [t.0.max(-1e9), t.1 as f32]).collect::<Vec<_>>(),
            "goal": self.course.goal,
            "solids": solids,
            "obstacles": obstacles,
            "enemies": enemies,
            "coins_at": coins,
            "crates": crates,
            "springs": springs,
            "shots": shots,
            "boss": self.boss,
            "events": self.events,
            "progress": self.progress(),
        })
    }

    /// 關卡模式的進度 0～1（無盡模式是 null）
    pub fn progress(&self) -> Option<f32> {
        match self.plan {
            Plan::Level { .. } if !self.plan.is_boss() => self.course.goal.map(|g| (self.r.x / g).clamp(0.0, 1.0)),
            Plan::Level { .. } => self.boss.as_ref().map(|b| 1.0 - b.hp.max(0) as f32 / b.max as f32),
            Plan::Endless => None,
        }
    }
}

/// 無盡模式的場景數（測試用）
pub const THEMES: usize = WORLDS;
