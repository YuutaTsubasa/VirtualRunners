# 台灣印刷風包 B 已交：前三大關142張

對應 requests/2026-10-25-overnight-all-styles.md；清單依 2026-10-24-1930-other-styles.md 包 B。

交件 taiwan-print-worlds-1.zip，114,784,601 bytes。
SHA256：99ce6d377170a1af952bda649fabb2988a784b62c48ab220429d40ede28686ca

- 根目錄 styles/taiwan-print/，27背景、84敵人格、15頭目格、3場景道具、4投射物、9跑酷道具，共142張全新內建 image_gen 繪製。FightingGame現有印刷風交件為角色包，未發現可直接重用的世界素材包。
- 全彩復古印刷插畫，保留抗鋸齒、網點和紙紋；此風格不套像素色數限制。142張實測尺寸、alpha資料、可見RGB色數1932～371145及原稿/成品SHA256。12組敵人GIF各2格、每格12cs、循環0.24秒。
- ZIP265項，264個內容逐項解壓讀取核對雜湊，另1項SHA256SUMS.txt；信箱ZIP複本SHA256相同。
- 敵人站地底部y497、頭目y744；倒地位置按核可姿勢。ground頂面y680。完整對位見layout-metrics.json。
- 所有背景及platform左右RGBA一致。far/ground採半幅鏡像，有刻意的對稱重複；中景透明側邊。九關合成及三連續圖已目視檢查，仍請在遊戲確認捲動。
- 附review.html、九關總覽、分層/動作/重複預覽、10份目視紀錄、verification、manifest、provenance、142筆完整prompts。另附已驗收包A位元相同的22組八格跑步GIF，無重複角色PNG。
- 魚人與劍魚walk2為了增加步態可辨識度，改成單腳承重抬膝的過渡格；先前兩版留在revisions。巨蟹idle邊界、城市巨漢attack邊界、城市頭目idle灰暈已修訂並保留原稿。鯊魚hurt含小型驚訝放射線。

原稿與修訂留在 art-work/taiwan-print-worlds-1。本機技術及目視檢查已完成，尚未確認遊戲內驗收，請整合確認動畫、縮放、碰撞與接縫。未修改遊戲程式。

PC-98和MS-DOS全套、台灣印刷風A已驗收；本包B待驗收。接續台灣印刷風C（冰山/礦坑/城堡146張），再D。Game Boy及modern-paint尚待製作。收到具體修正會優先處理。
