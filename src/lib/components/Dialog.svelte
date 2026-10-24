<script>
  // 疊在遊戲畫面上的視窗（暫停、結果、連線選單）：淡藍遮罩＋雲白圓角路牌，上緣中間是圓厚的兩色標題
  let { title, subtitle = '', wide = false, children } = $props();
</script>

<section class="screen overlay">
  <div class="dialog panel" class:wide>
    <div class="dialog-title">
      <h2 class="pop-text">{title}</h2>
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
    border-radius: 3.4cqh;
    border-color: var(--sky);
    box-shadow: 0 1cqh 0 rgba(17, 111, 149, 0.35), 0 2cqh 4cqh rgba(15, 44, 58, 0.25);
  }
  .dialog.wide {
    min-width: 76cqw;
  }
  .dialog-title {
    align-self: center;
    margin-top: -5.4cqh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8cqh;
  }
  h2 {
    margin: 0;
    color: var(--accent);
    font-size: 8cqh;
  }
  p {
    margin: 0;
    padding: 0.3cqh 2.4cqh;
    border: 0.25cqh solid var(--teal);
    border-radius: 999px;
    background: #fff;
    color: var(--teal);
    font-weight: 900;
    font-size: 2.6cqh;
    letter-spacing: 0.1em;
  }
  .dialog-body {
    padding: 2.4cqh 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.4cqh;
  }
</style>
