<script>
  // 「虛擬跑跑樂」標誌。有正式的 Logo 圖（ui/logo.webp，美術交件後）就用圖，沒有先用字排：
  // 墨色毛筆底＋暖白「虛擬」＋朱紅「跑跑樂」，底下小字英文，跟系列其他作品的標題同一個調子。
  import { asset } from '../art-style.svelte.js';
  import { t } from '../i18n.svelte.js';
  let { size = 'small' } = $props();
  const src = $derived(asset('ui/logo.webp'));
</script>

{#if src}
  <img class="logo {size}" {src} alt={t('虛擬跑跑樂')} draggable="false" />
{:else}
  <div class="logo text {size}" role="img" aria-label={t('虛擬跑跑樂')}>
    <span class="zh"><span class="a">虛擬</span><span class="b">跑跑樂</span></span>
    <span class="en">VIRTUAL RUNNERS</span>
  </div>
{/if}

<style>
  .logo {
    display: block;
    width: 100%;
    height: auto;
  }
  .text {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4em;
    font-weight: 900;
    line-height: 1;
    user-select: none;
  }
  .zh {
    display: inline-flex;
    align-items: baseline;
    padding: 0.08em 0.3em 0.12em;
    background: var(--navy);
    clip-path: polygon(0 12%, 4% 0, 96% 6%, 100% 34%, 97% 100%, 3% 92%);
    font-size: 19cqw;
    font-style: italic;
    letter-spacing: 0.02em;
    transform: rotate(-3deg);
  }
  .a {
    color: var(--on-dark, #f5efdf);
    font-size: 0.72em;
    margin-right: 0.08em;
  }
  .b {
    color: var(--accent, #d94b3d);
    text-shadow: 0.05em 0.05em 0 var(--gold, #e9b85e);
  }
  .en {
    font-size: 5.6cqw;
    letter-spacing: 0.32em;
    color: var(--navy);
    border-top: 0.12em solid var(--accent);
    border-bottom: 0.12em solid var(--accent);
    padding: 0.15em 0.6em;
  }
</style>
