const SECRET = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B', 'A'];

export function createCheatTracker() {
  let pending = [];
  return {
    get progress() { return pending.length; },
    reset() { pending = []; },
    feed(token) {
      pending.push(token);
      // Retain a matching suffix so an extra initial ↑ can begin a new attempt.
      while (pending.length && !pending.every((value, i) => value === SECRET[i])) pending.shift();
      if (pending.length !== SECRET.length) return false;
      pending = [];
      return true;
    },
  };
}

export function isEditableTarget(target) {
  return !!(target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

export function keyToControl(event) {
  if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return null;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return event.key;
  const upper = event.key?.toUpperCase();
  return upper === 'A' || upper === 'B' ? upper : null;
}

/** Standard gamepad mapping: 0=A, 1=B, 12–15=D-pad; left stick has a 0.55 deadzone.
 * Confirm/back are rising edges only. Direction repeats navigate but never advance a secret code.
 */
export function gamepadCommands(pad, previous = {}, now = 0) {
  const pressed = index => !!pad?.buttons?.[index]?.pressed || pad?.buttons?.[index]?.value > 0.5;
  let direction = [12, 13, 14, 15].map((index, i) => pressed(index) ? ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'][i] : null).find(Boolean) ?? null;
  const [x = 0, y = 0] = pad?.axes ?? [];
  if (!direction && Math.max(Math.abs(x), Math.abs(y)) > 0.55) {
    direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'ArrowRight' : 'ArrowLeft') : (y > 0 ? 'ArrowDown' : 'ArrowUp');
  }
  const a = pressed(0);
  const b = pressed(1);
  const commands = [];
  let repeatAt = previous.repeatAt ?? 0;
  if (direction && direction !== previous.direction) {
    commands.push({ token: direction, repeat: false });
    repeatAt = now + 380;
  } else if (direction && now >= repeatAt) {
    commands.push({ token: direction, repeat: true });
    repeatAt = now + 150;
  }
  if (b && !previous.b) commands.push({ token: 'B', repeat: false });
  if (a && !previous.a) commands.push({ token: 'A', repeat: false });
  return { commands, snapshot: { direction, a, b, repeatAt } };
}

/** Spatial navigation receives only enabled, visible semantic controls from the DOM layer. */
export function chooseDirectionalTarget(boxes, current, direction) {
  if (!boxes.length) return -1;
  if (current < 0 || !boxes[current]) {
    return boxes.reduce((best, box, index) => box.top < boxes[best].top ||
      (box.top === boxes[best].top && box.left < boxes[best].left) ? index : best, 0);
  }
  const center = box => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  const origin = center(boxes[current]);
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
  const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
  let best = current;
  let bestDistance = Infinity;
  boxes.forEach((box, index) => {
    if (index === current) return;
    const point = center(box);
    const primary = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
    const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
    if (primary <= 1) return;
    const distance = primary + cross * 3;
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

/** Work in step units to avoid accumulating binary-float errors in volume sliders. */
export function steppedValue(control, direction) {
  const finite = (value, fallback) => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const min = finite(control.min, control.type === 'range' ? 0 : -Infinity);
  const max = finite(control.max, control.type === 'range' ? 100 : Infinity);
  const base = Number.isFinite(min) ? min : 0;
  const configuredStep = finite(control.step, 1);
  const step = configuredStep > 0 ? configuredStep : 1;
  const current = finite(control.value, base);
  const units = (current - base) / step;
  const nextUnit = direction > 0 ? Math.floor(units + 1e-9) + 1 : Math.ceil(units - 1e-9) - 1;
  const next = Math.min(max, Math.max(min, base + nextUnit * step));
  return String(Number(next.toFixed(10)));
}

export function keyboardEdit(value, key, maxLength = -1) {
  if (key === 'BACKSPACE') return Array.from(value).slice(0, -1).join('');
  if (key === 'CLEAR') return '';
  const addition = key === 'SPACE' ? ' ' : key;
  return maxLength >= 0 && value.length + addition.length > maxLength ? value : value + addition;
}

export function setControlValue(control, value) {
  if (!control || control.disabled || control.readOnly || control.value === String(value)) return false;
  control.value = String(value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function nextSelectIndex(options, current, direction) {
  for (let index = current + direction; index >= 0 && index < options.length; index += direction) {
    if (!options[index].disabled && !options[index].parentElement?.disabled) return index;
  }
  return current;
}
