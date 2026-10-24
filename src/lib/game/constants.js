// 畫面與跑道的常數：要跟 crates/runner-core/src/course.rs、run.rs 一致（畫面用）
export const W = 960;
export const H = 540;
export const GROUND = 450;
/** 跑者在畫面上的 x（鏡頭 = 跑者 x − 這個） */
export const SCREEN_X = 230;
export const MAX_PLAYERS = 8;
export const WORLD_COUNT = 6;
export const STAGE_COUNT = 8;
/** 開跑前的倒數（影格） */
export const COUNTDOWN = 180;

export const DIFFICULTIES = { easy: '簡單', normal: '普通', hard: '困難' };

// 1P～8P 的代表色（名牌、進度條）
export const SLOT_COLORS = ['#ff4d5e', '#3d8bff', '#3fc46b', '#ffc93c', '#b06bff', '#ff8a3d', '#2fd0d0', '#ff7ac8'];

// 背景圖的地板線（沿用虛擬闖天下的背景：地板從畫面的 340 開始）
export const Z_TOP = 340;
export const Z_BOTTOM = 520;
