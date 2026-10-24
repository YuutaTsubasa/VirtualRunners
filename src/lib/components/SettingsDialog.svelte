<script>
  // 設定：畫面風格、音樂與音效音量、靜音。任何畫面都能打開（右上角齒輪、暫停選單），改了馬上生效、自動儲存。
  // 之後加多國語言時，在「偏好設定」放一列語言選項（做法同 TaiwanMahjong 的 Settings.svelte）。
  import { ART_STYLES, artStyle, setArtStyle, asset } from '../art-style.svelte.js';
  import { t, i18n, setLang, LANGUAGES } from '../i18n.svelte.js';
  import { styleProgress } from '../style-assets.js';
  import { soundSettings, setVolume, toggleMute } from '../audio/sound.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { play } from '../game/audio.js';

  let dialog;

  $effect(() => {
    if (!dialog) return;
    if (ui.settingsOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.style-card.selected')?.focus({ preventScroll: true });
    } else if (!ui.settingsOpen && dialog.open) {
      dialog.close();
    }
  });

  function choose(id) {
    play('select');
    setArtStyle(id);
  }

  function chooseLang(id) {
    play('select');
    setLang(id);
  }

  function done() {
    play('back');
    ui.settingsOpen = false;
  }
</script>

<dialog class="settings" bind:this={dialog} onclose={() => (ui.settingsOpen = false)}>
  <div class="panel">
    <div class="panel-head">{t('設定')}</div>
    <div class="panel-body">
      <h3>{t('畫面風格')}</h3>
      <div class="styles">
        {#each ART_STYLES as s (s.id)}
          {@const progress = styleProgress(s.id)}
          <button type="button" class="style-card" class:selected={artStyle.id === s.id} onclick={() => choose(s.id)}>
            <span class="pic" class:pixel={s.pixelated}>
              <img src={asset('characters/xiaochun/happy.webp', s.id)} alt="" class:pending={progress === 0} />
              {#if progress < 1}<span class="wip">{t('製作中')}</span>{/if}
            </span>
            <b>{t(s.name)}</b>
          </button>
        {/each}
      </div>

      <h3>{t('語言')}{#if i18n.lang !== 'en'}<span class="en"> · Language</span>{/if}</h3>
      <div class="langs" role="radiogroup">
        {#each LANGUAGES as l (l.id)}
          <button type="button" role="radio" aria-checked={i18n.lang === l.id} class="vbtn small" class:active={i18n.lang === l.id} onclick={() => chooseLang(l.id)}>{l.name}</button>
        {/each}
      </div>

      <h3>{t('聲音')}</h3>
      <div class="audio">
        <label class="row">
          <span>{t('音樂')}</span>
          <input type="range" min="0" max="1" step="0.05" value={soundSettings.bgm} oninput={(e) => setVolume('bgm', Number(e.currentTarget.value))} />
          <output>{Math.round(soundSettings.bgm * 100)}%</output>
        </label>
        <label class="row">
          <span>{t('音效')}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundSettings.sfx}
            oninput={(e) => setVolume('sfx', Number(e.currentTarget.value))}
            onchange={() => play('score')}
          />
          <output>{Math.round(soundSettings.sfx * 100)}%</output>
        </label>
        <div class="row mute">
          <span>{t('靜音')}</span>
          <button type="button" class="vbtn small toggle" class:active={soundSettings.muted} aria-pressed={soundSettings.muted} onclick={toggleMute}>
            {soundSettings.muted ? t('已靜音') : t('關閉')}
          </button>
          <small>{t('鍵盤 M 也可以切換')}</small>
        </div>
      </div>

      <p class="note">{t('設定會自動儲存在這台電腦上。')}</p>
      <div class="actions">
        <button type="button" class="vbtn primary" onclick={done}>{t('完成')}</button>
      </div>
    </div>
  </div>
</dialog>

<style>
  .settings {
    border: none;
    background: none;
    padding: 3cqh 1.4cqh 1.4cqh 2cqh;
    overflow: visible;
    width: 78cqw;
    max-width: 96vw;
    font-size: 2.4cqh;
    color: var(--navy);
  }
  .settings::backdrop {
    background: rgba(22, 24, 29, 0.62);
  }
  .settings > :global(.panel) {
    box-shadow: 1cqh 1cqh 0 var(--navy-deep);
  }
  .settings :global(.panel-head) {
    font-size: 4.4cqh;
    font-style: italic;
    padding: 0.4cqh 6cqh 0.6cqh 2.6cqh;
    margin-top: -2.6cqh;
  }
  .panel-body {
    padding: 1.6cqh 3cqh 2.4cqh;
  }
  h3 {
    margin: 0.6cqh 0 0;
    font-size: 2.8cqh;
    font-weight: 900;
    letter-spacing: 0.15em;
  }
  .langs {
    display: flex;
    gap: 1cqh;
    margin-bottom: 1cqh;
  }
  h3 .en {
    font-weight: 700;
    opacity: 0.6;
  }
  .styles {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1.4cqh;
  }
  .style-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6cqh;
    padding: 0.8cqh;
    border: 0.4cqh solid var(--navy);
    border-radius: 0.8cqh;
    background: var(--paper-white);
    color: var(--navy);
    font: inherit;
    cursor: pointer;
  }
  .style-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 0.4cqh var(--accent);
  }
  .style-card.selected::after {
    content: '✔';
    position: absolute;
    top: 0.2cqh;
    right: 0.8cqh;
    font-weight: 900;
    color: var(--accent);
  }
  .pic {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background:
      radial-gradient(rgba(40, 127, 120, 0.3) 22%, transparent 26%) 0 0 / 1cqh 1cqh,
      #e6efe9;
    overflow: hidden;
  }
  .pic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pic.pixel img {
    image-rendering: pixelated;
  }
  .pic img.pending {
    filter: grayscale(1) opacity(0.5);
  }
  .wip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--navy);
    color: var(--on-dark);
    font-size: 1.6cqh;
    text-align: center;
  }
  .style-card b {
    font-size: 2.2cqh;
    white-space: nowrap;
  }
  .audio {
    display: grid;
    gap: 1.2cqh;
  }
  .row {
    display: grid;
    grid-template-columns: 10cqh minmax(0, 1fr) 8cqh;
    align-items: center;
    gap: 2cqh;
    font-weight: 900;
  }
  .row input[type='range'] {
    width: 100%;
    accent-color: var(--teal);
    padding: 0;
    border: none;
    background: none;
    min-height: 3.6cqh;
  }
  .row output {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row.mute {
    grid-template-columns: 10cqh auto 1fr;
  }
  .row .toggle {
    justify-self: start;
    min-width: 16cqh;
  }
  .row small {
    font-size: 1.9cqh;
    font-weight: 700;
    color: var(--muted);
  }
  .note {
    margin: 0;
    font-size: 1.9cqh;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
