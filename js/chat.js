/* Aetherium — team chat engine (Slack-style): public and private channels, direct messages, threads,
   reactions, pins, polls, edits, saved items, mentions, typing indicators and desktop notifications.
   Cloud mode uses crm_messages + crm_message_marks (supabase/chat.sql, upgrade-02.sql) and Realtime.
   Local and demo modes keep everything in this browser. */
const Chat = (() => {
  const BUILTIN = [
    { id: 'general', name: 'general', hint: 'Everyone on the team' },
    { id: 'board', name: 'board', hint: 'Board of directors' },
  ];
  const NS = (window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm';
  const LS_MSGS = `${NS}-chat`;
  const LS_MARKS = `${NS}-chat-marks`;
  const LS_READ = `${NS}-chat-read`;
  const LS_PREFS = `${NS}-chat-prefs`;

  let mode = 'local';
  let client = null;
  let me = { email: '', name: '' };
  let messages = []; // oldest first, includes thread replies
  let marks = []; // { id, message_id, kind: reaction|pin|vote, value, user_email, user_name }
  let online = {}; // email → { name }
  let typing = {}; // channel → { email: { name, until } }
  let error = '';
  let upgraded = true; // false when supabase/upgrade-02.sql has not been run yet
  let started = false;
  let rt = null;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());

  const lower = (s) => (s || '').toLowerCase();
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
  const dmId = (a, b) => { const [x, y] = [lower(a), lower(b)].sort(); return `dm:${x}|${y}`; };
  const dmOther = (ch) => ch.slice(3).split('|').find((e) => e !== me.email) || me.email;
  const readMap = () => load(LS_READ, {}) || {};
  let prefs = { starred: [], muted: [], saved: [], dnd: false, notify: false, ...(load(LS_PREFS, {}) || {}) };
  const savePrefs = () => { store(LS_PREFS, prefs); emit(); };

  // ---- Channels ----------------------------------------------------------------------------
  const meta = (id) => (Store.settings.channelMeta || {})[id] || {};
  function channelsList() {
    const custom = (Store.settings.channels || []).filter((c) => !c.archived && (!c.private || (c.memberEmails || []).includes(me.email)));
    return [
      ...BUILTIN.map((c) => ({ ...c, hint: meta(c.id).topic || c.hint, bookmarks: meta(c.id).bookmarks || [] })),
      ...custom.map((c) => ({ id: c.id, name: c.name, hint: c.topic || (c.private ? 'Private channel' : 'Team channel'), custom: true, private: !!c.private, memberEmails: c.memberEmails || [], bookmarks: c.bookmarks || [], description: c.description || '' })),
    ];
  }
  const channelInfo = (id) => channelsList().find((c) => c.id === id) || null;

  function saveLocal() { if (mode === 'local') { store(LS_MSGS, messages.slice(-2000)); store(LS_MARKS, marks.slice(-5000)); } }

  function add(m) {
    if (!m || messages.some((x) => x.id === m.id)) return false;
    messages.push({ parent_id: null, meta: {}, edited_at: null, ...m });
    messages.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return true;
  }
  const addMark = (k) => { if (k && !marks.some((x) => x.id === k.id)) marks.push(k); };

  function seedDemo() {
    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    const id = () => U.uid('msg');
    const msg = (channel, min, author_name, author_email, body, extra = {}) => ({ id: id(), channel, created_at: ago(min), author_name, author_email, body, parent_id: null, meta: {}, edited_at: null, ...extra });
    const j = ['Jordan Ellis', 'jordan@aetherium.com'];
    const t = ['Taylor Brooks', 'taylor@aetherium.com'];
    const pricing = msg('general', 300, ...j, 'Northside asked for the *2-year pricing* again. I will send it before Friday.');
    const care = msg('general', 280, ...t, 'CareBridge signed the co-referral draft :tada: Uploading it to their record now.');
    const poll = msg('general', 120, ...t, '📊 Team lunch on Friday?', { meta: { poll: { question: 'Team lunch on Friday?', options: ['Yes, 12:30', 'Yes, 1:30', 'Can’t make it'] } } });
    messages = [
      pricing, care,
      msg('general', 270, ...j, 'Nice! Can you tag the deal so finance sees it?', { parent_id: care.id }),
      msg('general', 265, ...t, 'Done, linked to the CareBridge record.', { parent_id: care.id }),
      poll,
      msg('general', 45, ...j, 'Harborview site visit booked for Thursday 10am.\n> Bring the onboarding checklist\n- badge for 2 people\n- printed pricing'),
      msg('board', 1440, 'Dana Whitfield', 'dana.whitfield@example.com', 'Thanks for the Q3 pack. Can we spend 10 minutes on the hiring plan at the next meeting?'),
      msg('board', 1300, 'Priya Raman', 'priya.raman@example.com', 'Draft 2027 budget goes to the Audit & Finance Committee this week.'),
    ];
    const mk = (message_id, kind, value, who) => ({ id: U.uid('mk'), message_id, kind, value, user_email: who[1], user_name: who[0], created_at: ago(10) });
    marks = [
      mk(care.id, 'reaction', '🎉', j), mk(care.id, 'reaction', '🎉', t), mk(care.id, 'reaction', '🙌', j),
      mk(pricing.id, 'reaction', '👀', t), mk(care.id, 'pin', '', j),
      mk(poll.id, 'vote', '0', j), mk(poll.id, 'vote', '1', t),
    ];
    store(LS_MSGS, messages);
    store(LS_MARKS, marks);
  }

  // ---- Lifecycle -------------------------------------------------------------------------
  async function start() {
    if (started) return;
    started = true;
    const u = Store.currentUser();
    me = { email: lower(Cloud.user?.email || u?.email || 'you@this-browser'), name: u?.name || Cloud.user?.email?.split('@')[0] || 'You' };
    mode = Store.mode === 'cloud' && Cloud.client ? 'cloud' : 'local';
    if (mode === 'local') {
      messages = (load(LS_MSGS, []) || []).map((m) => ({ parent_id: null, meta: {}, edited_at: null, ...m }));
      marks = load(LS_MARKS, []) || [];
      if (!messages.length && Cloud.demo) seedDemo();
      emit();
      return;
    }
    client = Cloud.client;
    const { data, error: e } = await client.from('crm_messages').select('*').order('created_at', { ascending: false }).limit(1500);
    if (e) {
      error = /crm_messages|schema cache|does not exist/i.test(e.message || '') ? 'The chat is not set up yet: an admin runs supabase/chat.sql in the Supabase SQL Editor (once).' : e.message;
      emit();
      return;
    }
    messages = [];
    (data || []).reverse().forEach(add);
    const mk = await client.from('crm_message_marks').select('*').limit(10000);
    if (mk.error) upgraded = false; else marks = mk.data || [];
    if (data?.length && !('parent_id' in data[0])) upgraded = false;

    client.channel('crm-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages' }, (p) => { if (add(p.new)) { notifyIncoming(p.new); emit(); } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_messages' }, (p) => {
        const m = messages.find((x) => x.id === p.new?.id);
        if (m) { Object.assign(m, p.new); emit(); }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_messages' }, (p) => {
        const gone = p.old?.id;
        messages = messages.filter((m) => m.id !== gone && m.parent_id !== gone);
        emit();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_message_marks' }, (p) => { addMark(p.new); emit(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_message_marks' }, (p) => { marks = marks.filter((k) => k.id !== p.old?.id); emit(); })
      .subscribe();

    rt = client.channel('crm-presence', { config: { presence: { key: me.email }, broadcast: { self: false } } });
    rt.on('presence', { event: 'sync' }, () => {
      const state = rt.presenceState();
      online = {};
      Object.keys(state).forEach((k) => { online[k] = state[k][0] || {}; });
      emit();
    });
    rt.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload?.channel || payload.email === me.email || !canSee(payload.channel)) return;
      (typing[payload.channel] = typing[payload.channel] || {})[payload.email] = { name: payload.name, until: Date.now() + 4000 };
      emit();
      setTimeout(emit, 4200);
    });
    rt.subscribe(async (status) => { if (status === 'SUBSCRIBED') await rt.track({ name: me.name }); });
    emit();
  }
  const canSee = (ch) => ch.startsWith('dm:') ? ch.slice(3).split('|').includes(me.email) : !!channelInfo(ch);

  // ---- Notifications -----------------------------------------------------------------------
  function mentionsMe(m) {
    if (lower(m.author_email) === me.email) return false;
    if (/(^|\s)@(channel|here|everyone)\b/.test(m.body || '')) return true;
    const mine = Store.all('users').filter((u) => lower(u.email) === me.email).map((u) => u.id);
    return mine.some((id) => (m.body || '').includes(`[[user:${id}|`));
  }
  function notifyIncoming(m) {
    if (lower(m.author_email) === me.email || prefs.dnd || prefs.muted.includes(m.channel)) return;
    const isDm = m.channel.startsWith('dm:');
    const myThread = m.parent_id && messages.some((x) => (x.id === m.parent_id || x.parent_id === m.parent_id) && lower(x.author_email) === me.email);
    if (!(isDm || mentionsMe(m) || myThread)) return;
    if (prefs.notify && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        const n = new Notification(`${m.author_name || m.author_email}${isDm ? '' : ` in ${ChatUI.titleOf(m.channel)}`}`, { body: ChatUI.plain(m.body).slice(0, 180), tag: m.id });
        n.onclick = () => { window.focus(); location.hash = `#/chat/${encodeURIComponent(m.channel)}/${m.parent_id || m.id}`; };
      } catch { /* blocked */ }
    }
  }
  async function enableNotifications() {
    if (!('Notification' in window)) { UI.toast('This browser does not support notifications', 'error'); return; }
    const p = await Notification.requestPermission();
    prefs.notify = p === 'granted';
    savePrefs();
    UI.toast(prefs.notify ? 'Desktop notifications on for DMs, mentions and your threads' : 'Notifications are blocked in this browser', prefs.notify ? 'success' : 'error');
  }

  // ---- Messages ----------------------------------------------------------------------------
  const needUpgrade = () => { UI.toast('This needs a database upgrade: an admin runs supabase/upgrade-02.sql in Supabase.', 'error', { duration: 8000 }); return false; };

  async function send(channel, text, { parentId = null, extra = null } = {}) {
    const body = (text || '').trim();
    if (!body) return false;
    if (body.length > 4000) { UI.toast('Messages can be up to 4,000 characters', 'error'); return false; }
    if (mode === 'local') {
      const m = { id: U.uid('msg'), channel, body, author_email: me.email, author_name: me.name, created_at: new Date().toISOString(), parent_id: parentId, meta: extra || {}, edited_at: null };
      add(m);
      saveLocal();
      emit();
      return m;
    }
    if ((parentId || extra) && !upgraded) return needUpgrade();
    const row = { channel, body, author_name: me.name };
    if (parentId) row.parent_id = parentId;
    if (extra) row.meta = extra;
    const { data, error: e } = await client.from('crm_messages').insert(row).select().single();
    if (e) { UI.toast(/channel_check/.test(e.message || '') ? 'This channel needs a database upgrade: an admin runs supabase/upgrade-02.sql.' : `Message not sent: ${e.message}`, 'error', { duration: 8000 }); return false; }
    add(data);
    emit();
    return data;
  }

  async function edit(id, body) {
    const m = messages.find((x) => x.id === id);
    const text = (body || '').trim();
    if (!m || !text || text === m.body) return;
    if (mode === 'cloud') {
      if (!upgraded) return needUpgrade();
      const { error: e } = await client.from('crm_messages').update({ body: text, edited_at: new Date().toISOString() }).eq('id', id);
      if (e) { UI.toast(e.message, 'error'); return; }
    }
    Object.assign(m, { body: text, edited_at: new Date().toISOString() });
    saveLocal();
    emit();
  }

  async function remove(id) {
    if (mode === 'cloud') {
      const { error: e } = await client.from('crm_messages').delete().eq('id', id);
      if (e) { UI.toast(e.message, 'error'); return; }
    }
    messages = messages.filter((m) => m.id !== id && m.parent_id !== id);
    marks = marks.filter((k) => messages.some((m) => m.id === k.message_id));
    saveLocal();
    emit();
  }

  // Reactions, pins and votes share one table: toggle a mark
  async function toggleMark(messageId, kind, value = '') {
    const mine = marks.find((k) => k.message_id === messageId && k.kind === kind && k.value === value && (kind === 'pin' || k.user_email === me.email));
    if (mode === 'cloud' && !upgraded) return needUpgrade();
    if (mine) {
      if (mode === 'cloud') { const { error: e } = await client.from('crm_message_marks').delete().eq('id', mine.id); if (e) { UI.toast(e.message, 'error'); return false; } }
      marks = marks.filter((k) => k.id !== mine.id);
    } else {
      const rec = { message_id: messageId, kind, value, user_name: me.name };
      if (mode === 'cloud') {
        const { data, error: e } = await client.from('crm_message_marks').insert(rec).select().single();
        if (e) { UI.toast(e.message, 'error'); return false; }
        addMark(data);
      } else addMark({ ...rec, id: U.uid('mk'), user_email: me.email, created_at: new Date().toISOString() });
    }
    saveLocal();
    emit();
    return !mine;
  }
  const react = (id, emoji) => toggleMark(id, 'reaction', emoji);
  const pin = (id) => toggleMark(id, 'pin', '');
  async function vote(id, option) {
    const prev = marks.filter((k) => k.message_id === id && k.kind === 'vote' && k.user_email === me.email);
    const same = prev.some((k) => k.value === String(option));
    for (const k of prev) await toggleMark(id, 'vote', k.value);
    if (!same) await toggleMark(id, 'vote', String(option));
  }
  const marksOf = (id, kind) => marks.filter((k) => k.message_id === id && k.kind === kind);
  function reactionsOf(id) {
    const out = {};
    marksOf(id, 'reaction').forEach((k) => { (out[k.value] = out[k.value] || []).push(k); });
    return Object.entries(out).map(([emoji, list]) => ({ emoji, count: list.length, mine: list.some((k) => k.user_email === me.email), names: list.map((k) => k.user_name || k.user_email) }));
  }

  // ---- Reading -----------------------------------------------------------------------------
  const topLevel = (m) => !m.parent_id || m.meta?.broadcast;
  const messagesIn = (channel) => messages.filter((m) => m.channel === channel && topLevel(m));
  const repliesOf = (id) => messages.filter((m) => m.parent_id === id);
  const byId = (id) => messages.find((m) => m.id === id) || null;
  const pinnedIn = (channel) => messages.filter((m) => m.channel === channel && marksOf(m.id, 'pin').length);

  function threads() {
    const parents = messages.filter((m) => !m.parent_id && repliesOf(m.id).length && canSee(m.channel)
      && (lower(m.author_email) === me.email || repliesOf(m.id).some((r) => lower(r.author_email) === me.email) || mentionsMe(m)));
    return parents.map((p) => ({ parent: p, replies: repliesOf(p.id), last: repliesOf(p.id).slice(-1)[0].created_at })).sort((a, b) => (a.last < b.last ? 1 : -1));
  }
  function activity() {
    const items = [];
    messages.forEach((m) => { if (canSee(m.channel) && mentionsMe(m)) items.push({ kind: 'mention', at: m.created_at, m }); });
    marks.filter((k) => k.kind === 'reaction' && k.user_email !== me.email).forEach((k) => {
      const m = byId(k.message_id);
      if (m && lower(m.author_email) === me.email) items.push({ kind: 'reaction', at: k.created_at || m.created_at, m, who: k.user_name, emoji: k.value });
    });
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 100);
  }

  function search(q) {
    let text = q || '';
    let inCh = '';
    let from = '';
    text = text.replace(/\bin:#?([\w:-]+)/i, (_, c) => { inCh = c.toLowerCase(); return ''; });
    text = text.replace(/\bfrom:@?(\S+)/i, (_, f) => { from = f.toLowerCase(); return ''; });
    text = text.trim();
    return messages.filter((m) => canSee(m.channel)
      && (!inCh || m.channel === inCh || m.channel === `c:${inCh}` || m.channel === `p:${inCh}` || lower(ChatUI.titleOf(m.channel)).replace('#', '') === inCh)
      && (!from || lower(m.author_name).includes(from) || lower(m.author_email).includes(from))
      && (!text || U.matches(text, ChatUI.plain(m.body))))
      .slice(-80).reverse();
  }

  function markRead(channel) {
    const map = readMap();
    const last = messages.filter((m) => m.channel === channel && topLevel(m)).slice(-1)[0];
    if (!last || map[channel] === last.created_at) return;
    map[channel] = last.created_at;
    store(LS_READ, map);
    emit();
  }
  function markUnreadFrom(id) {
    const m = byId(id);
    if (!m) return;
    const map = readMap();
    map[m.channel] = new Date(new Date(m.created_at).getTime() - 1).toISOString();
    store(LS_READ, map);
    emit();
  }
  const lastRead = (channel) => readMap()[channel] || '';
  function unread(channel) {
    const since = lastRead(channel);
    return messages.filter((m) => m.channel === channel && topLevel(m) && m.created_at > since && lower(m.author_email) !== me.email).length;
  }
  function mentionCount(channel) {
    const since = lastRead(channel);
    return messages.filter((m) => m.channel === channel && m.created_at > since && (channel.startsWith('dm:') ? lower(m.author_email) !== me.email : mentionsMe(m))).length;
  }

  // ---- Typing ------------------------------------------------------------------------------
  let lastTyping = 0;
  function sendTyping(channel) {
    if (mode !== 'cloud' || !rt || Date.now() - lastTyping < 2500) return;
    lastTyping = Date.now();
    rt.send({ type: 'broadcast', event: 'typing', payload: { channel, email: me.email, name: me.name } });
  }
  const typingIn = (channel) => Object.values(typing[channel] || {}).filter((x) => x.until > Date.now()).map((x) => x.name);

  // People you can message directly: team members with an email, plus anyone who already wrote to you
  function people() {
    const map = {};
    Store.all('users').forEach((u) => { if (u.email && lower(u.email) !== me.email) map[lower(u.email)] = u.name; });
    messages.filter((m) => m.channel.startsWith('dm:')).forEach((m) => {
      const other = dmOther(m.channel);
      if (other !== me.email && !map[other]) map[other] = lower(m.author_email) === other ? m.author_name : other;
    });
    return Object.entries(map).map(([email, name]) => ({ email, name: name || email, channel: dmId(me.email, email) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const userByEmail = (email) => Store.all('users').find((u) => lower(u.email) === lower(email)) || null;
  function statusOf(email) {
    const s = userByEmail(email)?.status;
    if (!s || (!s.emoji && !s.text)) return null;
    if (s.until && s.until < U.now()) return null;
    return s;
  }

  // ---- Per-person preferences (this browser) ----------------------------------------------
  const toggleIn = (key, v) => { const set = new Set(prefs[key]); if (set.has(v)) set.delete(v); else set.add(v); prefs[key] = [...set]; savePrefs(); return set.has(v); };

  return {
    get CHANNELS() { return channelsList(); },
    channelInfo, start, send, edit, remove, react, pin, vote, marksOf, reactionsOf, markRead, markUnreadFrom, lastRead, unread, mentionCount, people, dmId,
    messagesIn, repliesOf, byId, pinnedIn, threads, activity, search, mentionsMe, sendTyping, typingIn, statusOf, userByEmail, enableNotifications,
    onChange: (fn) => listeners.push(fn),
    unreadTotal: () => [...channelsList().filter((c) => !prefs.muted.includes(c.id)).map((c) => c.id), ...people().map((p) => p.channel)].reduce((n, ch) => n + unread(ch), 0),
    isOnline: (email) => !!online[lower(email)],
    onlineCount: () => Object.keys(online).length,
    isStarred: (ch) => prefs.starred.includes(ch), toggleStar: (ch) => toggleIn('starred', ch),
    isMuted: (ch) => prefs.muted.includes(ch), toggleMute: (ch) => toggleIn('muted', ch),
    isSaved: (id) => prefs.saved.includes(id), toggleSave: (id) => toggleIn('saved', id),
    saved: () => prefs.saved.map(byId).filter(Boolean).reverse(),
    get dnd() { return prefs.dnd; }, setDnd: (v) => { prefs.dnd = !!v; savePrefs(); },
    get notifyOn() { return prefs.notify; },
    get me() { return me; },
    get mode() { return mode; },
    get error() { return error; },
    get upgraded() { return upgraded; },
  };
})();
