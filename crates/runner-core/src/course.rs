//! 跑道：六大關 × 每大關 8 小關（最後一小關是魔王關）＋無盡模式。
//!
//! 跑道是一段一段（chunk）往前生的：跑者跑到哪就生到前面一點、後面的丟掉，所以無盡模式可以一直跑。
//! 同一個種子一定生出一樣的跑道（連線競速時每個人在自己的電腦上跑同一條路），
//! 所以這裡不用 rand 的 SmallRng（32／64 位元的結果不一樣），用自己的 splitmix，也不用 sin／exp 這類各平台可能不一樣的函式。
//!
//! 座標：x 往右、y 往下，畫面 960×540。地面高度 450，比較高的台階 390、330。

use serde::Serialize;

pub const WORLDS: usize = 6;
/// 每大關幾小關（最後一關是魔王關）
pub const STAGES: usize = 8;
pub const GROUND: f32 = 450.0;
/// 掉到這裡以下就是掉下去了
pub const PIT_Y: f32 = 660.0;

/// 確定性的亂數（splitmix64）
#[derive(Clone)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed ^ 0x9E37_79B9_7F4A_7C15)
    }
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    /// 0..n
    pub fn below(&mut self, n: u32) -> u32 {
        (self.next() % n.max(1) as u64) as u32
    }
    /// 0.0..1.0
    pub fn unit(&mut self) -> f32 {
        (self.next() >> 40) as f32 / (1u64 << 24) as f32
    }
    pub fn range(&mut self, a: f32, b: f32) -> f32 {
        a + (b - a) * self.unit()
    }
    pub fn chance(&mut self, p: f32) -> bool {
        self.unit() < p
    }
}

/// 要跑哪一種跑道
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Plan {
    /// 關卡模式：第 world 大關的第 stage 小關（都從 0 算）
    Level { world: usize, stage: usize },
    /// 無盡模式：越跑越快、越來越刁鑽，每跑一段換一個大關的場景
    Endless,
}

impl Plan {
    pub fn is_boss(&self) -> bool {
        matches!(self, Plan::Level { stage, .. } if *stage == STAGES - 1)
    }
}

/// 各大關的物理差異（目前只有水下世界：重力小、跳得慢）
#[derive(Clone, Copy, Debug)]
pub struct Physics {
    pub gravity: f32,
    pub jump: f32,
    pub jump2: f32,
}

pub fn physics_of(world: usize) -> Physics {
    if world == 2 {
        Physics { gravity: 0.6, jump: 12.4, jump2: 10.6 }
    } else {
        Physics { gravity: 0.85, jump: 14.6, jump2: 12.6 }
    }
}

/// 關卡模式的跑速（每影格像素）：越後面越快
pub fn level_speed(world: usize, stage: usize) -> f32 {
    (6.2 + world as f32 * 0.38 + stage as f32 * 0.07).min(9.2)
}

/// 無盡模式的跑速：從 6 慢慢加到接近 13（跑越遠越快）
pub fn endless_speed(x: f32) -> f32 {
    let d = x.max(0.0) / 30.0; // 公尺
    6.0 + 7.0 * d / (d + 2600.0)
}

/// 無盡模式的難度 0～1
fn endless_difficulty(x: f32) -> f32 {
    let d = x.max(0.0) / 30.0;
    (d / (d + 1500.0) * 1.5).min(1.0)
}

