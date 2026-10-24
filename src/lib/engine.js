// 遊戲主迴圈：固定 60 fps 讀輸入、推進自己的跑道，每個畫面影格繪圖。
// 跑道與跑者在 Rust（crates/runner-core），網頁裡是 WebAssembly（crates/runner-wasm 的 LocalRun）。
//   單機：關卡模式、無盡模式、電腦示範
//   連線：自己的跑道一樣在自己的電腦上跑（同一個種子），每 4 格把進度回報給房主；
//         別人的進度跟著房主的比賽影格送來，畫在遠景裡（engine 只負責把它交給畫面）
// 跟 Svelte 無關，UI 透過回傳的方法控制它。

import init, { LocalRun } from './local/pkg/runner_wasm.js';
import * as input from './game/input.js';
import * as render from './game/render.js';
import { play } from './game/audio.js';
import { COUNTDOWN } from './game/constants.js';
import { onFrame, sendProgress } from './net.svelte.js';
import { ui } from './ui.svelte.js';

const FRAME = 1000 / 60;
// 過終點／倒下後先停一下才跳結果
const END_DELAY = 100;
// 連線時每幾格回報一次進度
const REPORT_EVERY = 4;

// 跑者事件 → 音效（src/lib/audio/sound.svelte.js 的 sfx）
const EVENT_SOUND = {
  go: 'go',
  jump: 'jump',
  double: 'jump',
  slide: 'land',
  dash: 'swing',
  homing: 'swing',
  coin: 'pickup',
  kill: 'punch',
  bump: 'heavy',
  break: 'crack',
  item: 'pickup',
  spring: 'jump',
  hurt: 'hurt',
  shield: 'cursor',
  fall: 'ko',
  shot: 'shoot',
  boss: 'alarm',
  bosshit: 'heavy',
  bossdown: 'ko',
  goal: 'go',
};

const wasmReady = init();

/**
 * onEnd(kind, view)：kind = goal（過終點）| out（倒下）；單機才有，連線的結果看房主送來的名次
 * onEvent(event, view)：每個跑者事件（台詞、BGM 切換用）
 */
export function createEngine(canvas, { onEnd = () => {}, onEvent = () => {} }) {
  render.resize(canvas);

  // idle：在選單（不跑也不出聲）；local：單機；paused；online：連線比賽；spectate：連線觀戰
  let state = 'idle';
  let run = null; // LocalRun
  let view = null; // 自己跑道的畫面資料
  let race = null; // 連線：房主送來的比賽影格（大家的進度）
  let you = null; // 連線：自己的座位
  let endTimer = 0;
  let ended = false;
  let frameNo = 0;
  let ready = false;
  wasmReady.then(() => (ready = true));

  function handle(v) {
    for (const e of v.events) {
      if (EVENT_SOUND[e.type]) play(EVENT_SOUND[e.type]);
      onEvent(e, v);
    }
    render.handleEvents(v);
  }

  const offFrame = onFrame((s) => {
    if (state !== 'online' && state !== 'spectate') return;
    race = s;
    // 倒數中：跟房主的時間對齊（分頁卡了一下、或比較晚收到開始的訊息，都不會比別人晚起跑）
    if (state === 'online' && run && view?.phase === 'ready') {
      const left = COUNTDOWN - s.t;
      if (view.ready > left + 3) run.setReady(Math.max(1, left));
    }
  });

  function simulate() {
    if (!ready || !run) return;
    if (state !== 'local' && state !== 'online') return;
    const i = input.read(0, { keymaps: input.SOLO_KEYMAPS, pads: 'all', touch: 0 });
    run.step(input.toBits(i));
    view = JSON.parse(run.state());
    handle(view);
    render.tick();
    frameNo++;
    if (state === 'online' && frameNo % REPORT_EVERY === 0) sendProgress(run.progress());
    if (run.done() && !ended && ++endTimer >= END_DELAY) {
      ended = true;
      if (state === 'local') onEnd(view.phase === 'goal' ? 'goal' : 'out', view);
    }
  }

  let last = performance.now();
  let acc = 0;
  let raf = 0;
  function loop(now) {
    acc += Math.min(100, now - last);
    last = now;
    let steps = 0;
    while (acc >= FRAME) {
      simulate();
      acc -= FRAME;
      steps++;
    }
    // 沒跑模擬的影格（高更新率螢幕）不要清掉「剛按下」，否則會吃掉按鍵
    if (steps > 0) input.endFrame();
    if (state !== 'idle') render.draw(canvas, view, { race, you, spectate: state === 'spectate', keys: ui.input !== 'touch' && state !== 'spectate' });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function begin(newRun, newState) {
    run?.free();
    run = newRun;
    view = JSON.parse(run.state());
    endTimer = 0;
    ended = false;
    frameNo = 0;
    render.resetEffects();
    state = newState;
  }

  return {
    /**
     * 單機：plan = { kind: 'level', world, stage } | { kind: 'endless' }；demo = 交給電腦跑
     */
    async startLocal({ plan, character, demo = false }) {
      await wasmReady;
      race = null;
      you = null;
      const r = new LocalRun(JSON.stringify(plan), character, '');
      if (demo) r.setAi('hard');
      begin(r, 'local');
    },
    /** 連線比賽：照房主送來的種子開自己的跑道；倒數照房主的時間對齊 */
    async startOnline({ plan, seed, character, seat, t }) {
      await wasmReady;
      you = seat;
      const r = new LocalRun(JSON.stringify(plan), character, String(seed));
      r.setReady(Math.max(1, COUNTDOWN - t));
      begin(r, 'online');
    },
    /** 連線觀戰（沒有座位、或比賽開始後才進來）：只看大家的進度 */
    spectate() {
      run?.free();
      run = null;
      view = null;
      you = null;
      render.resetEffects();
      state = 'spectate';
    },
    pause() {
      if (state === 'local') state = 'paused';
    },
    resume() {
      if (state === 'paused') state = 'local';
    },
    // 回到選單：停掉遊戲（不再出聲）
    stop() {
      run?.free();
      run = null;
      view = null;
      race = null;
      render.resetEffects();
      state = 'idle';
    },
    destroy() {
      cancelAnimationFrame(raf);
      offFrame();
    },
    get view() {
      return view;
    },
    get state() {
      return state;
    },
  };
}
