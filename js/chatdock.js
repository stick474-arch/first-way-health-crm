/* Aetherium — docked chat: a tab at the bottom of every page that opens into a small window.
   Opening a tagged record from the chat moves the conversation here so you keep talking while you work. */
const ChatDock = (() => {
  const esc = U.esc;
  const KEY = `${(window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm'}-dock`;
  let state = (() => { try { return { open: false, channel: 'general', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { open: false, channel: 'general' }; } })();
  let el = null;
  let composer = null;
  let builtFor = '';

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };
  const onChatPage = () => location.hash.startsWith('#/chat');
  const channels = () => [
    ...Chat.CHANNELS.map((c) => ({ value: c.id, label: `#${c.name}`, group: 'Channels' })),
    ...Chat.people().map((p) => ({ value: p.channel, label: `${p.name}${Chat.isOnline(p.email) ? ' · online' : ''}`, group: 'Direct messages' })),
  ];

  function tabHtml() {
    const n = Chat.unreadTotal();
    return `<button type="button" class="dock-tab" data-dock="open" aria-expanded="false" aria-controls="dockPanel">
      ${UI.icon('message')}<span>Team chat</span>${n ? `<span class="nav-count hot" aria-label="${n} unread">${n}</span>` : ''}</button>`;
  }

  function panelHtml() {
    return `<div class="dock-panel" id="dockPanel" role="dialog" aria-label="Team chat" aria-modal="false">
      <header class="dock-head">
        <label class="sr-only" for="dockChannel">Conversation</label>
        <select id="dockChannel" class="select dock-select">${UI.selectOptions(channels(), state.channel)}</select>
        <span class="spacer"></span>
        <a class="icon-btn sm" href="#/chat/${encodeURIComponent(state.channel)}" data-dock="full" aria-label="Open the full chat" title="Open the full chat">${UI.icon('arrowRight')}</a>
        <button type="button" class="icon-btn sm" data-dock="close" aria-label="Minimize chat" title="Minimize (Esc)">${UI.icon('chevronDown')}</button>
      </header>
      <div class="dock-log chat-log" id="dockLog" aria-live="polite"></div>
      ${ChatUI.composerHtml(state.channel, ChatUI.drafts[state.channel] || '', { compact: true })}
    </div>`;
  }

  function paintLog(scrollToEnd) {
    const log = el && el.querySelector('#dockLog');
    if (!log) return;
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    if (ChatUI.editing && log.querySelector('[data-msg-edit]')) return;
    log.innerHTML = Chat.error ? `<div class="empty-sm">${esc(Chat.error)}</div>` : ChatUI.logHtml(state.channel, { compact: true });
    if (scrollToEnd || nearEnd) log.scrollTop = log.scrollHeight;
    if (document.visibilityState === 'visible') Chat.markRead(state.channel);
  }

  function render({ focus = false } = {}) {
    if (!el) return;
    el.hidden = onChatPage();
    if (el.hidden) return;
    if (!state.open) {
      el.className = 'chat-dock';
      el.innerHTML = tabHtml();
      builtFor = '';
      composer = null;
      if (focus) el.querySelector('.dock-tab').focus();
      return;
    }
    const key = `open:${state.channel}`;
    if (builtFor !== key) {
      el.className = 'chat-dock is-open';
      el.innerHTML = panelHtml();
      builtFor = key;
      composer = ChatUI.attachComposer(el.querySelector('form'), {
        draftKey: () => state.channel,
        channel: () => state.channel,
        onEditLast: () => ChatUI.editLast(state.channel),
        onSend: async (text, extra) => { const ok = await Chat.send(state.channel, text, { extra }); paintLog(true); return ok; },
      });
      paintLog(true);
      if (focus) composer.focus();
    } else {
      // keep the composer as it is; refresh the conversation list (online status, new DMs)
      const sel = el.querySelector('#dockChannel');
      if (sel && document.activeElement !== sel) sel.innerHTML = UI.selectOptions(channels(), state.channel);
      paintLog(false);
    }
  }

  function open(channel, { focus = true } = {}) {
    if (channel) state.channel = channel;
    state.open = true;
    save();
    render({ focus });
  }
  function close() { state.open = false; save(); render({ focus: true }); }

  function mount() {
    if (el) return;
    el = document.createElement('section');
    el.className = 'chat-dock';
    el.setAttribute('aria-label', 'Team chat');
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dock]');
      if (!b) return;
      if (b.dataset.dock === 'open') open(null);
      else if (b.dataset.dock === 'close') close();
      else if (b.dataset.dock === 'full') { state.open = false; save(); }
    });
    el.addEventListener('change', (e) => {
      if (e.target.id === 'dockChannel') { state.channel = e.target.value; save(); builtFor = ''; render({ focus: true }); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.open) { e.preventDefault(); e.stopPropagation(); close(); }
    });
    Chat.onChange(() => { if (!document.activeElement?.closest?.('.emoji-pop')) render(); });
    window.addEventListener('hashchange', () => render());
    render();
  }

  // From a tagged record: keep the conversation open in the dock, then go to the record
  function openRef(ref, fromChannel) {
    if (fromChannel) { state.channel = fromChannel; state.open = true; save(); }
    builtFor = '';
    ChatUI.openRef(ref);
    setTimeout(() => render({ focus: false }), 80);
  }

  return { mount, open, close, openRef, repaint: () => paintLog(false), get state() { return state; } };
})();
