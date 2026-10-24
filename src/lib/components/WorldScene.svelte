<script>
  // 選單用的關卡背景（程式畫的，見 src/lib/game/scenery.js），會慢慢往右捲
  import { onMount } from 'svelte';
  import { drawBackdrop } from '../game/scenery.js';

  let { world = 0, sub = 0, scroll = true } = $props();
  let canvas;

  onMount(() => {
    let raf = 0;
    let cam = Math.random() * 2000;
    const frame = () => {
      if (scroll) cam += 0.6;
      drawBackdrop(canvas, world, sub, cam);
      raf = requestAnimationFrame(frame);
    };
    canvas.width = 960;
    frame();
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas class="scene" bind:this={canvas}></canvas>

<style>
  .scene {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
