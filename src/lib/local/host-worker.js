// 線上房間的房主：房間與比賽（crates/runner-wasm 的 HostRoom）在這個 Web Worker 裡跑。
// 放在 Worker 是因為分頁切到背景時主執行緒的計時器會被降到每秒一次，Worker 不會，客人那邊的比賽才不會卡住。
//
// 主執行緒 → 這裡：{ type: 'start', hostKey } / { type: 'connect' | 'disconnect', id } / { type: 'message', id, msg }
// 這裡 → 主執行緒：{ type: 'frame', text }（每格，已經是要送出的 JSON 文字）/ { type: 'send', to, msg }

import init, { HostRoom } from './pkg/runner_wasm.js';

const FRAME = 1000 / 60;

let room = null;
const queue = []; // wasm 還沒載入好之前收到的訊息
let n = 0; // 影格編號：不可靠通道可能亂序，客人收到比較舊的就丟掉

function flush() {
  for (const m of JSON.parse(room.drain())) postMessage({ type: 'send', to: m.to, msg: m.msg });
}

function handle(m) {
  if (m.type === 'connect') room.connect(m.id);
  else if (m.type === 'disconnect') room.disconnect(m.id);
  else if (m.type === 'message') room.message(m.id, typeof m.msg === 'string' ? m.msg : JSON.stringify(m.msg));
  flush();
}

function tick() {
  const state = room.tick();
  if (state !== undefined) postMessage({ type: 'frame', text: `{"type":"frame","n":${++n},"state":${state}}` });
}

onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'start') {
    await init();
    room = new HostRoom(m.hostKey);
    queue.splice(0).forEach(handle);
    // 固定 60 格：用經過的時間算該跑幾格，計時器晚到也不會變慢
    let next = performance.now();
    setInterval(() => {
      const now = performance.now();
      let steps = 0;
      while (now >= next && steps < 10) {
        tick();
        next += FRAME;
        steps++;
      }
      if (now - next > 200) next = now; // 被暫停太久就不追了
      flush();
    }, 4);
  } else if (room) {
    handle(m);
  } else {
    queue.push(m);
  }
};
