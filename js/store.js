/* Aetherium CRM — data model, persistence (browser localStorage) and derived queries. */
const Store = (() => {
  // The demo page keeps its own storage so demo data never mixes with the real workspace.
  const NS = (window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm';
  const KEY = `${NS}-data-v1`;
  const META_KEY = `${NS}-meta`;
  const ME_KEY = `${NS}-me`;

  // ---- Categorization system -------------------------------------------------------------
  // Every contact has ONE type; each type belongs to ONE group. Tags, priority tier, source
  // and owner add the extra dimensions. Cadence = default "keep in touch every N days".
  const GROUPS = [
    { id: 'Clients', label: 'Clients & leads' },
    { id: 'Network', label: 'Network' },
    { id: 'Governance', label: 'Board & advisors' },
    { id: 'Internal', label: 'Internal team' },
  ];
  const CONTACT_TYPES = [
    { id: 'Lead', group: 'Clients', color: 'sky', hint: 'Showed interest, not yet qualified' },
    { id: 'Prospect', group: 'Clients', color: 'blue', hint: 'Qualified, in active conversations' },
    { id: 'Client', group: 'Clients', color: 'green', hint: 'Signed / paying' },
    { id: 'Past Client', group: 'Clients', color: 'slate', hint: 'Former client, worth staying in touch' },
    { id: 'Partner', group: 'Network', color: 'violet', hint: 'Strategic or channel partner' },
    { id: 'Referral Source', group: 'Network', color: 'pink', hint: 'Sends you business' },
    { id: 'Vendor', group: 'Network', color: 'amber', hint: 'You buy from them' },
    { id: 'Investor', group: 'Network', color: 'orange', hint: 'Current or potential investor' },
    { id: 'Board Member', group: 'Governance', color: 'teal', hint: 'Director on the company board' },
    { id: 'Advisor', group: 'Governance', color: 'cyan', hint: 'Advisory board / non-voting' },
    { id: 'Team', group: 'Internal', color: 'slate', hint: 'Employee or contractor' },
  ];
  const ORG_TYPES = ['Lead', 'Prospect', 'Client', 'Past Client', 'Partner', 'Vendor', 'Investor', 'Other'];
  const ORG_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'];
  const PRIORITIES = [
    { id: 'A', label: 'A · Key', color: 'red' },
    { id: 'B', label: 'B · Standard', color: 'amber' },
    { id: 'C', label: 'C · Low', color: 'slate' },
  ];

  // ---- Pipeline --------------------------------------------------------------------------
  const STAGES = [
    { id: 'lead', name: 'New lead', prob: 10 },
    { id: 'qualified', name: 'Qualified', prob: 25 },
    { id: 'meeting', name: 'Discovery meeting', prob: 40 },
    { id: 'proposal', name: 'Proposal sent', prob: 60 },
    { id: 'negotiation', name: 'Negotiation', prob: 80 },
    { id: 'won', name: 'Won', prob: 100 },
    { id: 'lost', name: 'Lost', prob: 0 },
  ];
  const LOST_REASONS = ['Price', 'Timing / not now', 'Chose a competitor', 'No decision', 'Not a fit', 'Other'];

  // ---- Activities & tasks ----------------------------------------------------------------
  const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Video call', 'Message', 'Note'];
  const TASK_KINDS = ['Follow-up', 'Board action', 'To-do'];
  const TASK_PRIORITIES = ['High', 'Normal', 'Low'];

  // ---- Board -----------------------------------------------------------------------------
  const BOARD_ROLES = ['Chair', 'Vice Chair', 'Director', 'Independent Director', 'Secretary', 'Treasurer', 'Observer', 'Advisor'];
  const MEETING_TYPES = ['Regular', 'Special', 'Annual', 'Committee'];
  const MEETING_STATUS = ['Scheduled', 'Held', 'Minutes approved', 'Cancelled'];
  const AGENDA_KINDS = ['Information', 'Discussion', 'Decision'];
  const RESOLUTION_STATUS = ['Proposed', 'Approved', 'Rejected', 'Tabled', 'Withdrawn'];
  const RESOLUTION_METHODS = ['Meeting vote', 'Written consent'];
  const STANDARD_AGENDA = [
    { title: 'Call to order & quorum check', kind: 'Information', minutes: 5 },
    { title: 'Approval of previous meeting minutes', kind: 'Decision', minutes: 5 },
    { title: 'CEO update: clients, pipeline & operations', kind: 'Discussion', minutes: 20 },
    { title: 'Financial report & cash runway', kind: 'Discussion', minutes: 15 },
    { title: 'Review of open action items', kind: 'Information', minutes: 10 },
    { title: 'Items for decision', kind: 'Decision', minutes: 15 },
    { title: 'New business', kind: 'Discussion', minutes: 10 },
    { title: 'Adjournment', kind: 'Information', minutes: 0 },
  ];
  const TAG_COLORS = ['teal', 'blue', 'violet', 'amber', 'green', 'red', 'cyan', 'orange', 'pink', 'slate'];

  const PREFIX = {
    users: 'usr', tags: 'tag', organizations: 'org', contacts: 'con', deals: 'deal',
    activities: 'act', tasks: 'task', meetings: 'mtg', resolutions: 'res',
  };
  const COLLECTIONS = Object.keys(PREFIX);

  const defaults = () => ({
    version: 1,
    settings: {
      companyName: 'Aetherium',
      currentUserId: '',
      sources: ['Referral', 'Website', 'LinkedIn', 'Event / conference', 'Cold outreach', 'Partner', 'Board introduction', 'Other'],
      industries: ['Primary care clinic', 'Specialty practice', 'Hospital / health system', 'Employer (wellness benefits)',
        'Senior living', 'Home health', 'Payer / insurer', 'Pharmacy', 'Public sector', 'Other'],
      committees: ['Audit & Finance', 'Compensation', 'Governance & Nominating', 'Clinical Quality'],
      cadence: {
        Lead: 7, Prospect: 14, Client: 30, 'Past Client': 90, Partner: 45, 'Referral Source': 60,
        Vendor: 0, Investor: 60, 'Board Member': 30, Advisor: 45, Team: 0,
      },
    },
    users: [], tags: [], organizations: [], contacts: [], deals: [], activities: [], tasks: [], meetings: [], resolutions: [],
  });

  function migrate(d) {
    const base = defaults();
    const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
    out.settings.cadence = { ...base.settings.cadence, ...((d.settings || {}).cadence || {}) };
    COLLECTIONS.forEach((c) => { if (!Array.isArray(out[c])) out[c] = []; });
    if (out.settings.companyName === 'First Way Health') out.settings.companyName = 'Aetherium';
    out.version = 1;
    return out;
  }

  let firstRun = false;
  let db = (() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.error('Could not read saved data', e); }
    firstRun = true;
    return defaults();
  })();

  let cache = {};
  const listeners = [];

  // Sync hooks (set by js/cloud.js). 'local' mode persists to localStorage; 'cloud' mode leaves persistence to Supabase.
  let mode = 'local';
  let hooks = { record: null, bulk: null };
  const touch = (coll, rec) => { if (hooks.record && rec) hooks.record(coll, rec.id, rec); };

  function persist() {
    if (mode === 'cloud') return true;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error(e);
      if (window.UI) UI.toast('Could not save: browser storage is full or blocked. Export a backup now.', 'error');
      return false;
    }
  }

  function commit(silent = false) {
    cache = {};
    persist();
    if (!silent) listeners.forEach((fn) => fn());
  }

  // ---- CRUD ------------------------------------------------------------------------------
  const all = (c) => db[c];
  const get = (c, id) => (id ? db[c].find((x) => x.id === id) || null : null);

  function upsert(c, obj, opts = {}) {
    const ts = U.now();
    const cur = obj.id ? get(c, obj.id) : null;
    if (cur) {
      Object.assign(cur, obj, { updatedAt: ts });
      touch(c, cur);
      commit(opts.silent);
      return cur;
    }
    const rec = { ...obj, id: obj.id || U.uid(PREFIX[c]), createdAt: ts, updatedAt: ts };
    db[c].push(rec);
    touch(c, rec);
    commit(opts.silent);
    return rec;
  }

  function update(c, id, patch, opts = {}) {
    const cur = get(c, id);
    if (!cur) return null;
    Object.assign(cur, patch, { updatedAt: U.now() });
    touch(c, cur);
    commit(opts.silent);
    return cur;
  }

  function remove(c, id) {
    db[c] = db[c].filter((x) => x.id !== id);
    if (hooks.record) hooks.record(c, id, null);
    // Unlink references in other records (each changed record is synced too)
    const clear = (coll, field) => db[coll].forEach((x) => { if (x[field] === id) { x[field] = ''; touch(coll, x); } });
    const strip = (coll, field) => db[coll].forEach((x) => {
      if ((x[field] || []).includes(id)) { x[field] = x[field].filter((v) => v !== id); touch(coll, x); }
    });
    if (c === 'contacts') {
      strip('activities', 'contactIds');
      clear('tasks', 'contactId'); clear('tasks', 'ownerId'); clear('deals', 'contactId');
      db.meetings.forEach((m) => { if (m.attendance && id in m.attendance) { delete m.attendance[id]; touch('meetings', m); } });
    }
    if (c === 'organizations') ['contacts', 'deals', 'activities', 'tasks'].forEach((x) => clear(x, 'orgId'));
    if (c === 'deals') ['activities', 'tasks'].forEach((x) => clear(x, 'dealId'));
    if (c === 'meetings') ['activities', 'tasks', 'resolutions'].forEach((x) => clear(x, 'meetingId'));
    if (c === 'users') {
      ['organizations', 'contacts', 'deals', 'activities', 'tasks'].forEach((x) => clear(x, 'ownerId'));
      if (db.settings.currentUserId === id) setSettings({ currentUserId: db.users[0]?.id || '' }, { silent: true });
    }
    if (c === 'tags') ['contacts', 'organizations'].forEach((x) => strip(x, 'tags'));
    commit();
  }

  function setSettings(patch, opts = {}) {
    Object.assign(db.settings, patch);
    if (hooks.record) hooks.record('settings', 'workspace', db.settings);
    commit(opts.silent);
  }

  // ---- Lookups ---------------------------------------------------------------------------
  const typeInfo = (id) => CONTACT_TYPES.find((t) => t.id === id) || { id: id || 'Unknown', group: 'Network', color: 'slate' };
  const stageInfo = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
  const priorityInfo = (id) => PRIORITIES.find((p) => p.id === id) || null;
  const groupOf = (type) => typeInfo(type).group;
  const contactName = (c) => (c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Unnamed contact' : '');
  const orgName = (id) => get('organizations', id)?.name || '';
  // "Who am I" is remembered per browser (teammates share settings in cloud mode).
  const myId = () => { try { return localStorage.getItem(ME_KEY) || ''; } catch { return ''; } };
  const setMe = (id) => { try { localStorage.setItem(ME_KEY, id); } catch { /* ignore */ } };
  const currentUser = () => get('users', myId()) || get('users', db.settings.currentUserId) || db.users[0] || null;

  // Owners can be team members (users) or board members (contacts) — ids are prefixed so one lookup works.
  function nameOf(id) {
    if (!id) return '';
    const u = get('users', id);
    if (u) return u.name;
    const c = get('contacts', id);
    return c ? contactName(c) : '';
  }

  // ---- Relationship health (cadence vs. last real interaction) ----------------------------
  function lastContactMap() {
    if (cache.last) return cache.last;
    const m = {};
    for (const a of db.activities) {
      if (a.type === 'Note' || !a.date || a.date.slice(0, 10) > U.today()) continue;
      for (const cid of a.contactIds || []) if (!m[cid] || a.date > m[cid]) m[cid] = a.date;
    }
    cache.last = m;
    return m;
  }

  const cadenceFor = (c) => (c.cadenceDays === 0 || c.cadenceDays ? Number(c.cadenceDays) : Number(db.settings.cadence[c.type] || 0));

  function health(c) {
    const cad = cadenceFor(c);
    const last = lastContactMap()[c.id] || '';
    if (!cad) return { status: 'none', last, cad, label: last ? `Last contact ${U.relDays(last)}` : 'No cadence set' };
    const ref = last || (c.createdAt || U.today()).slice(0, 10);
    const left = cad + U.daysFromToday(ref);
    if (left < 0) return { status: 'overdue', last, cad, left, label: last ? `${-left}d overdue` : 'Never contacted' };
    if (left <= Math.max(2, Math.round(cad * 0.2))) return { status: 'soon', last, cad, left, label: left === 0 ? 'Due today' : `Due in ${left}d` };
    return { status: 'ok', last, cad, left, label: `On track (${left}d left)` };
  }

  function openTasksFor(field, id) {
    return U.sortBy(db.tasks.filter((t) => t.status !== 'done' && t[field] === id), (t) => t.due || '9999');
  }

  const nextTaskFor = (contactId) => openTasksFor('contactId', contactId)[0] || null;

  function activitiesFor(field, id) {
    const list = field === 'contactId'
      ? db.activities.filter((a) => (a.contactIds || []).includes(id))
      : db.activities.filter((a) => a[field] === id);
    return U.sortBy(list, 'date', -1);
  }

  // ---- Deals & lifecycle automation ------------------------------------------------------
  const isOpenDeal = (d) => d.stage !== 'won' && d.stage !== 'lost';
  const dealProb = (d) => stageInfo(d.stage).prob;

  // When a deal moves, contact/org categories follow automatically (Lead → Prospect → Client).
  function applyLifecycle(d) {
    const msgs = [];
    const c = get('contacts', d.contactId);
    const o = get('organizations', d.orgId);
    if (d.stage === 'won') {
      if (c && ['Lead', 'Prospect', 'Past Client'].includes(c.type)) { c.type = 'Client'; touch('contacts', c); msgs.push(`${contactName(c)} → Client`); }
      if (o && ['Lead', 'Prospect', 'Past Client', 'Other', '', undefined].includes(o.type)) { o.type = 'Client'; touch('organizations', o); msgs.push(`${o.name} → Client`); }
    } else if (d.stage !== 'lost' && d.stage !== 'lead') {
      if (c && c.type === 'Lead') { c.type = 'Prospect'; touch('contacts', c); msgs.push(`${contactName(c)} → Prospect`); }
      if (o && (o.type === 'Lead' || !o.type)) { o.type = 'Prospect'; touch('organizations', o); msgs.push(`${o.name} → Prospect`); }
    }
    return msgs;
  }

  function saveDeal(data) {
    const prev = data.id ? get('deals', data.id) : null;
    const stageChanged = !prev || prev.stage !== data.stage;
    const patch = { ...data };
    if (stageChanged) {
      patch.stageChangedAt = U.now();
      patch.closedAt = data.stage === 'won' || data.stage === 'lost' ? U.today() : '';
    }
    if (data.stage !== 'lost') patch.lostReason = '';
    const rec = upsert('deals', patch, { silent: true });
    const msgs = stageChanged ? applyLifecycle(rec) : [];
    commit();
    return { deal: rec, msgs };
  }

  function setDealStage(id, stage, extra = {}) {
    const d = get('deals', id);
    if (!d) return { msgs: [] };
    return saveDeal({ ...d, ...extra, stage });
  }

  // ---- Board -----------------------------------------------------------------------------
  const isBoardType = (type) => type === 'Board Member' || type === 'Advisor';
  const termEnded = (c) => !!(c.board?.termEnd && U.daysFromToday(c.board.termEnd) < 0);
  const isVoting = (c) => c.type === 'Board Member' && c.board?.voting !== false && !termEnded(c);

  function boardMembers({ includeAdvisors = true, includeFormer = false } = {}) {
    const order = (c) => {
      const i = BOARD_ROLES.indexOf(c.board?.role);
      return `${c.type === 'Advisor' ? 1 : 0}${String(i < 0 ? 9 : i)}${contactName(c)}`;
    };
    return U.sortBy(db.contacts.filter((c) => isBoardType(c.type)
      && (includeAdvisors || c.type === 'Board Member')
      && (includeFormer || !termEnded(c))), order);
  }

  function quorum(m) {
    const voting = boardMembers({ includeAdvisors: false }).filter(isVoting);
    const present = voting.filter((c) => m.attendance?.[c.id] === 'present').length;
    const needed = Math.floor(voting.length / 2) + 1;
    return { present, total: voting.length, needed, met: voting.length > 0 && present >= needed };
  }

  function attendanceRate(contactId) {
    const held = db.meetings.filter((m) => (m.status === 'Held' || m.status === 'Minutes approved') && m.attendance?.[contactId]);
    if (!held.length) return null;
    const present = held.filter((m) => m.attendance[contactId] === 'present').length;
    return { present, total: held.length, pct: Math.round((present / held.length) * 100) };
  }

  function nextResolutionNumber(dateStr) {
    const y = (dateStr || U.today()).slice(0, 4);
    const max = db.resolutions.reduce((n, r) => {
      const m = /^R-(\d{4})-(\d+)$/.exec(r.number || '');
      return m && m[1] === y ? Math.max(n, Number(m[2])) : n;
    }, 0);
    return `R-${y}-${String(max + 1).padStart(3, '0')}`;
  }

  const upcomingMeetings = () => U.sortBy(db.meetings.filter((m) => m.status === 'Scheduled' && (m.date || '').slice(0, 10) >= U.today()), 'date');
  const pastMeetings = () => U.sortBy(db.meetings.filter((m) => !upcomingMeetings().includes(m)), 'date', -1);

  // ---- Tags ------------------------------------------------------------------------------
  const tag = (id) => get('tags', id);
  const tagsSorted = () => U.sortBy(db.tags, (t) => `${t.group || 'zz'}|${t.name}`.toLowerCase());

  // ---- Import / export -------------------------------------------------------------------
  function meta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
  }
  function setMeta(patch) {
    try { localStorage.setItem(META_KEY, JSON.stringify({ ...meta(), ...patch })); } catch { /* ignore */ }
  }

  const exportJSON = () => JSON.stringify({ app: 'first-way-health-crm', exportedAt: new Date().toISOString(), data: db }, null, 2);

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const d = parsed && parsed.data ? parsed.data : parsed;
    if (!d || !Array.isArray(d.contacts) || !d.settings) throw new Error('This file is not a Aetherium backup.');
    replaceAll(d);
  }

  function replaceAll(d) {
    db = migrate(d);
    if (hooks.bulk) hooks.bulk();
    commit();
  }
  function reset() { replaceAll(defaults()); }

  const recordCount = () => COLLECTIONS.filter((c) => c !== 'users' && c !== 'tags').reduce((n, c) => n + db[c].length, 0);

  // ---- Cloud sync support ----------------------------------------------------------------
  function records() {
    const out = [{ collection: 'settings', id: 'workspace', data: db.settings }];
    COLLECTIONS.forEach((c) => db[c].forEach((r) => out.push({ collection: c, id: r.id, data: r })));
    return out;
  }

  // Replace everything with rows loaded from the server (no hooks: nothing to push back).
  function loadRemote(rows) {
    const d = defaults();
    for (const r of rows) {
      if (r.collection === 'settings') d.settings = { ...d.settings, ...r.data };
      else if (Array.isArray(d[r.collection])) d[r.collection].push(r.data);
    }
    db = migrate(d);
    cache = {};
    firstRun = rows.length === 0;
  }

  // Apply one change that arrived from another user (realtime). Mutates in place so open views keep valid references.
  function applyRemote(coll, id, data) {
    if (coll === 'settings') {
      Object.assign(db.settings, data || {});
    } else if (Array.isArray(db[coll])) {
      const cur = db[coll].find((x) => x.id === id);
      if (data && cur) { Object.keys(cur).forEach((k) => delete cur[k]); Object.assign(cur, data); }
      else if (data) db[coll].push(data);
      else if (cur) db[coll] = db[coll].filter((x) => x.id !== id);
    }
    cache = {};
    listeners.forEach((fn) => fn({ remote: true }));
  }

  const setHooks = (h) => { hooks = { ...hooks, ...h }; };
  const setMode = (m) => { mode = m; };

  return {
    GROUPS, CONTACT_TYPES, ORG_TYPES, ORG_SIZES, PRIORITIES, STAGES, LOST_REASONS, ACTIVITY_TYPES, TASK_KINDS,
    TASK_PRIORITIES, BOARD_ROLES, MEETING_TYPES, MEETING_STATUS, AGENDA_KINDS, RESOLUTION_STATUS, RESOLUTION_METHODS,
    STANDARD_AGENDA, TAG_COLORS, COLLECTIONS, PREFIX,
    get settings() { return db.settings; },
    get firstRun() { return firstRun; },
    set firstRun(v) { firstRun = v; },
    onChange: (fn) => listeners.push(fn),
    all, get, upsert, update, remove, setSettings, defaults,
    typeInfo, stageInfo, priorityInfo, groupOf, contactName, orgName, currentUser, setMe, nameOf,
    lastContactMap, cadenceFor, health, openTasksFor, nextTaskFor, activitiesFor,
    isOpenDeal, dealProb, saveDeal, setDealStage,
    isBoardType, termEnded, isVoting, boardMembers, quorum, attendanceRate, nextResolutionNumber, upcomingMeetings, pastMeetings,
    tag, tagsSorted, meta, setMeta, exportJSON, importJSON, replaceAll, reset, recordCount,
    records, loadRemote, applyRemote, setHooks, setMode, get mode() { return mode; },
  };
})();
