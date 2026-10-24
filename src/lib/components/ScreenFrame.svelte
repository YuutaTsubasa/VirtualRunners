<script>
  // 選單畫面的共用版型（art-work/runner-ui-concept-v1）：左上圓厚的兩色大標題（前半深湖藍、後半日光橘，白色粗外框）＋小標，
  // 右上一條關卡風景＋小 Logo＋齒輪，晴空藍的路線虛線分隔；中間內容；底部（返回／提示／主要按鈕）。
  import Logo from './Logo.svelte';
  import SettingsButton from './SettingsButton.svelte';
  import WorldScene from './WorldScene.svelte';

  // accent：標題後半段要變橘色的字數（沒給就自動：中文最後兩個字、英文最後一個字）
  let { title, subtitle = '', accent = null, world = 0, children, foot } = $props();

  const parts = $derived.by(() => {
    if (accent != null) return [title.slice(0, title.length - accent), title.slice(title.length - accent)];
    if (/\s/.test(title.trim())) {
      const i = title.trim().lastIndexOf(' ');
      return [title.slice(0, i + 1), title.slice(i + 1)];
    }
    if (title.length >= 3) return [title.slice(0, -2), title.slice(-2)];
    return ['', title];
  });
  // 標題太長（英文、日文）時縮小字級：中文字約 1 字寬，英數約 0.6
  const titleSize = $derived.by(() => {
    let w = 0;
    for (const ch of title) w += /[　-鿿＀-￯]/.test(ch) ? 1 : 0.6;
    return `min(10cqh, ${(34 / Math.max(w, 1)).toFixed(2)}cqw)`;
  });
</script>

<section class="screen framed">
  <div class="paper-bg"></div>
  <div class="frame">
    <header class="frame-head">
      <div class="scenery"><WorldScene {world} /></div>
      <h2 class="pop-title pop-text" style:font-size={titleSize}>
        <span class="a">{parts[0]}</span><span class="b">{parts[1]}</span>
      </h2>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      <div class="corner">
        <div class="mini-logo"><Logo /></div>
        <SettingsButton />
      </div>
    </header>
    <div class="frame-main">{@render children()}</div>
    {#if foot}<footer class="frame-foot">{@render foot()}</footer>{/if}
  </div>
</section>

<style>
  .framed {
    justify-content: stretch;
  }
  .frame-head {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2cqw;
    padding-bottom: 1.2cqh;
    min-width: 0;
  }
  /* 路線虛線＋終點旗：晴空藍 */
  .frame-head::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.5cqh;
    border-radius: 999px;
    background: repeating-linear-gradient(90deg, var(--sky) 0 2.4cqh, transparent 2.4cqh 3.6cqh);
  }
  /* 右上的關卡風景：圓角、往左淡出到天空 */
  .scenery {
    position: absolute;
    right: -3cqw;
    top: -2cqh;
    bottom: 1.4cqh;
    width: 58cqw;
    overflow: hidden;
    border-bottom-left-radius: 4cqh;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 40%);
    mask-image: linear-gradient(90deg, transparent, #000 40%);
    opacity: 0.95;
  }

  /* 圓厚的兩色標題：前半深湖藍、後半日光橘，白色粗外框（.pop-text） */
  .pop-title {
    position: relative;
    margin: 0;
    padding: 0 1cqh 0.8cqh 0.4cqh;
    font-size: 10cqh;
    white-space: nowrap;
  }
  .pop-title .a {
    color: var(--teal);
  }
  .pop-title .b {
    color: var(--accent);
  }
  .sub {
    position: relative;
    margin: 3.2cqh 0 0;
    font-size: 3.2cqh;
    font-weight: 900;
    letter-spacing: 0.3em;
    white-space: nowrap;
    color: var(--teal);
    background: #fff;
    border-radius: 999px;
    padding: 0.4cqh 2cqh;
    margin-top: 1.6cqh;
    font-size: 2.6cqh;
    letter-spacing: 0.12em;
    box-shadow: var(--soft-shadow);
  }
  .corner {
    position: relative;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1.6cqw;
  }
  .mini-logo {
    width: 15cqh;
    filter: drop-shadow(0 0.3cqh 0.6cqh rgba(22, 58, 75, 0.25));
  }
</style>
