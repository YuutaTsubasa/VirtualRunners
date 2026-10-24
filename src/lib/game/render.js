// 畫面：背景、跑道、金幣、機關、敵人、魔王、跑者、遠景裡的其他玩家、特效、HUD。只讀取狀態，不改它。
//
// 狀態格式見 crates/runner-core/src/run.rs 的 Run::view()。座標直接是畫面座標（960×540），x 減掉鏡頭 cam。
// 角色、敵人、魔王的動作圖與背景沿用虛擬闖天下；尖刺、橫桿、冰柱、火柱、彈簧、金幣、終點還沒有圖，先用程式畫。
//
// 連線時別人的進度（房主每秒送 15 次）畫在「遠景」那一層地板上：縮小、半透明、在背後跑，
// 看得出誰領先，但不會擋到自己的路。

import { W, H, GROUND, SCREEN_X, SLOT_COLORS, COUNTDOWN } from './constants.js';
import { getCharacter } from './characters.js';
import { WORLDS, stageLabel, backdropOf } from './stages.js';
import { drawScenery, drawAmbient } from './scenery.js';
import SHEETS from './sheets.json' with { type: 'json' };
import { asset, currentConfig } from '../art-style.svelte.js';
import { loadImage } from '../preload.svelte.js';
import { t, displayName } from '../i18n.svelte.js';

// 內部解析度：一般風格 2 倍（1920×1080）比較銳利；像素風格用較低的倍數再放大（見 style-assets.js）
let SCALE = 2;
let cfg = currentConfig();

const ART_PATHS = {
  spark: 'effects/hit-spark.webp',
  dust: 'effects/sand-puff.webp',
  burst: 'effects/score-burst.webp',
};
const art = (key) => loadImage(asset(ART_PATHS[key]));

// HUD 的字、框的顏色：跟介面用同一組 CSS 變數
const pal = { text: '#f5efdf', ink: '#202329', flash: '#e9b85e', paper: '#fffbf1', cream: '#f5efdf', accent: '#d94b3d', teal: '#287f78', hp: '#ff5a6e' };
let palStyle = null;
function updatePalette() {
  const style = document.documentElement.dataset.style ?? 'anime90';
  if (style === palStyle) return;
  palStyle = style;
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  pal.text = v('--on-dark', '#fff');
  pal.ink = v('--navy', '#202329');
  pal.flash = v('--gold', '#e9b85e');
  pal.paper = v('--paper-white', '#fff');
  pal.accent = v('--accent', '#d94b3d');
  pal.cream = v('--cream', '#f5efdf');
  pal.teal = v('--teal', '#287f78');
}

const ready = (img) => img && img.complete && img.naturalWidth > 0;
const FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';

// ---------- 特效 ----------

const particles = [];
const effects = [];
const floaters = []; // 「+100」之類往上飄的字
const banners = []; // 畫面中間的大字（換場景、魔王出現）
let shake = 0;
let flashScreen = 0;
let flashColor = '255,255,255';
let frame = 0;

function effect(key, x, y, w, life, { rot = 0, grow = 0.3, alpha = 1 } = {}) {
  effects.push({ key, x, y, w, life, max: life, rot, grow, alpha });
}

function burst(x, y, color, n, speed, life = 30, gravity = 0.25) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, life, max: life, color, size: 2 + Math.random() * 3, gravity });
  }
}

function floater(text, x, y, color = pal.flash, size = 20) {
  floaters.push({ text, x, y, life: 50, color, size });
}

function banner(text, sub = '', life = 120) {
  banners.length = 0;
  banners.push({ text, sub, life, max: life });
}

export function resetEffects() {
  particles.length = 0;
  effects.length = 0;
  floaters.length = 0;
  banners.length = 0;
  shake = 0;
  flashScreen = 0;
  fade = null;
  lastWorld = -1;
}

const ITEM_NAMES = { meat: '烤肉 +♥', gem: '寶石 +1000', magnet: '磁鐵！', shield: '護盾！' };

/** 這一格的事件 → 特效（座標是世界座標，畫的時候再減鏡頭） */
export function handleEvents(v) {
  const r = v.runner;
  for (const e of v.events) {
    switch (e.type) {
      case 'go':
        banner('GO!', '', 50);
        break;
      case 'coin':
        burst(r.x + 10, r.y - 46, '#ffe066', 3, 2.5, 16, 0.05);
        break;
      case 'kill':
        effect('spark', e.x, e.y, 110, 16, { rot: Math.random() * 6 });
        burst(e.x, e.y, '#fff3b0', 10, 5);
        floater(v.combo > 1 ? `+${100 * Math.min(10, v.combo)} ×${v.combo}` : '+100', e.x, e.y - 30);
        shake = Math.max(shake, 4);
        break;
      case 'bump':
        effect('spark', e.x, e.y, 80, 12);
        break;
      case 'break':
        effect('dust', e.x, e.y, 120, 20);
        burst(e.x, e.y, '#c8a36a', 12, 5);
        break;
      case 'item':
        floater(t(ITEM_NAMES[e.item] ?? ''), r.x, r.y - 110, '#7ff0ff', 22);
        effect('burst', r.x, r.y - 50, 150, 20);
        break;
      case 'hurt':
        shake = 10;
        flashScreen = 10;
        flashColor = '255,60,60';
        break;
      case 'shield':
        burst(r.x, r.y - 42, '#9fe8ff', 16, 4, 24, 0);
        break;
      case 'fall':
        floater(t('掉下去了！'), r.x + 120, 380, pal.accent, 26);
        break;
      case 'spring':
        burst(r.x, r.y, '#ff6b6b', 10, 4);
        break;
      case 'double':
        effect('dust', r.x, r.y, 70, 14);
        break;
      case 'boss':
        banner(t('魔王出現！'), t('趁牠衝下來的時候，空中追擊打牠！'), 160);
        break;
      case 'bosshit':
        if (v.boss) {
          effect('spark', v.boss.x, v.boss.y, 220, 20);
          burst(v.boss.x, v.boss.y, '#ffd84a', 24, 7);
        }
        shake = 12;
        flashScreen = 8;
        flashColor = '255,255,255';
        break;
      case 'bossdown':
        banner(t('魔王打倒了！'), t('衝向終點！'), 140);
        break;
      case 'goal':
        for (let i = 0; i < 4; i++) burst(r.x + 60, 200 + i * 40, ['#ff5a6e', '#ffd84a', '#5ad1ff', '#7be07b'][i], 20, 7, 60, 0.15);
        break;
      case 'theme':
        banner(t(WORLDS[e.world].name), t('無盡模式'), 130);
        break;
    }
  }
}

