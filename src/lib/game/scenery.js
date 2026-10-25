// 各關的背景（程式畫的，等美術交件後換成圖）：遠景、中景、地面三層，鏡頭移動時各層捲動速度不同（視差）。
// 每一層畫成一張寬 W 的圖、左右接起來重複，所以每個東西要「繞回來」畫（見 wrap）。
// 下雪、泡泡、火星這種會動的東西在 drawAmbient() 每格畫。

import { W, H, Z_TOP } from './constants.js';
import { WORLDS } from './stages.js';
import SHEETS from './sheets.json' with { type: 'json' };
import { asset } from '../art-style.svelte.js';
import { loadImage, whenLoaded } from '../preload.svelte.js';

const TILE = W;
const SPEED = { far: 0.18, mid: 0.5, ground: 1 };

// 固定的「亂數」：同一關每次畫都一樣
function rand(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 在 x 與 x ± TILE 都畫一次，接縫才不會斷掉
function wrap(x, w, fn) {
  fn(x);
  if (x + w > TILE) fn(x - TILE);
  if (x < 0) fn(x + TILE);
}

function grad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}

// 每一小關的天空色調：第 1 小關白天、第 2 小關換個時段、第 3 小關（魔王）比較暗
const SKY_TINT = [null, 'rgba(255,120,60,0.25)', 'rgba(40,20,80,0.32)'];

// ---------- 各關的三層 ----------

