<script>
  // 操作提示：依目前用的是鍵盤、手把還是觸控換說法，按鍵畫成黑底小鍵帽
  import { t } from '../i18n.svelte.js';
  import { ui } from '../ui.svelte.js';

  let { extra = '' } = $props();
  const keys = $derived(
    ui.input === 'pad'
      ? [['✚', t('選擇')], ['A', t('確定')], ['B', t('返回')]]
      : ui.input === 'touch'
        ? []
        : [['Esc', t('返回')], ['↑↓←→', t('選擇')], ['Enter', t('確定')]],
  );
</script>

<div class="control-hint">
  {#if extra || !keys.length}
    <span>{extra || t('點選操作')}</span>
  {:else}
    {#each keys as [k, label] (k)}<span><kbd>{k}</kbd>{label}</span>{/each}
  {/if}
</div>

<style>
  .control-hint {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 2.2cqw;
    font-size: 2.2cqh;
    font-weight: 800;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
  span {
    display: flex;
    align-items: center;
    gap: 0.8cqh;
  }
</style>
