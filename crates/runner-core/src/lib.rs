//! 虛擬跑跑樂的遊戲引擎。
//! - `course`：跑道（六大關 × 8 小關、無盡模式），同一個種子生出一樣的路
//! - `run`：一個跑者跑一條跑道的模擬（確定性）
//! - `ai`：電腦跑者（也用來確認每一關都過得去）
//! - `room`：連線房間（最多八人競速、電腦對手、聊天）
//! - `protocol`：連線訊息的處理（區網伺服器與線上房間共用）
//! - `characters`：角色的小能力

pub mod ai;
pub mod characters;
pub mod course;
pub mod protocol;
pub mod room;
pub mod run;

#[cfg(test)]
mod tests {
    use crate::ai::{Ai, Difficulty};
    use crate::course::{Plan, STAGES, WORLDS};
    use crate::room::{Room, Settings};
    use crate::run::{Input, Phase, Run};

    /// 交給電腦跑，最多 frames 格
    fn auto(plan: Plan, character: &str, seed: u64, d: Difficulty, frames: usize) -> Run {
        let mut run = Run::new(plan, character, seed);
        let mut ai = Ai::new(d, seed);
        for _ in 0..frames {
            let i = ai.think(&run);
            run.step(i);
            if run.done() {
                break;
            }
        }
        run
    }

    /// 同一個種子 → 一樣的跑道（連線時每個人在自己電腦上跑的路要一樣）
    #[test]
    fn same_seed_same_course() {
        for plan in [Plan::Endless, Plan::Level { world: 3, stage: 4 }] {
            let mut a = Run::new(plan, "aming", 42);
            let mut b = Run::new(plan, "xiaocui", 42);
            a.course.ensure(30000.0);
            b.course.ensure(30000.0);
            let sa: Vec<_> = a.course.solids.iter().map(|s| (s.x0, s.x1, s.y)).collect();
            let sb: Vec<_> = b.course.solids.iter().map(|s| (s.x0, s.x1, s.y)).collect();
            assert_eq!(sa, sb);
            assert_eq!(a.course.obstacles.len(), b.course.obstacles.len());
        }
    }

    /// 每一關電腦（困難）都要能跑到終點，而且大部分關卡不會受傷：確定跑道生得出來的都過得去
    #[test]
    fn every_stage_is_clearable() {
        let mut failed = Vec::new();
        let mut hurt = 0;
        for world in 0..WORLDS {
            for stage in 0..STAGES {
                let plan = Plan::Level { world, stage };
                let run = auto(plan, "xiaocui", (world * 31 + stage) as u64, Difficulty::Hard, 60 * 60 * 6);
                if run.phase != Phase::Goal {
                    failed.push(format!("{}-{}（{:?}，跑到 {}、受傷 {}）", world + 1, stage + 1, run.phase, run.r.x as i32, run.hits));
                }
                hurt += run.hits;
            }
        }
        assert!(failed.is_empty(), "這些關電腦過不了：{:?}", failed);
        assert!(hurt <= (WORLDS * STAGES) as u32, "電腦受傷太多次：{}", hurt);
    }

    /// 無盡模式：越跑越快；不按的話一下子就倒了
    #[test]
    fn endless_speeds_up_and_ends() {
        let mut run = Run::new(Plan::Endless, "lanjie", 9);
        let v0 = run.speed();
        let mut frames = 0;
        while !run.done() && frames < 60 * 600 {
            run.step(Input::default());
            frames += 1;
        }
        assert_eq!(run.phase, Phase::Out, "不按任何鍵應該跑不完");
        let fast = auto(Plan::Endless, "lanjie", 9, Difficulty::Hard, 60 * 90);
        assert!(fast.speed() > v0 + 0.5, "跑一陣子應該要變快：{} → {}", v0, fast.speed());
        assert!(fast.meters() > 800, "電腦應該跑得比較遠：{}m", fast.meters());
    }

    /// 魔王關：打倒魔王才會出現終點
    #[test]
    fn boss_stage_needs_boss_down() {
        let run = auto(Plan::Level { world: 0, stage: STAGES - 1 }, "cangya", 3, Difficulty::Hard, 60 * 60 * 5);
        assert_eq!(run.phase, Phase::Goal);
        assert!(run.boss.as_ref().unwrap().hp <= 0);
    }

    #[test]
    fn room_race_with_bots() {
        let mut room = Room::new(Settings { difficulty: Difficulty::Hard, ..Settings::default() });
        let (seat, token) = room.join("悠太", Some("ayi")).unwrap();
        room.connect(seat);
        for _ in 0..7 {
            room.add_bot(None, Difficulty::Hard).unwrap();
        }
        assert!(room.add_bot(None, Difficulty::Hard).is_err(), "八個座位滿了");
        assert_eq!(room.seat_of_token(&token), Some(seat));
        room.start().unwrap();
        assert!(room.join("晚到的人", None).is_err());
        // 真人斷線：算棄權，電腦跑完就結束
        room.disconnect(seat);
        let mut frames = 0;
        while room.race.as_ref().unwrap().results.is_none() && frames < 60 * 60 * 4 {
            room.tick();
            frames += 1;
        }
        let frame = room.frame().unwrap();
        assert_eq!(frame["phase"], "results");
        let results = frame["results"].as_array().unwrap();
        assert_eq!(results.len(), 8);
        assert_eq!(results.last().unwrap()["seat"], 0, "棄權的排最後");
        room.reset_to_lobby();
        assert_eq!(room.view(Some(0))["phase"], "lobby");
    }

