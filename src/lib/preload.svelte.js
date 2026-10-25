// 預先載入圖片：開遊戲時先把目前風格的圖都載好（有進度條），換風格時在背景載新的，
// 免得進比賽時角色、球場一張一張慢慢冒出來。畫面（render.js）跟介面共用同一批 Image。
import { styleUrls } from './style-assets.js';

const BASE = import.meta.env.BASE_URL;

const images = new Map(); // 網址 → Image
const pending = new Map(); // 網址 → 載完（或失敗）的 Promise

/** 同一個網址只建一個 Image；畫面每格都會呼叫，所以不能每次都新建 */
export function loadImage(src) {
  if (images.has(src)) return images.get(src);
  const img = new Image();
  img.decoding = 'async';
  pending.set(
    src,
    new Promise((resolve) => {
      // 下載完就算好；解碼交給瀏覽器在背景做（等每張 decode() 完成會慢很多，100 張要十幾秒）
      img.onload = () => {
        resolve();
        img.decode?.().catch(() => {});
      };
      img.onerror = resolve; // 載不到就算了，畫面有退路
    }),
  );
  img.src = src;
  images.set(src, img);
  return img;
}

/** 等這張圖載完（或失敗）；還沒開始載就順便開始載 */
export function whenLoaded(src) {
  loadImage(src);
  return pending.get(src);
}

export const loading = $state({ style: null, done: 0, total: 0 });

const styles = new Map(); // 風格 → 全部載完的 Promise

/** 載入一種風格的全部圖；進度寫在 loading（最近一次呼叫的風格） */
export function preloadStyle(style) {
  if (styles.has(style)) return styles.get(style);
  const urls = styleUrls(style, BASE);
  loading.style = style;
  loading.done = 0;
  loading.total = urls.length;
  const all = Promise.all(
    urls.map((url) => {
      loadImage(url);
      return pending.get(url).then(() => {
        if (loading.style === style) loading.done++;
      });
    }),
  );
  styles.set(style, all);
  return all;
}

/** 最多等 ms 毫秒（網路很慢時不要一直卡在載入畫面） */
export function preloadStyleWithin(style, ms) {
  return Promise.race([preloadStyle(style), new Promise((resolve) => setTimeout(resolve, ms))]);
}
