/* Team chat — channels (#general, #board) and direct messages, live, with links to records. */
Views.chat = (() => {
  const S = Store;
  const esc = U.esc;
  let root = null;
  let channel = 'general';
  const href = (ch) => `#/chat/${encodeURIComponent(ch)}`;

  function sideHtml() {
    const badge = (ch) => { const n = Chat.unread(ch); return n && ch !== channel ? `<span class="nav-count hot" aria-label="${n} unread">${n}</span>` : ''; };
    const people = Chat.people();
    return `
      <div class="chat-sec chat-sec-row" id="chanHead"><span>Channels</span><button type="button" class="icon-btn sm" data-act="newChannel" aria-label="Create a channel" title="Create a channel">${UI.icon('plus')}</button></div>
      <nav aria-labelledby="chanHead">${Chat.CHANNELS.map((c) => `<a class="chat-link ${c.id === channel ? 'active' : ''}" href="${href(c.id)}" ${c.id === channel ? 'aria-current="page"' : ''}><span class="hash" aria-hidden="true">#</span><span>${esc(c.name)}</span>${badge(c.id)}</a>`).join('')}</nav>
      <div class="chat-sec" id="dmHead">Direct messages</div>
      <nav aria-labelledby="dmHead">${people.length ? people.map((p) => `<a class="chat-link ${p.channel === channel ? 'active' : ''}" href="${href(p.channel)}" title="${esc(p.email)}" ${p.channel === channel ? 'aria-current="page"' : ''}>
        <span class="dot ${Chat.isOnline(p.email) ? 'dot-ok' : 'dot-none'}" aria-hidden="true"></span><span>${esc(p.name)}<span class="sr-only">${Chat.isOnline(p.email) ? ', online' : ', offline'}</span></span>${badge(p.channel)}</a>`).join('')
        : '<div class="muted small" style="padding:4px 10px">Team members with an email appear here.</div>'}</nav>`;
  }

  function paint(scrollToEnd) {
    if (!root) return;
    const log = root.querySelector('#chatLog');
    if (!log) return;
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    root.querySelector('#chatSide').innerHTML = sideHtml();
    const custom = (S.settings.channels || []).find((c) => c.id === channel);
    root.querySelector('#chatHead').innerHTML = `<h2 id="chatTitle">${esc(ChatUI.titleOf(channel))}</h2><span class="sub">${esc(ChatUI.hintOf(channel))}</span>${custom && Cloud.canWrite ? `<button type="button" class="icon-btn sm" data-act="editChannel" data-id="${esc(custom.id)}" aria-label="Edit channel" title="Rename or archive">${UI.icon('edit')}</button>` : ''}
      ${Chat.mode === 'cloud' ? `<span class="right small muted"><span class="dot dot-ok" aria-hidden="true"></span> ${Chat.onlineCount()} online</span>` : '<span class="right small muted">Saved in this browser</span>'}`;
    log.innerHTML = ChatUI.logHtml(channel);
    if (scrollToEnd || nearEnd) log.scrollTop = log.scrollHeight;
  }

  function render(r, params) {
    root = r;
    channel = params[0] || 'general';
    if (!channel.startsWith('dm:') && !Chat.CHANNELS.some((c) => c.id === channel)) channel = 'general';
    r.innerHTML = `
      ${Parts.pageHead('Team chat', 'Talk in real time with the team and the board. Type @ to link a person, meeting, task or deal; opening a link keeps the chat in a small window.')}
      ${Chat.error ? `<div class="banner warn">${UI.icon('alert')}<div>${esc(Chat.error)}</div></div>` : ''}
      <div class="card chat">
        <aside class="chat-side" id="chatSide" aria-label="Conversations"></aside>
        <section class="chat-main" aria-labelledby="chatTitle">
          <header class="chat-head" id="chatHead"></header>
          <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
          ${ChatUI.composerHtml(channel, ChatUI.drafts[channel] || '')}
        </section>
      </div>`;
    paint(true);
    Chat.markRead(channel);
    const comp = ChatUI.attachComposer(r.querySelector('.chat-main form'), {
      draftKey: () => channel,
      onSend: async (text) => { const ok = await Chat.send(channel, text); paint(true); Chat.markRead(channel); return ok; },
    });
    if (window.matchMedia('(min-width: 861px)').matches) setTimeout(() => comp.focus(), 30);
  }

  Chat.onChange(() => {
    if (!location.hash.startsWith('#/chat') || !root || !root.querySelector('#chatLog')) return;
    paint(false);
    if (document.visibilityState === 'visible') Chat.markRead(channel);
  });

  return { render, get channel() { return channel; }, actions: {} };
})();