export function tick() {
  frame++;
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life--;
  }
  for (const e of effects) e.life--;
  for (const f of floaters) {
    f.y -= 1.1;
    f.life--;
  }
  for (const b of banners) b.life--;
  remove(particles, (p) => p.life <= 0);
  remove(effects, (e) => e.life <= 0);
  remove(floaters, (f) => f.life <= 0);
  remove(banners, (b) => b.life <= 0);
  shake *= 0.82;
  if (shake < 0.3) shake = 0;
  flashScreen = Math.max(0, flashScreen - 1);
}

function remove(list, dead) {
  for (let i = list.length - 1; i >= 0; i--) if (dead(list[i])) list.splice(i, 1);
}

// ---------- 小工具 ----------

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function outlinedText(g, text, x, y, size, fill = pal.text, align = 'center', stroke = pal.ink) {
  g.font = `900 ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size / 5);
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

// ---------- 動作圖 ----------

// 角色、敵人在遊戲裡畫多高（圖集的一格；人物本身大約是格子的八成高）
const CELL_H = 122;
const BOSS_H = 230;
const ANCHOR = 496 / 512;

/** 從圖集畫一格。frame 沒有就用 fallback；回傳有沒有畫到 */
function drawFrame(g, sheet, name, x, y, h, facing, { fallback = 'idle', flash = 0, rotate = 0, alpha = 1, pivot = 0.45 } = {}) {
  const img = loadImage(asset(sheet.src));
  if (!ready(img)) return false;
  let i = sheet.frames.indexOf(name);
  if (i < 0) i = Math.max(0, sheet.frames.indexOf(fallback));
  const c = sheet.cell;
  h *= (sheet.fix?.[sheet.frames[i]] ?? 1) * (sheet.scale ?? 1);
  g.save();
  g.translate(x, y);
  if (facing < 0) g.scale(-1, 1);
  if (alpha < 1) g.globalAlpha *= alpha;
  if (flash > 0) g.filter = 'brightness(2.2)';
  if (rotate) {
    // 繞著身體中間轉（翻滾）
    g.translate(0, -h * pivot);
    g.rotate(rotate);
    g.translate(0, h * pivot);
  }
  g.drawImage(img, (i % sheet.cols) * c, Math.floor(i / sheet.cols) * c, c, c, -h / 2, -h * ANCHOR, h, h);
  g.restore();
  return true;
}

/**
 * 跑者的動作 → 圖集的格子、旋轉、往下偏移。
 * 跑酷專用的格子（run3／run4、slide、roll、goal）交件後就自動改用，還沒交之前用虛擬闖天下的格子代替。
 */
// 跑步循環：run1 右腳著地 → run2 交錯 → run3 左腳著地 → run4 交錯；8 格時在每兩格中間插 run5～run8
const RUN4 = ['run1', 'run2', 'run3', 'run4'];
const RUN8 = ['run1', 'run5', 'run2', 'run6', 'run3', 'run7', 'run4', 'run8'];
const STEP_BOB = { run1: 2, run3: 2, run2: -3, run4: -3 };

function runnerPose(act, t, speed = 7, frames = []) {
  const has = (f) => frames.includes(f);
  const cycle = Math.max(3, Math.round(40 / speed));
  const spin = (k) => (has('roll') ? { name: 'roll', rotate: k } : { name: 'jump', rotate: k });
  switch (act) {
    case 'ready':
      return { name: 'idle' };
    case 'run': {
      // 有中間格（run5～run8）就是 8 格循環，換得快一倍；不然 4 格（或闖天下的 2 格）
      const run = RUN8.every(has) ? RUN8 : has('run3') && has('run4') ? RUN4 : ['run1', 'run2'];
      const per = Math.max(2, Math.round((cycle * 4) / run.length));
      const name = run[Math.floor(t / per) % run.length];
      // 步伐的上下起伏：腳著地那格低一點、兩腳交錯那格高一點
      return { name, dy: STEP_BOB[name] ?? 0 };
    }
    case 'jump':
    case 'spring':
    case 'fall':
      return { name: 'jump' };
    case 'double':
      // 二段跳：翻一圈
      return spin(Math.min(1, t / 18) * Math.PI * 2);
    case 'homing':
      return { ...spin(t * 0.7), spin: true };
    case 'slide':
      // 還沒有滑行的格子：先用空中踢（身體是橫的），往下放一點貼著地面
      return has('slide') ? { name: 'slide' } : { name: 'jumpkick', dy: 36 };
    case 'dash':
    case 'airdash':
      return { name: 'dash' };
    case 'hurt':
      return { name: 'hurt' };
    case 'goal':
      return { name: t < 40 ? 'run1' : has('goal') ? 'goal' : 'win' };
    case 'out':
      return { name: 'down' };
    default:
      return { name: 'idle' };
  }
}

function drawRunnerSprite(g, character, act, actT, x, y, { h = CELL_H, alpha = 1, speed = 7, flash = 0 } = {}) {
  const sheet = SHEETS.characters?.[character];
  const pose = runnerPose(act, actT, speed, sheet?.frames);
  if (sheet && drawFrame(g, sheet, pose.name, x, y + (pose.dy ?? 0) * (h / CELL_H), h, 1, { fallback: 'run1', rotate: pose.rotate ?? 0, alpha, flash })) return pose;
  // 沒圖：畫一個圓圓的人
  const c = getCharacter(character);
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = c.clothes;
  g.beginPath();
  g.ellipse(x, y - h * 0.32, h * 0.18, h * 0.26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c.hair;
  g.beginPath();
  g.arc(x, y - h * 0.66, h * 0.15, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return pose;
}

// ---------- 背景與跑道 ----------

let fade = null; // 換場景（無盡模式）時淡入：{ from, alpha }
let lastWorld = -1;

/** 背景：遠景、中景、後面那一層地板（只畫到跑道高度，下面是深淵） */
function drawBackdrop(g, world, sub, cam) {
  // 換場景（無盡模式跑進下一個大關）才淡入；剛開始一關（lastWorld = -1）直接畫
  if (world !== lastWorld) {
    if (lastWorld >= 0) fade = { from: lastWorld, sub, alpha: 1 };
    lastWorld = world;
  }
  g.save();
  g.beginPath();
  g.rect(0, 0, W, GROUND + 6);
  g.clip();
  // 跑道在前面，背景整體慢一點（看起來比較遠）
  drawScenery(g, world, sub, cam * 0.55, SCALE);
  if (fade) {
    g.globalAlpha = fade.alpha;
    drawScenery(g, fade.from, fade.sub, cam * 0.55, SCALE);
    fade.alpha -= 0.012;
    if (fade.alpha <= 0) fade = null;
  }
  // 背景那一層地板蓋一層霧，看起來比較遠（跟前面的跑道分開）
  const haze = g.createLinearGradient(0, 330, 0, GROUND + 6);
  haze.addColorStop(0, 'rgba(235,240,255,0.10)');
  haze.addColorStop(1, 'rgba(40,46,70,0.38)');
  g.fillStyle = haze;
  g.fillRect(0, 330, W, GROUND + 6 - 330);
  g.restore();
  drawAmbient(g, world, sub, frame);
  // 深淵：跑道高度以下
  const w = WORLDS[world];
  const grad = g.createLinearGradient(0, GROUND, 0, H);
  grad.addColorStop(0, shade(w.ground[1], -0.45));
  grad.addColorStop(1, '#07060c');
  g.fillStyle = grad;
  g.fillRect(0, GROUND + 6, W, H - GROUND);
}

/** 顏色變亮（k > 0）或變暗（k < 0） */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// 跑酷道具的圖（public/props/runner/，清單在 sheets.json 的 runner）。沒有圖的就用下面程式畫的。
const runnerArt = (name) => (SHEETS.runner?.includes(name) ? loadImage(asset(`props/runner/${name}.webp`)) : null);

// 跑道頂面的圖（512×128，上緣 16px 是踩的那一條）：縮成一半當橫向重複的貼圖；
// 下面的斷面用圖的下半部重複往下鋪
const PLATFORM_SCALE = 0.5;
const platformCache = new Map();
function platformPatterns(g, world) {
  const id = WORLDS[world].id;
  if (platformCache.has(id)) return platformCache.get(id);
  const img = runnerArt(`${id}-platform`);
  if (!ready(img)) return null;
  const w = img.naturalWidth * PLATFORM_SCALE;
  const h = img.naturalHeight * PLATFORM_SCALE;
  const top = document.createElement('canvas');
  top.width = w;
  top.height = h;
  top.getContext('2d').drawImage(img, 0, 0, w, h);
  const fill = document.createElement('canvas');
  fill.width = w;
  fill.height = h / 2;
  fill.getContext('2d').drawImage(img, 0, img.naturalHeight / 2, img.naturalWidth, img.naturalHeight / 2, 0, 0, w, h / 2);
  const p = { top: g.createPattern(top, 'repeat-x'), fill: g.createPattern(fill, 'repeat'), w, h };
  platformCache.set(id, p);
  return p;
}

// 跑道表面的花紋（沒有跑道頂面的圖時用）：從那一關的地板圖（stages/<大關>-<n>/ground.webp）裁下面一段，當作重複的貼圖
const patterns = new Map();
function groundPattern(g, world, sub) {
  const key = `${WORLDS[world].id}-${sub + 1}`;
  const cached = patterns.get(key);
  if (cached) return cached;
  if (!SHEETS.stages?.includes(key)) return null;
  const img = loadImage(asset(`stages/${key}/ground.webp`));
  if (!ready(img)) return null;
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 140;
  const cg = c.getContext('2d');
  cg.drawImage(img, 0, img.naturalHeight * 0.74, img.naturalWidth / 2, img.naturalHeight * 0.26, 0, 0, 480, 140);
  const p = g.createPattern(c, 'repeat');
  patterns.set(key, p);
  return p;
}

function drawSolids(g, v, world, sub) {
  const art = platformPatterns(g, world);
  if (!art) return drawSolidsFallback(g, v, world, sub);
  // 圖案跟著跑道捲（不是跟著畫面）
  const off = -(v.cam % art.w);
  for (const s of v.solids) {
    const x = Math.round(s.x0 - v.cam);
    const x1 = Math.round(s.x1 - v.cam);
    const width = x1 - x;
    if (width <= 0) continue;
    const y = s.y - 3;
    const bottom = s.oneway ? y + art.h * 0.45 : H;
    g.save();
    g.beginPath();
    g.rect(x, y, width, bottom - y);
    g.clip();
    if (s.oneway) {
      // 浮台：只有薄薄一片（頂面圖的上半）
      g.translate(off, y);
      g.fillStyle = art.top;
      g.fillRect(x - off, 0, width, art.h * 0.45);
      g.translate(-off, -y);
      const shade = g.createLinearGradient(0, y + art.h * 0.2, 0, bottom);
      shade.addColorStop(0, 'rgba(10,8,20,0)');
      shade.addColorStop(1, 'rgba(10,8,20,0.45)');
      g.fillStyle = shade;
      g.fillRect(x, y, width, bottom - y);
    } else {
      // 地面：頂面圖＋下面的斷面一路鋪到畫面底，越下面越暗
      g.translate(off, y + art.h);
      g.fillStyle = art.fill;
      g.fillRect(x - off, 0, width, H - y);
      g.translate(0, -art.h);
      g.fillStyle = art.top;
      g.fillRect(x - off, 0, width, art.h);
      g.translate(-off, -y);
      const shade = g.createLinearGradient(0, y + art.h * 0.5, 0, H);
      shade.addColorStop(0, 'rgba(10,8,20,0)');
      shade.addColorStop(1, 'rgba(10,8,20,0.7)');
      g.fillStyle = shade;
      g.fillRect(x, y + art.h * 0.5, width, H);
    }
    g.restore();
    // 兩側的邊
    g.fillStyle = 'rgba(15,12,22,0.55)';
    g.fillRect(x, y, 3, bottom - y);
    g.fillRect(x1 - 3, y, 3, bottom - y);
  }
}

function drawSolidsFallback(g, v, world, sub) {
  const w = WORLDS[world];
  const pat = groundPattern(g, world, sub);
  const lip = shade(w.ground[0], 0.35);
  const lipDark = shade(w.ground[1], -0.35);
  for (const s of v.solids) {
    const x = Math.round(s.x0 - v.cam);
    const x1 = Math.round(s.x1 - v.cam);
    const width = x1 - x;
    if (width <= 0) continue;
    const y = s.y;
    const bottom = s.oneway ? y + 26 : H + 10;
    g.save();
    // 本體：地板花紋，整個壓暗一點（跟背景那一層地板分開）
    if (pat) {
      const off = v.cam % 480;
      g.translate(-off, 0);
      g.fillStyle = pat;
      g.fillRect(x + off, y, width, bottom - y);
      g.translate(off, 0);
    } else {
      g.fillStyle = w.ground[0];
      g.fillRect(x, y, width, bottom - y);
    }
    const grad = g.createLinearGradient(0, y, 0, bottom);
    grad.addColorStop(0, 'rgba(10,8,20,0.25)');
    grad.addColorStop(1, s.oneway ? 'rgba(10,8,20,0.55)' : 'rgba(10,8,20,0.8)');
    g.fillStyle = grad;
    g.fillRect(x, y, width, bottom - y);
    // 磚縫：每 64px 一條，跟著跑道捲動
    if (!s.oneway) {
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      for (let bx = Math.ceil((s.x0 + 8) / 64) * 64; bx < s.x1 - 8; bx += 64) {
        const sx = bx - v.cam;
        g.beginPath();
        g.moveTo(sx, y + 14);
        g.lineTo(sx, Math.min(bottom, y + 60));
        g.stroke();
      }
    }
    // 上緣：亮的一條邊（踩的地方），下面一條暗線
    g.fillStyle = lip;
    g.fillRect(x, y - 2, width, 12);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x, y - 2, width, 3);
    g.fillStyle = lipDark;
    g.fillRect(x, y + 10, width, 4);
    // 輪廓
    g.strokeStyle = '#1a1622';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 1.5, bottom);
    g.lineTo(x + 1.5, y - 1);
    g.lineTo(x1 - 1.5, y - 1);
    g.lineTo(x1 - 1.5, bottom);
    if (s.oneway) g.closePath();
    g.stroke();
    g.restore();
  }
}

function drawGoal(g, v) {
  if (v.goal == null) return;
  const x = v.goal - v.cam;
  if (x < -200 || x > W + 200) return;
  const y = GROUND;
  const img = runnerArt('goal');
  if (ready(img)) {
    // 512×512，旗門底端在 y=511：畫 260 寬，中心在終點線右邊一點
    const size = 260;
    g.drawImage(img, x + 80 - size / 2, y - size * (511 / 512), size, size);
    outlinedText(g, 'GOAL', x + 80, y - size * 0.98, 30, '#ffd84a');
    return;
  }
  // 兩根柱子＋格子旗布條
  g.fillStyle = '#f5efdf';
  g.fillRect(x - 6, y - 210, 12, 210);
  g.fillRect(x + 154, y - 210, 12, 210);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 3; j++) {
      g.fillStyle = (i + j) % 2 ? '#202329' : '#ffffff';
      g.fillRect(x + 6 + i * 9.25, y - 210 + j * 12, 9.25, 12);
    }
  }
  outlinedText(g, 'GOAL', x + 80, y - 236, 34, '#ffd84a');
}

function drawCoins(g, v) {
  const spin = Math.abs(Math.cos(frame * 0.09));
  const face = runnerArt('coin');
  const side = runnerArt('coin-side');
  if (ready(face) && ready(side)) {
    // 轉的時候正面左右壓扁，轉到側面時換成側面圖
    const img = spin > 0.3 ? face : side;
    const sx = spin > 0.3 ? spin : 1;
    for (const [cx, cy] of v.coins_at) {
      g.save();
      g.translate(cx - v.cam, cy);
      g.scale(sx, 1);
      g.drawImage(img, -15, -15, 30, 30);
      g.restore();
    }
    return;
  }
  for (const [cx, cy] of v.coins_at) {
    const x = cx - v.cam;
    g.save();
    g.translate(x, cy);
    g.scale(0.35 + spin * 0.65, 1);
    g.fillStyle = '#b8860b';
    g.beginPath();
    g.arc(0, 0, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd84a';
    g.beginPath();
    g.arc(0, 0, 10.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff6c2';
    g.fillRect(-2, -6, 4, 12);
    g.restore();
  }
}

function drawCrates(g, v, world) {
  const id = WORLDS[world].id;
  for (const c of v.crates) {
    const x = c.x - v.cam;
    const img = loadImage(asset(`props/${id}-crate.webp`));
    if (ready(img)) {
      g.drawImage(img, x - 36, c.y - 72 * (244 / 256), 72, 72);
    } else {
      g.fillStyle = '#9a6a3a';
      g.fillRect(x - 28, c.y - 56, 56, 56);
    }
    // 問號
    const bob = Math.sin(frame * 0.1 + c.id) * 3;
    outlinedText(g, '?', x, c.y - 92 + bob, 26, '#ffd84a');
  }
}

function drawSprings(g, v) {
  const up = runnerArt('spring');
  const down = runnerArt('spring-pressed');
  for (const s of v.springs) {
    const x = s.x - v.cam;
    const img = s.t > 0 ? down : up;
    if (ready(img)) {
      // 128×96，底端 y=95：畫 64 寬
      g.drawImage(img, x - 32, s.y - 48 * (95 / 96), 64, 48);
      continue;
    }
    const squash = s.t > 0 ? 10 : 0;
    g.fillStyle = '#7a7f8c';
    g.fillRect(x - 22, s.y - 8, 44, 8);
    g.strokeStyle = '#c9ccd6';
    g.lineWidth = 4;
    g.beginPath();
    const top = s.y - 30 + squash;
    for (let i = 0; i <= 4; i++) g.lineTo(x + (i % 2 ? 12 : -12), s.y - 8 - (i / 4) * (s.y - 8 - top));
    g.stroke();
    g.fillStyle = '#ff4d5e';
    rr(g, x - 26, top - 10, 52, 12, 5);
    g.fill();
  }
}

/** 機關有圖就畫圖（回傳 true），沒圖回傳 false 改用程式畫的 */
function drawObstacleArt(g, o, x, id) {
  const cx = x + o.w / 2;
  const bottom = o.y + o.h;
  if (o.kind === 'spike') {
    // 128×96，底部貼齊下緣：畫 64 寬（比碰撞範圍 44 寬一點，看起來比較兇）
    const img = runnerArt(`${id}-spike`);
    if (!ready(img)) return false;
    g.drawImage(img, cx - 32, bottom - 48, 64, 48);
    return true;
  }
  if (o.kind === 'bar') {
    // 160×160：下半是擋板、上面是鏈子。擋板底對齊橫桿底，鏈子（圖最上面那一段）一路往上接到畫面頂
    const img = runnerArt(`${id}-bar`);
    if (!ready(img)) return false;
    const size = 92;
    const top = bottom - size;
    g.drawImage(img, cx - size / 2, top, size, size);
    const strip = 18;
    for (let y = top - strip; y > -strip; y -= strip) {
      g.drawImage(img, 0, 0, 160, 160 * (strip / size), cx - size / 2, y, size, strip);
    }
    return true;
  }
  if (o.kind === 'icicle') {
    const img = runnerArt('ice-icicle');
    if (!ready(img)) return false;
    g.drawImage(img, cx - 18, o.y - 4, 36, 72);
    return true;
  }
  if (o.kind === 'geyser') {
    const img = runnerArt('mine-geyser');
    if (!ready(img)) return false;
    g.fillStyle = '#3a2418';
    rr(g, x - 6, bottom - 14, o.w + 12, 14, 4);
    g.fill();
    if (o.on) {
      // 96×384，噴口底端 y=383：高度跟碰撞範圍一樣，左右抖一點
      const h = o.h + 6;
      const w = h * (96 / 384);
      g.save();
      g.translate(cx + Math.sin(frame * 0.9) * 1.5, bottom);
      g.scale(1 + Math.sin(frame * 0.6) * 0.05, 1);
      g.drawImage(img, -w / 2, -h, w, h);
      g.restore();
    } else if (o.warn) {
      // 快噴了：噴口冒小火、火星
      if (frame % 3 === 0) burst(o.x + o.w / 2, bottom - 14, '#ff9a2e', 2, 3, 20, 0.1);
      g.save();
      g.globalAlpha = 0.35 + Math.sin(frame * 0.5) * 0.2;
      g.drawImage(img, 0, 384 - 80, 96, 80, cx - 10, bottom - 30, 20, 30);
      g.restore();
    }
    return true;
  }
  return false;
}

function drawObstacles(g, v, world) {
  const id = WORLDS[world].id;
  for (const o of v.obstacles) {
    const x = o.x - v.cam;
    if (drawObstacleArt(g, o, x, id)) continue;
    if (o.kind === 'spike') {
      // 一排三角形：顏色照大關（冰山是冰、礦坑是石頭）
      const [fill, edge] = id === 'ice' ? ['#cfefff', '#6aa6d6'] : id === 'mine' ? ['#6d5a52', '#2e2420'] : id === 'castle' ? ['#9a8fb0', '#3a3050'] : ['#c9ced8', '#565d6b'];
      g.fillStyle = edge;
      g.fillRect(x, o.y + o.h - 8, o.w, 8);
      for (let i = 0; i < 3; i++) {
        const bx = x + (o.w / 3) * i;
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(bx, o.y + o.h - 6);
        g.lineTo(bx + o.w / 6, o.y);
        g.lineTo(bx + o.w / 3, o.y + o.h - 6);
        g.fill();
        g.strokeStyle = edge;
        g.lineWidth = 2;
        g.stroke();
      }
    } else if (o.kind === 'bar') {
      // 吊著的柵欄：鐵鍊＋黃黑條紋
      const bottom = o.y + o.h;
      g.strokeStyle = '#4a4d57';
      g.lineWidth = 4;
      for (const cx of [x + 10, x + o.w - 10]) {
        g.beginPath();
        g.moveTo(cx, 0);
        g.lineTo(cx, bottom - 50);
        g.stroke();
      }
      g.save();
      rr(g, x - 8, bottom - 50, o.w + 16, 50, 6);
      g.clip();
      for (let i = -2; i < 8; i++) {
        g.fillStyle = i % 2 ? '#202329' : '#ffc93c';
        g.beginPath();
        g.moveTo(x - 8 + i * 16, bottom);
        g.lineTo(x - 8 + i * 16 + 16, bottom);
        g.lineTo(x - 8 + i * 16 + 46, bottom - 50);
        g.lineTo(x - 8 + i * 16 + 30, bottom - 50);
        g.fill();
      }
      g.restore();
      g.strokeStyle = '#202329';
      g.lineWidth = 3;
      rr(g, x - 8, bottom - 50, o.w + 16, 50, 6);
      g.stroke();
    } else if (o.kind === 'icicle') {
      g.fillStyle = '#dff4ff';
      g.strokeStyle = '#7fb8e0';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, o.y);
      g.lineTo(x + o.w, o.y);
      g.lineTo(x + o.w / 2, o.y + o.h);
      g.closePath();
      g.fill();
      g.stroke();
      if (o.v === 0) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillRect(x + 4, o.y - 4, o.w - 8, 4);
      }
    } else if (o.kind === 'geyser') {
      const base = o.y + o.h;
      g.fillStyle = '#3a2418';
      rr(g, x - 6, base - 14, o.w + 12, 14, 4);
      g.fill();
      if (o.on) {
        const flick = Math.sin(frame * 0.8) * 4;
        const grad = g.createLinearGradient(0, o.y, 0, base);
        grad.addColorStop(0, 'rgba(255,220,80,0.1)');
        grad.addColorStop(0.3, 'rgba(255,150,40,0.9)');
        grad.addColorStop(1, 'rgba(255,70,20,1)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x - 4, base - 12);
        g.quadraticCurveTo(x + o.w / 2 + flick, o.y - 40, x + o.w + 4, base - 12);
        g.fill();
      } else if (o.warn) {
        // 快噴了：冒火星
        if (frame % 3 === 0) burst(o.x + o.w / 2, base - 14, '#ff9a2e', 2, 3, 20, 0.1);
        g.fillStyle = `rgba(255,140,40,${0.4 + Math.sin(frame * 0.5) * 0.3})`;
        g.fillRect(x, base - 18, o.w, 6);
      }
    }
  }
}

// 雜兵丟的東西、魔王的子彈：每一大關不一樣
const THROWN = ['bottle', 'stone', 'ink', 'snowball', 'bomb', 'magic'];
const BOSS_SHOT = ['bottle', 'stone', 'bubble', 'ice', 'fire', 'dark'];
function drawShots(g, v, world) {
  for (const s of v.shots) {
    const x = s.x - v.cam;
    const name = s.gravity ? THROWN[world] : BOSS_SHOT[world];
    const img = SHEETS.shots?.includes(name) ? loadImage(asset(`props/shots/${name}.webp`)) : null;
    const size = s.r * 2.8;
    g.save();
    g.translate(x, s.y);
    g.rotate(frame * 0.2);
    if (ready(img)) g.drawImage(img, -size / 2, -size / 2, size, size);
    else {
      g.fillStyle = '#ff8a2e';
      g.beginPath();
      g.arc(0, 0, s.r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

function enemyPose(e) {
  if (!e.alive) return 'fall';
  if (e.hurt > 0) return 'hurt';
  switch (e.kind) {
    case 'thug':
      return Math.floor(e.t / 10) % 2 ? 'walk1' : 'walk2';
    case 'knife':
      return e.vx < -0.5 ? (Math.floor(e.t / 5) % 2 ? 'walk1' : 'walk2') : 'idle';
    case 'thrower': {
      const k = e.t % 80;
      return k > 8 && k < 20 ? 'windup' : k >= 20 && k < 30 ? 'attack' : 'idle';
    }
    default:
      return 'idle';
  }
}

function drawEnemies(g, v, world) {
  const id = WORLDS[world].id;
  for (const e of v.enemies) {
    let x = e.x - v.cam;
    let y = e.y;
    let rot = 0;
    if (!e.alive) {
      // 被打飛：往右上飛出去轉圈
      const k = 18 - e.hurt;
      x += k * 9;
      y -= k * 10 - k * k * 0.6;
      rot = k * 0.3;
    }
    const sheet = SHEETS.enemies?.[`${id}/${e.kind}`];
    const h = CELL_H * (e.kind === 'brute' ? 1.25 : 1);
    g.save();
    if (rot) {
      g.translate(x, y - h * 0.4);
      g.rotate(rot);
      g.translate(-x, -(y - h * 0.4));
    }
    const drawn = sheet && drawFrame(g, sheet, enemyPose(e), x, y, h, -1, { flash: e.alive && e.hurt > 0 ? 1 : 0, alpha: e.alive ? 1 : Math.max(0, e.hurt / 18) });
    if (!drawn) {
      const c = WORLDS[world].enemy;
      g.fillStyle = c.cloth;
      g.fillRect(x - 18, y - 70, 36, 50);
      g.fillStyle = c.head;
      g.beginPath();
      g.arc(x, y - 80, 14, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (e.kind === 'brute' && e.alive) {
      // 要打兩下：頭上兩顆點
      for (let i = 0; i < 2; i++) {
        g.fillStyle = i < e.hp ? pal.accent : 'rgba(0,0,0,0.3)';
        g.beginPath();
        g.arc(x - 7 + i * 14, y - h * 0.92, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

function drawBoss(g, v, world) {
  const b = v.boss;
  if (!b) return;
  const x = b.x - v.cam;
  const y = b.y;
  // 魔王坐在一朵會飛的雲（飛行台）上
  const glow = 0.5 + Math.sin(frame * 0.2) * 0.2;
  g.save();
  g.fillStyle = `rgba(255,255,255,${0.75})`;
  for (const [dx, r] of [[-50, 26], [-18, 34], [22, 32], [54, 24]]) {
    g.beginPath();
    g.arc(x + dx, y + 58, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = `rgba(255,230,140,${glow})`;
  g.fillRect(x - 60, y + 76, 120, 6);
  g.restore();
  const sheet = SHEETS.bosses?.[WORLDS[world].id];
  const pose = { enter: 'idle', hover: b.t % 78 > 30 && b.t % 78 < 42 ? 'windup' : 'idle', swoop: 'charge', hurt: 'hurt', down: 'fall' }[b.state];
  const flash = b.state === 'hurt' && Math.floor(b.t / 3) % 2 === 0 ? 1 : 0;
  if (!(sheet && drawFrame(g, sheet, pose, x, y + 70, BOSS_H, -1, { fallback: 'idle', flash }))) {
    g.fillStyle = WORLDS[world].boss.color;
    g.beginPath();
    g.arc(x, y, 56, 0, Math.PI * 2);
    g.fill();
  }
  if (b.state === 'swoop' && b.t < 30) outlinedText(g, '!', x, y - 130, 40, pal.flash);
}

function drawRunner(g, v) {
  const r = v.runner;
  const x = r.x - v.cam;
  const y = r.y;
  const blink = r.inv > 0 && r.act !== 'hurt' && Math.floor(frame / 3) % 2 === 0;
  // 影子（在腳底下的地面上）
  const ground = groundBelow(v, r.x, r.y);
  if (ground != null) {
    const d = Math.max(0, ground - y);
    g.fillStyle = `rgba(10,8,20,${Math.max(0.08, 0.3 - d / 600)})`;
    g.beginPath();
    g.ellipse(x, ground + 2, 26 * Math.max(0.4, 1 - d / 400), 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 衝刺、追擊：殘影
  if (['dash', 'airdash', 'homing'].includes(r.act)) {
    for (let i = 3; i >= 1; i--) {
      drawRunnerSprite(g, v.character, r.act, r.act_t - i * 2, x - i * 16, y, { alpha: 0.18 * (4 - i), speed: v.speed });
    }
  }
  if (r.magnet > 0) {
    g.strokeStyle = `rgba(255,90,110,${0.25 + Math.sin(frame * 0.3) * 0.15})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y - 46, 70 + Math.sin(frame * 0.2) * 6, 0, Math.PI * 2);
    g.stroke();
  }
  if (!blink) drawRunnerSprite(g, v.character, r.act, r.act_t, x, y, { speed: v.speed });
  if (r.act === 'homing') {
    g.strokeStyle = 'rgba(120,220,255,0.8)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y - 40, 40, 0, Math.PI * 2);
    g.stroke();
  }
  if (r.shield) {
    const grad = g.createRadialGradient(x, y - 46, 20, x, y - 46, 62);
    grad.addColorStop(0, 'rgba(140,230,255,0)');
    grad.addColorStop(0.8, 'rgba(140,230,255,0.25)');
    grad.addColorStop(1, 'rgba(200,250,255,0.75)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y - 46, 62, 0, Math.PI * 2);
    g.fill();
  }
}

