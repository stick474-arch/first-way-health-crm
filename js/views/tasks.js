/* Tasks & follow-ups — one list for client follow-ups, board action items and internal to-dos. */
Views.tasks = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { view: 'open', owner: 'me', kind: '', meeting: '' };

  function groups(tasks) {
    const g = { overdue: [], today: [], week: [], later: [], none: [] };
    for (const t of tasks) {
      if (!t.due) { g.none.push(t); continue; }
      const n = U.daysFromToday(t.due);
      if (n < 0) g.overdue.push(t); else if (n === 0) g.today.push(t); else if (n <= 7) g.week.push(t); else g.later.push(t);
    }
    return g;
  }

  function render(root) {
    const me = S.currentUser()?.id;
    if (state.meeting && !S.get('meetings', state.meeting)) state.meeting = '';
    const meeting = S.get('meetings', state.meeting);
    const base = S.all('tasks').filter((t) => (!state.kind || t.kind === state.kind)
      && (!state.meeting || t.meetingId === state.meeting)
      && (state.owner === 'all' || (state.owner === 'me' ? t.ownerId === me : t.ownerId === state.owner)));
    const open = U.sortBy(base.filter((t) => t.status !== 'done'), (t) => `${t.due || '9999'}${t.priority === 'High' ? 0 : t.priority === 'Low' ? 2 : 1}`);
    const done = U.sortBy(base.filter((t) => t.status === 'done'), (t) => t.doneAt || '', -1);
    const g = groups(open);
    const ownerOpts = [{ value: 'me', label: 'My tasks' }, { value: 'all', label: 'Everyone' }, ...UI.opts.owners().filter((o) => o.value !== me)];
    const meetingsWithTasks = U.sortBy(S.all('meetings').filter((m) => S.all('tasks').some((t) => t.meetingId === m.id)), 'date', -1)
      .map((m) => ({ value: m.id, label: `${m.title} · ${U.fmtDate(m.date)}` }));
    const section = (key, label, items, cls = '') => (items.length ? `<div class="task-group"><h3 class="${cls}">${esc(label)} <span class="nav-count">${items.length}</span></h3><div class="card">${items.map(Parts.taskRow).join('')}</div></div>` : '');

    root.innerHTML = `
      ${Parts.pageHead('Tasks & follow-ups', 'Client follow-ups, board action items and to-dos, all with an owner and a date',
        `<button class="btn btn-primary" data-act="newTask" ${meeting ? `data-meeting="${meeting.id}" data-kind="Board action"` : ''}>${UI.icon('plus')}${meeting ? 'New action item' : 'New task'}</button>`)}
      ${meeting ? `<div class="banner info">${UI.icon('landmark')}<div>Showing the action items of <b><a href="#/board/meetings/${meeting.id}">${esc(meeting.title)}</a></b> (${esc(U.fmtDateLong(meeting.date))}). <a href="#" data-act="clearMeetingFilter">Show all tasks</a></div></div>` : ''}
      <div class="row wrap">
        <div class="segmented" role="tablist">
          <button class="seg ${state.view === 'open' ? 'active' : ''}" data-act="setTaskView" data-v="open">Open <span class="count">${open.length}</span></button>
          <button class="seg ${state.view === 'done' ? 'active' : ''}" data-act="setTaskView" data-v="done">Completed <span class="count">${done.length}</span></button>
        </div>
        <select class="select" data-filter="owner" aria-label="Owner">${UI.selectOptions(ownerOpts, state.owner)}</select>
        <select class="select" data-filter="kind" aria-label="Kind">${UI.selectOptions(S.TASK_KINDS, state.kind, 'All kinds')}</select>
        ${meetingsWithTasks.length ? `<select class="select" data-filter="meeting" aria-label="Meeting">${UI.selectOptions(meetingsWithTasks, state.meeting, 'Any meeting')}</select>` : ''}
      </div>
      <div id="tlist">
        ${state.view === 'open'
          ? (open.length
            ? section('overdue', 'Overdue', g.overdue, 'over') + section('today', 'Today', g.today) + section('week', 'Next 7 days', g.week) + section('later', 'Later', g.later) + section('none', 'No due date', g.none)
            : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', state.owner === 'me' ? 'You are all caught up' : 'No open tasks', state.owner === 'me' && S.all('tasks').some((t) => t.status !== 'done') ? 'Others have open tasks: choose “Everyone” to see them.' : 'Tip: log an interaction and add a follow-up in the same step, so every relationship has a next step.', '<button class="btn btn-primary" data-act="newTask">Add a task</button>')}</div>`)
          : (done.length ? `<div class="card" style="margin-top:16px">${done.slice(0, 200).map(Parts.taskRow).join('')}</div>` : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', 'Nothing completed yet')}</div>`)}
      </div>`;
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; render(root); } };
  }

  return {
    render,
    // Open the list scoped to one meeting (used by the meeting page)
    showMeeting(id) { Object.assign(state, { meeting: id, owner: 'all', kind: '', view: 'open' }); location.hash = '#/tasks'; },
    actions: {
      setTaskView: (ds) => { state.view = ds.v; App.rerender(); },
      clearMeetingFilter: () => { state.meeting = ''; App.rerender(); },
    },
  };
})();
