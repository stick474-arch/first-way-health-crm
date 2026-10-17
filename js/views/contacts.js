/* Contacts — categorized list (group → type → tier → tags) and the contact profile. */
Views.contacts = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { group: 'all', q: '', type: '', priority: '', owner: '', tag: '', attention: false, sort: 'name', dir: 1 };

  const SORTS = {
    name: (c) => S.contactName(c).toLowerCase(),
    org: (c) => S.orgName(c.orgId).toLowerCase(),
    type: (c) => S.CONTACT_TYPES.findIndex((t) => t.id === c.type),
    priority: (c) => c.priority || 'Z',
    last: (c) => S.lastContactMap()[c.id] || '',
    next: (c) => S.nextTaskFor(c.id)?.due || '',
  };

  function filtered() {
    return S.all('contacts').filter((c) => (state.group === 'all' || S.groupOf(c.type) === state.group)
      && (!state.type || c.type === state.type)
      && (!state.priority || c.priority === state.priority)
      && (!state.owner || c.ownerId === state.owner)
      && (!state.tag || (c.tags || []).includes(state.tag))
      && (!state.attention || S.health(c).status === 'overdue')
      && U.matches(state.q, S.contactName(c), c.email, c.title, c.phone, S.orgName(c.orgId), c.type, (c.tags || []).map((t) => S.tag(t)?.name)));
  }

  function renderList(root) {
    const list = U.sortBy(filtered(), SORTS[state.sort], state.dir);
    root.querySelector('#ccount').textContent = U.plural(list.length, 'result');
    const box = root.querySelector('#clist');
    if (!S.all('contacts').length) {
      box.innerHTML = UI.empty('users', 'No contacts yet', 'Add clients, leads, partners and board members. Each one gets a type, a priority tier and tags so you can always find the right people.',
        '<button class="btn btn-primary" data-act="newContact">Add your first contact</button>');
      return;
    }
    if (!list.length) { box.innerHTML = UI.empty('search', 'No contacts match these filters', '<a href="#" data-act="clearFilters">Clear filters</a>'); return; }
    const th = (key, label, cls = '') => `<th class="sortable ${cls}" data-act="sort" data-sort="${key}" aria-sort="${state.sort === key ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${state.sort === key ? UI.icon(state.dir > 0 ? 'chevronUp' : 'chevronDown') : ''}</th>`;
    box.innerHTML = `<table class="table">
      <thead><tr>${th('name', 'Name')}${th('org', 'Organization', 'hide-sm')}${th('type', 'Type')}${th('priority', 'Tier')}<th class="hide-md">Tags</th>${th('last', 'Last contact')}${th('next', 'Next step', 'hide-md')}<th class="hide-md">Owner</th></tr></thead>
      <tbody>${list.map((c) => {
        const next = S.nextTaskFor(c.id);
        return `<tr class="clickable" data-act="go" data-href="#/contacts/${c.id}">
          <td><div class="cell-main">${UI.avatar(S.contactName(c))}<div><b>${esc(S.contactName(c))}</b><small>${esc(c.title || c.email || '')}</small></div></div></td>
          <td class="hide-sm">${c.orgId ? Parts.orgLink(c.orgId) : '<span class="muted">—</span>'}</td>
          <td>${UI.typeBadge(c.type)}${c.board?.role && S.isBoardType(c.type) ? `<div class="small muted">${esc(c.board.role)}</div>` : ''}</td>
          <td>${UI.priorityBadge(c.priority)}</td>
          <td class="hide-md"><div class="tags">${UI.tagChips(c.tags)}</div></td>
          <td>${Parts.healthCell(c)}</td>
          <td class="hide-md">${next ? `<div class="small"><b>${esc(next.title)}</b></div>${UI.dueLabel(next.due)}` : '<span class="muted small">No next step</span>'}</td>
          <td class="hide-md">${c.ownerId ? `<span title="${esc(S.nameOf(c.ownerId))}">${UI.avatar(S.nameOf(c.ownerId), 'sm')}</span>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function list(root) {
    const all = S.all('contacts');
    const count = (g) => all.filter((c) => g === 'all' || S.groupOf(c.type) === g).length;
    const attention = all.filter((c) => S.health(c).status === 'overdue').length;
    const types = S.CONTACT_TYPES.filter((t) => state.group === 'all' || t.group === state.group);
    if (state.type && !types.some((t) => t.id === state.type)) state.type = '';
    root.innerHTML = `
      ${Parts.pageHead('Contacts', `${U.plural(all.length, 'person', 'people')} · every contact has one type, a priority tier and optional tags`,
        `<button class="btn" data-act="exportContacts">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
         <button class="btn btn-primary" data-act="newContact">${UI.icon('plus')}New contact</button>`)}
      <div class="segmented" role="tablist" aria-label="Contact group">
        <button class="seg ${state.group === 'all' ? 'active' : ''}" data-act="setGroup" data-g="all" role="tab">All <span class="count">${count('all')}</span></button>
        ${S.GROUPS.map((g) => `<button class="seg ${state.group === g.id ? 'active' : ''}" data-act="setGroup" data-g="${g.id}" role="tab">${esc(g.label)} <span class="count">${count(g.id)}</span></button>`).join('')}
      </div>
      <div class="filters">
        <input class="input" type="search" id="cq" placeholder="Filter by name, company, email, tag…" value="${esc(state.q)}" aria-label="Filter contacts">
        <select class="select" data-filter="type" aria-label="Type">${UI.selectOptions(types.map((t) => t.id), state.type, 'All types')}</select>
        <select class="select" data-filter="priority" aria-label="Tier">${UI.selectOptions(S.PRIORITIES.map((p) => ({ value: p.id, label: p.label })), state.priority, 'All tiers')}</select>
        <select class="select" data-filter="tag" aria-label="Tag">${UI.selectOptions(UI.opts.tags(), state.tag, 'All tags')}</select>
        <select class="select" data-filter="owner" aria-label="Owner">${UI.selectOptions(UI.opts.users(), state.owner, 'All owners')}</select>
        <button class="chip-toggle ${state.attention ? 'on' : ''}" data-act="toggleAttention" title="Contacts past their keep-in-touch cadence">${UI.icon('alert', 'ic-sm')} Needs attention <b>${attention}</b></button>
        <span class="result-count" id="ccount"></span>
      </div>
      <div class="card"><div class="table-wrap" id="clist"></div></div>`;
    renderList(root);
    root.oninput = (e) => { if (e.target.id === 'cq') { state.q = e.target.value; renderList(root); } };
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; renderList(root); } };
  }

  function boardCard(c) {
    const b = c.board || {};
    const att = S.attendanceRate(c.id);
    let term = '<span class="muted">Not set</span>';
    if (b.termStart && b.termEnd) {
      const total = Math.max(1, -U.daysFromToday(b.termStart) + U.daysFromToday(b.termEnd));
      const pct = Math.min(100, Math.max(0, Math.round((-U.daysFromToday(b.termStart) / total) * 100)));
      const left = U.daysFromToday(b.termEnd);
      term = `<div class="term ${left >= 0 && left <= 120 ? 'ending' : ''}">${esc(U.fmtDate(b.termStart))} → ${esc(U.fmtDate(b.termEnd))} · ${left < 0 ? 'ended' : `ends ${esc(U.relDays(b.termEnd))}`}
        <div class="term-track"><div class="term-fill" style="width:${pct}%"></div></div></div>`;
    } else if (b.termEnd) term = esc(U.fmtDate(b.termEnd));
    return `<div class="card"><div class="card-head"><h3>${UI.icon('landmark')} Board role</h3></div><div class="card-body"><dl class="info">
      <dt>Role</dt><dd><b>${esc(b.role || '—')}</b> ${c.type === 'Board Member' && b.voting !== false ? UI.badge('Voting', 'teal') : UI.badge('Non-voting', 'slate')} ${b.independent ? UI.badge('Independent', 'blue') : ''}</dd>
      <dt>Committees</dt><dd>${(b.committees || []).length ? b.committees.map((x) => UI.badge(x, 'cyan')).join(' ') : '<span class="muted">None</span>'}</dd>
      <dt>Term</dt><dd>${term}</dd>
      <dt>Attendance</dt><dd>${att ? `${att.pct}% <span class="muted">(${att.present} of ${att.total} meetings)</span>` : '<span class="muted">No meetings recorded yet</span>'}</dd>
      <dt>Conflicts of interest</dt><dd>${b.coi ? `<div class="notes-text">${esc(b.coi)}</div>` : '<span class="muted">None disclosed</span>'}</dd>
    </dl></div></div>`;
  }

  function detail(root, id) {
    const c = S.get('contacts', id);
    if (!c) {
      root.innerHTML = `<a class="back" href="#/contacts">${UI.icon('chevronLeft')} Contacts</a>${UI.empty('users', 'Contact not found', 'It may have been deleted.')}`;
      return;
    }
    const name = S.contactName(c);
    const h = S.health(c);
    const acts = S.activitiesFor('contactId', id);
    const tasks = S.openTasksFor('contactId', id);
    const deals = S.all('deals').filter((d) => d.contactId === id);
    const cad = S.cadenceFor(c);
    const isClientSide = S.groupOf(c.type) === 'Clients';
    root.innerHTML = `
      <a class="back" href="#/contacts">${UI.icon('chevronLeft')} Contacts</a>
      <div class="card">
        <div class="detail-head">
          ${UI.avatar(name, 'lg')}
          <div class="who">
            <h1>${esc(name)}</h1>
            <div class="meta">${esc(c.title || '')}${c.title && c.orgId ? ' at ' : ''}${c.orgId ? Parts.orgLink(c.orgId) : ''}</div>
            <div class="badges">${UI.typeBadge(c.type)} ${UI.priorityBadge(c.priority)} ${UI.tagChips(c.tags)}</div>
          </div>
          <div class="row">
            <button class="btn" data-act="editContact" data-id="${c.id}">${UI.icon('edit')}Edit</button>
            <button class="icon-btn" data-act="contactMore" data-id="${c.id}" aria-label="More actions">${UI.icon('more')}</button>
          </div>
        </div>
        <div class="quick">
          <button class="btn btn-sm" data-act="logActivity" data-contact="${c.id}" data-atype="Call">${UI.icon('phone')}Log call</button>
          <button class="btn btn-sm" data-act="logActivity" data-contact="${c.id}" data-atype="Email">${UI.icon('mail')}Log email</button>
          <button class="btn btn-sm" data-act="logActivity" data-contact="${c.id}" data-atype="Meeting">${UI.icon('users')}Log meeting</button>
          <button class="btn btn-sm" data-act="logActivity" data-contact="${c.id}" data-atype="Note">${UI.icon('note')}Add note</button>
          <button class="btn btn-sm" data-act="newTask" data-contact="${c.id}">${UI.icon('checkSquare')}Add follow-up</button>
          ${isClientSide || c.type === 'Partner' ? `<button class="btn btn-sm" data-act="newDeal" data-contact="${c.id}">${UI.icon('kanban')}New deal</button>` : ''}
        </div>
      </div>

      <div class="grid grid-main" style="margin-top:16px">
        <div class="stack">
          ${h.status === 'overdue' ? `<div class="banner warn">${UI.icon('alert')}<div><b>${h.last ? `No interaction in ${-U.daysFromToday(h.last)} days.` : 'No interaction logged yet.'}</b> Your cadence for ${esc(c.type)} contacts is every ${cad} days. <a href="#" data-act="logActivity" data-contact="${c.id}">Log one now</a>.</div></div>` : ''}
          <div class="card">
            <div class="card-head"><h2>Interaction history</h2><span class="sub">${acts.length}</span>
              <div class="right"><button class="btn btn-sm" data-act="logActivity" data-contact="${c.id}">${UI.icon('plus')}Log</button></div></div>
            <div class="card-body">${Parts.timeline(acts, { emptyText: 'No interactions yet. Log your first call, email or meeting.' })}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Next steps</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newTask" data-contact="${c.id}">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush">${tasks.length ? tasks.map(Parts.taskRow).join('') : '<div class="empty-sm">No next step. Add one so this relationship does not go cold.</div>'}</div>
          </div>
          ${S.isBoardType(c.type) ? boardCard(c) : ''}
          <div class="card"><div class="card-head"><h3>Details</h3></div><div class="card-body"><dl class="info">
            <dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
            <dt>Phone</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
            ${c.linkedin ? `<dt>Profile</dt><dd><a href="${esc(/^https?:/i.test(c.linkedin) ? c.linkedin : `https://${c.linkedin}`)}" target="_blank" rel="noopener">${esc(c.linkedin)}</a></dd>` : ''}
            <dt>Group</dt><dd>${esc(S.GROUPS.find((g) => g.id === S.groupOf(c.type))?.label || '')}</dd>
            <dt>Source</dt><dd>${esc(c.source || '—')}</dd>
            <dt>Owner</dt><dd>${esc(S.nameOf(c.ownerId) || 'Unassigned')}</dd>
            <dt>Keep in touch</dt><dd>${cad ? `Every ${cad} days${c.cadenceDays === null || c.cadenceDays === undefined || c.cadenceDays === '' ? ' <span class="muted">(type default)</span>' : ''}` : 'No reminders'}</dd>
            <dt>Health</dt><dd><span class="health health-${h.status}">${UI.healthDot(h)}${esc(h.label)}</span></dd>
            <dt>Last contact</dt><dd>${h.last ? esc(`${U.fmtDate(h.last)} (${U.relDays(h.last)})`) : 'Never'}</dd>
            <dt>Added</dt><dd>${esc(U.fmtDate((c.createdAt || '').slice(0, 10)))}</dd>
          </dl></div></div>
          ${deals.length ? `<div class="card"><div class="card-head"><h3>Deals</h3></div><div class="card-body flush"><div class="list">${deals.map(Parts.dealItem).join('')}</div></div></div>` : ''}
          ${c.notes ? `<div class="card"><div class="card-head"><h3>Notes</h3></div><div class="card-body"><div class="notes-text">${esc(c.notes)}</div></div></div>` : ''}
        </div>
      </div>`;
  }

  function exportContacts() {
    const rows = U.sortBy(filtered(), SORTS.name);
    const cols = [
      ['First name', (c) => c.firstName], ['Last name', (c) => c.lastName], ['Title', (c) => c.title], ['Organization', (c) => S.orgName(c.orgId)],
      ['Email', (c) => c.email], ['Phone', (c) => c.phone], ['Type', (c) => c.type], ['Group', (c) => S.GROUPS.find((g) => g.id === S.groupOf(c.type))?.label],
      ['Tier', (c) => c.priority], ['Source', (c) => c.source], ['Owner', (c) => S.nameOf(c.ownerId)],
      ['Tags', (c) => (c.tags || []).map((t) => { const x = S.tag(t); return x ? `${x.group ? `${x.group}: ` : ''}${x.name}` : ''; })],
      ['Last contact', (c) => (S.lastContactMap()[c.id] || '').slice(0, 10)], ['Health', (c) => S.health(c).label],
      ['Board role', (c) => (S.isBoardType(c.type) ? c.board?.role : '')], ['Committees', (c) => (S.isBoardType(c.type) ? c.board?.committees : '')],
      ['Term end', (c) => (S.isBoardType(c.type) ? c.board?.termEnd : '')], ['Notes', (c) => c.notes],
    ].map(([label, get]) => ({ label, get }));
    U.download(`contacts-${U.today()}.csv`, U.toCSV(rows, cols), 'text/csv');
    UI.toast(`Exported ${U.plural(rows.length, 'contact')}`, 'success');
  }

  return {
    render(root, params) { if (params[0]) detail(root, params[0]); else list(root); },
    actions: {
      setGroup: (ds) => { state.group = ds.g; App.rerender(); },
      toggleAttention: () => { state.attention = !state.attention; App.rerender(); },
      clearFilters: () => { Object.assign(state, { group: 'all', q: '', type: '', priority: '', owner: '', tag: '', attention: false }); App.rerender(); },
      sort: (ds) => {
        if (state.sort === ds.sort) state.dir *= -1; else { state.sort = ds.sort; state.dir = ds.sort === 'last' || ds.sort === 'priority' ? (ds.sort === 'last' ? -1 : 1) : 1; }
        renderList(document.querySelector('#view'));
      },
      exportContacts,
      contactMore: (ds, el) => {
        const c = S.get('contacts', ds.id);
        UI.menu(el, [
          { label: 'Edit contact', icon: 'edit', onClick: () => Actions.editContact({ id: c.id }) },
          {
            label: 'Change type…', icon: 'tag', onClick: async () => {
              const t = await UI.prompt('Change contact type', { label: 'New type', value: c.type, options: S.CONTACT_TYPES.map((x) => ({ value: x.id, label: x.id, group: S.GROUPS.find((g) => g.id === x.group).label })), okText: 'Change' });
              if (t && t !== c.type) {
                if (S.isBoardType(t) && !c.board) {
                  S.update('contacts', c.id, { type: t, board: { role: t === 'Advisor' ? 'Advisor' : 'Director', committees: [], termStart: U.today(), termEnd: '', voting: t === 'Board Member', independent: false, coi: '' } });
                } else S.update('contacts', c.id, { type: t });
                UI.toast(`${S.contactName(c)} is now ${t}`, 'success');
              }
            },
          },
          { label: 'Add follow-up', icon: 'checkSquare', onClick: () => Actions.newTask({ contact: c.id }) },
          '-',
          {
            label: 'Delete contact', icon: 'trash', danger: true, onClick: async () => {
              if (await UI.confirm(`Delete ${S.contactName(c)}? Past activities stay in the log but are unlinked.`)) {
                S.remove('contacts', c.id);
                UI.toast('Contact deleted');
                location.hash = '#/contacts';
              }
            },
          },
        ]);
      },
    },
  };
})();
