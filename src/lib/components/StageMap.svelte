<script>
  // 關卡地圖：左邊六大關，右邊這一大關的 8 小關（星星、上鎖、魔王關）。
  // 過了前一關才能玩下一關；星星：過關 1 顆、金幣七成以上 1 顆、沒受傷 1 顆。
  import { onMount, untrack } from 'svelte';
  import { WORLDS, WORLD_TIPS, stageLabel } from '../game/stages.js';
  import { STAGE_COUNT } from '../game/constants.js';
  import { starsOf, stageOpen, worldOpen, nextStage, totalStars, MAX_STARS } from '../game/progress.js';
  import { getCharacter } from '../game/characters.js';
  import { play } from '../game/audio.js';
  import { ui } from '../ui.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import BackButton from './BackButton.svelte';
  import ControlHint from './ControlHint.svelte';
  import WorldScene from './WorldScene.svelte';
  import SpritePose from './SpritePose.svelte';
  import { t } from '../i18n.svelte.js';

  // at：一開始停在哪一關（沒給就停在下一個還沒過的關）；onpick(world, stage)
  let { character, at = null, onpick, onback } = $props();

  const first = untrack(() => at) ?? nextStage();
  let world = $state(first.world);
  let tiles;
  const runner = $derived(getCharacter(character));
  const stars = totalStars();

  onMount(() => {
    tiles?.querySelector(`[data-stage="${first.stage}"]`)?.focus({ preventScroll: true });
  });

  function chooseWorld(w) {
    if (!worldOpen(w)) return play('deny');
    if (world !== w) play('move');
    world = w;
  }

  function choose(s) {
    if (!stageOpen(world, s)) return play('deny');
    play('select');
    onpick(world, s);
  }
</script>

<ScreenFrame title={t('關卡地圖')} subtitle={t('★ {n} / {max}', { n: stars, max: MAX_STARS })} {world}>
  <div class="map">
    <div class="worlds">
      {#each WORLDS as w, i (w.id)}
        <button
          type="button"
          class="vbtn plain world"
          class:active={i === world}
          disabled={!worldOpen(i)}
          onfocus={() => chooseWorld(i)}
          onmouseenter={() => ui.input === 'pointer' && worldOpen(i) && (world = i)}
          onclick={() => chooseWorld(i)}
        >
          <span class="no">{i + 1}</span>
          <b>{worldOpen(i) ? t(w.name) : '？？？'}</b>
          <small>{Array.from({ length: STAGE_COUNT }, (_, s) => starsOf(i, s)).reduce((a, b) => a + b, 0)}★</small>
        </button>
      {/each}
    </div>

    <div class="detail">
      <div class="banner">
        <WorldScene {world} />
        <div class="banner-text">
          <h3>{t(WORLDS[world].name)}</h3>
          <p>{t(WORLD_TIPS[world])}</p>
        </div>
        <div class="runner"><SpritePose character={runner} pose="run1" size="22cqh" /></div>
      </div>
      <div class="tiles" bind:this={tiles}>
        {#each { length: STAGE_COUNT } as _, s (s)}
          {@const open = stageOpen(world, s)}
          {@const n = starsOf(world, s)}
          {@const boss = s === STAGE_COUNT - 1}
          <button type="button" class="tile" class:boss class:locked={!open} class:cleared={n > 0} data-stage={s} aria-disabled={!open} onclick={() => choose(s)}>
            <span class="label">{stageLabel(world, s)}</span>
            <b>{open ? t(WORLDS[world].subs[s]) : '？？？'}</b>
            {#if boss}<span class="boss-tag">{t('魔王')}：{open ? t(WORLDS[world].boss.name) : '？？？'}</span>{/if}
            <span class="stars">{#each [0, 1, 2] as i (i)}<i class:on={i < n}>★</i>{/each}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  {#snippet foot()}
    <BackButton onclick={onback} />
    <ControlHint />
    <span></span>
  {/snippet}
</ScreenFrame>

<style>
  .map {
    flex: 1;
    display: grid;
    grid-template-columns: 24cqw 1fr;
    gap: 1.8cqw;
    min-height: 0;
  }
  .worlds {
    display: flex;
    flex-direction: column;
    gap: 1cqh;
    min-height: 0;
  }
  .world {
    --cut: 1.6cqh;
    flex: 1;
    justify-content: flex-start;
    gap: 1.4cqw;
    padding: 0 1.6cqw;
    letter-spacing: 0;
    text-indent: 0;
    min-height: 0;
  }
  .world.active {
    --face: var(--accent);
    --fg: var(--on-dark);
  }
  .world .no {
    font-size: 4cqh;
    font-weight: 900;
    width: 4cqh;
  }
  .world b {
    flex: 1;
    font-size: 3cqh;
    text-align: left;
  }
  .world small {
    font-size: 2.2cqh;
    font-weight: 900;
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 1.4cqh;
    min-height: 0;
  }
  .banner {
    position: relative;
    height: 22cqh;
    border: 0.35cqh solid var(--navy);
    overflow: hidden;
    flex: none;
  }
  .banner-text {
    position: absolute;
    left: 1.6cqw;
    bottom: 1.4cqh;
    max-width: 60%;
  }
  .banner h3 {
    display: inline-block;
    margin: 0 0 0.6cqh;
    background: var(--navy);
    color: var(--on-dark);
    font-size: 4cqh;
    padding: 0.2cqh 2cqh;
  }
  .banner p {
    margin: 0;
    background: var(--cream);
    border: 0.25cqh solid var(--navy);
    padding: 0.4cqh 1.2cqh;
    font-weight: 800;
    font-size: 2.1cqh;
  }
  .runner {
    position: absolute;
    right: 2cqw;
    bottom: -1cqh;
  }
  .tiles {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 1.2cqh 1.2cqw;
    min-height: 0;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.4cqh;
    padding: 1cqh 1.2cqw;
    border: 0.35cqh solid var(--navy);
    background: var(--paper-white);
    color: var(--navy);
    font: inherit;
    cursor: pointer;
    text-align: left;
    min-height: 0;
  }
  .tile:focus-visible,
  .tile:hover {
    outline: 0.5cqh solid var(--accent);
    outline-offset: 0.2cqh;
  }
  .tile.cleared {
    background: #fff4d6;
  }
  .tile.boss {
    background: linear-gradient(160deg, #3a2030, #1e1a2a);
    color: var(--on-dark);
  }
  .tile.locked {
    background: #d9d3c4;
    color: rgba(32, 35, 41, 0.45);
    cursor: not-allowed;
  }
  .label {
    font-size: 3.8cqh;
    font-weight: 900;
    line-height: 1;
  }
  .tile b {
    font-size: 2.4cqh;
    font-weight: 900;
  }
  .boss-tag {
    font-size: 1.8cqh;
    font-weight: 800;
    color: #ffb3c0;
  }
  .stars {
    display: flex;
    gap: 0.4cqw;
    font-size: 3.2cqh;
    font-style: normal;
  }
  .stars i {
    font-style: normal;
    color: rgba(0, 0, 0, 0.15);
  }
  .tile.boss .stars i {
    color: rgba(255, 255, 255, 0.2);
  }
  .stars i.on {
    color: var(--gold);
    -webkit-text-stroke: 0.15cqh var(--navy);
  }
</style>
