/* Dashboard — what needs attention today across clients, pipeline and the board. */
Views.dashboard = (() => {
  const S = Store;
  const esc = U.esc;

  function bars(rows, fmt) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (!rows.some((r) => r.value)) return '<div class="empty-sm">No data yet.</div>';
    return `<div class="bars" role="list">${rows.map((r) => `
      <div class="bar-row" role="listitem" aria-label="${esc(`${r.label}: ${fmt(r.value)}${r.tip ? `, ${r.tip}` : ''}`)}">
        <span class="bar-label" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="display:block;width:${r.value ? Math.max(1.5, (r.value / max) * 100) : 0}%"></span></span>
        <span class="bar-value">${esc(fmt(r.value))}</span>
        <span class="tip">${esc(r.label)} · ${esc(fmt(r.value))}${r.tip ? ` · ${esc(r.tip)}` : ''}</span>
      </div>`).join('')}</div>`;
  }

  function render(root) {
    const me = S.currentUser();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const contacts = S.all('contacts');
    const deals = S.all('deals');
    const open = deals.filter(S.isOpenDeal);
    const pipeline = open.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const weighted = open.reduce((s, d) => s + (Number(d.value) || 0) * S.dealProb(d) / 100, 0);
    const qStart = U.quarterStart();
    const wonQ = deals.filter((d) => d.stage === 'won' && (d.closedAt || '') >= qStart);
    const clients = S.all('organizations').filter((o) => o.type === 'Client').length
      || contacts.filter((c) => c.type === 'Client').length;
    const openTasks = S.all('tasks').filter((t) => t.status !== 'done');
    const mine = openTasks.filter((t) => t.ownerId === me?.id);
    const focusPool = mine.length ? mine : openTasks;
    const dueNow = focusPool.filter((t) => t.due && U.daysFromToday(t.due) <= 0);
    const focus = U.sortBy(focusPool.filter((t) => t.due && U.daysFromToday(t.due) <= 3), (t) => t.due).slice(0, 8);
    const attention = U.sortBy(contacts.map((c) => ({ c, h: S.health(c) })).filter((x) => x.h.status === 'overdue'),
      (x) => `${x.c.priority || 'Z'}${String(1000 + (x.h.left || 0)).padStart(5, '0')}`).slice(0, 7);
    const next = S.upcomingMeetings()[0];
    const boardOpen = openTasks.filter((t) => t.kind === 'Board action');
    const endingTerms = S.boardMembers().filter((c) => c.board?.termEnd && U.daysFromToday(c.board.termEnd) >= 0 && U.daysFromToday(c.board.termEnd) <= 120);
    const recent = U.sortBy(S.all('activities').filter((a) => (a.date || '').slice(0, 10) <= U.today()), 'date', -1).slice(0, 6);
    const stageRows = S.STAGES.filter((s) => S.isOpenDeal({ stage: s.id })).map((s) => {
      const items = open.filter((d) => d.stage === s.id);
      return { label: s.name, value: items.reduce((t, d) => t + (Number(d.value) || 0), 0), tip: U.plural(items.length, 'deal') };
    });
    const sources = {};
    contacts.filter((c) => ['Client', 'Prospect', 'Lead'].includes(c.type)).forEach((c) => { const k = c.source || 'Unknown'; sources[k] = (sources[k] || 0) + 1; });
    const sourceRows = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    const isEmpty = !contacts.length && !deals.length && !S.all('meetings').length;
    const sampleLeft = !Cloud.demo && Cloud.isAdmin ? Object.values(S.findSample()).reduce((n, ids) => n + ids.length, 0) : 0;

    root.innerHTML = `
      ${Parts.pageHead(`${greet}${me ? `, ${me.name.split(' ')[0]}` : ''}`, esc(U.fmtDateLong(U.today())),
        `<button class="btn" data-act="newTask">${UI.icon('checkSquare')}<span class="hide-sm">New task</span></button>
         <button class="btn btn-primary" data-act="logActivity">${UI.icon('plus')}Log interaction</button>`)}
      ${sampleLeft ? `<div class="banner warn">${UI.icon('alert')}<div><b>${sampleLeft} records here belong to the fictional sample company.</b> Remove them in one click so the workspace only holds your real data. <a href="#/settings">Open Settings → Data</a>.</div></div>` : ''}
      ${isEmpty ? `<div class="card" style="margin-bottom:16px">${UI.empty('home', 'Let’s set up your workspace',
        '1. Add your team in Settings · 2. Add your first leads and clients · 3. Add your board members · 4. Log every call, email and meeting with a next step.',
        '<button class="btn btn-primary" data-act="newContact">Add a contact</button> <button class="btn" data-act="newContact" data-type="Board Member">Add a board member</button>')}</div>` : ''}
      <div class="kpis">
        <a class="card kpi" href="#/organizations"><span class="kpi-label">${UI.icon('building')}Active clients</span><span class="kpi-value">${clients}</span><span class="kpi-sub">${contacts.filter((c) => c.type === 'Lead' || c.type === 'Prospect').length} leads & prospects</span></a>
        <a class="card kpi" href="#/pipeline"><span class="kpi-label">${UI.icon('kanban')}Open pipeline</span><span class="kpi-value">${esc(U.money(pipeline, true))}</span><span class="kpi-sub">${esc(U.money(weighted, true))} weighted · ${U.plural(open.length, 'deal')}</span></a>
        <a class="card kpi" href="#/pipeline"><span class="kpi-label">${UI.icon('star')}Won this quarter</span><span class="kpi-value">${esc(U.money(wonQ.reduce((s, d) => s + (Number(d.value) || 0), 0), true))}</span><span class="kpi-sub">${U.plural(wonQ.length, 'deal')} since ${esc(U.fmtDate(qStart))}</span></a>
        <a class="card kpi ${dueNow.length ? 'alert' : ''}" href="#/tasks"><span class="kpi-label">${UI.icon('checkSquare')}Due today / overdue</span><span class="kpi-value">${dueNow.length}</span><span class="kpi-sub">${mine.length ? 'your tasks' : 'team tasks'} · ${openTasks.length} open total</span></a>
        <a class="card kpi" href="${next ? `#/board/meetings/${next.id}` : '#/board'}"><span class="kpi-label">${UI.icon('landmark')}Next board meeting</span><span class="kpi-value">${next ? esc(U.daysFromToday(next.date) === 0 ? 'Today' : `${U.daysFromToday(next.date)} days`) : '—'}</span><span class="kpi-sub">${next ? esc(U.fmtDate(next.date)) : 'none scheduled'} · ${U.plural(boardOpen.length, 'open action')}</span></a>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Today’s focus</h2><span class="sub">overdue and due in the next 3 days${mine.length ? ' · yours' : ''}</span><div class="right"><a class="small" href="#/tasks">All tasks</a></div></div>
            <div class="card-body flush">${focus.length ? focus.map(Parts.taskRow).join('') : '<div class="empty-sm">Nothing urgent. A good moment to reach out to someone on the right.</div>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Recent activity</h2><div class="right"><a class="small" href="#/activities">Activity log</a></div></div>
            <div class="card-body flush">${Parts.timeline(recent, { byDay: false, compact: true, emptyText: 'Interactions you log appear here.' })}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Needs attention</h3><span class="sub">past their keep-in-touch cadence</span></div>
            <div class="card-body flush"><div class="list">${attention.length ? attention.map(({ c, h }) => `<div class="list-item">
              ${UI.avatar(S.contactName(c), 'sm')}
              <div class="li-main"><b><a href="#/contacts/${c.id}">${esc(S.contactName(c))}</a></b><small>${esc([c.type, S.orgName(c.orgId)].filter(Boolean).join(' · '))}</small></div>
              <div class="li-side"><span class="health health-overdue">${esc(h.label)}</span><button class="icon-btn sm" data-act="logActivity" data-contact="${c.id}" aria-label="Log interaction with ${esc(S.contactName(c))}" title="Log interaction">${UI.icon('plus')}</button></div>
            </div>`).join('') : '<div class="empty-sm">Every relationship is on track.</div>'}</div></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Open pipeline by stage</h3><span class="sub">annual value</span></div>
            <div class="card-body">${bars(stageRows, (v) => U.money(v, true))}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Where leads & clients come from</h3><span class="sub">contacts by source</span></div>
            <div class="card-body">${bars(sourceRows, (v) => String(v))}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Board snapshot</h3><div class="right"><a class="small" href="#/board">Open board</a></div></div>
            <div class="card-body">
              ${next ? `<div class="next-meeting">${Parts.meetingDate(next)}<div class="li-main"><b><a href="#/board/meetings/${next.id}">${esc(next.title)}</a></b><small>${esc([U.fmtTime(next.date), next.location].filter(Boolean).join(' · '))}</small></div></div>` : '<div class="muted">No meeting scheduled. <a href="#" data-act="newMeeting">Schedule one</a></div>'}
              <dl class="info" style="margin-top:12px">
                <dt>Open action items</dt><dd>${boardOpen.length} <span class="muted">(${boardOpen.filter((t) => t.due && U.daysFromToday(t.due) < 0).length} overdue)</span></dd>
                <dt>Terms ending</dt><dd>${endingTerms.length ? endingTerms.map((c) => `${Parts.contactLink(c)} <span class="muted">${esc(U.relDays(c.board.termEnd))}</span>`).join('<br>') : '<span class="muted">None in the next 120 days</span>'}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>`;
  }

  return { render, actions: {} };
})();
