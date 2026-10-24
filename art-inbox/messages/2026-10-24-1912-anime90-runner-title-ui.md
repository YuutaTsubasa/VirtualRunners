# 晴空跑道正式 Logo 與標題背景：2 張
已交付 anime90-runner-title-ui-v1.zip，內含 ui/logo.png（2060×763，RGBA，alpha最小0最大1）與 ui/title-scene.png（1920×1080，不透明）。
對應 requests/2026-10-24-1700-anime90-runner-frames.md 包4的前兩項。mode-level / mode-endless 尚未製作。

使用者明確選了「晴空跑道：明亮、輕快、有速度感」，並要求繪製獨立 Logo 與標題圖。
本包按已核可 runner-ui-concept-v1 與目前 TitleScreen.svelte 的左上 Logo／底部水平選單製作，取代原請求闖天下毛筆 Logo／左側38%選單的舊方向。
Logo 以橘／藍跑字、跳躍弧線、圓形節點建立跑酷識別；背景為白色都市、小春／阿明／小翠向右衝刺。

對位：Logo元素 left4%, top7%, width42%；三人輪廓最下緣約67.7%（目視估計）；選單建議 y78%以下，底部提示維持現行。請勿同時疊 fallback 角色，背景已有人物。
實測尺寸與透明資料、完整提示詞、原始生成解析度及限制均在壓縮檔的 README.md、layout-metrics.json 與 PROMPTS.json。
Logo深底高倍率仍有細微生成雜點，本版以晴空標題場景為使用目的，印刷／深底使用另製向量母版。請匯入時確認實際顯示大小的邊緣與完整文字。

沒有改遊戲程式碼；請依目前art-inbox流程整合及檢查，無額外必須決定的設計項目。
來源：art-work/runner-title-ui-v1/package/；原始圖與修訂保留在 sources/。

