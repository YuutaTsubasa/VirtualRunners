<script>
  // 「◀ 值 ▶」切換器（闖關設定用）。中間其實是 <select>：鍵盤／手把焦點在上面時按左右就會換
  // （Controls.svelte 處理），滑鼠／觸控點兩邊的三角形換。
  import { play } from '../game/audio.js';

  // options：[{ value, label }]；value 可以 bind
  let { options, value = $bindable(), disabled = false, onchange = () => {} } = $props();
  const index = $derived(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));

  function step(d) {
    if (disabled || options.length < 2) return;
    const next = options[(index + d + options.length) % options.length];
    value = next.value;
    play('move');
    onchange(next.value);
  }
</script>

<div class="stepper" class:disabled>
  <button type="button" tabindex="-1" class="arrow left" aria-label="◀" {disabled} onclick={() => step(-1)}></button>
  <select
    {disabled}
    value={String(options[index]?.value)}
    onchange={(e) => {
      const o = options.find((x) => String(x.value) === e.currentTarget.value);
      if (!o) return;
      value = o.value;
      onchange(o.value);
    }}
  >
    {#each options as o (o.value)}<option value={String(o.value)}>{o.label}</option>{/each}
  </select>
  <button type="button" tabindex="-1" class="arrow right" aria-label="▶" {disabled} onclick={() => step(1)}></button>
</div>

<style>
  .stepper {
    display: grid;
    grid-template-columns: 4cqh 1fr 4cqh;
    align-items: center;
    border: 0.25cqh solid var(--navy);
    background: var(--paper-white);
    min-width: 0;
  }
  select {
    appearance: none;
    border: 0;
    background: none;
    text-align: center;
    text-align-last: center;
    font-weight: 900;
    font-size: 2.4cqh;
    padding: 0.5cqh 0;
    min-width: 0;
    width: 100%;
  }
  .arrow {
    border: 0;
    background: none;
    padding: 0;
    height: 100%;
    display: grid;
    place-items: center;
  }
  .arrow::before {
    content: '';
    border-top: 1cqh solid transparent;
    border-bottom: 1cqh solid transparent;
  }
  .left::before {
    border-right: 1.4cqh solid var(--navy);
  }
  .right::before {
    border-left: 1.4cqh solid var(--navy);
  }
  .arrow:hover:not(:disabled)::before {
    filter: drop-shadow(0 0 0 var(--accent));
  }
  .left:hover:not(:disabled)::before {
    border-right-color: var(--accent);
  }
  .right:hover:not(:disabled)::before {
    border-left-color: var(--accent);
  }
  .disabled {
    background: transparent;
    border-style: dashed;
  }
  .disabled .arrow {
    visibility: hidden;
  }
  /* 焦點在 select 上：整條朱紅框 */
  .stepper:has(select:focus-visible),
  :global([data-input='pad']) .stepper:has(select:focus) {
    outline: 0.45cqh solid var(--accent);
    outline-offset: 0.2cqh;
  }
  .stepper :global(select:focus) {
    outline: none !important;
  }
</style>
