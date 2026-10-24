# 阿翼：H01-B01 face01 繪製參考

## 2026-10-24 全身參考補正（優先）

使用者指出舊sprite盔甲與腳部仍不符模型。先前半身資料不足，不能再據此保留舊下半身。最新直接載入current VRM1的7張全身／腿靴／胸腰渲染位於 `art-work/anime90-ayi-model-fix/references/`，來源與hash見其中model-render-provenance.json；這些參考優先於下列舊半身補充。

必須保留B01寬棕腰帶、銀方扣、獨立中央護片、兩側長形懸掛甲片、大腿疊甲、長脛甲、薄銀色底及獨立短金屬鞋跟；不得回用短尖腰裙、黑色裸露大腿、厚黑鞋底。19格新修正版在 `art-work/anime90-ayi-model-fix/delivery/`，已交件，尚待新驗收；先前批次的已接入狀態不代表使用者認可舊外觀。

使用者於 2026-10-24 指定：阿翼應直接參考 ProjectVtuber 的 H01-B01。
實際專案目錄為 C:/Users/User/Repo/ProjectVtuber/projects/vrm-model。
依 output/current.json，現行選用版是 H01-B01 face01（2026-10-22），基於 small-v38。

## 參考優先序
1. face-front.png、face-three-quarter.png：現行臉型、瀏海、髮束方向、呆毛與眼睛比例。
2. armor-portrait.png：現行肩甲、胸甲、內襯、上臂護具和扣帶。
3. armor-pose-small-v37.png：僅補充初版銀甲抬手結構；此圖臉部較舊，不能覆蓋 face01。
4. FightingGame 已驗收動作圖提供 anime90 畫風、Q 版比例和對位參考；外觀細節衝突時採用上述模型參考。

## 外觀重點
- 年輕男性，棕色層次短髮；長斜瀏海、側邊外翹髮束及頂部單束弧形呆毛。
- 藍眼，face01 相較舊版調整虹膜與眼高；不是 hair85／70／55 的縮髮測試版。
- B01 初版純銀甲：圓弧肩甲、靠頸側向上立起的甲緣、銀色胸甲；黑色高領內襯、棕色皮帶和上臂護具。
- 不混用 H02 成人頭型或 B03 金邊新甲。
- 遊戲仍採既定 anime90 Q 版，動作圖 512×512、透明、面向右、腳底基準 (256,496)；不照搬 VRM 身材比例。
- 模型沒有展示清楚的部位應再查模型或既有可靠渲染，不自行添加裝飾。

## 使用與狀態
適用後續 run1／run2／dash、含阿翼的 UI 插圖，以及既有動作的驗收補修。
既有阿翼 16 張動作圖的先前驗收紀錄保留；本次只更新參考依據，沒有交付替換動作圖。
已檢視三張現行參考及舊版銀甲抬手圖，並核對 VRM1 SHA256 與 current.json 一致。
原圖來源、逐檔 SHA256 與複製驗證見 provenance.json。
