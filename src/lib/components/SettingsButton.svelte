<script>
  // 齒輪：打開設定視窗（選單畫面的角落都有）
  import { asset } from '../art-style.svelte.js';
  import { t } from '../i18n.svelte.js';
  import { openSettings } from '../ui.svelte.js';
  import { play } from '../game/audio.js';
</script>

<button
  type="button"
  class="settings-btn"
  aria-label={t('設定')}
  title={t('設定')}
  onclick={() => {
    play('select');
    openSettings();
  }}
>
  <img src={asset('ui/icons/settings.webp')} alt="" />
</button>

<style>
  .settings-btn {
    width: 8cqh;
    height: 8cqh;
    flex: none;
    padding: 0.8cqh;
    border: var(--line) solid var(--navy);
    background: var(--cream);
    box-shadow: 0.5cqh 0.5cqh 0 var(--navy);
    transition: transform 0.15s;
  }
  .settings-btn:hover {
    transform: rotate(30deg);
  }
  .settings-btn img {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