    #[test]
    fn protocol_host_and_guest() {
        use crate::protocol::{drop_conn, handle, room_message, Conn};
        use serde_json::json;
        let mut room = Room::default();
        let (mut host, mut guest) = (Conn::default(), Conn::default());
        let (r, changed) = handle(&mut room, "key", &mut host, &json!({"type": "hello", "name": "房主", "host_key": "key"}));
        assert!(changed && host.is_host && host.seat == Some(0));
        assert_eq!(r[0]["type"], "welcome");
        let (r, _) = handle(&mut room, "key", &mut guest, &json!({"type": "hello", "name": "客人", "host_key": "wrong"}));
        let token = r[0]["token"].as_str().unwrap().to_string();
        assert!(!guest.is_host && guest.seat == Some(1));
        let (r, _) = handle(&mut room, "key", &mut guest, &json!({"type": "host", "cmd": "start"}));
        assert_eq!(r[0]["type"], "error");
        handle(&mut room, "key", &mut host, &json!({"type": "host", "cmd": "add_bot", "seat": 7}));
        assert!(room.seats[7].is_some());
        handle(&mut room, "key", &mut host, &json!({"type": "host", "cmd": "settings", "settings": {"endless": true}}));
        handle(&mut room, "key", &mut host, &json!({"type": "host", "cmd": "start"}));
        assert!(room.playing());
        // 回報進度
        handle(&mut room, "key", &mut guest, &json!({"type": "progress", "x": 1234.0, "hp": 2, "meters": 41}));
        room.tick();
        assert_eq!(room.frame().unwrap()["runners"][1]["p"]["meters"], 41);
        assert!(drop_conn(&mut room, &mut guest));
        let mut back = Conn::default();
        handle(&mut room, "key", &mut back, &json!({"type": "hello", "token": token}));
        assert_eq!(back.seat, Some(1));
        assert_eq!(room_message(&room, &back)["state"]["you"], 1);
    }
}

#[cfg(test)]
mod balance {
    use crate::ai::{Ai, Difficulty};
    use crate::course::{Plan, STAGES, WORLDS};
    use crate::run::Run;

    /// cargo test --release balance -- --ignored --nocapture：每一關各難度的電腦跑起來怎樣
    #[test]
    #[ignore]
    fn stage_report() {
        for world in 0..WORLDS {
            for stage in 0..STAGES {
                let mut line = format!("{}-{}", world + 1, stage + 1);
                for d in [Difficulty::Easy, Difficulty::Normal, Difficulty::Hard] {
                    let plan = Plan::Level { world, stage };
                    let mut run = Run::new(plan, "xiaocui", 5);
                    let mut ai = Ai::new(d, 5);
                    while !run.done() && run.t < 60 * 60 * 6 {
                        let i = ai.think(&run);
                        run.step(i);
                    }
                    line += &format!("  {:?}: {:?} {}s 傷{} 幣{}/{} ★{}", d, run.phase, run.t / 60, run.hits, run.coins, run.course.coin_total, run.stars());
                }
                println!("{}", line);
            }
        }
        for d in [Difficulty::Easy, Difficulty::Normal, Difficulty::Hard] {
            let mut run = Run::new(Plan::Endless, "xiaocui", 5);
            let mut ai = Ai::new(d, 5);
            while !run.done() && run.t < 60 * 60 * 10 {
                let i = ai.think(&run);
                run.step(i);
            }
            println!("無盡 {:?}: {}m {}s 速度 {:.1}", d, run.meters(), run.t / 60, run.speed());
        }
    }
}

#[cfg(test)]
mod debug {
    use crate::ai::{Ai, Difficulty};
    use crate::course::Plan;
    use crate::run::{Event, Run};

    /// cargo test --release debug -- --ignored --nocapture：印出電腦在某一關受傷的地方
    #[test]
    #[ignore]
    fn where_hurt() {
        let (world, stage) = (std::env::var("W").map(|v| v.parse().unwrap()).unwrap_or(0), std::env::var("S").map(|v| v.parse().unwrap()).unwrap_or(6));
        let plan = Plan::Level { world, stage };
        let seed = (world * 31 + stage) as u64;
        let mut run = Run::new(plan, "xiaocui", seed);
        let mut ai = Ai::new(Difficulty::Hard, seed);
        while !run.done() && run.t < 60 * 60 * 6 {
            let i = ai.think(&run);
            let before = run.clone();
            run.step(i);
            if run.events.iter().any(|e| matches!(e, Event::Hurt | Event::Fall)) {
                println!("t={} x={:.0} y={:.0} act={:?} events={:?}", run.t, run.r.x, run.r.y, before.r.act, run.events);
                let x = before.r.x;
                for s in before.course.solids.iter().filter(|s| s.x1 > x - 300.0 && s.x0 < x + 600.0) { println!("  solid {:.0}-{:.0} y{} {}", s.x0, s.x1, s.y, s.oneway); }
                for o in before.course.obstacles.iter().filter(|o| o.x > x - 200.0 && o.x < x + 600.0) { println!("  ob {:?} x{:.0} y{:.0}", o.kind, o.x, o.y); }
                for e in before.course.enemies.iter().filter(|e| e.alive && e.x > x - 200.0 && e.x < x + 600.0) { println!("  enemy {:?} x{:.0} y{:.0}", e.kind, e.x, e.y); }
                for s in before.course.shots.iter().filter(|s| s.alive) { println!("  shot x{:.0} y{:.0}", s.x, s.y); }
            }
        }
        println!("{:?} boss {:?}", run.phase, run.boss.as_ref().map(|b| b.hp));
    }
}