function groundBelow(v, x, y) {
  let best = null;
  for (const s of v.solids) if (x >= s.x0 && x <= s.x1 && s.y >= y - 1 && (best == null || s.y < best)) best = s.y;
  return best;
}

// ---------- 遠景裡的其他玩家 ----------

const GHOST_SCALE = 0.5;
const GHOST_FLOOR = 392; // 後面那一層地板上，大概在畫面的這個高度跑

/** 別人：畫在後面那一層地板上（縮小、半透明）；跑太前面或太後面就在畫面邊緣顯示箭頭 */
function drawGhosts(g, race, you, centerX) {
  if (!race) return;
  const others = race.runners.filter((r) => r.seat !== you);
  // 後面的人先畫
  others.sort((a, b) => a.p.x - b.p.x);
  for (const o of others) {
    const p = o.p;
    const color = SLOT_COLORS[o.seat % SLOT_COLORS.length];
    const sx = SCREEN_X + (p.x - centerX) * GHOST_SCALE;
    const sy = GHOST_FLOOR + (p.y - GROUND) * GHOST_SCALE;
    const label = `${o.seat + 1}P ${displayName(o.name)}`;
    if (sx < 16 || sx > W - 16) {
      // 畫面外：邊緣的箭頭與距離
      const right = sx > W - 16;
      const ex = right ? W - 22 : 22;
      const meters = Math.round(Math.abs(p.x - centerX) / 30);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(ex + (right ? 14 : -14), GHOST_FLOOR - 40);
      g.lineTo(ex, GHOST_FLOOR - 52);
      g.lineTo(ex, GHOST_FLOOR - 28);
      g.fill();
      outlinedText(g, `${o.seat + 1}P ${right ? '+' : '−'}${meters}m`, right ? ex - 6 : ex + 6, GHOST_FLOOR - 62, 13, '#fff', right ? 'right' : 'left');
      continue;
    }
    const done = p.fin != null;
    g.save();
    g.globalAlpha = p.out ? 0.35 : 0.85;
    drawRunnerSprite(g, o.character, p.out ? 'out' : done ? 'goal' : p.a || 'run', frame + o.seat * 7, sx, sy, { h: CELL_H * GHOST_SCALE * 1.4 });
    g.restore();
    g.font = `900 12px ${FONT}`;
    const w = g.measureText(label).width + 10;
    g.fillStyle = color;
    rr(g, sx - w / 2, sy - 108, w, 17, 5);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, sx, sy - 99);
  }
}

