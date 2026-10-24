// 線上房間（WebRTC P2P）相關的設定，做法跟 TaiwanMahjong 的 site.js 一樣。Node 測試時沒有 import.meta.env。
const env = import.meta.env || {};

// 線上房間的配對服務（workers/signal，Cloudflare），預設是已部署的那一個。
// 開發時可以在 .env.development.local 寫 VITE_SIGNAL_SERVER=http://localhost:8787 用本機的 wrangler dev；
// 寫 VITE_SIGNAL_SERVER=off 表示不提供線上房間（介面上相關的選項會藏起來）。
const DEFAULT_SIGNAL_SERVER = 'https://virtual-runners-signal.taiwan-mahjong-signal.workers.dev';
const signalSetting = env.VITE_SIGNAL_SERVER || DEFAULT_SIGNAL_SERVER;
export const SIGNAL_SERVER = signalSetting === 'off' ? '' : signalSetting.replace(/\/$/, '');

// 網頁版的網址：分享房間連結用（https://…/#join/房號）。
// 沒設定時，網頁版用目前的網址；桌面 App 沒有網址可以分享，只給房號。
export const WEB_URL = env.VITE_WEB_URL || '';

// 房號用的字元（去掉容易看錯的 0/O、1/I/L）
export const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// 房號：5 個英文或數字，至少有一個英文字母（只打數字視為通訊埠）
export function isRoomCode(text) {
  return /^[A-Za-z0-9]{5}$/.test(text || '') && /[A-Za-z]/.test(text);
}

// 從分享連結（…#join/K7QX2）或直接輸入的文字取出房號；不是房號就回傳 null
export function roomCodeOf(text) {
  text = (text || '').trim();
  const m = /#join\/([A-Za-z0-9]{5})\b/.exec(text);
  const code = m ? m[1] : text;
  return isRoomCode(code) ? code.toUpperCase() : null;
}

// 分享連結：base 是網頁版的網址（沒有就回傳空字串）
export function shareLink(code, base = WEB_URL) {
  if (!base || !code) return '';
  return `${base.replace(/#.*$/, '')}#join/${code}`;
}
