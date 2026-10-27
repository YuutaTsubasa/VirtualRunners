// 連線狀態（全域），做法跟 TaiwanMahjong 的 net.svelte.js 一樣。兩種房間：
//   區網：房主的 App 內建伺服器（src-tauri/src/server.rs），用 WebSocket 連
//   線上：房主的瀏覽器就是伺服器（local/host-worker.js），其他人用 WebRTC 直連（virtual-core/net/p2p.js），
//         只有配對時經過 Cloudflare 的小服務（VirtualCore 的 workers/signal）
// 兩種房間傳的訊息一樣（hello、progress、host、room、frame、welcome、error），只有傳輸層不同。
import { isTauri, invoke } from '@tauri-apps/api/core';
import { SIGNAL_SERVER, ROOM_CODE_CHARS } from './site.js';
import { P2PHost, P2PGuest, signalAvailable, setTranslator } from 'virtual-core/net/p2p.js';
import { t, serverText } from './i18n.svelte.js';

// VirtualCore 的 p2p.js 顯示錯誤訊息時用跑跑樂的翻譯
setTranslator(t);

export const inTauri = isTauri();
export const DEFAULT_PORT = 7811;

export const net = $state({
  status: 'idle', // idle | connecting | open | reconnecting
  address: '',
  seat: null, // 0～7 / null 觀眾
  isHost: false,
  room: null, // 大廳資訊：{ phase, seats, host_seat, you, settings, chat }
  hostInfo: null, // 本機開房時：{ port, host_key, ips }
  code: null, // 線上房間的房號（區網房間是 null）
  online: null, // 線上房間能不能用（配對服務在不在）；null = 還沒檢查
  signalDown: false, // 房主：配對服務暫時連不上（已經在房間裡的人不受影響，只是新的人進不來）
  failure: null, // 還沒進房間就失敗了（房號不對、房主不在）：加入畫面顯示「無法加入房間」
  toasts: [],
});

// 比賽影格不放進 $state（每秒 60 次，交給 engine 直接處理）
const frameListeners = new Set();
export function onFrame(fn) {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
}

let ws = null;
let opener = null; // 重連時呼叫：openWs 或 openGuest
let hostWorker = null; // 線上房間的房主：房間與比賽在 Worker 裡跑
let p2pHost = null;
let p2pGuest = null;
let wantOpen = false;
let hello = null;
let retryTimer = null;
let toastId = 0;

const tokenKey = (addr) => `vr_token_${addr}`;
const hostKeyKey = (addr) => `vr_hostkey_${addr}`;

export function load(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function store(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 無痕模式之類的存不了就算了
  }
}

export function toast(message, kind = 'error') {
  const id = ++toastId;
  net.toasts.push({ id, message, kind });
  setTimeout(() => {
    net.toasts = net.toasts.filter((t) => t.id !== id);
  }, 4000);
}

export function normalizeAddress(a) {
  a = (a || '').trim().replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '');
  if (a && !a.includes(':') && !a.includes('.')) a = `localhost:${a}`;
  // https 頁面連的是 Cloudflare 之類的通道網址（wss 走 443），不要補通訊埠
  const tunnel = typeof location !== 'undefined' && location.protocol === 'https:' && !inTauri && /\.[a-z][a-z0-9-]*$/i.test(a);
  if (a && !tunnel && !/:\d+$/.test(a) && !a.endsWith(']')) a = `${a}:${DEFAULT_PORT}`;
  return a;
}

export function connect(address, { name, hostKey, spectate = false, character } = {}) {
  net.failure = null;
  disconnect();
  address = normalizeAddress(address);
  if (!address) return;
  if (hostKey) store(hostKeyKey(address), hostKey);
  opener = openWs;
  openSession(address, { name, hostKey: hostKey || load(hostKeyKey(address)) || undefined, spectate, character });
}

function openSession(address, { name, hostKey, spectate, character }) {
  net.address = address;
  net.status = 'connecting';
  wantOpen = true;
  hello = { type: 'hello', name, host_key: hostKey, spectate, character };
  opener();
}

// 不可靠通道的影格可能亂序：比較舊的（編號 n 比較小）就丟掉。每次連上重新算。
let lastFrame = 0;