/// 地面或平台。地面（oneway = false）一路延伸到畫面底下，從側面撞到會被擋住；平台只有上面能站
#[derive(Clone, Debug, Serialize)]
pub struct Solid {
    pub x0: f32,
    pub x1: f32,
    pub y: f32,
    pub oneway: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ObKind {
    /// 地上的尖刺（跳過去）
    Spike,
    /// 吊著的橫桿（滑過去）
    Bar,
    /// 冰柱：跑近就掉下來（冰山）
    Icicle,
    /// 火柱：一陣一陣噴（火炎礦坑）
    Geyser,
}

#[derive(Clone, Debug, Serialize)]
pub struct Obstacle {
    pub id: u32,
    pub kind: ObKind,
    pub x: f32,
    /// 上緣
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// 冰柱掉落速度、火柱的相位
    pub v: f32,
    pub alive: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EnemyKind {
    /// 小混混：慢慢走過來，踩或撞都能打倒
    Thug,
    /// 刀手：跑近就衝過來
    Knife,
    /// 大隻佬：要打兩下
    Brute,
    /// 投擲手：站著丟東西
    Thrower,
}

#[derive(Clone, Debug, Serialize)]
pub struct Enemy {
    pub id: u32,
    pub kind: EnemyKind,
    pub x: f32,
    /// 腳底
    pub y: f32,
    pub vx: f32,
    pub hp: i32,
    pub t: i32,
    pub alive: bool,
    /// 剛被打（閃一下）
    pub hurt: i32,
}

impl Enemy {
    pub fn size(&self) -> (f32, f32) {
        match self.kind {
            EnemyKind::Brute => (60.0, 104.0),
            _ => (44.0, 84.0),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Coin {
    pub x: f32,
    pub y: f32,
    pub taken: bool,
    /// 被磁鐵吸住了
    pub pulled: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    /// 烤肉：補一顆心
    Meat,
    /// 寶石：大量分數
    Gem,
    /// 磁鐵：一陣子金幣自己飛過來
    Magnet,
    /// 護盾：擋一次
    Shield,
}

/// 道具箱：打破或踩破會掉出道具（直接拿到）
#[derive(Clone, Debug, Serialize)]
pub struct Crate {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub item: ItemKind,
    pub alive: bool,
}

/// 彈簧
#[derive(Clone, Debug, Serialize)]
pub struct Spring {
    pub x: f32,
    pub y: f32,
    pub t: i32,
}

/// 飛行物（投擲手、魔王丟的）
#[derive(Clone, Debug, Serialize)]
pub struct Shot {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub r: f32,
    pub gravity: bool,
    pub alive: bool,
}

#[derive(Clone)]
pub struct Course {
    pub plan: Plan,
    seed: u64,
    chunk: u32,
    /// 下一段從哪裡開始生
    pub end_x: f32,
    cur_y: f32,
    next_id: u32,
    /// 關卡模式：幾段之後放終點（魔王關是打倒魔王才放）
    chunks_total: u32,
    pub goal: Option<f32>,
    /// 魔王倒了：下一段就放終點
    pub boss_down: bool,
    pub solids: Vec<Solid>,
    pub obstacles: Vec<Obstacle>,
    pub enemies: Vec<Enemy>,
    pub coins: Vec<Coin>,
    pub crates: Vec<Crate>,
    pub springs: Vec<Spring>,
    pub shots: Vec<Shot>,
    /// 無盡模式換場景的位置：(從哪個 x 開始, 大關)
    pub themes: Vec<(f32, usize)>,
    /// 關卡模式這一關總共幾枚金幣（算星星用）
    pub coin_total: u32,
}

/// 踩到敵人後彈起來的速度、彈簧的速度（run.rs 用同一個值）
pub const BOUNCE: f32 = 10.5;
pub const SPRING: f32 = 19.5;

/// 一段跑道生完後留的空間（魔王丟東西、終點前）
const START_FLAT: f32 = 900.0;

impl Course {
    pub fn new(plan: Plan, seed: u64) -> Self {
        // 關卡模式每一關的路是固定的（同一關每次玩、連線比賽都一樣，可以練）；無盡模式才用傳進來的種子
        let seed = match plan {
            Plan::Level { world, stage } => 0x5EED_0000 + (world * STAGES + stage) as u64,
            Plan::Endless => seed,
        };
        let chunks_total = match plan {
            Plan::Level { world, stage } => 9 + stage as u32 + world as u32 + (stage as u32 / 3),
            Plan::Endless => u32::MAX,
        };
        let world = match plan {
            Plan::Level { world, .. } => world,
            Plan::Endless => 0,
        };
        let mut c = Course {
            plan,
            seed,
            chunk: 0,
            end_x: 0.0,
            cur_y: GROUND,
            next_id: 1,
            chunks_total,
            goal: None,
            boss_down: false,
            solids: Vec::new(),
            obstacles: Vec::new(),
            enemies: Vec::new(),
            coins: Vec::new(),
            crates: Vec::new(),
            springs: Vec::new(),
            shots: Vec::new(),
            themes: vec![(f32::MIN, world)],
            coin_total: 0,
        };
        // 起跑的平地
        c.solids.push(Solid { x0: -600.0, x1: START_FLAT, y: GROUND, oneway: false });
        c.end_x = START_FLAT;
        // 關卡模式整條路先生好（金幣總數才算得出來）；無盡模式邊跑邊生
        if let Plan::Level { .. } = plan {
            if !plan.is_boss() {
                c.ensure(f32::MAX);
            }
        }
        c
    }

    /// 這個 x 是哪一大關的場景
    pub fn theme_at(&self, x: f32) -> usize {
        self.themes.iter().rev().find(|t| t.0 <= x).map(|t| t.1).unwrap_or(0)
    }

    pub fn finished_generating(&self) -> bool {
        self.goal.is_some()
    }

    /// 生到 x 為止
    pub fn ensure(&mut self, x: f32) {
        while self.end_x < x && self.goal.is_none() {
            self.gen_chunk();
        }
    }

    /// 丟掉跑者後面看不到的東西
    pub fn prune(&mut self, x: f32) {
        let cut = x - 700.0;
        self.solids.retain(|s| s.x1 > cut);
        self.obstacles.retain(|o| o.x + o.w > cut && o.alive);
        self.enemies.retain(|e| e.x > cut && (e.alive || e.hurt > 0));
        self.coins.retain(|c| c.x > cut && !c.taken);
        self.crates.retain(|c| c.x > cut && c.alive);
        self.springs.retain(|s| s.x > cut);
        self.shots.retain(|s| s.x > cut && s.alive && s.y < PIT_Y + 200.0);
        if self.themes.len() > 2 && self.themes[1].0 < cut {
            self.themes.remove(0);
        }
    }

    fn id(&mut self) -> u32 {
        self.next_id += 1;
        self.next_id
    }

    // ───────────── 生跑道 ─────────────

    fn gen_chunk(&mut self) {
        let mut rng = Rng::new(self.seed.wrapping_mul(0x2545_F491_4F6C_DD1D) ^ (self.chunk as u64).wrapping_mul(0x9E37_79B9));
        let start_x = self.end_x;
        self.chunk += 1;
        let (world, d, v) = match self.plan {
            Plan::Level { world, stage } => {
                if self.chunk > self.chunks_total && !self.plan.is_boss() {
                    return self.gen_goal();
                }
                if self.plan.is_boss() && self.boss_down {
                    return self.gen_goal();
                }
                ((world), (world * STAGES + stage) as f32 / (WORLDS * STAGES - 1) as f32, level_speed(world, stage))
            }
            Plan::Endless => {
                // 每 9 段換一個場景（大關）
                let theme = (self.chunk as usize / 9) % WORLDS;
                if self.theme_at(start_x) != theme {
                    self.themes.push((start_x, theme));
                }
                (theme, endless_difficulty(start_x).min(1.0), endless_speed(start_x + 500.0))
            }
        };
        let g = Gen { world, d, v, phys: physics_of(world), boss: self.plan.is_boss(), endless: self.plan == Plan::Endless };
        // 段跟段之間先接一小段平地
        self.ground(&g, rng.range(90.0, 180.0) + v * 8.0);
        let pattern = g.pick(&mut rng);
        let before = self.coins.len();
        self.pattern(&g, pattern, &mut rng);
        self.coin_total += (self.coins.len() - before) as u32;
    }

    fn gen_goal(&mut self) {
        if self.cur_y != GROUND {
            self.cur_y = GROUND;
        }
        let x = self.end_x;
        self.solids.push(Solid { x0: x, x1: x + 2400.0, y: self.cur_y, oneway: false });
        let before = self.coins.len();
        self.line_coins(x + 200.0, x + 600.0, self.cur_y - 40.0);
        self.coin_total += (self.coins.len() - before) as u32;
        self.goal = Some(x + 800.0);
        self.end_x = x + 2400.0;
    }

    /// 平地（接在目前的高度）
    fn ground(&mut self, _g: &Gen, len: f32) {
        let x = self.end_x;
        // 跟上一塊同高度就接起來
        if let Some(last) = self.solids.last_mut() {
            if !last.oneway && last.y == self.cur_y && (last.x1 - x).abs() < 1.0 {
                last.x1 = x + len;
                self.end_x = x + len;
                return;
            }
        }
        self.solids.push(Solid { x0: x, x1: x + len, y: self.cur_y, oneway: false });
        self.end_x = x + len;
    }

    fn gap(&mut self, len: f32) {
        self.end_x += len;
    }

    fn line_coins(&mut self, x0: f32, x1: f32, y: f32) {
        let mut x = x0;
        while x <= x1 {
            self.coins.push(Coin { x, y, taken: false, pulled: false });
            x += 42.0;
        }
    }

    /// 拋物線排的金幣：從 (x0, y) 到 (x1, y)，最高 h
    fn arc_coins(&mut self, x0: f32, x1: f32, y: f32, h: f32, n: usize) {
        for i in 0..n {
            let t = i as f32 / (n - 1).max(1) as f32;
            let k = 4.0 * t * (1.0 - t);
            self.coins.push(Coin { x: x0 + (x1 - x0) * t, y: y - h * k, taken: false, pulled: false });
        }
    }

    /// 沿著真正的跳躍軌跡放金幣（跟 run.rs 的物理一樣：先加重力再移動）。
    /// 從 (x0, y0) 起跳，初速 vy0；double_at = 第幾格按二段跳；往下掉到 land_y 為止。回傳落地的 x。
    fn trail(&mut self, g: &Gen, x0: f32, y0: f32, vy0: f32, double_at: Option<u32>, land_y: f32) -> f32 {
        let every = (40.0 / g.v).round().max(3.0) as u32;
        let (mut x, mut y, mut vy) = (x0, y0, vy0);
        for t in 1..400u32 {
            if double_at == Some(t) {
                vy = -g.phys.jump2;
            }
            vy += g.phys.gravity;
            x += g.v;
            y += vy;
            if vy > 0.0 && y >= land_y {
                return x;
            }
            if t % every == 0 {
                self.coins.push(Coin { x, y: y - 40.0, taken: false, pulled: false });
            }
        }
        x
    }

    fn enemy(&mut self, kind: EnemyKind, x: f32, y: f32) {
        let id = self.id();
        let hp = if kind == EnemyKind::Brute { 2 } else { 1 };
        self.enemies.push(Enemy { id, kind, x, y, vx: 0.0, hp, t: 0, alive: true, hurt: 0 });
    }

    fn obstacle(&mut self, kind: ObKind, x: f32, ground: f32) {
        let id = self.id();
        let (y, w, h) = match kind {
            ObKind::Spike => (ground - 34.0, 44.0, 34.0),
            // 站著（高 84）會撞到，滑行（高 40）過得去
            ObKind::Bar => (ground - 62.0 - 300.0, 56.0, 300.0),
            ObKind::Icicle => (40.0, 30.0, 60.0),
            ObKind::Geyser => (ground - 170.0, 46.0, 170.0),
        };
        self.obstacles.push(Obstacle { id, kind, x, y, w, h, v: 0.0, alive: true });
    }

    fn crate_box(&mut self, x: f32, y: f32, rng: &mut Rng) {
        let id = self.id();
        let item = match rng.below(10) {
            0..=2 => ItemKind::Meat,
            3..=5 => ItemKind::Gem,
            6..=7 => ItemKind::Magnet,
            _ => ItemKind::Shield,
        };
        self.crates.push(Crate { id, x, y, item, alive: true });
    }

    fn pattern(&mut self, g: &Gen, p: Pattern, rng: &mut Rng) {
        let v = g.v;
        let y = self.cur_y;
        match p {
            Pattern::Flat => {
                let x = self.end_x;
                let len = 500.0 + rng.range(0.0, 300.0);
                self.ground(g, len);
                self.line_coins(x + 60.0, x + len - 60.0, y - 40.0);
            }
            Pattern::Spikes => {
                let n = 1 + rng.below(if g.d > 0.5 { 3 } else { 2 }) as usize;
                let space = g.single_air() * v * rng.range(1.55, 1.8);
                let x = self.end_x;
                let len = 160.0 + space * n as f32 + 120.0;
                self.ground(g, len);
                for i in 0..n {
                    let sx = x + 160.0 + space * i as f32;
                    self.obstacle(ObKind::Spike, sx, y);
                    // 最高點剛好在尖刺正上方
                    let apex = g.phys.jump / g.phys.gravity;
                    self.trail(g, sx + 22.0 - v * apex, y, -g.phys.jump, None, y);
                }
            }
            Pattern::Gap => {
                let len = g.single_reach() * rng.range(0.45, 0.75);
                let x = self.end_x;
                self.gap(len);
                // 在坑邊前一點起跳、一段跳過去
                let takeoff = x - v * 4.0 - (g.single_reach() * 0.75 - len) * 0.5;
                self.trail(g, takeoff, y, -g.phys.jump, None, y);
                self.ground(g, 260.0);
            }
            Pattern::BigGap => {
                let len = g.double_reach() * rng.range(0.55, 0.78);
                let x = self.end_x;
                self.gap(len);
                // 坑邊起跳、最高點按二段跳
                let apex = (g.phys.jump / g.phys.gravity).round() as u32;
                self.trail(g, x - v * 3.0, y, -g.phys.jump, Some(apex), y);
                self.ground(g, 300.0);
            }
            Pattern::Steps => {
                // 往上或往下一階
                let up = if self.cur_y >= GROUND { true } else if self.cur_y <= GROUND - 120.0 { false } else { rng.chance(0.5) };
                let x = self.end_x;
                self.ground(g, 160.0);
                self.cur_y += if up { -60.0 } else { 60.0 };
                self.ground(g, 420.0);
                if up {
                    // 台階前起跳、落在上面一階
                    self.trail(g, x + 160.0 - v * 12.0, y, -g.phys.jump, None, self.cur_y);
                } else {
                    // 從邊緣走下去會掉下來：沿著掉落的弧線
                    self.trail(g, x + 160.0, y, 0.0, None, self.cur_y);
                }
            }
            Pattern::Platforms => {
                // 一大段坑上面有幾塊浮台
                let n = 2 + rng.below(2) as usize;
                let hop = g.single_reach() * 0.42;
                let mut x = self.end_x + hop * 0.6;
                let mut py = y;
                for i in 0..n {
                    py = (py - rng.range(-40.0, 70.0)).clamp(GROUND - 200.0, GROUND - 20.0);
                    let w = 170.0 + rng.range(0.0, 90.0);
                    self.solids.push(Solid { x0: x, x1: x + w, y: py, oneway: true });
                    self.line_coins(x + 30.0, x + w - 30.0, py - 40.0);
                    if g.d > 0.35 && i == 1 && rng.chance(0.5) {
                        self.enemy(EnemyKind::Thug, x + w * 0.6, py);
                    }
                    x += w + hop * rng.range(0.55, 0.9);
                }
                self.end_x = x;
                // 回到地面（跟最後一塊浮台差不多高、不要太高）
                self.cur_y = if py < GROUND - 100.0 { GROUND - 60.0 } else { GROUND };
                self.ground(g, 280.0);
            }
            Pattern::Thugs => {
                // 一排站著的敵人：踩到第一隻彈起來剛好落在下一隻頭上（踩著一路過去），金幣沿著這條線
                let n = 1 + rng.below(if g.d > 0.4 { 3 } else { 2 }) as usize;
                let kind = if g.world >= 1 && rng.chance(0.25 + g.d * 0.3) { EnemyKind::Brute } else { EnemyKind::Thug };
                let h = if kind == EnemyKind::Brute { 104.0 } else { 84.0 };
                let top = y - h;
                // 踩到後的彈跳（run.rs 的 bounce：vy = -10.5）回到同樣高度要幾格
                let mut bounce = 0.0;
                let mut vy = -BOUNCE;
                let mut dy = 0.0;
                while bounce < 200.0 {
                    vy += g.phys.gravity;
                    dy += vy;
                    bounce += 1.0;
                    if vy > 0.0 && dy >= 0.0 {
                        break;
                    }
                }
                let space = v * bounce;
                let x = self.end_x;
                let first = x + 320.0;
                let len = 320.0 + space * (n - 1) as f32 + 320.0;
                self.ground(g, len);
                for i in 0..n {
                    self.enemy(kind, first + space * i as f32, y);
                }
                // 起跳點：落下時剛好踩到第一隻的頭
                let mut probe = Course::new(Plan::Endless, 0);
                let dx = probe.trail(g, 0.0, y, -g.phys.jump, None, top);
                self.trail(g, first - dx, y, -g.phys.jump, None, top);
                for i in 0..n {
                    let ex = first + space * i as f32;
                    let land = if i + 1 < n { top } else { y };
                    self.trail(g, ex, top, -BOUNCE, None, land);
                }
            }
            Pattern::Knives => {
                let x = self.end_x;
                self.ground(g, 900.0);
                self.enemy(EnemyKind::Knife, x + 700.0, y);
                self.line_coins(x + 100.0, x + 500.0, y - 40.0);
            }
            Pattern::Bars => {
                let n = 1 + rng.below(if g.d > 0.5 { 3 } else { 2 }) as usize;
                let x = self.end_x;
                let space = 200.0 + v * 22.0;
                let len = 200.0 + space * n as f32 + 100.0;
                self.ground(g, len);
                for i in 0..n {
                    let bx = x + 220.0 + space * i as f32;
                    self.obstacle(ObKind::Bar, bx, y);
                    self.line_coins(bx - 40.0, bx + 90.0, y - 22.0);
                }
            }
            Pattern::SpikeBar => {
                // 跳完馬上要滑
                let x = self.end_x;
                let space = g.single_air() * v * 1.3 + 110.0;
                self.ground(g, 260.0 + space * 2.0 + 140.0);
                self.obstacle(ObKind::Spike, x + 220.0, y);
                self.obstacle(ObKind::Bar, x + 220.0 + space, y);
                self.obstacle(ObKind::Spike, x + 220.0 + space * 2.0, y);
                self.line_coins(x + 220.0 + space - 30.0, x + 220.0 + space + 90.0, y - 22.0);
            }
            Pattern::Spring => {
                let x = self.end_x;
                self.ground(g, 260.0);
                self.springs.push(Spring { x: x + 140.0, y, t: 0 });
                // 彈簧的軌跡（run.rs：vy = -SPRING）
                let air = 2.0 * SPRING / g.phys.gravity;
                self.trail(g, x + 140.0, y, -SPRING, None, y);
                let gap = air * v * 0.42;
                self.gap(gap);
                self.ground(g, 340.0);
                if g.d > 0.3 {
                    self.obstacle(ObKind::Spike, x + 260.0 + gap * 0.5, y);
                }
            }
            Pattern::Thrower => {
                let x = self.end_x;
                self.ground(g, 820.0);
                let px = x + 360.0;
                let py = y - 130.0;
                self.solids.push(Solid { x0: px, x1: px + 220.0, y: py, oneway: true });
                self.enemy(EnemyKind::Thrower, px + 160.0, py);
                self.line_coins(px + 20.0, px + 120.0, py - 40.0);
                self.line_coins(x + 80.0, x + 300.0, y - 40.0);
            }
            Pattern::Chain => {
                // 大坑上面一排敵人：空中追擊一路打過去（打不到就要靠二段跳）
                let x = self.end_x;
                let n = 3;
                let span = g.double_reach() * 0.62;
                self.gap(span);
                for i in 0..n {
                    let ex = x + span * (i as f32 + 0.8) / (n as f32 + 0.6);
                    let ey = y - 110.0 - i as f32 * 30.0;
                    // 每隻底下有一根小柱子（踩得到）
                    self.solids.push(Solid { x0: ex - 34.0, x1: ex + 34.0, y: ey, oneway: true });
                    self.enemy(EnemyKind::Thug, ex, ey);
                }
                self.arc_coins(x, x + span, y - 230.0, 40.0, 7);
                self.ground(g, 300.0);
            }
            Pattern::Icicles => {
                let x = self.end_x;
                let n = 2 + rng.below(2) as usize;
                let space = 220.0 + v * 14.0;
                self.ground(g, 200.0 + space * n as f32 + 200.0);
                for i in 0..n {
                    self.obstacle(ObKind::Icicle, x + 300.0 + space * i as f32, y);
                }
                self.line_coins(x + 200.0, x + 200.0 + space * n as f32, y - 40.0);
            }
            Pattern::Geysers => {
                let x = self.end_x;
                let n = 2 + rng.below(2) as usize;
                let space = 200.0 + v * 20.0;
                self.ground(g, 200.0 + space * n as f32 + 200.0);
                for i in 0..n {
                    self.obstacle(ObKind::Geyser, x + 260.0 + space * i as f32, y);
                    let last = self.obstacles.last_mut().unwrap();
                    last.v = (i as f32 * 37.0 + rng.range(0.0, 60.0)).floor();
                }
                self.arc_coins(x + 200.0, x + 200.0 + space * n as f32, y - 40.0, 60.0, 2 + n * 3);
            }
            Pattern::Crate => {
                let x = self.end_x;
                self.ground(g, 520.0);
                let cx = x + 260.0;
                self.crate_box(cx, y, rng);
                self.line_coins(x + 60.0, x + 180.0, y - 40.0);
            }
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Pattern {
    Flat,
    Spikes,
    Gap,
    BigGap,
    Steps,
    Platforms,
    Thugs,
    Knives,
    Bars,
    SpikeBar,
    Spring,
    Thrower,
    Chain,
    Icicles,
    Geysers,
    Crate,
}

/// 生跑道時的條件：大關（決定有哪些機關）、難度 0～1、跑速、物理
struct Gen {
    world: usize,
    d: f32,
    v: f32,
    phys: Physics,
    boss: bool,
    endless: bool,
}

impl Gen {
    /// 一段跳在空中的影格數
    fn single_air(&self) -> f32 {
        2.0 * self.phys.jump / self.phys.gravity
    }
    fn single_height(&self) -> f32 {
        self.phys.jump * self.phys.jump / (2.0 * self.phys.gravity)
    }
    /// 一段跳最遠飛多遠
    fn single_reach(&self) -> f32 {
        self.single_air() * self.v
    }
    /// 二段跳（在最高點再跳）最遠飛多遠
    fn double_reach(&self) -> f32 {
        let p = self.phys;
        let h = self.single_height() + p.jump2 * p.jump2 / (2.0 * p.gravity);
        let t = p.jump / p.gravity + p.jump2 / p.gravity + (2.0 * h / p.gravity).sqrt();
        t * self.v
    }

    fn pick(&self, rng: &mut Rng) -> Pattern {
        use Pattern::*;
        let w = self.world;
        let d = self.d;
        // (圖樣, 權重)
        let mut table: Vec<(Pattern, f32)> = vec![(Flat, 1.4 - d), (Spikes, 2.0), (Gap, 2.0), (Steps, 1.2), (Thugs, 1.8), (Crate, 0.5)];
        if self.boss {
            // 魔王關：路單純一點，注意力放在魔王
            table = vec![(Flat, 2.0), (Spikes, 1.0), (Gap, 1.2), (Steps, 0.6), (Crate, 0.4)];
            return weighted(&table, rng);
        }
        if d > 0.08 || w > 0 {
            table.push((Platforms, 1.0 + d));
        }
        if d > 0.12 || w > 0 {
            table.push((BigGap, 0.6 + d * 1.5));
        }
        let has = |world: usize| self.endless || w >= world;
        if has(1) {
            table.push((Bars, 1.8));
            table.push((Spring, 0.8));
        }
        if has(2) {
            table.push((Thrower, 1.0));
            table.push((Chain, 0.6 + d));
        }
        if has(3) {
            table.push((Knives, 0.9));
        }
        if w == 3 && !self.endless || self.endless && w == 3 {
            table.push((Icicles, 1.8));
        }
        if w == 4 {
            table.push((Geysers, 1.8));
        }
        if has(1) && d > 0.3 {
            table.push((SpikeBar, 0.5 + d));
        }
        weighted(&table, rng)
    }
}

fn weighted(table: &[(Pattern, f32)], rng: &mut Rng) -> Pattern {
    let total: f32 = table.iter().map(|t| t.1.max(0.0)).sum();
    let mut r = rng.unit() * total;
    for (p, w) in table {
        r -= w.max(0.0);
        if r <= 0.0 {
            return *p;
        }
    }
    table[0].0
}
