// 多國語言，做法跟 TaiwanMahjong 的 i18n.svelte.js 一樣：原文（繁體中文）本身就是翻譯的 key。
//   t('開始比賽')                       → 'Start match'
//   t('{name} 獲勝！', { name })        → '{name} wins!'
// 翻譯放在 src/lib/i18n/<語言>/*.js（各檔匯出一個 { 原文: 譯文 } 物件，會自動合併）。
// 找不到翻譯就顯示原文，所以漏翻只會顯示中文，不會壞掉（tests/i18n.test.js 會檢查有沒有漏）。
// 語言偵測、字典合併、代入參數這些共用的部分在 VirtualCore（virtual-core/i18n/lang.js）。
//
// 房間伺服器（Rust，crates/runner-core）送來的系統訊息、錯誤、電腦玩家的名字是中文，
// 由 serverText()、displayName() 在畫面上翻，伺服器與舊版 App 不用改。

import {
  LANGUAGES,
  isLang,
  htmlLangOf,
  mergeDicts,
  loadLang,
  saveLang,
  translate,
  matchServerText,
  applyDocument,
} from 'virtual-core/i18n/lang.js';

const STORAGE_KEY = 'vr_lang';

export { LANGUAGES };

const DICTS = mergeDicts(import.meta.glob('./i18n/*/*.js', { eager: true }));

export const i18n = $state({ lang: loadLang(STORAGE_KEY) });

const apply = () => applyDocument(i18n.lang, t('虛擬跑跑樂'));

export function setLang(id) {
  if (!isLang(id)) return;
  i18n.lang = id;
  apply();
  saveLang(STORAGE_KEY, id);
}

export const htmlLang = () => htmlLangOf(i18n.lang);

/** 翻譯一段原文；{name} 之類的位置用 params 代入 */
export function t(text, params) {
  return translate(DICTS[i18n.lang], text, params);
}

apply();

/** 現在是不是中文介面（有些地方中文、外文排法不一樣，例如字距） */
export const isZh = () => i18n.lang === 'zh-TW';

/**
 * 座位上的名字：電腦玩家（伺服器取的「電腦（普通）」「電腦（代打 小明）」）翻成該語言；
 * 玩家自己取的名字不翻；沒取名的「玩家1」也翻。
 */
export function displayName(name) {
  if (!name) return name;
  let m = /^電腦（代打 (.*)）$/.exec(name);
  if (m) return t('電腦（代打 {name}）', { name: m[1] });
  m = /^電腦(?:隊友)?（(簡單|普通|困難)）$/.exec(name);
  if (m) return t('電腦（{level}）', { level: t(m[1]) });
  if (name === '觀眾') return t('觀眾');
  m = /^玩家(\d+)$/.exec(name);
  if (m) return t('玩家{n}', { n: m[1] });
  return name;
}

// 伺服器整句送來的訊息（crates/runner-core 的錯誤與系統訊息），serverText() 直接查字典。
// 列在這裡是為了讓 tests/i18n.test.js 檢查有沒有翻譯；伺服器加了新訊息要記得補。
export const SERVER_TEXTS = [
  '出發！',
  '接關！',
  '全軍覆沒……',
  '六大關全部突破！',
  '沒有人上場',
  '還沒開始',
  '現在不能接關',
  '比賽進行中',
  '比賽進行中不能換角色',
  '座位已滿',
  '這個座位有人了',
  '這個座位沒有人',
  '不能移除這個座位',
  '沒有這個角色',
  '你沒有座位',
  '只有房主可以這樣做',
  '設定格式不對',
  '不認得的指令',
];

// 帶名字或數字的句型

const SERVER_PATTERNS = [
  [/^(.*) 坐到了 (\dP)$/, (m) => t('{name} 坐到了 {seat}', { name: displayName(m[1]), seat: m[2] })],
  [/^第 (\d)-(\d) 關突破！$/, (m) => t('第 {stage} 關突破！', { stage: `${m[1]}-${m[2]}` })],
  [/^(.*) 斷線了，先由電腦代打$/, (m) => t('{name} 斷線了，先由電腦代打', { name: displayName(m[1]) })],
  [/^(.*) 離開了座位$/, (m) => t('{name} 離開了座位', { name: displayName(m[1]) })],
  [/^(.*) 獲勝！（(\d+) − (\d+)）$/, (m) => t('{name} 獲勝！（{a} − {b}）', { name: displayName(m[1]), a: m[2], b: m[3] })],
  [/^(.*)，先以觀眾身分進入$/, (m) => t('{reason}，先以觀眾身分進入', { reason: t(m[1]) })],
  [/^無法監聽埠 (\d+)：(.*)$/, (m) => t('無法監聽埠 {port}：{error}', { port: m[1], error: m[2] })],
];

/** 翻譯伺服器送來的系統訊息或錯誤 */
export function serverText(text) {
  return matchServerText(DICTS[i18n.lang], SERVER_PATTERNS, text);
}
