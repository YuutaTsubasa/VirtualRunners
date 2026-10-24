<script>
  // 選角（art-work/ui-concept-v1/02-character-select 的版型）：左邊角色名冊、中間目前角色的大頭像、
  // 右邊小能力與這一次要跑的模式。每個角色的能力不一樣（數值在 crates/runner-core/src/characters.rs）。
  import { onMount, untrack } from 'svelte';
  import { CHARACTERS, isUnlocked } from '../game/characters.js';
  import { endlessBest, totalStars, MAX_STARS } from '../game/progress.js';
  import { play } from '../game/audio.js';
  import { ui } from '../ui.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import BackButton from './BackButton.svelte';
  import ControlHint from './ControlHint.svelte';
  import CharacterGrid from './CharacterGrid.svelte';
  import SpritePose from './SpritePose.svelte';
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
    <div class="roster">
      <CharacterGrid bind:this={grid} bind:cursor columns={3} onpick={(c) => pick(c)} />
    </div>

    <div class="hero">
      {#key current.id}
        {#if open}
          <img src={current.portraits.happy} alt="" draggable="false" />
        {:else}
          <img class="lock" src={asset('ui/icons/lock.webp')} alt="" />
        {/if}
      {/key}
      <div class="name-brush">
        <b>{open ? current.name : '？？？'}</b>
        <small>{open ? current.intro : t('打倒第一大關的魔王就會出現。')}</small>
      </div>
    </div>

    <div class="info">
      <h3 class="ink-tab">{t('能力')}</h3>
      <div class="special" style:--sp={open ? current.specialColor : 'var(--navy)'}>
        <b><span>{t('特殊能力')}</span>{open ? current.specialName : '？？？'}</b>
        <small>{open ? current.specialDesc : ''}</small>
      </div>
      <div class="poses">
        {#if open}
          {#key current.id}
            <SpritePose character={current} pose="run1" size="20cqh" />
            <SpritePose character={current} pose="jump" size="20cqh" />
            <SpritePose character={current} pose="dash" size="20cqh" />
          {/key}
        {/if}
      </div>
      <h3 class="ink-tab">{start === 'level' ? t('關卡模式') : t('無盡模式')}</h3>
      <div class="settings">
        {#if start === 'level'}
          <span>{t('星星')}</span><b>★ {stars} / {MAX_STARS}</b>
        {:else}
          <span>{t('最遠')}</span><b>{best.meters} m</b>
          <span>{t('最高分')}</span><b>{String(best.score).padStart(7, '0')}</b>
        {/if}
      </div>
      <button type="button" class="vbtn small random" onclick={randomPick}>{t('隨機')}</button>
    </div>
  </div>

  {#snippet foot()}
    <BackButton onclick={goBack} />
    <ControlHint extra={ui.input === 'touch' ? t('點一下看資料，再點一下決定') : ''} />
    <button type="button" class="vbtn primary" bind:this={startButton} disabled={!open} onclick={() => pick()}>
      {start === 'level' ? t('選關卡') : t('出發！')}
    </button>
  {/snippet}
</ScreenFrame>

<style>
  .select {
    flex: 1;
    display: grid;
    grid-template-columns: 30cqw 27cqw 1fr;
    grid-template-rows: minmax(0, 1fr);
    gap: 1.6cqh 1.8cqw;
    min-height: 0;
  }
  .roster {
    display: flex;
    min-height: 0;
  }
  /* 名冊：4 列平均分高度，格子跟著縮，不會被底下的席位蓋住 */
  .roster :global(.grid) {
    gap: 1.2cqh 1cqw;
    grid-template-rows: repeat(4, minmax(0, 1fr));
    align-content: stretch;
    min-height: 0;
  }
  .roster :global(.card) {
    aspect-ratio: auto;
    min-height: 0;
  }

  /* 中間的大頭像：網點底的漫畫格，左下壓一個毛筆名字 */
  .hero {
    position: relative;
    border: 0.42cqh solid var(--navy);
    background:
      radial-gradient(rgba(40, 127, 120, 0.35) 22%, transparent 26%) 0 0 / 1.2cqh 1.2cqh,
      linear-gradient(160deg, #d7e8e2, #f5efdf 70%);
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-height: 0;
  }
  .hero img {
    position: absolute;
    left: 50%;
    bottom: 0;
    height: 100%;
    translate: -50% 0;
    animation: slide 0.18s ease-out;
  }
  .hero img.lock {
    height: 30%;
    bottom: 35%;
    opacity: 0.6;
  }
  .name-brush {
    position: relative;
    align-self: flex-end;
    margin: 0 auto 1.6cqh 1.6cqh;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .name-brush b {
    background: var(--navy);
    color: var(--on-dark);
    font-size: 6cqh;
    font-style: italic;
    font-weight: 900;
    padding: 0 3cqh 0 1.6cqh;
    line-height: 1.2;
    clip-path: polygon(0 10%, 6% 0, 94% 8%, 100% 30%, 96% 100%, 4% 92%);
  }
  .name-brush small {
    margin-top: 0.4cqh;
    background: var(--cream);
    border: 0.25cqh solid var(--navy);
    padding: 0.2cqh 1.2cqh;
    font-size: 2cqh;
    font-weight: 800;
    transform: rotate(-2deg);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.7cqh;
    min-height: 0;
    min-width: 0;
  }
  .ink-tab {
    align-self: flex-start;
    margin: 0;
    padding: 0.4cqh 5cqh 0.4cqh 1.8cqh;
    background: var(--navy);
    color: var(--on-dark);
    font-size: 3.2cqh;
    font-weight: 900;
    letter-spacing: 0.3em;
    clip-path: polygon(0 8%, 5% 0, 88% 6%, 100% 0, 95% 50%, 100% 100%, 3% 94%);
  }
  .special {
    display: flex;
    flex-direction: column;
    gap: 0.2cqh;
    padding: 0.3cqh 0 0.3cqh 1cqw;
    border-left: 0.8cqh solid var(--sp);
  }
  .special b {
    font-size: 2.4cqh;
    font-weight: 900;
  }
  .special b span {
    margin-right: 1cqw;
    padding: 0.1cqh 0.8cqw;
    background: var(--navy);
    color: var(--on-dark);
    font-size: 1.9cqh;
  }
  .special small {
    font-size: 1.9cqh;
    line-height: 1.35;
  }
  .settings {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.5cqh 1.6cqw;
    align-items: center;
    font-size: 2.3cqh;
    font-weight: 900;
  }
  .random {
    align-self: flex-end;
  }
  .poses {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    min-height: 18cqh;
    border-bottom: 0.2cqh solid var(--navy);
  }

  @keyframes slide {
    from {
      opacity: 0.4;
      transform: translateX(1.4cqh);
    }
  }
</style>
