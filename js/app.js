/* Aetherium CRM — shell: routing, navigation, global search, shortcuts, theme, onboarding. */
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
    { id: 'chat', label: 'Team chat', icon: 'message' },
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
    const chatUnread = Chat.unreadTotal();
    const counts = { chat: chatUnread ? `<span class="nav-count hot" title="Unread messages">${chatUnread}</span>` : '', tasks: due ? `<span class="nav-count hot" title="Overdue or due today">${due}</span>` : '', board: boardOpen ? `<span class="nav-count" title="Open board action items">${boardOpen}</span>` : '' };
    $('#nav').innerHTML = NAV.map((n) => (n.sep !== undefined
      ? `<div class="nav-sep">${esc(n.sep)}</div>`
      : `<a href="#/${n.id}" class="nav-item ${current.name === n.id ? 'active' : ''}" ${current.name === n.id ? 'aria-current="page"' : ''}>${UI.icon(n.icon)}<span>${esc(n.label)}</span>${counts[n.id] || ''}</a>`)).join('');
    const company = S.settings.companyName || 'Aetherium';
    $('#brandName').innerHTML = `<span class="gold-a">${esc(company.slice(0, 1))}</span><span class="gold-rest">${esc(company.slice(1))}</span>`;

    renderFoot();
  }

  function renderFoot() {
    const last = S.meta().lastBackup;
    const st = Cloud.status;
    const cloud = S.mode === 'cloud';
    const stale = !cloud && S.recordCount() > 0 && (!last || U.daysFromToday(last.slice(0, 10)) < -7);
    const box = {
      local: [stale ? 'alert' : 'database', 'Saved in this browser', `Last backup: ${last ? U.relDays(last.slice(0, 10)) : 'never'}`, stale ? 'stale' : ''],
      demo: ['database', 'Demo workspace', 'Fictional data, only in your browser', ''],
      synced: ['check', Cloud.canWrite ? 'Synced to the cloud' : 'View-only access', `${Cloud.user?.email || ''}${Cloud.role ? ` · ${Cloud.role}` : ''}`, 'ok'],
      saving: ['clock', 'Saving…', Cloud.user?.email || '', ''],
      error: ['alert', cloud ? 'Sync error, retrying' : 'Cloud unavailable', st.detail, 'stale'],
    }[st.state] || ['database', 'Saved in this browser', '', ''];
    $('#sidebarFoot').innerHTML = `
      <div class="backup ${box[3]}" title="${esc(st.detail || '')}">
        ${UI.icon(box[0])}
        <div><strong>${esc(box[1])}</strong><span>${esc(box[2])}</span></div>
      </div>
      ${st.state === 'demo'
        ? `<button class="btn btn-sm btn-block" data-act="resetDemo">${UI.icon('database')} Reset demo data</button>`
        : `<button class="btn btn-sm btn-block" data-act="exportBackup">${UI.icon('download')} ${cloud ? 'Download backup' : 'Back up now'}</button>`}
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
    lockViewForViewers();
    renderNav();
    document.body.classList.remove('sidebar-open');
    const label = NAV.find((n) => n.id === route.name)?.label || '';
    document.title = `${label} · ${S.settings.companyName || 'Aetherium'}`;
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
    U.download(`aetherium-backup-${U.today()}.json`, S.exportJSON(), 'application/json');
    S.setMeta({ lastBackup: U.now() });
    renderNav();
    UI.toast('Backup downloaded. Keep it in a shared drive.', 'success');
  }

  // ---- Roles: viewers get a read-only UI (the database enforces it too) -------------------
  const WRITE_ACTS = new Set(['logActivity', 'toggleTask', 'moveDeal', 'contactMore', 'setAtt', 'attAll', 'agAdd', 'agDelete', 'agMove',
    'minutesDraft', 'mtgStatus', 'startInaugural', 'removeSample', 'composeEmail', 'makeMain', 'saveLists', 'loadSample', 'eraseAll', 'removeMember']);
  const isWriteAction = (act) => /^(new|edit)/.test(act) || WRITE_ACTS.has(act);

  function lockViewForViewers() {
    if (Cloud.canWrite) return;
    view.querySelectorAll('#minutesText, [data-ag], [data-stage-for], [data-setting], [data-cadence], [data-list], #restoreFile')
      .forEach((el) => { el.disabled = true; });
    view.querySelectorAll('.kcard').forEach((c) => { c.draggable = false; });
  }

  // ---- Global click delegation -----------------------------------------------------------
  const globalActions = {
    openSidebar: () => document.body.classList.add('sidebar-open'),
    closeSidebar: () => document.body.classList.remove('sidebar-open'),
    toggleTheme,
    toggleNewMenu: () => toggleNewMenu(),
    exportBackup,
    resetDemo: async () => {
      if (!(await UI.confirm('Reset the demo to its original sample data? Your changes in this demo will be lost.', { okText: 'Reset demo', danger: false }))) return;
      loadDemoData();
      UI.toast('Demo data reset', 'success');
    },
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
    if (!Cloud.canWrite && isWriteAction(act)) { UI.toast('You have view-only access. Ask an admin if you need to edit.', 'info'); return; }
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
    if (!Cloud.canWrite) return;
    if (e.key === 'c') Actions.newContact({});
    if (e.key === 'l') Actions.logActivity({});
    if (e.key === 't') Actions.newTask({});
  });

  // ---- First run -------------------------------------------------------------------------
  function onboarding() {
    let done = false;
    const cloud = S.mode === 'cloud';
    const starts = [{ value: 'empty', label: 'Start with an empty workspace' }, { value: 'sample', label: 'Explore with sample data (you can erase it later in Settings)' }];
    const tagLabel = 'Add starter tags (Role: Decision maker, Champion… · Segment · Expertise). You can edit them in Settings.';
    UI.formModal({
      title: 'Welcome to your CRM & Board workspace',
      size: 'md',
      submitText: 'Get started',
      intro: cloud
        ? 'Your team workspace starts blank. Everything you add is saved to your Supabase database and appears for teammates in real time.'
        : 'Track clients and leads, categorize every contact, and run your board of directors in one place. Your data is stored <b>in this browser</b>; use <b>Back up now</b> regularly.',
      values: { companyName: 'Aetherium', start: starts[0].value, yourName: Cloud.user?.email?.split('@')[0] || '', starterTags: true },
      fields: [
        { name: 'yourName', label: 'Your name', required: true, span: 2 },
        { name: 'companyName', label: 'Company', required: true, span: 2 },
        ...(cloud
          ? [{ name: 'starterTags', type: 'checkbox', span: 2, checkLabel: tagLabel }]
          : [{ name: 'start', label: 'How do you want to start?', type: 'select', span: 2, options: starts },
            { name: 'starterTags', type: 'checkbox', span: 2, showWhen: 'start:empty', checkLabel: tagLabel }]),
      ],
      onSubmit: (d) => {
        done = true;
        S.firstRun = false;
        if (!cloud && d.start === 'sample') {
          const data = Sample.build(d.yourName);
          data.settings.companyName = d.companyName;
          data.users[0].email = Cloud.user?.email || '';
          S.replaceAll(data);
          S.setMe(data.users[0].id);
          UI.toast('Sample data loaded. Explore, then erase it in Settings when ready.', 'success', { duration: 6000 });
        } else {
          const u = S.upsert('users', { name: d.yourName, role: 'Founder', email: Cloud.user?.email || '' }, { silent: true });
          S.setMe(u.id);
          if (d.starterTags) {
            [['Role', 'Decision maker', 'red'], ['Role', 'Champion', 'violet'], ['Role', 'Influencer', 'blue'],
              ['Segment', 'Small practice', 'amber'], ['Segment', 'Health system', 'cyan'], ['Segment', 'Employer', 'orange'],
              ['Expertise', 'Finance', 'slate'], ['Expertise', 'Clinical', 'pink'], ['Expertise', 'Legal', 'green']]
              .forEach(([group, name, color]) => S.upsert('tags', { group, name, color }, { silent: true }));
          }
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

  function loadDemoData() {
    const data = Sample.build('Alex Rivera');
    S.replaceAll(data);
    S.setMe(data.users[0].id);
    S.firstRun = false;
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
    if (!Cloud.canWrite) document.body.classList.add('read-only');
    // Demo ⇄ Prod switch (same app, two links)
    $('#searchWrap').insertAdjacentHTML('afterend', `<nav class="env-switch" aria-label="Switch workspace">
      <a href="${Cloud.demo ? '#' : 'demo/'}" class="${Cloud.demo ? 'on' : ''}" ${Cloud.demo ? 'aria-current="page"' : ''} title="Fictional data, stays in your browser">Demo</a>
      <a href="${Cloud.demo ? '../' : '#'}" class="${Cloud.demo ? '' : 'on'}" ${Cloud.demo ? '' : 'aria-current="page"'} title="Team workspace (sign-in)">Prod</a></nav>`);
    if (Cloud.demo) {
      document.body.classList.add('demo');

      if (S.firstRun) {
        loadDemoData();
        UI.toast('Welcome to the demo. Everything here is fictional and stays in your browser.', 'info', { duration: 7000 });
      }
    }
    Cloud.onStatus(() => renderFoot());
    S.onChange(rerender);
    window.addEventListener('hashchange', () => { UI.closeMenu(); render(); });
    render();
    Chat.onChange(renderNav);
    Chat.start();
    if (S.firstRun && Cloud.canWrite) onboarding();
    else if (S.firstRun) UI.toast('This workspace is still empty. An admin needs to set it up.', 'info', { duration: 8000 });
  }

  boot();
  return { rerender, render, exportBackup, onboarding };
})();
