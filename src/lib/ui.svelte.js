// 介面共用狀態：最後用的是哪種輸入（決定要不要顯示焦點框、觸控按鈕）
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const ui = $state({
  input: coarse ? 'touch' : 'pointer', // pointer | touch | key | pad
  settingsOpen: false, // 設定視窗（任何畫面都能開）
});

export function openSettings() {
  ui.settingsOpen = true;
}

export function setInputKind(kind) {
  if (ui.input === kind) return;
  ui.input = kind;
  document.documentElement.dataset.input = kind;
}

if (typeof document !== 'undefined') document.documentElement.dataset.input = ui.input;
