<script>
  // 標題畫面（art-work/runner-ui-concept-v1/01-title-menu）：整幅晴空與白色都市，左上開闊天空放 Logo，
  // 右側中景三個人朝右跑；底部約四分之一是水平的「起跑碼頭」：單機遊玩是最大的橘色起跑牌，
  // 開設房間、加入房間是藍白路牌，操作說明與設定是小工具鈕。
  // 有正式的標題主視覺（ui/title-scene）就用插圖當背景，沒有就用關卡背景＋角色動作圖。
  import { onMount } from 'svelte';
  import { asset } from '../art-style.svelte.js';
  import { getCharacter } from '../game/characters.js';
  import { play } from '../game/audio.js';
  import { ui } from '../ui.svelte.js';
  import { t } from '../i18n.svelte.js';
  import Logo from './Logo.svelte';
  import WorldScene from './WorldScene.svelte';
  import RunnerPose from './RunnerPose.svelte';
  import ControlHint from './ControlHint.svelte';

  // items：[單機遊玩, 開設房間, 加入房間, 操作說明, 設定]（第一個是主要行動，最後兩個是小工具鈕）
  let { items } = $props();

  const scene = $derived(asset('ui/title-scene.webp'));
  const runners = [
    ['xiaochun', '29cqh', 0],
    ['aming', '31cqh', 3],
    ['xiaocui', '36cqh', 6],
  ].map(([id, size, delay]) => ({ c: getCharacter(id), size, delay }));

  let dock;
  onMount(() => dock.querySelector('button')?.focus({ preventScroll: true }));

  function choose(item) {
    play('select');
    item.action();
  }
  const moved = () => (ui.input === 'key' || ui.input === 'pad') && play('move');
</script>

{#snippet icon(kind)}
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if kind === 0}
      <!-- 跑步的人 -->
      <circle cx="14" cy="4" r="2.4" />
      <path d="M9 21l2.4-5.2 2.8 2.2V22h2v-5.2l-2.6-2.4 1-3.6c1 1.4 2.6 2.4 4.4 2.4v-2c-1.6 0-2.8-.9-3.4-2.1l-1-1.6c-.4-.6-1-1-1.8-1-.3 0-.5 0-.8.1L6 7.7V12h2V9l1.8-.7L7 21h2z" />
    {:else if kind === 1}
      <!-- 房子 -->
      <path d="M12 3L2 12h3v9h5v-6h4v6h5v-9h3z" />
    {:else}
      <!-- 一群人 -->
      <circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="8.5" r="2.5" />
      <path d="M2 19c0-3.3 2.7-6 6-6s6 2.7 6 6zM13.5 19c.2-2.2-.6-3.8-1.6-5 .9-.6 2-1 3.1-1 2.8 0 5 2.2 5 5v1z" />
    {/if}
  </svg>
{/snippet}

<section class="screen title">
  {#if scene}
    <img class="menu-bg" src={scene} alt="" />
  {:else}
    <div class="scene"><WorldScene world={0} /></div>
    <div class="sky-fade"></div>
    <div class="runners">
      {#each runners as r (r.c.id)}
        <div class="runner {r.c.id}"><RunnerPose character={r.c} size={r.size} delay={r.delay} /></div>
      {/each}
    </div>
  {/if}

  <div class="logo-box"><Logo size="big" /></div>

  <nav class="dock" bind:this={dock}>
    <button type="button" class="vbtn primary start" onfocus={moved} onclick={() => choose(items[0])}>
      <span class="ic">{@render icon(0)}</span>
      <span class="label"><b>{items[0].label}</b><small>{t('開始冒險')}</small></span>
    </button>
    {#each items.slice(1, 3) as item, i (item.label)}
      <button type="button" class="vbtn sign" onfocus={moved} onclick={() => choose(item)}>
        <span class="ic">{@render icon(i + 1)}</span>{item.label}<span class="chev">›</span>
      </button>
    {/each}
    <div class="tools">
      {#each items.slice(3) as item, i (item.label)}
        <button type="button" class="vbtn small tool" onfocus={moved} onclick={() => choose(item)}>
          <img src={asset(i === 0 ? 'ui/icons/gamepad.webp' : 'ui/icons/settings.webp')} alt="" />{item.label}
        </button>
      {/each}
    </div>
  </nav>
  <div class="foot"><ControlHint /></div>
</section>

<style>
  .title {
    justify-content: flex-start;
  }
  .scene {
    position: absolute;
    inset: 0;
  }
  /* 左上放 Logo 的地方：天空再亮一點，字比較清楚 */
  .sky-fade {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 52% 46% at 24% 22%, rgba(236, 248, 252, 0.85), rgba(236, 248, 252, 0) 70%);
  }
  .runners {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .runner {
    position: absolute;
  }
  .runner.xiaochun {
    left: 46cqw;
    top: 30cqh;
  }
  .runner.aming {
    left: 58cqw;
    top: 26cqh;
  }
  .runner.xiaocui {
    left: 70cqw;
    top: 18cqh;
  }
  .logo-box {
    position: absolute;
    left: 4cqw;
    top: 7cqh;
    width: 42cqw;
  }

  /* 底部的起跑碼頭 */
  .dock {
    position: absolute;
    left: 2.4cqw;
    right: 2.4cqw;
    bottom: 6.4cqh;
    display: flex;
    align-items: center;
    gap: 1.4cqw;
    padding: 1.8cqh 2cqw;
    background: rgba(255, 255, 255, 0.88);
    border: var(--line) solid var(--sky-line);
    border-radius: 4cqh;
    box-shadow: var(--soft-shadow);
  }
  .ic {
    display: inline-flex;
    width: 4.4cqh;
    height: 4.4cqh;
  }
  .ic svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  .start {
    padding: 0.8cqh 4cqh 0.8cqh 3.4cqh;
    min-height: 11cqh;
    gap: 2cqh;
  }
  .start .ic {
    width: 6.4cqh;
    height: 6.4cqh;
  }
  .label {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }
  .label b {
    font-size: 4.6cqh;
  }
  .label small {
    font-size: 2cqh;
    letter-spacing: 0.3em;
  }
  .sign {
    min-height: 8cqh;
    font-size: 3cqh;
    padding: 0.8cqh 2.6cqh;
  }
  .chev {
    font-size: 1.3em;
    line-height: 0.8;
  }
  .tools {
    margin-left: auto;
    display: flex;
    gap: 1cqw;
  }
  .tool img {
    width: 3.2cqh;
    height: 3.2cqh;
  }
  .foot {
    position: absolute;
    left: 4cqw;
    bottom: 1.4cqh;
  }
</style>
