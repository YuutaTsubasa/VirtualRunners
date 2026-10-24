# 🏃 虛擬跑跑樂 Virtual Runners

Sonic Runners／跑跑薑餅人風格的跑酷遊戲，主角是[虛擬台麻館](https://github.com/YuutaTsubasa/TaiwanMahjong)的角色們：小翠、月華、阿明、糖糖、小春、蘭姐、蒼牙、金爺、雷歐、阿烈，還有隱藏角色阿翼。跟[虛擬排球王](https://github.com/YuutaTsubasa/VirtualVolleyball)、[虛擬闖天下](https://github.com/YuutaTsubasa/VirtualQuest)同一套做法：Tauri v2 + Svelte 5，畫面用 Canvas，遊戲引擎用 Rust（網頁版編成 WebAssembly）。

## 模式

- **關卡模式**：六大關 × 8 小關＝48 關（大關沿用闖天下：白色都市、草原森林、水下世界、冰山、火炎礦坑、邪惡城堡），每大關第 8 關是魔王關。過了前一關才能玩下一關；星星＝過關、金幣七成以上、沒受傷各 1 顆。
- **無盡模式**：越跑越快（從 1.0 倍到 2 倍多）、機關越來越密，每跑一段換一個大關的場景；記錄最遠距離與最高分。
- **電腦示範**：看電腦跑無盡模式。
- **連線競速**（開設房間／加入房間）：最多 **8 人**，關卡競速（先到終點的贏）或無盡生存（撐最遠的贏），房主可以加電腦對手。

### 連線時別人在「遠景」裡跑

跑酷的玩家之間不會互相碰撞，所以每個人**在自己的電腦上跑自己的那條路**（房主給同一個種子，大家的跑道一模一樣），每秒回報 15 次「跑到哪、剩幾顆心、過終點了沒」。別人畫在背景那一層地板上（縮小、半透明、頭上有名牌），跑出畫面就在邊緣顯示箭頭與距離，右上角是即時名次。好處：

- 網路慢的人自己的操作也不會延遲（不用等房主回應才跳）。
- 每人的流量很小，人數可以放寬到 8 人。
- 倒數時每個人的起跑時間會對齊房主的時鐘。

## 怎麼玩

| | WASD | 方向鍵 | Z X C | 手把 | 觸控 |
| --- | --- | --- | --- | --- | --- |
| 跳（再按一次二段跳） | W／K | ↑ | 空白鍵／X | A／LB／十字鍵上 | 「跳」 |
| 滑（按住） | S | ↓ | C／Shift | B／十字鍵下 | 「滑」 |
| 衝 | J／D | → | Z／Enter | X／Y／RB | 「衝」 |
| 暫停 | Esc／P | Esc／P | Esc／P | Start | 上方暫停鈕 |

- 自動往前跑。掉進坑或撞到尖刺、敵人、飛來的東西會少一顆心，心沒了就倒下。
- **踩敵人**：從上面落下踩到就打倒，再彈起來（可以再跳）。
- **衝**：地上是衝刺（撞倒前面的敵人）；空中是**追擊**——直接撞向前面最近的敵人、道具箱或魔王，連續打倒分數加倍；沒有目標就往前飛一小段（過大坑用）。
- **機關**：尖刺（跳）、橫桿（滑）、彈簧、浮台、冰柱（跑近就掉）、火柱（一陣一陣噴）；水下世界重力小、跳得慢。
- **道具箱**：烤肉（補一顆心）、寶石（+1000）、磁鐵、護盾。
- **魔王關**：魔王坐在飛行雲上丟東西（低的跳、高的滑），衝下來的時候用空中追擊打牠，打倒才會出現終點。
- 打倒第一大關的魔王（1-8）會解鎖隱藏角色「阿翼」——或在選單輸入 ↑↑↓↓←→←→BA。

## 角色的小能力

| 角色 | 能力 |
| --- | --- |
| 小翠 | 幸運磁鐵：附近的金幣自己飛過來 |
| 月華 | 冷靜應對：開跑就有護盾、受傷後無敵比較久 |
| 阿明 | 熱血衝刺：地面衝刺幾乎可以連發 |
| 糖糖 | 輕飄飄：三段跳 |
| 小春 | 飛毛腿：跑最快（+5%），但只有兩顆心 |
| 蘭姐 | 大姊頭：四顆心 |
| 蒼牙 | 獵犬鼻：空中追擊找得比較遠 |
| 金爺 | 財神爺：金幣分數兩倍 |
| 雷歐 | 騎士滑翔：空中衝刺飛得比較久 |
| 阿烈 | 鐵頭：衝刺能撞碎尖刺 |
| 阿翼（隱藏） | 天翼盔甲：跳得比較高、護盾破了 20 秒後自己長回來 |

數值在 `crates/runner-core/src/characters.rs`。

## 開發

需求：Node 18+、Rust 1.89+、`rustup target add wasm32-unknown-unknown`。

```bash
npm install
```

網頁版（http://localhost:1423）：

```bash
npm run dev
```

桌面 App：

```bash
npm run tauri dev
```

不開視窗的區網伺服器（先 `npm run build`），會印出網址與「房主金鑰」：

```bash
npm run server -- --port 7811 --dist dist
```

測試（JS 的漏翻、介面檢查＋Rust 的跑道與房間測試，包含「電腦每一關（48 關）都跑得到終點」「同一個種子生出一樣的跑道」）：

```bash
npm test
```

每一關各難度的電腦跑起來怎樣（秒數、受傷、金幣、星星；平衡用）：

```bash
cargo test --manifest-path crates/runner-core/Cargo.toml --release balance -- --ignored --nocapture
```

## 連線

房間與訊息的處理（`crates/runner-core/src/protocol.rs`）同一份 Rust 程式給區網伺服器（Tauri 內建）與線上房間（WASM，在房主瀏覽器的 Web Worker 裡）用。房間不跑大家的比賽，只做：大廳、聊天、開跑（發種子）、跑電腦對手、收集每個人的進度並每秒廣播 15 次、比賽結束排名。線上房間用 WebRTC，可靠通道走大廳與指令，不可靠通道走進度與比賽影格。

斷線＝這一場棄權（自己的跑道在自己的電腦上，接不回來），重連會拿回座位、下一場照常。

### 配對服務（Cloudflare Workers）

程式在 `workers/signal/`，名字是 `virtual-runners-signal`，**已部署**（2026-10-25）：
https://virtual-runners-signal.taiwan-mahjong-signal.workers.dev（`src/lib/site.js` 的預設值；打開 `/health` 會看到 `ok`）。
配對服務連不上時，介面會自動藏起線上房間。改了程式要重新部署：

```bash
npm --prefix workers/signal run deploy
```

用量：比賽本身是 P2P、不經過這裡，只有加入房間時轉送幾則連線資訊（一次加入大約 5 個請求），
房間開著時 WebSocket 會休眠不計費。免費方案超過每日額度只會暫時連不上、不會收費；同一個 Cloudflare 帳號的幾個遊戲共用額度。

本機測試：`npm --prefix workers/signal run dev`（http://localhost:8787），在 `.env.development.local` 寫 `VITE_SIGNAL_SERVER=http://localhost:8787`。

區網房間預設通訊埠 **7811**（台麻 7777、排球 7788，可以同時開）。

## 程式結構

```
crates/runner-core/       遊戲引擎（Rust）
  src/course.rs            跑道：六大關 × 8 小關、無盡模式；一段一段生，同一個種子一定一樣（自己寫的 splitmix 亂數）
  src/run.rs               一個跑者跑一條跑道的模擬：跳／二段跳／滑／衝刺／空中追擊、敵人、機關、魔王、道具
  src/ai.rs                電腦跑者：複製一份試跑幾種按法，挑不會受傷的（也拿來測每一關都過得去）
  src/room.rs              房間：八個座位、電腦對手、收進度、排名
  src/protocol.rs          連線訊息（區網伺服器與線上房間共用）
  src/characters.rs        角色的小能力
crates/runner-wasm/       WebAssembly：自己的跑道（LocalRun）與線上房主（HostRoom）
src-tauri/               Tauri v2 App＋區網伺服器（axum，/ws）
workers/signal/          線上房間的配對服務
src/
  App.svelte               畫面切換（標題→模式→選角→關卡地圖→跑→結果；連線：大廳→比賽→名次）
  lib/engine.js            主迴圈（自己的跑道＋回報進度）
  lib/game/render.js       Canvas：背景、跑道、機關、敵人、魔王、跑者、遠景裡的其他玩家、HUD
  lib/game/progress.js     星星、解鎖、無盡模式紀錄（localStorage）
  lib/components/StageMap.svelte  關卡地圖
```

## 美術

- 介面照虛擬闖天下的 [UI Concept v1](art-work/ui-concept-v1/DESIGN.md)（概念圖在 VirtualQuest repo）：墨黑＋暖白＋朱紅＋青綠、直角實色陰影、毛筆大標題。
- 角色半身像沿用虛擬台麻館的（麻將館的衣服）。
- 角色動作圖（19 格，衣服是麻將館那套；阿翼照 H01-B01）、六大關的背景、敵人、魔王、箱子、子彈都**沿用虛擬闖天下**已經交的 90 年代圖。
- 跑酷才有的東西（四格跑步、滑行、空中翻滾、尖刺、橫桿、彈簧、金幣、終點、Logo、標題圖）還沒有圖：先用程式畫或借相近的格子（滑行先用空中踢那格），請求在 `art-inbox/requests/`，交件後用 `python scripts/import-art.py art-inbox/<包>` 接進來，畫面會自動改用。
- Logo 目前是字排的（墨黑＋朱紅＋暖白），正式 Logo 交件後自動換。
