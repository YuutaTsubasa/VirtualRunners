// 遊戲中的輸入：鍵盤、手把、觸控按鈕合在一起。每個影格呼叫 read(slot) 取得該玩家的輸入。
// （選單的操作在 src/lib/components/Controls.svelte）

// 跑酷只有三個鍵：跳（剛按下）、滑（按住）、衝（剛按下）。三組配置都能用：
const KEYMAPS = [
  // WASD：W／K 跳、S 滑、J 衝
  { left: [], right: [], up: [], down: ['KeyS'], attack: ['KeyJ', 'KeyD'], jump: ['KeyW', 'KeyK'], special: ['KeyL'] },
  // 方向鍵：↑ 跳、↓ 滑、→ 衝
  { left: [], right: [], up: [], down: ['ArrowDown'], attack: ['ArrowRight'], jump: ['ArrowUp'], special: [] },
  // 空白鍵／X 跳、C／Shift 滑、Z 衝
  { left: [], right: [], up: [], down: ['KeyC', 'ShiftLeft', 'ShiftRight'], attack: ['KeyZ', 'Enter'], jump: ['KeyX', 'Space'], special: [] },
];
export const SOLO_KEYMAPS = [0, 1, 2];

const held = new Set();
const pressedThisFrame = new Set();

const BUTTONS = ['attack', 'jump', 'special'];
const blank = () => ({ left: false, right: false, up: false, down: false, attack: false });
const touch = [blank(), blank()];
const touchPressed = [new Set(), new Set()];

function typing(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable]');
}

window.addEventListener('keydown', (e) => {
  if (e.repeat || typing(e.target)) return;
  held.add(e.code);
  pressedThisFrame.add(e.code);
  // 遊戲中空白鍵、方向鍵不要捲動頁面
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault?.();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => {
  held.clear();
  touch.forEach((t) => Object.assign(t, blank()));
});

// ---------- 手把（標準配置：A／LB／十字鍵上 跳、B／十字鍵下 滑、X／Y／RB 衝） ----------

const padPrev = new Map();

function standardPads() {
  let pads = [];
  try {
    pads = navigator.getGamepads?.() ?? [];
  } catch {
    // 某些瀏覽器在非安全環境會擋
  }
  return [...pads].filter((p) => p?.connected && (!p.mapping || p.mapping === 'standard'));
}

function readPad(pad) {
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  const btn = (i) => !!pad.buttons[i]?.pressed;
  const now = { attack: btn(2) || btn(5), jump: btn(0) || btn(4) || btn(12) || ay < -0.6, special: btn(3) || btn(7) };
  const prev = padPrev.get(pad.index) ?? {};
  padPrev.set(pad.index, now);
  return {
    left: ax < -0.4 || btn(14),
    right: ax > 0.4 || btn(15),
    up: ay < -0.5 || btn(12),
    down: ay > 0.5 || btn(13) || btn(1) || btn(6),
    attack: now.attack,
    attackPressed: now.attack && !prev.attack,
    jumpPressed: now.jump && !prev.jump,
    specialPressed: now.special && !prev.special,
  };
}

// ---------- 觸控（TouchControls.svelte 呼叫） ----------

export function setTouch(slot, patch) {
  Object.assign(touch[slot], patch);
}
/** 觸控按鈕按下：button = attack | jump | special；按住滑用 setTouch(slot, { down }) */
export function pressTouch(slot, button) {
  touchPressed[slot].add(button);
  if (button === 'attack') touch[slot].attack = true;
}
export function releaseTouch(slot, button) {
  if (button === 'attack') touch[slot].attack = false;
}
export function clearTouch() {
  touch.forEach((t) => Object.assign(t, blank()));
}

/**
 * 讀一個玩家的輸入。
 * keymaps：要讀哪幾組鍵盤；pads：'all'（所有手把）或手把順序的陣列（第幾支手把，不是 index）；
 * touch：讀哪一組觸控按鈕。
 */
export function read(slot, { keymaps = [slot], pads = [slot], touch: touchSlot = slot } = {}) {
  const any = (codes) => codes.some((c) => held.has(c));
  const anyPressed = (codes) => codes.some((c) => pressedThisFrame.has(c));
  const input = { left: false, right: false, up: false, down: false, attack: false, attackPressed: false, jumpPressed: false, specialPressed: false };
  const merge = (src) => {
    for (const key of Object.keys(input)) input[key] ||= !!src[key];
  };
  for (const k of keymaps) {
    const map = KEYMAPS[k];
    if (!map) continue;
    merge({
      left: any(map.left),
      right: any(map.right),
      up: any(map.up),
      down: any(map.down),
      attack: any(map.attack),
      attackPressed: anyPressed(map.attack),
      jumpPressed: anyPressed(map.jump),
      specialPressed: anyPressed(map.special),
    });
  }
  const connected = standardPads();
  const chosen = pads === 'all' ? connected : pads.map((i) => connected[i]).filter(Boolean);
  for (const pad of chosen) merge(readPad(pad));
  if (touchSlot != null && touch[touchSlot]) {
    merge(touch[touchSlot]);
    for (const b of BUTTONS) if (touchPressed[touchSlot].has(b)) input[`${b}Pressed`] = true;
  }
  return input;
}

// 一個模擬影格結束後清掉「剛按下」的紀錄
export function endFrame() {
  pressedThisFrame.clear();
  touchPressed.forEach((s) => s.clear());
}

// 轉成送給引擎的位元：8 下（按住＝滑）、32 衝、64 跳、128 也算衝（剛按下）；其他位元保留給選單
export function toBits(i) {
  return (
    (i.left ? 1 : 0) |
    (i.right ? 2 : 0) |
    (i.up ? 4 : 0) |
    (i.down ? 8 : 0) |
    (i.attack ? 16 : 0) |
    (i.attackPressed ? 32 : 0) |
    (i.jumpPressed ? 64 : 0) |
    (i.specialPressed ? 128 : 0)
  );
}

// 連線時「按下」改送累計次數（各 8 位元：攻擊、跳、必殺），封包掉了也不會漏按
export function createPressCounter() {
  let a = 0;
  let j = 0;
  let s = 0;
  return (i) => {
    if (i.attackPressed) a = (a + 1) & 0xff;
    if (i.jumpPressed) j = (j + 1) & 0xff;
    if (i.specialPressed) s = (s + 1) & 0xff;
    return a | (j << 8) | (s << 16);
  };
}
