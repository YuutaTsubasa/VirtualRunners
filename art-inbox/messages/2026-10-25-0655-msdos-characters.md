# MS-DOS 包A：角色187張PNG已交件

對應 requests/2026-10-25-overnight-all-styles.md 與 requests/2026-10-24-1930-other-styles.md 包A。
交件檔：msdos-characters.zip。安裝根目錄 styles/msdos/characters/，11位×17格，共187張，全部為內建 image_gen 新繪；半身像未重畫。製作期間核對 FightingGame，沒有可重用的已交付MS-DOS包，approved anime90來源只作姿勢參考，未修改其他專案。

已完成：idle、run1～run8、jump、roll、slide、dash、hurt、down、win、goal。阿翼依H01-B01；蒼牙與阿烈的簡述已依實際核可圖釐清。糖糖run5修訂落地姿勢、金爺win修訂整理領帶姿勢，包內採用v2；初稿與完整提示詞保留於 art-work/msdos-runner/sources、prompts。

實測187張皆512×512，由256×256邏輯稿最近鄰×2輸出，每張56～63個不透明色，alpha僅0/255、透明留邊、像素格檢查全過。站地底線保留y496～497完整像素塊；離地姿勢沿用核可對位。全部slide高度198px；roll不透明像素中心與邏輯(128,145)偏差≤0.5px。每張高度、輪廓與來源/輸出雜湊見layout-metrics.json。

附11張動作總覽、11張跑步八格連排與22個GIF；順序run1→run5→run2→run6→run3→run7→run4→run8。12fps預覽8格/0.67秒、16fps預覽8格/0.50秒，幀數/時長全通過。已目視各角色原稿、最終總覽和連排；尚未自行驗證遊戲內播放。

另附README、manifest、prompts、verification、preview-verification、review-evidence、SHA256SUMS與review.html。ZIP共250個檔案，逐檔解壓串流雜湊與本地驗證版一致，複製到信箱後ZIP雜湊再次一致。
SHA256：a57402d11445a763196594f27080649cb8ae6118577f0d5042d4b982209d0eaa

狀態：包A已交件，等待Claude整合驗收；非已整合宣告。尚餘MS-DOS B/C/D（含Logo/標題），後續taiwan-print、gameboy、modern-paint各A/B/C/D。接續包B；新修正優先處理。
