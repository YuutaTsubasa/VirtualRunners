<script>
  // 選角（art-work/runner-ui-concept-v1/02-character-select）：左上是目前角色的大幅奔跑姿態（踩在晴空藍的速度帶上），
  // 右邊白色能力牌（名字、小能力、說明），底下一排名冊（10 位＋隱藏角色）。每個角色的能力不一樣
  // （數值在 crates/runner-core/src/characters.rs）。阿翼沒解鎖前不露出身份。
  import { onMount, untrack } from 'svelte';
  import { CHARACTERS, isUnlocked } from '../game/characters.js';
  import { endlessBest, totalStars, MAX_STARS } from '../game/progress.js';
  import { play } from '../game/audio.js';
  import { ui } from '../ui.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import BackButton from './BackButton.svelte';
  import ControlHint from './ControlHint.svelte';
  import CharacterGrid from './CharacterGrid.svelte';
  import RunnerPose from './RunnerPose.svelte';
  import { asset } from '../art-style.svelte.js';
  import { t } from '../i18n.svelte.js';

  // mode = level | endless；onstart(角色 id)、onback()
  let { mode, initial = 'xiaocui', onstart, onback } = $props();

  const start = untrack(() => mode);
  let cursor = $state(Math.max(0, CHARACTERS.findIndex((c) => c.id === untrack(() => initial))));
  let grid;
  let startButton = $state();

  const current = $derived(CHARACTERS[cursor]);
  const open = $derived(isUnlocked(current));
  const best = endlessBest();
  const stars = totalStars();

  onMount(() => grid.focusIndex(cursor));

  function pick(character = current) {
    if (!isUnlocked(character)) return play('deny');
    play('select');
    onstart(character.id);
  }

  function randomPick() {
    const pool = CHARACTERS.filter((c) => isUnlocked(c));
    const c = pool[Math.floor(Math.random() * pool.length)];
    cursor = CHARACTERS.indexOf(c);
    grid.focusIndex(cursor);
  }

  // Esc／手把 B（由 App 透過 Controls 呼叫）
  export function goBack() {
    play('select');
    onback();
  }
</script>

<ScreenFrame title={t('選擇跑者')} subtitle={start === 'level' ? t('關卡模式：選好角色，再選關卡') : t('無盡模式：跑越遠越快！')}>
  <div class="select">
    <div class="hero">
      <div class="swoosh"></div>
      {#if open}
        {#key current.id}
          <div class="hero-run"><RunnerPose character={current} size="46cqh" /></div>
        {/key}
      {:else}
        <img class="lock" src={asset('ui/icons/lock.webp')} alt="" />
      {/if}
    </div>

    <div class="info panel">
      <div class="mode-pill">{start === 'level' ? t('關卡模式') : t('無盡模式')}
        {#if start === 'level'}<b>★ {stars} / {MAX_STARS}</b>{:else}<b>{t('最遠')} {best.meters} m</b>{/if}
      </div>
      <h3 class="name pop-text">{open ? current.name : '？？？'}</h3>
      <p class="intro">{open ? current.intro : t('打倒第一大關的魔王就會出現。')}</p>
      <div class="ability" style:--sp={open ? current.specialColor : 'var(--muted)'}>
        <span class="pill">{t('特殊能力')}</span>
        <b>{open ? current.specialName : '？？？'}</b>
      </div>
      <p class="desc">{open ? current.specialDesc : ''}</p>
      <button type="button" class="vbtn small random" onclick={randomPick}>{t('隨機')}</button>
    </div>

    <div class="roster panel">
      <CharacterGrid bind:this={grid} bind:cursor columns={11} onpick={(c) => pick(c)} />
    </div>
  </div>

  {#snippet foot()}
    <BackButton onclick={goBack} />
    <ControlHint extra={ui.input === 'touch' ? t('點一下看資料，再點一下決定') : ''} />
    <button type="button" class="vbtn primary" bind:this={startButton} disabled={!open} onclick={() => pick()}>
      {start === 'level' ? t('選擇關卡') : t('開始跑')}
    </button>
  {/snippet}
</ScreenFrame>

<style>
  .select {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 38cqw;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1.6cqh 2cqw;
    min-height: 0;
  }
  /* 大幅奔跑姿態：踩在一條晴空藍的速度帶上 */
  .hero {
    position: relative;
    min-height: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .swoosh {
    position: absolute;
    left: -3cqw;
    right: 0;
    bottom: 2cqh;
    height: 11cqh;
    border-radius: 0 999px 999px 0;
    background:
      linear-gradient(90deg, transparent, var(--paper-white) 30%, transparent 31%, transparent 60%, var(--paper-white) 61%, transparent 75%) 0 30% / 100% 0.6cqh no-repeat,
      linear-gradient(90deg, transparent, var(--sky) 40%, var(--sky-line));
    transform: skewY(-4deg);
  }
  .hero-run {
    position: relative;
    margin-bottom: -2cqh;
    animation: in 0.25s ease-out;
  }
  .hero .lock {
    position: relative;
    height: 20cqh;
    margin-bottom: 8cqh;
    opacity: 0.6;
  }
  @keyframes in {
    from {
      opacity: 0.3;
      transform: translateX(-3cqw);
    }
  }

  .info {
    padding: 2cqh 2.6cqw 2cqh;
    gap: 1cqh;
    align-items: flex-start;
  }
  .mode-pill {
    align-self: flex-end;
    display: flex;
    gap: 1.4cqh;
    align-items: center;
    padding: 0.3cqh 1.8cqh;
    border: 0.25cqh solid var(--teal);
    border-radius: 999px;
    color: var(--teal);
    font-weight: 900;
    font-size: 2cqh;
  }
  .mode-pill b {
    color: var(--gold-deep);
  }
  .name {
    margin: 0;
    font-size: 9cqh;
    color: var(--navy);
  }
  .intro {
    margin: 0;
    font-weight: 800;
    font-size: 2.2cqh;
    color: var(--navy-soft);
  }
  .ability {
    display: flex;
    align-items: center;
    gap: 1.2cqh;
    margin-top: 0.6cqh;
  }
  .ability .pill {
    padding: 0.2cqh 1.4cqh;
    border-radius: 999px;
    background: var(--teal);
    color: var(--on-dark);
    font-weight: 900;
    font-size: 1.9cqh;
  }
  .ability b {
    font-size: 3.6cqh;
    font-weight: 900;
    color: var(--teal);
    border-bottom: 0.5cqh solid var(--sp);
  }
  .desc {
    margin: 0;
    font-weight: 800;
    font-size: 2.6cqh;
    line-height: 1.45;
  }
  .random {
    margin-top: auto;
    align-self: flex-end;
  }

  .roster {
    grid-column: 1 / -1;
    padding: 1.2cqh 1.4cqw;
    flex-direction: row;
  }
  .roster :global(.grid) {
    gap: 1cqh 0.8cqw;
  }
  /* 名冊：11 位排一排，格子接近正方形，整張臉都看得到 */
  .roster :global(.card) {
    aspect-ratio: auto;
    height: 17cqh;
  }
  .roster :global(.card img) {
    object-position: center 18%;
  }
</style>
