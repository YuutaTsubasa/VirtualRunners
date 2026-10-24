<script>
  // 選單。直的（標題、暫停）是一行一行的字、中間細線分隔，選到的那行變朱紅底＋▶；
  // 橫的（結果畫面）是一排按鈕。鍵盤／手把的焦點移動由 Controls.svelte 統一處理，這裡只負責一出現就把焦點放在第一顆。
  import { onMount } from 'svelte';
  import { play } from '../game/audio.js';
  import { ui } from '../ui.svelte.js';

  let { items, horizontal = false, width = '40cqw' } = $props();
  let nav;

  onMount(() => {
    nav.querySelector('button')?.focus({ preventScroll: true });
  });

  function choose(item) {
    play('select');
    item.action();
  }
</script>

<nav class="menu" class:row={horizontal} bind:this={nav} style="--menu-width: {width}">
  {#each items as item (item.label)}
    <button
      type="button"
      class={horizontal ? 'vbtn' : 'menu-item'}
      class:primary={horizontal && item.primary}
      onfocus={() => (ui.input === 'key' || ui.input === 'pad') && play('move')}
      onmouseenter={(e) => !horizontal && ui.input === 'pointer' && e.currentTarget.focus({ preventScroll: true })}
      onclick={() => choose(item)}
    >
      {item.label}
    </button>
  {/each}
</nav>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    width: var(--menu-width);
  }
  .menu.row {
    flex-direction: row;
    gap: 2.4cqw;
    width: auto;
    align-items: center;
  }
  .menu.row :global(.vbtn.primary) {
    font-size: 3.4cqh;
    min-height: 7cqh;
    padding: 0.8cqh 5cqh;
  }
  .menu-item {
    position: relative;
    border: 0;
    border-bottom: 0.25cqh solid var(--navy);
    background: none;
    padding: 1.3cqh 2cqh 1.3cqh 7cqh;
    text-align: left;
    font-size: 4cqh;
    font-weight: 900;
    letter-spacing: 0.3em;
    color: var(--navy);
    white-space: nowrap;
    transition: padding 0.08s, background 0.08s;
  }
  .menu-item:first-child {
    border-top: 0;
  }
  /* 選到的那行：朱紅實底＋暖白字＋小三角游標，稍微往前推 */
  .menu-item:focus {
    background: var(--accent);
    color: var(--on-dark);
    border-bottom-color: transparent;
    outline: none;
    padding-left: 8cqh;
    box-shadow: 0.5cqh 0.5cqh 0 var(--navy);
  }
  .menu-item:focus::before {
    content: '';
    position: absolute;
    left: 2.6cqh;
    top: 50%;
    translate: 0 -50%;
    border-left: 2cqh solid currentColor;
    border-top: 1.3cqh solid transparent;
    border-bottom: 1.3cqh solid transparent;
  }
</style>
