/* Aetherium — chat UI kit (Slack-style) shared by the Team chat page and the docked chat:
   message rendering with formatting, record references ([[type:id|Label]]) and @mentions, reactions,
   threads, polls, the hover toolbar, the composer (formatting bar, @ / : autocomplete, slash commands). */
const ChatUI = (() => {
  const S = Store;
  const esc = U.esc;
  const REF_SRC = String.raw`\[\[(contact|org|deal|meeting|task|resolution|user):([A-Za-z0-9_-]{1,64})\|([^\]|\n]{1,80})\]\]`;
  const REF_RE = new RegExp(REF_SRC, 'g');
  const TYPES = {
    user: { icon: 'userCheck', label: 'Teammate' },
    contact: { icon: 'users', label: 'Person' },
    org: { icon: 'building', label: 'Organization' },
    deal: { icon: 'kanban', label: 'Deal' },
    meeting: { icon: 'landmark', label: 'Meeting' },
    task: { icon: 'checkSquare', label: 'Task' },
    resolution: { icon: 'gavel', label: 'Resolution' },
  };
  const COLL = { user: 'users', contact: 'contacts', org: 'organizations', deal: 'deals', meeting: 'meetings', task: 'tasks', resolution: 'resolutions' };
  const EMOJI = {
    smile: '😄', grin: '😁', joy: '😂', wink: '😉', blush: '😊', slightly_smiling_face: '🙂', upside_down: '🙃', sweat_smile: '😅', heart_eyes: '😍', sunglasses: '😎',
    thinking: '🤔', neutral: '😐', sob: '😭', scream: '😱', partying: '🥳', facepalm: '🤦', shrug: '🤷', wave: '👋', clap: '👏', pray: '🙏',
    '+1': '👍', thumbsup: '👍', '-1': '👎', thumbsdown: '👎', ok_hand: '👌', muscle: '💪', raised_hands: '🙌', handshake: '🤝', point_up: '☝️', eyes: '👀',
    heart: '❤️', fire: '🔥', '100': '💯', tada: '🎉', sparkles: '✨', star: '⭐', rocket: '🚀', trophy: '🏆', bulb: '💡', brain: '🧠',
    white_check_mark: '✅', heavy_check_mark: '✔️', x: '❌', warning: '⚠️', no_entry: '⛔', question: '❓', exclamation: '❗', construction: '🚧', hourglass: '⏳', alarm_clock: '⏰',
    calendar: '📅', memo: '📝', pushpin: '📌', paperclip: '📎', link: '🔗', lock: '🔒', bell: '🔔', mega: '📣', email: '📧', phone: '📞',
    money: '💰', moneybag: '💰', chart: '📈', chart_down: '📉', bar_chart: '📊', briefcase: '💼', bank: '🏦', receipt: '🧾', coffee: '☕', pizza: '🍕',
    house: '🏠', palm_tree: '🌴', airplane: '✈️', car: '🚗', sick: '🤒', headphones: '🎧', computer: '💻', gift: '🎁', seedling: '🌱', zap: '⚡',
  };
  const PICKER = ['👍', '✅', '👀', '🙌', '🎉', '❤️', '😂', '🙏', '🔥', '💯', '🚀', '😄', '😉', '🤔', '😅', '😭', '😱', '🥳', '👏', '💪', '🤝', '👋', '👌', '☝️',
    '✔️', '❌', '⚠️', '⛔', '❓', '⏳', '📌', '📝', '📅', '📣', '💡', '🧠', '⭐', '🏆', '💰', '📈', '📉', '📊', '💼', '🧾', '☕', '🍕', '🌴', '🎧'];
  const QUICK = ['✅', '👀', '🙌'];
  const STATUS_PRESETS = [['📅', 'In a meeting'], ['🚌', 'Commuting'], ['🤒', 'Out sick'], ['🌴', 'Vacationing'], ['🏠', 'Working remotely'], ['🎯', 'Focusing']];

  const isDm = (ch) => ch.startsWith('dm:');
  const titleOf = (ch) => (isDm(ch) ? (Chat.people().find((p) => p.channel === ch)?.name || 'Direct message') : `#${Chat.channelInfo(ch)?.name || ch.replace(/^[cp]:/, '')}`);
  const hintOf = (ch) => (isDm(ch) ? 'Only the two of you can read this' : (Chat.channelInfo(ch)?.hint || ''));
  const meUserIds = () => S.all('users').filter((u) => (u.email || '').toLowerCase() === Chat.me.email).map((u) => u.id);
  const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : U.relDays(iso.slice(0, 10)); };
  const permalink = (m) => `${Mailer.APP_URL}${Cloud.demo ? 'demo/' : ''}#/chat/${encodeURIComponent(m.channel)}/${m.id}`;

  // Current display name of a referenced record (it may have been renamed or deleted)
  function refName(type, id) {
    const r = S.get(COLL[type], id);
    if (!r) return null;
    if (type === 'contact') return S.contactName(r);
    if (type === 'org' || type === 'deal' || type === 'user') return r.name;
    if (type === 'resolution') return `${r.number} ${r.title}`;
    return r.title;
  }

  function refHtml(type, id, label) {
    const name = refName(type, id);
    const t = TYPES[type];
    if (type === 'user') {
      const mine = meUserIds().includes(id);
      return `<a class="mention ${mine ? 'me' : ''}" href="#" data-act="openRef" data-ref="user:${esc(id)}" title="${esc(name || label)}">@${esc(name || label)}</a>`;
    }
    if (!name) return `<span class="chat-ref missing" title="This ${t.label.toLowerCase()} no longer exists">${UI.icon(t.icon, 'ic-sm')}${esc(label)}</span>`;
    return `<a class="chat-ref ref-${type}" href="#" data-act="openRef" data-ref="${type}:${esc(id)}" title="Open ${esc(t.label.toLowerCase())}: ${esc(name)}">${UI.icon(t.icon, 'ic-sm')}<span>${esc(name)}</span></a>`;
  }

  // ---- Formatting: *bold* _italic_ ~strike~ `code` ```block``` > quote, lists, :emoji:, links ----
  function fmtText(s) {
    let h = esc(s);
    h = h.replace(/:([a-z0-9_+-]{1,30}):/g, (m, k) => EMOJI[k] || m);
    h = h.replace(/(^|[\s(])\*(?=\S)([^*\n]*?\S)\*(?=$|[\s).,!?:;])/g, '$1<b>$2</b>');
    h = h.replace(/(^|[\s(])_(?=\S)([^_\n]*?\S)_(?=$|[\s).,!?:;])/g, '$1<i>$2</i>');
    h = h.replace(/(^|[\s(])~(?=\S)([^~\n]*?\S)~(?=$|[\s).,!?:;])/g, '$1<s>$2</s>');
    h = h.replace(/(^|\s)@(channel|here|everyone)\b/g, '$1<span class="mention all">@$2</span>');
    return h;
  }
  const INLINE_RE = new RegExp(`${REF_SRC}|\`([^\`\\n]+)\`|(https://[^\\s<>"]{3,300})`, 'g');
  function inline(line) {
    let out = '';
    let last = 0;
    line.replace(INLINE_RE, (m, type, id, label, code, url, at) => {
      out += fmtText(line.slice(last, at));
      if (type) out += refHtml(type, id, label);
      else if (code) out += `<code>${esc(code)}</code>`;
      else { const u = url.replace(/[.,!?;:)]+$/, ''); out += `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>${esc(url.slice(u.length))}`; }
      last = at + m.length;
      return m;
    });
    return out + fmtText(line.slice(last));
  }
  function bodyHtml(body) {
    const src = String(body || '');
    let out = '';
    src.split(/```/).forEach((chunk, i) => {
      if (i % 2) { out += `<pre class="md-pre">${esc(chunk.replace(/^\n|\n$/g, ''))}</pre>`; return; }
      const lines = chunk.split('\n');
      let quote = [];
      const flush = () => { if (quote.length) { out += `<blockquote>${quote.join('<br>')}</blockquote>`; quote = []; } };
      lines.forEach((ln, j) => {
        if (/^> ?/.test(ln)) { quote.push(inline(ln.replace(/^> ?/, ''))); return; }
        flush();
        const li = ln.match(/^\s*(?:[-*•]|(\d+)\.)\s+(.*)$/);
        if (li) { out += `<div class="md-li"><span>${li[1] ? `${li[1]}.` : '•'}</span><span>${inline(li[2])}</span></div>`; return; }
        out += inline(ln) + (j < lines.length - 1 ? '<br>' : '');
      });
      flush();
    });
    return out;
  }
  // Text without markup (notifications, search, task titles)
  const plain = (body) => String(body || '').replace(REF_RE, (m, type, id, label) => `${type === 'user' ? '@' : ''}${refName(type, id) || label}`).replace(/```/g, '').replace(/[*_~`]/g, '');

  // ---- Messages ----------------------------------------------------------------------------
  let editing = '';
  function reactionsHtml(m) {
    const r = Chat.reactionsOf(m.id);
    if (!r.length) return '';
    return `<div class="reacts">${r.map((x) => `<button type="button" class="react ${x.mine ? 'mine' : ''}" data-act="msgReact" data-id="${m.id}" data-e="${esc(x.emoji)}" aria-pressed="${x.mine}" title="${esc(x.names.join(', '))} reacted with ${esc(x.emoji)}">${esc(x.emoji)} <b>${x.count}</b></button>`).join('')}
      <button type="button" class="react add" data-act="msgEmoji" data-id="${m.id}" aria-label="Add reaction" title="Add reaction">${UI.icon('plus', 'ic-sm')}</button></div>`;
  }
  function pollHtml(m) {
    const p = m.meta?.poll;
    if (!p) return '';
    const votes = Chat.marksOf(m.id, 'vote');
    const total = votes.length;
    return `<div class="poll" role="group" aria-label="Poll: ${esc(p.question)}"><b>📊 ${esc(p.question)}</b>${p.options.map((o, i) => {
      const v = votes.filter((x) => x.value === String(i));
      const mine = v.some((x) => x.user_email === Chat.me.email);
      const pct = total ? Math.round((v.length / total) * 100) : 0;
      return `<button type="button" class="poll-opt ${mine ? 'mine' : ''}" data-act="pollVote" data-id="${m.id}" data-o="${i}" aria-pressed="${mine}" title="${esc(v.map((x) => x.user_name).join(', ') || 'No votes yet')}">
        <span class="poll-fill" style="width:${pct}%"></span><span class="poll-txt">${mine ? '✓ ' : ''}${esc(o)}</span><span class="poll-n">${v.length} · ${pct}%</span></button>`;
    }).join('')}<small class="muted">${U.plural(total, 'vote')} · click again to remove yours</small></div>`;
  }
  function threadSummary(m) {
    const reps = Chat.repliesOf(m.id);
    if (!reps.length) return '';
    const who = [...new Set(reps.map((r) => r.author_name || r.author_email))].slice(0, 4);
    return `<button type="button" class="thread-sum" data-act="msgThread" data-id="${m.id}">${who.map((n) => UI.avatar(n, 'xs')).join('')}<b>${U.plural(reps.length, 'reply', 'replies')}</b><span class="muted">Last reply ${esc(ago(reps.slice(-1)[0].created_at))}</span></button>`;
  }
  function toolsHtml(m, { inThread }) {
    return `<div class="msg-tools" role="toolbar" aria-label="Message actions">
      ${QUICK.map((e) => `<button type="button" data-act="msgReact" data-id="${m.id}" data-e="${e}" aria-label="React ${e}" title="React ${e}">${e}</button>`).join('')}
      <button type="button" data-act="msgEmoji" data-id="${m.id}" aria-label="Add reaction" title="Add reaction">${UI.icon('plus', 'ic-sm')}😊</button>
      ${inThread || m.parent_id ? '' : `<button type="button" data-act="msgThread" data-id="${m.id}" aria-label="Reply in thread" title="Reply in thread">${UI.icon('message', 'ic-sm')}</button>`}
      <button type="button" data-act="msgSave" data-id="${m.id}" aria-label="${Chat.isSaved(m.id) ? 'Remove from saved' : 'Save for later'}" title="${Chat.isSaved(m.id) ? 'Remove from saved' : 'Save for later'}">${Chat.isSaved(m.id) ? '🔖' : UI.icon('flag', 'ic-sm')}</button>
      <button type="button" data-act="msgMore" data-id="${m.id}" aria-label="More actions" title="More actions">${UI.icon('more', 'ic-sm')}</button>
    </div>`;
  }
  function msgHtml(m, { cont = false, inThread = false, highlight = '' } = {}) {
    const who = m.author_name || m.author_email;
    const st = Chat.statusOf(m.author_email);
    const pinned = Chat.marksOf(m.id, 'pin')[0];
    const parent = m.parent_id && !inThread ? Chat.byId(m.parent_id) : null;
    const body = editing === m.id
      ? `<form class="msg-edit" data-msg-edit="${m.id}"><textarea class="input" rows="2" aria-label="Edit message">${esc(m.body)}</textarea><div class="row"><span class="small muted">Enter to save · Esc to cancel</span><span class="spacer"></span><button type="button" class="btn btn-sm" data-act="msgEditCancel">Cancel</button><button type="button" class="btn btn-sm btn-primary" data-act="msgEditSave" data-id="${m.id}">Save</button></div></form>`
      : `<div class="msg-body ${m.meta?.me ? 'me-action' : ''}">${m.meta?.me ? `<i>${esc(who)} ${bodyHtml(m.body)}</i>` : bodyHtml(m.body)}${m.edited_at ? ' <span class="edited">(edited)</span>' : ''}</div>`;
    return `<article class="msg ${cont ? 'cont' : ''} ${pinned ? 'pinned' : ''} ${highlight === m.id ? 'flash' : ''} ${Chat.mentionsMe(m) ? 'mentioned' : ''}" id="m-${m.id}" aria-label="${esc(who)} at ${esc(time(m.created_at))}">
      ${cont ? `<span class="msg-gutter" aria-hidden="true">${esc(time(m.created_at))}</span>` : UI.avatar(who)}
      <div class="msg-main">
        ${pinned ? `<div class="msg-flag">📌 Pinned by ${esc(pinned.user_name || pinned.user_email)}</div>` : ''}
        ${Chat.isSaved(m.id) && !pinned ? '<div class="msg-flag">🔖 Saved for later</div>' : ''}
        ${parent ? `<div class="msg-flag">replied to a thread: <a href="#" data-act="msgThread" data-id="${parent.id}">${esc(plain(parent.body).slice(0, 60))}</a></div>` : ''}
        ${cont ? '' : `<div class="msg-head"><b>${esc(who)}</b>${st ? `<span class="status-emoji" title="${esc(st.text || '')}">${esc(st.emoji || '💬')}</span>` : ''}<time datetime="${esc(m.created_at)}" title="${esc(new Date(m.created_at).toLocaleString('en-US'))}">${esc(time(m.created_at))}</time></div>`}
        ${body}
        ${pollHtml(m)}
        ${reactionsHtml(m)}
        ${inThread ? '' : threadSummary(m)}
      </div>
      ${toolsHtml(m, { inThread })}
    </article>`;
  }

  function runHtml(list, { inThread = false, since = '', highlight = '' } = {}) {
    let lastDay = '';
    let prev = null;
    let newShown = false;
    return list.map((m) => {
      const d = new Date(m.created_at);
      const day = U.toDateStr(d);
      let head = day !== lastDay ? `<div class="chat-day" role="separator"><span>${esc(U.daysFromToday(day) === 0 ? 'Today' : U.daysFromToday(day) === -1 ? 'Yesterday' : U.fmtDateLong(day))}</span></div>` : '';
      if (since && !newShown && m.created_at > since && (m.author_email || '').toLowerCase() !== Chat.me.email) { head += '<div class="chat-new" role="separator"><span>New</span></div>'; newShown = true; }
      const cont = !head && prev && prev.author_email === m.author_email && (d - new Date(prev.created_at)) < 5 * 60000 && !m.meta?.poll && !(m.parent_id && !inThread);
      lastDay = day;
      prev = m;
      return head + msgHtml(m, { cont, inThread, highlight });
    }).join('');
  }

  function logHtml(channel, { compact = false, since = '', highlight = '' } = {}) {
    const list = Chat.messagesIn(channel);
    if (!list.length) {
      return `<div class="empty" style="margin:auto">${UI.icon('message')}<h3>No messages in ${esc(titleOf(channel))} yet</h3><p>${compact ? 'Write the first one below.' : 'Start the conversation below. Type @ to mention someone or link a record, / for commands, : for emoji.'}</p></div>`;
    }
    return runHtml(list, { since, highlight });
  }

  function threadHtml(id, highlight = '') {
    const p = Chat.byId(id);
    if (!p) return '<div class="empty-sm">This thread no longer exists.</div>';
    const reps = Chat.repliesOf(id);
    return `${msgHtml(p, { inThread: true, highlight })}<div class="thread-count">${U.plural(reps.length, 'reply', 'replies')}</div>${runHtml(reps, { inThread: true, highlight })}`;
  }

  // ---- Autocomplete sources ----------------------------------------------------------------
  function candidates(q) {
    const items = [];
    const push = (type, id, label, sub) => items.push({ type, id, label, sub });
    S.all('users').forEach((u) => push('user', u.id, u.name, [u.role, Chat.isOnline(u.email) ? 'online' : ''].filter(Boolean).join(' · ') || 'Teammate'));
    S.all('contacts').forEach((c) => push('contact', c.id, S.contactName(c), [c.board?.role && S.isBoardType(c.type) ? c.board.role : c.type, S.orgName(c.orgId)].filter(Boolean).join(' · ')));
    S.all('organizations').forEach((o) => push('org', o.id, o.name, o.type === 'Main' ? 'Our company' : o.type));
    S.all('meetings').forEach((m) => push('meeting', m.id, m.title, U.fmtDate(m.date)));
    S.all('tasks').filter((t) => t.status !== 'done').forEach((t) => push('task', t.id, t.title, [S.nameOf(t.ownerId), t.due ? `due ${U.relDays(t.due)}` : ''].filter(Boolean).join(' · ')));
    S.all('deals').forEach((d) => push('deal', d.id, d.name, S.stageInfo(d.stage).name));
    S.all('resolutions').forEach((r) => push('resolution', r.id, `${r.number} ${r.title}`, r.status));
    const query = (q || '').trim().toLowerCase();
    const order = ['user', 'contact', 'meeting', 'task', 'org', 'deal', 'resolution'];
    const specials = ['channel', 'here'].filter((s) => !query || s.startsWith(query)).map((s) => ({ kind: 'special', label: `@${s}`, sub: s === 'here' ? 'Notify everyone online' : 'Notify everyone in this channel', insert: `@${s} ` }));
    return [...items
      .filter((it) => !query || U.matches(query, it.label, it.sub))
      .map((it) => ({ ...it, kind: 'ref', rank: (it.label.toLowerCase().startsWith(query) ? 0 : 1) * 10 + order.indexOf(it.type) }))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .slice(0, 8), ...specials];
  }

  const COMMANDS = [
    ['/task', 'title', 'Create a task assigned to you and share it here'],
    ['/remind', 'what', 'Remind yourself or someone (becomes a task with a due date)'],
    ['/poll', '"Question" "Option 1" "Option 2"', 'Ask the channel to vote'],
    ['/huddle', '', 'Start a video call and post the link'],
    ['/topic', 'text', 'Set the channel topic'],
    ['/status', 'emoji text  ·  /status clear', 'Set your status'],
    ['/dnd', 'on | off', 'Pause notifications'],
    ['/mute', '', 'Mute or unmute this conversation'],
    ['/me', 'action', 'Post an action in italics'],
    ['/shrug', 'text', 'Append ¯\\_(ツ)_/¯'],
    ['/search', 'text  in:#channel  from:name', 'Search messages'],
    ['/pinned', '', 'Show pinned messages'],
    ['/help', '', 'Formatting and commands'],
  ];

  // ---- Slash commands ----------------------------------------------------------------------
  // Returns false (nothing to send), or { text, extra } to send
  async function command(raw, ctx) {
    const m = raw.match(/^\/(\w+)\s*([\s\S]*)$/);
    if (!m) return { text: raw };
    const [, cmd, arg] = m;
    const a = arg.trim();
    const me = S.currentUser();
    switch (cmd.toLowerCase()) {
      case 'shrug': return { text: `${a} ¯\\_(ツ)_/¯`.trim() };
      case 'me': return a ? { text: a, extra: { me: true } } : false;
      case 'poll': {
        const parts = [...a.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((x) => (x[1] || x[2]).trim()).filter(Boolean);
        if (parts.length < 3) { UI.toast('Use: /poll "Question" "Option 1" "Option 2"', 'error'); return false; }
        return { text: `📊 ${parts[0]}`, extra: { poll: { question: parts[0], options: parts.slice(1, 11) } } };
      }
      case 'task': {
        if (!a) { Actions.newTask?.({}); return false; }
        const t = S.upsert('tasks', { title: plain(a).slice(0, 200), ownerId: me?.id || '', due: '', priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '', notes: `Created from ${titleOf(ctx.channel)}`, tags: [], followerIds: [], comments: [], createdBy: me?.id || '', projectId: '', sectionId: '' });
        return { text: `📝 New task: [[task:${t.id}|${t.title.replace(/[[\]|\n]/g, ' ').slice(0, 80)}]]` };
      }
      case 'remind': remindDialog(a, ctx); return false;
      case 'huddle': {
        const room = `Aetherium-${(Chat.channelInfo(ctx.channel)?.name || 'dm').replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 8)}`;
        const url = `https://meet.jit.si/${room}`;
        window.open(url, '_blank', 'noopener');
        return { text: `🎧 started a huddle${a ? `: ${a}` : ''} — join here: ${url}` };
      }
      case 'topic': {
        if (!Cloud.canWrite) { UI.toast('You have view-only access', 'info'); return false; }
        setTopic(ctx.channel, a);
        return { text: a ? `set the channel topic: ${a}` : 'cleared the channel topic', extra: { me: true } };
      }
      case 'status': setStatus(a); return false;
      case 'dnd': Chat.setDnd(a ? /^on|^1|^yes/i.test(a) : !Chat.dnd); UI.toast(Chat.dnd ? 'Do not disturb is on' : 'Notifications resumed', 'info'); return false;
      case 'mute': UI.toast(Chat.toggleMute(ctx.channel) ? `${titleOf(ctx.channel)} muted` : `${titleOf(ctx.channel)} unmuted`, 'info'); return false;
      case 'search': Views.chat.openPane?.('search', a); return false;
      case 'pinned': Views.chat.openPane?.('pinned'); return false;
      case 'help': helpDialog(); return false;
      default: UI.toast(`Unknown command /${cmd}. Type /help`, 'error'); return false;
    }
  }

  function setTopic(channel, topic) {
    const list = S.settings.channels || [];
    if (list.some((c) => c.id === channel)) S.setSettings({ channels: list.map((c) => (c.id === channel ? { ...c, topic } : c)) });
    else S.setSettings({ channelMeta: { ...(S.settings.channelMeta || {}), [channel]: { ...((S.settings.channelMeta || {})[channel] || {}), topic } } });
  }

  function setStatus(arg) {
    const u = S.currentUser();
    if (!u) return;
    if (/^clear$/i.test(arg || '')) { S.update('users', u.id, { status: null }); UI.toast('Status cleared'); return; }
    if (arg) {
      const mm = arg.match(/^(\p{Extended_Pictographic}️?|:[a-z0-9_+-]+:)\s*(.*)$/u);
      const emoji = mm ? (mm[1].startsWith(':') ? EMOJI[mm[1].slice(1, -1)] || '💬' : mm[1]) : '💬';
      S.update('users', u.id, { status: { emoji, text: (mm ? mm[2] : arg).slice(0, 80), until: '' } });
      UI.toast('Status set', 'success');
      return;
    }
    const cur = u.status || {};
    UI.formModal({
      title: 'Set a status',
      size: 'sm',
      values: { emoji: cur.emoji || '', text: cur.text || '', clear: 'today' },
      fields: [
        { type: 'html', html: `<div class="row wrap" style="gap:6px">${STATUS_PRESETS.map(([e, t]) => `<button type="button" class="btn btn-sm" data-preset="${esc(e)}|${esc(t)}">${e} ${esc(t)}</button>`).join('')}</div>` },
        { name: 'emoji', label: 'Emoji', placeholder: '💬' },
        { name: 'text', label: 'What’s your status?', placeholder: 'e.g. Back at 3pm' },
        { name: 'clear', label: 'Clear after', type: 'select', options: [{ value: 'today', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'never', label: 'Don’t clear' }] },
      ],
      submitText: 'Save status',
      onMount: (form) => form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        const [em, tx] = b.dataset.preset.split('|');
        form.elements.emoji.value = em;
        form.elements.text.value = tx;
      }),
      onSubmit: (d) => {
        if (!d.emoji && !d.text) { S.update('users', u.id, { status: null }); return; }
        const until = d.clear === 'today' ? `${U.today()}T23:59` : d.clear === 'week' ? `${U.addDays(U.today(), 7 - ((new Date().getDay() + 6) % 7) - 1)}T23:59` : '';
        S.update('users', u.id, { status: { emoji: d.emoji || '💬', text: d.text, until } });
        UI.toast('Status set', 'success');
      },
    });
  }

  function remindDialog(text, ctx, msg = null) {
    const what = text || (msg ? `Reminder: ${plain(msg.body).slice(0, 120)}` : '');
    UI.formModal({
      title: msg ? 'Remind me about this message' : 'Set a reminder',
      size: 'sm',
      intro: 'Reminders become tasks with a due date, so they show up in My tasks and the inbox.',
      values: { title: what, when: 'tomorrow', due: U.addDays(U.today(), 1), ownerId: S.currentUser()?.id || '' },
      fields: [
        { name: 'title', label: 'What', required: true },
        { name: 'when', label: 'When', type: 'select', options: [{ value: 'today', label: 'Later today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'week', label: 'Next week' }, { value: 'date', label: 'Pick a date' }] },
        { name: 'due', label: 'Date', type: 'date', showWhen: 'when:date' },
        { name: 'ownerId', label: 'Remind', type: 'select', options: UI.opts.owners() },
      ],
      submitText: 'Set reminder',
      onSubmit: (d) => {
        const due = d.when === 'today' ? U.today() : d.when === 'tomorrow' ? U.addDays(U.today(), 1) : d.when === 'week' ? U.addDays(U.today(), 7) : d.due;
        const t = S.upsert('tasks', {
          title: d.title.slice(0, 200), ownerId: d.ownerId, due, priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '',
          notes: msg ? `${plain(msg.body)}\n\nMessage: ${permalink(msg)}` : `Reminder set in ${titleOf(ctx.channel)}`, tags: [], followerIds: [], comments: [], createdBy: S.currentUser()?.id || '', projectId: '', sectionId: '',
        });
        Work.assigned(t, '');
        UI.toast(`Reminder set for ${U.fmtDate(due)}`, 'success', { actionLabel: 'Open', onAction: () => TaskDrawer.open(t.id) });
      },
    });
  }

  function helpDialog() {
    UI.modal({
      title: 'Chat: formatting and commands',
      body: `<div class="help-grid">
        <div><h4>Formatting</h4><dl class="info">
          <dt><code>*bold*</code></dt><dd><b>bold</b></dd><dt><code>_italic_</code></dt><dd><i>italic</i></dd><dt><code>~strike~</code></dt><dd><s>strike</s></dd>
          <dt><code>\`code\`</code></dt><dd><code>code</code></dd><dt><code>\`\`\`block\`\`\`</code></dt><dd>code block</dd><dt><code>&gt; quote</code></dt><dd>quote</dd>
          <dt><code>- item</code></dt><dd>• list</dd><dt><code>:tada:</code></dt><dd>🎉 emoji</dd><dt><code>@name</code></dt><dd>mention or link a record</dd>
          <dt><code>@channel</code></dt><dd>notify everyone</dd></dl>
          <h4>Keys</h4><dl class="info"><dt>Enter</dt><dd>send · Shift+Enter new line</dd><dt>↑</dt><dd>edit your last message</dd><dt>Ctrl+K</dt><dd>jump to a conversation</dd><dt>Ctrl+B / I</dt><dd>bold / italic</dd></dl></div>
        <div><h4>Commands</h4><dl class="info">${COMMANDS.map(([c, a, d]) => `<dt><code>${esc(c)}</code></dt><dd>${esc(d)}${a ? `<br><small class="muted">${esc(c)} ${esc(a)}</small>` : ''}</dd>`).join('')}</dl></div></div>`,
      footer: '<span class="spacer"></span><button class="btn btn-primary" data-close>Got it</button>',
      size: 'lg',
    });
  }

  // ---- Emoji picker popover ----------------------------------------------------------------
  let pop = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; } };
  function emojiPicker(anchor, onPick) {
    closePop();
    pop = document.createElement('div');
    pop.className = 'emoji-pop popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Pick an emoji');
    pop.innerHTML = `<input class="input" type="search" placeholder="Search emoji (e.g. tada)" aria-label="Search emoji"><div class="emoji-grid">${PICKER.map((e) => `<button type="button" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left))}px`;
    pop.style.top = `${r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6}px`;
    const grid = pop.querySelector('.emoji-grid');
    const input = pop.querySelector('input');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase().replace(/:/g, '');
      const list = q ? [...new Set(Object.entries(EMOJI).filter(([k]) => k.includes(q)).map(([, v]) => v))] : PICKER;
      grid.innerHTML = list.map((e) => `<button type="button" data-e="${e}" aria-label="${e}">${e}</button>`).join('') || '<span class="muted small">No match</span>';
    });
    pop.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (b) { closePop(); onPick(b.dataset.e); } });
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus?.(); }
      if (e.key === 'Enter') { e.preventDefault(); grid.querySelector('[data-e]')?.click(); }
    });
    setTimeout(() => input.focus(), 0);
  }
  document.addEventListener('mousedown', (e) => { if (pop && !pop.contains(e.target)) closePop(); });

  // ---- Composer ----------------------------------------------------------------------------
  let seq = 0;
  function attachComposer(form, { onSend, draftKey, channel, onEditLast }) {
    const input = form.querySelector('textarea');
    const box = form.querySelector('.ref-list');
    const id = `refl${++seq}`;
    box.id = id;
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', 'Suggestions');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', id);
    input.setAttribute('aria-expanded', 'false');
    let refs = []; // { label, token }
    let results = [];
    let sel = 0;
    let at = -1;
    let mode = '';

    const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(180, input.scrollHeight)}px`; };
    const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); at = -1; mode = ''; };
    const optHtml = (r) => {
      if (r.kind === 'cmd') return `<span class="ref-ic">/</span><span class="ref-txt"><b>${esc(r.label)} <span class="muted">${esc(r.args)}</span></b><small>${esc(r.sub)}</small></span>`;
      if (r.kind === 'emoji') return `<span class="ref-ic">${r.emoji}</span><span class="ref-txt"><b>:${esc(r.label)}:</b></span>`;
      if (r.kind === 'special') return `<span class="ref-ic">@</span><span class="ref-txt"><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></span>`;
      return `${UI.icon(TYPES[r.type].icon)}<span class="ref-txt"><b>${esc(r.label)}</b><small>${esc(TYPES[r.type].label)}${r.sub ? ` · ${esc(r.sub)}` : ''}</small></span>`;
    };
    const paint = () => {
      box.innerHTML = results.length
        ? results.map((r, i) => `<div class="ref-opt ${i === sel ? 'sel' : ''}" role="option" id="${id}-${i}" aria-selected="${i === sel}" data-i="${i}">${optHtml(r)}</div>`).join('')
        : '<div class="ref-empty" role="presentation">Nothing matches.</div>';
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (results.length) input.setAttribute('aria-activedescendant', `${id}-${sel}`);
      box.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    };
    const detect = () => {
      const pos = input.selectionStart;
      const before = input.value.slice(0, pos);
      const slash = before.match(/^\/(\w*)$/);
      if (slash) {
        mode = 'cmd'; at = 0;
        results = COMMANDS.filter(([c]) => c.slice(1).startsWith(slash[1].toLowerCase())).map(([c, args, sub]) => ({ kind: 'cmd', label: c, args, sub }));
        sel = 0; return results.length ? paint() : close();
      }
      const emo = before.match(/(^|\s):([a-z0-9_+-]{2,30})$/);
      if (emo) {
        mode = 'emoji'; at = pos - emo[2].length - 1;
        const seen = new Set();
        results = Object.entries(EMOJI).filter(([k, v]) => k.startsWith(emo[2]) && !seen.has(v) && seen.add(v)).slice(0, 8).map(([k, v]) => ({ kind: 'emoji', label: k, emoji: v }));
        sel = 0; return results.length ? paint() : close();
      }
      const i = before.lastIndexOf('@');
      if (i < 0 || (i > 0 && !/\s/.test(before[i - 1]))) return close();
      const q = before.slice(i + 1);
      if (q.length > 40 || /\n/.test(q)) return close();
      mode = 'ref'; at = i;
      results = candidates(q);
      sel = 0;
      paint();
    };
    const insert = (text, from, caretAdd = 0) => {
      const end = input.selectionStart;
      input.value = `${input.value.slice(0, from)}${text}${input.value.slice(end)}`;
      const caret = from + text.length + caretAdd;
      input.setSelectionRange(caret, caret);
    };
    const pick = (r) => {
      if (!r || at < 0) return;
      if (r.kind === 'cmd') insert(`${r.label} `, 0);
      else if (r.kind === 'emoji') insert(`${r.emoji} `, at);
      else if (r.kind === 'special') insert(r.insert, at);
      else {
        const label = r.label.replace(/[[\]|\n]/g, ' ').trim().slice(0, 80);
        insert(`@${label} `, at);
        refs.push({ label, token: `[[${r.type}:${r.id}|${label}]]` });
      }
      close();
      grow();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };
    const wrap = (mark) => {
      const s = input.selectionStart;
      const e = input.selectionEnd;
      const v = input.value;
      if (mark === 'list' || mark === 'quote') {
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const pre = mark === 'list' ? '- ' : '> ';
        input.value = v.slice(0, ls) + pre + v.slice(ls);
        input.setSelectionRange(s + 2, e + 2);
      } else {
        const m = mark === 'code' ? '`' : mark;
        input.value = `${v.slice(0, s)}${m}${v.slice(s, e)}${m}${v.slice(e)}`;
        input.setSelectionRange(s + 1, e + 1);
      }
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    input.addEventListener('input', () => { if (draftKey) ChatUI.drafts[draftKey()] = input.value; grow(); detect(); if (channel && input.value) Chat.sendTyping(channel()); });
    input.addEventListener('click', detect);
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', (e) => {
      if (!box.hidden && results.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % results.length; paint(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + results.length) % results.length; paint(); return; }
        if ((e.key === 'Enter' && mode !== 'cmd') || e.key === 'Tab') { e.preventDefault(); pick(results[sel]); return; }
        if (e.key === 'Enter' && mode === 'cmd' && input.value.trim() !== results[sel].label) { e.preventDefault(); pick(results[sel]); return; }
      }
      if (!box.hidden && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); wrap(e.key === 'b' ? '*' : '_'); return; }
      if (e.key === 'ArrowUp' && !input.value && onEditLast) { e.preventDefault(); onEditLast(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    box.addEventListener('mousedown', (e) => { const o = e.target.closest('[data-i]'); if (o) { e.preventDefault(); pick(results[Number(o.dataset.i)]); } });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button[type=button]');
      if (!b) return;
      if (b.dataset.fmt) wrap(b.dataset.fmt);
      else if (b.dataset.emoji !== undefined) emojiPicker(b, (em) => { insert(`${em} `, input.selectionStart ?? input.value.length); grow(); input.focus(); });
      else if (b.dataset.slash !== undefined) { if (!input.value.startsWith('/')) { input.value = `/${input.value}`; } input.focus(); input.setSelectionRange(1, 1); detect(); }
      else if (b.dataset.refOpen !== undefined) {
        const pos = input.selectionStart ?? input.value.length;
        const needsSpace = pos > 0 && !/\s/.test(input.value[pos - 1]);
        insert(`${needsSpace ? ' ' : ''}@`, pos);
        input.focus();
        detect();
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let text = input.value;
      if (!text.trim()) return;
      [...refs].sort((a, b) => b.label.length - a.label.length).forEach((r) => { text = text.split(`@${r.label}`).join(r.token); });
      const original = input.value;
      const broadcast = form.querySelector('[name=broadcast]')?.checked;
      input.value = '';
      grow();
      close();
      let ok;
      if (/^\/\w/.test(text.trim())) {
        const res = await command(text.trim(), { channel: channel ? channel() : 'general' });
        ok = res === false ? true : await onSend(res.text, res.extra);
      } else ok = await onSend(text, broadcast ? { broadcast: true } : null);
      if (!ok) { input.value = original; grow(); return; }
      refs = [];
      if (draftKey) ChatUI.drafts[draftKey()] = '';
      input.focus();
    });
    grow();
    return { input, focus: () => input.focus({ preventScroll: true }) };
  }

  const composerHtml = (channel, value = '', { thread = false, compact = false } = {}) => `
    <form class="chat-compose ${compact ? 'compact' : ''}" novalidate>
      <div class="ref-list" hidden></div>
      <div class="compose-box">
        <textarea rows="1" aria-label="${thread ? 'Reply in thread' : `Message ${esc(titleOf(channel))}`}" placeholder="${thread ? 'Reply…' : `Message ${esc(titleOf(channel))}`}">${esc(value)}</textarea>
        <div class="compose-bar">
          ${compact ? '' : `<button type="button" data-fmt="*" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button>
          <button type="button" data-fmt="_" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button>
          <button type="button" data-fmt="~" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
          <button type="button" data-fmt="code" title="Code" aria-label="Code">&lt;/&gt;</button>
          <button type="button" data-fmt="list" title="Bulleted list" aria-label="Bulleted list">${UI.icon('list', 'ic-sm')}</button>
          <button type="button" data-fmt="quote" title="Quote" aria-label="Quote">❝</button>
          <span class="bar-sep"></span>`}
          <button type="button" data-ref-open title="Mention someone or link a record (@)" aria-label="Mention or link">@</button>
          <button type="button" data-emoji title="Emoji" aria-label="Insert emoji">😊</button>
          ${thread ? '' : '<button type="button" data-slash title="Commands (/)" aria-label="Commands">/</button>'}
          <span class="spacer"></span>
          ${thread && !isDm(channel) ? `<label class="check small"><input type="checkbox" name="broadcast"><span>Also send to ${esc(titleOf(channel))}</span></label>` : ''}
          <button class="btn btn-primary btn-sm" type="submit" aria-label="Send message">${UI.icon('arrowRight')}</button>
        </div>
      </div>
    </form>`;

  // Navigate to a referenced record (used by the chat page and the dock)
  function openRef(ref) {
    const [type, id] = String(ref || '').split(':');
    if (!COLL[type] || !S.get(COLL[type], id)) { UI.toast('That record no longer exists', 'info'); return; }
    const later = (fn) => setTimeout(fn, 60);
    if (type === 'user') {
      const u = S.get('users', id);
      if (u.email && u.email.toLowerCase() !== Chat.me.email) location.hash = `#/chat/${encodeURIComponent(Chat.dmId(Chat.me.email, u.email))}`;
      else location.hash = '#/settings';
    } else if (type === 'contact') location.hash = `#/contacts/${id}`;
    else if (type === 'org') location.hash = `#/organizations/${id}`;
    else if (type === 'meeting') location.hash = `#/board/meetings/${id}`;
    else if (type === 'deal') { location.hash = '#/pipeline'; later(() => Actions.editDeal({ id })); }
    else if (type === 'task') { location.hash = '#/tasks'; later(() => Actions.editTask({ id })); }
    else if (type === 'resolution') { location.hash = '#/board/resolutions'; later(() => Actions.editResolution({ id })); }
  }

  // ---- Message actions (wired by App's click delegation) -----------------------------------
  const isMine = (m) => (m.author_email || '').toLowerCase() === Chat.me.email;
  function openThread(id) {
    const m = Chat.byId(id);
    if (!m) return;
    const root = m.parent_id ? Chat.byId(m.parent_id) || m : m;
    if (location.hash.startsWith('#/chat') && Views.chat.openThread) Views.chat.openThread(root.id);
    else location.hash = `#/chat/${encodeURIComponent(root.channel)}/${root.id}`;
  }
  const actions = {
    msgReact: (ds) => Chat.react(ds.id, ds.e),
    msgEmoji: (ds, el) => emojiPicker(el, (e) => Chat.react(ds.id, e)),
    msgThread: (ds) => openThread(ds.id),
    msgSave: (ds) => UI.toast(Chat.toggleSave(ds.id) ? 'Saved for later' : 'Removed from saved', 'info'),
    pollVote: (ds) => Chat.vote(ds.id, Number(ds.o)),
    msgEditCancel: () => { editing = ''; Views.chat.repaint?.(); ChatDock.repaint?.(); },
    msgEditSave: async (ds) => {
      const ta = document.querySelector(`[data-msg-edit="${ds.id}"] textarea`);
      editing = '';
      await Chat.edit(ds.id, ta?.value || '');
      Views.chat.repaint?.(); ChatDock.repaint?.();
    },
    msgMore: (ds, el) => {
      const m = Chat.byId(ds.id);
      if (!m) return;
      const pinned = Chat.marksOf(m.id, 'pin').length;
      UI.menu(el, [
        ...(isMine(m) ? [{ label: 'Edit message', icon: 'edit', onClick: () => startEdit(m.id) }] : []),
        ...(m.parent_id ? [] : [{ label: 'Reply in thread', icon: 'message', onClick: () => openThread(m.id) }]),
        { label: pinned ? 'Unpin from channel' : 'Pin to channel', icon: 'flag', onClick: async () => { const on = await Chat.pin(m.id); if (on !== undefined && on !== false) UI.toast('Pinned', 'success'); } },
        { label: Chat.isSaved(m.id) ? 'Remove from saved' : 'Save for later', icon: 'star', onClick: () => Chat.toggleSave(m.id) },
        { label: 'Copy link', icon: 'link', onClick: async () => { try { await navigator.clipboard.writeText(permalink(m)); UI.toast('Link copied', 'success'); } catch { UI.prompt('Message link', { value: permalink(m), okText: 'Close' }); } } },
        { label: 'Mark unread', icon: 'alert', onClick: () => { Chat.markUnreadFrom(m.id); Views.chat.holdRead?.(m.channel); UI.toast('Marked unread from here'); } },
        '-',
        { label: 'Create a task from this', icon: 'checkSquare', onClick: () => {
          const me = S.currentUser();
          const t = S.upsert('tasks', { title: plain(m.body).replace(/\s+/g, ' ').slice(0, 120), ownerId: me?.id || '', due: '', priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '', notes: `${plain(m.body)}\n\nFrom ${m.author_name} in ${titleOf(m.channel)}: ${permalink(m)}`, tags: [], followerIds: [], comments: [], createdBy: me?.id || '', projectId: '', sectionId: '' });
          TaskDrawer.open(t.id);
        } },
        { label: 'Remind me about this', icon: 'clock', onClick: () => remindDialog('', { channel: m.channel }, m) },
        ...(isMine(m) || Cloud.isAdmin ? ['-', { label: 'Delete message', icon: 'trash', danger: true, onClick: async () => { if (await UI.confirm(`Delete this message${Chat.repliesOf(m.id).length ? ' and its thread' : ''} for everyone?`, { okText: 'Delete' })) Chat.remove(m.id); } }] : []),
      ]);
    },
  };
  function startEdit(id) {
    editing = id;
    Views.chat.repaint?.(); ChatDock.repaint?.();
    setTimeout(() => { const ta = document.querySelector(`[data-msg-edit="${id}"] textarea`); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 20);
  }
  function editLast(channel, parentId = null) {
    const list = (parentId ? Chat.repliesOf(parentId) : Chat.messagesIn(channel)).filter(isMine);
    const last = list.slice(-1)[0];
    if (last) startEdit(last.id);
  }
  document.addEventListener('keydown', (e) => {
    const f = e.target.closest?.('[data-msg-edit]');
    if (!f) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); actions.msgEditCancel(); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); actions.msgEditSave({ id: f.dataset.msgEdit }); }
  }, true);

  // ---- Quick switcher (Ctrl+K) -------------------------------------------------------------
  function switcher() {
    const all = [
      { label: 'Threads', sub: 'Conversations you follow', ch: 'threads' }, { label: 'Mentions & reactions', sub: 'Activity', ch: 'activity' }, { label: 'Saved items', sub: 'Saved for later', ch: 'saved' },
      ...Chat.CHANNELS.map((c) => ({ label: `#${c.name}`, sub: c.hint, ch: c.id })),
      ...Chat.people().map((p) => ({ label: p.name, sub: Chat.isOnline(p.email) ? 'online' : p.email, ch: p.channel })),
    ];
    const m = UI.modal({ title: 'Jump to…', size: 'sm', body: '<input class="input" type="search" id="qsIn" placeholder="Channel or person" aria-label="Jump to a conversation"><div class="list qs-list" id="qsList" role="listbox"></div>', footer: '<span class="small muted">↑↓ to move · Enter to open</span>' });
    const input = m.el.querySelector('#qsIn');
    const listEl = m.el.querySelector('#qsList');
    let res = all;
    let i = 0;
    const paint = () => { listEl.innerHTML = res.slice(0, 12).map((r, k) => `<div class="list-item clickable ${k === i ? 'sel' : ''}" role="option" aria-selected="${k === i}" data-k="${k}"><div class="li-main"><b>${esc(r.label)}</b><small>${esc(r.sub || '')}</small></div></div>`).join('') || '<div class="empty-sm">Nothing matches</div>'; };
    const go = (r) => { if (!r) return; m.close(); location.hash = `#/chat/${encodeURIComponent(r.ch)}`; };
    input.addEventListener('input', () => { res = all.filter((r) => U.matches(input.value, r.label, r.sub)); i = 0; paint(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); i = Math.min(i + 1, Math.min(res.length, 12) - 1); paint(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(0, i - 1); paint(); }
      if (e.key === 'Enter') { e.preventDefault(); go(res[i]); }
    });
    listEl.addEventListener('click', (e) => { const r = e.target.closest('[data-k]'); if (r) go(res[Number(r.dataset.k)]); });
    paint();
    setTimeout(() => input.focus(), 0);
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !UI.hasModal()) { e.preventDefault(); switcher(); }
  });

  return {
    TYPES, EMOJI, isDm, titleOf, hintOf, bodyHtml, plain, logHtml, threadHtml, msgHtml, candidates, attachComposer, composerHtml, openRef, openThread,
    emojiPicker, setStatus, remindDialog, helpDialog, editLast, permalink, actions, drafts: {},
    get editing() { return editing; },
  };
})();
