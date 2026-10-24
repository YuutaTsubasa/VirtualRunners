//! 電腦跑者：每隔一陣子把跑者複製一份，試跑幾種按法（現在跳、晚一點跳、二段跳、滑、追擊…）一秒左右，
//! 挑不會受傷、跑得遠、吃到比較多金幣的那一種照著按。
//! 也拿來在測試裡確認每一關都過得去（電腦過得去，人就過得去）。

use crate::course::Rng;
use crate::run::{Event, Input, Phase, Run};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Easy,
    #[default]
    Normal,
    Hard,
}

impl Difficulty {
    pub fn label(&self) -> &'static str {
        match self {
            Difficulty::Easy => "簡單",
            Difficulty::Normal => "普通",
            Difficulty::Hard => "困難",
        }
    }
    /// 每格「發呆」的機率（發呆的時候不按任何鍵）
    fn daze(&self) -> f32 {
        match self {
            Difficulty::Easy => 0.010,
            Difficulty::Normal => 0.0035,
            Difficulty::Hard => 0.0,
        }
    }
}

const HORIZON: usize = 56;

pub struct Ai {
    pub difficulty: Difficulty,
    queue: Vec<Input>,
    /// 至少照著按幾格才重新想
    commit: usize,
    daze: i32,
    rng: Rng,
}

const N: Input = Input { jump: false, slide: false, attack: false };
const J: Input = Input { jump: true, slide: false, attack: false };
const S: Input = Input { jump: false, slide: true, attack: false };
const A: Input = Input { jump: false, slide: false, attack: true };

fn seq(parts: &[(Input, usize)]) -> Vec<Input> {
    let mut v = Vec::new();
    for (i, n) in parts {
        v.extend(std::iter::repeat_n(*i, *n));
    }
    v
}

/// 要試的按法
fn candidates() -> Vec<Vec<Input>> {
    let mut c = vec![seq(&[(N, 10)])];
    for d in [0, 3, 6, 10, 15] {
        c.push(seq(&[(N, d), (J, 1), (N, 30)]));
    }
    for d in [0, 5, 10] {
        for k in [7, 11, 15, 20, 26] {
            c.push(seq(&[(N, d), (J, 1), (N, k), (J, 1), (N, 24)]));
        }
    }
    for d in [0, 6] {
        for k in [5, 10, 16, 22] {
            c.push(seq(&[(N, d), (J, 1), (N, k), (A, 1), (N, 20)]));
        }
    }
    for k in [10, 16] {
        for k2 in [6, 12] {
            c.push(seq(&[(J, 1), (N, k), (J, 1), (N, k2), (A, 1), (N, 16)]));
        }
    }
    c.push(seq(&[(S, 34)]));
    c.push(seq(&[(S, 54)]));
    c.push(seq(&[(N, 6), (S, 40)]));
    c.push(seq(&[(A, 1), (N, 14)]));
    c.push(seq(&[(A, 1), (N, 6), (J, 1), (N, 24)]));
    c
}

/// 試跑的結果：分數越高越好
fn evaluate(run: &Run, plan: &[Input]) -> f32 {
    let mut sim = run.clone();
    let (x0, hits0, coins0) = (sim.r.x, sim.hits, sim.coins);
    let mut bonus = 0.0;
    for f in 0..HORIZON {
        sim.step(plan.get(f).copied().unwrap_or(N));
        for e in &sim.events {
            match e {
                Event::Kill { .. } => bonus += 60.0,
                Event::BossHit => bonus += 3000.0,
                Event::Item { .. } => bonus += 40.0,
                _ => {}
            }
        }
        if sim.hits > hits0 || sim.phase == Phase::Out {
            // 越晚出事越好（至少撐久一點）
            return -100_000.0 + f as f32 * 100.0;
        }
        if sim.phase == Phase::Goal {
            return 100_000.0;
        }
    }
    (sim.r.x - x0) + (sim.coins - coins0) as f32 * 25.0 + bonus
        // 不要沒事亂按
        - plan.iter().filter(|i| **i != N).count() as f32 * 0.5
}

impl Ai {
    pub fn new(difficulty: Difficulty, seed: u64) -> Self {
        Ai { difficulty, queue: Vec::new(), commit: 0, daze: 0, rng: Rng::new(seed) }
    }

    pub fn think(&mut self, run: &Run) -> Input {
        if run.phase != Phase::Run {
            self.queue.clear();
            return N;
        }
        if self.daze > 0 {
            self.daze -= 1;
            return N;
        }
        if self.rng.chance(self.difficulty.daze()) {
            self.daze = 18;
            self.queue.clear();
            return N;
        }
        if self.commit > 0 {
            self.commit -= 1;
        } else if self.queue.is_empty() || evaluate(run, &self.queue) < 0.0 {
            let mut best = (f32::MIN, Vec::new());
            for c in candidates() {
                let s = evaluate(run, &c);
                if s > best.0 {
                    best = (s, c);
                }
            }
            self.queue = best.1;
            // 想好的按法至少照著按一下，免得每格都重想
            self.commit = if best.0 < 0.0 { 8 } else { 2 };
            self.queue.truncate(HORIZON);
        }
        if self.queue.is_empty() {
            return N;
        }
        self.queue.remove(0)
    }
}
