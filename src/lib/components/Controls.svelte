<script>
  // 選單操作：鍵盤、手把、滑鼠／觸控走同一條路（做法跟 TaiwanMahjong 的 Controls.svelte 一樣）。
  // - 方向鍵／十字鍵／左搖桿：在畫面上的按鈕之間移動焦點
  // - Enter／空白鍵／手把 A：按下（文字欄位用手把按 A 會開手把鍵盤）
  // - Esc／手把 B：返回；比賽中 Esc、P、手把 Start：暫停
  // - 在選單輸入 ↑↑↓↓←→←→BA：解鎖隱藏角色
  //   觸控：用手指滑 ↑↑↓↓←→←→，再點畫面左半邊（B）、右半邊（A）
  import { onMount } from 'svelte';
  import {
    createCheatTracker,
    gamepadCommands,
    isEditableTarget,
    keyToControl,
    chooseDirectionalTarget,
    steppedValue,
    setControlValue,
    nextSelectIndex,
  } from '../input-controls.js';
  import { setInputKind } from '../ui.svelte.js';
  import { unlockHidden } from '../game/characters.js';
  import { toast } from '../net.svelte.js';
  import ControlsKeyboard from './ControlsKeyboard.svelte';
  import { t } from '../i18n.svelte.js';

  // inGame：正在比賽（方向鍵、手把是拿來打球的，不做選單操作）
  let { inGame = false, onback = () => {}, onpause = () => {} } = $props();

  let keyboard;
  const cheat = createCheatTracker();

  // 比賽剛結束時還在狂按擊球鍵，先擋一下確認鍵，免得誤按「再來一場」
  const LOCK_MS = 800;
  let lockUntil = 0;
  let wasInGame = false;
  $effect(() => {
    if (wasInGame && !inGame) lockUntil = performance.now() + LOCK_MS;
    wasInGame = inGame;
  });
  const locked = () => performance.now() < lockUntil;

  function visible(element) {
    return (
      element.getClientRects().length > 0 &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
      getComputedStyle(element).visibility !== 'hidden'
    );
  }

  function controls() {
    const dialogs = [...document.querySelectorAll('dialog[open]')].filter(visible);
    const scope = dialogs.at(-1) ?? document.querySelector('#stage') ?? document;
    return [
      ...scope.querySelectorAll('button, a[href], select, textarea, input:not([type="hidden"]), [role="button"][tabindex="0"]'),
    ].filter((el) => !el.matches(':disabled, [disabled], [aria-disabled="true"], [tabindex="-1"], [data-gamepad-skip]') && visible(el));
  }

  function moveFocus(direction) {
    const candidates = controls();
    const next = chooseDirectionalTarget(
      candidates.map((el) => el.getBoundingClientRect()),
      candidates.indexOf(document.activeElement),
      direction,
    );
    if (next < 0) return false;
    candidates[next].focus({ preventScroll: true });
    candidates[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function back() {
    const dialog = [...document.querySelectorAll('dialog[open]')].filter(visible).at(-1);
    if (dialog) dialog.close('cancel');
    else onback();
  }

  function feedSecret(token) {
    if (inGame || !cheat.feed(token)) return false;
    if (unlockHidden()) toast(t('隱藏角色「阿翼」解鎖了！'), 'ok');
    else toast(t('阿翼已經在等你了。'), 'ok');
    return true;
  }

  // 觸控版秘技：滑動當方向鍵；滑完 8 下之後，點左半邊是 B、右半邊是 A
  const SWIPE_PX = 40;
  const SWIPE_MS = 700;
  let touchStart = null;
  function touchstart(event) {
    if (inGame || event.touches.length !== 1) return (touchStart = null);
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, at: performance.now() };
  }
  function touchend(event) {
    const start = touchStart;
    touchStart = null;
    if (!start || inGame || event.changedTouches.length !== 1) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (performance.now() - start.at > SWIPE_MS) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
      const token = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : dy < 0 ? 'ArrowUp' : 'ArrowDown';
      feedSecret(token);
    } else if (cheat.progress >= 8) {
      feedSecret(t.clientX < innerWidth / 2 ? 'B' : 'A');
    }
  }

  function keydown(event) {
    setInputKind('key');
    const confirm = event.key === 'Enter' || event.key === ' ';
    if (confirm && locked()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (inGame) {
      if (!event.repeat && (event.key === 'Escape' || event.code === 'KeyP')) onpause();
      return;
    }
    if (event.defaultPrevented || event.isComposing) return;
    if (isEditableTarget(event.target)) {
      // 在輸入框按 Esc：先離開輸入框
      if (event.key === 'Escape') event.target.blur();
      return;
    }
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (!event.repeat) back();
      event.preventDefault();
      return;
    }
    const token = keyToControl(event);
    if (!token) {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) cheat.reset();
      return;
    }
    if (!event.repeat && !document.querySelector('dialog[open]') && feedSecret(token)) {
      event.preventDefault();
      return;
    }
    if (token.startsWith('Arrow') && moveFocus(token)) event.preventDefault();
  }

  function keyup(event) {
    // 空白鍵是在放開時按下按鈕的
    if (event.key === ' ' && locked()) event.preventDefault();
  }

  function gamepadCommand({ token, repeat }) {
    const active = document.activeElement;
    const modal = !!document.querySelector('dialog[open]');
    if (!modal && !isEditableTarget(active) && !repeat && feedSecret(token)) return;
    // 秘技的倒數第二個是 B，不要因此離開畫面
    if (!modal && token === 'B' && cheat.progress === 9) return;
    if (token.startsWith('Arrow')) {
      const horizontal = token === 'ArrowLeft' || token === 'ArrowRight';
      const direction = token === 'ArrowLeft' ? -1 : 1;
      if (horizontal && active?.matches('input[type="range"], input[type="number"]') && !active.disabled && !active.readOnly) {
        setControlValue(active, steppedValue(active, direction));
      } else if (horizontal && active?.matches('select') && !active.disabled) {
        const next = nextSelectIndex(active.options, active.selectedIndex, direction);
        if (next >= 0) setControlValue(active, active.options[next].value);
      } else moveFocus(token);
    } else if (token === 'B') back();
    else if (token === 'A') {
      if (locked()) return;
      const candidates = controls();
      if (!candidates.includes(active)) {
        moveFocus('ArrowDown');
        return;
      }
      if (active.matches('textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])')) {
        keyboard.openFor(active);
      } else if (active.matches('select')) {
        const next = nextSelectIndex(active.options, active.selectedIndex, 1);
        setControlValue(active, active.options[next === active.selectedIndex ? 0 : next].value);
      } else active.click();
    }
  }

  onMount(() => {
    let frame;
    let disposed = false;
    const snapshots = new Map();
    const startPrev = new Map();
    function poll(now) {
      if (disposed) return;
      let pads = [];
      try {
        pads = navigator.getGamepads?.() ?? [];
      } catch {
        // 非安全環境可能不給讀手把
      }
      const connected = new Set();
      for (const pad of pads) {
        if (!pad?.connected || (pad.mapping && pad.mapping !== 'standard')) continue;
        connected.add(pad.index);
        const result = gamepadCommands(pad, snapshots.get(pad.index), now);
        snapshots.set(pad.index, result.snapshot);
        const start = !!pad.buttons[9]?.pressed;
        const startEdge = start && !startPrev.get(pad.index);
        startPrev.set(pad.index, start);
        if (result.commands.length || startEdge || pad.buttons.some((b) => b.pressed)) setInputKind('pad');
        if (document.hidden) continue;
        if (inGame) {
          if (startEdge) onpause();
          continue;
        }
        result.commands.forEach(gamepadCommand);
      }
      for (const index of snapshots.keys()) if (!connected.has(index)) snapshots.delete(index);
      frame = requestAnimationFrame(poll);
    }
    const pointerdown = (e) => setInputKind(e.pointerType === 'touch' ? 'touch' : 'pointer');
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('pointerdown', pointerdown, true);
    window.addEventListener('touchstart', touchstart, { capture: true, passive: true });
    window.addEventListener('touchend', touchend, { capture: true, passive: true });
    frame = requestAnimationFrame(poll);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('pointerdown', pointerdown, true);
      window.removeEventListener('touchstart', touchstart, true);
      window.removeEventListener('touchend', touchend, true);
    };
  });
</script>

<ControlsKeyboard bind:this={keyboard} />
