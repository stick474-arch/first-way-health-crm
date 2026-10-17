/* First Way Health CRM — shell: routing, navigation, global search, shortcuts, theme, onboarding. */
const App = (() => {
  const S = Store;
  const esc = U.esc;
  const $ = (s) => document.querySelector(s);
  const view = $('#view');
  let viewActions = {};
  let current = { name: '', params: [] };

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'contacts', label: 'Contacts', icon: 'users' },
    { id: 'organizations', label: 'Organizations', icon: 'building' },
    { id: 'pipeline', label: 'Pipeline', icon: 'kanban' },
    { id: 'activities', label: 'Activity log', icon: 'activity' },
    { id: 'tasks', label: 'Tasks & follow-ups', icon: 'checkSquare' },
    { sep: 'Governance' },
    { id: 'board', label: 'Board of Directors', icon: 'landmark' },
    { sep: '' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ];

  // ---- Navigation ------------------------------------------------------------------------
  function renderNav() {
    const open = S.all('tasks').filter((t) => t.status !== 'done');
    const due = open.filter((t) => t.due && U.daysFromToday(t.due) <= 0).length;
    const boardOpen = open.filter((t) => t.kind === 'Board action').length;
    const counts = { tasks: due ? `<span class="nav-count hot" title="Overdue or due today">${due}</span>` : '', board: boardOpen ? `<span class="nav-count" title="Open board action items">${boardOpen}</span>` : '' };
    $('#nav').innerHTML = NAV.map((n) => (n.sep !== undefined
      ? `<div class="nav-sep">${esc(n.sep)}</div>`
      : `<a href="#/${n.id}" class="nav-item ${current.name === n.id ? 'active' : ''}" ${current.name === n.id ? 'aria-current="page"' : ''}>${UI.icon(n.icon)}<span>${esc(n.label)}</span>${counts[n.id] || ''}</a>`)).join('');
    $('#brandName').textContent = S.settings.companyName || 'First Way Health';

    renderFoot();
  }

  function renderFoot() {
    const last = S.meta().lastBackup;
    const st = Cloud.status;
    const cloud = S.mode === 'cloud';
    const stale = !cloud && S.recordCount() > 0 && (!last || U.daysFromToday(last.slice(0, 10)) < -7);
    const box = {
      local: [stale ? 'alert' : 'database', 'Saved in this browser', `Last backup: ${last ? U.relDays(last.slice(0, 10)) : 'never'}`, stale ? 'stale' : ''],
      demo: ['database', 'Demo mode', 'Sample data, only in this browser', ''],
      synced: ['check', 'Synced to the cloud', Cloud.user?.email || '', 'ok'],
      saving: ['clock', 'Saving…', Cloud.user?.email || '', ''],
      error: ['alert', cloud ? 'Sync error, retrying' : 'Cloud unavailable', st.detail, 'stale'],
    }[st.state] || ['database', 'Saved in this browser', '', ''];
    $('#sidebarFoot').innerHTML = `
      <div class="backup ${box[3]}" title="${esc(st.detail || '')}">
        ${UI.icon(box[0])}
        <div><strong>${esc(box[1])}</strong><span>${esc(box[2])}</span></div>
      </div>
      ${st.state === 'demo' ? `<button class="btn btn-sm btn-block btn-primary" data-act="exitDemo">Sign in to your workspace</button>` : ''}
      <button class="btn btn-sm btn-block" data-act="exportBackup">${UI.icon('download')} ${cloud ? 'Download backup' : 'Back up now'}</button>
      <div class="me">${S.currentUser() ? `${UI.avatar(S.currentUser().name, 'sm')}<span>${esc(S.currentUser().name)}</span>` : ''}</div>`;
  }

  function parseHash() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').filter(Boolean).map(decodeURIComponent);
    return { name: Views[parts[0]] ? parts[0] : 'dashboard', params: parts.slice(1) };
  }

  function render({ keepScroll = false } = {}) {
    const route = parseHash();
    const changed = route.name !== current.name || route.params.join('/') !== current.params.join('/');
    current = route;
    const v = Views[route.name];
    const y = window.scrollY;
    viewActions = v.actions || {};
    view.oninput = null;
    view.onchange = null;
    v.render(view, route.params);
    renderNav();
    document.body.classList.remove('sidebar-open');
    const label = NAV.find((n) => n.id === route.name)?.label || '';
    document.title = `${label} · ${S.settings.companyName || 'First Way Health'}`;
    if (changed && !keepScroll) window.scrollTo(0, 0); else window.scrollTo(0, y);
  }

  // Re-render after data changes — but never yank a text field away from someone typing in the page.
  let deferred = false;
  function rerender() {
    const a = document.activeElement;
    const typing = a && view.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(a.type)));
    if (typing) {
      if (!deferred) {
        deferred = true;
        a.addEventListener('blur', () => { deferred = false; setTimeout(() => render({ keepScroll: true }), 0); }, { once: true });
      }
      renderNav();
      return;
    }
    render({ keepScroll: true });
  }

  // ---- Global search ---------------------------------------------------------------------
  const searchInput = $('#globalSearch');
  const resultsEl = $('#searchResults');
  let results = [];
  let sel = 0;

  function search(q) {
    const out = [];
    const add = (group, items) => items.slice(0, 5).forEach((it) => out.push({ group, ...it }));
    add('Contacts', S.all('contacts').filter((c) => U.matches(q, S.contactName(c), c.email, c.title, S.orgName(c.orgId), c.type, (c.tags || []).map((t) => S.tag(t)?.name)))
      .map((c) => ({ href: `#/contacts/${c.id}`, title: S.contactName(c), sub: [c.type, S.orgName(c.orgId)].filter(Boolean).join(' · '), icon: 'users' })));
    add('Organizations', S.all('organizations').filter((o) => U.matches(q, o.name, o.industry, o.type, o.address))
      .map((o) => ({ href: `#/organizations/${o.id}`, title: o.name, sub: [o.type, o.industry].filter(Boolean).join(' · '), icon: 'building' })));
    add('Deals', S.all('deals').filter((d) => U.matches(q, d.name, S.orgName(d.orgId)))
      .map((d) => ({ href: '#/pipeline', act: () => Actions.editDeal({ id: d.id }), title: d.name, sub: `${S.stageInfo(d.stage).name} · ${U.money(d.value)}`, icon: 'kanban' })));
    add('Board meetings', S.all('meetings').filter((m) => U.matches(q, m.title, m.type, m.committee))
      .map((m) => ({ href: `#/board/meetings/${m.id}`, title: m.title, sub: U.fmtDateTime(m.date), icon: 'landmark' })));
    add('Resolutions', S.all('resolutions').filter((r) => U.matches(q, r.number, r.title))
      .map((r) => ({ href: '#/board/resolutions', title: `${r.number} · ${r.title}`, sub: r.status, icon: 'gavel' })));
    add('Tasks', S.all('tasks').filter((t) => t.status !== 'done' && U.matches(q, t.title))
      .map((t) => ({ act: () => Actions.editTask({ id: t.id }), title: t.title, sub: t.due ? `Due ${U.relDays(t.due)}` : 'No date', icon: 'checkSquare' })));
    return out;
  }

  function paintResults() {
    if (!results.length) {
      resultsEl.innerHTML = `<div class="sr-empty">No matches for “${esc(searchInput.value)}”</div>`;
      return;
    }
    let lastGroup = '';
    resultsEl.innerHTML = results.map((r, i) => {
      const head = r.group !== lastGroup ? `<div class="sr-group">${esc(r.group)}</div>` : '';
      lastGroup = r.group;
      return `${head}<button type="button" class="sr-item ${i === sel ? 'sel' : ''}" data-i="${i}">${UI.icon(r.icon)}<span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span></button>`;
    }).join('');
  }

  function openResult(i) {
    const r = results[i];
    if (!r) return;
    closeSearch();
    searchInput.value = '';
    if (r.href) location.hash = r.href;
    if (r.act) setTimeout(r.act, 50);
  }

  function closeSearch() { resultsEl.hidden = true; }

  searchInput.addEventListener('input', U.debounce(() => {
    const q = searchInput.value.trim();
    if (!q) { closeSearch(); return; }
    results = search(q);
    sel = 0;
    paintResults();
    resultsEl.hidden = false;
  }, 100));
  searchInput.addEventListener('keydown', (e) => {
    if (resultsEl.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); paintResults(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paintResults(); }
    if (e.key === 'Enter') { e.preventDefault(); openResult(sel); }
    if (e.key === 'Escape') { closeSearch(); searchInput.blur(); }
  });
  resultsEl.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { e.preventDefault(); openResult(Number(b.dataset.i)); }
  });
  searchInput.addEventListener('blur', () => setTimeout(closeSearch, 150));
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) { resultsEl.hidden = false; } });

  // ---- "+ New" menu ----------------------------------------------------------------------
  const NEW_ITEMS = [
    ['newContact', 'users', 'Contact', 'C'], ['newOrg', 'building', 'Organization', ''], ['newDeal', 'kanban', 'Deal', ''],
    ['logActivity', 'activity', 'Log interaction', 'L'], ['newTask', 'checkSquare', 'Task / follow-up', 'T'],
    ['newMeeting', 'landmark', 'Board meeting', ''], ['newResolution', 'gavel', 'Board resolution', ''],
  ];
  function toggleNewMenu(force) {
    const list = $('#newMenuList');
    const show = force !== undefined ? force : list.hidden;
    list.hidden = !show;
  }

  // ---- Theme -----------------------------------------------------------------------------
  function getTheme() {
    try { return localStorage.getItem('fwh-theme') || ''; } catch { return ''; }
  }
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    $('#themeBtn').innerHTML = UI.icon(dark ? 'sun' : 'moon');
    $('#themeBtn').title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
  function toggleTheme() {
    const t = getTheme();
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    try { localStorage.setItem('fwh-theme', next); } catch { /* ignore */ }
    applyTheme(next);
  }

  // ---- Backup ----------------------------------------------------------------------------
  function exportBackup() {
    U.download(`first-way-health-backup-${U.today()}.json`, S.exportJSON(), 'application/json');
    S.setMeta({ lastBackup: U.now() });
    renderNav();
    UI.toast('Backup downloaded. Keep it in a shared drive.', 'success');
  }

  // ---- Global click delegation -----------------------------------------------------------
  const globalActions = {
    openSidebar: () => document.body.classList.add('sidebar-open'),
    closeSidebar: () => document.body.classList.remove('sidebar-open'),
    toggleTheme,
    toggleNewMenu: () => toggleNewMenu(),
    exportBackup,
    exitDemo: () => Cloud.exitDemo(),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      if (!e.target.closest('#newMenu')) toggleNewMenu(false);
      return;
    }
    const a = e.target.closest('a[href]');
    if (a && a !== el && el.contains(a)) return; // real links inside clickable rows win
    const ctl = e.target.closest('select, input, textarea, label');
    if (ctl && ctl !== el && el.contains(ctl)) return; // form controls inside clickable cards
    const act = el.dataset.act;
    const fn = viewActions[act] || Actions[act] || globalActions[act];
    if (!fn) return;
    e.preventDefault();
    if (act !== 'toggleNewMenu') toggleNewMenu(false);
    fn({ ...el.dataset }, el, e);
  });

  // Keyboard: "/" search · "c" contact · "l" log interaction · "t" task · Esc closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      UI.closeMenu();
      toggleNewMenu(false);
      if (UI.closeTopModal()) return;
      document.body.classList.remove('sidebar-open');
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.ctrlKey || e.metaKey || e.altKey || UI.hasModal()) return;
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
    if (e.key === 'c') Actions.newContact({});
    if (e.key === 'l') Actions.logActivity({});
    if (e.key === 't') Actions.newTask({});
  });

  // ---- First run -------------------------------------------------------------------------
  function onboarding() {
    let done = false;
    const cloud = S.mode === 'cloud';
    const starts = [{ value: 'sample', label: 'Explore with sample data (you can erase it later in Settings)' }, { value: 'empty', label: 'Start with an empty workspace' }];
    if (cloud && Cloud.localSnapshot) starts.unshift({ value: 'upload', label: 'Upload the data already saved in this browser' });
    UI.formModal({
      title: 'Welcome to your CRM & Board workspace',
      size: 'md',
      submitText: 'Get started',
      intro: cloud
        ? 'This shared workspace is empty. Everything you add is saved to your team’s Supabase database and appears for teammates in real time.'
        : 'Track clients and leads, categorize every contact, and run your board of directors in one place. Your data is stored <b>in this browser</b>; use <b>Back up now</b> regularly.',
      values: { companyName: 'First Way Health', start: starts[0].value, yourName: Cloud.user?.email?.split('@')[0] || '' },
      fields: [
        { name: 'yourName', label: 'Your name', required: true, span: 2 },
        { name: 'companyName', label: 'Company', required: true, span: 2 },
        { name: 'start', label: 'How do you want to start?', type: 'select', span: 2, options: starts },
      ],
      onSubmit: (d) => {
        done = true;
        S.firstRun = false;
        if (d.start === 'upload') {
          S.importJSON(Cloud.localSnapshot);
          UI.toast('Browser data uploaded to the cloud workspace', 'success');
        } else if (d.start === 'sample') {
          const data = Sample.build(d.yourName);
          data.settings.companyName = d.companyName;
          data.users[0].email = Cloud.user?.email || '';
          S.replaceAll(data);
          S.setMe(data.users[0].id);
          UI.toast('Sample data loaded. Explore, then erase it in Settings when ready.', 'success', { duration: 6000 });
        } else {
          const u = S.upsert('users', { name: d.yourName, role: 'Founder', email: Cloud.user?.email || '' }, { silent: true });
          S.setMe(u.id);
          S.setSettings({ companyName: d.companyName, currentUserId: u.id });
          UI.toast('Workspace ready. Start by adding your first contact.', 'success');
        }
      },
      onClose: () => {
        if (done || !S.firstRun) return;
        S.firstRun = false;
        const u = S.upsert('users', { name: 'You', role: 'Founder', email: '' }, { silent: true });
        S.setSettings({ currentUserId: u.id });
      },
    });
  }

  // ---- Boot ------------------------------------------------------------------------------
  async function boot() {
    $('#menuBtn').innerHTML = UI.icon('menu');
    $('#searchIcon').innerHTML = UI.icon('search');
    $('#newBtn').innerHTML = `${UI.icon('plus')}<span>New</span>${UI.icon('chevronDown', 'ic-sm')}`;
    $('#newMenuList').innerHTML = NEW_ITEMS.map(([act, ic, label, key]) => `<button type="button" data-act="${act}">${UI.icon(ic)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`).join('');
    applyTheme(getTheme());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));
    document.body.classList.add('booting');
    await Cloud.init();
    document.body.classList.remove('booting');
    if (S.mode === 'cloud' && !S.firstRun && Cloud.user) {
      const email = (Cloud.user.email || '').toLowerCase();
      let me = S.all('users').find((u) => (u.email || '').toLowerCase() === email);
      if (!me) {
        me = S.upsert('users', { name: email.split('@')[0], email, role: '' }, { silent: true });
        UI.toast('You were added to the team list. Set your display name in Settings.', 'info', { duration: 7000 });
      }
      S.setMe(me.id);
    }
    Cloud.onStatus(() => renderFoot());
    S.onChange(rerender);
    window.addEventListener('hashchange', () => { UI.closeMenu(); render(); });
    render();
    if (S.firstRun) onboarding();
  }

  boot();
  return { rerender, render, exportBackup, onboarding };
})();
