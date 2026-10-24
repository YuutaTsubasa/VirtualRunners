<script>
  import { asset, artStyle } from './lib/art-style.svelte.js';
  import { t, displayName } from './lib/i18n.svelte.js';
  import { loading, preloadStyle, preloadStyleWithin } from './lib/preload.svelte.js';
  import { onMount } from 'svelte';
  import { createEngine } from './lib/engine.js';
  import { getCharacter, pickLine, unlockHidden, CHARACTERS } from './lib/game/characters.js';
  import { recordStars, recordEndless, endlessBest, savedCharacter, saveCharacter } from './lib/game/progress.js';
  import { WORLDS, stageLabel } from './lib/game/stages.js';
  import { STAGE_COUNT, WORLD_COUNT, COUNTDOWN, SLOT_COLORS } from './lib/game/constants.js';
  import { toggleMute } from './lib/game/audio.js';
  import { net, hostCmd, leave, onFrame } from './lib/net.svelte.js';
  import Menu from './lib/components/Menu.svelte';
  import Logo from './lib/components/Logo.svelte';
  import Dialog from './lib/components/Dialog.svelte';
  import TitleScreen from './lib/components/TitleScreen.svelte';
  import SoloScreen from './lib/components/SoloScreen.svelte';
  import HelpScreen from './lib/components/HelpScreen.svelte';
  import SettingsDialog from './lib/components/SettingsDialog.svelte';
  import SelectScreen from './lib/components/SelectScreen.svelte';
  import StageMap from './lib/components/StageMap.svelte';
  import RoomEntry from './lib/components/RoomEntry.svelte';
  import Lobby from './lib/components/Lobby.svelte';
  import Controls from './lib/components/Controls.svelte';
  import TouchControls from './lib/components/TouchControls.svelte';
  import { ui, openSettings } from './lib/ui.svelte.js';
  import { roomCodeOf } from './lib/site.js';
  import { setBgm, playJingle } from './lib/audio/sound.svelte.js';

  // 單機：title | solo | select | map | play | pause | result | help | host | join（設定是隨時可開的視窗）
  // 連線中（net.room 有值）時畫面由房間狀態決定：大廳或比賽
  // 分享連結（…#join/房號）打開：直接到加入房間、帶入房號
  const linkCode = roomCodeOf(location.hash) ?? '';
  if (linkCode) history.replaceState(null, '', location.pathname + location.search);
  let joinCode = $state(linkCode);
  let screen = $state(linkCode ? 'join' : 'title');
  let mode = $state('level'); // level | endless | watch
  let character = $state(savedCharacter());
  let plan = $state(null); // 目前（或上一次）的跑道
  let mapAt = $state(null); // 關卡地圖停在哪
  let result = $state(null);
  let onlineMenu = $state(false);
  let canvas;
  let engine = $state();

  // 開遊戲時先把目前風格的圖都載好（最多等 15 秒）；之後換風格就在背景載
  let booting = $state(true);
  let waiting = $state(false);
  const percent = $derived(loading.total ? Math.round((loading.done / loading.total) * 100) : 0);
  preloadStyleWithin(artStyle.id, 15000).then(() => (booting = false));
  $effect(() => {
    if (!booting) preloadStyle(artStyle.id);
  });

  async function ensureArt() {
    let done = false;
    const all = preloadStyle(artStyle.id).then(() => (done = true));
    await Promise.resolve();
    if (done) return;
    waiting = true;
    await Promise.race([all, new Promise((resolve) => setTimeout(resolve, 10000))]);
    waiting = false;
  }

  // 魔王出現時換緊張的曲子
  let bossFight = $state(false);
  // 連線：房主送來的比賽狀態（只記會改變畫面的部分，影格本身交給 engine）
  let racePhase = $state(null); // countdown | racing | results
  let raceResults = $state(null);
  let racePlan = $state(null);
  let raceSeed = null;

  onMount(() => {
    engine = createEngine(canvas, {
      onEnd,
      onEvent: (e) => {
        if (e.type === 'boss') bossFight = true;
        else if (e.type === 'bossdown') bossFight = false;
      },
    });
    window.__vr = engine;
    const off = onFrame(onRaceFrame);
    // 單機遊戲中切到背景、或手機轉成直的：自動暫停
    const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
    const autoPause = () => {
      if ((document.hidden || portrait.matches) && screen === 'play' && !roomPhase) pause();
    };
    document.addEventListener('visibilitychange', autoPause);
    portrait.addEventListener('change', autoPause);
    const onHash = () => {
      const code = roomCodeOf(location.hash);
      if (!code) return;
      history.replaceState(null, '', location.pathname + location.search);
      if (net.room || net.status !== 'idle' || ['play', 'pause'].includes(screen)) return;
      joinCode = code;
      screen = 'join';
    };
    addEventListener('hashchange', onHash);
    return () => {
      engine.destroy();
      off();
      document.removeEventListener('visibilitychange', autoPause);
      removeEventListener('hashchange', onHash);
      portrait.removeEventListener('change', autoPause);
    };
  });

  // ───────────── 連線 ─────────────

  const roomPhase = $derived(net.room?.phase ?? null);
  let prevPhase = null;
  $effect(() => {
    const phase = roomPhase;
    if (!engine || phase === prevPhase) return;
    if (phase !== 'playing') {
      engine.stop();
      racePhase = null;
      raceResults = null;
      raceSeed = null;
      onlineMenu = false;
      if (phase === null && prevPhase !== null) screen = 'title';
    }
    prevPhase = phase;
  });

  function onRaceFrame(s) {
    if (!engine || roomPhase !== 'playing') return;
    // 新的一場：照房主的種子開自己的跑道（比賽開始後才進來、或沒座位就觀戰）
    if (s.seed !== raceSeed) {
      raceSeed = s.seed;
      raceResults = null;
      racePlan = s.plan;
      bossFight = false;
      const mine = s.runners.find((r) => r.seat === net.seat);
      if (mine && s.t < COUNTDOWN + 30) {
        ensureArt();
        engine.startOnline({ plan: s.plan, seed: s.seed, character: mine.character, seat: net.seat, t: s.t });
      } else engine.spectate();
    }
    if (s.phase !== racePhase) {
      racePhase = s.phase;
      if (s.phase === 'results') {
        raceResults = s.results;
        const first = s.results?.[0];
        playJingle(first?.seat === net.seat ? 'win' : 'lose');
      }
    }
  }

  const view = $derived(roomPhase ? `online-${roomPhase}` : screen);

  // 背景音樂：依畫面切換
  const scene = $derived.by(() => {
    if (view === 'online-lobby') return 'menu';
    if (view === 'online-playing') return raceResults ? 'menu' : bossFight ? 'tension' : 'match';
    if (screen === 'title') return 'title';
    if (screen === 'play' || screen === 'pause') return bossFight ? 'tension' : 'match';
    return 'menu';
  });
  $effect(() => setBgm(scene));

  // ───────────── 單機 ─────────────

  function openMode(m) {
    mode = m;
    if (m === 'watch') {
      const pool = CHARACTERS.filter((c) => !c.hidden);
      return start({ kind: 'endless' }, pool[Math.floor(Math.random() * pool.length)].id, true);
    }
    screen = 'select';
  }

  function picked(id) {
    character = id;
    saveCharacter(id);
    if (mode === 'level') screen = 'map';
    else start({ kind: 'endless' }, id);
  }

  let demo = $state(false);
  async function start(p, who = character, isDemo = false) {
    await ensureArt();
    plan = p;
    demo = isDemo;
    result = null;
    bossFight = false;
    await engine.startLocal({ plan: p, character: who, demo: isDemo });
    screen = 'play';
  }

  function toTitle() {
    engine.stop();
    screen = 'title';
  }

  // 單機跑完：goal（過終點）或 out（倒下）
  function onEnd(kind, v) {
    if (net.room) return;
    const c = getCharacter(v.character);
    const goal = kind === 'goal';
    let unlocked = false;
    let record = false;
    let next = null;
    if (v.plan.kind === 'level' && goal && !demo) {
      record = recordStars(v.plan.world, v.plan.stage, v.stars);
      // 打倒第一大關的魔王：隱藏角色加入
      if (v.plan.world === 0 && v.plan.stage === STAGE_COUNT - 1) unlocked = unlockHidden();
      const i = v.plan.world * STAGE_COUNT + v.plan.stage + 1;
      if (i < WORLD_COUNT * STAGE_COUNT) next = { kind: 'level', world: Math.floor(i / STAGE_COUNT), stage: i % STAGE_COUNT };
    }
    if (v.plan.kind === 'endless' && !demo) record = recordEndless(v.score, v.meters);
    const w = v.plan.kind === 'level' ? WORLDS[v.plan.world] : null;
    result = {
      kind,
      endless: v.plan.kind === 'endless',
      title: v.plan.kind === 'endless' ? t('跑完了！') : goal ? t('過關！') : t('倒下了……'),
      stage: w ? `${stageLabel(v.plan.world, v.plan.stage)} ${t(w.subs[v.plan.stage])}` : t('無盡模式'),
      character: c,
      stars: v.stars,
      coins: v.coins,
      coinTotal: v.coin_total,
      score: v.score,
      meters: v.meters,
      hits: v.hits,
      best: endlessBest(),
      record,
      next,
      line: pickLine(c, goal ? 'win' : 'lose'),
      unlocked,
    };
    playJingle(goal || v.plan.kind === 'endless' ? 'win' : 'lose');
    screen = 'result';
  }

  // 正在遊戲中（方向鍵、手把拿來操作角色，不做選單操作）
  const inGame = $derived((screen === 'play' && !roomPhase) || (view === 'online-playing' && !raceResults && !onlineMenu));

  const showTouch = $derived(inGame && ui.input === 'touch' && !demo && (view !== 'online-playing' || net.seat != null));

  let selectScreen = $state();

  // Esc／手把 B
  function back() {
    if (view === 'online-playing') {
      if (onlineMenu) onlineMenu = false;
      return;
    }
    if (view === 'online-lobby') return; // 離開房間要按按鈕，避免誤觸
    if (screen === 'select') selectScreen?.goBack();
    else if (screen === 'map') screen = 'select';
    else if (screen === 'pause') resume();
    else if (['solo', 'help', 'host', 'join'].includes(screen)) screen = 'title';
  }

  // Esc／P／手把 Start
  function pause() {
    if (view === 'online-playing') onlineMenu = true;
    else if (screen === 'play') {
      engine.pause();
      screen = 'pause';
    }
  }

  function resume() {
    engine.resume();
    screen = 'play';
  }

  function onkeydown(e) {
    if (e.repeat || e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'KeyM') toggleMute();
  }

  const raceTitle = $derived.by(() => {
    if (!racePlan) return '';
    if (racePlan.kind === 'endless') return t('無盡模式');
    return `${stageLabel(racePlan.world, racePlan.stage)} ${t(WORLDS[racePlan.world].subs[racePlan.stage])}`;
  });
  const fmtTime = (f) => `${Math.floor(f / 3600)}:${String(Math.floor((f / 60) % 60)).padStart(2, '0')}.${String(Math.floor(((f % 60) / 60) * 100)).padStart(2, '0')}`;
