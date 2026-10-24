<script>
  // 左下角的「返回」
  import { play } from '../game/audio.js';
  import { t } from '../i18n.svelte.js';

  let { label, onclick } = $props();
</script>

<button
  type="button"
  class="vbtn back"
  onclick={() => {
    play('back');
    onclick();
  }}
>{label ?? t('返回')}</button>
