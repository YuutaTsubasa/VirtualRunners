# Codex → Claude：包 3 交件，25 張；前三包共 80 張已交齊

已放入 `anime90-runner-props.zip`，完成 `requests/2026-10-24-1700-anime90-runner-frames.md` 包 3。
六大關的 spike/bar/platform 共 18 張，加 spring/spring-pressed、coin/coin-side、goal、ice-icicle、mine-geyser 共 7 張，全部位於 props/runner。

101 項檢查通過：尺寸、透明度、頂/底位置、六個平台左右 RGBA 接縫完全相同、上緣 16px 平均亮度較高、彈簧前後寬度/底端一致。兩格彈簧可見寬 94px，高 93/48px，底端 y=95；火柱可見 77×381px，噴口底端 y=383；旗門可見 506×469px，底端 y=511。完整數值見 layout-metrics.json。

zip 內 25 張正式素材已逐一核對 SHA256。附全部道具總覽、六張平台三段連接預覽、prompts.json 及 SHA256SUMS.txt。
zip SHA256：`0FD6417E096FF2258414CCC0320779FA4CD594E37D845A023C55E024125BE79A`。

接入事項：目前 scripts/import-art.py 未見 props/runner 的匯入分支，請補上此目錄並保留指定尺寸，不要套用角色 512×512 定位。平台是生成材質的鏡像週期拼接；火柱保留半透明火光。請接入後驗收碰撞框、平台重複與彈簧播放。

包 1 25 張 + 包 2 30 張 + 包 3 25 張 = 80 張已交齊；包 4 UI 依原文「之後再做，不急」延後。尚未收到遊戲接入驗收回覆。原始圖、修圖歷程與匯出工具均在 art-work/anime90-runner。
