/* Aetherium CRM — optional Supabase backend: sign-in, team allowlist, record sync and realtime. */
const Cloud = (() => {
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
  const TABLE = 'crm_records';
  const cfg = window.FWH_CONFIG || {};
  const demo = !!cfg.demo; // demo/index.html: fictional data in this browser, never touches Supabase
  const configured = !demo && !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const esc = U.esc;

  let client = null;
  let user = null;
  let role = null; // 'admin' | 'member' | 'viewer' (from crm_members via the crm_role() function)
  const ROLES = [
    { id: 'admin', label: 'Admin', hint: 'Everything, plus team access and roles' },
    { id: 'member', label: 'Member', hint: 'Read and edit all data' },
    { id: 'viewer', label: 'Viewer', hint: 'Read-only' },
  ];
  let status = { state: 'local', detail: '' }; // local | demo | synced | saving | error
  const dirty = new Map(); // "coll:id" → { coll, id, deleted }
  const remoteIds = new Set();
  let flushing = false;
  let retryTimer = null;
  const statusListeners = [];

  const setStatus = (state, detail = '') => { status = { state, detail }; statusListeners.forEach((fn) => fn(status)); };
  const redirectUrl = () => location.origin + location.pathname;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the Supabase library (are you offline?)'));
      document.head.appendChild(s);
    });
  }

  // ---- Sync: local changes → Supabase ----------------------------------------------------
  function mark(coll, id, deleted) {
    dirty.set(`${coll}:${id}`, { coll, id, deleted });
    scheduleFlush();
  }

  let flushTimer = null;
  function scheduleFlush(ms = 400) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, ms);
  }

  async function flush() {
    if (!client || !user) return;
    if (role === 'viewer') { dirty.clear(); return; } // read-only: the database would reject it anyway
    if (flushing) { scheduleFlush(300); return; }
    if (!dirty.size) return;
    flushing = true;
    setStatus('saving');
    const batch = [...dirty.entries()];
    dirty.clear();
    const ups = [];
    const dels = [];
    for (const [, x] of batch) {
      if (x.deleted) { dels.push(x.id); continue; }
      const data = x.coll === 'settings' ? Store.settings : Store.get(x.coll, x.id);
      if (data) ups.push({ id: x.id, collection: x.coll, data, updated_by: user.id });
    }
    try {
      for (let i = 0; i < ups.length; i += 400) {
        const { error } = await client.from(TABLE).upsert(ups.slice(i, i + 400));
        if (error) throw error;
      }
      if (dels.length) {
        const { error } = await client.from(TABLE).delete().in('id', dels);
        if (error) throw error;
      }
      ups.forEach((r) => remoteIds.add(r.id));
      dels.forEach((id) => remoteIds.delete(id));
      setStatus(dirty.size ? 'saving' : 'synced');
    } catch (e) {
      console.error('Sync failed', e);
      batch.forEach(([k, x]) => { if (!dirty.has(k)) dirty.set(k, x); });
      setStatus('error', e.message || String(e));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(flush, 5000);
    } finally {
      flushing = false;
      if (dirty.size && status.state !== 'error') scheduleFlush(200);
    }
  }

  // Import / sample data / erase: push every record and delete the ones that no longer exist.
  function markAll() {
    const ids = new Set();
    Store.records().forEach((r) => { ids.add(r.id); dirty.set(`${r.collection}:${r.id}`, { coll: r.collection, id: r.id, deleted: false }); });
    remoteIds.forEach((id) => { if (!ids.has(id)) dirty.set(`?:${id}`, { coll: '?', id, deleted: true }); });
    scheduleFlush(50);
  }

  // ---- Sync: Supabase → local (initial load + realtime) ----------------------------------
  async function loadAll() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(TABLE).select('id, collection, data').order('id').range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    rows.forEach((r) => remoteIds.add(r.id));
    return rows;
  }

  function subscribe() {
    client.channel('crm-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (p) => {
        const row = p.eventType === 'DELETE' ? p.old : p.new;
        if (!row || !row.id) return;
        const coll = row.collection || [...Store.COLLECTIONS].find((c) => Store.get(c, row.id));
        if (!coll || dirty.has(`${coll}:${row.id}`)) return; // our pending edit wins
        if (p.eventType === 'DELETE') {
          remoteIds.delete(row.id);
          if (coll !== 'settings' && Store.get(coll, row.id)) Store.applyRemote(coll, row.id, null);
          return;
        }
        remoteIds.add(row.id);
        if (row.updated_by === user.id) return; // echo of our own write
        const local = coll === 'settings' ? Store.settings : Store.get(coll, row.id);
        if (local && JSON.stringify(local) === JSON.stringify(row.data)) return;
        Store.applyRemote(coll, row.id, row.data);
      })
      .subscribe();
  }

  // ---- Auth & allowlist ------------------------------------------------------------------
  async function fetchRole() {
    const { data, error } = await client.rpc('crm_role');
    if (error) {
      if (error.code === 'PGRST202' || error.code === 'PGRST205') throw new Error('The database is not set up yet: run supabase/schema.sql in the Supabase SQL Editor.');
      throw error;
    }
    return data || null;
  }

  function authScreen(message = '') {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'auth-screen';
      el.innerHTML = `
        <div class="auth-card card">
          <div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="authStar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a5a18"/><stop offset="0.35" stop-color="#ff9900"/><stop offset="0.55" stop-color="#ffc266"/><stop offset="1" stop-color="#7a4512"/></linearGradient><clipPath id="authStarC"><rect width="240" height="240" rx="54"/></clipPath></defs><rect width="240" height="240" rx="54" fill="#0e1b3d"/><g clip-path="url(#authStarC)"><path d="M120 120 L120 14 L106 106 Z M120 120 L226 120 L134 106 Z M120 120 L120 226 L106 134 Z M120 120 L14 120 L106 134 Z" fill="#22345a"/><path d="M120 120 L120 14 L134 106 Z M120 120 L226 120 L134 134 Z M120 120 L120 226 L134 134 Z M120 120 L14 120 L106 106 Z" fill="#16264d"/><path d="M24.9 173.7 A98 26 -14 0 1 215.1 126.3" fill="none" stroke="#4fb8c6" stroke-width="6" opacity="0.4"/><path d="M120 40 L188 206 L162 206 L120 98 L78 206 L52 206 Z" fill="url(#authStar)"/><circle cx="120" cy="40" r="14" fill="#0e1b3d"/><path d="M120 12 Q122.4 37.6 140 40 Q122.4 42.4 120 68 Q117.6 42.4 100 40 Q117.6 37.6 120 12 Z" fill="#ffffff"/><path d="M215.1 126.3 A98 26 -14 0 1 24.9 173.7" fill="none" stroke="#6ccad6" stroke-width="10" stroke-linecap="round"/><circle cx="40.8" cy="183.1" r="9" fill="#ff9900"/></g></svg></div>
            <div class="brand-text"><strong><span class="gold-a">A</span><span class="gold-rest">etherium</span></strong><span>CRM &amp; Board</span></div></div>
          <h1>Sign in</h1>
          <p class="muted">Use your work email. Only people on the team list can see the data.</p>
          <form class="form-grid" novalidate>
            <div class="field span-2"><label for="authEmail">Email</label><input id="authEmail" type="email" name="email" autocomplete="email" required></div>
            <div class="field span-2"><label for="authPass">Password</label><input id="authPass" type="password" name="password" autocomplete="current-password"></div>
            <div class="span-2 row wrap">
              <button class="btn btn-primary" type="submit">Sign in</button>
              <button class="btn" type="button" data-mode="magic">Email me a sign-in link</button>
            </div>
            <div class="span-2 small muted">First time? <a href="#" data-mode="signup">Create your account</a> with the email your admin added to the team list.</div>
            <div class="auth-msg span-2" role="status">${esc(message)}</div>
          </form>
          <hr>
          <a class="btn btn-ghost btn-block" href="demo/">Looking for the demo? Open it here (fictional data)</a>
        </div>`;
      document.body.appendChild(el);
      const form = el.querySelector('form');
      const msg = el.querySelector('.auth-msg');
      const say = (t, bad = false) => { msg.textContent = t; msg.classList.toggle('bad', bad); };
      const creds = () => ({ email: form.email.value.trim(), password: form.password.value });
      const finish = (v) => { el.remove(); resolve(v); };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { email, password } = creds();
        if (!email || !password) { say('Enter your email and password, or use the sign-in link.', true); return; }
        say('Signing in…');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) { say(error.message, true); return; }
        finish(data.user);
      });
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-mode]');
        if (!b) return;
        e.preventDefault();
        const { email, password } = creds();
        if (b.dataset.mode === 'magic') {
          if (!email) { say('Enter your email first.', true); return; }
          say('Sending…');
          const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } });
          say(error ? error.message : `Check ${email} for a sign-in link. You can close this tab after clicking it.`, !!error);
        } else if (b.dataset.mode === 'signup') {
          if (!email || password.length < 8) { say('Enter your email and a password of at least 8 characters, then click “Create your account”.', true); return; }
          say('Creating account…');
          const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
          if (error) { say(error.message, true); return; }
          if (data.session) finish(data.user);
          else say(`Almost done: confirm the email we sent to ${email}, then sign in.`);
        }
      });
      setTimeout(() => form.email.focus(), 30);
    });
  }

  function loadingScreen(text) {
    let el = document.querySelector('.auth-screen.loading');
    if (!text) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'auth-screen loading';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div class="auth-card card" style="text-align:center"><div class="spinner" aria-hidden="true"></div><p>${esc(text)}</p></div>`;
  }

  // ---- Boot ------------------------------------------------------------------------------
  // Resolves with 'local' | 'demo' | 'cloud' once data is ready to render.
  async function init() {
    if (demo) { setStatus('demo'); return 'demo'; }
    if (!configured) { setStatus('local'); return 'local'; }
    try {
      loadingScreen('Connecting…');
      await loadScript(SUPABASE_JS);
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data } = await client.auth.getSession();
      if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', `${location.pathname}#/dashboard`);
      user = data.session?.user || null;
      let note = '';
      for (;;) {
        if (!user) {
          loadingScreen('');
          user = await authScreen(note);
          loadingScreen('Loading your workspace…');
        }
        role = await fetchRole();
        if (role) break;
        note = `${user.email} does not have access yet (or the email is not confirmed). Ask an admin to add it in Settings → Team access, then sign in again.`;
        await client.auth.signOut();
        user = null;
      }
      loadingScreen('Loading your workspace…');
      const rows = await loadAll();
      Store.setMode('cloud');
      Store.loadRemote(rows);
      Store.setHooks({ record: (coll, id, rec) => mark(coll, id, !rec), bulk: markAll });
      subscribe();
      window.addEventListener('beforeunload', (e) => { if (dirty.size || flushing) { e.preventDefault(); e.returnValue = ''; } });
      window.addEventListener('online', () => scheduleFlush(100));
      setStatus('synced');
      loadingScreen('');
      return 'cloud';
    } catch (e) {
      console.error(e);
      loadingScreen('');
      setStatus('error', e.message || String(e));
      // Production never falls back to data saved in this browser: that is how demo data leaked in.
      return unavailableScreen(e.message || String(e));
    }
  }

  // Data an earlier version saved in this browser (before Supabase worked). Kept so it can be recovered.
  function browserData() {
    try {
      const d = JSON.parse(localStorage.getItem('fwh-crm-data-v1') || 'null');
      if (!d) return null;
      const count = ['contacts', 'organizations', 'deals', 'activities', 'tasks', 'meetings', 'resolutions', 'users']
        .reduce((n, c) => n + (Array.isArray(d[c]) ? d[c].length : 0), 0);
      return count ? { data: d, count, people: (d.users || []).map((u) => u.name).filter(Boolean) } : null;
    } catch { return null; }
  }
  function downloadBrowserData() {
    const b = browserData();
    if (!b) { UI.toast('Nothing is saved in this browser', 'info'); return; }
    U.download(`aetherium-browser-data-${U.today()}.json`, JSON.stringify({ app: 'first-way-health-crm', exportedAt: new Date().toISOString(), data: b.data }, null, 2), 'application/json');
    UI.toast('Downloaded. Once the cloud works, an admin restores it in Settings → Data.', 'success', { duration: 7000 });
  }

  function unavailableScreen(reason) {
    const saved = browserData();
    const el = document.createElement('div');
    el.className = 'auth-screen';
    el.innerHTML = `
      <div class="auth-card card">
        <div class="brand"><div class="brand-text"><strong><span class="gold-a">A</span><span class="gold-rest">etherium</span></strong><span>CRM &amp; Board</span></div></div>
        <h1>Can't open the team workspace</h1>
        <p class="muted">${esc(reason)}</p>
        <p class="muted small">Nothing was loaded from this browser, so no demo or old data is mixed in. Fix the issue and try again.</p>
        <div class="row wrap" style="margin-top:16px">
          <button class="btn btn-primary" type="button" data-u="retry">Try again</button>
          ${user ? '<button class="btn" type="button" data-u="signout">Sign out</button>' : ''}
        </div>
        ${saved ? `<div class="banner info" style="margin-top:16px">${UI.icon('database')}<div><b>This browser still has ${saved.count} records</b> saved by an earlier version${saved.people.length ? ` (team: ${esc(saved.people.join(', '))})` : ''}. Download them to restore into the team workspace later.
          <div style="margin-top:8px"><button class="btn btn-sm" type="button" data-u="download">${UI.icon('download')}Download browser data</button></div></div></div>` : ''}
        <hr>
        <a class="btn btn-ghost btn-block" href="demo/">Open the demo instead (fictional data)</a>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-u]');
      if (!b) return;
      if (b.dataset.u === 'download') { downloadBrowserData(); return; }
      if (b.dataset.u === 'signout' && client) await client.auth.signOut();
      location.reload();
    });
    return new Promise(() => {}); // stays here until the person retries
  }

  async function signOut() {
    if (dirty.size) await flush();
    if (client) await client.auth.signOut();
    location.reload();
  }

  // ---- Team access (allowlist) -----------------------------------------------------------
  async function listMembers() {
    const { data, error } = await client.from('crm_members').select('email, role, added_at').order('added_at');
    if (error) throw error;
    return data;
  }
  async function addMember(email, newRole = 'member') {
    const { error } = await client.from('crm_members').insert({ email: email.trim().toLowerCase(), role: newRole });
    if (error) throw new Error(error.code === '23505' ? `${email} already has access` : error.message);
  }
  async function setMemberRole(email, newRole) {
    const { error } = await client.from('crm_members').update({ role: newRole }).eq('email', email);
    if (error) throw error;
    if (email === (user?.email || '').toLowerCase()) role = newRole;
  }
  async function removeMember(email) {
    const { error } = await client.from('crm_members').delete().eq('email', email);
    if (error) throw error;
  }

  return {
    init, flush, signOut, listMembers, addMember, setMemberRole, removeMember, ROLES, browserData, downloadBrowserData,
    onStatus: (fn) => statusListeners.push(fn),
    get status() { return status; },
    get user() { return user; },
    get role() { return role; },
    // Local and demo modes: you own the data, so you are effectively an admin.
    get isAdmin() { return Store.mode !== 'cloud' || role === 'admin'; },
    get canWrite() { return Store.mode !== 'cloud' || role === 'admin' || role === 'member'; },
    get configured() { return configured; },
    get demo() { return demo; },
  };
})();
