// 線上房間（WebRTC P2P）相關的設定。房號、分享連結的規則在 VirtualCore（virtual-core/net/site.js），這裡只放跑跑樂自己的網址。
// Node 測試時沒有 import.meta.env。
import { signalServer, shareLink as coreShareLink } from 'virtual-core/net/site.js';

export { ROOM_CODE_CHARS, isRoomCode, roomCodeOf } from 'virtual-core/net/site.js';

const env = import.meta.env || {};

// 線上房間的配對服務（VirtualCore 的 workers/signal，Cloudflare），預設是已部署的那一個。
// 開發時可以在 .env.development.local 寫 VITE_SIGNAL_SERVER=http://localhost:8787 用本機的 wrangler dev；
// 寫 VITE_SIGNAL_SERVER=off 表示不提供線上房間（介面上相關的選項會藏起來）。
const DEFAULT_SIGNAL_SERVER = 'https://virtual-runners-signal.taiwan-mahjong-signal.workers.dev';
export const SIGNAL_SERVER = signalServer(env.VITE_SIGNAL_SERVER, DEFAULT_SIGNAL_SERVER);

// 網頁版的網址：分享房間連結用（https://…/#join/房號）。
// 沒設定時，網頁版用目前的網址；桌面 App 沒有網址可以分享，只給房號。
export const WEB_URL = env.VITE_WEB_URL || '';

// 分享連結：base 是網頁版的網址（沒有就回傳空字串）
export function shareLink(code, base = WEB_URL) {
  return coreShareLink(code, base);
}
