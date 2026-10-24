<script>
  // 會跑的角色（選單用）：輪流播圖集裡的跑步格（有 run5～run8 就是 8 格，不然 run1～run4），
  // 只有 4 格時每一步身體上下起伏一點（8 格的圖本身就有起伏）。pose 給定時就停在那一格（例如過關的 goal）。減少動態效果時停在 run1。
  import { onMount } from 'svelte';
  import { sheetOf } from '../game/sheets.js';
  import SpritePose from './SpritePose.svelte';

  let { character, size = '30cqh', pose = null, fps = 16, delay = 0 } = $props();

  const frames = $derived.by(() => {
    const have = sheetOf('characters', character.id)?.frames ?? [];
    const eight = ['run1', 'run5', 'run2', 'run6', 'run3', 'run7', 'run4', 'run8'];
    if (eight.every((f) => have.includes(f))) return eight;
    if (['run3', 'run4'].every((f) => have.includes(f))) return ['run1', 'run2', 'run3', 'run4'];
    return ['run1', 'run2'];
  });
  let i = $state(0);

  onMount(() => {
    if (pose || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = setInterval(() => (i = (i + 1) % 64), 1000 / fps);
    // 幾個人一起跑時錯開步伐
    i = delay;
    return () => clearInterval(timer);
  });

  const name = $derived(pose ?? frames[i % frames.length]);
  // 腳著地（run1、run3）低一點，兩腳交錯（run2、run4）高一點
  const bob = $derived(pose || frames.length === 8 ? 0 : ({ run1: 0.6, run3: 0.6, run2: -0.9, run4: -0.9 }[name] ?? 0));
</script>

<div class="runner" style="translate: 0 {bob}cqh">
  <SpritePose {character} pose={name} {size} />
</div>

<style>
  .runner {
    transition: translate 0.06s linear;
  }
</style>
