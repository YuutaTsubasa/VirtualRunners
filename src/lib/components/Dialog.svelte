<script>
  // 疊在遊戲畫面上的視窗（暫停、結果、連線選單）：墨黑半透明遮罩＋暖白矩形面板，左上朱紅毛筆標題
  let { title, subtitle = '', wide = false, children } = $props();
</script>

<section class="screen overlay">
  <div class="dialog panel" class:wide>
    <div class="dialog-title">
      <h2>{title}</h2>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
    <div class="dialog-body">{@render children()}</div>
  </div>
</section>

<style>
  .dialog {
    min-width: 46cqw;
    max-width: 92cqw;
    padding: 0 4cqw 3.6cqh;
    box-shadow: 1cqh 1cqh 0 var(--navy-deep);
  }
  .dialog.wide {
    min-width: 76cqw;
  }
  .dialog-title {
    align-self: flex-start;
    margin: -2.6cqh 0 0 -5.4cqw;
    display: flex;
    align-items: baseline;
    gap: 2cqw;
  }
  h2 {
    margin: 0;
    padding: 0.6cqh 6cqh 1cqh 3cqh;
    background: var(--accent);
    color: var(--on-dark);
    font-size: 6cqh;
    font-weight: 900;
    font-style: italic;
    letter-spacing: 0.15em;
    line-height: 1.1;
    clip-path: polygon(0 10%, 4% 0, 90% 6%, 100% 0, 95% 45%, 100% 70%, 93% 100%, 5% 90%, 0 100%);
    filter: drop-shadow(0.5cqh 0.5cqh 0 var(--navy));
  }
  p {
    margin: 0;
    color: var(--accent);
    font-weight: 900;
    font-size: 2.4cqh;
    letter-spacing: 0.15em;
  }
  .dialog-body {
    padding: 3cqh 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.4cqh;
  }
</style>
