<script>
  // 操作說明：鍵盤／手把／觸控對照表與小技巧
  import { asset } from '../art-style.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import { t } from '../i18n.svelte.js';
  import BackButton from './BackButton.svelte';
  import ControlHint from './ControlHint.svelte';

  let { onback } = $props();
  const ROWS = [
    ['跳（再按一次二段跳）', 'W／K', '↑', '空白鍵／X', 'A／LB／十字鍵上', '「跳」'],
    ['滑（按住）', 'S', '↓', 'C／Shift', 'B／十字鍵下', '「滑」'],
    ['衝（地上衝刺、空中追擊）', 'J／D', '→', 'Z／Enter', 'X／Y／RB', '「衝」'],
    ['暫停', 'Esc／P', 'Esc／P', 'Esc／P', 'Start', '上方暫停鈕'],
  ];
</script>

<ScreenFrame title={t('操作說明')} subtitle={t('鍵盤・手把・觸控都能玩')}>
  <div class="panel keys-panel">
    <div class="panel-head">{t('操作方式')}</div>
    <div class="panel-body">
      <table>
        <thead>
          <tr>
            <th></th>
            <th><img src="{asset('ui/icons/keyboard.webp')}" alt="" />WASD</th>
            <th><img src="{asset('ui/icons/keyboard.webp')}" alt="" />{t('方向鍵')}</th>
            <th><img src="{asset('ui/icons/keyboard.webp')}" alt="" />Z X C</th>
            <th><img src="{asset('ui/icons/gamepad.webp')}" alt="" />{t('手把')}</th>
            <th><img src="{asset('ui/icons/touch.webp')}" alt="" />{t('觸控')}</th>
          </tr>
        </thead>
        <tbody>
          {#each ROWS as [label, ...cells] (label)}
            <tr>
              <th>{t(label)}</th>
              {#each cells as c, i (i)}<td>{t(c)}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="panel tips-panel">
    <div class="panel-head">{t('小技巧')}</div>
    <div class="panel-body">
      <ul>
        <li><b>{t('自動往前跑')}</b>{t('：你只要決定什麼時候跳、滑、衝。掉進坑或撞到東西會少一顆心，心沒了就倒下。')}</li>
        <li><b>{t('踩敵人')}</b>{t('：從上面落下踩到就打倒，還會再彈起來（可以再跳一次）。')}</li>
        <li><b>{t('空中追擊')}</b>{t('：空中按「衝」會直接撞向前面最近的敵人或道具箱，一路打過去分數會加倍。沒有目標就往前飛一小段。')}</li>
        <li><b>{t('地上衝刺')}</b>{t('：撞倒前面的敵人，但尖刺還是會痛（阿烈例外）。')}</li>
        <li><b>{t('魔王關')}</b>{t('：魔王丟的東西低的跳、高的滑；牠衝下來的時候跳起來用空中追擊打牠。')}</li>
        <li><b>{t('星星')}</b>{t('：過關 1 顆、金幣拿到七成 1 顆、沒受傷 1 顆。')}</li>
        <li><b>{t('一起闖關')}</b>{t('：最多八人跑同一關，大家半透明地疊在同一條路上。心沒了變成靈魂，隊友再吃 20 枚金幣就把你救回來；有人過關就全隊過關。')}</li>
        <li><b>{t('無盡比分')}</b>{t('：同一條無盡跑道比分數，倒下就出局。')}</li>
        <li>{t('打倒第一大關的魔王，會有隱藏角色加入。')}</li>
      </ul>
    </div>
  </div>

  {#snippet foot()}
    <BackButton onclick={onback} />
    <span></span>
    <ControlHint />
  {/snippet}
</ScreenFrame>

<style>
  .keys-panel {
    flex: 1.35;
  }
  .tips-panel {
    flex: 1.15;
  }
  /* 字多的語言（英文）塞不下時可以捲動，不要超出框 */
  .tips-panel .panel-body {
    overflow-y: auto;
    min-height: 0;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 0.8cqh;
    font-size: 2.4cqh;
    font-weight: 800;
  }
  thead th {
    font-size: 2.3cqh;
    white-space: nowrap;
  }
  thead img {
    display: block;
    width: 6cqh;
    margin: 0 auto 0.4cqh;
  }
  tbody th {
    background: var(--navy);
    color: var(--on-dark);
    padding: 1cqh 2.4cqh 1cqh 1.6cqh;
    white-space: nowrap;
    clip-path: polygon(0 0, 100% 0, calc(100% - 1cqh) 100%, 0 100%);
  }
  tbody td {
    background: var(--paper-white);
    border-top: 0.3cqh solid var(--navy);
    border-bottom: 0.3cqh solid var(--navy);
    text-align: center;
    padding: 1cqh 0.6cqh;
  }
  ul {
    margin: 0;
    padding-left: 2.6cqh;
    font-size: 2.5cqh;
    font-weight: 700;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 0.9cqh;
  }
  :global(html[lang='ja']) ul {
    font-size: 2.3cqh;
    line-height: 1.45;
    gap: 0.6cqh;
  }
  /* 英文字比較長：字小一點才塞得進同一個框 */
  :global(html[lang='en']) ul {
    font-size: 2cqh;
    line-height: 1.35;
    gap: 0.5cqh;
  }
</style>