</script>

<svelte:window {onkeydown} />
<Controls {inGame} onback={back} onpause={pause} />

{#snippet starRow(n)}
  <div class="stars">
    {#each [0, 1, 2] as i (i)}<span class:on={i < n}>★</span>{/each}
  </div>
{/snippet}

<div id="stage">
  <canvas bind:this={canvas}></canvas>

  {#if view === 'online-lobby'}
    <Lobby />
  {:else if view === 'online-playing'}
    {#if raceResults}
      <Dialog title={t('比賽結果')} subtitle={raceTitle} wide>
        <ol class="ranking">
          {#each raceResults as r (r.seat)}
            {@const c = getCharacter(r.character)}
            <li class:me={r.seat === net.seat} style="--c: {SLOT_COLORS[r.seat % SLOT_COLORS.length]}">
              <span class="rank">{r.rank}</span>
              <img src={r.rank === 1 ? c.portraits.win : r.out ? c.portraits.sad : c.portraits.normal} alt="" />
              <b>{r.seat + 1}P {displayName(r.name)}</b>
              <span class="time">
                {#if r.fin != null && racePlan?.kind !== 'endless'}{fmtTime(r.fin)}{:else if r.out}{t('倒下')}・{r.meters}m{:else}{r.meters}m{/if}
              </span>
              <span class="score">{String(r.score).padStart(7, '0')}</span>
            </li>
          {/each}
        </ol>
        {#if net.isHost}
          <Menu
            horizontal
            items={[
              { label: t('再跑一次'), action: () => hostCmd('start'), primary: true },
              { label: t('回大廳'), action: () => hostCmd('reset') },
            ]}
          />
        {:else}
          <div class="hint-bar">{t('等待房主決定下一步…')}</div>
        {/if}
      </Dialog>
    {:else if onlineMenu}
      <Dialog title={t('選單')} subtitle={t('連線遊戲不會暫停喔！')}>
        <Menu
          items={[
            { label: t('回到比賽'), action: () => (onlineMenu = false) },
            { label: t('設定'), action: openSettings },
            ...(net.isHost ? [{ label: t('結束比賽、回大廳'), action: () => hostCmd('reset') }] : []),
            { label: t('離開房間'), action: leave },
          ]}
        />
      </Dialog>
    {/if}
    {#if net.status === 'reconnecting'}
      <div class="net-banner">{t('連線中斷，重新連線中…')}</div>
    {/if}
  {:else if screen === 'title'}
    <TitleScreen
      items={[
        { label: t('單機遊玩'), action: () => (screen = 'solo') },
        { label: t('開設房間'), action: () => (screen = 'host') },
        { label: t('加入房間'), action: () => (screen = 'join') },
        { label: t('操作說明'), action: () => (screen = 'help') },
        { label: t('設定'), action: openSettings },
      ]}
    />
  {:else if screen === 'solo'}
    <SoloScreen onpick={openMode} onback={() => (screen = 'title')} />
  {:else if screen === 'host' || screen === 'join'}
    {#key joinCode}
      <RoomEntry
        page={screen}
        code={screen === 'join' ? joinCode : ''}
        onback={() => {
          joinCode = '';
          screen = 'title';
        }}
      />
    {/key}
  {:else if screen === 'help'}
    <HelpScreen onback={() => (screen = 'title')} />
  {:else if screen === 'select'}
    <SelectScreen bind:this={selectScreen} {mode} initial={character} onstart={picked} onback={() => (screen = 'solo')} />
  {:else if screen === 'map'}
    <StageMap
      {character}
      at={mapAt}
      onpick={(w, s) => {
        mapAt = { world: w, stage: s };
        start({ kind: 'level', world: w, stage: s });
      }}
      onback={() => (screen = 'select')}
    />
  {:else if screen === 'pause'}
    <Dialog title={t('暫停')}>
      <Menu
        items={[
          { label: t('繼續'), action: resume },
          { label: t('從頭開始'), action: () => start(plan, character, demo) },
          ...(plan?.kind === 'level' ? [{ label: t('關卡地圖'), action: () => { engine.stop(); screen = 'map'; } }] : []),
          { label: t('設定'), action: openSettings },
          { label: t('回標題'), action: toTitle },
        ]}
      />
    </Dialog>
  {:else if screen === 'result' && result}
    <Dialog title={result.title} subtitle={result.stage} wide>
      <div class="result">
        <div class="result-pic"><img src={result.kind === 'goal' || result.endless ? result.character.portraits.win : result.character.portraits.sad} alt="" /></div>
        <div class="result-info">
          {#if !result.endless}
            {#if result.kind === 'goal'}{@render starRow(result.stars)}{/if}
            <p>{t('金幣')} <b>{result.coins}</b> / {result.coinTotal}　{t('受傷')} <b>{result.hits}</b></p>
          {:else}
            <p class="big">{result.meters} m</p>
            <p>{t('最高紀錄')} {result.best.meters} m・{String(result.best.score).padStart(7, '0')}</p>
          {/if}
          <p class="score">{t('分數')} <b>{String(result.score).padStart(7, '0')}</b></p>
          {#if result.record && !demo}<p class="record">{result.endless ? t('新紀錄！') : t('星星更新了！')}</p>{/if}
          <p class="result-line">「{result.line}」</p>
          {#if result.unlocked}<p class="result-unlock">{t('隱藏角色「阿翼」加入了！')}</p>{/if}
        </div>
      </div>
      <Menu
        horizontal
        items={[
          ...(result.next && result.kind === 'goal' ? [{ label: t('下一關'), action: () => ((mapAt = result.next), start(result.next)), primary: true }] : []),
          { label: result.kind === 'goal' && !result.endless ? t('再跑一次') : t('再挑戰'), action: () => start(plan, demo ? result.character.id : character, demo), primary: !(result.next && result.kind === 'goal') },
          ...(plan?.kind === 'level' ? [{ label: t('關卡地圖'), action: () => (screen = 'map') }] : []),
          { label: t('回標題'), action: toTitle },
        ]}
      />
    </Dialog>
  {/if}

  {#if showTouch}
    <TouchControls slots={[0]} onpause={pause} />
  {/if}

  <div class="toasts">
    {#each net.toasts as t (t.id)}
      <div class="toast" class:ok={t.kind === 'ok'}>{t.message}</div>
    {/each}
  </div>
  <SettingsDialog />
  {#if booting || waiting}
    <div class="loading" role="status">
      <div class="loading-logo"><Logo size="big" /></div>
      <div class="bar"><i style:width="{percent}%"></i></div>
      <p>{t('載入中…')} {percent}%</p>
    </div>
  {/if}
  <div class="rotate-hint">{t('請把裝置轉成橫向 ↻')}</div>
</div>

<style>
  .loading {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3cqh;
    background: var(--navy-deep);
    color: var(--cream);
  }
  .loading .bar {
    width: 40cqw;
    height: 2.4cqh;
    border: 0.4cqh solid var(--cream);
    padding: 0.4cqh;
  }
  .loading .bar i {
    display: block;
    height: 100%;
    background: var(--gold);
    transition: width 0.15s;
  }
  .loading p {
    margin: 0;
    font-weight: 900;
    font-size: 2.6cqh;
    letter-spacing: 0.2em;
  }
  .loading-logo {
    width: 50cqw;
    display: flex;
    justify-content: center;
  }
  .result {
    display: flex;
    gap: 3cqw;
    align-items: center;
    justify-content: center;
    margin-bottom: 2cqh;
  }
  .result-pic {
    width: 26cqh;
    height: 26cqh;
    border: 0.5cqh solid var(--navy);
    outline: 0.35cqh solid var(--gold);
    outline-offset: -1cqh;
    background: linear-gradient(#ffe9a8, #ffb3c8);
    overflow: hidden;
    flex: none;
  }
  .result-pic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .result-info {
    display: flex;
    flex-direction: column;
    gap: 1cqh;
    font-weight: 800;
    font-size: 2.6cqh;
    min-width: 36cqw;
  }
  .result-info p {
    margin: 0;
  }
  .result-info .big {
    font-size: 7cqh;
    font-weight: 900;
    color: var(--accent);
    line-height: 1;
  }
  .result-info .score b {
    color: var(--sea);
    letter-spacing: 0.08em;
  }
  .record {
    color: var(--accent);
    font-weight: 900;
  }
  .result-line {
    font-size: 2.8cqh;
  }
  .result-unlock {
    color: var(--accent);
    font-weight: 900;
  }
  .stars {
    display: flex;
    gap: 1cqw;
    font-size: 7cqh;
    line-height: 1;
  }
  .stars span {
    color: rgba(0, 0, 0, 0.18);
    -webkit-text-stroke: 0.25cqh var(--navy);
  }
  .stars span.on {
    color: var(--gold);
  }
  .ranking {
    list-style: none;
    margin: 0 0 2cqh;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6cqh;
    min-width: 60cqw;
  }
  .ranking li {
    display: grid;
    grid-template-columns: 5cqh 6cqh 1fr auto auto;
    align-items: center;
    gap: 1.2cqw;
    padding: 0.4cqh 1cqw;
    border-left: 0.8cqh solid var(--c);
    background: rgba(255, 255, 255, 0.5);
    font-weight: 900;
    font-size: 2.4cqh;
  }
  .ranking li.me {
    background: rgba(233, 184, 94, 0.45);
  }
  .ranking .rank {
    font-size: 3.6cqh;
    text-align: center;
  }
  .ranking img {
    width: 6cqh;
    height: 6cqh;
    object-fit: cover;
    border-radius: 50%;
    background: #ffe9a8;
  }
  .ranking .score {
    color: var(--sea);
    letter-spacing: 0.06em;
  }
</style>
