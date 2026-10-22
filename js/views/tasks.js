/* Tasks — Asana-style work management: My tasks, Inbox, Projects (list and board views with
   sections and drag & drop). Every task opens in the side panel. */
Views.tasks = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { view: 'open', owner: 'me', kind: '', meeting: '', project: '', myView: 'list', pDone: 'open', pWho: '', pSort: 'manual', calMonth: '' };
  const projectView = {}; // projectId → 'list' | 'board'
  const PRIO_ORDER = { High: 0, Normal: 1, Low: 2 };

  const tabs = (active) => `<div class="segmented" role="tablist" aria-label="Tasks sections" style="margin-bottom:16px">
    ${[['', 'My tasks'], ['inbox', `Inbox${Work.unseen() ? ` <span class="nav-count hot">${Work.unseen()}</span>` : ''}`], ['projects', 'Projects']]
      .map(([id, label]) => `<a class="seg ${active === id ? 'active' : ''}" role="tab" href="#/tasks${id ? `/${id}` : ''}" ${active === id ? 'aria-selected="true"' : ''}>${label}</a>`).join('')}</div>`;

  const head = (sub, actions = '') => Parts.pageHead('Tasks', sub, actions || `<button class="btn btn-primary" data-act="newTask">${UI.icon('plus')}New task</button>`);

  // ---- Task rows (list) and cards (board) ---------------------------------------------------
  function row(t, { showProject = true, draggable = false } = {}) {
    const done = t.status === 'done';
    const p = Work.projectOf(t);
    const subs = Work.subtasksOf(t.id);
    const parent = S.get('tasks', t.parentId);
    const meta = [
      parent ? `↳ ${parent.title}` : '',
      showProject && p ? `${p.name}${Work.sectionName(t) ? ` · ${Work.sectionName(t)}` : ''}` : '',
      t.meetingId ? (S.get('meetings', t.meetingId)?.title || '') : '',
      t.contactId ? S.nameOf(t.contactId) : '',
    ].filter(Boolean).join(' · ');
    return `<div class="task-row ${done ? 'done' : ''}" ${draggable ? `draggable="true" data-drag="${t.id}"` : ''}>
      <button class="task-check" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Mark complete'}: ${esc(t.title)}" title="${done ? 'Reopen' : 'Mark complete'}">${UI.icon('check')}</button>
      <div class="li-main" data-act="editTask" data-id="${t.id}" role="button" tabindex="0" aria-label="Open task ${esc(t.title)}">
        <b>${esc(t.title)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}
      </div>
      <div class="li-side">
        ${UI.tagChips((t.tags || []).slice(0, 2))}
        ${subs.length ? `<span class="small muted" title="Subtasks">${UI.icon('list', 'ic-sm')} ${subs.filter((s) => s.status === 'done').length}/${subs.length}</span>` : ''}
        ${(t.comments || []).length ? `<span class="small muted" title="Comments">${UI.icon('message', 'ic-sm')} ${t.comments.length}</span>` : ''}
        ${t.kind === 'Board action' ? UI.badge('Board', 'violet', 'hide-sm') : ''}
        ${t.priority === 'High' ? `<span class="flag-high" title="High priority">${UI.icon('flag', 'ic-sm')}</span>` : ''}
        ${t.ownerId ? `<span title="Assignee: ${esc(S.nameOf(t.ownerId))}">${UI.avatar(S.nameOf(t.ownerId), 'sm')}</span>` : '<span class="avatar sm unassigned" title="Unassigned">?</span>'}
        ${UI.dueLabel(t.due, done)}
      </div>
    </div>`;
  }

  function card(t) {
    const done = t.status === 'done';
    const subs = Work.subtasksOf(t.id);
    return `<div class="kcard tcard ${done ? 'done' : ''}" draggable="true" data-drag="${t.id}" data-act="editTask" data-id="${t.id}" role="button" tabindex="0" aria-label="Open task ${esc(t.title)}">
      <div class="row" style="align-items:flex-start;gap:8px">
        <button class="task-check" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Mark complete'}: ${esc(t.title)}">${UI.icon('check')}</button>
        <b style="flex:1">${esc(t.title)}</b>
      </div>
      ${(t.tags || []).length ? `<div class="tags" style="margin-top:6px">${UI.tagChips(t.tags.slice(0, 3))}</div>` : ''}
      <div class="kcard-foot">
        ${t.ownerId ? `<span title="${esc(S.nameOf(t.ownerId))}">${UI.avatar(S.nameOf(t.ownerId), 'sm')}</span>` : '<span class="avatar sm unassigned" title="Unassigned">?</span>'}
        ${t.due ? UI.dueLabel(t.due, done) : ''}
        <span class="spacer"></span>
        ${subs.length ? `<span class="small muted">${UI.icon('list', 'ic-sm')} ${subs.filter((s) => s.status === 'done').length}/${subs.length}</span>` : ''}
        ${(t.comments || []).length ? `<span class="small muted">${UI.icon('message', 'ic-sm')} ${t.comments.length}</span>` : ''}
        ${t.priority === 'High' ? `<span class="flag-high">${UI.icon('flag', 'ic-sm')}</span>` : ''}
      </div>
    </div>`;
  }

  // ---- My tasks ----------------------------------------------------------------------------
  function myTasks(root) {
    const mine = Work.myIds();
    if (state.meeting && !S.get('meetings', state.meeting)) state.meeting = '';
    if (state.project && !S.get('projects', state.project)) state.project = '';
    const meeting = S.get('meetings', state.meeting);
    const base = S.all('tasks').filter((t) => (!state.kind || t.kind === state.kind)
      && (!state.meeting || t.meetingId === state.meeting)
      && (!state.project || t.projectId === state.project)
      && (state.owner === 'all' || (state.owner === 'me' ? mine.has(t.ownerId) : t.ownerId === state.owner))
      && (state.owner !== 'all' || !t.parentId));
    const sortKey = (t) => `${t.due || '9999'}${PRIO_ORDER[t.priority] ?? 1}`;
    const open = U.sortBy(base.filter((t) => t.status !== 'done'), sortKey);
    const done = U.sortBy(base.filter((t) => t.status === 'done'), (t) => t.doneAt || '', -1);
    const recent = state.owner === 'me' ? open.filter((t) => t.assignedAt && U.daysFromToday(t.assignedAt.slice(0, 10)) >= -3 && t.assignedBy && !mine.has(t.assignedBy)) : [];
    const rest = open.filter((t) => !recent.includes(t));
    const g = { overdue: [], today: [], week: [], later: [], none: [] };
    rest.forEach((t) => {
      if (!t.due) g.none.push(t);
      else { const n = U.daysFromToday(t.due); if (n < 0) g.overdue.push(t); else if (n === 0) g.today.push(t); else if (n <= 7) g.week.push(t); else g.later.push(t); }
    });
    const ownerOpts = [{ value: 'me', label: 'Assigned to me' }, { value: 'all', label: 'Everyone' }, ...UI.opts.owners().filter((o) => !mine.has(o.value))];
    const meetingOpts = U.sortBy(S.all('meetings').filter((m) => S.all('tasks').some((t) => t.meetingId === m.id)), 'date', -1).map((m) => ({ value: m.id, label: `${m.title} · ${U.fmtDate(m.date)}` }));
    const projectOpts = S.all('projects').filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }));
    const section = (label, items, cls = '') => (items.length ? `<div class="task-group"><h3 class="${cls}">${esc(label)} <span class="nav-count">${items.length}</span></h3><div class="card">${items.map((t) => row(t)).join('')}</div></div>` : '');

    root.innerHTML = `
      ${head('Everything assigned to you, across projects, meetings and clients', `<button class="btn btn-primary" data-act="newTask" ${meeting ? `data-meeting="${meeting.id}" data-kind="Board action"` : ''} ${state.project ? `data-project="${state.project}"` : ''}>${UI.icon('plus')}${meeting ? 'New action item' : 'New task'}</button>`)}
      ${tabs('')}
      ${meeting ? `<div class="banner info">${UI.icon('landmark')}<div>Showing the action items of <b><a href="#/board/meetings/${meeting.id}">${esc(meeting.title)}</a></b> (${esc(U.fmtDateLong(meeting.date))}). <a href="#" data-act="clearMeetingFilter">Show all tasks</a></div></div>` : ''}
      <div class="row wrap">
        <div class="segmented" role="tablist">
          <button class="seg ${state.view === 'open' ? 'active' : ''}" data-act="setTaskView" data-v="open">Open <span class="count">${open.length}</span></button>
          <button class="seg ${state.view === 'done' ? 'active' : ''}" data-act="setTaskView" data-v="done">Completed <span class="count">${done.length}</span></button>
        </div>
        <div class="segmented" role="tablist" aria-label="Layout">
          <button class="seg ${state.myView === 'list' ? 'active' : ''}" data-act="setMyView" data-v="list">${UI.icon('list', 'ic-sm')} List</button>
          <button class="seg ${state.myView === 'calendar' ? 'active' : ''}" data-act="setMyView" data-v="calendar">${UI.icon('calendar', 'ic-sm')} Calendar</button>
        </div>
        <select class="select" data-filter="owner" aria-label="Assignee">${UI.selectOptions(ownerOpts, state.owner)}</select>
        ${projectOpts.length ? `<select class="select" data-filter="project" aria-label="Project">${UI.selectOptions(projectOpts, state.project, 'Any project')}</select>` : ''}
        <select class="select" data-filter="kind" aria-label="Type">${UI.selectOptions(S.TASK_KINDS, state.kind, 'All types')}</select>
        ${meetingOpts.length ? `<select class="select" data-filter="meeting" aria-label="Meeting">${UI.selectOptions(meetingOpts, state.meeting, 'Any meeting')}</select>` : ''}
      </div>
      <div id="tlist">
        ${state.myView === 'calendar' ? `<div class="card" style="margin-top:16px;padding:12px">${calendarHtml(state.view === 'open' ? open : done)}</div>` : state.view === 'open'
          ? (open.length
            ? section('Recently assigned', recent) + section('Overdue', g.overdue, 'over') + section('Do today', g.today) + section('Do next week', g.week) + section('Do later', g.later) + section('No due date', g.none)
            : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', state.owner === 'me' ? 'You are all caught up' : 'No open tasks', state.owner === 'me' && S.all('tasks').some((t) => t.status !== 'done') ? 'Others have open tasks: choose “Everyone” to see them.' : 'Create a project to organise work in sections, or add a task.', '<button class="btn btn-primary" data-act="newTask">Add a task</button>')}</div>`)
          : (done.length ? `<div class="card" style="margin-top:16px">${done.slice(0, 200).map((t) => row(t)).join('')}</div>` : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', 'Nothing completed yet')}</div>`)}
      </div>`;
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; App.rerender(); } };
    if (state.myView === 'calendar') wireCalendar(root, { ownerId: S.currentUser()?.id || '' });
  }

  // ---- Inbox -------------------------------------------------------------------------------
  function inbox(root) {
    const seenBefore = Work.seen();
    const items = Work.inbox();
    const what = { assigned: 'assigned you', comment: 'commented on', done: 'completed', due: 'Due soon:', overdue: 'Overdue:' };
    const icon = { assigned: 'userCheck', comment: 'message', done: 'check', due: 'clock', overdue: 'alert' };
    root.innerHTML = `
      ${head('What changed on your work: assignments, comments, completions and deadlines')}
      ${tabs('inbox')}
      <div class="card">${items.length ? `<div class="list">${items.map((i) => `<div class="list-item clickable inbox-item ${i.at > seenBefore && i.kind !== 'due' && i.kind !== 'overdue' ? 'is-new' : ''}" data-act="editTask" data-id="${i.task.id}" role="button" tabindex="0">
          <span class="tl-icon ${i.kind === 'overdue' ? 'danger' : ''}" aria-hidden="true">${UI.icon(icon[i.kind])}</span>
          <div class="li-main"><b>${i.who ? `${esc(i.who)} ${esc(what[i.kind])} ` : `${esc(what[i.kind])} `}${esc(i.task.title)}</b>
            <small>${i.text ? `“${esc(i.text.slice(0, 140))}” · ` : ''}${esc(U.fmtDateTime(i.at))}${Work.projectOf(i.task) ? ` · ${esc(Work.projectOf(i.task).name)}` : ''}</small></div>
        </div>`).join('')}</div>` : UI.empty('message', 'Nothing new', 'When someone assigns you a task, comments on your work or completes something you follow, it shows up here.')}</div>`;
    Work.markSeen();
    App.refreshNav?.();
  }

  // ---- Projects ----------------------------------------------------------------------------
  function projects(root) {
    const list = U.sortBy(S.all('projects').filter((p) => !p.archived), (p) => p.name.toLowerCase());
    const statusColor = { 'On track': 'green', 'At risk': 'amber', 'Off track': 'red', 'On hold': 'slate', Complete: 'blue' };
    root.innerHTML = `
      ${head('Organise work in projects and sections, in a list or on a board', `<button class="btn btn-primary" data-act="newProject">${UI.icon('plus')}New project</button>`)}
      ${tabs('projects')}
      ${list.length ? `<div class="members">${list.map((p) => {
        const pr = Work.progress(p);
        return `<a class="card member project-card" href="#/tasks/project/${p.id}" style="text-decoration:none;color:inherit">
          <div class="member-top"><span class="proj-dot b-${p.color || 'teal'}" aria-hidden="true"></span><div><b>${esc(p.name)}</b><small>${esc(p.description || `${Work.sectionsOf(p).length} sections`)}</small></div></div>
          <div class="row wrap">${UI.badge(p.status || 'On track', statusColor[p.status] || 'green')}${p.due ? `<span class="small muted">Due ${esc(U.fmtDate(p.due))}</span>` : ''}</div>
          <div class="term">${pr.done}/${pr.total} tasks done<div class="term-track"><div class="term-fill" style="width:${pr.pct}%"></div></div></div>
          <div class="owners">${UI.ownersHtml([p.ownerId, ...(p.memberIds || [])].filter((v, i, a) => v && a.indexOf(v) === i))}</div>
        </a>`;
      }).join('')}</div>` : `<div class="card">${UI.empty('kanban', 'No projects yet', 'Projects group related tasks into sections (like columns). Start from a template: company setup, board follow-up, client onboarding or a sales campaign.', '<button class="btn btn-primary" data-act="newProject">Create a project</button>')}</div>`}`;
  }

  // ---- Shared: calendar (month grid) and timeline --------------------------------------------
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthOf = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1); };
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  function calendarHtml(tasks, { quickAdd = true } = {}) {
    const first = monthOf(state.calMonth || U.today().slice(0, 7));
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const byDay = {};
    tasks.filter((t) => t.due).forEach((t) => { (byDay[t.due] = byDay[t.due] || []).push(t); });
    const today = U.today();
    const undated = tasks.filter((t) => !t.due && t.status !== 'done');
    const ro = !Cloud.canWrite;
    return `<div class="cal-bar">
        <button class="icon-btn" data-act="calNav" data-d="-1" aria-label="Previous month">${UI.icon('chevronLeft')}</button>
        <h3>${esc(first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))}</h3>
        <button class="icon-btn" data-act="calNav" data-d="1" aria-label="Next month">${UI.icon('chevronRight')}</button>
        <button class="btn btn-sm" data-act="calNav" data-d="0">Today</button>
        <span class="spacer"></span><span class="small muted">Drag a task to another day to reschedule it</span>
      </div>
      <div class="cal" role="grid" aria-label="Tasks by due date">
        ${DOW.map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')}
        ${days.map((d) => {
          const ds = U.toDateStr(d);
          const items = U.sortBy(byDay[ds] || [], (t) => `${t.status === 'done' ? 1 : 0}${PRIO_ORDER[t.priority] ?? 1}`);
          return `<div class="cal-day ${d.getMonth() !== first.getMonth() ? 'out' : ''} ${ds === today ? 'today' : ''}" data-day="${ds}" role="gridcell" aria-label="${esc(U.fmtDateLong(ds))}">
            <div class="cal-num"><span>${d.getDate()}</span>${quickAdd && !ro ? `<button class="icon-btn sm cal-add" data-act="calAdd" data-day="${ds}" aria-label="Add a task due ${esc(U.fmtDate(ds))}">${UI.icon('plus')}</button>` : ''}</div>
            ${items.slice(0, 4).map((t) => `<div class="cal-task ${t.status === 'done' ? 'done' : ''} ${t.kind === 'Milestone' ? 'milestone' : ''}" draggable="${!ro}" data-drag="${t.id}" data-act="editTask" data-id="${t.id}" role="button" tabindex="0" title="${esc(t.title)}${t.ownerId ? ` · ${esc(S.nameOf(t.ownerId))}` : ''}">
              ${t.kind === 'Milestone' ? '◆ ' : ''}${esc(t.title)}</div>`).join('')}
            ${items.length > 4 ? `<div class="small muted">+${items.length - 4} more</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${undated.length ? `<div class="small muted" style="margin-top:8px">${U.plural(undated.length, 'open task')} without a due date: ${undated.slice(0, 6).map((t) => `<a href="#" data-act="editTask" data-id="${t.id}">${esc(t.title)}</a>`).join(', ')}${undated.length > 6 ? '…' : ''}</div>` : ''}`;
  }

  function wireCalendar(root, extra = {}) {
    root.querySelectorAll('.cal-task[draggable="true"]').forEach((elx) => {
      elx.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', elx.dataset.drag); elx.classList.add('dragging'); });
      elx.addEventListener('dragend', () => elx.classList.remove('dragging'));
    });
    root.querySelectorAll('.cal-day').forEach((zone) => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop'); });
      zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop'); });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drop');
        const t = S.get('tasks', e.dataTransfer.getData('text/plain'));
        if (!t || t.due === zone.dataset.day) return;
        const patch = { due: zone.dataset.day };
        if (t.startDate && t.due) patch.startDate = U.addDays(t.startDate, U.daysFromToday(zone.dataset.day) - U.daysFromToday(t.due));
        S.update('tasks', t.id, patch);
        UI.toast(`Moved to ${U.fmtDate(zone.dataset.day)}`, 'success');
      });
    });
    calDefaults = extra;
  }
  let calDefaults = {};

  function timelineHtml(p, sections, tasks) {
    const dated = tasks.filter((t) => t.due || t.startDate);
    const today = U.today();
    const starts = dated.map((t) => t.startDate || t.due);
    const ends = dated.map((t) => t.due || t.startDate);
    let from = U.addDays([...starts, today].sort()[0], -3);
    from = U.addDays(from, -((U.parse(from).getDay() + 6) % 7)); // Monday
    let to = U.addDays([...ends, U.addDays(today, 21)].sort().slice(-1)[0], 7);
    const span = Math.min(120, Math.max(35, U.daysFromToday(to) - U.daysFromToday(from) + 1));
    to = U.addDays(from, span - 1);
    const col = (d) => U.daysFromToday(d) - U.daysFromToday(from) + 1;
    const dayCols = Array.from({ length: span }, (_, i) => U.addDays(from, i));
    const bar = (t) => {
      const s = t.startDate && t.startDate <= (t.due || t.startDate) ? t.startDate : (t.due || t.startDate);
      const e = t.due || t.startDate;
      const a = Math.max(1, col(s));
      const b = Math.min(span, col(e));
      if (b < 1 || a > span) return '';
      const blocked = (t.blockedBy || []).some((id) => S.get('tasks', id)?.status !== 'done');
      if (t.kind === 'Milestone') return `<div class="tl-ms" style="grid-column:${b}/${b + 1}" title="${esc(t.title)} · ${esc(U.fmtDate(e))}">◆</div>`;
      return `<div class="tl-bar b-${p.color || 'teal'} ${t.status === 'done' ? 'done' : ''} ${blocked ? 'blocked' : ''}" style="grid-column:${a}/${b + 1}" title="${esc(t.title)} · ${esc(U.fmtDate(s))} → ${esc(U.fmtDate(e))}">${t.ownerId ? `<span class="tl-who">${esc(U.initials(S.nameOf(t.ownerId)))}</span>` : ''}</div>`;
    };
    const rows = sections.map((s) => {
      const items = tasks.filter((t) => (t.sectionId || sections[0]?.id) === s.id);
      if (!items.length) return '';
      return `<div class="tl-sec">${esc(s.name)}</div>${U.sortBy(items, (t) => t.startDate || t.due || '9999').map((t) => `
        <div class="tl-row">
          <button class="tl-label" data-act="editTask" data-id="${t.id}"><span class="${t.status === 'done' ? 'muted' : ''}">${esc(t.title)}</span></button>
          <div class="tl-track" style="grid-template-columns:repeat(${span}, var(--tl-day))">${t.due || t.startDate ? bar(t) : '<span class="small muted tl-none">No dates</span>'}</div>
        </div>`).join('')}`;
    }).join('');
    const todayCol = col(today);
    return `<div class="tl-wrap"><div class="timeline" style="--tl-span:${span}">
      <div class="tl-row tl-headrow"><div class="tl-label"></div>
        <div class="tl-track tl-days" style="grid-template-columns:repeat(${span}, var(--tl-day))">${dayCols.map((d, i) => {
          const dt = U.parse(d);
          const isMon = dt.getDay() === 1;
          return `<div class="tl-day ${d === today ? 'today' : ''} ${dt.getDay() === 0 || dt.getDay() === 6 ? 'wkend' : ''}" style="grid-column:${i + 1}">${isMon || i === 0 ? `<b>${esc(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</b>` : ''}</div>`;
        }).join('')}</div></div>
      ${rows || `<div class="empty-sm">Give tasks a start and due date to see them on the timeline.</div>`}
      ${todayCol >= 1 && todayCol <= span ? `<div class="tl-today" style="--tl-col:${todayCol}" aria-hidden="true"></div>` : ''}
    </div></div>
    <p class="small muted">Bars run from start date to due date · ◆ milestones · striped bars are blocked by another task.</p>`;
  }

  // ---- Project: list (grid) · board · calendar · timeline · overview -------------------------
  const PSORT = { manual: 'Manual order', due: 'Due date', assignee: 'Assignee', priority: 'Priority' };
  const collapsed = {};

  function gridRow(t, ro, drag) {
    const done = t.status === 'done';
    const subs = Work.subtasksOf(t.id);
    const blocked = (t.blockedBy || []).some((id) => S.get('tasks', id)?.status !== 'done');
    const overdue = !done && t.due && U.daysFromToday(t.due) < 0;
    return `<div class="tg-row ${done ? 'done' : ''}" ${drag ? `draggable="true" data-drag="${t.id}"` : ''}>
      <div class="tg-name">
        ${t.kind === 'Milestone' ? `<button class="task-check ms" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Complete'} milestone ${esc(t.title)}">◆</button>`
          : `<button class="task-check" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Mark complete'}: ${esc(t.title)}">${UI.icon('check')}</button>`}
        <span class="tg-title" data-act="editTask" data-id="${t.id}" role="button" tabindex="0">${esc(t.title)}</span>
        ${blocked ? `<span class="tg-ic warn" title="Waiting on another task">${UI.icon('alert', 'ic-sm')}</span>` : ''}
        ${t.kind === 'Approval' ? UI.badge(t.approval || 'Approval', { Approved: 'green', 'Changes requested': 'amber', Rejected: 'red' }[t.approval] || 'violet') : ''}
        ${t.repeat ? `<span class="tg-ic" title="Repeats ${esc(t.repeat.toLowerCase())}">↻</span>` : ''}
        ${subs.length ? `<span class="tg-ic" title="Subtasks">${UI.icon('list', 'ic-sm')}${subs.filter((s) => s.status === 'done').length}/${subs.length}</span>` : ''}
        ${(t.comments || []).length ? `<span class="tg-ic" title="Comments">${UI.icon('message', 'ic-sm')}${t.comments.length}</span>` : ''}
        ${(t.likes || []).length ? `<span class="tg-ic" title="Likes">👍${t.likes.length}</span>` : ''}
        <button class="tg-open" data-act="editTask" data-id="${t.id}" aria-label="Open details">Details ${UI.icon('chevronRight', 'ic-sm')}</button>
      </div>
      <div class="tg-cell"><select class="tg-in" data-inline="ownerId" data-id="${t.id}" aria-label="Assignee of ${esc(t.title)}" ${ro ? 'disabled' : ''}>${UI.selectOptions(UI.opts.owners(), t.ownerId, '—')}</select></div>
      <div class="tg-cell"><input type="date" class="tg-in ${overdue ? 'over' : ''}" data-inline="due" data-id="${t.id}" value="${esc(t.due || '')}" aria-label="Due date of ${esc(t.title)}" ${ro ? 'disabled' : ''}></div>
      <div class="tg-cell hide-sm"><select class="tg-in prio-${(t.priority || 'Normal').toLowerCase()}" data-inline="priority" data-id="${t.id}" aria-label="Priority of ${esc(t.title)}" ${ro ? 'disabled' : ''}>${UI.selectOptions(S.TASK_PRIORITIES, t.priority || 'Normal')}</select></div>
      <div class="tg-cell hide-sm tg-tags">${UI.tagChips((t.tags || []).slice(0, 2))}</div>
    </div>`;
  }

  function overviewHtml(p, tasks) {
    const open = tasks.filter((t) => t.status !== 'done');
    const overdue = open.filter((t) => t.due && U.daysFromToday(t.due) < 0);
    const pr = Work.progress(p);
    const byWho = {};
    open.forEach((t) => { const k = t.ownerId ? S.nameOf(t.ownerId) : 'Unassigned'; byWho[k] = (byWho[k] || 0) + 1; });
    const whoRows = Object.entries(byWho).sort((a, b) => b[1] - a[1]);
    const maxWho = Math.max(1, ...whoRows.map((r) => r[1]));
    const secRows = Work.sectionsOf(p).map((s) => { const l = tasks.filter((t) => t.sectionId === s.id); return { s, total: l.length, done: l.filter((t) => t.status === 'done').length }; });
    const milestones = U.sortBy(tasks.filter((t) => t.kind === 'Milestone'), (t) => t.due || '9999');
    const updates = U.sortBy(p.updates || [], 'at', -1);
    const statusColor = { 'On track': 'green', 'At risk': 'amber', 'Off track': 'red', 'On hold': 'slate', Complete: 'blue' };
    return `<div class="kpis">
        <div class="card kpi"><span class="kpi-label">${UI.icon('checkSquare')}Completed</span><span class="kpi-value">${pr.done}/${pr.total}</span><div class="term-track"><div class="term-fill" style="width:${pr.pct}%"></div></div></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('list')}Incomplete</span><span class="kpi-value">${open.length}</span><span class="kpi-sub">${open.filter((t) => !t.ownerId).length} unassigned</span></div>
        <div class="card kpi ${overdue.length ? 'alert' : ''}"><span class="kpi-label">${UI.icon('alert')}Overdue</span><span class="kpi-value">${overdue.length}</span><span class="kpi-sub">${open.filter((t) => t.due && U.daysFromToday(t.due) >= 0 && U.daysFromToday(t.due) <= 7).length} due this week</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('flag')}Status</span><span class="kpi-value" style="font-size:18px">${UI.badge(p.status || 'On track', statusColor[p.status] || 'green')}</span><span class="kpi-sub">${p.due ? `Due ${esc(U.fmtDate(p.due))}` : 'No due date'}</span></div>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Status updates</h3><span class="sub">tell everyone how it’s going</span></div>
            <div class="card-body">
              ${Cloud.canWrite ? `<form class="status-form" data-status-form>
                <div class="row wrap" style="margin-bottom:8px">${S.PROJECT_STATUS.map((st) => `<label class="chip-check b-${statusColor[st]}"><input type="radio" name="st" value="${esc(st)}" ${st === (p.status || 'On track') ? 'checked' : ''}><span>${esc(st)}</span></label>`).join('')}</div>
                <textarea class="input" name="txt" rows="3" placeholder="Summary: what got done, what is next, any blockers…" aria-label="Status update"></textarea>
                <div class="row" style="margin-top:8px"><label class="check small"><input type="checkbox" name="mail" checked><span>Email the members</span></label><span class="spacer"></span><button class="btn btn-primary btn-sm" type="submit">Post update</button></div>
              </form>` : ''}
              ${updates.length ? updates.slice(0, 6).map((u) => `<div class="cmt">${UI.avatar(S.nameOf(u.by) || '?', 'sm')}<div><div class="cmt-head"><b>${esc(S.nameOf(u.by) || 'Someone')}</b>${UI.badge(u.status, statusColor[u.status] || 'slate')}<time>${esc(U.fmtDateTime(u.at))}</time></div><div class="cmt-body">${esc(u.text)}</div></div></div>`).join('') : '<div class="muted small" style="margin-top:8px">No status updates yet.</div>'}
            </div>
          </div>
          <div class="card"><div class="card-head"><h3>Progress by section</h3></div><div class="card-body">${secRows.map((r) => `<div class="ov-row"><span>${esc(r.s.name)}</span><div class="term-track"><div class="term-fill" style="width:${r.total ? Math.round((r.done / r.total) * 100) : 0}%"></div></div><span class="small muted">${r.done}/${r.total}</span></div>`).join('')}</div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h3>Open work by person</h3></div><div class="card-body">${whoRows.length ? whoRows.map(([n, c]) => `<div class="ov-row"><span>${esc(n)}</span><div class="term-track"><div class="term-fill" style="width:${Math.round((c / maxWho) * 100)}%"></div></div><span class="small muted">${c}</span></div>`).join('') : '<div class="muted small">Nothing open.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Milestones</h3></div><div class="card-body flush"><div class="list">${milestones.length ? milestones.map((t) => `<div class="list-item clickable" data-act="editTask" data-id="${t.id}"><span class="ms-dot ${t.status === 'done' ? 'done' : ''}">◆</span><div class="li-main"><b>${esc(t.title)}</b><small>${t.due ? esc(U.fmtDate(t.due)) : 'No date'}${t.status === 'done' ? ' · reached' : ''}</small></div></div>`).join('') : '<div class="empty-sm">Mark key tasks as type “Milestone” to track them here.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>About</h3></div><div class="card-body"><dl class="info">
            <dt>Owner</dt><dd>${esc(S.nameOf(p.ownerId) || '—')}</dd>
            <dt>Members</dt><dd><span class="owners">${UI.ownersHtml(p.memberIds || [])}</span></dd>
            <dt>Goal</dt><dd>${esc(p.description || '—')}</dd></dl></div></div>
        </div>
      </div>`;
  }

  function project(root, id) {
    const p = S.get('projects', id);
    if (!p) { root.innerHTML = `<a class="back" href="#/tasks/projects">${UI.icon('chevronLeft')} Projects</a>${UI.empty('kanban', 'Project not found')}`; return; }
    const view = projectView[id] || p.view || 'list';
    const sections = Work.sectionsOf(p);
    const all = S.all('tasks').filter((t) => t.projectId === id && !t.parentId);
    const mineIds = Work.myIds();
    const keep = (t) => (state.pDone === 'all' || (state.pDone === 'done' ? t.status === 'done' : t.status !== 'done'))
      && (!state.pWho || (state.pWho === 'me' ? mineIds.has(t.ownerId) : state.pWho === 'none' ? !t.ownerId : t.ownerId === state.pWho));
    const sortFn = {
      manual: (t) => `${t.status === 'done' ? 1 : 0}${String(t.order ?? 9999).padStart(6, '0')}${t.createdAt}`,
      due: (t) => `${t.due || '9999'}`,
      assignee: (t) => `${t.ownerId ? S.nameOf(t.ownerId) : '~'}`,
      priority: (t) => `${PRIO_ORDER[t.priority] ?? 1}${t.due || '9999'}`,
    }[state.pSort] || ((t) => t.order);
    const inSection = (sid) => U.sortBy(all.filter((t) => (t.sectionId || sections[0]?.id) === sid && keep(t)), sortFn);
    const pr = Work.progress(p);
    const statusColor = { 'On track': 'green', 'At risk': 'amber', 'Off track': 'red', 'On hold': 'slate', Complete: 'blue' };
    const ro = !Cloud.canWrite;
    const drag = !ro && state.pSort === 'manual';
    const VIEWS = [['overview', 'Overview', 'activity'], ['list', 'List', 'list'], ['board', 'Board', 'kanban'], ['calendar', 'Calendar', 'calendar'], ['timeline', 'Timeline', 'clock']];
    const filterBar = `<div class="row wrap proj-tools">
        ${ro ? '' : `<button class="btn btn-primary btn-sm" data-act="projAddTop" data-id="${id}">${UI.icon('plus')}Add task</button>`}
        <select class="select" data-pf="pDone" aria-label="Completion">${UI.selectOptions([{ value: 'open', label: 'Incomplete tasks' }, { value: 'done', label: 'Completed tasks' }, { value: 'all', label: 'All tasks' }], state.pDone)}</select>
        <select class="select" data-pf="pWho" aria-label="Assignee">${UI.selectOptions([{ value: 'me', label: 'Just my tasks' }, { value: 'none', label: 'Unassigned' }, ...UI.opts.owners()], state.pWho, 'Anyone')}</select>
        ${view === 'list' || view === 'board' ? `<select class="select" data-pf="pSort" aria-label="Sort">${UI.selectOptions(Object.entries(PSORT).map(([value, label]) => ({ value, label: `Sort: ${label}` })), state.pSort)}</select>` : ''}
      </div>`;
    let body = '';
    if (view === 'overview') body = overviewHtml(p, all);
    else if (view === 'calendar') body = filterBar + calendarHtml(all.filter(keep));
    else if (view === 'timeline') body = filterBar + timelineHtml(p, sections, all.filter(keep));
    else if (view === 'board') {
      body = `${filterBar}<div class="kanban">${sections.map((s) => `<section class="kcol" data-section="${s.id}" aria-label="${esc(s.name)}">
            <div class="kcol-head"><b>${esc(s.name)} <span>${inSection(s.id).length}</span></b>${ro ? '' : `<button class="icon-btn sm" data-act="sectionMenu" data-p="${id}" data-s="${s.id}" aria-label="Section options">${UI.icon('more')}</button>`}</div>
            <div class="kcol-body">${inSection(s.id).map(card).join('')}
              ${ro ? '' : `<form class="quick-add" data-section="${s.id}"><input class="input" name="t" placeholder="+ Add task" aria-label="Add a task to ${esc(s.name)}"></form>`}</div>
          </section>`).join('')}
          ${ro ? '' : `<button class="kcol add-col" data-act="addSection" data-id="${id}">${UI.icon('plus')} Add section</button>`}</div>`;
    } else {
      body = `${filterBar}<div class="card tgrid" role="table" aria-label="${esc(p.name)} tasks">
          <div class="tg-row tg-head" role="row"><div>Task name</div><div>Assignee</div><div>Due date</div><div class="hide-sm">Priority</div><div class="hide-sm">Tags</div></div>
          ${sections.map((s) => {
            const items = inSection(s.id);
            const isC = collapsed[`${id}:${s.id}`];
            return `<div class="tg-group" data-section="${s.id}">
              <div class="tg-sec"><button class="tg-sec-btn" data-act="toggleSection" data-k="${id}:${s.id}" aria-expanded="${!isC}">${UI.icon(isC ? 'chevronRight' : 'chevronDown', 'ic-sm')}<b>${esc(s.name)}</b><span class="muted small">${items.length}</span></button>
                ${ro ? '' : `<button class="icon-btn sm" data-act="sectionMenu" data-p="${id}" data-s="${s.id}" aria-label="Section options for ${esc(s.name)}">${UI.icon('more')}</button>`}</div>
              ${isC ? '' : `${items.map((t) => gridRow(t, ro, drag)).join('')}
              ${ro ? '' : `<form class="quick-add tg-add" data-section="${s.id}"><input class="input" name="t" placeholder="+ Add task…" aria-label="Add a task to ${esc(s.name)}"></form>`}`}
            </div>`;
          }).join('')}
        </div>
        ${ro ? '' : `<button class="btn" data-act="addSection" data-id="${id}" style="margin-top:10px">${UI.icon('plus')} Add section</button>`}`;
    }
    root.innerHTML = `
      <a class="back" href="#/tasks/projects">${UI.icon('chevronLeft')} Projects</a>
      <div class="page-head" style="margin-bottom:10px">
        <div><h1><span class="proj-dot b-${p.color || 'teal'}" aria-hidden="true"></span> ${esc(p.name)}</h1>
          <div class="page-sub">${UI.badge(p.status || 'On track', statusColor[p.status] || 'green')} ${pr.done}/${pr.total} done${p.due ? ` · due ${esc(U.fmtDate(p.due))}` : ''}${p.ownerId ? ` · owner ${esc(S.nameOf(p.ownerId))}` : ''}</div></div>
        <div class="actions">
          <span class="owners">${UI.ownersHtml(p.memberIds || [])}</span>
          <button class="btn" data-act="emailProject" data-id="${id}">${UI.icon('mail')}<span class="hide-sm">Email update</span></button>
          ${ro ? '' : `<button class="btn" data-act="editProject" data-id="${id}">${UI.icon('edit')}<span class="hide-sm">Edit</span></button>`}
        </div>
      </div>
      <nav class="proj-tabs" role="tablist" aria-label="Project views">${VIEWS.map(([v, label, ic]) => `<button class="proj-tab ${view === v ? 'active' : ''}" role="tab" aria-selected="${view === v}" data-act="projView" data-id="${id}" data-v="${v}">${UI.icon(ic, 'ic-sm')}${label}</button>`).join('')}</nav>
      ${body}`;

    root.onsubmit = (e) => {
      const st = e.target.closest('[data-status-form]');
      if (st) {
        e.preventDefault();
        const text = st.txt.value.trim();
        const status = st.st.value;
        if (!text) { UI.toast('Write a short summary first', 'error'); return; }
        const u = { id: U.uid('upd'), status, text, by: S.currentUser()?.id || '', at: U.now() };
        S.update('projects', id, { status, updates: [...(p.updates || []), u] });
        if (st.mail.checked) {
          const to = [p.ownerId, ...(p.memberIds || [])].map(Work.emailOf).filter(Boolean).join(', ');
          Mailer.deliver({ to, subject: `${p.name}: ${status}`, body: `${text}\n\nProgress: ${pr.done}/${pr.total} tasks done.\nOpen the project: ${Mailer.APP_URL}#/tasks/project/${id}\n\n${S.currentUser()?.name || ''}` });
        }
        UI.toast('Status update posted', 'success');
        return;
      }
      const f = e.target.closest('.quick-add');
      if (!f) return;
      e.preventDefault();
      const title = f.t.value.trim();
      if (!title) return;
      const sid = f.dataset.section;
      newTaskIn(id, sid, title, all.filter((t) => t.sectionId === sid).length);
      setTimeout(() => root.querySelector(`.quick-add[data-section="${sid}"] input`)?.focus(), 30);
    };
    root.onchange = (e) => {
      const x = e.target;
      if (x.dataset.pf) { state[x.dataset.pf] = x.value; App.rerender(); return; }
      if (x.dataset.inline) {
        const t = S.get('tasks', x.dataset.id);
        if (!t) return;
        const prev = t.ownerId;
        S.update('tasks', t.id, { [x.dataset.inline]: x.value });
        if (x.dataset.inline === 'ownerId') Work.assigned(S.get('tasks', t.id), prev);
      }
    };
    if (view === 'calendar') { wireCalendar(root, { projectId: id }); return; }
    if (view !== 'list' && view !== 'board') return;
    root.querySelectorAll('[data-drag]').forEach((elx) => {
      elx.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', elx.dataset.drag); e.dataTransfer.effectAllowed = 'move'; elx.classList.add('dragging'); });
      elx.addEventListener('dragend', () => elx.classList.remove('dragging'));
    });
    if (!drag) return;
    root.querySelectorAll('[data-section]').forEach((zone) => {
      if (zone.tagName === 'FORM') return;
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop'); });
      zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop'); });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drop');
        const tid = e.dataTransfer.getData('text/plain');
        const t = S.get('tasks', tid);
        if (!t) return;
        const target = e.target.closest('[data-drag]');
        const list = inSection(zone.dataset.section).filter((x) => x.id !== tid);
        const at = target && target.dataset.drag !== tid ? list.findIndex((x) => x.id === target.dataset.drag) : list.length;
        list.splice(at < 0 ? list.length : at, 0, t);
        list.forEach((x, i) => { if (x.order !== i || x.sectionId !== zone.dataset.section) S.update('tasks', x.id, { order: i, sectionId: zone.dataset.section }, { silent: true }); });
        App.rerender();
      });
    });
  }

  function newTaskIn(projectId, sectionId, title, order, extra = {}) {
    return S.upsert('tasks', {
      title, projectId, sectionId, ownerId: '', due: '', priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '',
      contactId: '', orgId: '', dealId: '', meetingId: '', notes: '', tags: [], followerIds: [], comments: [],
      createdBy: S.currentUser()?.id || '', order, ...extra,
    });
  }

  function render(root, params) {
    const [tab, id] = params;
    if (tab === 'inbox') inbox(root);
    else if (tab === 'projects') projects(root);
    else if (tab === 'project' && id) project(root, id);
    else { myTasks(root); if (tab === 'task' && id) setTimeout(() => TaskDrawer.open(id), 0); }
  }

  // ---- Project editing ---------------------------------------------------------------------
  const loose = () => S.all('tasks').filter((t) => !t.projectId && !t.parentId && t.status !== 'done');
  function editProject(ds = {}) {
    const existing = S.get('projects', ds.id);
    const values = existing
      ? { ...existing, members: existing.memberIds || [] }
      : { color: S.PROJECT_COLORS[S.all('projects').length % S.PROJECT_COLORS.length], status: 'On track', ownerId: S.currentUser()?.id || '', template: 'blank', members: S.all('users').map((u) => u.id) };
    UI.formModal({
      title: existing ? `Edit ${existing.name}` : 'New project',
      size: 'lg',
      submitText: existing ? 'Save' : 'Create project',
      values,
      fields: [
        { name: 'name', label: 'Project name', required: true, span: 2, placeholder: 'e.g. Company setup · Q4' },
        ...(existing ? [] : [{ name: 'template', label: 'Start from', type: 'select', span: 2, options: Object.entries(S.PROJECT_TEMPLATES).map(([value, t]) => ({ value, label: `${t.label}: ${t.sections.join(' · ')}` })) }]),
        ...(existing || !loose().length ? [] : [{ name: 'adopt', type: 'checkbox', span: 2, checkLabel: `Move the ${loose().length} open tasks that have no project into this one (first section)` }]),
        { name: 'ownerId', label: 'Owner', type: 'select', options: UI.opts.users(), empty: '— None —' },
        { name: 'due', label: 'Due date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: S.PROJECT_STATUS },
        { name: 'color', label: 'Color', type: 'select', options: S.PROJECT_COLORS },
        { name: 'members', label: 'Members', type: 'chips', options: UI.opts.users(), span: 2 },
        { name: 'description', label: 'Goal / description', type: 'textarea', rows: 2, span: 2 },
        ...(existing ? [{ name: 'archived', type: 'checkbox', span: 2, checkLabel: 'Archive this project (tasks are kept)' }] : []),
      ],
      onSubmit: (d) => {
        const { template, members, adopt, ...rest } = d;
        if (existing) {
          S.update('projects', existing.id, { ...rest, memberIds: members });
          UI.toast(d.archived ? 'Project archived' : 'Project updated', 'success');
          if (d.archived) location.hash = '#/tasks/projects';
          return;
        }
        const sections = S.PROJECT_TEMPLATES[template || 'blank'].sections.map((name) => ({ id: U.uid('sec'), name }));
        const p = S.upsert('projects', { ...rest, memberIds: members, sections, view: 'list', archived: false });
        if (adopt) loose().forEach((t, i) => S.update('tasks', t.id, { projectId: p.id, sectionId: sections[0].id, order: i }, { silent: true }));
        UI.toast(`${p.name} created`, 'success');
        location.hash = `#/tasks/project/${p.id}`;
      },
      onDelete: existing ? async () => {
        const tasks = S.all('tasks').filter((t) => t.projectId === existing.id);
        S.remove('projects', existing.id);
        tasks.forEach((t) => S.update('tasks', t.id, { projectId: '', sectionId: '' }, { silent: true }));
        App.rerender();
        UI.toast(`Project deleted. ${U.plural(tasks.length, 'task')} kept in My tasks.`);
        location.hash = '#/tasks/projects';
      } : null,
      deleteConfirm: 'Delete this project? Its tasks are kept (without a project).',
    });
  }

  async function sectionMenu(ds, el) {
    const p = S.get('projects', ds.p);
    const sections = Work.sectionsOf(p);
    const i = sections.findIndex((s) => s.id === ds.s);
    const s = sections[i];
    const save = (next) => S.update('projects', p.id, { sections: next });
    UI.menu(el, [
      { label: 'Rename section', icon: 'edit', onClick: async () => { const n = await UI.prompt('Rename section', { label: 'Name', value: s.name }); if (n) save(sections.map((x) => (x.id === s.id ? { ...x, name: n } : x))); } },
      ...(i > 0 ? [{ label: 'Move left / up', icon: 'chevronLeft', onClick: () => { const n = [...sections]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; save(n); } }] : []),
      ...(i < sections.length - 1 ? [{ label: 'Move right / down', icon: 'chevronRight', onClick: () => { const n = [...sections]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; save(n); } }] : []),
      '-',
      ...(sections.length > 1 ? [{
        label: 'Delete section', icon: 'trash', danger: true, onClick: async () => {
          const target = sections[i === 0 ? 1 : 0];
          if (!(await UI.confirm(`Delete "${s.name}"? Its tasks move to "${target.name}".`))) return;
          S.all('tasks').filter((t) => t.projectId === p.id && t.sectionId === s.id).forEach((t) => S.update('tasks', t.id, { sectionId: target.id }, { silent: true }));
          save(sections.filter((x) => x.id !== s.id));
        },
      }] : []),
    ]);
  }

  return {
    render,
    showMeeting(id) { Object.assign(state, { meeting: id, owner: 'all', kind: '', view: 'open', project: '' }); location.hash = '#/tasks'; },
    actions: {
      setTaskView: (ds) => { state.view = ds.v; App.rerender(); },
      setMyView: (ds) => { state.myView = ds.v; App.rerender(); },
      calNav: (ds) => {
        const d = Number(ds.d);
        state.calMonth = d === 0 ? U.today().slice(0, 7) : keyOf(new Date(monthOf(state.calMonth || U.today().slice(0, 7)).setMonth(monthOf(state.calMonth || U.today().slice(0, 7)).getMonth() + d)));
        App.rerender();
      },
      calAdd: async (ds) => {
        const title = await UI.prompt(`New task due ${U.fmtDate(ds.day)}`, { label: 'Task name', okText: 'Add task' });
        if (!title) return;
        const pid = calDefaults.projectId || '';
        const p = S.get('projects', pid);
        const t = newTaskIn(pid, p ? Work.sectionsOf(p)[0]?.id || '' : '', title, 0, { due: ds.day, ownerId: calDefaults.ownerId || '' });
        UI.toast('Task added', 'success', { actionLabel: 'Open', onAction: () => TaskDrawer.open(t.id) });
      },
      toggleSection: (ds) => { collapsed[ds.k] = !collapsed[ds.k]; App.rerender(); },
      projAddTop: async (ds) => {
        const p = S.get('projects', ds.id);
        const sec = Work.sectionsOf(p)[0];
        const title = await UI.prompt('New task', { label: `Task name (goes to “${sec?.name || 'the project'}”)`, okText: 'Add task' });
        if (!title) return;
        S.all('tasks').filter((t) => t.projectId === p.id && t.sectionId === sec?.id).forEach((t) => S.update('tasks', t.id, { order: (t.order ?? 0) + 1 }, { silent: true }));
        const t = newTaskIn(p.id, sec?.id || '', title, 0);
        TaskDrawer.open(t.id);
      },
      clearMeetingFilter: () => { state.meeting = ''; App.rerender(); },
      newProject: () => editProject({}),
      editProject,
      projView: (ds) => { projectView[ds.id] = ds.v; if (Cloud.canWrite) S.update('projects', ds.id, { view: ds.v }, { silent: true }); App.rerender(); },
      addSection: async (ds) => {
        const p = S.get('projects', ds.id);
        const n = await UI.prompt('New section', { label: 'Section name', okText: 'Add section' });
        if (n) S.update('projects', p.id, { sections: [...Work.sectionsOf(p), { id: U.uid('sec'), name: n }] });
      },
      sectionMenu,
      emailProject: (ds) => {
        const p = S.get('projects', ds.id);
        const tasks = S.all('tasks').filter((t) => t.projectId === p.id && !t.parentId);
        const pr = Work.progress(p);
        const body = `Hello team,\n\nUpdate on ${p.name} (${p.status || 'On track'}): ${pr.done}/${pr.total} tasks done.\n\n${Work.sectionsOf(p).map((s) => {
          const items = tasks.filter((t) => t.sectionId === s.id && t.status !== 'done');
          return items.length ? `${s.name}:\n${items.map((t) => `- ${t.title}${t.ownerId ? ` (${S.nameOf(t.ownerId)})` : ''}${t.due ? ` · due ${U.fmtDate(t.due)}` : ''}`).join('\n')}` : '';
        }).filter(Boolean).join('\n\n')}\n\nOpen the project: ${Mailer.APP_URL}#/tasks/project/${p.id}\n\n${S.currentUser()?.name || ''}`;
        const to = [p.ownerId, ...(p.memberIds || [])].map(Work.emailOf).filter(Boolean).join(', ');
        Mailer.deliver({ to, subject: `Update · ${p.name}`, body });
      },
    },
  };
})();
