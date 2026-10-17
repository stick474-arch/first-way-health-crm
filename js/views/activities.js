/* Activity log — every interaction: client calls, partner meetings, board 1:1s and board meetings. */
Views.activities = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { q: '', type: '', audience: '', owner: '', range: '30' };

  function audiences(a) {
    const set = new Set((a.contactIds || []).map((id) => S.get('contacts', id)).filter(Boolean).map((c) => S.groupOf(c.type)));
    if (a.meetingId) set.add('Governance');
    return set;
  }

  function filtered() {
    const from = state.range === 'all' ? '' : U.addDays(U.today(), -Number(state.range));
    return U.sortBy(S.all('activities').filter((a) => (!from || (a.date || '').slice(0, 10) >= from)
      && (!state.type || a.type === state.type)
      && (!state.owner || a.ownerId === state.owner)
      && (!state.audience || audiences(a).has(state.audience))
      && U.matches(state.q, a.subject, a.notes, S.orgName(a.orgId), (a.contactIds || []).map((id) => S.contactName(S.get('contacts', id))))), 'date', -1);
  }

  function renderList(root) {
    const list = filtered();
    const byType = S.ACTIVITY_TYPES.map((t) => [t, list.filter((a) => a.type === t).length]).filter(([, n]) => n);
    root.querySelector('#acount').innerHTML = `${U.plural(list.length, 'interaction')}${byType.length ? ` · ${byType.map(([t, n]) => `${n} ${esc(t.toLowerCase())}`).join(', ')}` : ''}`;
    root.querySelector('#alist').innerHTML = S.all('activities').length
      ? (list.length ? Parts.timeline(list) : UI.empty('search', 'Nothing in this period', 'Try a longer date range or clear the filters.'))
      : UI.empty('activity', 'No interactions logged yet', 'Log calls, emails and meetings with clients, partners and board members. The log builds your relationship history automatically.',
        '<button class="btn btn-primary" data-act="logActivity">Log your first interaction</button>');
  }

  function render(root) {
    root.innerHTML = `
      ${Parts.pageHead('Activity log', 'Client interactions and board interactions in one timeline',
        `<button class="btn" data-act="exportActivities">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
         <button class="btn btn-primary" data-act="logActivity">${UI.icon('plus')}Log interaction</button>`)}
      <div class="segmented" role="tablist" aria-label="Audience">
        ${[['', 'Everyone'], ['Clients', 'Clients & leads'], ['Network', 'Network'], ['Governance', 'Board & advisors'], ['Internal', 'Internal']]
          .map(([id, label]) => `<button class="seg ${state.audience === id ? 'active' : ''}" data-act="setAudience" data-a="${id}" role="tab">${esc(label)}</button>`).join('')}
      </div>
      <div class="filters">
        <input class="input" type="search" id="aq" placeholder="Search subject, notes, people…" value="${esc(state.q)}" aria-label="Search activities">
        <select class="select" data-filter="type" aria-label="Type">${UI.selectOptions(S.ACTIVITY_TYPES, state.type, 'All types')}</select>
        <select class="select" data-filter="owner" aria-label="Logged by">${UI.selectOptions(UI.opts.users(), state.owner, 'Anyone')}</select>
        <select class="select" data-filter="range" aria-label="Period">${UI.selectOptions([{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }, { value: 'all', label: 'All time' }], state.range)}</select>
        <span class="result-count" id="acount"></span>
      </div>
      <div id="alist"></div>`;
    renderList(root);
    root.oninput = (e) => { if (e.target.id === 'aq') { state.q = e.target.value; renderList(root); } };
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; renderList(root); } };
  }

  function exportActivities() {
    const rows = filtered();
    const cols = [
      ['Date', (a) => a.date.replace('T', ' ')], ['Type', (a) => a.type], ['Subject', (a) => a.subject],
      ['People', (a) => (a.contactIds || []).map((id) => S.contactName(S.get('contacts', id)))], ['Organization', (a) => S.orgName(a.orgId)],
      ['Deal', (a) => S.get('deals', a.dealId)?.name || ''], ['Board meeting', (a) => S.get('meetings', a.meetingId)?.title || ''],
      ['Logged by', (a) => S.nameOf(a.ownerId)], ['Notes', (a) => a.notes],
    ].map(([label, get]) => ({ label, get }));
    U.download(`activities-${U.today()}.csv`, U.toCSV(rows, cols), 'text/csv');
    UI.toast(`Exported ${U.plural(rows.length, 'interaction')}`, 'success');
  }

  return {
    render,
    actions: {
      setAudience: (ds) => { state.audience = ds.a; App.rerender(); },
      exportActivities,
    },
  };
})();
