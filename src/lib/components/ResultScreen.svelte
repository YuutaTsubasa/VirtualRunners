<script>
  // 過關／倒下／無盡模式結算（art-work/runner-ui-concept-v1/05-stage-clear）：疊在遊戲畫面上（後面就是終點旗門），
  // 左邊角色擺過終點的姿勢，右邊白色結算牌：圓厚的「過關！」、關卡名膠囊、三顆大星星、分數與金幣、
  // 三個星星條件（完成關卡、金幣達 70%、全程無傷）、主要行動「下一關」與兩個次要行動。
  import { onMount } from 'svelte';
  import { t } from '../i18n.svelte.js';
  import { play } from '../game/audio.js';
  import RunnerPose from './RunnerPose.svelte';

  // result：App 的 onEnd 組好的結果；actions：[{ label, action, primary }]
  let { result, actions, demo = false } = $props();

  const goal = $derived(result.kind === 'goal');
  const conditions = $derived([
    [t('完成關卡'), goal],
    [t('金幣達 70%'), result.coins * 10 >= result.coinTotal * 7],
    [t('全程無傷'), result.hits === 0],
  ]);
  const pad = (n) => String(n).padStart(7, '0');

  let box;
  onMount(() => box.querySelector('button')?.focus({ preventScroll: true }));
  function choose(a) {
    play('select');
    a.action();
  }
</script>

<section class="screen overlay result-screen">
  <div class="pose" class:down={!goal && !result.endless}>
    <RunnerPose character={result.character} size="66cqh" pose={goal || result.endless ? 'goal' : 'hurt'} />
  </div>

  <div class="sheet panel" bind:this={box}>
    <h2 class="pop-text" class:fail={!goal && !result.endless}>{result.title}</h2>
    <div class="stage">{result.stage}</div>

    {#if !result.endless}
      <div class="stars">
        {#each [0, 1, 2] as i (i)}<span class:on={i < result.stars} style="--d: {i * 0.12}s">★</span>{/each}
      </div>
    {:else}
      <div class="meters"><b>{result.meters}</b> m</div>
    {/if}

    <div class="rows">
      <div class="row"><span>{t('分數')}</span><b>{pad(result.score)}</b></div>
      {#if !result.endless}
        <div class="row"><span>{t('金幣')}</span><b><i class="coin"></i>{result.coins} / {result.coinTotal}</b></div>
      {:else}
        <div class="row"><span>{t('最高紀錄')}</span><b>{result.best.meters} m</b></div>
      {/if}
    </div>

    {#if !result.endless}
      <div class="chips">
        {#each conditions as [label, ok] (label)}
          <span class="chip" class:ok><i>{ok ? '✓' : '✕'}</i>{label}</span>
        {/each}
      </div>
    {/if}
    {#if result.record && !demo}<p class="record">{result.endless ? t('新紀錄！') : t('星星更新了！')}</p>{/if}
    {#if result.unlocked}<p class="record">{t('隱藏角色「阿翼」加入了！')}</p>{/if}
    <p class="line">「{result.line}」</p>

    {#each actions.filter((a) => a.primary) as a (a.label)}
      <button type="button" class="vbtn primary main" onclick={() => choose(a)}>{a.label}</button>
    {/each}
    <div class="more">
      {#each actions.filter((a) => !a.primary) as a (a.label)}
        <button type="button" class="vbtn small" onclick={() => choose(a)}>{a.label}</button>
      {/each}
    </div>
  </div>
</section>

<style>
  .result-screen {
    flex-direction: row;
    justify-content: center;
    gap: 2cqw;
    background: linear-gradient(90deg, color-mix(in srgb, var(--sky) 10%, transparent), color-mix(in srgb, var(--teal) 45%, transparent));
  }
  .pose {
    align-self: flex-end;
    margin-bottom: -2cqh;
    animation: run-in 0.4s ease-out;
  }
  .pose.down {
    filter: saturate(0.7);
  }
  @keyframes run-in {
    from {
      transform: translateX(-8cqw);
      opacity: 0;
    }
  }
  .sheet {
    width: 46cqw;
    padding: 0 3cqw 2cqh;
    align-items: center;
    gap: 0.8cqh;
    border-color: var(--sky);
    border-radius: 3.4cqh;
    margin-top: 7cqh;
  }
  h2 {
    margin: -5.4cqh 0 0;
    font-size: 9.4cqh;
    color: var(--accent);
  }
  h2.fail {
    color: var(--teal);
    font-size: 8cqh;
    margin-top: -4cqh;
  }
  .stage {
    padding: 0.2cqh 3cqh;
    border: 0.3cqh solid var(--teal);
    border-radius: 999px;
    color: var(--navy);
    font-weight: 900;
    font-size: 3cqh;
    letter-spacing: 0.08em;
  }
  .stars {
    display: flex;
    gap: 1.4cqw;
    font-size: 8cqh;
    line-height: 1;
  }
  .stars span {
    color: var(--muted-bg);
    -webkit-text-stroke: 0.35cqh var(--muted-line);
  }
  .stars span.on {
    color: var(--gold);
    -webkit-text-stroke: 0.4cqh var(--navy);
    animation: pop 0.35s var(--d) both cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes pop {
    from {
      transform: scale(0.3);
    }
  }
  .meters {
    font-weight: 900;
    font-size: 4cqh;
    color: var(--teal);
  }
  .meters b {
    font-size: 10cqh;
    color: var(--accent);
    -webkit-text-stroke: 0.4cqh var(--navy);
    paint-order: stroke fill;
  }
  .rows {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 0.8cqh;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3cqh 2.4cqh;
    border-radius: 999px;
    background: var(--sky-light);
    font-weight: 900;
    font-size: 2.6cqh;
  }
  .row b {
    display: flex;
    align-items: center;
    gap: 1cqh;
    font-size: 3.2cqh;
    letter-spacing: 0.06em;
  }
  .coin {
    width: 3.4cqh;
    height: 3.4cqh;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--gold) 50%, var(--paper-white)), var(--gold) 55%, var(--gold-deep));
    border: 0.25cqh solid var(--navy);
  }
  .chips {
    display: flex;
    gap: 0.8cqw;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 0.6cqh;
    padding: 0.3cqh 1.4cqh 0.3cqh 0.4cqh;
    border: 0.25cqh solid var(--muted-line);
    border-radius: 999px;
    color: var(--muted-text);
    font-weight: 900;
    font-size: 2cqh;
  }
  .chip i {
    display: grid;
    place-items: center;
    width: 2.8cqh;
    height: 2.8cqh;
    border-radius: 50%;
    background: var(--muted-bg);
    font-style: normal;
  }
  .chip.ok {
    border-color: var(--ok);
    color: var(--navy);
  }
  .chip.ok i {
    background: var(--ok);
    color: var(--on-dark);
  }
  .record {
    margin: 0;
    color: var(--accent-deep);
    font-weight: 900;
    font-size: 2.6cqh;
  }
  .line {
    margin: 0;
    font-weight: 800;
    font-size: 2.1cqh;
    color: var(--navy-soft);
  }
  .main {
    align-self: stretch;
    min-height: 7.4cqh;
    font-size: 3.8cqh;
  }
  .more {
    display: flex;
    gap: 1.2cqw;
  }
</style>
