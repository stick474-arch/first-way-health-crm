/* Team chat (Slack-style) — sidebar with Threads / Mentions / Saved, starred, channels (public and
   private) and direct messages; a conversation with bookmarks, typing indicator and a side pane for
   threads, pinned messages, search results and channel details. */
Views.chat = (() => {
  const S = Store;
  const esc = U.esc;
  let root = null;
  let channel = 'general';
  let pane = null; // { kind: 'thread' | 'pinned' | 'search' | 'details', id?, q? }
  let highlight = '';
  let since = '';
  let held = '';
  let threadComposer = null;
  const SPECIAL = { threads: 'Threads', activity: 'Mentions & reactions', saved: 'Saved items' };
  const href = (ch) => `#/chat/${encodeURIComponent(ch)}`;

  function link(ch, label, { icon = '', hash = false, lock = false, dot = '', extra = '' } = {}) {
    const n = Chat.unread(ch);
    const men = Chat.mentionCount(ch);
    const muted = Chat.isMuted(ch);
    return `<a class="chat-link ${ch === channel ? 'active' : ''} ${n && !muted ? 'unread' : ''} ${muted ? 'muted' : ''}" href="${href(ch)}" ${ch === channel ? 'aria-current="page"' : ''}>
      ${dot || (hash ? `<span class="hash" aria-hidden="true">${lock ? '🔒' : '#'}</span>` : icon)}<span>${label}</span>
      ${men && ch !== channel ? `<span class="nav-count hot" aria-label="${men} mentions">${men}</span>` : ''}${muted ? '<span class="small muted" title="Muted">🔕</span>' : ''}${extra}</a>`;
  }

  function sideHtml() {
    const chans = Chat.CHANNELS;
    const people = Chat.people();
    const starred = [...chans.map((c) => c.id), ...people.map((p) => p.channel)].filter(Chat.isStarred);
    const label = (ch) => { const c = chans.find((x) => x.id === ch); if (c) return { text: esc(c.name), hash: true, lock: c.private }; const p = people.find((x) => x.channel === ch); return { text: esc(p?.name || ch) }; };
    const st = Chat.statusOf(Chat.me.email);
    const dmDot = (p) => `<span class="dot ${Chat.isOnline(p.email) ? 'dot-ok' : 'dot-none'}" aria-hidden="true"></span>`;
    const dmLabel = (p) => { const s = Chat.statusOf(p.email); return `${esc(p.name)}${s ? ` <span title="${esc(s.text || '')}">${esc(s.emoji)}</span>` : ''}<span class="sr-only">${Chat.isOnline(p.email) ? ', online' : ', offline'}</span>`; };
    const thr = Chat.threads().filter((t) => t.last > (Chat.lastRead(`thread:${t.parent.id}`) || '') && (t.replies.slice(-1)[0].author_email || '').toLowerCase() !== Chat.me.email).length;
    return `
      <div class="chat-me">
        <button type="button" class="chat-me-btn" data-act="chatStatus" title="Set a status">${UI.avatar(Chat.me.name, 'sm')}<span><b>${esc(Chat.me.name)}</b><small>${st ? `${esc(st.emoji)} ${esc(st.text || '')}` : 'Set a status'}</small></span></button>
        <button type="button" class="icon-btn sm" data-act="chatPrefs" aria-label="Notification preferences" title="${Chat.dnd ? 'Do not disturb is on' : 'Notifications'}">${Chat.dnd ? '🌙' : UI.icon('alert')}</button>
      </div>
      <nav class="chat-tops" aria-label="Your activity">
        ${link('threads', 'Threads', { icon: UI.icon('message', 'ic-sm'), extra: thr ? `<span class="nav-count hot" aria-label="${thr} threads with new replies">${thr}</span>` : '' })}
        ${link('activity', 'Mentions & reactions', { icon: '<span aria-hidden="true">@</span>' })}
        ${link('saved', 'Saved items', { icon: '<span aria-hidden="true">🔖</span>' })}
      </nav>
      ${starred.length ? `<div class="chat-sec" id="starHead">Starred</div><nav aria-labelledby="starHead">${starred.map((ch) => { const l = label(ch); const p = people.find((x) => x.channel === ch); return link(ch, p ? dmLabel(p) : l.text, { hash: l.hash, lock: l.lock, dot: p ? dmDot(p) : '' }); }).join('')}</nav>` : ''}
      <div class="chat-sec chat-sec-row" id="chanHead"><span>Channels</span><button type="button" class="icon-btn sm" data-act="newChannel" aria-label="Create a channel" title="Create a channel">${UI.icon('plus')}</button></div>
      <nav aria-labelledby="chanHead">${chans.filter((c) => !Chat.isStarred(c.id)).map((c) => link(c.id, esc(c.name), { hash: true, lock: c.private })).join('')}</nav>
      <div class="chat-sec" id="dmHead">Direct messages</div>
      <nav aria-labelledby="dmHead">${people.filter((p) => !Chat.isStarred(p.channel)).map((p) => link(p.channel, dmLabel(p), { dot: dmDot(p) })).join('')
        || '<div class="muted small" style="padding:4px 10px">Team members with an email appear here.</div>'}</nav>
      <div class="chat-side-foot small muted">Ctrl+K to jump · /help for commands</div>`;
  }

  function headHtml() {
    if (SPECIAL[channel]) return `<h2 id="chatTitle">${esc(SPECIAL[channel])}</h2>`;
    const info = Chat.channelInfo(channel);
    const dm = channel.startsWith('dm:');
    const pins = Chat.pinnedIn(channel).length;
    const members = info?.private ? info.memberEmails.length : null;
    return `<button type="button" class="star-btn ${Chat.isStarred(channel) ? 'on' : ''}" data-act="chatStar" aria-pressed="${Chat.isStarred(channel)}" aria-label="Star conversation" title="${Chat.isStarred(channel) ? 'Unstar' : 'Star'}">${Chat.isStarred(channel) ? '★' : '☆'}</button>
      <button type="button" class="chat-title-btn" data-act="chatPane" data-k="details"><h2 id="chatTitle">${info?.private ? '🔒 ' : ''}${esc(ChatUI.titleOf(channel))}</h2></button>
      <span class="sub chat-topic" title="${esc(ChatUI.hintOf(channel))}">${esc(ChatUI.hintOf(channel))}</span>
      <span class="right">
        ${Chat.mode === 'cloud' ? `<span class="small muted hide-sm"><span class="dot dot-ok" aria-hidden="true"></span> ${Chat.onlineCount()} online</span>` : '<span class="small muted hide-sm">Saved in this browser</span>'}
        ${members ? `<span class="small muted" title="Members">${UI.icon('users', 'ic-sm')} ${members}</span>` : ''}
        <button type="button" class="btn btn-sm" data-act="chatHuddle" title="Start a video huddle">🎧<span class="hide-sm">Huddle</span></button>
        <button type="button" class="icon-btn sm ${pane?.kind === 'pinned' ? 'active' : ''}" data-act="chatPane" data-k="pinned" aria-label="Pinned messages" title="Pinned (${pins})">📌${pins ? `<small>${pins}</small>` : ''}</button>
        <button type="button" class="icon-btn sm ${pane?.kind === 'search' ? 'active' : ''}" data-act="chatPane" data-k="search" aria-label="Search messages" title="Search">${UI.icon('search')}</button>
        <button type="button" class="icon-btn sm" data-act="chatMute" aria-label="${Chat.isMuted(channel) ? 'Unmute' : 'Mute'}" title="${Chat.isMuted(channel) ? 'Unmute' : 'Mute'}">${Chat.isMuted(channel) ? '🔕' : '🔔'}</button>
        ${dm ? '' : `<button type="button" class="icon-btn sm ${pane?.kind === 'details' ? 'active' : ''}" data-act="chatPane" data-k="details" aria-label="Channel details" title="Details">${UI.icon('more')}</button>`}
      </span>`;
  }

  function bookmarksHtml() {
    const info = Chat.channelInfo(channel);
    if (!info) return '';
    const bm = info.bookmarks || [];
    return `<div class="bookmarks">${bm.map((b, i) => `<a class="bookmark" href="${esc(b.url)}" target="_blank" rel="noopener">${UI.icon('link', 'ic-sm')}${esc(b.title)}</a>${Cloud.canWrite ? `<button type="button" class="bm-x" data-act="chatBookmarkDel" data-i="${i}" aria-label="Remove bookmark ${esc(b.title)}">×</button>` : ''}`).join('')}
      ${Cloud.canWrite ? `<button type="button" class="bookmark add" data-act="chatBookmark">${UI.icon('plus', 'ic-sm')}Add a bookmark</button>` : ''}</div>`;
  }

  // ---- Special lists: threads, mentions, saved ----------------------------------------------
  function specialHtml() {
    const ctx = (m) => `<div class="small muted ctx">${esc(ChatUI.titleOf(m.channel))}${m.parent_id ? ' · thread' : ''} · <a href="#" data-act="chatJump" data-ch="${esc(m.channel)}" data-id="${m.id}">Open</a></div>`;
    if (channel === 'threads') {
      const list = Chat.threads();
      return list.length ? list.map((t) => `<section class="thread-card card">${ctx(t.parent)}${ChatUI.threadHtml(t.parent.id)}<button class="btn btn-sm" data-act="msgThread" data-id="${t.parent.id}" style="margin:6px 0 4px 50px">Reply</button></section>`).join('')
        : UI.empty('message', 'No threads yet', 'Threads you start or reply to show up here.');
    }
    if (channel === 'activity') {
      const list = Chat.activity();
      return list.length ? list.map((a) => `<div class="act-item">${a.kind === 'reaction' ? `<div class="small"><b>${esc(a.who)}</b> reacted ${esc(a.emoji)} to your message</div>` : '<div class="small"><b>Mentioned you</b></div>'}${ctx(a.m)}${ChatUI.msgHtml(a.m, { inThread: true })}</div>`).join('')
        : UI.empty('message', 'Nothing yet', 'When someone @mentions you or reacts to your messages it shows up here.');
    }
    const list = Chat.saved();
    return list.length ? list.map((m) => `<div class="act-item">${ctx(m)}${ChatUI.msgHtml(m, { inThread: true })}</div>`).join('')
      : UI.empty('flag', 'No saved items', 'Use the bookmark button on any message to save it for later. Saved items stay in this browser.');
  }

  // ---- Side pane ---------------------------------------------------------------------------
  function searchResHtml() {
    if (!pane?.q) return '<div class="empty-sm">Type to search every conversation you can see. Filters: in:#channel from:name</div>';
    const res = Chat.search(pane.q);
    return res.length ? res.map((m) => `<div class="act-item"><div class="small muted ctx">${esc(ChatUI.titleOf(m.channel))} · ${esc(U.fmtDate(m.created_at.slice(0, 10)))} · <a href="#" data-act="chatJump" data-ch="${esc(m.channel)}" data-id="${m.id}">Jump</a></div>${ChatUI.msgHtml(m, { inThread: true })}</div>`).join('') : '<div class="empty-sm">No messages match.</div>';
  }
  function paneHtml() {
    if (!pane) return '';
    const close = `<button type="button" class="icon-btn sm" data-act="chatPane" data-k="" aria-label="Close panel">${UI.icon('x')}</button>`;
    if (pane.kind === 'thread') {
      const p = Chat.byId(pane.id);
      return `<header class="pane-head"><h3>Thread</h3><span class="sub">${p ? esc(ChatUI.titleOf(p.channel)) : ''}</span><span class="spacer"></span>${close}</header>
        <div class="chat-log pane-log" id="threadLog">${ChatUI.threadHtml(pane.id, highlight)}</div>
        ${p ? ChatUI.composerHtml(p.channel, ChatUI.drafts[`t:${pane.id}`] || '', { thread: true, compact: true }) : ''}`;
    }
    if (pane.kind === 'pinned') {
      const list = Chat.pinnedIn(channel);
      return `<header class="pane-head"><h3>📌 Pinned</h3><span class="spacer"></span>${close}</header><div class="chat-log pane-log">${list.length ? list.map((m) => ChatUI.msgHtml(m, { inThread: true })).join('') : '<div class="empty-sm">Nothing pinned. Use ⋯ → Pin to channel on an important message.</div>'}</div>`;
    }
    if (pane.kind === 'search') {
      return `<header class="pane-head"><h3>Search</h3><span class="spacer"></span>${close}</header>
        <div class="pane-search"><input class="input" type="search" id="chatSearch" value="${esc(pane.q || '')}" placeholder="Search · in:#general · from:jordan" aria-label="Search messages"></div>
        <div class="chat-log pane-log" id="searchRes">${searchResHtml()}</div>`;
    }
    const info = Chat.channelInfo(channel);
    if (!info) return '';
    const custom = (S.settings.channels || []).find((c) => c.id === channel);
    return `<header class="pane-head"><h3>${info.private ? '🔒' : '#'} ${esc(info.name)}</h3><span class="spacer"></span>${close}</header>
      <div class="pane-body">
        <dl class="info">
          <dt>Topic</dt><dd>${esc(info.hint || '—')}${Cloud.canWrite ? ` <a href="#" data-act="chatTopic">Edit</a>` : ''}</dd>
          ${info.description ? `<dt>About</dt><dd>${esc(info.description)}</dd>` : ''}
          <dt>Visibility</dt><dd>${info.private ? 'Private: only members can read it' : 'Everyone on the team'}</dd>
          ${info.private ? `<dt>Members</dt><dd>${info.memberEmails.map((e) => esc(Chat.userByEmail(e)?.name || e)).join('<br>')}</dd>` : ''}
          ${custom?.createdBy ? `<dt>Created by</dt><dd>${esc(S.nameOf(custom.createdBy))}</dd>` : ''}
          <dt>Messages</dt><dd>${Chat.messagesIn(channel).length} · ${Chat.pinnedIn(channel).length} pinned</dd>
        </dl>
        <div class="row wrap" style="gap:6px;margin-top:12px">
          <button class="btn btn-sm" data-act="chatMute">${Chat.isMuted(channel) ? '🔔 Unmute' : '🔕 Mute'}</button>
          <button class="btn btn-sm" data-act="chatStar">${Chat.isStarred(channel) ? '★ Unstar' : '☆ Star'}</button>
          ${custom && Cloud.canWrite ? `<button class="btn btn-sm" data-act="editChannel" data-id="${esc(custom.id)}">${UI.icon('edit', 'ic-sm')} Edit / archive</button>` : ''}
        </div>
      </div>`;
  }

  function typingHtml() {
    const names = Chat.typingIn(channel);
    if (!names.length) return '&nbsp;';
    return `<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span> ${esc(names.length > 2 ? 'Several people are' : `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'}`)} typing…`;
  }

  function paint(scrollToEnd) {
    if (!root) return;
    const log = root.querySelector('#chatLog');
    if (!log) return;
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    root.querySelector('#chatSide').innerHTML = sideHtml();
    root.querySelector('#chatHead').innerHTML = headHtml();
    const bm = root.querySelector('#chatBm');
    if (bm) bm.innerHTML = bookmarksHtml();
    if (!ChatUI.editing || !log.querySelector('[data-msg-edit]')) log.innerHTML = SPECIAL[channel] ? specialHtml() : ChatUI.logHtml(channel, { since, highlight });
    const ty = root.querySelector('#chatTyping');
    if (ty) ty.innerHTML = typingHtml();
    paintPane();
    if (highlight && scrollToEnd !== false) {
      const target = log.querySelector(`#m-${CSS.escape(highlight)}`);
      if (target) { target.scrollIntoView({ block: 'center' }); return; }
    }
    if (!SPECIAL[channel] && (scrollToEnd || nearEnd)) log.scrollTop = log.scrollHeight;
  }

  function paintPane() {
    const el = root.querySelector('#chatPane');
    if (!el) return;
    root.querySelector('.chat').classList.toggle('has-pane', !!pane);
    if (!pane) { el.innerHTML = ''; threadComposer = null; return; }
    if (pane.kind === 'thread' && threadComposer && el.dataset.for === pane.id) {
      const tl = el.querySelector('#threadLog');
      const near = tl.scrollHeight - tl.scrollTop - tl.clientHeight < 80;
      if (!el.querySelector('[data-msg-edit]')) tl.innerHTML = ChatUI.threadHtml(pane.id, highlight);
      if (near) tl.scrollTop = tl.scrollHeight;
      return;
    }
    if (pane.kind === 'search' && el.dataset.for === 'search' && el.querySelector('#chatSearch')) { el.querySelector('#searchRes').innerHTML = searchResHtml(); return; }
    el.innerHTML = paneHtml();
    el.dataset.for = pane.id || pane.kind;
    threadComposer = null;
    if (pane.kind === 'thread') {
      const p = Chat.byId(pane.id);
      const tl = el.querySelector('#threadLog');
      tl.scrollTop = tl.scrollHeight;
      const form = el.querySelector('form.chat-compose');
      if (p && form) {
        threadComposer = ChatUI.attachComposer(form, {
          draftKey: () => `t:${pane.id}`,
          channel: () => p.channel,
          onEditLast: () => ChatUI.editLast(p.channel, p.id),
          onSend: async (text, extra) => { const ok = await Chat.send(p.channel, text, { parentId: p.id, extra }); if (ok) Chat.markRead(`thread:${p.id}`); return ok; },
        });
        setTimeout(() => threadComposer?.focus(), 30);
      }
      Chat.markRead(`thread:${pane.id}`);
    }
    if (pane.kind === 'search') {
      const inp = el.querySelector('#chatSearch');
      inp.addEventListener('input', U.debounce(() => { pane.q = inp.value; el.querySelector('#searchRes').innerHTML = searchResHtml(); }, 200));
      setTimeout(() => inp.focus(), 20);
    }
  }

  function render(r, params) {
    root = r;
    const prev = channel;
    channel = params[0] || 'general';
    if (!SPECIAL[channel] && !channel.startsWith('dm:') && !Chat.channelInfo(channel)) channel = 'general';
    highlight = params[1] || '';
    if (prev !== channel) { pane = null; since = held === channel ? since : Chat.lastRead(channel); held = ''; }
    if (highlight) {
      const m = Chat.byId(highlight);
      if (m && (Chat.repliesOf(m.id).length || m.parent_id)) pane = { kind: 'thread', id: m.parent_id || m.id };
    }
    r.innerHTML = `
      ${Chat.error ? `<div class="banner warn">${UI.icon('alert')}<div>${esc(Chat.error)}</div></div>` : ''}
      ${Chat.mode === 'cloud' && !Chat.upgraded ? `<div class="banner warn">${UI.icon('alert')}<div>Threads, reactions, pins, polls, edits and private channels need a one-time database upgrade: an admin runs <b>supabase/upgrade-02.sql</b> in Supabase → SQL Editor.</div></div>` : ''}
      <div class="card chat ${pane ? 'has-pane' : ''}">
        <aside class="chat-side" id="chatSide" aria-label="Conversations"></aside>
        <section class="chat-main" aria-labelledby="chatTitle">
          <header class="chat-head" id="chatHead"></header>
          ${SPECIAL[channel] ? '' : '<div id="chatBm"></div>'}
          <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
          ${SPECIAL[channel] ? '' : `<div class="chat-typing small muted" id="chatTyping" aria-live="polite">&nbsp;</div>${ChatUI.composerHtml(channel, ChatUI.drafts[channel] || '')}`}
        </section>
        <aside class="chat-pane" id="chatPane" aria-label="Details"></aside>
      </div>`;
    paint(true);
    if (!SPECIAL[channel]) {
      Chat.markRead(channel);
      const comp = ChatUI.attachComposer(r.querySelector('.chat-main form'), {
        draftKey: () => channel,
        channel: () => channel,
        onEditLast: () => ChatUI.editLast(channel),
        onSend: async (text, extra) => { const ok = await Chat.send(channel, text, { extra }); since = ''; paint(true); Chat.markRead(channel); return ok; },
      });
      if (window.matchMedia('(min-width: 861px)').matches && !pane) setTimeout(() => comp.focus(), 30);
    }
  }

  Chat.onChange(() => {
    if (!location.hash.startsWith('#/chat') || !root || !root.querySelector('#chatLog')) return;
    const a = document.activeElement;
    if (a && a.closest?.('.emoji-pop')) return;
    paint(false);
    if (document.visibilityState === 'visible' && !SPECIAL[channel] && held !== channel) Chat.markRead(channel);
  });

  const setPane = (p) => { pane = p; paint(false); };
  return {
    render,
    get channel() { return channel; },
    openThread: (id) => setPane({ kind: 'thread', id }),
    openPane: (kind, q = '') => setPane(kind ? { kind, q } : null),
    repaint: () => paint(false),
    holdRead: (ch) => { held = ch; since = Chat.lastRead(ch); },
    actions: {
      chatPane: (ds) => setPane(ds.k ? (pane?.kind === ds.k ? null : { kind: ds.k, q: '' }) : null),
      chatStar: () => { Chat.toggleStar(channel); },
      chatMute: () => UI.toast(Chat.toggleMute(channel) ? 'Muted: no badges or notifications' : 'Unmuted', 'info'),
      chatJump: (ds) => { location.hash = `#/chat/${encodeURIComponent(ds.ch)}/${ds.id}`; },
      chatHuddle: async () => {
        const room = `Aetherium-${(Chat.channelInfo(channel)?.name || 'dm').replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 8)}`;
        const url = `https://meet.jit.si/${room}`;
        window.open(url, '_blank', 'noopener');
        if (await Chat.send(channel, `🎧 started a huddle — join here: ${url}`)) UI.toast('Huddle opened in a new tab; the link is in the conversation', 'success');
      },
      chatTopic: async () => {
        const v = await UI.prompt('Channel topic', { label: 'What is this channel about right now?', value: Chat.channelInfo(channel)?.hint || '' });
        if (v === null || v === undefined) return;
        const list = S.settings.channels || [];
        if (list.some((c) => c.id === channel)) S.setSettings({ channels: list.map((c) => (c.id === channel ? { ...c, topic: v } : c)) });
        else S.setSettings({ channelMeta: { ...(S.settings.channelMeta || {}), [channel]: { ...((S.settings.channelMeta || {})[channel] || {}), topic: v } } });
      },
      chatBookmark: () => {
        UI.formModal({
          title: 'Add a bookmark', size: 'sm',
          fields: [{ name: 'title', label: 'Name', required: true, placeholder: 'e.g. Company handbook' }, { name: 'url', label: 'Link', type: 'url', required: true, placeholder: 'https://drive.google.com/…' }],
          onSubmit: (d) => {
            if (!/^https:\/\//i.test(d.url)) { UI.toast('Use an https:// link', 'error'); return false; }
            const list = S.settings.channels || [];
            const add = (bm) => [...(bm || []), { title: d.title.slice(0, 60), url: d.url }].slice(0, 12);
            if (list.some((c) => c.id === channel)) S.setSettings({ channels: list.map((c) => (c.id === channel ? { ...c, bookmarks: add(c.bookmarks) } : c)) });
            else { const cm = S.settings.channelMeta || {}; S.setSettings({ channelMeta: { ...cm, [channel]: { ...(cm[channel] || {}), bookmarks: add((cm[channel] || {}).bookmarks) } } }); }
          },
        });
      },
      chatBookmarkDel: (ds) => {
        const i = Number(ds.i);
        const list = S.settings.channels || [];
        if (list.some((c) => c.id === channel)) S.setSettings({ channels: list.map((c) => (c.id === channel ? { ...c, bookmarks: (c.bookmarks || []).filter((_, k) => k !== i) } : c)) });
        else { const cm = S.settings.channelMeta || {}; S.setSettings({ channelMeta: { ...cm, [channel]: { ...(cm[channel] || {}), bookmarks: ((cm[channel] || {}).bookmarks || []).filter((_, k) => k !== i) } } }); }
      },
      chatStatus: () => ChatUI.setStatus(''),
      chatPrefs: (ds, el) => UI.menu(el, [
        { label: Chat.dnd ? 'Resume notifications' : 'Pause notifications (do not disturb)', icon: 'clock', onClick: () => Chat.setDnd(!Chat.dnd) },
        { label: Chat.notifyOn ? 'Desktop notifications are on' : 'Turn on desktop notifications', icon: 'alert', onClick: () => Chat.enableNotifications() },
        { label: 'Formatting & commands', icon: 'note', onClick: () => ChatUI.helpDialog() },
      ]),
    },
  };
})();