// ---------- HUD ----------

function heart(g, x, y, s, fill) {
  g.save();
  g.translate(x, y);
  g.scale(s / 20, s / 20);
  g.beginPath();
  g.moveTo(0, 6);
  g.bezierCurveTo(-12, -4, -6, -14, 0, -6);
  g.bezierCurveTo(6, -14, 12, -4, 0, 6);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = pal.ink;
  g.stroke();
  g.restore();
}

function panel(g, x, y, w, h) {
  g.fillStyle = 'rgba(20,22,30,0.72)';
  rr(g, x, y, w, h, 10);
  g.fill();
  g.strokeStyle = 'rgba(245,239,223,0.5)';
  g.lineWidth = 2;
  g.stroke();
}

function drawHud(g, v, race, you) {
  const r = v.runner;
  const c = getCharacter(v.character);
  // 左上：頭像、愛心、護盾
  panel(g, 10, 10, 210, 58);
  const face = loadImage(c.portraits.normal);
  g.save();
  g.beginPath();
  g.arc(39, 39, 23, 0, Math.PI * 2);
  g.fillStyle = '#ffe9a8';
  g.fill();
  g.clip();
  if (ready(face)) g.drawImage(face, 39 - 30, 39 - 22, 60, 60);
  g.restore();
  for (let i = 0; i < Math.max(r.hp, 0) + (r.shield ? 1 : 0) && i < 6; i++) {
    if (i < r.hp) heart(g, 82 + i * 26, 40, 22, pal.hp);
    else {
      g.fillStyle = '#8fe8ff';
      g.beginPath();
      g.arc(82 + i * 26, 38, 10, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = pal.ink;
      g.lineWidth = 2;
      g.stroke();
    }
  }
  // 右上：金幣、分數
  panel(g, W - 220, 10, 210, 58);
  g.fillStyle = '#ffd84a';
  g.beginPath();
  g.arc(W - 196, 27, 9, 0, Math.PI * 2);
  g.fill();
  outlinedText(g, String(v.coins), W - 180, 27, 18, '#ffe066', 'left');
  outlinedText(g, String(v.score).padStart(7, '0'), W - 18, 51, 20, pal.text, 'right');
  if (v.plan.kind === 'level' && v.coin_total) outlinedText(g, `/ ${v.coin_total}`, W - 18, 27, 13, 'rgba(255,255,255,0.7)', 'right');

  // 中上：關卡進度條（無盡模式是距離）
  if (v.plan.kind === 'level') {
    const w = WORLDS[v.plan.world];
    outlinedText(g, `${stageLabel(v.plan.world, v.plan.stage)} ${t(w.subs[v.plan.stage])}`, W / 2, 22, 16);
    if (v.boss) drawBossBar(g, v.boss, world);
    else {
      const bx = W / 2 - 150;
      g.fillStyle = 'rgba(20,22,30,0.6)';
      rr(g, bx, 40, 300, 12, 6);
      g.fill();
      g.fillStyle = pal.teal;
      rr(g, bx, 40, 300 * (v.progress ?? 0), 12, 6);
      g.fill();
      // 別人的位置（連線）
      if (race) {
        for (const o of race.runners) {
          if (o.seat === you || o.p.prog == null) continue;
          g.fillStyle = SLOT_COLORS[o.seat % SLOT_COLORS.length];
          g.beginPath();
          g.arc(bx + 300 * o.p.prog, 46, 5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(bx + 300 * (v.progress ?? 0), 46, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = pal.ink;
      g.lineWidth = 2;
      g.stroke();
    }
  } else {
    outlinedText(g, `${v.meters} m`, W / 2, 30, 28, '#fff');
    outlinedText(g, `SPEED ${(v.speed / 6).toFixed(1)}x`, W / 2, 56, 13, 'rgba(255,255,255,0.8)');
  }
  if (v.combo > 1) outlinedText(g, `${v.combo} COMBO!`, SCREEN_X, 110, 22, '#ffd84a');
  if (race) drawRaceBoard(g, race, you, 80);
}

let world = 0;
function drawBossBar(g, b, w) {
  const name = t(WORLDS[w].boss.name);
  const bx = W / 2 - 150;
  outlinedText(g, name, bx, 46, 13, '#fff', 'left');
  for (let i = 0; i < b.max; i++) {
    g.fillStyle = i < b.hp ? pal.accent : 'rgba(255,255,255,0.25)';
    rr(g, bx + 110 + i * 34, 39, 28, 14, 4);
    g.fill();
  }
}

/** 右邊的名次表（連線） */
function drawRaceBoard(g, race, you, top) {
  const rows = [...race.runners].sort((a, b) => {
    const fa = a.p.fin ?? Infinity;
    const fb = b.p.fin ?? Infinity;
    if (fa !== fb) return fa - fb;
    if (a.p.out !== b.p.out) return a.p.out ? 1 : -1;
    return b.p.x - a.p.x;
  });
  const h = 22;
  panel(g, W - 220, top, 210, rows.length * h + 10);
  rows.forEach((o, i) => {
    const y = top + 16 + i * h;
    const mine = o.seat === you;
    if (mine) {
      g.fillStyle = 'rgba(255,216,74,0.25)';
      g.fillRect(W - 216, y - 10, 202, 20);
    }
    g.fillStyle = SLOT_COLORS[o.seat % SLOT_COLORS.length];
    g.fillRect(W - 212, y - 7, 6, 14);
    g.font = `900 13px ${FONT}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = o.p.out ? 'rgba(255,255,255,0.45)' : '#fff';
    g.fillText(`${i + 1}. ${displayName(o.name)}`.slice(0, 14), W - 200, y);
    g.textAlign = 'right';
    const right = o.p.fin != null ? `${(o.p.fin / 60).toFixed(1)}s` : o.p.out ? t('倒下') : race.plan.kind === 'endless' ? `${o.p.meters}m` : `${Math.round((o.p.prog ?? 0) * 100)}%`;
    g.fillText(right, W - 16, y);
  });
}

function drawCountdown(g, v) {
  if (v.phase !== 'ready') return;
  const n = Math.ceil(v.ready / 60);
  const k = (v.ready % 60) / 60;
  g.save();
  g.globalAlpha = Math.min(1, k * 3);
  outlinedText(g, String(n), W / 2, H / 2 - 30, 90 + (1 - k) * 30, '#ffd84a');
  g.restore();
  if (v.ready > COUNTDOWN - 120) {
    const c = getCharacter(v.character);
    outlinedText(g, t('{name} 準備起跑！', { name: c.name }), W / 2, H / 2 + 50, 22);
  }
}

function drawBanners(g) {
  for (const b of banners) {
    const k = b.life / b.max;
    const a = Math.min(1, k * 4, (1 - k) * 8);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(20,22,30,0.55)';
    g.fillRect(0, H / 2 - 70, W, b.sub ? 110 : 80);
    outlinedText(g, b.text, W / 2, H / 2 - 30, b.text === 'GO!' ? 64 : 44, '#ffd84a');
    if (b.sub) outlinedText(g, b.sub, W / 2, H / 2 + 18, 18);
    g.restore();
  }
}

function drawEffects(g, cam) {
  for (const e of effects) {
    const img = art(e.key);
    if (!ready(img)) continue;
    const k = 1 - e.life / e.max;
    const w = e.w * (1 + e.grow * k);
    g.save();
    g.globalAlpha = Math.min(1, (e.life / e.max) * 2) * e.alpha;
    g.translate(e.x - cam, e.y);
    g.rotate(e.rot);
    g.drawImage(img, -w / 2, -w / 2, w, w);
    g.restore();
  }
  for (const p of particles) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = p.color;
    g.fillRect(p.x - cam - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
  for (const f of floaters) {
    g.save();
    g.globalAlpha = Math.min(1, f.life / 20);
    outlinedText(g, f.text, f.x - cam, f.y, f.size, f.color);
    g.restore();
  }
}

// ---------- 主程式 ----------

/** 觀戰（沒有自己的跑道）：背景＋大家在遠景裡跑＋名次表 */
function drawSpectate(g, race) {
  const plan = race?.plan ?? { kind: 'endless' };
  const w = plan.kind === 'level' ? plan.world : 0;
  const leader = race ? Math.max(...race.runners.map((r) => r.p.x), 0) : frame * 6;
  drawBackdrop(g, w, plan.kind === 'level' ? backdropOf(plan.stage) : 0, leader);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, W, H);
  drawGhosts(g, race, null, leader - 300);
  outlinedText(g, t('觀戰中'), W / 2, 40, 26, '#ffd84a');
  if (race) drawRaceBoard(g, race, null, 80);
}

export function draw(canvas, v, { race = null, you = null, spectate = false } = {}) {
  updatePalette();
  cfg = currentConfig();
  if (SCALE !== cfg.canvasScale || canvas.width !== Math.round(W * cfg.canvasScale)) resize(canvas);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = !cfg.pixelated;
  g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (spectate || !v) {
    drawSpectate(g, race);
    return;
  }
  world = v.world;
  const sub = v.plan.kind === 'level' ? backdropOf(v.plan.stage) : Math.floor(v.cam / 60000) % 3;
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;
  g.save();
  g.translate(sx, sy);
  drawBackdrop(g, world, sub, v.cam);
  drawGhosts(g, race, you, v.runner.x);
  drawSolids(g, v, world, sub);
  drawGoal(g, v);
  drawSprings(g, v);
  drawObstacles(g, v, world);
  drawCrates(g, v, world);
  drawCoins(g, v);
  drawEnemies(g, v, world);
  drawBoss(g, v, world);
  drawShots(g, v, world);
  drawRunner(g, v);
  drawEffects(g, v.cam);
  g.restore();
  if (flashScreen > 0) {
    g.fillStyle = `rgba(${flashColor},${flashScreen / 30})`;
    g.fillRect(0, 0, W, H);
  }
  drawHud(g, v, race, you);
  drawCountdown(g, v);
  drawBanners(g);
}

export function resize(canvas) {
  cfg = currentConfig();
  SCALE = cfg.canvasScale ?? 2;
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  patterns.clear();
  platformCache.clear();
}
