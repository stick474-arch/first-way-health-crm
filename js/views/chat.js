/* Team chat — channels (#general, #board) and direct messages, live. */
Views.chat = (() => {
  const esc = U.esc;
  let root = null;
  let channel = 'general';
  const drafts = {};

  const isDm = (ch) => ch.startsWith('dm:');
  const titleOf = (ch) => (isDm(ch) ? (Chat.people().find((p) => p.channel === ch)?.name || 'Direct message') : `#${ch}`);
  const hintOf = (ch) => (isDm(ch) ? 'Only the two of you can read this' : (Chat.CHANNELS.find((c) => c.id === ch)?.hint || ''));
  const href = (ch) => `#/chat/${encodeURIComponent(ch)}`;

  function sideHtml() {
    const badge = (ch) => { const n = Chat.unread(ch); return n && ch !== channel ? `<span class="nav-count hot">${n}</span>` : ''; };
    const people = Chat.people();
    return `
      <div class="chat-sec">Channels</div>
      ${Chat.CHANNELS.map((c) => `<a class="chat-link ${c.id === channel ? 'active' : ''}" href="${href(c.id)}"><span class="hash">#</span><span>${esc(c.name)}</span>${badge(c.id)}</a>`).join('')}
      <div class="chat-sec">Direct messages</div>
      ${people.length ? people.map((p) => `<a class="chat-link ${p.channel === channel ? 'active' : ''}" href="${href(p.channel)}" title="${esc(p.email)}">
        <span class="dot ${Chat.isOnline(p.email) ? 'dot-ok' : 'dot-none'}" title="${Chat.isOnline(p.email) ? 'Online now' : 'Offline'}"></span><span>${esc(p.name)}</span>${badge(p.channel)}</a>`).join('')
        : '<div class="muted small" style="padding:4px 10px">Team members with an email appear here.</div>'}`;
  }

  function logHtml() {
    const list = Chat.messagesIn(channel);
    if (!list.length) {
      return `<div class="empty" style="margin:auto">${UI.icon('message')}<h3>No messages in ${esc(titleOf(channel))} yet</h3><p>${isDm(channel) ? 'Write the first message below.' : 'Start the conversation below. Everyone on the team will see it live.'}</p></div>`;
    }
    let lastDay = '';
    let prev = null;
    return list.map((m) => {
      const d = new Date(m.created_at);
      const day = U.toDateStr(d);
      const sameRun = prev && prev.author_email === m.author_email && day === lastDay && (d - new Date(prev.created_at)) < 5 * 60000;
      const head = day !== lastDay ? `<div class="chat-day"><span>${esc(U.daysFromToday(day) === 0 ? 'Today' : U.daysFromToday(day) === -1 ? 'Yesterday' : U.fmtDateLong(day))}</span></div>` : '';
      lastDay = day;
      prev = m;
      const mine = (m.author_email || '').toLowerCase() === Chat.me.email;
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${head}<div class="msg ${sameRun ? 'cont' : ''}">
        ${sameRun ? '<span class="msg-gutter">' + esc(time) + '</span>' : UI.avatar(m.author_name || m.author_email)}
        <div class="msg-main">
          ${sameRun ? '' : `<div class="msg-head"><b>${esc(m.author_name || m.author_email)}</b><time>${esc(time)}</time></div>`}
          <div class="msg-body">${esc(m.body)}</div>
        </div>
        ${mine ? `<button class="icon-btn sm msg-del" data-act="deleteMsg" data-id="${esc(m.id)}" aria-label="Delete message" title="Delete">${UI.icon('trash')}</button>` : '<span></span>'}
      </div>`;
    }).join('');
  }

  function paint(scrollToEnd) {
    if (!root) return;
    const log = root.querySelector('#chatLog');
    if (!log) return;
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    root.querySelector('#chatSide').innerHTML = sideHtml();
    root.querySelector('#chatHead').innerHTML = `<h2>${esc(titleOf(channel))}</h2><span class="sub">${esc(hintOf(channel))}</span>
      ${Chat.mode === 'cloud' ? `<span class="right small muted"><span class="dot dot-ok"></span> ${Chat.onlineCount()} online</span>` : '<span class="right small muted">Saved in this browser</span>'}`;
    log.innerHTML = logHtml();
    if (scrollToEnd || nearEnd) log.scrollTop = log.scrollHeight;
  }

  function render(r, params) {
    root = r;
    channel = params[0] || 'general';
    r.innerHTML = `
      ${Parts.pageHead('Team chat', 'Talk in real time with the team and the board. Direct messages stay private.')}
      ${Chat.error ? `<div class="banner warn">${UI.icon('alert')}<div>${esc(Chat.error)}</div></div>` : ''}
      <div class="card chat">
        <aside class="chat-side" id="chatSide"></aside>
        <section class="chat-main">
          <header class="chat-head" id="chatHead"></header>
          <div class="chat-log" id="chatLog" aria-live="polite"></div>
          <form class="chat-compose" id="chatForm">
            <textarea id="chatInput" rows="1" aria-label="Message" placeholder="Message ${esc(titleOf(channel))}  (Enter to send, Shift+Enter for a new line)">${esc(drafts[channel] || '')}</textarea>
            <button class="btn btn-primary" type="submit">${UI.icon('arrowRight')}<span class="hide-sm">Send</span></button>
          </form>
        </section>
      </div>`;
    paint(true);
    Chat.markRead(channel);
    const form = r.querySelector('#chatForm');
    const input = r.querySelector('#chatInput');
    const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(160, input.scrollHeight)}px`; };
    grow();
    input.addEventListener('input', () => { drafts[channel] = input.value; grow(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value;
      if (!text.trim()) return;
      input.value = '';
      drafts[channel] = '';
      grow();
      const ok = await Chat.send(channel, text);
      if (!ok) { input.value = text; drafts[channel] = text; grow(); }
      paint(true);
      Chat.markRead(channel);
      input.focus();
    });
    if (window.matchMedia('(min-width: 861px)').matches) setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  Chat.onChange(() => {
    if (!location.hash.startsWith('#/chat') || !root || !root.querySelector('#chatLog')) return;
    paint(false);
    if (document.visibilityState === 'visible') Chat.markRead(channel);
  });

  return {
    render,
    actions: {
      deleteMsg: async (ds) => {
        if (!(await UI.confirm('Delete this message for everyone?', { okText: 'Delete' }))) return;
        await Chat.remove(ds.id);
      },
    },
  };
})();
