<script>
  // 關卡地圖（art-work/runner-ui-concept-v1/03-stage-map）：上面六個世界的分頁（小風景＋名字，沒開的上鎖），
  // 主區是這個世界的風景上一條彎彎的路線、8 個節點（1-1～1-8，最後是魔王），右下是選中那一關的詳細牌＋「開始跑」。
  // 節點：過關的橘色＋星星、目前可以玩的晴空藍、上鎖的灰色＋鎖。
  // 操作：方向鍵／滑鼠在節點間移動就會換詳細牌；Enter／點選中的節點再點一次＝開始跑。
  import { onMount, untrack } from 'svelte';
  import { WORLDS, WORLD_TIPS, stageLabel } from '../game/stages.js';
  import { STAGE_COUNT } from '../game/constants.js';
  import { starsOf, stageOpen, worldOpen, nextStage, totalStars, MAX_STARS } from '../game/progress.js';
  import { getCharacter } from '../game/characters.js';
  import { play } from '../game/audio.js';
  import { asset } from '../art-style.svelte.js';
  import { ui } from '../ui.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import BackButton from './BackButton.svelte';
  import ControlHint from './ControlHint.svelte';
  import WorldScene from './WorldScene.svelte';
  import RunnerPose from './RunnerPose.svelte';
  import { t } from '../i18n.svelte.js';

  // at：一開始停在哪一關（沒給就停在下一個還沒過的關）；onpick(world, stage)
  let { character, at = null, onpick, onback } = $props();

  const first = untrack(() => at) ?? nextStage();
  let world = $state(first.world);
  let stage = $state(first.stage);
  let nodes;
  const runner = $derived(getCharacter(character));
  const stars = totalStars();

  // 路線上 8 個節點的位置（地圖寬高的百分比）：從左下彎彎地往右上，最後是魔王；右下留給詳細牌
  const SPOTS = [
    [7, 72],
    [17, 56],
    [28, 70],
    [39, 52],
    [50, 64],
    [60, 42],
    [72, 26],
    [88, 20],
  ];
  // 經過節點的平滑曲線（每兩點之間用中點當控制點）
  const path = (() => {
    let d = `M ${SPOTS[0][0]} ${SPOTS[0][1]}`;
    for (let i = 1; i < SPOTS.length; i++) {
      const [x0, y0] = SPOTS[i - 1];
      const [x1, y1] = SPOTS[i];
      d += ` C ${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`;
    }
    return d;
  })();

  onMount(() => focusStage(stage));

  function focusStage(s) {
    nodes?.querySelector(`[data-stage="${s}"]`)?.focus({ preventScroll: true });
  }

  function chooseWorld(w) {
    if (!worldOpen(w)) return play('deny');
    if (world === w) return;
    play('move');
    world = w;
    // 停在這個世界第一個還沒過的關
    const s = Array.from({ length: STAGE_COUNT }, (_, i) => i).find((i) => stageOpen(w, i) && !starsOf(w, i));
    stage = s ?? 0;
  }

  function look(s) {
    if (stage !== s && (ui.input === 'key' || ui.input === 'pad')) play('move');
    stage = s;
  }

  function tapNode(s) {
    if (!stageOpen(world, s)) return play('deny');
    // 滑鼠／觸控：第一下選、第二下（或按「開始跑」）出發；鍵盤手把按 Enter 直接出發
    if (stage !== s && (ui.input === 'pointer' || ui.input === 'touch')) {
      stage = s;
      play('move');
      return;
    }
    go();
  }

  function go() {
    if (!stageOpen(world, stage)) return play('deny');
    play('select');
    onpick(world, stage);
  }

  const open = $derived(stageOpen(world, stage));
  const got = $derived(starsOf(world, stage));
  const boss = $derived(stage === STAGE_COUNT - 1);
</script>

