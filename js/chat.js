/* Aetherium — team chat: channels, direct messages, realtime and "who's online".
   Cloud mode uses the crm_messages table (supabase/chat.sql) and Supabase Realtime.
   Local and demo modes keep messages in this browser. */
const Chat = (() => {
  const BUILTIN = [
    { id: 'general', name: 'general', hint: 'Everyone on the team' },
    { id: 'board', name: 'board', hint: 'Board of directors' },
  ];
  const channelsList = () => [
    ...BUILTIN,
    ...(Store.settings.channels || []).filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, hint: c.topic || 'Team channel', custom: true })),
  ];
  const NS = (window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm';
  const LS_MSGS = `${NS}-chat`;
  const LS_READ = `${NS}-chat-read`;

  let mode = 'local';
  let client = null;
  let me = { email: '', name: '' };
  let messages = []; // all visible messages, oldest first
  let online = {}; // email → { name }
  let error = '';
  let started = false;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());

  const lower = (s) => (s || '').toLowerCase();
  const dmId = (a, b) => { const [x, y] = [lower(a), lower(b)].sort(); return `dm:${x}|${y}`; };
  const dmOther = (ch) => ch.slice(3).split('|').find((e) => e !== me.email) || me.email;
  const readMap = () => { try { return JSON.parse(localStorage.getItem(LS_READ) || '{}'); } catch { return {}; } };

  function saveLocal() { try { localStorage.setItem(LS_MSGS, JSON.stringify(messages.slice(-1000))); } catch { /* full or blocked */ } }

  function add(m) {
    if (!m || messages.some((x) => x.id === m.id)) return;
    messages.push(m);
    messages.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    emit();
  }

  function seedDemo() {
    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    const msg = (channel, min, author_name, author_email, body) => ({ id: U.uid('msg'), channel, created_at: ago(min), author_name, author_email, body });
    messages = [
      msg('general', 300, 'Jordan Ellis', 'jordan@aetherium.com', 'Northside asked for the 2-year pricing again. I will send it before Friday.'),
      msg('general', 280, 'Taylor Brooks', 'taylor@aetherium.com', 'CareBridge signed the co-referral draft. Uploading it to their record now.'),
      msg('general', 45, 'Jordan Ellis', 'jordan@aetherium.com', 'Harborview site visit booked for Thursday 10am.'),
      msg('board', 1440, 'Dana Whitfield', 'dana.whitfield@example.com', 'Thanks for the Q3 pack. Can we spend 10 minutes on the hiring plan at the next meeting?'),
      msg('board', 1300, 'Priya Raman', 'priya.raman@example.com', 'Draft 2027 budget goes to the Audit & Finance Committee this week.'),
    ];
    saveLocal();
  }

  // ---- Lifecycle -------------------------------------------------------------------------
  async function start() {
    if (started) return;
    started = true;
    const u = Store.currentUser();
    me = { email: lower(Cloud.user?.email || u?.email || 'you@this-browser'), name: u?.name || Cloud.user?.email?.split('@')[0] || 'You' };
    mode = Store.mode === 'cloud' && Cloud.client ? 'cloud' : 'local';
    if (mode === 'local') {
      try { messages = JSON.parse(localStorage.getItem(LS_MSGS) || '[]'); } catch { messages = []; }
      if (!messages.length && Cloud.demo) seedDemo();
      emit();
      return;
    }
    client = Cloud.client;
    const { data, error: e } = await client.from('crm_messages').select('*').order('created_at', { ascending: false }).limit(500);
    if (e) {
      error = /crm_messages|schema cache|does not exist/i.test(e.message || '') ? 'The chat is not set up yet: an admin runs supabase/chat.sql in the Supabase SQL Editor (once).' : e.message;
      emit();
      return;
    }
    messages = (data || []).reverse();
    client.channel('crm-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages' }, (p) => add(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_messages' }, (p) => {
        messages = messages.filter((m) => m.id !== p.old?.id);
        emit();
      })
      .subscribe();
    const presence = client.channel('crm-presence', { config: { presence: { key: me.email } } });
    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      online = {};
      Object.keys(state).forEach((k) => { online[k] = state[k][0] || {}; });
      emit();
    });
    presence.subscribe(async (status) => { if (status === 'SUBSCRIBED') await presence.track({ name: me.name }); });
    emit();
  }

  // ---- Actions ---------------------------------------------------------------------------
  async function send(channel, text) {
    const body = (text || '').trim();
    if (!body) return false;
    if (body.length > 4000) { UI.toast('Messages can be up to 4,000 characters', 'error'); return false; }
    if (mode === 'local') {
      add({ id: U.uid('msg'), channel, body, author_email: me.email, author_name: me.name, created_at: new Date().toISOString() });
      saveLocal();
      return true;
    }
    const { data, error: e } = await client.from('crm_messages').insert({ channel, body, author_name: me.name }).select().single();
    if (e) { UI.toast(/crm_messages_channel_check/.test(e.message || '') ? 'Custom channels need a database upgrade: an admin runs supabase/upgrade-01.sql.' : `Message not sent: ${e.message}`, 'error', { duration: 8000 }); return false; }
    add(data);
    return true;
  }

  async function remove(id) {
    if (mode === 'local') { messages = messages.filter((m) => m.id !== id); saveLocal(); emit(); return; }
    const { error: e } = await client.from('crm_messages').delete().eq('id', id);
    if (e) { UI.toast(e.message, 'error'); return; }
    messages = messages.filter((m) => m.id !== id);
    emit();
  }

  function markRead(channel) {
    const map = readMap();
    const last = messages.filter((m) => m.channel === channel).slice(-1)[0];
    if (!last || map[channel] === last.created_at) return;
    map[channel] = last.created_at;
    try { localStorage.setItem(LS_READ, JSON.stringify(map)); } catch { /* ignore */ }
    emit();
  }

  function unread(channel) {
    const since = readMap()[channel] || '';
    return messages.filter((m) => m.channel === channel && m.created_at > since && lower(m.author_email) !== me.email).length;
  }

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

  return {
    get CHANNELS() { return channelsList(); },
    start, send, remove, markRead, unread, people, dmId,
    onChange: (fn) => listeners.push(fn),
    messagesIn: (channel) => messages.filter((m) => m.channel === channel),
    unreadTotal: () => [...channelsList().map((c) => c.id), ...people().map((p) => p.channel)].reduce((n, ch) => n + unread(ch), 0),
    isOnline: (email) => !!online[lower(email)],
    onlineCount: () => Object.keys(online).length,
    get me() { return me; },
    get mode() { return mode; },
    get error() { return error; },
  };
})();
