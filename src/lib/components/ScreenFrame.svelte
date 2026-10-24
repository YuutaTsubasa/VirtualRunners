<script>
  // 選單畫面的共用版型（art-work/ui-concept-v1）：左上毛筆大標題（前半暖白、後半朱紅，壓在墨色筆刷上）＋小標，
  // 右上一條關卡風景＋小 Logo＋齒輪，青綠分隔線；中間內容；底部（返回／提示／主要按鈕）。
  import Logo from './Logo.svelte';
  import SettingsButton from './SettingsButton.svelte';
  import WorldScene from './WorldScene.svelte';

  // accent：標題後半段要變朱紅的字數（沒給就自動：中文最後兩個字、英文最後一個字）
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
      <h2 class="brush-title" style:font-size={titleSize}>
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
  /* 青綠分隔線 */
  .frame-head::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.5cqh;
    background: var(--teal);
  }
  /* 右上的關卡風景：往左淡出到紙色 */
  .scenery {
    position: absolute;
    right: -3cqw;
    top: -2cqh;
    bottom: 0.5cqh;
    width: 58cqw;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 40%);
    mask-image: linear-gradient(90deg, transparent, #000 40%);
    opacity: 0.9;
  }

  /* 毛筆大標題：墨色筆刷底，前半段暖白、後半段朱紅 */
  .brush-title {
    position: relative;
    margin: 0;
    padding: 0.4cqh 4cqh 0.8cqh 3cqh;
    font-size: 10cqh;
    font-weight: 900;
    font-style: italic;
    letter-spacing: 0.04em;
    line-height: 1.05;
    white-space: nowrap;
    isolation: isolate;
    transform: skewX(-4deg);
  }
  .brush-title::before {
    content: '';
    position: absolute;
    inset: 12% -2% 4% 0;
    z-index: -1;
    background: var(--navy);
    clip-path: polygon(2% 18%, 10% 4%, 30% 10%, 55% 0, 80% 8%, 100% 2%, 94% 38%, 99% 64%, 90% 100%, 60% 90%, 34% 100%, 8% 92%, 0 70%, 4% 46%);
  }
  .brush-title .a {
    color: var(--on-dark);
    -webkit-text-stroke: 0.35cqh var(--navy);
    paint-order: stroke fill;
  }
  .brush-title .b {
    color: var(--accent);
    -webkit-text-stroke: 0.35cqh var(--navy);
    paint-order: stroke fill;
    text-shadow: 0.3cqh 0.3cqh 0 var(--on-dark);
  }
  .sub {
    position: relative;
    margin: 3.2cqh 0 0;
    font-size: 3.2cqh;
    font-weight: 900;
    letter-spacing: 0.3em;
    white-space: nowrap;
    text-shadow: 0 0 1cqh var(--cream), 0 0 0.6cqh var(--cream);
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
    filter: drop-shadow(0 0 1cqh rgba(245, 239, 223, 0.8));
  }
</style>
