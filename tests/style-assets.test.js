import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ART_STYLES, assetPath, hasAsset, styleProgress, styleConfig, OPTIONAL, EXPECTED_FILES } from '../src/lib/style-assets.js';

const MANIFEST = JSON.parse(readFileSync(new URL('../src/lib/style-assets.json', import.meta.url), 'utf8'));

test('six styles share TaiwanMahjong ids', () => {
  assert.deepEqual(ART_STYLES.map((s) => s.id), ['anime90', 'pc98', 'msdos', 'taiwan-print', 'gameboy', 'modern-paint']);
});

test('anime90 base art lives at the public root; missing style art falls back to it', () => {
  assert.equal(assetPath('anime90', 'game/court.webp', '/'), '/game/court.webp');
  for (const style of ART_STYLES.map((s) => s.id)) {
    const path = 'characters/xiaochun/happy.webp';
    const expected = hasAsset(style, path) && style !== 'anime90' ? `/styles/${style}/${path}` : `/${path}`;
    assert.equal(assetPath(style, path, '/'), expected);
  }
});

test('optional illustrations are only used by the style that delivered them', () => {
  for (const style of ART_STYLES.map((s) => s.id)) {
    for (const path of OPTIONAL) {
      const delivered = !!MANIFEST.styles[style]?.files?.includes(path);
      assert.equal(assetPath(style, path, '/') === null, !delivered, `${style} ${path}`);
    }
  }
});

test('every file listed in the manifest exists under public/', () => {
  for (const [style, { files = [] }] of Object.entries(MANIFEST.styles)) {
    for (const f of files) {
      const p = new URL(`../public/${style === 'anime90' ? '' : `styles/${style}/`}${f}`, import.meta.url);
      assert.ok(existsSync(p), `${style}: ${f}`);
    }
  }
});

test('progress and config defaults', () => {
  assert.equal(styleProgress('anime90'), 1);
  assert.ok(EXPECTED_FILES > 80);
  assert.equal(styleConfig('gameboy').pixelated, true);
  assert.equal(styleConfig('anime90').canvasScale, 2);
  assert.equal(styleConfig('anime90').spriteAnchorY, 496 / 512);
  // 各風格交件時給的設定會蓋掉 90 年代的預設值，沒給的維持預設
  for (const style of ART_STYLES.map((s) => s.id)) {
    const own = MANIFEST.styles[style]?.config?.spriteAnchorY;
    assert.equal(styleConfig(style).spriteAnchorY, own ?? 496 / 512, style);
  }
});
