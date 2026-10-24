// 關卡模式的進度與無盡模式的最高紀錄（存在這台電腦）
import { WORLD_COUNT, STAGE_COUNT } from './constants.js';

const STARS_KEY = 'vr_stars';
const BEST_KEY = 'vr_endless_best';
const CHAR_KEY = 'vr_character';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 不能存就算了
  }
}

const index = (world, stage) => world * STAGE_COUNT + stage;

/** 每一關拿過最多幾顆星（0 = 還沒過） */
export function starsOf(world, stage) {
  return read(STARS_KEY, [])[index(world, stage)] ?? 0;
}

/** 過關：記下星星，回傳是不是新紀錄 */
export function recordStars(world, stage, stars) {
  const all = read(STARS_KEY, []);
  const i = index(world, stage);
  if ((all[i] ?? 0) >= stars) return false;
  all[i] = stars;
  write(STARS_KEY, all);
  return true;
}

/** 這一關能不能玩：第一關一定能玩，其他要前一關過了 */
export function stageOpen(world, stage) {
  const i = index(world, stage);
  if (i === 0) return true;
  return starsOf(Math.floor((i - 1) / STAGE_COUNT), (i - 1) % STAGE_COUNT) > 0;
}

/** 這一大關能不能選（第一小關開了就能選） */
export const worldOpen = (world) => stageOpen(world, 0);

export function totalStars() {
  return read(STARS_KEY, []).reduce((a, b) => a + (b ?? 0), 0);
}
export const MAX_STARS = WORLD_COUNT * STAGE_COUNT * 3;

/** 下一個還沒過的關（關卡地圖一開始停在這裡） */
export function nextStage() {
  for (let w = 0; w < WORLD_COUNT; w++) for (let s = 0; s < STAGE_COUNT; s++) if (!starsOf(w, s)) return { world: w, stage: s };
  return { world: WORLD_COUNT - 1, stage: STAGE_COUNT - 1 };
}

/** 無盡模式最高紀錄：{ score, meters } */
export function endlessBest() {
  return read(BEST_KEY, { score: 0, meters: 0 });
}
export function recordEndless(score, meters) {
  const best = endlessBest();
  const better = score > best.score;
  write(BEST_KEY, { score: Math.max(score, best.score), meters: Math.max(meters, best.meters) });
  return better;
}

export function savedCharacter() {
  try {
    return localStorage.getItem(CHAR_KEY) || 'xiaocui';
  } catch {
    return 'xiaocui';
  }
}
export function saveCharacter(id) {
  try {
    localStorage.setItem(CHAR_KEY, id);
  } catch {
    // 不能存就算了
  }
}
