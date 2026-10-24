<script>
  // 標題畫面（art-work/ui-concept-v1/01-title-menu）：左邊約 40% 是暖白操作區（Logo、選單、操作提示），
  // 右邊約 60% 是漫畫分格的冒險插畫：都市當近景，海底與熔岩用小窗補充，前面是小翠、小春、阿明。
  // 有正式的標題主視覺（ui/title-scene）就用插圖，沒有就用關卡背景＋角色半身像拼。
  import { asset } from '../art-style.svelte.js';
  import { getCharacter } from '../game/characters.js';
  import Logo from './Logo.svelte';
  import Menu from './Menu.svelte';
  import WorldScene from './WorldScene.svelte';
  import ControlHint from './ControlHint.svelte';
  import SettingsButton from './SettingsButton.svelte';

  let { items } = $props();

  const scene = $derived(asset('ui/title-scene.webp'));
  const heroes = [
    ['xiaocui', 'happy', 'back-left'],
    ['aming', 'win', 'back-right'],
    ['xiaochun', 'happy', 'front'],
  ].map(([id, face, pos]) => ({ c: getCharacter(id), face, pos }));
</script>

<section class="screen title">
  <div class="paper-bg"></div>

  {#if scene}
    <!-- 正式主視覺：整張鋪滿，左邊 38% 本身就是暖白空白（放 Logo 和選單） -->
    <img class="menu-bg scene" src={scene} alt="" />
  {:else}
    <div class="art">
      <!-- 後排兩位放在上面那一格裡，被分格的斜邊切掉，像漫畫格 -->
      <div class="cell main">
        <WorldScene world={0} />
        <div class="cell far"><WorldScene world={5} /></div>
        {#each heroes.slice(0, 2) as h (h.pos)}
          <img class="hero {h.pos}" src={h.c.portraits[h.face]} alt={h.c.name} draggable="false" />
        {/each}
      </div>
      <div class="cell sea"><WorldScene world={2} /></div>
      <div class="cell lava"><WorldScene world={4} /></div>
      <img class="hero front" src={heroes[2].c.portraits[heroes[2].face]} alt={heroes[2].c.name} draggable="false" />
    </div>
  {/if}

  <div class="side">
    <div class="logo-box"><Logo size="big" /></div>
    <Menu {items} width="31cqw" />
    <div class="foot"><ControlHint /></div>
  </div>
  <div class="gear"><SettingsButton /></div>
</section>

<style>
  .title {
    align-items: stretch;
    justify-content: stretch;
  }
  /* 寬螢幕裁上下、窄螢幕從左邊裁（右邊的角色優先留著） */
  .scene {
    object-position: 100% 50%;
  }
  /* 右邊插畫：左緣是毛筆刷過的斜邊 */
  .art {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 66cqw;
    overflow: hidden;
    clip-path: polygon(10% 0, 100% 0, 100% 100%, 0 100%, 3% 78%, 1.5% 76%, 5% 52%, 4% 50%, 8% 22%, 7% 20%);
    background: var(--cream);
  }
  .cell {
    position: absolute;
    overflow: hidden;
    outline: 0.5cqh solid var(--cream);
  }
  /* 分格之間留暖白的斜縫 */
  .cell.main {
    inset: 0;
    clip-path: polygon(0 0, 100% 0, 100% 62%, 0 58%);
  }
  .cell.far {
    left: 0;
    right: 0;
    top: 0;
    height: 30%;
    clip-path: polygon(48% 0, 100% 0, 100% 100%, 58% 100%);
    opacity: 0.95;
  }
  .cell.sea {
    left: 0;
    bottom: 0;
    width: 52%;
    height: 41%;
    clip-path: polygon(0 4%, 100% 12%, 92% 100%, 0 100%);
  }
  .cell.lava {
    right: 0;
    bottom: 0;
    width: 46%;
    height: 41%;
    clip-path: polygon(14% 14%, 100% 4%, 100% 100%, 4% 100%);
  }
  .hero {
    position: absolute;
    bottom: 0;
    filter: drop-shadow(0.6cqh 0.6cqh 0 rgba(32, 35, 41, 0.55));
    pointer-events: none;
  }
  .hero.back-left {
    left: 4%;
    bottom: 30cqh;
    height: 58cqh;
  }
  .hero.back-right {
    right: -4%;
    bottom: 30cqh;
    height: 56cqh;
  }
  .hero.front {
    left: 30%;
    height: 66cqh;
  }

  .side {
    position: relative;
    width: 38cqw;
    padding: 4cqh 0 3cqh 4.4cqw;
    display: flex;
    flex-direction: column;
    gap: 3cqh;
  }
  .logo-box {
    width: 31cqw;
  }
  .logo-box :global(.logo) {
    width: 100%;
  }
  .foot {
    margin-top: auto;
  }
  .foot :global(.control-hint) {
    justify-content: flex-start;
  }
  .gear {
    position: absolute;
    top: 3cqh;
    right: 2.4cqw;
  }
</style>
