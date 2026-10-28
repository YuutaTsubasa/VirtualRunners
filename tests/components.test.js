// 元件編譯時不能有無障礙或反應性警告。手把／鍵盤焦點導覽的純函式在 VirtualCore（virtual-core/input/controls.js），測試也在那邊。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { compile } from 'svelte/compiler';

test('every Svelte component compiles without accessibility or reactivity warnings', async () => {
  const dir = new URL('../src/lib/components/', import.meta.url);
  const files = [...(await readdir(dir)).filter((f) => f.endsWith('.svelte')).map((f) => new URL(f, dir)), new URL('../src/App.svelte', import.meta.url)];
  assert.ok(files.length >= 8);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const result = compile(source, { filename: file.pathname.split('/').pop(), generate: 'client' });
    assert.deepEqual(result.warnings.map((w) => `${file.pathname.split('/').pop()} ${w.code}: ${w.message}`), []);
  }
});
