<script>
  import { keyboardEdit, setControlValue } from '../input-controls.js';
  import { t } from '../i18n.svelte.js';

  let dialog;
  let target;
  let draft = $state('');
  let label = $state('');
  let uppercase = $state(false);
  let password = $state(false);
  let maxLength = $state(-1);
  let error = $state('');
  const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '.:/-_@'];

  export function isOpen() { return !!dialog?.open; }
  export function close() { dialog?.close(); }
  export function openFor(element) {
    if (!element || element.disabled || element.readOnly || dialog.open) return;
    target = element;
    draft = element.value ?? '';
    label = element.getAttribute('aria-label') || element.labels?.[0]?.textContent.trim() || element.placeholder || t('輸入文字');
    password = element.type === 'password';
    maxLength = element.maxLength ?? -1;
    uppercase = false;
    error = '';
    dialog.showModal();
    dialog.querySelector('[data-keyboard-key]')?.focus();
  }

  function press(key) {
    draft = keyboardEdit(draft, key, maxLength);
    error = '';
  }
  function apply() {
    if (target?.isConnected && !target.disabled && !target.readOnly) {
      if (target.type === 'number' && (draft.trim() === '' || !Number.isFinite(Number(draft)))) {
        error = t('請輸入有效的數字。');
        return;
      }
      setControlValue(target, draft);
    }
    close();
  }
  function restoreFocus() {
    if (target?.isConnected) target.focus({ preventScroll: true });
    target = null;
  }
</script>

<dialog bind:this={dialog} class="keyboard" aria-labelledby="keyboard-title" onclose={restoreFocus}>
  <header>
    <h2 id="keyboard-title">{t('手把鍵盤')} · {label}</h2>
    <button type="button" aria-label={t('取消輸入')} onclick={close}>✕</button>
  </header>
  <label class="draft-label">
    <span>{t('目前輸入')}</span>
    <input data-gamepad-skip type={password ? 'password' : 'text'} bind:value={draft} maxlength={maxLength >= 0 ? maxLength : undefined} autocomplete="off" spellcheck="false" />
  </label>
  <p class="help">{t('方向鍵選字 · A 輸入 · B 取消。中文輸入可使用裝置鍵盤；原有中文暱稱會保留。')}</p>
  <div class="keys" role="group" aria-label={t('英數與符號鍵盤')}>
    {#each rows as row}
      <div class="key-row">
        {#each Array.from(row) as letter}
          <button type="button" data-keyboard-key onclick={() => press(uppercase ? letter.toUpperCase() : letter)}>{uppercase ? letter.toUpperCase() : letter}</button>
        {/each}
      </div>
    {/each}
  </div>
  <div class="edit-actions">
    <button type="button" aria-pressed={uppercase} onclick={() => (uppercase = !uppercase)}>{uppercase ? t('大寫 ABC') : t('小寫 abc')}</button>
    <button type="button" onclick={() => press('SPACE')}>{t('空白')}</button>
    <button type="button" onclick={() => press('BACKSPACE')}>{t('退格 ⌫')}</button>
    <button type="button" onclick={() => press('CLEAR')}>{t('清除')}</button>
  </div>
  <p class="error" role="status">{error}</p>
  <footer>
    <button type="button" onclick={close}>{t('取消')}</button>
    <button type="button" class="primary" onclick={apply}>{t('套用輸入')}</button>
  </footer>
</dialog>

<style>
  .keyboard { width: min(650px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto; padding: 20px; color: var(--text); background: var(--panel-solid); border: 2px solid var(--gold); border-radius: 14px; box-shadow: 0 16px 60px #0009; }
  .keyboard::backdrop { background: #000b; }
  header, footer { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
  h2 { font-size: 19px; margin: 0; overflow-wrap: anywhere; }
  header button { flex: none; }
  .draft-label { display: grid; gap: 6px; margin-top: 16px; color: var(--muted); font-size: 13px; }
  input { width: 100%; min-height: 44px; font-size: 18px; }
  .help { color: var(--muted); font-size: 13px; line-height: 1.6; }
  .keys { display: grid; gap: 7px; }
  .key-row { display: flex; justify-content: center; gap: 6px; }
  .key-row button { width: calc((100% - 54px) / 10); min-height: 42px; padding: 6px 0; font-size: 18px; }
  .edit-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 12px; }
  .edit-actions button { min-height: 44px; }
  .error { color: var(--red); min-height: 20px; margin: 10px 0; font-size: 13px; }
  footer { justify-content: flex-end; }
  button:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
  @media (max-width: 420px) {
    .keyboard { padding: 14px; }
    .key-row { gap: 3px; }
    .key-row button { width: calc((100% - 27px) / 10); min-height: 38px; }
    .edit-actions button { padding: 8px 10px; font-size: 13px; }
  }
</style>
