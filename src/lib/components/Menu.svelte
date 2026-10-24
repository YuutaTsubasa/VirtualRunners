<script>
  // 選單。直的（暫停、連線選單）是一排圓角路牌，選到的那顆變日光橘＋▶；
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
    margin: 0.6cqh 0;
    border: var(--line) solid var(--sky-line);
    border-radius: 999px;
    background: #fff;
    padding: 1.1cqh 2cqh 1.1cqh 7cqh;
    text-align: left;
    font-size: 3.4cqh;
    font-weight: 900;
    letter-spacing: 0.16em;
    color: var(--teal);
    white-space: nowrap;
    transition: padding 0.08s, background 0.08s, transform 0.08s;
  }
  /* 選到的那顆：日光橘＋深墨字＋小三角，往前推一點 */
  .menu-item:focus {
    background: var(--accent);
    border-color: var(--navy);
    color: var(--navy);
    outline: none;
    padding-left: 8cqh;
    box-shadow: 0 0.5cqh 0 var(--accent-deep);
  }
  .menu-item:focus::before {
    content: '';
    position: absolute;
    left: 3cqh;
    top: 50%;
    translate: 0 -50%;
    border-left: 2cqh solid currentColor;
    border-top: 1.3cqh solid transparent;
    border-bottom: 1.3cqh solid transparent;
  }
</style>
