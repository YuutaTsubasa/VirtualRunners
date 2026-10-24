<script>
  // 從角色圖集裡取一個動作畫出來（選單預覽用）。
  // 有動作圖集的角色（src/lib/game/sheets.json）用圖集的格子；其他還是排球王借來的 8 格。
  import { sheetOf } from '../game/sheets.js';
  import { asset } from '../art-style.svelte.js';

  const LEGACY = ['idle', 'run1', 'run2', 'jump', 'spike', 'dive', 'win', 'lose'];
  // 舊的動作名 → 新圖集的格子
  const NEW_NAME = { run1: 'walk1', run2: 'walk2', spike: 'punch1', dive: 'down', lose: 'hurt' };

  let { character, pose = 'idle', flip = false, size = '30cqh' } = $props();
  const sheet = $derived(sheetOf('characters', character.id));
  const box = $derived.by(() => {
    if (sheet) {
      const i = Math.max(0, sheet.frames.indexOf(sheet.frames.includes(pose) ? pose : (NEW_NAME[pose] ?? pose)));
      const cols = sheet.cols;
      const rows = Math.ceil(sheet.frames.length / cols);
      return {
        src: asset(sheet.src),
        size: `${cols * 100}% ${rows * 100}%`,
        pos: `${cols > 1 ? ((i % cols) / (cols - 1)) * 100 : 0}% ${rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 100 : 0}%`,
      };
    }
    const i = Math.max(0, LEGACY.indexOf(pose));
    return { src: character.spriteSrc, size: '800% 100%', pos: `${(i / (LEGACY.length - 1)) * 100}% 0` };
  });
</script>

<div
  class="pose"
  class:flip
  class:pixel={sheet?.pixel}
  role="img"
  aria-label={character.name}
  style="--size: {size}; background-image: url({box.src}); background-size: {box.size}; background-position: {box.pos}"
></div>

<style>
  .pose {
    width: var(--size);
    height: var(--size);
    background-repeat: no-repeat;
  }
  .flip {
    transform: scaleX(-1);
  }
  /* 像素風格的圖集：放大時不要糊 */
  .pixel {
    image-rendering: pixelated;
  }
</style>
