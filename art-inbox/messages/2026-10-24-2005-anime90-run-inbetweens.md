# anime90 八格跑步補幀：44 張 PNG

對應 requests/2026-10-24-1830-anime90-run-inbetweens.md，已交兩包：
- anime90-run-inbetweens-01.zip：xiaocui、aming、xiaochun、ayi、tangtang，20 張。
- anime90-run-inbetweens-02.zip：yuehua、lanjie、cangya、jinye、leo、alie，24 張。

每位新增 run5/run6/run7/run8。沿用原 run1～run4，播放順序 run1 → run5 → run2 → run6 → run3 → run7 → run4 → run8。壓縮檔直接以 characters/<id>/sprites/ 為路徑，沒有額外包名根目錄。

## 實測
全部 44 張為 512×512 RGBA，面向右；可見輪廓以 alpha>25 量測，腳底 y=496，未碰畫布邊界。
| 幀 | 張數 | 人物輪廓高 | 頭頂 y | 腳底 y |
| --- | --- | --- | --- | --- |
| run5 | 11 | 396px | 101 | 496 |
| run6 | 11 | 404px | 93 | 496 |
| run7 | 11 | 396px | 101 | 496 |
| run8 | 11 | 404px | 93 | 496 |

邏輯 pivot=(256,496)。骨盆來源位置為人工目估 landmark 對齊 x=256，並非自動骨架偵測；逐張來源、縮放、位置和輪廓資料在 layout-metrics.json。

## 驗收附件
每人附八格連排 JPG、12fps 與 16fps GIF，共 11 張連排及 22 個 GIF。GIF 使用原交付 run1～run4 與本次新圖，已確認每檔八幀；12fps 一輪 0.67 秒（GIF 百分秒限制，約 11.94fps），16fps 一輪 0.50 秒。
verification.json 記錄 PNG 完整性及尺寸/透明/腳底檢查，全數通過。preview-verification.json 記錄 GIF 幀數及時間；SHA256SUMS.txt 記錄 44 張 PNG 的分包校驗。
內建 image_gen 逐張繪製，提示詞與選用來源在 prompts.json；生成原圖與修訂保留於 art-work/anime90-run-inbetweens/sources/。
本機總驗收頁：art-work/anime90-run-inbetweens/review.html。

已目視檢查連排和服裝配件；請整合後確認實際大小的手腳交替、輪廓穩定與跑步節奏，目前不宣稱遊戲內動態驗收已完成。沒有改遊戲程式碼。

其他五種畫風尚未開始；依 requests/2026-10-24-1930-other-styles.md，PC-98 的跑步會依這批最後定案的八格循環繪製。先前 mode-level / mode-endless 插圖亦未包含在本次交件。
