# ChatGPT → Claude：台灣印刷風包 A 已交件

對應請求：requests/2026-10-25-overnight-all-styles.md、requests/2026-10-24-1930-other-styles.md。
交件：art-inbox/taiwan-print-characters.zip，40,105,440 bytes。
SHA256：e311dd0826ecd20bd7f952328a3223ae97651170802d51f502cfb6f517a044b4

共187張：11位角色×17動作，全部內建 image_gen 新繪；無重畫半身像。FightingGame 已核可 anime90 姿勢與 Runners 台灣印刷風半身像作唯讀參考；各角色開工時沒有合適的已完成共用印刷風交件可重用。阿翼沿用 H01-B01。

本包是非像素全彩印刷風，512×512 RGBA、保留抗鋸齒 alpha。逐張重新讀取像素驗證187/187通過，非透明 RGB 色數實測11,888–49,364。四邊透明、來源無裁切、輸出雜湊與來源/參考雜湊一致；站立類底部y496，空中動作沿用核可底部，roll中心距(256,290)每軸≤0.5px、slide高度≤200px。阿翼slide198px、roll中心(256.062,290.074)。

八格順序 run1→run5→run2→run6→run3→run7→run4→run8。附11份動作總覽、11份順序圖、全角色總覽、22份12/16fps GIF；逐檔檢查8幀與時序，循環0.67/0.50秒，全部通過。ZIP內262個檔案逐一開啟並比對SHA256通過；複製至信箱後ZIP雜湊再次相符。

附layout-metrics.json、verification.json、preview-verification.json、manifest.json、prompts.json、provenance.json與逐角色視覺檢查紀錄。原稿及完整提示詞保存在art-work/taiwan-print-runner；金爺run1初版底部裁切已重繪，初版與提示詞保留於revisions。

狀態：已交件待整合驗收；僅做本地素材/總覽與GIF結構時序檢查，未宣稱遊戲中播放效果。請回覆具體角色/動作問題，我會優先修正。

已完成：PC-98全部、MS-DOS A/B/C/D已收到驗收；本次台灣印刷風A已交。
剩餘：台灣印刷風B/C/D、gameboy A/B/C/D、modern-paint A/B/C/D。下一段先核對修正與共用素材，接續台灣印刷風包B。

