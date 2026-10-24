// 畫風與圖檔路徑（純函式，Node 測試也能用）。
//
// 90 年代（anime90）的圖放在 public/ 底下（characters/、sprites/、effects/、ui/）；
// 其他風格放在 public/styles/<風格>/ 底下、結構一樣。每種風格實際有哪些檔案記在
// style-assets.json（由 scripts/import-style.py 產生），沒有的就退回 90 年代版。

import MANIFEST from './style-assets.json' with { type: 'json' };

export const ART_STYLES = [
  { id: 'anime90', name: '90 年代' },
  { id: 'pc98', name: 'PC-98', pixelated: true },
  { id: 'msdos', name: 'MS-DOS', pixelated: true },
  { id: 'taiwan-print', name: '台式印刷' },
  { id: 'gameboy', name: 'Game Boy', pixelated: true },
  { id: 'modern-paint', name: '動漫電影' },
];

export const DEFAULT_STYLE = 'anime90';
export const isStyle = (id) => ART_STYLES.some((s) => s.id === id);

const fileSets = Object.fromEntries(
  Object.entries(MANIFEST.styles ?? {}).map(([id, s]) => [id, new Set(s.files ?? [])]),
);

// 選用的插圖：只用該風格自己交的（不借 90 年代版，免得畫風混在一起）；沒有時畫面改用角色動作圖拼
export const OPTIONAL = new Set(['ui/logo.webp', 'ui/title-scene.webp', 'ui/mode-solo.webp', 'ui/mode-party.webp', 'ui/mode-watch.webp', 'ui/icons/watch.webp']);

// 一種風格完整的檔案數：11 位角色 ×（5 表情＋1 圖集）＋特效 3＋介面 4（含 Logo）＋圖示 10
// （關卡背景、敵人、魔王的圖還在請美術畫，交件後再加進來）
export const EXPECTED_FILES = 11 * 6 + 3 + 4 + 10;

/** 這個風格有沒有這張圖（anime90 的基本圖一律當作有） */
export function hasAsset(style, path) {
  if (style === DEFAULT_STYLE && !OPTIONAL.has(path)) return true;
  return !!fileSets[style]?.has(path);
}

const url = (style, path, base) => `${base}${style === DEFAULT_STYLE ? '' : `styles/${style}/`}${path}`;

/**
 * 圖檔網址：path 例如 'game/court.webp'、'characters/xiaochun/happy.webp'。
 * 這個風格沒有就用 90 年代版；選用插圖這個風格沒有時回傳 null。
 */
export function assetPath(style, path, base = '/') {
  if (hasAsset(style, path)) return url(style, path, base);
  if (OPTIONAL.has(path)) return null;
  return url(DEFAULT_STYLE, path, base);
}

// 所有風格用到的圖（每種風格的清單都是完整的，聯集就是全部）
const ALL_FILES = [...new Set(Object.values(MANIFEST.styles ?? {}).flatMap((s) => s.files ?? []))];

/** 這個風格要用到的每一張圖的網址（沒有的退回 90 年代版、選用插圖沒有就略過），給預先載入用 */
export function styleUrls(style, base = '/') {
  return [...new Set(ALL_FILES.map((path) => assetPath(style, path, base)).filter(Boolean))];
}

/** 這個風格已經交了多少（給選風格畫面顯示「製作中」） */
export function styleProgress(style) {
  if (style === DEFAULT_STYLE) return 1;
  const have = [...(fileSets[style] ?? [])].filter((f) => !OPTIONAL.has(f)).length;
  return Math.min(1, have / EXPECTED_FILES);
}

// 畫面設定：角色腳底位置、像素風格的內部解析度等。沒寫的用 90 年代版的數字。
const ANIME90 = {
  pixelated: false,
  canvasScale: 2,
  spriteAnchorY: 496 / 512,
  // 角色在遊戲座標裡畫多大。像素風格要讓「邏輯像素」剛好整數對到畫布像素，
  // 不然最近鄰縮小會吃掉輪廓線（例如 Game Boy 128 邏輯格 × 內部 0.5 倍 → 256）
  spriteSize: 210,
};

export function styleConfig(style) {
  const s = MANIFEST.styles?.[style]?.config ?? {};
  const meta = ART_STYLES.find((a) => a.id === style);
  return {
    ...ANIME90,
    pixelated: !!meta?.pixelated,
    ...s,
  };
}