/** 收到伺服器（或線上房間的房主）傳來的訊息 */
function receive(m) {
  if (m.type === 'frame') {
    if (m.n != null) {
      if (m.n <= lastFrame) return;
      lastFrame = m.n;
    }
    for (const fn of frameListeners) fn(m.state);
  } else if (m.type === 'room') {
    net.room = m.state;
    net.seat = m.state.you;
    net.isHost = !!m.state.is_host;
  } else if (m.type === 'welcome') {
    net.seat = m.seat;
    net.isHost = m.is_host;
    // 線上房間的房主關掉分頁房間就沒了，不用記 token（也免得同一個瀏覽器的另一個分頁拿去坐房主的位子）
    if (m.token && !hostWorker) store(tokenKey(net.address), m.token);
  } else if (m.type === 'error') {
    toast(serverText(m.message));
  }
}

/** 連上了：送 hello（帶著 token 就能拿回原本的座位） */
function greet(sendFn) {
  net.status = 'open';
  lastFrame = 0;
  const token = hello.spectate ? undefined : load(tokenKey(net.address)) || undefined;
  sendFn({ ...hello, token });
}

/** 斷線了：要的話過一下再重連 */
function scheduleRetry() {
  if (wantOpen) {
    net.status = net.room ? 'reconnecting' : 'connecting';
    retryTimer = setTimeout(opener, 1500);
  } else {
    net.status = 'idle';
  }
}

function openWs() {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' && !inTauri;
  let socket;
  try {
    socket = new WebSocket(`${secure ? 'wss' : 'ws'}://${net.address}/ws`);
  } catch (e) {
    toast(t('無法連線：{error}', { error: e }));
    net.status = 'idle';
    return;
  }
  ws = socket;
  socket.onopen = () => greet((m) => socket.send(JSON.stringify(m)));
  socket.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    receive(m);
  };
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    scheduleRetry();
  };
}

// ───────────── 線上房間（WebRTC P2P） ─────────────

/** 配對服務能不能用（介面用來決定要不要顯示線上房間）。每次進開房／加入畫面重新檢查。 */
export async function checkOnline() {
  net.online = await signalAvailable(SIGNAL_SERVER);
  return net.online;
}

function randomString(chars, n) {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => chars[x % chars.length]).join('');
}

