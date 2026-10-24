// 音樂與音效的總管：設定（音量、靜音）、依畫面切換 BGM、短曲、比賽與介面音效。
// 架構跟 TaiwanMahjong 的 src/lib/audio/sound.svelte.js 一樣，音效換成清版動作用的。
import { audioContext, buses, fmNote, ssgNote, drum, noiseHit, setBusVolume, PATCHES } from './synth.js';
import { Player, SONGS } from './music.js';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 存不了就算了
  }
}

export const soundSettings = $state({
  bgm: load('vr_bgm_volume', 0.5),
  sfx: load('vr_sfx_volume', 0.7),
  muted: load('vr_muted', false),
});

function applyVolumes() {
  if (!audioContext()) return;
  const m = soundSettings.muted ? 0 : 1;
  setBusVolume('bgm', soundSettings.bgm * m);
  setBusVolume('sfx', soundSettings.sfx * m);
}

export function setVolume(which, v) {
  soundSettings[which] = v;
  save(which === 'bgm' ? 'vr_bgm_volume' : 'vr_sfx_volume', v);
  applyVolumes();
}

export function toggleMute() {
  soundSettings.muted = !soundSettings.muted;
  save('vr_muted', soundSettings.muted);
  applyVolumes();
  return soundSettings.muted;
}

// 瀏覽器規定要使用者先互動過才能出聲：第一次點擊或按鍵時啟動
let unlocked = false;
function unlock() {
  const ctx = audioContext();
  if (!ctx) return;
  applyVolumes();
  const go = () => {
    if (unlocked) return;
    unlocked = true;
    if (wantedBgm && !jingle.playing) startBgm(wantedBgm);
  };
  if (ctx.state === 'suspended') ctx.resume().then(go);
  else go();
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}
const ready = () => unlocked && audioContext()?.state === 'running';

// ───────── BGM ─────────
const bgm = new Player();
const jingle = new Player();
let wantedBgm = null;
let currentBgm = null;

function startBgm(name) {
  currentBgm = name;
  if (!name) return bgm.stop(0.8);
  bgm.play(SONGS[name]);
}

/** 換背景音樂：title | menu | match | tension | null（同一首不會重播） */
export function setBgm(name) {
  wantedBgm = name;
  if (!ready() || jingle.playing || name === currentBgm) return;
  startBgm(name);
}

/** 短曲（贏、輸）：先停 BGM，播完再接回想要的 BGM */
export function playJingle(name) {
  if (!ready() || !SONGS[name]) return;
  bgm.stop(0.25);
  currentBgm = null;
  jingle.play(SONGS[name], {
    onEnd: () => {
      if (wantedBgm) startBgm(wantedBgm);
    },
  });
}

// ───────── 音效 ─────────
// 打到球的「啪」：短促、帶一點木頭感的 FM
PATCHES.slap = {
  level: 0.32,
  env: { a: 0.001, d: 0.07, s: 0, r: 0.03 },
  mods: [{ ratio: 1.7, index: 2.4, env: { a: 0.001, d: 0.04, s: 0, r: 0.02 } }],
};
// 球網的「咚」
PATCHES.thud = {
  level: 0.34,
  env: { a: 0.002, d: 0.18, s: 0, r: 0.06 },
  mods: [{ ratio: 0.5, index: 3, env: { a: 0.002, d: 0.1, s: 0, r: 0.05 } }],
};

const now = () => audioContext().currentTime + 0.01;
const out = () => buses.sfx;

