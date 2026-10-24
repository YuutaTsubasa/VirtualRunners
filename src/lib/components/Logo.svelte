<script>
  // 「虛擬跑跑樂」標誌。有正式的 Logo 圖（ui/logo.webp，美術交件後）就用圖，沒有就用字排
  // （art-work/runner-ui-concept-v1 的方向）：「虛擬」小一點、白字；「跑跑樂」圓厚、橘藍橘，兩個「跑」稍微錯落像在踏步，
  // 白色粗外框＋深墨細外框＋往下的影子，上面一條小小的跳躍弧線連著兩個「跑」，底下英文。
  import { asset } from '../art-style.svelte.js';
  import { t } from '../i18n.svelte.js';
  let { size = 'small' } = $props();
  const src = $derived(asset('ui/logo.webp'));
</script>

{#if src}
  <img class="logo {size}" {src} alt={t('虛擬跑跑樂')} draggable="false" />
{:else}
  <div class="logo text {size}" role="img" aria-label={t('虛擬跑跑樂')}>
    <div class="word">
      <svg class="arc" viewBox="0 0 100 30" aria-hidden="true">
        <path d="M8 26 Q 50 -8 92 26" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" />
        <circle cx="8" cy="26" r="4.5" />
        <circle cx="92" cy="26" r="4.5" />
      </svg>
      <span class="ch small">虛擬</span><span class="ch o">跑</span><span class="ch b up">跑</span><span class="ch o">樂</span>
    </div>
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
    gap: 1.5cqw;
    user-select: none;
  }
  .word {
    position: relative;
    display: flex;
    align-items: flex-end;
    font-weight: 900;
    line-height: 1;
    /* 白色粗外框外面再一圈深墨細邊（四個方向的影子疊出來），最後往下一點影子 */
    filter: drop-shadow(0.5cqw 0 0 var(--navy)) drop-shadow(-0.5cqw 0 0 var(--navy)) drop-shadow(0 0.5cqw 0 var(--navy))
      drop-shadow(0 -0.5cqw 0 var(--navy)) drop-shadow(0 1.4cqw 0 rgba(17, 111, 149, 0.45));
  }
  .ch {
    font-size: 24cqw;
    -webkit-text-stroke: 3.2cqw #fff;
    paint-order: stroke fill;
    letter-spacing: -0.02em;
  }
  .ch.small {
    font-size: 14cqw;
    color: var(--navy);
    margin-right: 0.5cqw;
    -webkit-text-stroke-width: 2.4cqw;
  }
  .o {
    color: var(--accent);
  }
  .b {
    color: var(--sky);
  }
  /* 第二個「跑」往上錯一點，像踏出去的那一步 */
  .up {
    translate: 0 -3cqw;
  }
  /* 跳躍弧線：從第一個「跑」到第二個「跑」，在字的上面，不穿過字 */
  .arc {
    position: absolute;
    left: 41%;
    width: 25%;
    top: -9cqw;
    color: var(--navy);
    fill: var(--accent);
    overflow: visible;
  }
  .en {
    display: flex;
    align-items: center;
    gap: 2cqw;
    font-size: 4.6cqw;
    font-weight: 900;
    letter-spacing: 0.32em;
    color: var(--navy);
  }
  .en::before,
  .en::after {
    content: '';
    width: 6cqw;
    height: 0.6cqw;
    border-radius: 999px;
    background: var(--navy);
  }
</style>
