/* Organizations — our Main company and every organization that relates to it
   (clients, prospects, partners/alliances, vendors/contracts, investors). */
Views.organizations = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { q: '', type: '', industry: '', owner: '' };
  const REL_GROUPS = [
    { label: 'Clients', types: ['Client'], add: 'Client', hint: 'Signed contracts' },
    { label: 'Prospects & leads', types: ['Prospect', 'Lead'], add: 'Prospect', hint: 'In conversation' },
    { label: 'Partners · alliances', types: ['Partner'], add: 'Partner', hint: 'Alliances and referral partners' },
    { label: 'Vendors · contracts', types: ['Vendor'], add: 'Vendor', hint: 'Services and licenses we buy' },
    { label: 'Investors', types: ['Investor'], add: 'Investor', hint: '' },
    { label: 'Past clients & others', types: ['Past Client', 'Other'], add: 'Other', hint: '' },
  ];

  const lastActivity = (orgId) => {
    const contactIds = new Set(S.all('contacts').filter((c) => c.orgId === orgId).map((c) => c.id));
    return S.all('activities').reduce((max, a) => ((a.orgId === orgId || (a.contactIds || []).some((id) => contactIds.has(id))) && a.type !== 'Note' && a.date > max ? a.date : max), '');
  };
  const typeBadge = (o) => UI.badge(o.type === 'Main' ? 'Main · our company' : (o.type || 'Other'), S.ORG_COLORS[o.type] || 'slate');
  const dealTotals = (orgId) => {
    const deals = S.all('deals').filter((d) => d.orgId === orgId);
    return {
      won: deals.filter((d) => d.stage === 'won'),
      open: deals.filter(S.isOpenDeal),
      sum: (list) => list.reduce((s, d) => s + (Number(d.value) || 0), 0),
    };
  };

  function renderList(root) {
    const all = S.all('organizations');
    const list = U.sortBy(all.filter((o) => (!state.type || o.type === state.type) && (!state.industry || o.industry === state.industry)
      && (!state.owner || S.orgOwners(o).includes(state.owner)) && U.matches(state.q, o.name, o.industry, o.address, o.type)),
    (o) => `${o.type === 'Main' ? 0 : 1}${o.name.toLowerCase()}`);
    root.querySelector('#ocount').textContent = U.plural(list.length, 'result');
    const box = root.querySelector('#olist');
    if (!all.length) {
      box.innerHTML = UI.empty('building', 'No organizations yet', 'Start with your own company (relationship: Main), then add clients, partners and vendors.',
        '<button class="btn btn-primary" data-act="newOrg" data-type="Main">Add our company</button>');
      return;
    }
    if (!list.length) { box.innerHTML = UI.empty('search', 'No organizations match these filters'); return; }
    box.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Relationship</th><th class="hide-sm">Industry</th><th class="num">People</th><th class="num hide-sm">Open pipeline</th><th>Last activity</th><th class="hide-sm">Owners</th></tr></thead>
      <tbody>${list.map((o) => {
        const people = S.all('contacts').filter((c) => c.orgId === o.id).length;
        const t = dealTotals(o.id);
        const open = t.sum(t.open);
        const last = lastActivity(o.id);
        return `<tr class="clickable" data-act="go" data-href="#/organizations/${o.id}">
          <td><div class="cell-main">${UI.orgLogo(o)}<div><b>${esc(o.name)}</b><small>${esc(o.address || o.website || '')}</small></div></div></td>
          <td>${typeBadge(o)}</td>
          <td class="hide-sm">${esc(o.industry || '—')}</td>
          <td class="num">${people}</td>
          <td class="num hide-sm">${open ? esc(U.money(open)) : '<span class="muted">—</span>'}</td>
          <td>${last ? esc(U.relDays(last)) : '<span class="muted">Never</span>'}</td>
          <td class="hide-sm"><span class="owners">${UI.ownersHtml(S.orgOwners(o))}</span></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function list(root) {
    const main = S.mainOrg();
    root.innerHTML = `
      ${Parts.pageHead('Organizations', main ? `${esc(main.name)} and everyone it works with: clients, partners, vendors and investors` : 'Your company and everyone it works with',
        `<button class="btn" data-act="exportOrgs">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
         <button class="btn btn-primary" data-act="newOrg">${UI.icon('plus')}New organization</button>`)}
      ${!main && S.all('organizations').length ? `<div class="banner info">${UI.icon('building')}<div><b>Which one is your own company?</b> Open it and set its relationship to <b>Main</b>, so clients, alliances and contracts relate to it.</div></div>` : ''}
      <div class="filters">
        <input class="input" type="search" id="oq" placeholder="Filter organizations…" value="${esc(state.q)}" aria-label="Filter organizations">
        <select class="select" data-filter="type" aria-label="Relationship">${UI.selectOptions(S.ORG_TYPES, state.type, 'All relationships')}</select>
        <select class="select" data-filter="industry" aria-label="Industry">${UI.selectOptions(S.settings.industries, state.industry, 'All industries')}</select>
        <select class="select" data-filter="owner" aria-label="Owner">${UI.selectOptions(UI.opts.users(), state.owner, 'All owners')}</select>
        <span class="result-count" id="ocount"></span>
      </div>
      <div class="card"><div class="table-wrap" id="olist"></div></div>`;
    renderList(root);
    root.oninput = (e) => { if (e.target.id === 'oq') { state.q = e.target.value; renderList(root); } };
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; renderList(root); } };
  }

  function detailsCard(o) {
    const owners = S.orgOwners(o);
    return `<div class="card"><div class="card-head"><h3>Details</h3></div><div class="card-body"><dl class="info">
      <dt>Owners</dt><dd>${owners.length ? owners.map((id) => esc(S.nameOf(id) || 'Unknown')).join(', ') : 'Unassigned'}</dd>
      <dt>Website</dt><dd>${o.website ? `<a href="${esc(/^https?:/i.test(o.website) ? o.website : `https://${o.website}`)}" target="_blank" rel="noopener">${esc(o.website)}</a>` : '—'}</dd>
      <dt>Phone</dt><dd>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '—'}</dd>
      <dt>Address</dt><dd>${esc(o.address || '—')}</dd>
      <dt>Added</dt><dd>${esc(U.fmtDate((o.createdAt || '').slice(0, 10)))}</dd>
    </dl>${o.notes ? `<hr><div class="notes-text">${esc(o.notes)}</div>` : ''}</div></div>`;
  }

  function peopleCard(o, people) {
    return `<div class="card"><div class="card-head"><h3>People</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newContact" data-org="${o.id}">${UI.icon('plus')}Add</button></div></div>
      <div class="card-body flush"><div class="list">${people.length ? people.map((c) => `<div class="list-item clickable" data-act="go" data-href="#/contacts/${c.id}">
        ${UI.avatar(S.contactName(c), 'sm')}<div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc(S.isBoardType(c.type) ? [c.board?.role, c.title].filter(Boolean).join(' · ') : (c.title || ''))}</small></div>
        <div class="li-side">${UI.typeBadge(c.type)}</div></div>`).join('') : '<div class="empty-sm">No people linked yet.</div>'}</div></div></div>`;
  }

  // ---- Our Main company ------------------------------------------------------------------
  function mainDetail(root, o) {
    const people = U.sortBy(S.all('contacts').filter((c) => c.orgId === o.id), (c) => `${S.isBoardType(c.type) ? 0 : 1}${S.contactName(c)}`);
    const others = S.all('organizations').filter((x) => x.id !== o.id);
    const allDeals = S.all('deals');
    const won = allDeals.filter((d) => d.stage === 'won');
    const open = allDeals.filter(S.isOpenDeal);
    const sum = (l) => l.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const ids = new Set(people.map((c) => c.id));
    const acts = U.sortBy(S.all('activities').filter((a) => a.orgId === o.id || (a.contactIds || []).some((x) => ids.has(x))), 'date', -1);
    const tasks = U.sortBy(S.all('tasks').filter((t) => t.status !== 'done' && (t.orgId === o.id || ids.has(t.contactId))), (t) => t.due || '9999');
    const board = S.boardMembers();
    const team = S.all('users');
    const relRow = (x) => {
      const t = dealTotals(x.id);
      const summary = [t.won.length ? `${U.plural(t.won.length, 'contract')} · ${U.money(t.sum(t.won), true)}` : '', t.open.length ? `${U.plural(t.open.length, 'open deal')}` : '', x.industry].filter(Boolean).join(' · ');
      return `<div class="list-item clickable" data-act="go" data-href="#/organizations/${x.id}">${UI.orgLogo(x, 'sm')}<div class="li-main"><b>${esc(x.name)}</b><small>${esc(summary || 'No deals yet')}</small></div><div class="li-side"><span class="owners">${UI.ownersHtml(S.orgOwners(x))}</span></div></div>`;
    };
    root.innerHTML = `
      <a class="back" href="#/organizations">${UI.icon('chevronLeft')} Organizations</a>
      <div class="card main-hero">
        <div class="detail-head">
          ${UI.orgLogo(o, 'xl')}
          <div class="who">
            <h1>${esc(o.name)}</h1>
            <div class="meta">${esc([o.industry && o.industry !== 'Other' ? o.industry : '', o.size ? `${o.size} employees` : '', o.address].filter(Boolean).join(' · ') || 'Our company')}</div>
            <div class="badges">${typeBadge(o)} ${UI.tagChips(o.tags)}${S.orgOwners(o).length ? `<span class="owners" title="Owners">${UI.ownersHtml(S.orgOwners(o))}</span>` : ''}</div>
          </div>
          <div class="row"><button class="btn" data-act="editOrg" data-id="${o.id}">${UI.icon('edit')}Edit</button></div>
        </div>
        <div class="quick" style="border-top-color: var(--line-dark, #1b2a52);">
          <button class="btn btn-sm" data-act="newOrg" data-type="Client">${UI.icon('plus')}Client</button>
          <button class="btn btn-sm" data-act="newOrg" data-type="Partner">${UI.icon('plus')}Partner / alliance</button>
          <button class="btn btn-sm" data-act="newOrg" data-type="Vendor">${UI.icon('plus')}Vendor / contract</button>
          <button class="btn btn-sm" data-act="newBoardMember" data-type="Board Member">${UI.icon('landmark')}Board member</button>
          <button class="btn btn-sm" data-act="logActivity" data-org="${o.id}">${UI.icon('activity')}Log interaction</button>
          <button class="btn btn-sm" data-act="newTask" data-org="${o.id}">${UI.icon('checkSquare')}Add task</button>
        </div>
      </div>
      <div class="kpis" style="margin-top:16px">
        <div class="card kpi"><span class="kpi-label">${UI.icon('building')}Clients</span><span class="kpi-value">${others.filter((x) => x.type === 'Client').length}</span><span class="kpi-sub">${others.filter((x) => x.type === 'Prospect' || x.type === 'Lead').length} prospects & leads</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('star')}Contracts won</span><span class="kpi-value">${won.length}</span><span class="kpi-sub">${esc(U.money(sum(won), true))} total</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('users')}Alliances</span><span class="kpi-value">${others.filter((x) => x.type === 'Partner').length}</span><span class="kpi-sub">${others.filter((x) => x.type === 'Vendor').length} vendors</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('kanban')}Open pipeline</span><span class="kpi-value">${esc(U.money(sum(open), true))}</span><span class="kpi-sub">${U.plural(open.length, 'deal')}</span></div>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Relationships</h2><span class="sub">who ${esc(o.name)} works with</span></div>
            <div class="card-body flush">${REL_GROUPS.map((g) => {
              const items = U.sortBy(others.filter((x) => g.types.includes(x.type)), (x) => x.name.toLowerCase());
              if (!items.length && (g.label === 'Investors' || g.label === 'Past clients & others')) return '';
              return `<div class="rel-group"><h4>${esc(g.label)} <span class="nav-count">${items.length}</span>${g.hint ? `<span style="text-transform:none; letter-spacing:0; font-weight:400;">${esc(g.hint)}</span>` : ''}</h4>
                <div class="list">${items.map(relRow).join('') || `<div class="empty-sm">None yet. <a href="#" data-act="newOrg" data-type="${g.add}">Add one</a></div>`}</div></div>`;
            }).join('')}</div></div>
          <div class="card"><div class="card-head"><h2>Company history</h2><span class="sub">${acts.length}</span></div>
            <div class="card-body">${Parts.timeline(acts, { emptyText: 'Board meetings and internal interactions appear here.' })}</div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h3>Board of directors</h3><div class="right"><a class="small" href="#/board/members">Manage</a></div></div>
            <div class="card-body flush"><div class="list">${board.length ? board.map((c) => `<div class="list-item clickable" data-act="go" data-href="#/contacts/${c.id}">${UI.avatar(S.contactName(c), 'sm')}<div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc([c.board?.role, c.title].filter(Boolean).join(' · '))}</small></div></div>`).join('') : '<div class="empty-sm">No board members yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Team</h3><div class="right"><a class="small" href="#/settings">Manage</a></div></div>
            <div class="card-body flush"><div class="list">${team.map((u) => `<div class="list-item">${UI.avatar(u.name, 'sm')}<div class="li-main"><b>${esc(u.name)}</b><small>${esc([u.role, u.email].filter(Boolean).join(' · '))}</small></div></div>`).join('') || '<div class="empty-sm">No team members yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Open company tasks</h3></div><div class="card-body flush">${tasks.length ? tasks.map(Parts.taskRow).join('') : '<div class="empty-sm">Nothing pending.</div>'}</div></div>
          ${people.filter((c) => !S.isBoardType(c.type)).length ? peopleCard(o, people.filter((c) => !S.isBoardType(c.type))) : ''}
          ${detailsCard(o)}
        </div>
      </div>`;
  }

  // ---- Any other organization ------------------------------------------------------------
  function detail(root, id) {
    const o = S.get('organizations', id);
    if (!o) {
      root.innerHTML = `<a class="back" href="#/organizations">${UI.icon('chevronLeft')} Organizations</a>${UI.empty('building', 'Organization not found')}`;
      return;
    }
    if (o.type === 'Main') { mainDetail(root, o); return; }
    const main = S.mainOrg();
    const canBeMain = !main && Cloud.canWrite && (o.name || '').trim().toLowerCase() === (S.settings.companyName || '').trim().toLowerCase();
    const people = U.sortBy(S.all('contacts').filter((c) => c.orgId === id), (c) => S.contactName(c));
    const ids = new Set(people.map((c) => c.id));
    const acts = U.sortBy(S.all('activities').filter((a) => a.orgId === id || (a.contactIds || []).some((x) => ids.has(x))), 'date', -1);
    const deals = U.sortBy(S.all('deals').filter((d) => d.orgId === id), (d) => (S.isOpenDeal(d) ? '0' : '1') + (d.expectedClose || ''));
    const tasks = U.sortBy(S.all('tasks').filter((t) => t.status !== 'done' && (t.orgId === id || ids.has(t.contactId))), (t) => t.due || '9999');
    const won = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + (Number(d.value) || 0), 0);
    const open = deals.filter(S.isOpenDeal).reduce((s, d) => s + (Number(d.value) || 0), 0);
    const relation = { Client: 'Client of', Prospect: 'Prospect of', Lead: 'Lead for', Partner: 'Partner of', Vendor: 'Vendor to', Investor: 'Investor in', 'Past Client': 'Past client of' }[o.type];
    root.innerHTML = `
      <a class="back" href="#/organizations">${UI.icon('chevronLeft')} Organizations</a>
      ${canBeMain ? `<div class="banner info">${UI.icon('building')}<div><b>This is your own company.</b> Make it the <b>Main</b> organization: it gets the logo, all team members as owners, and a page that relates clients, alliances, contracts, the board and the team. <div style="margin-top:8px"><button class="btn btn-sm btn-brand" data-act="makeMain" data-id="${o.id}">Make ${esc(o.name)} our Main company</button></div></div></div>` : ''}
      <div class="card">
        <div class="detail-head">
          ${UI.orgLogo(o, 'lg')}
          <div class="who">
            <h1>${esc(o.name)}</h1>
            <div class="meta">${esc([o.industry, o.size ? `${o.size} employees` : '', o.address].filter(Boolean).join(' · '))}</div>
            <div class="badges">${typeBadge(o)}${main && relation ? ` <span class="small muted">${esc(relation)} <a href="#/organizations/${main.id}">${esc(main.name)}</a></span>` : ''} ${UI.tagChips(o.tags)}${S.orgOwners(o).length ? `<span class="owners" title="Owners">${UI.ownersHtml(S.orgOwners(o))}</span>` : ''}</div>
          </div>
          <div class="row">
            <button class="btn" data-act="editOrg" data-id="${o.id}">${UI.icon('edit')}Edit</button>
          </div>
        </div>
        <div class="quick">
          <button class="btn btn-sm" data-act="newContact" data-org="${o.id}">${UI.icon('users')}Add person</button>
          <button class="btn btn-sm" data-act="logActivity" data-org="${o.id}">${UI.icon('activity')}Log interaction</button>
          <button class="btn btn-sm" data-act="newDeal" data-org="${o.id}">${UI.icon('kanban')}New deal</button>
          <button class="btn btn-sm" data-act="newTask" data-org="${o.id}">${UI.icon('checkSquare')}Add task</button>
        </div>
      </div>
      <div class="kpis" style="margin-top:16px">
        <div class="card kpi"><span class="kpi-label">Won revenue</span><span class="kpi-value">${esc(U.money(won, true))}</span></div>
        <div class="card kpi"><span class="kpi-label">Open pipeline</span><span class="kpi-value">${esc(U.money(open, true))}</span></div>
        <div class="card kpi"><span class="kpi-label">People</span><span class="kpi-value">${people.length}</span></div>
        <div class="card kpi"><span class="kpi-label">Interactions</span><span class="kpi-value">${acts.length}</span><span class="kpi-sub">${acts[0] ? `last ${esc(U.relDays(acts[0].date))}` : 'none yet'}</span></div>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Interaction history</h2><span class="sub">${acts.length}</span></div>
            <div class="card-body">${Parts.timeline(acts)}</div></div>
        </div>
        <div class="stack">
          ${peopleCard(o, people)}
          <div class="card"><div class="card-head"><h3>Open tasks</h3></div><div class="card-body flush">${tasks.length ? tasks.map(Parts.taskRow).join('') : '<div class="empty-sm">Nothing pending.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Deals & contracts</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newDeal" data-org="${o.id}">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush"><div class="list">${deals.length ? deals.map(Parts.dealItem).join('') : '<div class="empty-sm">No deals yet.</div>'}</div></div></div>
          ${detailsCard(o)}
        </div>
      </div>`;
  }

  function exportOrgs() {
    const rows = U.sortBy(S.all('organizations'), (o) => `${o.type === 'Main' ? 0 : 1}${o.name.toLowerCase()}`);
    const cols = [
      ['Name', (o) => o.name], ['Relationship', (o) => o.type], ['Industry', (o) => o.industry], ['Size', (o) => o.size],
      ['Website', (o) => o.website], ['Phone', (o) => o.phone], ['Address', (o) => o.address], ['Owners', (o) => S.orgOwners(o).map((id) => S.nameOf(id))],
      ['People', (o) => S.all('contacts').filter((c) => c.orgId === o.id).length],
      ['Open pipeline', (o) => S.all('deals').filter((d) => d.orgId === o.id && S.isOpenDeal(d)).reduce((s, d) => s + (Number(d.value) || 0), 0)],
      ['Last activity', (o) => lastActivity(o.id).slice(0, 10)], ['Notes', (o) => o.notes],
    ].map(([label, get]) => ({ label, get }));
    U.download(`organizations-${U.today()}.csv`, U.toCSV(rows, cols), 'text/csv');
    UI.toast(`Exported ${U.plural(rows.length, 'organization')}`, 'success');
  }

  return {
    render(root, params) { if (params[0]) detail(root, params[0]); else list(root); },
    actions: {
      exportOrgs,
      makeMain: (ds) => {
        const o = S.get('organizations', ds.id);
        if (!o || S.mainOrg()) return;
        const owners = S.orgOwners(o).length > 1 ? S.orgOwners(o) : S.all('users').map((u) => u.id);
        S.update('organizations', o.id, { type: 'Main', ownerIds: owners, ownerId: owners[0] || '' });
        UI.toast(`${o.name} is now your Main company`, 'success');
      },
    },
  };
})();
