import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import * as input from '../src/lib/input-controls.js';
const { createCheatTracker, gamepadCommands, isEditableTarget, keyToControl, chooseDirectionalTarget } = input;

const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B', 'A'];
test('secret code requires the complete ordered sequence and resets after errors or completion', () => {
  const tracker = createCheatTracker();
  assert.deepEqual(code.map(tracker.feed), [false, false, false, false, false, false, false, false, false, true]);
  assert.equal(tracker.feed('A'), false);
  tracker.reset();
  code.slice(0, 4).forEach(tracker.feed);
  tracker.feed('X');
  assert.equal(code.slice(4).some(tracker.feed), false);
  tracker.reset();
  tracker.feed('ArrowUp');
  assert.equal(code.map(tracker.feed).at(-1), true, 'overlapping prefix restarts cleanly');
});

test('secret code progress can consume the B step before menu back navigation', () => {
  const tracker = createCheatTracker();
  code.slice(0, 9).forEach(tracker.feed);
  assert.equal(tracker.progress, 9);
  tracker.reset();
  assert.equal(tracker.progress, 0);
});

test('text, select, and native form controls keep their keyboard behavior', () => {
  assert.equal(keyToControl({ key: 'a' }), 'A');
  assert.equal(keyToControl({ key: 'B' }), 'B');
  assert.equal(keyToControl({ key: 'Enter' }), null);
  assert.equal(keyToControl({ key: 'ArrowLeft', ctrlKey: true }), null);
  assert.equal(isEditableTarget({ closest: () => ({ tagName: 'INPUT' }) }), true);
  assert.equal(isEditableTarget({ closest: () => null, isContentEditable: true }), true);
  assert.equal(isEditableTarget({ closest: () => null }), false);
  assert.equal(isEditableTarget(null), false);
});

function pad(buttons = [], axes = [0, 0]) {
  return { buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })), axes };
}
test('A and B only fire on rising edges, while held directions repeat after a delay', () => {
  let result = gamepadCommands(pad([0, 12]), undefined, 0);
  assert.deepEqual(result.commands, [{ token: 'ArrowUp', repeat: false }, { token: 'A', repeat: false }]);
  result = gamepadCommands(pad([0, 12]), result.snapshot, 100);
  assert.deepEqual(result.commands, []);
  result = gamepadCommands(pad([0, 12]), result.snapshot, 400);
  assert.deepEqual(result.commands, [{ token: 'ArrowUp', repeat: true }]);
  result = gamepadCommands(pad(), result.snapshot, 450);
  result = gamepadCommands(pad([0, 1]), result.snapshot, 500);
  assert.deepEqual(result.commands, [{ token: 'B', repeat: false }, { token: 'A', repeat: false }]);
});

test('left stick uses a deadzone and a single dominant direction', () => {
  assert.deepEqual(gamepadCommands(pad([], [0.3, -0.3])).commands, []);
  assert.deepEqual(gamepadCommands(pad([], [0.8, -0.7])).commands, [{ token: 'ArrowRight', repeat: false }]);
  assert.deepEqual(gamepadCommands(pad([], [0, -0.8])).commands, [{ token: 'ArrowUp', repeat: false }]);
});

test('spatial focus moves along visible rows and columns without wrapping to unrelated controls', () => {
  const boxes = [{ left: 0, top: 0, width: 80, height: 40 }, { left: 100, top: 0, width: 80, height: 40 }, { left: 0, top: 80, width: 80, height: 40 }];
  assert.equal(chooseDirectionalTarget(boxes, -1, 'ArrowDown'), 0);
  assert.equal(chooseDirectionalTarget(boxes, 0, 'ArrowRight'), 1);
  assert.equal(chooseDirectionalTarget(boxes, 0, 'ArrowDown'), 2);
  assert.equal(chooseDirectionalTarget(boxes, 0, 'ArrowLeft'), 0);
  assert.equal(chooseDirectionalTarget([], -1, 'ArrowLeft'), -1);
  assert.equal(chooseDirectionalTarget([boxes[2], boxes[0], boxes[1]], -1, 'ArrowDown'), 1, 'initial focus follows visible layout even when footer precedes page in DOM');
});

test('range and numeric controls step exactly, clamp, and handle empty numeric values', () => {
  assert.equal(typeof input.steppedValue, 'function');
  assert.equal(input.steppedValue({ value: '0.1', min: '0', max: '1', step: '0.05' }, 1), '0.15');
  assert.equal(input.steppedValue({ value: '1', min: '0', max: '1', step: '0.05' }, 1), '1');
  assert.equal(input.steppedValue({ value: '0', min: '0', max: '1', step: '0.05' }, -1), '0');
  assert.equal(input.steppedValue({ value: '10', min: '0', step: '5' }, -1), '5');
  assert.equal(input.steppedValue({ value: '', min: '1', max: '65535' }, 1), '2');
});

test('virtual keyboard preserves existing Chinese and supports address punctuation, case, delete and limits', () => {
  assert.equal(typeof input.keyboardEdit, 'function');
  assert.equal(input.keyboardEdit('悠太翼', 'a'), '悠太翼a');
  assert.equal(input.keyboardEdit('local', ':'), 'local:');
  assert.equal(input.keyboardEdit('abc', 'SPACE'), 'abc ');
  assert.equal(input.keyboardEdit('abc', 'BACKSPACE'), 'ab');
  assert.equal(input.keyboardEdit('abc', 'CLEAR'), '');
  assert.equal(input.keyboardEdit('abc', 'd', 3), 'abc');
  assert.equal(input.keyboardEdit('a😀', 'BACKSPACE'), 'a');
});

test('changing a control dispatches native input/change events, respecting disabled and readonly fields', () => {
  assert.equal(typeof input.setControlValue, 'function');
  class Field extends EventTarget { value = 'old'; disabled = false; readOnly = false; }
  const field = new Field();
  const seen = [];
  field.addEventListener('input', () => seen.push(`input:${field.value}`));
  field.addEventListener('change', () => seen.push(`change:${field.value}`));
  assert.equal(input.setControlValue(field, 'new'), true);
  assert.deepEqual(seen, ['input:new', 'change:new']);
  field.disabled = true;
  assert.equal(input.setControlValue(field, 'other'), false);
  assert.equal(field.value, 'new');
});

test('select navigation skips disabled options and stops at its ends', () => {
  assert.equal(typeof input.nextSelectIndex, 'function');
  const options = [{ disabled: false }, { disabled: true }, { disabled: false }];
  assert.equal(input.nextSelectIndex(options, 0, 1), 2);
  assert.equal(input.nextSelectIndex(options, 2, 1), 2);
  assert.equal(input.nextSelectIndex(options, 2, -1), 0);
});

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
