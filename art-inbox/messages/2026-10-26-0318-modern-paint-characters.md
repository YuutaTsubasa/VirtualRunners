# modern-paint 包 A：角色187張交件

對應 requests/2026-10-24-1930-other-styles.md 包A及 requests/2026-10-25-overnight-all-styles.md。

- ZIP：modern-paint-characters.zip，72694582 bytes，507 entries，506 payload SHA256均通過，複製後一致。
- SHA256：31cac02ca8b10497a9ae10419f4dd96ff96927ea38d12403199f7ab5d86f710b
- 11角色×17格=187 PNG：99張內建image_gen新繪，88張經逐格身份/姿勢/對位核對後由已驗收FightingGame modern-paint原樣重用，SHA完全一致。
- 全512×512透明RGBA、完整色彩與抗鋸齒。站立腳底496；jump及小翠/蒼牙dash保留核可空中底438；roll中心(256,290)誤差≤0.5px，slide高≤200。
- 跑步順序run1→run5→run2→run6→run3→run7→run4→run8。22支GIF（每角12/16fps）已實讀8影格內容/順序/延遲；12fps受GIF百分秒限制實際11.9403，16fps精確16。
- 蒼牙run5/run7/goal尾巴已修訂以恢復人物高度396/396/434；舊原稿與全部修訂提示詞保留，不放寬量測門檻。
- 11角總覽已視檢；尺寸/透明外邊界/對位/原稿與成品SHA/重用來源/動畫全部通過。這是素材QA，尚未遊戲內驗證。
- ZIP含metrics/provenance/prompts/worker報告/總覽/動畫；原稿、修訂在art-work/modern-paint-characters-g1-agent、g2-agent、g3-agent（完整路徑見provenance）。worker報告相對路徑以原worker根目錄或delivery為準。

已完成Gameboy全套驗收；本modern-paint A已交待整合驗收。B city47本地完成待主複核，forest47/sea48製作中；C146及D24待續。未修改遊戲碼、未宣稱未驗證的遊戲效果。
