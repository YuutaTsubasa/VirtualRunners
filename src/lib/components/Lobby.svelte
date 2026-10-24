<script>
  // 房間大廳（art-work/ui-concept-v1/06-online-lobby）：左邊 2×4 跑者卡（最多八人），右邊邀請朋友、比賽設定、聊天；房主按「開跑！」
  import { tick } from 'svelte';
  import { net, inTauri, hostCmd, leave, send, serverUrls, setCharacter, toast, load } from '../net.svelte.js';
  import { WEB_URL, shareLink } from '../site.js';
  import { CHARACTERS, getCharacter } from '../game/characters.js';
  import { DIFFICULTIES, SLOT_COLORS } from '../game/constants.js';
  import { WORLDS, stageLabel } from '../game/stages.js';
  import StageMap from './StageMap.svelte';
  import { play } from '../game/audio.js';
  import { t, displayName, serverText } from '../i18n.svelte.js';
  import ScreenFrame from './ScreenFrame.svelte';
  import BackButton from './BackButton.svelte';
  import CharacterGrid from './CharacterGrid.svelte';
  import Stepper from './Stepper.svelte';

  const room = $derived(net.room);
  const modeOptions = [
    { value: false, label: t('一起闖關') },
    { value: true, label: t('無盡比分') },
  ];
  // 房主從關卡地圖選關（照房主自己的關卡進度上鎖）
  let pickingStage = $state(false);
  const difficultyOptions = Object.entries(DIFFICULTIES).map(([k, label]) => ({ value: k, label: t(label) }));
  const isHost = $derived(net.isHost);
  const urls = $derived(serverUrls());
  let urlIdx = $state(0);
  const address = $derived(urls[urlIdx] ?? urls[0] ?? '');
  // 線上房間的分享連結（…#join/房號）。桌面 App 沒設定網頁版網址時只給房號。
  const webBase = WEB_URL || (!inTauri && location.protocol.startsWith('http') ? location.origin + location.pathname : '');
  const link = $derived(shareLink(net.code, webBase));

  let charDialog;
  let dialogCursor = $state(0);
  let chatText = $state('');
  let chatBox = $state();

  const myCharacter = $derived(net.seat != null ? room?.seats[net.seat]?.character : null);

  $effect(() => {
    room?.chat.length;
    tick().then(() => chatBox && (chatBox.scrollTop = chatBox.scrollHeight));
  });

  function roleOf(i) {
    const tags = [];
    if (i === room.host_seat) tags.push(t('房主'));
    if (i === net.seat) tags.push(t('你'));
    return tags.join(' · ');
  }

  function statusOf(seat) {
    if (seat.kind === 'bot') return t('電腦對手・{level}', { level: t(DIFFICULTIES[seat.difficulty]) });
    return seat.connected ? t('已連線') : t('斷線中');
  }

  function updateSettings(patch) {
    hostCmd('settings', { settings: { ...room.settings, ...patch } });
  }

  function sit() {
    play('select');
    send({ type: 'sit', name: load('vr_name', '') || t('玩家'), character: load('vr_character') });
  }

  function openCharacters() {
    dialogCursor = Math.max(0, CHARACTERS.findIndex((c) => c.id === myCharacter));
    charDialog.showModal();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('已複製'), 'ok');
    } catch {
      toast(t('複製失敗，請手動選取'));
    }
  }

  function sendChat(event) {
    event.preventDefault();
    if (!chatText.trim()) return;
    send({ type: 'chat', text: chatText });
    chatText = '';
  }
</script>

