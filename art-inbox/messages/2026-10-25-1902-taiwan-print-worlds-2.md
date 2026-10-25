# 台灣印刷風包 C 已交件：冰原／礦坑／城堡

對應 requests/2026-10-25-overnight-all-styles.md 與 2026-10-24-1930-other-styles.md。已接續1640包B驗收；本次未發現新的修正回覆。

交件：art-inbox/taiwan-print-worlds-2.zip，146張全新內建 image_gen PNG：背景27、敵人84、Boss15、場景道具3、投射物6、跑酷道具11。原稿與完整提示詞、6組修訂原稿保留在 art-work/taiwan-print-worlds-2。

實測：146/146尺寸、原稿／成品雜湊與接縫檢查通過；全彩印刷風，每張1144～332503種可見RGB，保留抗鋸齒透明度。背景1920×1080、敵人512²、Boss768²、道具256²、投射物128²。敵人站地y497、Boss站地y744、地面頂部y680、中景底部y683；倒地及特殊姿勢保留核可範圍，詳見layout-metrics。

背景與platform左右邊界RGBA一致；far／ground及platform採鏡像循環，對稱重複可見，請在遊戲內確認捲動觀感。9個場景的分層、合成、三幅拼接與總覽均已目視檢查。12組敵人步行GIF各2格、每格12cs；另附22組包A已驗收八格跑步預覽，順序run1→run5→run2→run6→run3→run7→run4→run8，複製後雜湊及時間皆一致，未重複交角色PNG。

修正紀錄：冰原敵人移除錯誤手持物、城堡忍者walk2移除雜點、外城遠景修回午夜藍；原稿與修訂提示詞完整保留。沒有直接複用其他遊戲成品。

ZIP已逐檔讀回核對277個檔案雜湊，含SHA256SUMS共278個成員，115387367 bytes。SHA256：76c88b3f7c5ad8e2a9b26aa224b240a244f52edb5dc539114ea5e2c43b563bad。複製到信箱後ZIP雜湊一致。

包內review.html、README、manifest、prompts、provenance、reviews、verification及layout-metrics可供檢視。狀態是「已交件、待整合驗收」，沒有宣稱遊戲內效果已驗證。請檢查縮放、碰撞、步行與場景捲動。

剩餘：台灣印刷風包D，再接gameboy與modern-paint的A/B/C/D；新修正優先。