const LAYERS = {
  city: {
    far(g, sub, r) {
      // 白色摩天大樓剪影
      for (let i = 0; i < 9; i++) {
        const w = 60 + r() * 70;
        const h = 120 + r() * 170;
        const x = i * (TILE / 9) + r() * 30;
        wrap(x, w, (xx) => {
          g.fillStyle = sub === 1 ? '#5a6688' : '#e6edf7';
          g.fillRect(xx, Z_TOP - 40 - h, w, h + 40);
          g.fillStyle = sub === 1 ? 'rgba(255,230,140,0.55)' : 'rgba(120,170,230,0.45)';
          for (let wy = Z_TOP - 30 - h; wy < Z_TOP - 50; wy += 18) {
            for (let wx = xx + 8; wx < xx + w - 10; wx += 16) if ((wx * 7 + wy) % 5 > 1) g.fillRect(wx, wy, 7, 9);
          }
        });
      }
    },
    mid(g, sub) {
      // 白色店面與路燈
      const shops = ['#ffffff', '#f3f6fb', '#fbf7ef'];
      for (let i = 0; i < 4; i++) {
        const x = i * 240;
        wrap(x, 230, (xx) => {
          g.fillStyle = sub === 1 ? '#8e98b8' : shops[i % 3];
          g.fillRect(xx, Z_TOP - 170, 230, 170);
          g.fillStyle = ['#ff6b81', '#4dabf7', '#ffd43b', '#69db7c'][i];
          g.fillRect(xx + 10, Z_TOP - 120, 210, 22);
          g.fillStyle = sub === 1 ? 'rgba(255,220,120,0.7)' : 'rgba(150,200,255,0.55)';
          g.fillRect(xx + 20, Z_TOP - 88, 80, 70);
          g.fillRect(xx + 130, Z_TOP - 88, 80, 70);
          g.strokeStyle = 'rgba(40,50,80,0.25)';
          g.lineWidth = 2;
          g.strokeRect(xx, Z_TOP - 170, 230, 170);
        });
        wrap(x + 232, 10, (xx) => {
          g.fillStyle = '#5a6478';
          g.fillRect(xx, Z_TOP - 200, 5, 200);
          g.fillStyle = sub === 1 ? '#ffe680' : '#ffffff';
          g.beginPath();
          g.arc(xx + 2, Z_TOP - 204, 9, 0, Math.PI * 2);
          g.fill();
        });
      }
      if (sub === 2) {
        // 中央廣場：噴水池
        g.fillStyle = '#e8eef8';
        g.fillRect(380, Z_TOP - 60, 200, 60);
        g.fillStyle = '#9fd3ff';
        g.fillRect(392, Z_TOP - 52, 176, 14);
      }
    },
    ground(g) {
      g.fillStyle = grad(g, Z_TOP, H, ['#eef1f6', '#cfd5e0']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      g.strokeStyle = 'rgba(90,100,130,0.22)';
      g.lineWidth = 2;
      for (let y = Z_TOP + 22; y < H; y += 34) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(TILE, y);
        g.stroke();
      }
      for (let x = 0; x < TILE; x += 80) {
        g.beginPath();
        g.moveTo(x, Z_TOP);
        g.lineTo(x - 60, H);
        g.stroke();
      }
    },
  },
  forest: {
    far(g, sub, r) {
      g.fillStyle = sub === 1 ? '#9db8a8' : '#8fcf9a';
      g.beginPath();
      g.moveTo(0, Z_TOP);
      for (let x = 0; x <= TILE; x += 20) g.lineTo(x, Z_TOP - 90 - Math.sin((x / TILE) * Math.PI * 4) * 40 - Math.sin((x / TILE) * Math.PI * 10) * 12);
      g.lineTo(TILE, Z_TOP);
      g.fill();
      for (let i = 0; i < 4; i++) {
        const x = r() * TILE;
        wrap(x, 60, (xx) => {
          g.fillStyle = 'rgba(255,255,255,0.8)';
          g.beginPath();
          g.ellipse(xx, 70 + r() * 60, 50, 16, 0, 0, Math.PI * 2);
          g.fill();
        });
      }
    },
    mid(g, sub, r) {
      const n = sub === 2 ? 5 : 8;
      for (let i = 0; i < n; i++) {
        const x = (i + r() * 0.5) * (TILE / n);
        const size = (sub === 2 ? 1.8 : 1) * (0.8 + r() * 0.5);
        wrap(x - 70 * size, 140 * size, (xx) => {
          const cx = xx + 70 * size;
          g.fillStyle = '#6b4a2e';
          g.fillRect(cx - 9 * size, Z_TOP - 120 * size, 18 * size, 120 * size + 4);
          g.fillStyle = sub === 2 ? '#2f6b3a' : '#3f9a4a';
          for (const [dx, dy, rr] of [[0, -150, 55], [-40, -120, 42], [40, -118, 44], [0, -105, 40]]) {
            g.beginPath();
            g.arc(cx + dx * size, Z_TOP + dy * size, rr * size, 0, Math.PI * 2);
            g.fill();
          }
        });
      }
    },
    ground(g, sub, r) {
      g.fillStyle = grad(g, Z_TOP, H, sub === 2 ? ['#5e9a46', '#3d6e2e'] : ['#8fd06a', '#5aa142']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      g.fillStyle = '#c9a46a';
      g.fillRect(0, Z_TOP + 60, TILE, 70);
      for (let i = 0; i < 60; i++) {
        const x = r() * TILE;
        const y = Z_TOP + r() * (H - Z_TOP);
        if (y > Z_TOP + 58 && y < Z_TOP + 132) continue;
        g.fillStyle = ['#ffe066', '#ff8fab', '#ffffff'][i % 3];
        g.fillRect(x, y, 4, 4);
      }
    },
  },
  sea: {
    far(g, sub, r) {
      // 光線
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * TILE + r() * 60;
        wrap(x, 200, (xx) => {
          g.beginPath();
          g.moveTo(xx, 0);
          g.lineTo(xx + 60, 0);
          g.lineTo(xx + 200, Z_TOP);
          g.lineTo(xx + 110, Z_TOP);
          g.fill();
        });
      }
      g.fillStyle = 'rgba(10,40,80,0.45)';
      g.beginPath();
      g.moveTo(0, Z_TOP);
      for (let x = 0; x <= TILE; x += 24) g.lineTo(x, Z_TOP - 60 - Math.abs(Math.sin((x / TILE) * Math.PI * 3)) * 80);
      g.lineTo(TILE, Z_TOP);
      g.fill();
    },
    mid(g, sub, r) {
      for (let i = 0; i < 10; i++) {
        const x = r() * TILE;
        const h = 60 + r() * 90;
        wrap(x, 20, (xx) => {
          g.strokeStyle = i % 2 ? '#2fae6e' : '#1f8a5a';
          g.lineWidth = 7;
          g.beginPath();
          g.moveTo(xx, Z_TOP + 4);
          for (let k = 1; k <= 6; k++) g.lineTo(xx + Math.sin(k) * 10, Z_TOP - (h * k) / 6);
          g.stroke();
        });
      }
      for (let i = 0; i < 5; i++) {
        const x = r() * TILE;
        wrap(x, 60, (xx) => {
          g.fillStyle = ['#ff7f7f', '#ffb35c', '#ff8fd0'][i % 3];
          g.beginPath();
          g.ellipse(xx + 30, Z_TOP - 10, 30, 22, 0, Math.PI, 0);
          g.fill();
        });
      }
      if (sub === 1) {
        // 沉船的木板
        g.fillStyle = '#6b4a2e';
        g.fillRect(200, Z_TOP - 140, 420, 26);
        g.fillRect(260, Z_TOP - 220, 16, 220);
      }
      if (sub === 2) {
        g.fillStyle = '#a7c6d6';
        for (let i = 0; i < 4; i++) g.fillRect(80 + i * 240, Z_TOP - 220, 36, 220);
        g.fillRect(40, Z_TOP - 236, TILE - 80, 20);
      }
    },
    ground(g, sub, r) {
      g.fillStyle = grad(g, Z_TOP, H, ['#efdfa8', '#cdb57a']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(140,110,60,0.25)';
        g.beginPath();
        g.ellipse(r() * TILE, Z_TOP + r() * (H - Z_TOP), 10, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
  },
  ice: {
    far(g, sub, r) {
      if (sub === 1) {
        // 冰窟：洞頂
        g.fillStyle = '#5c86b8';
        g.fillRect(0, 0, TILE, 90);
        for (let x = 0; x < TILE; x += 40) {
          g.beginPath();
          g.moveTo(x, 90);
          g.lineTo(x + 20, 90 + 30 + ((x * 13) % 40));
          g.lineTo(x + 40, 90);
          g.fill();
        }
      }
      g.fillStyle = '#d6ecff';
      g.beginPath();
      g.moveTo(0, Z_TOP);
      let up = true;
      for (let x = 0; x <= TILE; x += 120) {
        g.lineTo(x + 60, Z_TOP - (up ? 200 : 140) - r() * 40);
        g.lineTo(x + 120, Z_TOP - 40);
        up = !up;
      }
      g.lineTo(TILE, Z_TOP);
      g.fill();
    },
    mid(g, sub, r) {
      for (let i = 0; i < 7; i++) {
        const x = r() * TILE;
        const h = 80 + r() * 80;
        wrap(x, 60, (xx) => {
          if (sub === 2) {
            g.fillStyle = 'rgba(160,220,255,0.85)';
            g.beginPath();
            g.moveTo(xx, Z_TOP);
            g.lineTo(xx + 20, Z_TOP - h * 1.4);
            g.lineTo(xx + 40, Z_TOP);
            g.fill();
          } else {
            g.fillStyle = '#2f6b6b';
            g.beginPath();
            g.moveTo(xx + 30, Z_TOP - h);
            g.lineTo(xx + 60, Z_TOP);
            g.lineTo(xx, Z_TOP);
            g.fill();
            g.fillStyle = '#ffffff';
            g.beginPath();
            g.moveTo(xx + 30, Z_TOP - h);
            g.lineTo(xx + 42, Z_TOP - h * 0.6);
            g.lineTo(xx + 18, Z_TOP - h * 0.6);
            g.fill();
          }
        });
      }
    },
    ground(g, sub, r) {
      g.fillStyle = grad(g, Z_TOP, H, ['#f4fbff', '#c5e0f2']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      g.strokeStyle = 'rgba(120,170,210,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const x = r() * TILE;
        const y = Z_TOP + r() * (H - Z_TOP);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 30, y + 8);
        g.lineTo(x + 46, y + 2);
        g.stroke();
      }
    },
  },
  mine: {
    far(g, sub, r) {
      g.fillStyle = '#2a1712';
      g.fillRect(0, 0, TILE, Z_TOP);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(120,70,40,0.4)';
        g.beginPath();
        g.arc(r() * TILE, r() * Z_TOP, 6 + r() * 20, 0, Math.PI * 2);
        g.fill();
      }
      if (sub >= 1) {
        // 熔岩河
        g.fillStyle = grad(g, Z_TOP - 70, Z_TOP, ['#ff9a2e', '#d6361c']);
        g.fillRect(0, Z_TOP - 70, TILE, 70);
      }
    },
    mid(g, sub, r) {
      for (let i = 0; i < 4; i++) {
        const x = i * 240 + 40;
        wrap(x, 180, (xx) => {
          g.fillStyle = '#7a5230';
          g.fillRect(xx, Z_TOP - 200, 16, 200);
          g.fillRect(xx + 160, Z_TOP - 200, 16, 200);
          g.fillRect(xx - 8, Z_TOP - 212, 192, 18);
          g.fillStyle = '#ffd23f';
          g.beginPath();
          g.arc(xx + 88, Z_TOP - 180, 8, 0, Math.PI * 2);
          g.fill();
        });
      }
      if (sub === 2) {
        g.fillStyle = 'rgba(255,90,30,0.35)';
        g.fillRect(0, 0, TILE, Z_TOP);
      }
    },
    ground(g, sub, r) {
      g.fillStyle = grad(g, Z_TOP, H, ['#5a3a2a', '#2e1c12']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      // 礦車軌道
      g.fillStyle = '#3a2a20';
      for (let x = 0; x < TILE; x += 40) g.fillRect(x, Z_TOP + 30, 22, 26);
      g.fillStyle = '#9a9aa6';
      g.fillRect(0, Z_TOP + 34, TILE, 4);
      g.fillRect(0, Z_TOP + 50, TILE, 4);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = 'rgba(255,140,40,0.25)';
        g.fillRect(r() * TILE, Z_TOP + 70 + r() * (H - Z_TOP - 70), 5, 3);
      }
    },
  },
  castle: {
    far(g, sub, r) {
      if (sub === 0) {
        g.fillStyle = '#fff6d6';
        g.beginPath();
        g.arc(760, 90, 40, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#201436';
      for (let i = 0; i < 6; i++) {
        const x = i * 160 + r() * 40;
        const h = 160 + r() * 120;
        wrap(x, 60, (xx) => {
          g.fillRect(xx, Z_TOP - h, 50, h);
          g.beginPath();
          g.moveTo(xx - 8, Z_TOP - h);
          g.lineTo(xx + 25, Z_TOP - h - 50);
          g.lineTo(xx + 58, Z_TOP - h);
          g.fill();
        });
      }
    },
    mid(g, sub) {
      g.fillStyle = sub === 2 ? '#3a2232' : '#3a3448';
      g.fillRect(0, Z_TOP - 190, TILE, 190);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 2;
      for (let y = Z_TOP - 190; y < Z_TOP; y += 30) {
        for (let x = (y / 30) % 2 ? 0 : 30; x < TILE; x += 60) g.strokeRect(x, y, 60, 30);
      }
      for (let i = 0; i < 4; i++) {
        const x = i * 240 + 110;
        g.fillStyle = sub === 2 ? '#b0213a' : '#6a2a8a';
        g.fillRect(x, Z_TOP - 180, 44, 110);
        g.fillStyle = '#ffd23f';
        g.fillRect(x + 18, Z_TOP - 160, 8, 8);
      }
    },
    ground(g, sub) {
      g.fillStyle = grad(g, Z_TOP, H, ['#4e4860', '#2a2636']);
      g.fillRect(0, Z_TOP, TILE, H - Z_TOP);
      if (sub === 2) {
        g.fillStyle = '#8a1a2a';
        g.fillRect(0, Z_TOP + 50, TILE, 80);
      }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      for (let y = Z_TOP + 30; y < H; y += 40) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(TILE, y);
        g.stroke();
      }
    },
  },
};

// ---------- 快取：每一關每一層畫一次 ----------

const cache = new Map();
function layer(world, sub, which, scale) {
  const key = `${world}-${sub}-${which}-${scale}`;
  let c = cache.get(key);
  if (c) return c;
  if (cache.size > 30) cache.clear();
  c = document.createElement('canvas');
  c.width = TILE * scale;
  c.height = H * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  const info = WORLDS[world];
  if (which === 'far') {
    g.fillStyle = grad(g, 0, Z_TOP, info.sky);
    g.fillRect(0, 0, TILE, Z_TOP + 2);
    if (SKY_TINT[sub]) {
      g.fillStyle = SKY_TINT[sub];
      g.fillRect(0, 0, TILE, Z_TOP + 2);
    }
  }
  LAYERS[info.id][which](g, sub, rand(world * 31 + sub * 7 + (which === 'far' ? 1 : which === 'mid' ? 2 : 3)));
  cache.set(key, c);
  return c;
}

function drawLayer(g, img, offset, lift = 0) {
  const x = -(((offset % TILE) + TILE) % TILE);
  g.drawImage(img, x, -lift, TILE, H);
  g.drawImage(img, x + TILE, -lift, TILE, H);
}

// 交件的背景（public/stages/<大關>-<小關>/{far,mid,ground}.webp）：三張都載好才用，不然先畫程式版
function artLayers(world, sub) {
  const key = `${WORLDS[world].id}-${sub + 1}`;
  if (!SHEETS.stages?.includes(key)) return null;
  const imgs = ['far', 'mid', 'ground'].map((l) => loadImage(asset(`stages/${key}/${l}.webp`)));
  return imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs : null;
}

/** 這一關背景的三層圖載完（沒有圖的關直接好）：開跑前先等，免得頭幾格畫成程式畫的備用背景 */
export function sceneryLoaded(world, sub) {
  const key = `${WORLDS[world].id}-${sub + 1}`;
  if (!SHEETS.stages?.includes(key)) return Promise.resolve();
  return Promise.all(['far', 'mid', 'ground'].map((l) => whenLoaded(asset(`stages/${key}/${l}.webp`))));
}

export function drawScenery(g, world, sub, camera, scale) {
  const art = artLayers(world, sub);
  // 遠景畫得太低的關（白色都市的天際線在地板線以下，會被地板蓋住）：往上抬（sheets.json 的 farLift，1080 的 px）
  const lift = art ? (SHEETS.farLift?.[`${WORLDS[world].id}-${sub + 1}`] ?? 0) / 2 : 0;
  ['far', 'mid', 'ground'].forEach((which, i) => drawLayer(g, art ? art[i] : layer(world, sub, which, scale), camera * SPEED[which], which === 'far' ? lift : 0));
}

// ---------- 會動的東西 ----------

const motes = Array.from({ length: 36 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, s: 0.5 + ((i * 37) % 10) / 10 }));

export function drawAmbient(g, world, sub, frame) {
  const id = WORLDS[world].id;
  if (id === 'ice') {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const m of motes) {
      const x = (m.x + Math.sin((frame + m.y) * 0.02) * 20 + W) % W;
      const y = (m.y + frame * m.s) % H;
      g.fillRect(x, y, 3 * m.s + 1, 3 * m.s + 1);
    }
  } else if (id === 'sea') {
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.5;
    for (const m of motes) {
      const x = (m.x + Math.sin((frame + m.x) * 0.03) * 8) % W;
      const y = H - ((m.y + frame * m.s * 0.8) % H);
      g.beginPath();
      g.arc(x, y, 2 + m.s * 3, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (id === 'mine') {
    for (const m of motes) {
      const x = (m.x + Math.sin((frame + m.y) * 0.05) * 12) % W;
      const y = H - ((m.y + frame * m.s * 1.2) % H);
      g.fillStyle = `rgba(255,${120 + m.s * 80},40,${0.4 + m.s * 0.4})`;
      g.fillRect(x, y, 2.5, 2.5);
    }
  } else if (id === 'castle' && sub > 0) {
    g.fillStyle = 'rgba(190,120,255,0.35)';
    for (const m of motes.slice(0, 14)) {
      const x = (m.x + frame * m.s * 0.3) % W;
      const y = 60 + ((m.y + Math.sin(frame * 0.02 + m.x) * 30) % 260);
      g.fillRect(x, y, 2, 2);
    }
  } else if (id === 'forest' && sub === 1) {
    // 迷霧
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, Z_TOP - 80, W, 120);
  }
}

/** 選單用的背景圖（標題、模式選擇）：畫在一個 canvas 上 */
export function drawBackdrop(canvas, world, sub = 0, camera = 0) {
  const scale = Math.min(2, (canvas.width / W) || 1);
  canvas.width = W * scale;
  canvas.height = H * scale;
  const g = canvas.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  drawScenery(g, world, sub, camera, scale);
}
