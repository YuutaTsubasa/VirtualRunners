// 音效的入口：比賽事件與介面都呼叫 play(名稱)。實際的 PC-98 音色在 src/lib/audio/sound.svelte.js。

import { sfx, soundSettings, toggleMute as toggle } from '../audio/sound.svelte.js';

// 舊名稱（比賽事件、介面元件用的）→ 音效
const ALIAS = {
  select: 'confirm', // 按下選單項目
  move: 'cursor', // 游標移動
};

export function play(name) {
  try {
    sfx[ALIAS[name] ?? name]?.();
  } catch {
    // 沒有音效裝置就算了
  }
}

export function toggleMute() {
  return toggle();
}

export function isMuted() {
  return soundSettings.muted;
}