<ScreenFrame title={t('關卡地圖')} subtitle={t('★ {n} / {max}', { n: stars, max: MAX_STARS })} {world}>
  <div class="map">
    <div class="worlds">
      {#each WORLDS as w, i (w.id)}
        {@const unlocked = worldOpen(i)}
        <button
          type="button"
          class="world"
          class:active={i === world}
          class:locked={!unlocked}
          aria-disabled={!unlocked}
          onmouseenter={() => ui.input === 'pointer' && unlocked && chooseWorld(i)}
          onclick={() => chooseWorld(i)}
        >
          <span class="thumb"><WorldScene world={i} scroll={false} /></span>
          {#if !unlocked}<img class="lock" src={asset('ui/icons/lock.webp')} alt="" />{/if}
          <b>{unlocked ? t(w.name) : '？？？'}</b>
        </button>
      {/each}
    </div>

    <div class="route">
      <WorldScene {world} />
      <div class="veil"></div>
      <svg class="line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} class="road" />
        <path d={path} class="dash" />
      </svg>
      <div class="nodes" bind:this={nodes}>
        {#each SPOTS as [x, y], s (s)}
          {@const isOpen = stageOpen(world, s)}
          {@const n = starsOf(world, s)}
          <button
            type="button"
            class="node"
            class:cleared={n > 0}
            class:locked={!isOpen}
            class:boss={s === STAGE_COUNT - 1}
            class:sel={s === stage}
            data-stage={s}
            style="left: {x}%; top: {y}%"
            aria-label={`${stageLabel(world, s)} ${isOpen ? t(WORLDS[world].subs[s]) : ''}`}
            onfocus={() => look(s)}
            onmouseenter={() => ui.input === 'pointer' && (stage = s)}
            onclick={() => tapNode(s)}
          >
            {#if !isOpen}
              <img src={asset('ui/icons/lock.webp')} alt="" />
            {:else if s === STAGE_COUNT - 1}
              <span class="crown">♛</span>
            {/if}
            <span class="no">{stageLabel(world, s)}</span>
            {#if n > 0}<span class="mini-stars">{'★'.repeat(n)}{'☆'.repeat(3 - n)}</span>{/if}
          </button>
        {/each}
        {#key `${world}-${stage}`}
          <div class="me" style="left: {SPOTS[stage][0]}%; top: {SPOTS[stage][1]}%">
            <RunnerPose character={runner} size="13cqh" />
          </div>
        {/key}
      </div>

      <div class="detail panel">
        <span class="label">{stageLabel(world, stage)}</span>
        <b class="stage-name">{open ? t(WORLDS[world].subs[stage]) : '？？？'}</b>
        {#if boss}<span class="boss-tag">{t('魔王')}：{open ? t(WORLDS[world].boss.name) : '？？？'}</span>{/if}
        <span class="stars">{#each [0, 1, 2] as i (i)}<i class:on={i < got}>★</i>{/each}</span>
        <p class="tip">{t(WORLD_TIPS[world])}</p>
        <button type="button" class="vbtn primary go" disabled={!open} data-gamepad-skip onclick={go}>{t('開始跑')}</button>
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
    display: flex;
    flex-direction: column;
    gap: 1.4cqh;
    min-height: 0;
  }
  .worlds {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1cqw;
  }
  .world {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5cqh 0.5cqh 0.4cqh;
    border: var(--line) solid var(--sky-line);
    border-radius: 1.6cqh;
    background: var(--paper-white);
    font: inherit;
    color: var(--navy);
    box-shadow: var(--soft-shadow);
    transition: transform 0.08s;
  }
  .world:hover:not(.locked) {
    transform: translateY(-0.3cqh);
  }
  .world.active {
    border-color: var(--teal);
    box-shadow: 0 0 0 0.3cqh var(--teal), 0 0.5cqh 0 var(--navy);
  }
  .world.locked {
    cursor: not-allowed;
  }
  .thumb {
    position: relative;
    display: block;
    width: 100%;
    height: 7cqh;
    border-radius: 1.1cqh;
    overflow: hidden;
  }
  .world.locked .thumb {
    filter: grayscale(1) brightness(0.6);
  }
  .world .lock {
    position: absolute;
    top: 2cqh;
    width: 4cqh;
  }
  .world b {
    font-size: 2cqh;
    font-weight: 900;
  }

  .route {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: 3cqh;
    overflow: hidden;
    border: var(--line) solid var(--sky-line);
    box-shadow: var(--soft-shadow);
  }
  .veil {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--sky-light) 45%, transparent));
  }
  .line {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .road {
    fill: none;
    stroke: var(--paper-white);
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    stroke-width: 2.2cqh;
    filter: drop-shadow(0 0.4cqh 0 color-mix(in srgb, var(--teal) 35%, transparent));
  }
  .dash {
    fill: none;
    stroke: var(--sky);
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    stroke-width: 0.8cqh;
    stroke-dasharray: 1.6cqh 1.2cqh;
  }
  .nodes {
    position: absolute;
    inset: 0;
  }
  /* 路線節點：圓形路牌 */
  .node {
    position: absolute;
    translate: -50% -50%;
    width: 9cqh;
    height: 9cqh;
    border-radius: 50%;
    border: 0.45cqh solid var(--teal);
    background: var(--paper-white);
    color: var(--teal);
    font: inherit;
    font-weight: 900;
    display: grid;
    place-items: center;
    padding: 0;
    box-shadow: 0 0.5cqh 0 var(--teal);
    transition: transform 0.1s;
    z-index: 1;
  }
  .node .no {
    font-size: 2.4cqh;
    line-height: 1;
  }
  .node.cleared {
    background: var(--gold);
    border-color: var(--navy);
    color: var(--navy);
    box-shadow: 0 0.5cqh 0 var(--gold-deep);
  }
  .node.locked {
    background: var(--muted-bg);
    border-color: var(--muted-line);
    color: var(--muted-text);
    box-shadow: 0 0.5cqh 0 var(--muted-line);
    cursor: not-allowed;
  }
  .node.locked img {
    position: absolute;
    width: 3.2cqh;
    top: -2.2cqh;
  }
  .node.boss {
    width: 11cqh;
    height: 11cqh;
  }
  .crown {
    position: absolute;
    top: -3.4cqh;
    font-size: 3.6cqh;
    color: var(--red);
    -webkit-text-stroke: 0.3cqh var(--paper-white);
    paint-order: stroke fill;
  }
  .mini-stars {
    position: absolute;
    bottom: -3cqh;
    font-size: 2.2cqh;
    letter-spacing: -0.1em;
    color: var(--gold-deep);
    -webkit-text-stroke: 0.25cqh var(--paper-white);
    paint-order: stroke fill;
    white-space: nowrap;
  }
  /* 選中的節點：往前一點、晴空藍外環 */
  .node.sel {
    transform: translateY(-0.8cqh) scale(1.08);
    outline: 0.6cqh solid var(--sky);
    outline-offset: 0.5cqh;
  }
  .me {
    position: absolute;
    translate: -50% -100%;
    margin-top: -4cqh;
    pointer-events: none;
    z-index: 2;
    animation: hop 0.25s ease-out;
  }
  @keyframes hop {
    from {
      transform: translateY(-1.6cqh);
    }
  }

  /* 右下的詳細牌 */
  .detail {
    position: absolute;
    right: 1.6cqw;
    bottom: 1.8cqh;
    width: 30cqw;
    padding: 1.4cqh 1.6cqw 1.6cqh;
    gap: 0.6cqh;
    align-items: flex-start;
    z-index: 3;
  }
  .label {
    padding: 0.1cqh 1.6cqh;
    border-radius: 999px;
    background: var(--accent);
    color: var(--navy);
    font-weight: 900;
    font-size: 2.6cqh;
  }
  .stage-name {
    font-size: 4cqh;
    font-weight: 900;
    line-height: 1.1;
  }
  .boss-tag {
    font-weight: 900;
    font-size: 2cqh;
    color: var(--red);
  }
  .stars {
    display: flex;
    gap: 0.5cqw;
    font-size: 4cqh;
    line-height: 1;
  }
  .stars i {
    font-style: normal;
    color: var(--muted-bg);
    -webkit-text-stroke: 0.2cqh var(--muted-line);
  }
  .stars i.on {
    color: var(--gold);
    -webkit-text-stroke: 0.2cqh var(--navy);
  }
  .tip {
    margin: 0;
    font-size: 1.8cqh;
    font-weight: 800;
    color: var(--navy-soft);
    line-height: 1.4;
  }
  .go {
    align-self: stretch;
    margin-top: 0.6cqh;
    min-height: 7cqh;
    font-size: 3.4cqh;
  }
</style>