/** 開線上房間：這個瀏覽器就是伺服器（比賽在 Web Worker 裡跑），其他人用 WebRTC 連進來 */
export function hostOnline({ name, character } = {}) {
  disconnect();
  const key = randomString('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 24);
  const w = new Worker(new URL('./local/host-worker.js', import.meta.url), { type: 'module' });
  hostWorker = w;
  lastFrame = 0;
  w.onmessage = (e) => {
    if (hostWorker !== w) return;
    const m = e.data;
    if (m.type === 'frame') {
      p2pHost?.broadcastFast(m.text);
      receive(JSON.parse(m.text));
    } else if (m.type === 'send') {
      if (m.to === 0) receive(m.msg);
      else p2pHost?.send(m.to, m.msg);
    }
  };
  w.onerror = (e) => {
    toast(t('比賽引擎載入失敗：{error}', { error: e.message || e }));
    disconnect();
  };
  hello = { type: 'hello', name, host_key: key, character };
  w.postMessage({ type: 'start', hostKey: key });
  w.postMessage({ type: 'connect', id: 0 });
  w.postMessage({ type: 'message', id: 0, msg: hello });
  net.status = 'open';
  registerRoom(key, 0);
}

function registerRoom(key, tries) {
  // 第一個字一定是英文字母，才不會跟「只打通訊埠號碼」的位址搞混
  const code = randomString('ABCDEFGHJKMNPQRSTUVWXYZ', 1) + randomString(ROOM_CODE_CHARS, 4);
  net.code = code;
  net.address = `p2p:${code}`;
  const lastInputOf = new Map(); // 每個客人最後一個進度的編號（不可靠通道可能亂序）
  const h = new P2PHost({
    signal: SIGNAL_SERVER,
    code,
    key,
    onPeerOpen: (id) => hostWorker?.postMessage({ type: 'connect', id }),
    onPeerMessage: (id, msg) => {
      if (msg.type === 'progress' && msg.n != null) {
        if (msg.n <= (lastInputOf.get(id) ?? 0)) return;
        lastInputOf.set(id, msg.n);
      }
      hostWorker?.postMessage({ type: 'message', id, msg });
    },
    onPeerClose: (id) => {
      lastInputOf.delete(id);
      hostWorker?.postMessage({ type: 'disconnect', id });
    },
    // 房號剛好被別人用了：換一個
    onTaken: () => {
      if (p2pHost === h && tries < 5) registerRoom(key, tries + 1);
    },
    onSignalDown: (down) => {
      if (p2pHost === h) net.signalDown = down;
    },
  });
  p2pHost?.stop();
  p2pHost = h;
  h.start();
}

/** 加入線上房間：透過配對服務找到房主，用 WebRTC 直接連過去 */
export function joinOnline(code, { name, spectate = false, character } = {}) {
  disconnect();
  net.failure = null;
  net.code = code.trim().toUpperCase();
  opener = openGuest;
  openSession(`p2p:${net.code}`, { name, spectate, character });
}

function openGuest() {
  const g = new P2PGuest({
    signal: SIGNAL_SERVER,
    code: net.code,
    onOpen: () => {
      if (p2pGuest === g) greet((m) => g.send(m));
    },
    onMessage: (m) => {
      if (p2pGuest === g) receive(m);
    },
    onClose: () => {
      if (p2pGuest !== g) return;
      p2pGuest = null;
      scheduleRetry();
    },
    onFatal: (message, code) => {
      if (p2pGuest !== g) return;
      // 已經在房間裡卻找不到房主：房主關掉了頁面；還沒進房間就失敗：加入畫面顯示失敗卡片
      if (net.room) toast(code === 'no_host' ? t('房主離開了，房間已經關閉') : message);
      const failed = !net.room ? message : null;
      disconnect();
      net.failure = failed;
    },
  });
  p2pGuest = g;
  g.connect();
}

export function disconnect() {
  hostWorker?.terminate();
  hostWorker = null;
  p2pHost?.stop();
  p2pHost = null;
  p2pGuest?.close();
  p2pGuest = null;
  net.code = null;
  net.signalDown = false;
  wantOpen = false;
  clearTimeout(retryTimer);
  if (ws) {
    const s = ws;
    ws = null;
    s.close();
  }
  net.room = null;
  net.seat = null;
  net.isHost = false;
  net.status = 'idle';
}

export function send(obj) {
  if (hostWorker) {
    hostWorker.postMessage({ type: 'message', id: 0, msg: obj });
    return true;
  }
  if (p2pGuest?.open) {
    p2pGuest.send(obj);
    return true;
  }
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

// 自己的進度（跑到哪、剩幾顆心、過終點了沒）：engine 每 4 格送一次。
// 線上房間的客人走不可靠通道（掉了也沒關係，下一次又會送最新的），帶著編號讓房主丟掉亂序的舊進度。
let progressNo = 0;
export function sendProgress(json) {
  const p = JSON.parse(json);
  if (p2pGuest?.open) {
    p2pGuest.sendFast({ type: 'progress', ...p, n: ++progressNo });
    return;
  }
  send({ type: 'progress', ...p });
}

export function hostCmd(cmd, extra = {}) {
  send({ type: 'host', cmd, ...extra });
}

export function setCharacter(id) {
  store('vr_character', id);
  if (hello) hello.character = id;
  if (net.seat != null) send({ type: 'character', id });
}

/** 離開座位並回到首頁（線上房間的房主離開＝關掉房間） */
export function leave() {
  if (hostWorker) return disconnect();
  send({ type: 'leave' });
  store(tokenKey(net.address), null);
  setTimeout(disconnect, 100);
}

export async function startHost(port, name, character) {
  const info = await invoke('start_host', { port: Number(port) || DEFAULT_PORT });
  net.hostInfo = info;
  connect(`localhost:${info.port}`, { name, hostKey: info.host_key, character });
  return info;
}

export async function stopHost() {
  disconnect();
  await invoke('stop_host');
  net.hostInfo = null;
}

export async function hostStatus() {
  if (!inTauri) return null;
  const info = await invoke('host_status');
  net.hostInfo = info;
  return info;
}

/** 區網房間給其他人用的網址清單（線上房間用房號，見 Lobby） */
export function serverUrls() {
  if (net.code) return [];
  if (net.hostInfo) return net.hostInfo.ips.map((ip) => `http://${ip}:${net.hostInfo.port}`);
  return net.address ? [`http://${net.address}`] : [];
}
