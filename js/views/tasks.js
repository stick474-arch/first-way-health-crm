/* Tasks — Asana-style work management: My tasks, Inbox, Projects (list and board views with
   sections and drag & drop). Every task opens in the side panel. */
Views.tasks = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { view: 'open', owner: 'me', kind: '', meeting: '', project: '', showDone: false };
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
        <select class="select" data-filter="owner" aria-label="Assignee">${UI.selectOptions(ownerOpts, state.owner)}</select>
        ${projectOpts.length ? `<select class="select" data-filter="project" aria-label="Project">${UI.selectOptions(projectOpts, state.project, 'Any project')}</select>` : ''}
        <select class="select" data-filter="kind" aria-label="Type">${UI.selectOptions(S.TASK_KINDS, state.kind, 'All types')}</select>
        ${meetingOpts.length ? `<select class="select" data-filter="meeting" aria-label="Meeting">${UI.selectOptions(meetingOpts, state.meeting, 'Any meeting')}</select>` : ''}
      </div>
      <div id="tlist">
        ${state.view === 'open'
          ? (open.length
            ? section('Recently assigned', recent) + section('Overdue', g.overdue, 'over') + section('Do today', g.today) + section('Do next week', g.week) + section('Do later', g.later) + section('No due date', g.none)
            : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', state.owner === 'me' ? 'You are all caught up' : 'No open tasks', state.owner === 'me' && S.all('tasks').some((t) => t.status !== 'done') ? 'Others have open tasks: choose “Everyone” to see them.' : 'Create a project to organise work in sections, or add a task.', '<button class="btn btn-primary" data-act="newTask">Add a task</button>')}</div>`)
          : (done.length ? `<div class="card" style="margin-top:16px">${done.slice(0, 200).map((t) => row(t)).join('')}</div>` : `<div class="card" style="margin-top:16px">${UI.empty('checkSquare', 'Nothing completed yet')}</div>`)}
      </div>`;
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; App.rerender(); } };
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

  function project(root, id) {
    const p = S.get('projects', id);
    if (!p) { root.innerHTML = `<a class="back" href="#/tasks/projects">${UI.icon('chevronLeft')} Projects</a>${UI.empty('kanban', 'Project not found')}`; return; }
    const view = projectView[id] || p.view || 'list';
    const sections = Work.sectionsOf(p);
    const all = S.all('tasks').filter((t) => t.projectId === id && !t.parentId);
    const inSection = (sid) => U.sortBy(all.filter((t) => (t.sectionId || sections[0]?.id) === sid && (state.showDone || t.status !== 'done')),
      (t) => `${t.status === 'done' ? 1 : 0}${String(t.order ?? 9999).padStart(6, '0')}${t.createdAt}`);
    const pr = Work.progress(p);
    const statusColor = { 'On track': 'green', 'At risk': 'amber', 'Off track': 'red', 'On hold': 'slate', Complete: 'blue' };
    const ro = !Cloud.canWrite;
    root.innerHTML = `
      <a class="back" href="#/tasks/projects">${UI.icon('chevronLeft')} Projects</a>
      <div class="page-head" style="margin-bottom:12px">
        <div><h1><span class="proj-dot b-${p.color || 'teal'}" aria-hidden="true"></span> ${esc(p.name)}</h1>
          <div class="page-sub">${UI.badge(p.status || 'On track', statusColor[p.status] || 'green')} ${pr.done}/${pr.total} done${p.due ? ` · due ${esc(U.fmtDate(p.due))}` : ''}${p.ownerId ? ` · owner ${esc(S.nameOf(p.ownerId))}` : ''}</div></div>
        <div class="actions">
          <div class="segmented" role="tablist" aria-label="View">
            <button class="seg ${view === 'list' ? 'active' : ''}" data-act="projView" data-id="${id}" data-v="list">${UI.icon('list', 'ic-sm')} List</button>
            <button class="seg ${view === 'board' ? 'active' : ''}" data-act="projView" data-id="${id}" data-v="board">${UI.icon('kanban', 'ic-sm')} Board</button>
          </div>
          <label class="check small"><input type="checkbox" id="showDone" ${state.showDone ? 'checked' : ''}> <span>Show completed</span></label>
          <button class="btn" data-act="emailProject" data-id="${id}">${UI.icon('mail')}<span class="hide-sm">Email update</span></button>
          ${ro ? '' : `<button class="btn" data-act="editProject" data-id="${id}">${UI.icon('edit')}<span class="hide-sm">Edit</span></button>`}
        </div>
      </div>
      ${p.description ? `<p class="muted" style="margin:0 0 14px">${esc(p.description)}</p>` : ''}
      ${view === 'board'
        ? `<div class="kanban">${sections.map((s) => `<section class="kcol" data-section="${s.id}" aria-label="${esc(s.name)}">
            <div class="kcol-head"><b>${esc(s.name)} <span>${inSection(s.id).length}</span></b>${ro ? '' : `<button class="icon-btn sm" data-act="sectionMenu" data-p="${id}" data-s="${s.id}" aria-label="Section options">${UI.icon('more')}</button>`}</div>
            <div class="kcol-body">${inSection(s.id).map(card).join('')}
              ${ro ? '' : `<form class="quick-add" data-section="${s.id}"><input class="input" name="t" placeholder="+ Add task" aria-label="Add a task to ${esc(s.name)}"></form>`}</div>
          </section>`).join('')}
          ${ro ? '' : `<button class="kcol add-col" data-act="addSection" data-id="${id}">${UI.icon('plus')} Add section</button>`}</div>`
        : `<div class="stack">${sections.map((s) => `<div class="card proj-section" data-section="${s.id}">
            <div class="card-head"><h3>${esc(s.name)}</h3><span class="sub">${inSection(s.id).length}</span>${ro ? '' : `<div class="right"><button class="icon-btn sm" data-act="sectionMenu" data-p="${id}" data-s="${s.id}" aria-label="Section options for ${esc(s.name)}">${UI.icon('more')}</button></div>`}</div>
            <div class="card-body flush">${inSection(s.id).map((t) => row(t, { showProject: false, draggable: !ro })).join('') || '<div class="empty-sm drop-hint">No tasks here. Drag one in or add one below.</div>'}
              ${ro ? '' : `<form class="quick-add" data-section="${s.id}"><input class="input" name="t" placeholder="+ Add task and press Enter" aria-label="Add a task to ${esc(s.name)}"></form>`}</div>
          </div>`).join('')}
          ${ro ? '' : `<button class="btn" data-act="addSection" data-id="${id}" style="align-self:flex-start">${UI.icon('plus')} Add section</button>`}</div>`}`;

    // quick add, drag & drop between sections, show completed
    root.onsubmit = (e) => {
      const f = e.target.closest('.quick-add');
      if (!f) return;
      e.preventDefault();
      const title = f.t.value.trim();
      if (!title) return;
      const sid = f.dataset.section;
      S.upsert('tasks', {
        title, projectId: id, sectionId: sid, ownerId: '', due: '', priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '',
        contactId: '', orgId: '', dealId: '', meetingId: '', notes: '', tags: [], followerIds: [], comments: [],
        createdBy: S.currentUser()?.id || '', order: all.filter((t) => t.sectionId === sid).length,
      });
      setTimeout(() => root.querySelector(`.quick-add[data-section="${sid}"] input`)?.focus(), 30);
    };
    root.onchange = (e) => { if (e.target.id === 'showDone') { state.showDone = e.target.checked; App.rerender(); } };
    root.querySelectorAll('[data-drag]').forEach((elx) => {
      elx.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', elx.dataset.drag); e.dataTransfer.effectAllowed = 'move'; elx.classList.add('dragging'); });
      elx.addEventListener('dragend', () => elx.classList.remove('dragging'));
    });
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

  function render(root, params) {
    const [tab, id] = params;
    if (tab === 'inbox') inbox(root);
    else if (tab === 'projects') projects(root);
    else if (tab === 'project' && id) project(root, id);
    else myTasks(root);
  }

  // ---- Project editing ---------------------------------------------------------------------
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
        { name: 'ownerId', label: 'Owner', type: 'select', options: UI.opts.users(), empty: '— None —' },
        { name: 'due', label: 'Due date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: S.PROJECT_STATUS },
        { name: 'color', label: 'Color', type: 'select', options: S.PROJECT_COLORS },
        { name: 'members', label: 'Members', type: 'chips', options: UI.opts.users(), span: 2 },
        { name: 'description', label: 'Goal / description', type: 'textarea', rows: 2, span: 2 },
        ...(existing ? [{ name: 'archived', type: 'checkbox', span: 2, checkLabel: 'Archive this project (tasks are kept)' }] : []),
      ],
      onSubmit: (d) => {
        const { template, members, ...rest } = d;
        if (existing) {
          S.update('projects', existing.id, { ...rest, memberIds: members });
          UI.toast(d.archived ? 'Project archived' : 'Project updated', 'success');
          if (d.archived) location.hash = '#/tasks/projects';
          return;
        }
        const sections = S.PROJECT_TEMPLATES[template || 'blank'].sections.map((name) => ({ id: U.uid('sec'), name }));
        const p = S.upsert('projects', { ...rest, memberIds: members, sections, view: 'list', archived: false });
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
