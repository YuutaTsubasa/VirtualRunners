// 目前的畫風（全域狀態，記在這台電腦上）。圖檔路徑、畫面設定見 style-assets.js。
import { ART_STYLES, DEFAULT_STYLE, isStyle, assetPath, styleConfig } from './style-assets.js';

export { ART_STYLES };

const STORAGE_KEY = 'vr_art_style';
const BASE = import.meta.env.BASE_URL;

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isStyle(saved)) return saved;
  } catch {
    // 無痕模式之類的讀不到
  }
  return DEFAULT_STYLE;
}

export const artStyle = $state({ id: load() });

function apply(id) {
  if (typeof document !== 'undefined') document.documentElement.dataset.style = id;
}
apply(artStyle.id);

export function setArtStyle(id) {
  if (!isStyle(id)) return;
  artStyle.id = id;
  apply(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 存不了就算了
  }
}

/** 目前風格的圖檔網址（沒有就用 90 年代版） */
export function asset(path, style = artStyle.id) {
  return assetPath(style, path, BASE);
}

export function currentConfig() {
  return styleConfig(artStyle.id);
}
