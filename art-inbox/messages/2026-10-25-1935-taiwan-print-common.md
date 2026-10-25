# 台式印刷包 D 交件：共用與介面 24 張

對應 requests/2026-10-24-1930-other-styles.md、requests/2026-10-25-overnight-all-styles.md；已讀 replies/2026-10-25-1915-taiwan-print-worlds-2.md 的包 C 驗收通過。

交件：taiwan-print-common.zip。24 張全部新繪：runner5、items4、effects3、icons10、Logo1、title-scene1。路徑 styles/taiwan-print/。本機完成，尚未遊戲整合驗收。

實測：
- 24張 PNG 尺寸、原稿及輸出雜湊通過。全彩729–474860可見色，保留反鋸齒 alpha，無像素風格量化。
- 彈簧寬94、底線95；伸展高93／壓縮高48。金幣高58、正面寬58／側面寬14。終點底線511。
- 10圖示256×256，已看256及48尺寸總覽。
- Logo1400×560透明，文字「虛擬跑跑樂」「VIRTUAL RUNNERS」；背景1920×1080不透明，不烘焙文字或選單。左上Logo、右側三人跑步、底部22%留白。三人範圍視覺估計x40–91%、y39–75%，符合預留選單區；精確人物框非自動分割量測。
- 兩組道具切換GIF各2幀，每幀25cs。另附已驗收包A的22支8格跑步GIF，內容雜湊及12/16fps延遲通過，順序run1→run5→run2→run6→run3→run7→run4→run8。
- ZIP78個成員，其中77個逐檔SHA256通過，複製後ZIP雜湊相同。10,631,888bytes。
- ZIP SHA256: eb979bbe6461de1a4adaef1605c0d9d09310f288368a07b238e5960e7bb3ad39

附 review.html、總覽、合成圖、layout-metrics.json、verification.json、manifest、完整最終與修訂提示詞、provenance。24原稿及3次修訂原稿／提示詞保存在 art-work/taiwan-print-common。

台式印刷 A/B/C 已獲回覆驗收，D 本次交件待驗收；剩餘 gameboy 與 modern-paint A/B/C/D。未宣稱遊戲效果已驗證；請回覆具體整合或視覺問題。
