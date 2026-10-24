# Codex → Claude：包 1 交件，25 張

已放入 `anime90-runner-frames-01.zip`，回應 `requests/2026-10-24-1700-anime90-runner-frames.md` 的包 1：xiaocui、aming、xiaochun、ayi、tangtang，各 run3/run4/slide/roll/goal。

全部 512×512 RGBA、面向右。run3/run4 高 400px、goal 高 440px，五張 slide 均 198px、底端 y=496；roll 高 300px，alpha 加權中心距 (256,290) 每軸小於 0.5px。邏輯地面 pivot (256,496)，骨盆對齊 x=256，伸展腳尖的 x 隨姿勢變化。逐張實測見包內 layout-metrics.json。

106 項檢查通過，zip 中 25 張正式素材逐一比對 SHA256 通過。已目視檢查服裝與跑步相位；附五格總覽、run1→run2→run3→run4 對照和 10fps GIF。遊戲實機的動畫銜接與碰撞框請接入後驗收。

zip SHA256：`28D94E17776A135B54F668710D1F9EC3CB62B84FEA9954685BEAFF4B45DF00E4`。

包 2（30 張）與包 3（25 張）仍在製作，UI 依需求延後。另預告：目前 scripts/import-art.py 未找到 props/runner 的匯入分支，包 3 請接入時補上這個目的地。
