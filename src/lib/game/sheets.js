// 動作圖集的資料（sheets.json，由 scripts/import-art.py、import-style-art.py 產生）。
// 90 年代版在最上層；其他畫風自己的圖集記在 styles.<風格>（格子順序跟 90 年代版一樣，只是格子大小、像素與否不同）。
// 這個畫風還沒有某張圖集就用 90 年代版的資料（圖也會退回 90 年代版，兩者一致）。
import SHEETS from './sheets.json' with { type: 'json' };
import { artStyle } from '../art-style.svelte.js';

export { SHEETS };

/** kind = characters | enemies | bosses；key = 角色 id、'city/thug'、'city' */
export function sheetOf(kind, key, style = artStyle.id) {
  return SHEETS.styles?.[style]?.[kind]?.[key] ?? SHEETS[kind]?.[key];
}