<ScreenFrame title={t('跑者集合')} subtitle={t('房間大廳・最多八人')}>
  <div class="seats">
    {#each room.seats as seat, i (i)}
      <div class="panel seat" class:gold-frame={i === net.seat} class:empty={!seat} style="--c: {SLOT_COLORS[i]}">
        <span class="no">{i + 1}P</span>
        {#if seat}
          {@const c = getCharacter(seat.character)}
          <div class="pic"><img src={i === net.seat ? c.portraits.happy : c.portraits.normal} alt="" /></div>
          <div class="info">
            <b class="who" title={displayName(seat.name)}>{seat.kind === 'bot' ? c.name : displayName(seat.name)}</b>
            <small>{seat.kind === 'bot' ? statusOf(seat) : c.name}</small>
            {#if roleOf(i)}<span class="role">{roleOf(i)}</span>{/if}
            {#if seat.kind !== 'bot'}
              <span class="status"><i class="dot" class:on={seat.connected}></i>{statusOf(seat)}</span>
            {/if}
            <div class="seat-actions">
              {#if i === net.seat}
                <button type="button" class="vbtn small gold" onclick={openCharacters}>{t('更換角色')}</button>
              {:else if isHost && room.host_seat !== i}
                <button type="button" class="vbtn small" onclick={() => hostCmd('remove', { seat: i })}>{t('移除')}</button>
              {/if}
            </div>
          </div>
        {:else}
          <div class="pic plus" aria-hidden="true"></div>
          <div class="info">
            <b class="who">{t('等待入席')}</b>
            
            <div class="seat-actions">
              {#if net.seat == null}
                <button type="button" class="vbtn small gold" onclick={sit}>{t('入席')}</button>
              {/if}
              {#if isHost}
                <button type="button" class="vbtn small outline" onclick={() => hostCmd('add_bot', { seat: i, difficulty: room.settings.difficulty })}>{t('加入電腦')}</button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <aside class="side">
    <section class="panel">
      <div class="panel-head left">{isHost ? t('邀請朋友') : t('連線資訊')}</div>
      <div class="panel-body">
        {#if net.code}
          <div class="code-row">
            <span class="code-label">{t('房號')}</span>
            <code class="room-code">{net.code}</code>
          </div>
          <div class="copy-buttons">
            <button type="button" class="vbtn small gold" onclick={() => copy(net.code)}>{t('複製房號')}</button>
            {#if link}<button type="button" class="vbtn small" onclick={() => copy(link)}>{t('複製邀請連結')}</button>{/if}
          </div>
          {#if net.signalDown}
            <div class="signal-down"><i>i</i><div><b>{t('暫時無法邀請新玩家')}</b><small>{t('房內玩家不受影響，新玩家請稍後再加入')}</small></div></div>
          {:else}
            <p class="small">{isHost ? t('請保持房主分頁開啟') : t('已用 WebRTC 直接連到房主。')}</p>
          {/if}
        {:else}
          {#if urls.length > 1}
            <div class="tabs">
              {#each urls as u, i (u)}
                <button type="button" class:sel={i === urlIdx} onclick={() => (urlIdx = i)}>{u.replace(/^https?:\/\//, '')}</button>
              {/each}
            </div>
          {/if}
          <div class="copy-row">
            <code>{address}</code>
            <button type="button" class="vbtn small gold" onclick={() => copy(address)}>{t('複製')}</button>
          </div>
          <p class="small">
            {#if isHost}{t('朋友可用 App 或瀏覽器加入。區網可直接連線；跨網路需要開放這個埠或用通道。')}{:else}{t('已連線到房主。')}{/if}
          </p>
        {/if}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head left">{t('比賽設定')}</div>
      <div class="panel-body rules">
        <span>{t('模式')}</span>
        <Stepper options={modeOptions} value={room.settings.endless} disabled={!isHost} onchange={(v) => updateSettings({ endless: v === true || v === 'true' })} />
        {#if !room.settings.endless}
          <span>{t('關卡')}</span>
          <div class="stage-pick">
            <b>{stageLabel(room.settings.world, room.settings.stage)} {t(WORLDS[room.settings.world].subs[room.settings.stage])}</b>
            {#if isHost}<button type="button" class="vbtn small" onclick={() => (pickingStage = true)}>{t('選關卡')}</button>{/if}
          </div>
        {/if}
        <span>{t('電腦強度')}</span>
        <Stepper options={difficultyOptions} value={room.settings.difficulty} disabled={!isHost} onchange={(v) => updateSettings({ difficulty: v })} />
      </div>
    </section>

    <section class="panel chat">
      <div class="panel-head left">{t('大廳聊天')}</div>
      <div class="panel-body">
        <ol bind:this={chatBox}>
          {#each room.chat as line, i (i)}
            {#if line.sys}
              <li class="sys">{t('系統')}：{serverText(line.text)}</li>
            {:else}
              <li><b class:mine={line.seat === net.seat && line.seat != null}>{displayName(line.name)}</b>：{line.text}</li>
            {/if}
          {/each}
        </ol>
        <form onsubmit={sendChat}>
          <input bind:value={chatText} placeholder={t('說點什麼…')} maxlength="300" />
          <button type="submit" class="vbtn small dark" disabled={!chatText.trim()}>{t('送出')}</button>
        </form>
      </div>
    </section>
  </aside>

  {#snippet foot()}
    <BackButton label={t('離開房間')} onclick={leave} />
    <div class="hint-bar"><i class="bang">!</i>{isHost ? (room.settings.endless ? t('同一條路比分數，倒下就出局') : t('一起闖關：倒下的隊友吃金幣就能救回來')) : t('等待房主開跑…')}</div>
    {#if isHost}
      <button type="button" class="vbtn primary" onclick={() => hostCmd('start')}>{t('開跑！')}</button>
    {:else}
      <span class="spinner"></span>
    {/if}
  {/snippet}
</ScreenFrame>

{#if pickingStage}
  <div class="stage-overlay">
    <StageMap
      character={myCharacter ?? 'xiaocui'}
      at={{ world: room.settings.world, stage: room.settings.stage }}
      onpick={(w, s) => {
        updateSettings({ world: w, stage: s });
        pickingStage = false;
      }}
      onback={() => (pickingStage = false)}
    />
  </div>
{/if}

<dialog class="char-dialog" bind:this={charDialog}>
  <div class="panel">
    <div class="panel-head">{t('更換角色')}</div>
    <div class="panel-body">
      <CharacterGrid
        bind:cursor={dialogCursor}
        selected={myCharacter}
        showLocked={false}
        onpick={(c) => {
          setCharacter(c.id);
          charDialog.close();
        }}
      />
      <div class="dialog-actions"><button type="button" class="vbtn small" onclick={() => charDialog.close()}>{t('取消')}</button></div>
    </div>
  </div>
</dialog>

<style>
  .stage-pick {
    display: flex;
    align-items: center;
    gap: 1cqw;
    min-width: 0;
  }
  .stage-pick b {
    flex: 1;
    font-size: 2.3cqh;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stage-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
  }
  .seats {
    flex: 1.7;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: repeat(4, minmax(0, 1fr));
    gap: 1.4cqh 1.2cqw;
    min-width: 0;
    min-height: 0;
    padding-top: 0.8cqh;
  }
  /* 隊員卡：左邊大頭像、右邊名字與狀態，左上角是座位編號（該座位的代表色） */
  .seat {
    flex-direction: row;
    gap: 1cqw;
    padding: 0.6cqh;
    min-width: 0;
    min-height: 0;
  }
  .no {
    position: absolute;
    left: -0.4cqh;
    top: -0.4cqh;
    z-index: 2;
    background: var(--c);
    color: #fff;
    font-size: 2.6cqh;
    font-weight: 900;
    font-style: italic;
    padding: 0 3cqh 0 1.2cqh;
    line-height: 1.15;
    clip-path: polygon(0 0, 100% 0, 78% 100%, 0 100%);
    text-shadow: 0.25cqh 0.25cqh 0 var(--navy);
  }
  .pic {
    position: relative;
    flex: 0 0 34%;
    min-width: 0;
    background:
      radial-gradient(color-mix(in srgb, var(--c) 45%, transparent) 22%, transparent 26%) 0 0 / 1.2cqh 1.2cqh,
      color-mix(in srgb, var(--c) 18%, var(--cream));
    overflow: hidden;
  }
  .pic img {
    position: absolute;
    left: 50%;
    bottom: 0;
    height: 112%;
    translate: -50% 0;
  }
  .pic.plus {
    background: none;
    border: 0.3cqh dashed var(--muted);
  }
  .pic.plus::before,
  .pic.plus::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: 4cqh;
    height: 0.8cqh;
    background: var(--navy);
  }
  .pic.plus::after {
    width: 0.8cqh;
    height: 4cqh;
  }
  .info {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3cqh;
    padding-top: 0.2cqh;
  }
  .who {
    max-width: 100%;
    font-size: 2.6cqh;
    font-weight: 900;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .info small {
    font-size: 1.8cqh;
    font-weight: 800;
    color: var(--navy-soft);
  }
  .role {
    background: var(--navy);
    color: var(--on-dark);
    font-weight: 900;
    font-size: 1.6cqh;
    letter-spacing: 0.1em;
    padding: 0 1cqh;
  }
  .status {
    font-size: 1.7cqh;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 0.8cqh;
  }
  .dot {
    width: 1.8cqh;
    height: 1.8cqh;
    border-radius: 50%;
    background: var(--muted);
  }
  .dot.on {
    background: var(--teal);
  }
  .seat-actions {
    margin-top: auto;
    align-self: stretch;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5cqh;
  }
  .seat-actions :global(.vbtn.small) {
    font-size: 1.7cqh;
    padding: 0.3cqh 1cqh;
    min-height: 0;
  }
  .seat-actions:empty {
    border: 0;
  }
  .outline {
    --fg: var(--teal);
    border-color: var(--teal);
    box-shadow: 0.4cqh 0.4cqh 0 var(--teal);
  }
  .dark {
    --face: var(--navy);
    --fg: var(--on-dark);
  }

  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2.4cqh;
    min-height: 0;
    min-width: 0;
    padding-top: 0.8cqh;
  }
  .side .panel-body {
    padding: 1.4cqh 1.6cqh 1cqh;
    gap: 0.8cqh;
  }
  .side .panel-head {
    font-size: 2.6cqh;
  }
  .code-row {
    display: flex;
    gap: 1.4cqh;
    align-items: center;
  }
  .code-label {
    font-weight: 900;
    font-size: 2.4cqh;
  }
  .room-code {
    flex: 1;
    text-align: center;
    font-family: inherit;
    font-size: 5.4cqh;
    font-weight: 900;
    letter-spacing: 0.25em;
    padding: 0.2cqh 1cqh;
    border: var(--line) solid var(--navy);
    background: var(--paper-white);
    user-select: text;
  }
  .copy-buttons {
    display: flex;
    gap: 1cqw;
  }
  .copy-buttons .vbtn {
    flex: 1;
    min-width: 0;
    padding-inline: 1cqh;
  }
  .copy-row {
    display: flex;
    gap: 1cqh;
    align-items: center;
  }
  .copy-row code {
    flex: 1;
    min-width: 0;
    background: var(--paper-white);
    border: 0.3cqh solid var(--navy);
    padding: 0.5cqh 1cqh;
    font-size: 2.2cqh;
    font-weight: 700;
    overflow-x: auto;
    white-space: nowrap;
    user-select: text;
  }
  .signal-down {
    display: flex;
    gap: 1.2cqh;
    align-items: center;
    border: 0.3cqh solid var(--navy);
    border-left: 1cqh solid var(--gold);
    padding: 0.8cqh 1.2cqh;
  }
  .signal-down i {
    flex: none;
    width: 4cqh;
    height: 4cqh;
    border-radius: 50%;
    background: var(--gold);
    display: grid;
    place-items: center;
    font-style: normal;
    font-weight: 900;
    font-size: 2.6cqh;
  }
  .signal-down b {
    display: block;
    font-size: 2.2cqh;
  }
  .signal-down small {
    font-size: 1.8cqh;
    font-weight: 700;
  }
  .tabs {
    display: flex;
    gap: 0.6cqh;
    flex-wrap: wrap;
  }
  .tabs button {
    border: 0.25cqh solid var(--navy);
    background: var(--paper-white);
    font-weight: 800;
    font-size: 1.8cqh;
    padding: 0.2cqh 1cqh;
  }
  .tabs .sel {
    background: var(--teal);
    color: var(--on-dark);
  }
  .small {
    margin: 0;
    text-align: center;
    font-size: 1.9cqh;
    font-weight: 700;
  }
  .rules {
    display: grid !important;
    grid-template-columns: max-content 1fr;
    gap: 0.7cqh 1.4cqw !important;
    align-items: center;
    font-weight: 900;
    font-size: 2.2cqh;
  }
  .chat {
    flex: 1;
  }
  .chat ol {
    flex: 1;
    min-height: 0;
    list-style: none;
    margin: 0;
    padding: 0.6cqh 1cqh;
    overflow-y: auto;
    font-size: 2cqh;
    line-height: 1.5;
    background: var(--paper-white);
    border: 0.25cqh solid var(--navy);
  }
  .chat .sys {
    color: var(--muted);
  }
  .chat .mine {
    color: var(--accent);
  }
  .chat form {
    display: flex;
    gap: 0.8cqh;
  }
  .chat input {
    flex: 1;
    min-width: 0;
    font-size: 2.1cqh;
  }
  .bang {
    width: 3cqh;
    height: 3cqh;
    border-radius: 50%;
    background: var(--navy);
    color: var(--on-dark);
    display: grid;
    place-items: center;
    font-style: normal;
    font-weight: 900;
    flex: none;
  }
  .spinner {
    width: 6cqh;
    height: 6cqh;
    border: 0.8cqh solid var(--cream-deep);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .char-dialog {
    border: none;
    background: none;
    padding: 0;
    width: 76cqw;
    max-width: 92vw;
  }
  .char-dialog::backdrop {
    background: rgba(22, 24, 29, 0.62);
  }
  .char-dialog .panel-body {
    min-height: 40cqh;
    padding-top: 2.4cqh;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
