/* Pipeline — deals by stage (drag cards between columns, or use the stage menu on each card). */
Views.pipeline = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { owner: '', showClosed: false };

  function card(d) {
    const inStage = d.stageChangedAt ? -U.daysFromToday(d.stageChangedAt.slice(0, 10)) : null;
    const stale = S.isOpenDeal(d) && inStage !== null && inStage > 21;
    const overdue = S.isOpenDeal(d) && d.expectedClose && U.daysFromToday(d.expectedClose) < 0;
    const owner = S.nameOf(d.ownerId);
    return `<div class="kcard" draggable="true" data-id="${d.id}" data-act="editDeal">
      <b>${esc(d.name)}</b>
      <div class="org">${esc(S.orgName(d.orgId) || S.contactName(S.get('contacts', d.contactId)) || 'No organization')}</div>
      <div class="kcard-foot">
        <span class="val">${esc(U.money(d.value))}</span>
        <span class="spacer"></span>
        ${d.stage === 'lost' && d.lostReason ? `<span class="muted">${esc(d.lostReason)}</span>` : ''}
        ${S.isOpenDeal(d) && d.expectedClose ? `<span class="${overdue ? 'due-over' : 'muted'}" title="Expected close ${esc(U.fmtDate(d.expectedClose))}">${overdue ? 'Past close date' : esc(U.fmtDate(d.expectedClose))}</span>` : ''}
        ${owner ? `<span title="${esc(owner)}">${UI.avatar(owner, 'sm')}</span>` : ''}
      </div>
      ${stale ? `<div class="small due-today" style="margin-top:6px">${UI.icon('clock', 'ic-sm')} ${inStage} days in this stage</div>` : ''}
      <select data-stage-for="${d.id}" aria-label="Move ${esc(d.name)} to stage">${UI.selectOptions(S.STAGES.map((s) => ({ value: s.id, label: `Stage: ${s.name}` })), d.stage)}</select>
    </div>`;
  }

  function render(root) {
    const deals = S.all('deals').filter((d) => !state.owner || d.ownerId === state.owner);
    const open = deals.filter(S.isOpenDeal);
    const total = open.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const weighted = open.reduce((s, d) => s + (Number(d.value) || 0) * S.dealProb(d) / 100, 0);
    const yearAgo = U.addDays(U.today(), -365);
    const closed = deals.filter((d) => !S.isOpenDeal(d) && (d.closedAt || '') >= yearAgo);
    const wonN = closed.filter((d) => d.stage === 'won').length;
    const winRate = closed.length ? Math.round((wonN / closed.length) * 100) : null;
    const cutoff = U.addDays(U.today(), -90);
    const stages = S.STAGES;

    root.innerHTML = `
      ${Parts.pageHead('Pipeline', 'Drag a card to move it. Won deals automatically turn the contact and organization into Clients.',
        `<button class="btn btn-primary" data-act="newDeal">${UI.icon('plus')}New deal</button>`)}
      <div class="kpis">
        <div class="card kpi"><span class="kpi-label">${UI.icon('kanban')}Open deals</span><span class="kpi-value">${open.length}</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('dollar')}Open pipeline</span><span class="kpi-value">${esc(U.money(total, true))}</span><span class="kpi-sub">total annual value</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('dollar')}Weighted forecast</span><span class="kpi-value">${esc(U.money(weighted, true))}</span><span class="kpi-sub">value × stage probability</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('star')}Win rate (12 mo)</span><span class="kpi-value">${winRate === null ? '—' : `${winRate}%`}</span><span class="kpi-sub">${wonN} won of ${closed.length} closed</span></div>
      </div>
      <div class="filters">
        <select class="select" data-filter="owner" aria-label="Owner">${UI.selectOptions(UI.opts.users(), state.owner, 'All owners')}</select>
        <label class="check"><input type="checkbox" id="showClosed" ${state.showClosed ? 'checked' : ''}> <span>Show all closed deals (default: last 90 days)</span></label>
      </div>
      ${deals.length ? `<div class="kanban">${stages.map((s) => {
        let items = deals.filter((d) => d.stage === s.id);
        if (!S.isOpenDeal({ stage: s.id }) && !state.showClosed) items = items.filter((d) => (d.closedAt || d.updatedAt || '') >= cutoff);
        items = U.sortBy(items, (d) => (S.isOpenDeal(d) ? d.expectedClose || '9999' : d.closedAt || ''), S.isOpenDeal({ stage: s.id }) ? 1 : -1);
        const sum = items.reduce((t, d) => t + (Number(d.value) || 0), 0);
        return `<section class="kcol ${s.id}" data-stage="${s.id}" aria-label="${esc(s.name)}">
          <div class="kcol-head"><b>${esc(s.name)} <span>${items.length}</span></b><span>${esc(U.money(sum, true))}${S.isOpenDeal({ stage: s.id }) ? ` · ${s.prob}%` : ''}</span></div>
          <div class="kcol-body">${items.map(card).join('') || '<div class="empty-sm" style="text-align:center">Drop deals here</div>'}</div>
        </section>`;
      }).join('')}</div>`
        : `<div class="card">${UI.empty('kanban', 'No deals yet', 'A deal is a potential contract with a client. Track its stage, value and expected close date.', '<button class="btn btn-primary" data-act="newDeal">Create your first deal</button>')}</div>`}`;

    root.querySelectorAll('.kcard').forEach((el) => {
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
    root.querySelectorAll('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain');
        if (id) Actions.moveDeal(id, col.dataset.stage);
      });
    });
    root.onchange = (e) => {
      if (e.target.dataset.stageFor) Actions.moveDeal(e.target.dataset.stageFor, e.target.value);
      else if (e.target.dataset.filter) { state[e.target.dataset.filter] = e.target.value; render(root); }
      else if (e.target.id === 'showClosed') { state.showClosed = e.target.checked; render(root); }
    };
  }

  return { render, actions: {} };
})();
