<script>
  // 觸控按鈕：左下「滑」（按住）、右下「衝」「跳」。跑酷只要這三個，按鈕做大一點，手指不用找。
  import { asset } from '../art-style.svelte.js';
  import { t } from '../i18n.svelte.js';
  import { onDestroy } from 'svelte';
  import { setTouch, pressTouch, clearTouch } from '../game/input.js';

  // slots：要顯示哪幾組（跑酷只有一個人：[0]）
  let { slots = [0], onpause = () => {} } = $props();
  const slot = $derived(slots[0] ?? 0);

  // 抓住這根手指，滑出按鈕外也繼續算（瀏覽器不給抓就算了，不影響操作）
  function capture(e) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 沒有對應的指標
    }
  }

  let pressed = $state({});
  function tap(kind, e) {
    e.preventDefault();
    capture(e);
    pressed[kind] = true;
    pressTouch(slot, kind);
    navigator.vibrate?.(8);
  }
  function release(kind, e) {
    e.preventDefault();
    pressed[kind] = false;
  }
  function slide(down, e) {
    e.preventDefault();
    if (down) capture(e);
    pressed.slide = down;
    setTouch(slot, { down });
  }

  onDestroy(clearTouch);
</script>

<div class="touch">
  <button type="button" tabindex="-1" class="pause" aria-label={t('暫停')} onclick={onpause}><img src="{asset('ui/icons/pause.webp')}" alt="" /></button>
  <button
    type="button"
    tabindex="-1"
    class="pad slide"
    class:on={pressed.slide}
    onpointerdown={(e) => slide(true, e)}
    onpointerup={(e) => slide(false, e)}
    onpointercancel={(e) => slide(false, e)}
    oncontextmenu={(e) => e.preventDefault()}>{t('滑')}</button
  >
  <div class="right">
    {#each [['attack', '衝'], ['jump', '跳']] as [kind, label] (kind)}
      <button
        type="button"
        tabindex="-1"
        class="pad {kind}"
        class:on={pressed[kind]}
        onpointerdown={(e) => tap(kind, e)}
        onpointerup={(e) => release(kind, e)}
        onpointercancel={(e) => release(kind, e)}
        oncontextmenu={(e) => e.preventDefault()}>{t(label)}</button
      >
    {/each}
  </div>
</div>

<style>
  .touch {
    position: absolute;
    inset: 0;
    pointer-events: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    z-index: 20;
  }
  .touch button {
    pointer-events: auto;
    touch-action: none;
  }
  .pause {
    position: absolute;
    top: 14cqh;
    left: 1.4cqw;
    width: 8cqh;
    height: 8cqh;
    border: 0.4cqh solid var(--cream);
    border-radius: 50%;
    background: rgba(20, 22, 30, 0.55);
    padding: 1.4cqh;
  }
  .pause img {
    width: 100%;
    height: 100%;
  }
  .pad {
    width: 22cqh;
    height: 22cqh;
    border-radius: 50%;
    border: 0.6cqh solid rgba(245, 239, 223, 0.85);
    background: rgba(20, 22, 30, 0.42);
    color: var(--cream);
    font-weight: 900;
    font-size: 6cqh;
    font-family: inherit;
  }
  .pad.on {
    background: rgba(217, 75, 61, 0.7);
    transform: scale(0.94);
  }
  .slide {
    position: absolute;
    left: 3cqw;
    bottom: 5cqh;
  }
  .right {
    position: absolute;
    right: 3cqw;
    bottom: 5cqh;
    display: flex;
    align-items: flex-end;
    gap: 2.4cqw;
  }
  .right .jump {
    width: 28cqh;
    height: 28cqh;
    font-size: 7cqh;
  }
  .right .attack {
    margin-bottom: 12cqh;
  }
</style>
