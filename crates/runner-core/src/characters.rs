//! 角色與各自的小能力。id 要跟前端 src/lib/game/characters.js 一致（那邊放名字、台詞、能力說明、圖片）。
//! 能力都是「小小的不一樣」：不會讓誰一定贏，只是玩起來手感不同。

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ability {
    /// 跑速倍率
    pub speed: f32,
    /// 體力（愛心數）
    pub hearts: i32,
    /// 能跳幾段（2 = 二段跳）
    pub jumps: i32,
    /// 跳躍力倍率
    pub jump: f32,
    /// 平常就有的金幣吸取半徑（0 = 沒有）
    pub magnet: f32,
    /// 空中追擊的搜尋距離倍率
    pub homing: f32,
    /// 空中衝刺的時間倍率
    pub air_dash: f32,
    /// 地面衝刺的冷卻（影格）
    pub dash_cool: i32,
    /// 衝刺可以撞碎地上的尖刺
    pub breaker: bool,
    /// 開場就有護盾
    pub start_shield: bool,
    /// 每隔幾影格自動補護盾（0 = 不會）
    pub shield_regen: i32,
    /// 受傷後的無敵時間（影格）
    pub invuln: i32,
    /// 金幣分數倍率
    pub coin_score: f32,
}

const BASE: Ability = Ability {
    speed: 1.0,
    hearts: 3,
    jumps: 2,
    jump: 1.0,
    magnet: 0.0,
    homing: 1.0,
    air_dash: 1.0,
    dash_cool: 50,
    breaker: false,
    start_shield: false,
    shield_regen: 0,
    invuln: 100,
    coin_score: 1.0,
};

/// (id, 隱藏角色)
pub const CHARACTERS: &[(&str, bool)] = &[
    ("xiaocui", false),
    ("yuehua", false),
    ("aming", false),
    ("tangtang", false),
    ("xiaochun", false),
    ("lanjie", false),
    ("cangya", false),
    ("jinye", false),
    ("leo", false),
    ("alie", false),
    ("ayi", true),
];

pub fn is_character(id: &str) -> bool {
    CHARACTERS.iter().any(|c| c.0 == id)
}

/// 每個角色的能力；不認得的 id 用基本值
pub fn ability_of(id: &str) -> Ability {
    match id {
        // 小翠：幸運磁鐵，金幣自己飛過來
        "xiaocui" => Ability { magnet: 110.0, ..BASE },
        // 月華：冷靜，開場有護盾、受傷後無敵比較久
        "yuehua" => Ability { start_shield: true, invuln: 150, ..BASE },
        // 阿明：熱血衝刺，地面衝刺幾乎可以連發
        "aming" => Ability { dash_cool: 18, ..BASE },
        // 糖糖：輕飄飄，三段跳
        "tangtang" => Ability { jumps: 3, jump: 0.94, ..BASE },
        // 小春：飛毛腿，跑最快但只有兩顆心
        "xiaochun" => Ability { speed: 1.05, hearts: 2, ..BASE },
        // 蘭姐：大姊頭，四顆心
        "lanjie" => Ability { hearts: 4, ..BASE },
        // 蒼牙：獵犬，空中追擊找得比較遠
        "cangya" => Ability { homing: 1.45, ..BASE },
        // 金爺：財神，金幣分數兩倍
        "jinye" => Ability { coin_score: 2.0, ..BASE },
        // 雷歐：滑翔，空中衝刺飛得比較久
        "leo" => Ability { air_dash: 1.8, ..BASE },
        // 阿烈：鐵頭，衝刺能撞碎尖刺
        "alie" => Ability { breaker: true, ..BASE },
        // 阿翼（隱藏）：騎士盔甲，跳得比較高、每 20 秒自動補護盾
        "ayi" => Ability { jump: 1.06, start_shield: true, shield_regen: 20 * 60, ..BASE },
        _ => BASE,
    }
}

/// 隨機挑一個非隱藏角色（電腦對手用），盡量不跟別人重複
pub fn random_character(rng: &mut impl rand::Rng, avoid: &[&str]) -> &'static str {
    let mut pool: Vec<&str> = CHARACTERS.iter().filter(|c| !c.1 && !avoid.contains(&c.0)).map(|c| c.0).collect();
    if pool.is_empty() {
        pool = CHARACTERS.iter().filter(|c| !c.1).map(|c| c.0).collect();
    }
    pool[rng.gen_range(0..pool.len())]
}