export const sfx = {
  // ── 比賽 ──
  /** 接球、托球 */
  hit() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'slap', 76, t, 0.05, 1);
    noiseHit(out(), t, { type: 'bandpass', freq: 2400, q: 1, vol: 0.28, decay: 0.04 });
  },
  /** 扣殺：重擊＋銅管 */
  spike() {
    if (!ready()) return;
    const t = now();
    drum(out(), 'k', t, 1.1);
    noiseHit(out(), t, { type: 'highpass', freq: 3000, q: 0.7, vol: 0.4, decay: 0.12 });
    for (const m of [55, 62, 67]) fmNote(out(), 'brass', m, t, 0.14, 0.9);
  },
  /** 球撞網 */
  net() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'thud', 43, t, 0.12, 1);
    noiseHit(out(), t, { type: 'lowpass', freq: 900, q: 0.7, vol: 0.25, decay: 0.12 });
  },
  /** 球撞邊界 */
  wall() {
    if (!ready()) return;
    fmNote(out(), 'slap', 84, now(), 0.03, 0.5);
  },
  /** 球落地：沙地的悶響 */
  ground() {
    if (!ready()) return;
    const t = now();
    drum(out(), 'k', t, 0.9);
    noiseHit(out(), t, { type: 'lowpass', freq: 700, q: 0.6, vol: 0.5, decay: 0.3 });
  },
  /** 落地 */
  land() {
    if (!ready()) return;
    noiseHit(out(), now(), { type: 'lowpass', freq: 600, q: 0.6, vol: 0.12, decay: 0.06 });
  },
  /** 飛撲：沙地滑行的「沙──」 */
  dive() {
    if (!ready()) return;
    noiseHit(out(), now(), { type: 'bandpass', freq: 1400, q: 0.6, vol: 0.3, decay: 0.28 });
  },
  /** 哨音（發球） */
  whistle() {
    if (!ready()) return;
    const t = now();
    ssgNote(out(), 98, t, 0.07, 1.4);
    ssgNote(out(), 98, t + 0.12, 0.2, 1.4);
  },
  /** 得分 */
  score() {
    if (!ready()) return;
    const t = now();
    [79, 83, 86, 91].forEach((m, i) => fmNote(out(), 'bell', m, t + i * 0.06, 0.2, 0.8));
  },

  // ── 清版動作 ──
  /** 揮空 */
  swing() {
    if (!ready()) return;
    noiseHit(out(), now(), { type: 'bandpass', freq: 2600, q: 1.2, vol: 0.12, decay: 0.05 });
  },
  /** 一般打中 */
  punch() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'thud', 50, t, 0.06, 0.9);
    noiseHit(out(), t, { type: 'bandpass', freq: 1800, q: 0.9, vol: 0.32, decay: 0.06 });
  },
  /** 重擊（踢倒、丟出去） */
  heavy() {
    if (!ready()) return;
    const t = now();
    drum(out(), 'k', t, 1.1);
    fmNote(out(), 'thud', 38, t, 0.14, 1);
    noiseHit(out(), t, { type: 'lowpass', freq: 1400, q: 0.7, vol: 0.4, decay: 0.14 });
  },
  /** 自己被打 */
  hurt() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'slap', 58, t, 0.06, 0.9);
    ssgNote(out(), 60, t + 0.02, 0.06, 1.2);
  },
  /** 打倒敵人 */
  ko() {
    if (!ready()) return;
    const t = now();
    drum(out(), 'k', t, 1);
    [67, 62, 55].forEach((m, i) => ssgNote(out(), m, t + i * 0.05, 0.05, 1));
  },
  /** 必殺技 */
  special() {
    if (!ready()) return;
    const t = now();
    noiseHit(out(), t, { type: 'highpass', freq: 2400, q: 0.7, vol: 0.4, decay: 0.3 });
    for (const m of [55, 62, 67, 74]) fmNote(out(), 'brass', m, t, 0.2, 0.8);
  },
  /** 撿到道具 */
  pickup() {
    if (!ready()) return;
    const t = now();
    [79, 84, 88, 91].forEach((m, i) => fmNote(out(), 'bell', m, t + i * 0.05, 0.14, 0.8));
  },
  /** 打破箱子 */
  crack() {
    if (!ready()) return;
    const t = now();
    noiseHit(out(), t, { type: 'bandpass', freq: 900, q: 0.6, vol: 0.4, decay: 0.18 });
    fmNote(out(), 'thud', 45, t, 0.1, 0.8);
  },
  /** 魔王砸地 */
  quake() {
    if (!ready()) return;
    const t = now();
    drum(out(), 'k', t, 1.3);
    noiseHit(out(), t, { type: 'lowpass', freq: 500, q: 0.6, vol: 0.6, decay: 0.5 });
  },
  /** 敵人丟東西 */
  shoot() {
    if (!ready()) return;
    ssgNote(out(), 76, now(), 0.05, 0.8);
  },
  /** GO → */
  go() {
    if (!ready()) return;
    const t = now();
    [72, 76, 79].forEach((m, i) => ssgNote(out(), m, t + i * 0.07, 0.07, 1.4));
  },
  /** 魔王登場 */
  alarm() {
    if (!ready()) return;
    const t = now();
    for (let i = 0; i < 3; i++) {
      fmNote(out(), 'brass', 50, t + i * 0.22, 0.16, 1);
      fmNote(out(), 'brass', 49, t + i * 0.22 + 0.1, 0.1, 1);
    }
  },

  // ── 跑酷 ──
  /** 金幣：兩個很快的高音鈴（經典的「叮－叮」） */
  coin() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'bell', 95, t, 0.05, 0.5);
    fmNote(out(), 'bell', 100, t + 0.045, 0.16, 0.5);
  },
  /** 起跳：方波往上掃 */
  jump() {
    if (!ready()) return;
    const t = now();
    [67, 71, 74, 79].forEach((m, i) => ssgNote(out(), m, t + i * 0.018, 0.022, 0.55));
  },
  /** 二段跳：更高、更亮，加一點鈴聲 */
  double() {
    if (!ready()) return;
    const t = now();
    [74, 79, 83, 86].forEach((m, i) => ssgNote(out(), m, t + i * 0.016, 0.02, 0.5));
    fmNote(out(), 'bell', 91, t + 0.06, 0.1, 0.35);
  },
  /** 滑行：鞋底摩擦地面的「咻──」 */
  slide() {
    if (!ready()) return;
    noiseHit(out(), now(), { type: 'bandpass', freq: 2200, q: 0.8, vol: 0.22, decay: 0.22 });
  },
  /** 衝刺：風聲＋低音銅管一下 */
  dash() {
    if (!ready()) return;
    const t = now();
    noiseHit(out(), t, { type: 'highpass', freq: 1800, q: 0.6, vol: 0.28, decay: 0.16 });
    fmNote(out(), 'brass', 55, t, 0.08, 0.6);
  },
  /** 空中追擊：鎖定的「嗶」＋往上衝 */
  homing() {
    if (!ready()) return;
    const t = now();
    ssgNote(out(), 88, t, 0.03, 0.8);
    [76, 81, 86, 91].forEach((m, i) => ssgNote(out(), m, t + 0.04 + i * 0.015, 0.02, 0.5));
    noiseHit(out(), t + 0.03, { type: 'highpass', freq: 2600, q: 0.6, vol: 0.18, decay: 0.12 });
  },
  /** 踩扁／撞飛敵人：「啵」＋往下的方波 */
  stomp() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'thud', 52, t, 0.07, 0.9);
    [79, 74, 67].forEach((m, i) => ssgNote(out(), m, t + i * 0.03, 0.03, 0.7));
  },
  /** 彈簧：「啵嚶～」往上的琶音 */
  spring() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'slap', 60, t, 0.05, 0.8);
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => ssgNote(out(), m, t + 0.02 + i * 0.02, 0.025, 0.55));
  },
  /** 護盾（拿到、破掉、長回來）：鈴聲閃一下 */
  shield() {
    if (!ready()) return;
    const t = now();
    [84, 88, 91].forEach((m, i) => fmNote(out(), 'bell', m, t + i * 0.04, 0.12, 0.45));
  },
  /** 掉進坑：往下滑的方波 */
  fall() {
    if (!ready()) return;
    const t = now();
    [79, 76, 72, 69, 65, 62, 57].forEach((m, i) => ssgNote(out(), m, t + i * 0.045, 0.05, 0.7));
  },
  /** 倒數的「嗶」（3、2、1） */
  count() {
    if (!ready()) return;
    ssgNote(out(), 81, now(), 0.09, 1.2);
  },
  /** 過終點：短短的上行和弦 */
  goal() {
    if (!ready()) return;
    const t = now();
    [72, 76, 79, 84].forEach((m, i) => fmNote(out(), 'brass', m, t + i * 0.07, 0.18, 0.7));
  },
  /** 魔王被打倒：連續爆炸 */
  bossdown() {
    if (!ready()) return;
    const t = now();
    for (let i = 0; i < 4; i++) {
      drum(out(), 'k', t + i * 0.12, 1.1);
      noiseHit(out(), t + i * 0.12, { type: 'lowpass', freq: 900, q: 0.6, vol: 0.45, decay: 0.2 });
    }
  },

  // ── 介面（PC-98 遊戲選單的感覺：游標移動嗶一聲、確定往上、取消往下） ──
  cursor() {
    if (!ready()) return;
    ssgNote(out(), 88, now(), 0.022, 1.2);
  },
  confirm() {
    if (!ready()) return;
    const t = now();
    ssgNote(out(), 84, t, 0.045, 2);
    ssgNote(out(), 91, t + 0.055, 0.07, 2);
  },
  back() {
    if (!ready()) return;
    const t = now();
    ssgNote(out(), 86, t, 0.045, 1.8);
    ssgNote(out(), 79, t + 0.055, 0.07, 1.8);
  },
  pick() {
    if (!ready()) return;
    const t = now();
    fmNote(out(), 'bell', 84, t, 0.12, 0.8);
    fmNote(out(), 'bell', 91, t + 0.07, 0.2, 0.8);
  },
  deny() {
    if (!ready()) return;
    const t = now();
    ssgNote(out(), 47, t, 0.06, 2);
    ssgNote(out(), 47, t + 0.09, 0.06, 2);
  },
};
