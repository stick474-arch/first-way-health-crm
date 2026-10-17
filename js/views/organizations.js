/* Organizations — client/prospect/partner companies and their people, deals and history. */
Views.organizations = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { q: '', type: '', industry: '', owner: '' };

  const lastActivity = (orgId) => {
    const contactIds = new Set(S.all('contacts').filter((c) => c.orgId === orgId).map((c) => c.id));
    return S.all('activities').reduce((max, a) => ((a.orgId === orgId || (a.contactIds || []).some((id) => contactIds.has(id))) && a.type !== 'Note' && a.date > max ? a.date : max), '');
  };

  function renderList(root) {
    const all = S.all('organizations');
    const list = U.sortBy(all.filter((o) => (!state.type || o.type === state.type) && (!state.industry || o.industry === state.industry)
      && (!state.owner || o.ownerId === state.owner) && U.matches(state.q, o.name, o.industry, o.address, o.type)), (o) => o.name.toLowerCase());
    root.querySelector('#ocount').textContent = U.plural(list.length, 'result');
    const box = root.querySelector('#olist');
    if (!all.length) {
      box.innerHTML = UI.empty('building', 'No organizations yet', 'Add the clinics, employers and partners you work with. Contacts and deals link to them.',
        '<button class="btn btn-primary" data-act="newOrg">Add an organization</button>');
      return;
    }
    if (!list.length) { box.innerHTML = UI.empty('search', 'No organizations match these filters'); return; }
    const colors = { Client: 'green', Prospect: 'blue', Lead: 'sky', 'Past Client': 'slate', Partner: 'violet', Vendor: 'amber', Investor: 'orange', Other: 'slate' };
    box.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Relationship</th><th class="hide-sm">Industry</th><th class="num">People</th><th class="num hide-sm">Open pipeline</th><th>Last activity</th><th class="hide-sm">Owner</th></tr></thead>
      <tbody>${list.map((o) => {
        const people = S.all('contacts').filter((c) => c.orgId === o.id).length;
        const open = S.all('deals').filter((d) => d.orgId === o.id && S.isOpenDeal(d)).reduce((s, d) => s + (Number(d.value) || 0), 0);
        const last = lastActivity(o.id);
        return `<tr class="clickable" data-act="go" data-href="#/organizations/${o.id}">
          <td><div class="cell-main">${UI.avatar(o.name)}<div><b>${esc(o.name)}</b><small>${esc(o.address || o.website || '')}</small></div></div></td>
          <td>${UI.badge(o.type || 'Other', colors[o.type] || 'slate')}</td>
          <td class="hide-sm">${esc(o.industry || '—')}</td>
          <td class="num">${people}</td>
          <td class="num hide-sm">${open ? esc(U.money(open)) : '<span class="muted">—</span>'}</td>
          <td>${last ? esc(U.relDays(last)) : '<span class="muted">Never</span>'}</td>
          <td class="hide-sm">${o.ownerId ? `<span title="${esc(S.nameOf(o.ownerId))}">${UI.avatar(S.nameOf(o.ownerId), 'sm')}</span>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function list(root) {
    root.innerHTML = `
      ${Parts.pageHead('Organizations', 'Companies you sell to, partner with or report to',
        `<button class="btn" data-act="exportOrgs">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
         <button class="btn btn-primary" data-act="newOrg">${UI.icon('plus')}New organization</button>`)}
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

  function detail(root, id) {
    const o = S.get('organizations', id);
    if (!o) {
      root.innerHTML = `<a class="back" href="#/organizations">${UI.icon('chevronLeft')} Organizations</a>${UI.empty('building', 'Organization not found')}`;
      return;
    }
    const people = U.sortBy(S.all('contacts').filter((c) => c.orgId === id), (c) => S.contactName(c));
    const ids = new Set(people.map((c) => c.id));
    const acts = U.sortBy(S.all('activities').filter((a) => a.orgId === id || (a.contactIds || []).some((x) => ids.has(x))), 'date', -1);
    const deals = U.sortBy(S.all('deals').filter((d) => d.orgId === id), (d) => (S.isOpenDeal(d) ? '0' : '1') + (d.expectedClose || ''));
    const tasks = U.sortBy(S.all('tasks').filter((t) => t.status !== 'done' && (t.orgId === id || ids.has(t.contactId))), (t) => t.due || '9999');
    const won = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + (Number(d.value) || 0), 0);
    const open = deals.filter(S.isOpenDeal).reduce((s, d) => s + (Number(d.value) || 0), 0);
    root.innerHTML = `
      <a class="back" href="#/organizations">${UI.icon('chevronLeft')} Organizations</a>
      <div class="card">
        <div class="detail-head">
          ${UI.avatar(o.name, 'lg')}
          <div class="who">
            <h1>${esc(o.name)}</h1>
            <div class="meta">${esc([o.industry, o.size ? `${o.size} employees` : '', o.address].filter(Boolean).join(' · '))}</div>
            <div class="badges">${UI.badge(o.type || 'Other', o.type === 'Client' ? 'green' : o.type === 'Prospect' ? 'blue' : 'slate')} ${UI.tagChips(o.tags)}</div>
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
          <div class="card"><div class="card-head"><h3>People</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newContact" data-org="${o.id}">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush"><div class="list">${people.length ? people.map((c) => `<div class="list-item clickable" data-act="go" data-href="#/contacts/${c.id}">
              ${UI.avatar(S.contactName(c), 'sm')}<div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc(c.title || '')}</small></div>
              <div class="li-side">${UI.typeBadge(c.type)}${Parts.healthCell(c)}</div></div>`).join('') : '<div class="empty-sm">No people linked yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Open tasks</h3></div><div class="card-body flush">${tasks.length ? tasks.map(Parts.taskRow).join('') : '<div class="empty-sm">Nothing pending.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Deals</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newDeal" data-org="${o.id}">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush"><div class="list">${deals.length ? deals.map(Parts.dealItem).join('') : '<div class="empty-sm">No deals yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Details</h3></div><div class="card-body"><dl class="info">
            <dt>Website</dt><dd>${o.website ? `<a href="${esc(/^https?:/i.test(o.website) ? o.website : `https://${o.website}`)}" target="_blank" rel="noopener">${esc(o.website)}</a>` : '—'}</dd>
            <dt>Phone</dt><dd>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '—'}</dd>
            <dt>Owner</dt><dd>${esc(S.nameOf(o.ownerId) || 'Unassigned')}</dd>
            <dt>Added</dt><dd>${esc(U.fmtDate((o.createdAt || '').slice(0, 10)))}</dd>
          </dl>${o.notes ? `<hr><div class="notes-text">${esc(o.notes)}</div>` : ''}</div></div>
        </div>
      </div>`;
  }

  function exportOrgs() {
    const rows = U.sortBy(S.all('organizations'), (o) => o.name.toLowerCase());
    const cols = [
      ['Name', (o) => o.name], ['Relationship', (o) => o.type], ['Industry', (o) => o.industry], ['Size', (o) => o.size],
      ['Website', (o) => o.website], ['Phone', (o) => o.phone], ['Address', (o) => o.address], ['Owner', (o) => S.nameOf(o.ownerId)],
      ['People', (o) => S.all('contacts').filter((c) => c.orgId === o.id).length],
      ['Open pipeline', (o) => S.all('deals').filter((d) => d.orgId === o.id && S.isOpenDeal(d)).reduce((s, d) => s + (Number(d.value) || 0), 0)],
      ['Last activity', (o) => lastActivity(o.id).slice(0, 10)], ['Notes', (o) => o.notes],
    ].map(([label, get]) => ({ label, get }));
    U.download(`organizations-${U.today()}.csv`, U.toCSV(rows, cols), 'text/csv');
    UI.toast(`Exported ${U.plural(rows.length, 'organization')}`, 'success');
  }

  return {
    render(root, params) { if (params[0]) detail(root, params[0]); else list(root); },
    actions: { exportOrgs },
  };
})();
