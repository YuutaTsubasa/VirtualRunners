// 多國語言：程式裡每一段畫面上的中文（含中文的字串）都要有英文、日文翻譯，
// 翻譯裡的 {name} 之類的位置要跟原文一樣。漏翻的話這裡會列出來。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');
const CJK = /[぀-ヿ㐀-鿿！-｠]/;

// 不是畫面上的字：資料清單、音色表
const SKIP_FILES = new Set(['src/lib/audio/synth.js', 'src/lib/audio/songs.js', 'src/lib/audio/music.js']);
// 不用翻的字：語言名稱（每種語言都用自己的寫法）、程式裡比對用的字
const IGNORE = new Set(['中文', '日本語', '左邊']);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'i18n' ? [] : files(p);
    return /\.(js|svelte)$/.test(name) ? [p] : [];
  });
}

// 去掉註解（// 與 /* */ 與 <!-- -->），再找出含中文的字串常值
function literals(code) {
  const out = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      i = code.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      i = code.indexOf('*/', i) + 2;
      continue;
    }
    if (code.startsWith('<!--', i)) {
      i = code.indexOf('-->', i) + 3;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let s = '';
      while (j < code.length && code[j] !== c && code[j] !== '\n') {
        if (code[j] === '\\') {
          s += code[j + 1];
          j += 2;
        } else s += code[j++];
      }
      if (code[j] === c) {
        if (CJK.test(s)) out.push(s);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

async function dict(lang) {
  const dir = join(SRC, 'lib', 'i18n', lang);
  const all = {};
  for (const name of readdirSync(dir)) {
    const mod = await import(new URL(`../src/lib/i18n/${lang}/${name}`, import.meta.url));
    Object.assign(all, mod.default);
  }
  return all;
}

const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every on-screen Chinese string has English and Japanese translations', async () => {
  const keys = new Map(); // 原文 → 第一次出現的檔案
  for (const f of files(SRC)) {
    const rel = relative(ROOT, f).replaceAll('\\', '/');
    if (SKIP_FILES.has(rel)) continue;
    for (const s of literals(readFileSync(f, 'utf8'))) if (!keys.has(s) && !IGNORE.has(s)) keys.set(s, rel);
  }
  for (const s of ['簡單', '普通', '困難']) keys.set(s, 'difficulty');

  for (const lang of ['en', 'ja']) {
    const d = await dict(lang);
    const missing = [...keys].filter(([k]) => !(k in d)).map(([k, f]) => `${f}: ${k}`);
    assert.deepEqual(missing, [], `${lang} 漏翻：\n${missing.join('\n')}`);
    for (const [k, v] of Object.entries(d)) {
      assert.equal(params(v), params(k), `${lang}「${k}」的 {…} 跟原文不一樣`);
      if (lang === 'en') assert.ok(!CJK.test(v), `en「${k}」還有中文：${v}`);
    }
  }
});
