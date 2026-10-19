/* Board of Directors — members & terms, meetings (agenda, attendance/quorum, minutes), resolutions, action items. */
Views.board = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { resStatus: '', resYear: '', actView: 'open', showFormer: false };
  const TABS = [['overview', 'Overview'], ['members', 'Members'], ['meetings', 'Meetings'], ['resolutions', 'Resolutions'], ['actions', 'Action items']];
  const STATUS_COLORS = { Scheduled: 'blue', Held: 'amber', 'Minutes approved': 'green', Cancelled: 'slate', Proposed: 'blue', Approved: 'green', Rejected: 'red', Tabled: 'amber', Withdrawn: 'slate' };

  const boardTasks = () => S.all('tasks').filter((t) => t.kind === 'Board action');
  const tabs = (active) => `<div class="segmented" role="tablist" aria-label="Board sections" style="margin-bottom:16px">${TABS.map(([id, label]) => `<a class="seg ${active === id ? 'active' : ''}" href="#/board${id === 'overview' ? '' : `/${id}`}" role="tab">${label}</a>`).join('')}</div>`;
  const head = (sub) => Parts.pageHead('Board of Directors', sub,
    `<button class="btn" data-act="newResolution">${UI.icon('gavel')}<span class="hide-sm">Record resolution</span></button>
     <button class="btn btn-primary" data-act="newMeeting">${UI.icon('calendar')}Schedule meeting</button>`);

  function termInfo(c) {
    const b = c.board || {};
    if (!b.termEnd) return { html: '<div class="term">Term end not set</div>', ending: false };
    const left = U.daysFromToday(b.termEnd);
    const start = b.termStart || b.termEnd;
    const total = Math.max(1, -U.daysFromToday(start) + left);
    const pct = Math.min(100, Math.max(0, Math.round((-U.daysFromToday(start) / total) * 100)));
    const ending = left >= 0 && left <= 120;
    return {
      ending,
      html: `<div class="term ${ending ? 'ending' : ''}">${left < 0 ? `Term ended ${esc(U.fmtDate(b.termEnd))}` : `Term ends ${esc(U.fmtDate(b.termEnd))} (${esc(U.relDays(b.termEnd))})`}
        <div class="term-track"><div class="term-fill" style="width:${pct}%"></div></div></div>`,
    };
  }

  function meetingItem(m) {
    const q = S.quorum(m);
    const res = S.all('resolutions').filter((r) => r.meetingId === m.id).length;
    const acts = boardTasks().filter((t) => t.meetingId === m.id);
    const held = m.status === 'Held' || m.status === 'Minutes approved';
    return `<div class="list-item clickable" data-act="go" data-href="#/board/meetings/${m.id}">
      ${Parts.meetingDate(m)}
      <div class="li-main"><b>${esc(m.title)}</b><small>${esc([U.fmtTime(m.date), m.type === 'Committee' ? m.committee : m.type, m.location].filter(Boolean).join(' · '))}</small></div>
      <div class="li-side">
        ${held ? `<span class="small muted hide-sm">${q.present}/${q.total} present</span>` : ''}
        ${res ? `<span class="small muted hide-sm">${U.plural(res, 'resolution')}</span>` : ''}
        ${acts.length ? `<span class="small muted hide-sm">${acts.filter((t) => t.status !== 'done').length}/${acts.length} actions open</span>` : ''}
        ${UI.badge(m.status, STATUS_COLORS[m.status])}
      </div>
    </div>`;
  }

  function resolutionRow(r) {
    return `<tr class="clickable" data-act="editResolution" data-id="${r.id}">
      <td class="nowrap"><b>${esc(r.number)}</b></td>
      <td><b>${esc(r.title)}</b>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ''}</td>
      <td class="nowrap">${esc(U.fmtDate(r.date))}</td>
      <td class="hide-sm">${esc(r.method)}${r.meetingId ? `<div class="small">${Parts.meetingLink(r.meetingId)}</div>` : ''}</td>
      <td class="votes" title="For / Against / Abstain">${r.status === 'Proposed' ? '—' : `${r.votesFor || 0} – ${r.votesAgainst || 0} – ${r.abstain || 0}`}</td>
      <td>${UI.badge(r.status, STATUS_COLORS[r.status])}</td>
    </tr>`;
  }
  const resTable = (rows) => `<div class="table-wrap"><table class="table"><thead><tr><th>No.</th><th>Resolution</th><th>Date</th><th class="hide-sm">Method</th><th>Votes</th><th>Status</th></tr></thead><tbody>${rows.map(resolutionRow).join('')}</tbody></table></div>`;

  // ---- Overview --------------------------------------------------------------------------
  function overview(root) {
    const members = S.boardMembers();
    const voting = members.filter(S.isVoting);
    const independent = voting.filter((c) => c.board?.independent).length;
    const upcoming = S.upcomingMeetings();
    const next = upcoming[0];
    const open = U.sortBy(boardTasks().filter((t) => t.status !== 'done'), (t) => t.due || '9999');
    const overdue = open.filter((t) => t.due && U.daysFromToday(t.due) < 0);
    const year = U.today().slice(0, 4);
    const resYear = S.all('resolutions').filter((r) => (r.date || '').startsWith(year));
    const ending = members.filter((c) => termInfo(c).ending);
    const recent = U.sortBy(S.all('resolutions').filter((r) => r.status !== 'Proposed'), 'date', -1).slice(0, 5);
    const memberIds = new Set(members.map((c) => c.id));
    const boardActs = U.sortBy(S.all('activities').filter((a) => a.meetingId || (a.contactIds || []).some((id) => memberIds.has(id))), 'date', -1).slice(0, 5);

    const banners = [];
    ending.forEach((c) => banners.push(`<div class="banner warn">${UI.icon('clock')}<div><b>${esc(S.contactName(c))}</b>'s term as ${esc(c.board.role || 'director')} ends ${esc(U.relDays(c.board.termEnd))} (${esc(U.fmtDate(c.board.termEnd))}). Plan a re-election or nomination.</div></div>`));
    if (overdue.length) banners.push(`<div class="banner danger">${UI.icon('alert')}<div><b>${U.plural(overdue.length, 'board action item')} overdue.</b> <a href="#/board/actions">Review them</a> before the next meeting.</div></div>`);
    if (!next && members.length) banners.push(`<div class="banner info">${UI.icon('calendar')}<div><b>No upcoming board meeting.</b> Most early-stage boards meet quarterly. <a href="#" data-act="newMeeting">Schedule the next one</a>.</div></div>`);
    if (next) {
      const packDue = U.addDays(next.date.slice(0, 10), -5);
      const n = U.daysFromToday(packDue);
      if (n >= -5 && n <= 7) banners.push(`<div class="banner info">${UI.icon('mail')}<div><b>Board pack due ${esc(U.relDays(packDue))}.</b> Send the agenda and pre-reads (CEO memo, financials, pipeline) 5 days before the meeting so it can be a discussion meeting.</div></div>`);
    }

    root.innerHTML = `
      ${head('Governance in one place: members, meetings, decisions and follow-through')}
      ${tabs('overview')}
      ${banners.join('')}
      ${!members.length ? `<div class="card">${UI.empty('landmark', 'Set up our board', 'Start with the founding board: the people who govern the company. A name, a seat and a term are enough; you can add the rest later.',
        '<button class="btn btn-primary" data-act="newBoardMember" data-type="Board Member">Add a director</button> <a class="btn" href="#/board/members">Add from the team</a>')}</div>` : ''}
      ${inauguralCta(members)}
      <div class="kpis">
        <a class="card kpi" href="#/board/members"><span class="kpi-label">${UI.icon('users')}Voting directors</span><span class="kpi-value">${voting.length}</span><span class="kpi-sub">${independent} independent · ${members.length - voting.length} advisors/observers</span></a>
        <a class="card kpi" href="${next ? `#/board/meetings/${next.id}` : '#/board/meetings'}"><span class="kpi-label">${UI.icon('calendar')}Next meeting</span><span class="kpi-value">${next ? esc(U.daysFromToday(next.date) === 0 ? 'Today' : `${U.daysFromToday(next.date)}d`) : '—'}</span><span class="kpi-sub">${next ? esc(`${next.title} · ${U.fmtDate(next.date)}`) : 'none scheduled'}</span></a>
        <a class="card kpi ${overdue.length ? 'alert' : ''}" href="#/board/actions"><span class="kpi-label">${UI.icon('checkSquare')}Open action items</span><span class="kpi-value">${open.length}</span><span class="kpi-sub">${overdue.length} overdue</span></a>
        <a class="card kpi" href="#/board/resolutions"><span class="kpi-label">${UI.icon('gavel')}Resolutions ${year}</span><span class="kpi-value">${resYear.filter((r) => r.status === 'Approved').length}</span><span class="kpi-sub">approved · ${resYear.filter((r) => r.status === 'Proposed').length} proposed</span></a>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Upcoming meetings</h2><div class="right"><a class="small" href="#/board/meetings">All meetings</a></div></div>
            <div class="card-body flush"><div class="list">${upcoming.length ? upcoming.slice(0, 4).map(meetingItem).join('') : '<div class="empty-sm">Nothing scheduled.</div>'}</div></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Recent decisions</h2><div class="right"><a class="small" href="#/board/resolutions">Resolution register</a></div></div>
            ${recent.length ? resTable(recent) : '<div class="card-body"><div class="empty-sm">No resolutions recorded yet.</div></div>'}
          </div>
          <div class="card">
            <div class="card-head"><h2>Board interactions</h2><span class="sub">1:1s, calls and meetings with directors</span></div>
            <div class="card-body flush">${Parts.timeline(boardActs, { byDay: false, compact: true, emptyText: 'Log calls and 1:1s with directors to keep the relationship warm between meetings.' })}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Open action items</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newTask" data-kind="Board action">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush">${open.length ? open.slice(0, 7).map(Parts.taskRow).join('') : '<div class="empty-sm">No open action items.</div>'}</div>
            ${open.length > 7 ? `<a class="see-all" href="#/board/actions">See all ${open.length}</a>` : ''}
          </div>
          <div class="card">
            <div class="card-head"><h3>Members</h3><div class="right"><a class="small" href="#/board/members">Manage</a></div></div>
            <div class="card-body flush"><div class="list">${members.map((c) => `<div class="list-item clickable" data-act="go" data-href="#/contacts/${c.id}">
              ${UI.avatar(S.contactName(c), 'sm')}<div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc([c.board?.role, (c.board?.committees || []).join(', ')].filter(Boolean).join(' · '))}</small></div>
              <div class="li-side">${termInfo(c).ending ? UI.badge('Term ending', 'amber') : ''}${c.type === 'Advisor' ? UI.badge('Advisor', 'cyan') : ''}</div></div>`).join('') || '<div class="empty-sm">No members yet.</div>'}</div></div>
          </div>
        </div>
      </div>`;
  }

  // ---- Inaugural meeting -----------------------------------------------------------------
  function inauguralCta(members) {
    if (!members.length || S.all('meetings').some((m) => m.type === 'Inaugural')) return '';
    if (S.pastMeetings().some((m) => m.status === 'Held' || m.status === 'Minutes approved')) return '';
    const voting = members.filter(S.isVoting).length;
    return `<div class="card" style="margin-bottom:16px; background: var(--void); color: var(--on-void); border-color: var(--void);">
      <div class="card-body" style="padding:20px; display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
        <div style="flex:1; min-width:260px;">
          <div style="font-family:var(--display); font-size:18px; font-weight:600; margin-bottom:6px;">Hold our inaugural board meeting</div>
          <div style="opacity:.8; font-size:14px; line-height:1.5;">One click prepares today's meeting: an agenda for a founding board (roles, how we work, the 90-day plan, banking) and ${S.INAUGURAL_RESOLUTIONS.length} draft resolutions to vote on. ${U.plural(members.length, 'member')}, ${voting} voting.</div>
        </div>
        <button class="btn btn-brand" data-act="startInaugural">${UI.icon('landmark')}Prepare today's meeting</button>
      </div>
    </div>`;
  }

  // ---- Members ---------------------------------------------------------------------------
  let accessList = null; // Supabase team access, loaded once per page load
  function members(root) {
    const list = S.boardMembers({ includeFormer: state.showFormer });
    const all = S.boardMembers({ includeFormer: true });
    const former = all.length - S.boardMembers().length;
    const lower = (s) => (s || '').toLowerCase();
    const userFor = (c) => S.all('users').find((u) => (c.email && lower(u.email) === lower(c.email)) || lower(u.name) === lower(S.contactName(c))) || null;
    const onBoard = (email, name) => all.some((c) => (email && lower(c.email) === lower(email)) || (name && lower(S.contactName(c)) === lower(name)));
    const candidates = S.all('users').filter((u) => !onBoard(u.email, u.name)).map((u) => ({ name: u.name, email: u.email || '', from: u.role ? `Team · ${u.role}` : 'Team member' }));
    if (S.mode === 'cloud') {
      if (accessList === null) { accessList = []; Cloud.listMembers().then((l) => { accessList = l; App.rerender(); }).catch(() => {}); }
      accessList.filter((m) => !onBoard(m.email) && !candidates.some((x) => lower(x.email) === m.email))
        .forEach((m) => candidates.push({ name: '', email: m.email, from: `Has app access · ${m.role}` }));
    }
    root.innerHTML = `
      ${head('The people who govern the company: seats, terms, attendance and follow-through')}
      ${tabs('members')}
      ${inauguralCta(S.boardMembers())}
      <div class="row wrap" style="margin-bottom:14px">
        <h2 style="font-size:17px; margin:0;">Our board <span class="muted" style="font-weight:500;">· ${list.length}</span></h2>
        <span class="spacer"></span>
        ${former ? `<label class="check"><input type="checkbox" id="showFormer" ${state.showFormer ? 'checked' : ''}> <span>Show ${U.plural(former, 'former member')}</span></label>` : ''}
        <button class="btn" data-act="newBoardMember" data-type="Advisor">${UI.icon('plus')}Advisor</button>
        <button class="btn btn-primary" data-act="newBoardMember" data-type="Board Member">${UI.icon('plus')}Director</button>
      </div>
      ${candidates.length ? `<div class="card" style="margin-bottom:16px;">
        <div class="card-head"><h3>Already on the team? Bring them onto the board</h3><span class="sub">${U.plural(candidates.length, 'person', 'people')}</span></div>
        <div class="card-body flush"><div class="list">${candidates.map((p) => `<div class="list-item">
          ${UI.avatar(p.name || p.email, 'sm')}
          <div class="li-main"><b>${esc(p.name || p.email)}</b><small>${esc([p.name ? p.email : '', p.from].filter(Boolean).join(' · '))}</small></div>
          <div class="li-side"><button class="btn btn-sm" data-act="newBoardMember" data-type="Board Member" data-name="${esc(p.name)}" data-email="${esc(p.email)}">${UI.icon('plus')}Add to board</button></div>
        </div>`).join('')}</div></div>
      </div>` : ''}
      ${list.length ? `<div class="members">${list.map((c) => {
        const b = c.board || {};
        const att = S.attendanceRate(c.id);
        const user = userFor(c);
        const owners = [c.id, user?.id].filter(Boolean);
        const myActions = boardTasks().filter((t) => t.status !== 'done' && owners.includes(t.ownerId));
        const overdue = myActions.filter((t) => t.due && U.daysFromToday(t.due) < 0).length;
        return `<div class="card member">
          <div class="member-top">${UI.avatar(S.contactName(c), 'lg')}<div><b><a href="#/contacts/${c.id}">${esc(S.contactName(c))}</a></b><small>${esc(b.role || c.type)}${c.title ? ` · ${esc(c.title)}` : ''}</small></div></div>
          <div class="row wrap">${S.isVoting(c) ? UI.badge('Votes', 'teal') : UI.badge(c.type === 'Advisor' ? 'Advisor' : 'Non-voting', 'cyan')}${user ? UI.badge('Team', 'green') : ''}${b.independent ? UI.badge('Independent', 'blue') : ''}${(b.committees || []).map((x) => UI.badge(x, 'slate')).join('')}</div>
          ${termInfo(c).html}
          <div class="row">${UI.icon('userCheck', 'ic-sm')} Meetings: ${att ? `<b>${att.pct}%</b> <span class="muted">attended (${att.present}/${att.total})</span>` : '<span class="muted">none held yet</span>'}</div>
          <div class="row">${UI.icon('checkSquare', 'ic-sm')} Action items: ${myActions.length ? `<b>${myActions.length} open</b>${overdue ? ` <span class="due-over">· ${overdue} overdue</span>` : ''}` : '<span class="muted">none open</span>'}</div>
          ${b.coi ? `<div class="row small" title="${esc(b.coi)}">${UI.icon('shield', 'ic-sm')} Conflict of interest on file</div>` : ''}
          <div class="member-actions">
            <button class="btn btn-sm" data-act="newTask" data-kind="Board action" data-owner="${user?.id || c.id}">${UI.icon('plus')}Assign action</button>
            <button class="btn btn-sm btn-ghost" data-act="editBoardMember" data-id="${c.id}">${UI.icon('edit')}Edit seat</button>
          </div>
        </div>`;
      }).join('')}</div>` : (candidates.length ? '' : `<div class="card">${UI.empty('users', 'No one on the board yet', 'Add the founding directors: a name, a seat and a term are enough.')}</div>`)}`;
    root.onchange = (e) => { if (e.target.id === 'showFormer') { state.showFormer = e.target.checked; App.rerender(); } };
  }

  // ---- Meetings list ---------------------------------------------------------------------
  function meetings(root) {
    const upcoming = S.upcomingMeetings();
    const past = S.pastMeetings();
    root.innerHTML = `
      ${head('Agenda, attendance, quorum, minutes, resolutions and action items per meeting')}
      ${tabs('meetings')}
      ${inauguralCta(S.boardMembers())}
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Upcoming</h2><span class="sub">${upcoming.length}</span></div>
          <div class="card-body flush"><div class="list">${upcoming.map(meetingItem).join('') || `<div class="empty-sm">No meetings scheduled. <a href="#" data-act="newMeeting">Schedule one</a>.</div>`}</div></div></div>
        <div class="card"><div class="card-head"><h2>Past & draft minutes</h2><span class="sub">${past.length}</span></div>
          <div class="card-body flush"><div class="list">${past.map(meetingItem).join('') || '<div class="empty-sm">No past meetings yet.</div>'}</div></div></div>
      </div>`;
  }

  // ---- Meeting detail --------------------------------------------------------------------
  function flushMinutes(root) {
    const ta = root.querySelector('#minutesText');
    if (!ta || !ta.dataset.dirty) return; // only save what the user actually typed
    delete ta.dataset.dirty;
    const m = S.get('meetings', ta.dataset.meeting);
    if (m && m.minutes !== ta.value) S.update('meetings', m.id, { minutes: ta.value }, { silent: true });
  }

  function agendaRows(m) {
    const people = [...S.boardMembers().map((c) => S.contactName(c)), ...S.all('users').map((u) => u.name)];
    return `<datalist id="presenters">${[...new Set(people)].map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="agenda-item agenda-head"><span>#</span><span>Item</span><span class="hide-sm">Presenter</span><span class="hide-sm">Type</span><span class="hide-sm mins">Min</span><span></span></div>
      ${(m.agenda || []).map((a, i) => `<div class="agenda-item">
        <span class="n">${i + 1}</span>
        <input value="${esc(a.title)}" data-ag="${a.id}" data-ag-field="title" aria-label="Agenda item ${i + 1}">
        <input class="presenter" value="${esc(a.presenter || '')}" data-ag="${a.id}" data-ag-field="presenter" list="presenters" placeholder="Presenter" aria-label="Presenter">
        <select class="kind" data-ag="${a.id}" data-ag-field="kind" aria-label="Item type">${UI.selectOptions(S.AGENDA_KINDS.map((k) => ({ value: k, label: `For ${k.toLowerCase()}` })), a.kind)}</select>
        <input class="mins" type="number" min="0" step="5" value="${esc(a.minutes ?? '')}" data-ag="${a.id}" data-ag-field="minutes" aria-label="Minutes">
        <span class="agenda-tools">
          <button class="icon-btn sm" data-act="agMove" data-m="${m.id}" data-ag="${a.id}" data-dir="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${UI.icon('chevronUp')}</button>
          <button class="icon-btn sm" data-act="agMove" data-m="${m.id}" data-ag="${a.id}" data-dir="1" aria-label="Move down" ${i === m.agenda.length - 1 ? 'disabled' : ''}>${UI.icon('chevronDown')}</button>
          <button class="icon-btn sm" data-act="agDelete" data-m="${m.id}" data-ag="${a.id}" aria-label="Remove item">${UI.icon('x')}</button>
        </span>
      </div>`).join('')}`;
  }

  function meetingDetail(root, id) {
    const m = S.get('meetings', id);
    if (!m) {
      root.innerHTML = `<a class="back" href="#/board/meetings">${UI.icon('chevronLeft')} Meetings</a>${UI.empty('landmark', 'Meeting not found')}`;
      return;
    }
    m.agenda = m.agenda || [];
    m.attendance = m.attendance || {};
    const members = S.boardMembers();
    const q = S.quorum(m);
    const resolutions = U.sortBy(S.all('resolutions').filter((r) => r.meetingId === id), 'number');
    const actions = U.sortBy(boardTasks().filter((t) => t.meetingId === id), (t) => (t.status === 'done' ? '1' : '0') + (t.due || '9999'));
    const carried = U.sortBy(boardTasks().filter((t) => t.status !== 'done' && t.meetingId !== id
      && (!t.meetingId || (S.get('meetings', t.meetingId)?.date || '') < m.date)), (t) => t.due || '9999');
    const acts = U.sortBy(S.all('activities').filter((a) => a.meetingId === id), 'date', -1);
    const totalMin = m.agenda.reduce((s, a) => s + (Number(a.minutes) || 0), 0);
    const next = { Scheduled: ['Held', 'Mark as held'], Held: ['Minutes approved', 'Approve minutes'] }[m.status];

    root.innerHTML = `
      <a class="back" href="#/board/meetings">${UI.icon('chevronLeft')} Meetings</a>
      <div class="card">
        <div class="detail-head">
          ${Parts.meetingDate(m)}
          <div class="who">
            <h1>${esc(m.title)}</h1>
            <div class="meta">${esc([U.fmtDateLong(m.date), U.fmtTime(m.date), m.durationMin ? `${m.durationMin} min` : '', m.location].filter(Boolean).join(' · '))}</div>
            <div class="badges">${UI.badge(m.status, STATUS_COLORS[m.status])} ${UI.badge(m.type === 'Committee' ? `${m.committee || 'Committee'} committee` : `${m.type} meeting`, 'violet')}
              ${!Object.keys(m.attendance).length && m.status === 'Scheduled'
                ? `<span class="quorum muted">${UI.icon('users', 'ic-sm')}Quorum: ${q.needed} of ${q.total} voting directors</span>`
                : `<span class="quorum ${q.met ? 'met' : 'not'}">${UI.icon(q.met ? 'check' : 'alert', 'ic-sm')}${q.met ? 'Quorum' : 'No quorum'} · ${q.present}/${q.total} voting present (need ${q.needed})</span>`}</div>
          </div>
          <div class="row wrap">
            ${next ? `<button class="btn btn-primary" data-act="mtgStatus" data-id="${m.id}" data-s="${next[0]}">${UI.icon('check')}${next[1]}</button>` : ''}
            <button class="btn" data-act="composeEmail" data-meeting="${m.id}">${UI.icon('mail')}<span class="hide-sm">Email board</span></button>
            <button class="btn" data-act="printMinutes" data-id="${m.id}">${UI.icon('printer')}<span class="hide-sm">Minutes</span></button>
            <button class="btn" data-act="editMeeting" data-id="${m.id}">${UI.icon('edit')}Edit</button>
          </div>
        </div>
      </div>
      ${m.status === 'Scheduled' && U.daysFromToday(m.date) >= 0 ? `<div class="banner info" style="margin-top:16px">${UI.icon('mail')}<div><b>Send the board pack by ${esc(U.fmtDate(U.addDays(m.date.slice(0, 10), -5)))}</b> (agenda + CEO memo + financials). Mark each agenda item as for information, discussion or decision so time goes to what matters.</div></div>` : ''}
      <div class="grid grid-main" style="margin-top:16px">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Agenda</h2><span class="sub">${U.plural(m.agenda.length, 'item')} · <span id="agTotal">${totalMin}</span> min</span>
              <div class="right"><button class="btn btn-sm" data-act="agAdd" data-m="${m.id}">${UI.icon('plus')}Add item</button></div></div>
            <div class="card-body flush">${m.agenda.length ? agendaRows(m) : '<div class="empty-sm">No agenda items yet.</div>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Minutes</h2><span class="save-state" id="saveState">${m.minutes ? 'Saved' : ''}</span>
              <div class="right">${!m.minutes ? `<button class="btn btn-sm" data-act="minutesDraft" data-m="${m.id}">${UI.icon('note')}Draft from agenda</button>` : ''}</div></div>
            <div class="card-body"><textarea id="minutesText" class="minutes-area" data-meeting="${m.id}" placeholder="Record discussion points, motions and outcomes. Saved automatically.">${esc(m.minutes || '')}</textarea></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Resolutions</h2><span class="sub">${resolutions.length}</span>
              <div class="right"><button class="btn btn-sm" data-act="newResolution" data-meeting="${m.id}">${UI.icon('gavel')}Add resolution</button></div></div>
            ${resolutions.length ? resTable(resolutions) : '<div class="card-body"><div class="empty-sm">Record each motion with its vote count.</div></div>'}
          </div>
          ${acts.length ? `<div class="card"><div class="card-head"><h2>Related interactions</h2></div><div class="card-body flush">${Parts.timeline(acts, { byDay: false, compact: true })}</div></div>` : ''}
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Attendance</h3><div class="right">${members.length ? `<button class="btn btn-sm btn-ghost" data-act="attAll" data-m="${m.id}">All present</button>` : ''}</div></div>
            <div class="card-body flush">${members.length ? members.map((c) => {
              const v = m.attendance[c.id] || '';
              return `<div class="att-row">
                <div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc(c.board?.role || c.type)}${S.isVoting(c) ? '' : ' · non-voting'}</small></div>
                <div class="att-toggle" role="group" aria-label="Attendance for ${esc(S.contactName(c))}">${['present', 'absent', 'excused'].map((x) => `<button type="button" class="${v === x ? 'on' : ''}" data-act="setAtt" data-m="${m.id}" data-c="${c.id}" data-v="${x}" aria-pressed="${v === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>
              </div>`;
            }).join('') : '<div class="empty-sm">Add board members first.</div>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Action items from this meeting</h3><div class="right">${actions.length ? `<button class="btn btn-sm btn-ghost" data-act="openMeetingTasks" data-m="${m.id}" title="See and manage these in Tasks & follow-ups">${UI.icon('checkSquare')}Open in Tasks</button>` : ''}<button class="btn btn-sm btn-ghost" data-act="newTask" data-meeting="${m.id}" data-kind="Board action">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush">${actions.length ? actions.map(Parts.taskRow).join('') : '<div class="empty-sm">Assign every follow-up an owner and a due date before the meeting ends.</div>'}</div>
          </div>
          ${carried.length ? `<div class="card"><div class="card-head"><h3>Open items carried over</h3><span class="sub">review these</span></div>
            <div class="card-body flush">${carried.map(Parts.taskRow).join('')}</div></div>` : ''}
        </div>
      </div>`;

    const saveState = root.querySelector('#saveState');
    const saveMinutes = U.debounce(() => { flushMinutes(root); if (saveState) saveState.textContent = 'Saved'; }, 600);
    root.oninput = (e) => {
      if (e.target.id === 'minutesText') { e.target.dataset.dirty = '1'; if (saveState) saveState.textContent = 'Saving…'; saveMinutes(); }
    };
    root.onchange = (e) => {
      const agId = e.target.dataset.ag;
      if (!agId || !e.target.dataset.agField) return;
      const field = e.target.dataset.agField;
      const agenda = m.agenda.map((a) => (a.id === agId ? { ...a, [field]: field === 'minutes' ? Number(e.target.value) || 0 : e.target.value } : a));
      S.update('meetings', m.id, { agenda }, { silent: true });
      root.querySelector('#agTotal').textContent = agenda.reduce((s, a) => s + (Number(a.minutes) || 0), 0);
    };
    root.querySelector('#minutesText').addEventListener('blur', () => flushMinutes(root));
  }

  // ---- Resolutions -----------------------------------------------------------------------
  function resolutions(root) {
    const all = S.all('resolutions');
    const years = [...new Set(all.map((r) => (r.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const list = U.sortBy(all.filter((r) => (!state.resStatus || r.status === state.resStatus) && (!state.resYear || (r.date || '').startsWith(state.resYear))), (r) => `${r.date}${r.number}`, -1);
    root.innerHTML = `
      ${head('The official register of board decisions — votes in meetings and written consents')}
      ${tabs('resolutions')}
      <div class="filters">
        <select class="select" data-filter="resStatus" aria-label="Status">${UI.selectOptions(S.RESOLUTION_STATUS, state.resStatus, 'All statuses')}</select>
        <select class="select" data-filter="resYear" aria-label="Year">${UI.selectOptions(years, state.resYear, 'All years')}</select>
        <button class="btn btn-sm" data-act="exportResolutions">${UI.icon('download')}Export CSV</button>
        <span class="result-count">${U.plural(list.length, 'resolution')}</span>
      </div>
      <div class="card">${list.length ? resTable(list) : UI.empty('gavel', all.length ? 'No resolutions match' : 'No resolutions yet', 'Record each motion with its vote count, or a unanimous written consent signed between meetings.', '<button class="btn btn-primary" data-act="newResolution">Record a resolution</button>')}</div>`;
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; App.rerender(); } };
  }

  // ---- Action items ----------------------------------------------------------------------
  function actionItems(root) {
    const all = boardTasks();
    const open = U.sortBy(all.filter((t) => t.status !== 'done'), (t) => t.due || '9999');
    const done = U.sortBy(all.filter((t) => t.status === 'done'), (t) => t.doneAt || '', -1);
    const list = state.actView === 'open' ? open : done;
    root.innerHTML = `
      ${head('Follow-through on what the board decided: every item has an owner and a due date')}
      ${tabs('actions')}
      <div class="row wrap" style="margin-bottom:14px">
        <div class="segmented">
          <button class="seg ${state.actView === 'open' ? 'active' : ''}" data-act="setActView" data-v="open">Open <span class="count">${open.length}</span></button>
          <button class="seg ${state.actView === 'done' ? 'active' : ''}" data-act="setActView" data-v="done">Completed <span class="count">${done.length}</span></button>
        </div>
        <button class="btn btn-primary" data-act="newTask" data-kind="Board action" style="margin-left:auto">${UI.icon('plus')}Add action item</button>
      </div>
      <div class="card">${list.length ? list.map(Parts.taskRow).join('') : UI.empty('checkSquare', state.actView === 'open' ? 'No open action items' : 'Nothing completed yet')}</div>`;
  }

  // ---- Printable minutes -----------------------------------------------------------------
  function minutesDoc(m) {
    const members = S.boardMembers({ includeFormer: true });
    const q = S.quorum(m);
    const by = (v) => members.filter((c) => (m.attendance || {})[c.id] === v);
    const names = (arr) => arr.map((c) => `${esc(S.contactName(c))}${c.board?.role ? ` (${esc(c.board.role)})` : ''}`).join(', ') || '—';
    const resolutions = U.sortBy(S.all('resolutions').filter((r) => r.meetingId === m.id), 'number');
    const actions = boardTasks().filter((t) => t.meetingId === m.id);
    const chair = members.find((c) => c.board?.role === 'Chair');
    const secretary = members.find((c) => c.board?.role === 'Secretary');
    return `<div class="minutes-doc">
      <div style="color:#555;font-size:12px">${esc(S.settings.companyName)}</div>
      <h1>Minutes: ${esc(m.title)}</h1>
      <div>${esc([U.fmtDateLong(m.date), U.fmtTime(m.date), m.location].filter(Boolean).join(' · '))}</div>
      ${m.status !== 'Minutes approved' ? '<div style="color:#b26b00;margin-top:4px"><b>DRAFT</b> — pending board approval</div>' : '<div style="margin-top:4px">Approved by the board</div>'}
      <h2>Attendance</h2>
      <p><b>Present:</b> ${names(by('present'))}<br><b>Absent:</b> ${names(by('absent'))}<br><b>Excused:</b> ${names(by('excused'))}</p>
      <p>${q.met ? `A quorum was present (${q.present} of ${q.total} voting directors).` : `A quorum was NOT present (${q.present} of ${q.total} voting directors; ${q.needed} required).`}</p>
      <h2>Agenda</h2>
      <ol>${(m.agenda || []).map((a) => `<li>${esc(a.title)}${a.presenter ? ` — ${esc(a.presenter)}` : ''} <i style="color:#666">(for ${esc((a.kind || '').toLowerCase())})</i></li>`).join('')}</ol>
      <h2>Proceedings</h2>
      <div class="pre">${esc(m.minutes || 'No minutes recorded.')}</div>
      <h2>Resolutions</h2>
      ${resolutions.length ? `<table><thead><tr><th>No.</th><th>Resolution</th><th>For–Against–Abstain</th><th>Outcome</th></tr></thead><tbody>${resolutions.map((r) => `<tr><td>${esc(r.number)}</td><td>${esc(r.title)}${r.description ? `<br><span style="color:#555">${esc(r.description)}</span>` : ''}</td><td>${r.votesFor || 0}–${r.votesAgainst || 0}–${r.abstain || 0}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>'}
      <h2>Action items</h2>
      ${actions.length ? `<table><thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${actions.map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(S.nameOf(t.ownerId) || '—')}</td><td>${esc(U.fmtDate(t.due))}</td><td>${t.status === 'done' ? 'Done' : 'Open'}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>'}
      <div class="sig"><div>Secretary${secretary ? `: ${esc(S.contactName(secretary))}` : ''}</div><div>Chair${chair ? `: ${esc(S.contactName(chair))}` : ''}</div></div>
    </div>`;
  }

  function printMinutes(ds) {
    flushMinutes(document.querySelector('#view'));
    const m = S.get('meetings', ds.id);
    const doc = minutesDoc(m);
    const md = UI.modal({
      title: 'Minutes preview', size: 'xl', dismissable: true, body: doc,
      footer: `<span class="muted small">Use “Save as PDF” in the print dialog to file or share.</span><span class="spacer"></span><button class="btn" data-close>Close</button><button class="btn btn-primary" data-print>${UI.icon('printer')}Print / PDF</button>`,
    });
    md.el.querySelector('[data-print]').onclick = () => {
      const area = document.querySelector('#printArea');
      area.innerHTML = doc;
      document.body.classList.add('printing');
      const done = () => { document.body.classList.remove('printing'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
    };
  }

  function exportResolutions() {
    const rows = U.sortBy(S.all('resolutions'), (r) => `${r.date}${r.number}`);
    const cols = [
      ['Number', (r) => r.number], ['Date', (r) => r.date], ['Resolution', (r) => r.title], ['Details', (r) => r.description],
      ['Method', (r) => r.method], ['Meeting', (r) => S.get('meetings', r.meetingId)?.title || ''], ['Status', (r) => r.status],
      ['For', (r) => r.votesFor], ['Against', (r) => r.votesAgainst], ['Abstain', (r) => r.abstain],
    ].map(([label, get]) => ({ label, get }));
    U.download(`board-resolutions-${U.today()}.csv`, U.toCSV(rows, cols), 'text/csv');
    UI.toast(`Exported ${U.plural(rows.length, 'resolution')}`, 'success');
  }

  function render(root, params) {
    flushMinutes(root);
    const [tab, id] = params;
    if (tab === 'meetings' && id) meetingDetail(root, id);
    else if (tab === 'members') members(root);
    else if (tab === 'meetings') meetings(root);
    else if (tab === 'resolutions') resolutions(root);
    else if (tab === 'actions') actionItems(root);
    else overview(root);
  }

  const withMeeting = (ds, fn) => {
    const view = document.querySelector('#view');
    flushMinutes(view);
    const m = S.get('meetings', ds.m);
    if (m) fn(m);
  };

  return {
    render,
    actions: {
      setActView: (ds) => { state.actView = ds.v; App.rerender(); },
      openMeetingTasks: (ds) => Views.tasks.showMeeting(ds.m),
      startInaugural: () => {
        const hour = String(new Date().getHours()).padStart(2, '0');
        const chair = S.boardMembers().find((c) => c.board?.role === 'Chair');
        const lead = S.currentUser()?.name || '';
        const agenda = S.INAUGURAL_AGENDA.map((a, i) => ({
          ...a, id: U.uid('agi'), presenter: i === 4 ? lead : (chair && (i === 0 || i === 6) ? S.contactName(chair) : ''),
        }));
        const m = S.upsert('meetings', {
          title: 'Inaugural Board Meeting', type: 'Inaugural', committee: '', date: `${U.today()}T${hour}:00`, durationMin: 90,
          location: '', status: 'Scheduled', agenda, attendance: {}, minutes: '',
        }, { silent: true });
        S.INAUGURAL_RESOLUTIONS.forEach((title) => S.upsert('resolutions', {
          number: S.nextResolutionNumber(U.today()), title, description: '', meetingId: m.id, method: 'Meeting vote',
          date: U.today(), status: 'Proposed', votesFor: 0, votesAgainst: 0, abstain: 0,
        }, { silent: true }));
        location.hash = `#/board/meetings/${m.id}`;
        UI.toast('Inaugural meeting ready. Mark attendance, then work through the agenda.', 'success', { duration: 6000 });
      },
      exportResolutions,
      printMinutes,
      setAtt: (ds) => withMeeting(ds, (m) => {
        const attendance = { ...(m.attendance || {}) };
        if (attendance[ds.c] === ds.v) delete attendance[ds.c]; else attendance[ds.c] = ds.v;
        S.update('meetings', m.id, { attendance });
      }),
      attAll: (ds) => withMeeting(ds, (m) => {
        const attendance = { ...(m.attendance || {}) };
        S.boardMembers().forEach((c) => { attendance[c.id] = 'present'; });
        S.update('meetings', m.id, { attendance });
      }),
      agAdd: (ds) => withMeeting(ds, (m) => {
        S.update('meetings', m.id, { agenda: [...(m.agenda || []), { id: U.uid('agi'), title: 'New item', presenter: '', kind: 'Discussion', minutes: 10 }] });
        setTimeout(() => { const inputs = document.querySelectorAll('[data-ag-field="title"]'); const last = inputs[inputs.length - 1]; if (last) { last.focus(); last.select(); } }, 30);
      }),
      agDelete: (ds) => withMeeting(ds, (m) => S.update('meetings', m.id, { agenda: m.agenda.filter((a) => a.id !== ds.ag) })),
      agMove: (ds) => withMeeting(ds, (m) => {
        const agenda = [...m.agenda];
        const i = agenda.findIndex((a) => a.id === ds.ag);
        const j = i + Number(ds.dir);
        if (i < 0 || j < 0 || j >= agenda.length) return;
        [agenda[i], agenda[j]] = [agenda[j], agenda[i]];
        S.update('meetings', m.id, { agenda });
      }),
      minutesDraft: (ds) => withMeeting(ds, (m) => {
        const q = S.quorum(m);
        const text = [
          `The meeting was called to order at ${U.fmtTime(m.date) || '__:__'} by the Chair.`,
          `Quorum: ${q.present} of ${q.total} voting directors present.`,
          '',
          ...(m.agenda || []).filter((a, i) => i > 0 && !/adjourn/i.test(a.title)).flatMap((a, i) => [`${i + 1}. ${a.title}${a.presenter ? ` (${a.presenter})` : ''}`, a.kind === 'Decision' ? '   Motion: … Moved by … Seconded by … Result: …' : '   - ', '']),
          'There being no further business, the meeting was adjourned at __:__.',
        ].join('\n');
        S.update('meetings', m.id, { minutes: text });
      }),
      mtgStatus: (ds) => {
        const view = document.querySelector('#view');
        flushMinutes(view);
        const m = S.get('meetings', ds.id);
        if (ds.s === 'Held' && !Object.keys(m.attendance || {}).length) UI.toast('Tip: record attendance so quorum is documented', 'info');
        S.update('meetings', ds.id, { status: ds.s });
        UI.toast(`Meeting marked as ${ds.s.toLowerCase()}`, 'success');
      },
    },
  };
})();
