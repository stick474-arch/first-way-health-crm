/* Aetherium CRM — pieces of markup reused by several pages. */
const Parts = (() => {
  const S = Store;
  const esc = U.esc;

  const pageHead = (title, sub = '', actions = '') => `
    <div class="page-head">
      <div><h1>${esc(title)}</h1>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`;

  const contactLink = (c) => (c ? `<a href="#/contacts/${c.id}">${esc(S.contactName(c))}</a>` : '');
  const orgLink = (id) => { const o = S.get('organizations', id); return o ? `<a href="#/organizations/${o.id}">${esc(o.name)}</a>` : ''; };
  const meetingLink = (id) => { const m = S.get('meetings', id); return m ? `<a href="#/board/meetings/${m.id}">${esc(m.title)}</a>` : ''; };

  function activityItem(a) {
    const people = (a.contactIds || []).map((id) => S.get('contacts', id)).filter(Boolean);
    const isBoard = !!a.meetingId || people.some((p) => S.isBoardType(p.type));
    const deal = S.get('deals', a.dealId);
    const owner = S.nameOf(a.ownerId);
    return `<div class="tl-item">
      <div class="tl-icon ${isBoard ? 'board' : ''}" title="${esc(a.type)}">${UI.actIcon(a.type)}</div>
      <div class="tl-body">
        <div class="tl-title"><b>${esc(a.subject || a.type)}</b>${isBoard ? UI.badge('Board', 'violet') : ''}</div>
        <div class="tl-meta">
          <span>${esc(a.type)} · ${esc(U.fmtDateTime(a.date))}</span>
          ${people.length ? `<span>with ${people.map(contactLink).join(', ')}</span>` : ''}
          ${a.orgId ? `<span>${orgLink(a.orgId)}</span>` : ''}
          ${deal ? `<span>Deal: ${esc(deal.name)}</span>` : ''}
          ${a.meetingId ? `<span>${meetingLink(a.meetingId)}</span>` : ''}
          ${owner ? `<span>by ${esc(owner)}</span>` : ''}
        </div>
        ${a.notes ? `<div class="tl-notes">${esc(a.notes)}</div>` : ''}
      </div>
      <div class="tl-actions"><button class="icon-btn sm" data-act="editActivity" data-id="${a.id}" aria-label="Edit activity" title="Edit">${UI.icon('edit')}</button></div>
    </div>`;
  }

  function timeline(acts, { byDay = true, compact = false, emptyText = 'No interactions logged yet.' } = {}) {
    if (!acts.length) return `<div class="empty-sm">${esc(emptyText)}</div>`;
    let last = '';
    const html = acts.map((a) => {
      const d = (a.date || '').slice(0, 10);
      const n = U.daysFromToday(d);
      const label = n === 0 ? 'Today' : n === -1 ? 'Yesterday' : n > 0 ? `Upcoming · ${U.fmtDate(d)}` : U.fmtDateLong(d);
      const head = byDay && d !== last ? `<div class="tl-day">${esc(label)}</div>` : '';
      last = d;
      return head + activityItem(a);
    }).join('');
    return `<div class="timeline ${compact ? 'compact' : ''}">${html}</div>`;
  }

  function taskRow(t) {
    const done = t.status === 'done';
    const c = S.get('contacts', t.contactId);
    const links = [
      c ? esc(S.contactName(c)) : '',
      t.orgId && (!c || c.orgId !== t.orgId) ? esc(S.orgName(t.orgId)) : (c && c.orgId ? esc(S.orgName(c.orgId)) : ''),
      t.meetingId ? esc(S.get('meetings', t.meetingId)?.title || '') : '',
      t.dealId ? esc(S.get('deals', t.dealId)?.name || '') : '',
    ].filter(Boolean).join(' · ');
    const owner = S.nameOf(t.ownerId);
    return `<div class="task-row ${done ? 'done' : ''}">
      <button class="task-check" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Mark complete'}" title="${done ? 'Reopen' : 'Mark complete'}">${UI.icon('check')}</button>
      <div class="li-main" data-act="editTask" data-id="${t.id}"><b>${esc(t.title)}</b>${links ? `<small>${links}</small>` : ''}</div>
      <div class="li-side">
        ${t.kind === 'Board action' ? UI.badge('Board', 'violet', 'hide-sm') : ''}
        ${t.priority === 'High' ? `<span class="flag-high" title="High priority">${UI.icon('flag', 'ic-sm')}</span>` : ''}
        ${owner ? `<span title="Owner: ${esc(owner)}">${UI.avatar(owner, 'sm')}</span>` : ''}
        ${UI.dueLabel(t.due, done)}
      </div>
    </div>`;
  }

  function healthCell(c) {
    const h = S.health(c);
    const last = h.last ? U.relDays(h.last) : 'Never';
    return `<span class="health health-${h.status}" title="${esc(h.label)}${h.cad ? ` · cadence ${h.cad}d` : ''}">${UI.healthDot(h)}${esc(h.status === 'overdue' || h.status === 'soon' ? h.label : last)}</span>`;
  }

  function dealItem(d) {
    return `<div class="list-item clickable" data-act="editDeal" data-id="${d.id}">
      <div class="li-main"><b>${esc(d.name)}</b><small>${esc([S.orgName(d.orgId), d.expectedClose && S.isOpenDeal(d) ? `close ${U.relDays(d.expectedClose)}` : d.closedAt ? `closed ${U.fmtDate(d.closedAt)}` : ''].filter(Boolean).join(' · '))}</small></div>
      <div class="li-side">${UI.stageBadge(d.stage)}<b class="num">${esc(U.money(d.value, true))}</b></div>
    </div>`;
  }

  const meetingDate = (m) => {
    const d = U.parse(m.date);
    return `<div class="meeting-date" aria-hidden="true"><span>${d ? d.toLocaleDateString('en-US', { month: 'short' }) : ''}</span><b>${d ? d.getDate() : ''}</b></div>`;
  };

  return { pageHead, contactLink, orgLink, meetingLink, activityItem, timeline, taskRow, healthCell, dealItem, meetingDate };
})();
