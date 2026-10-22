/* Aetherium — task panel (Asana-style): opens on the right, every change saves as you go. */
const TaskDrawer = (() => {
  const S = Store;
  const esc = U.esc;
  let el = null;
  let taskId = '';
  let lastFocus = null;

  const sel = (name, options, value, empty, label) => `<select class="input" data-f="${name}" aria-label="${esc(label)}">${UI.selectOptions(options, value, empty)}</select>`;

  function html(t) {
    const done = t.status === 'done';
    const project = Work.projectOf(t);
    const parent = S.get('tasks', t.parentId);
    const subs = Work.subtasksOf(t.id);
    const ro = !Cloud.canWrite;
    const followers = t.followerIds || [];
    return `
      <header class="drawer-head">
        <button type="button" class="btn btn-sm ${done ? 'btn-primary' : ''}" data-d="complete" aria-pressed="${done}">${UI.icon('check')}${done ? 'Completed' : 'Mark complete'}</button>
        <span class="spacer"></span>
        <button type="button" class="icon-btn sm" data-d="email" aria-label="Email the assignee" title="Email the assignee">${UI.icon('mail')}</button>
        ${ro ? '' : `<button type="button" class="icon-btn sm" data-d="delete" aria-label="Delete task" title="Delete task">${UI.icon('trash')}</button>`}
        <button type="button" class="icon-btn sm" data-d="close" aria-label="Close task panel" title="Close (Esc)">${UI.icon('x')}</button>
      </header>
      <div class="drawer-body">
        ${parent ? `<button type="button" class="drawer-parent" data-d="open" data-id="${parent.id}">${UI.icon('chevronLeft', 'ic-sm')}Subtask of <b>${esc(parent.title)}</b></button>` : ''}
        <label class="sr-only" for="drTitle">Task name</label>
        <textarea id="drTitle" class="drawer-title ${done ? 'is-done' : ''}" data-f="title" rows="1" ${ro ? 'readonly' : ''}>${esc(t.title)}</textarea>
        <dl class="drawer-fields">
          <dt>Assignee</dt><dd>${sel('ownerId', UI.opts.owners(), t.ownerId, '— Unassigned —', 'Assignee')}</dd>
          <dt>Due date</dt><dd><input type="date" class="input" data-f="due" value="${esc(t.due || '')}" aria-label="Due date"></dd>
          <dt>Start date</dt><dd><input type="date" class="input" data-f="startDate" value="${esc(t.startDate || '')}" aria-label="Start date"></dd>
          <dt>Project</dt><dd class="row" style="gap:6px">${sel('projectId', S.all('projects').filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })), t.projectId, '— No project —', 'Project')}
            ${project ? sel('sectionId', Work.sectionsOf(project).map((s) => ({ value: s.id, label: s.name })), t.sectionId, undefined, 'Section') : ''}</dd>
          <dt>Priority</dt><dd>${sel('priority', S.TASK_PRIORITIES, t.priority || 'Normal', undefined, 'Priority')}</dd>
          <dt>Type</dt><dd>${sel('kind', S.TASK_KINDS, t.kind || 'To-do', undefined, 'Type')}</dd>
          <dt>Tags</dt><dd><div class="chips-input">${UI.opts.tags().map((o) => `<label class="chip-check b-${o.color || 'slate'}"><input type="checkbox" data-tag="${esc(o.value)}" ${(t.tags || []).includes(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('') || '<span class="muted small">Create tags in Settings.</span>'}</div></dd>
          <dt>Collaborators</dt><dd><div class="chips-input">${UI.opts.owners().filter((o) => o.value !== t.ownerId).map((o) => `<label class="chip-check"><input type="checkbox" data-follower="${esc(o.value)}" ${followers.includes(o.value) ? 'checked' : ''}><span>${esc(o.label.split(' ')[0])}</span></label>`).join('')}</div></dd>
        </dl>
        <details class="drawer-links" ${t.contactId || t.orgId || t.dealId || t.meetingId ? 'open' : ''}><summary>Linked to</summary>
          <dl class="drawer-fields">
            <dt>Person</dt><dd>${sel('contactId', UI.opts.contacts(), t.contactId, '— None —', 'Linked person')}</dd>
            <dt>Organization</dt><dd>${sel('orgId', UI.opts.orgs(), t.orgId, '— None —', 'Linked organization')}</dd>
            <dt>Deal</dt><dd>${sel('dealId', UI.opts.deals(t.dealId), t.dealId, '— None —', 'Linked deal')}</dd>
            <dt>Meeting</dt><dd>${sel('meetingId', UI.opts.meetings(), t.meetingId, '— None —', 'Linked meeting')}${t.meetingId ? ` <a class="small" href="#/board/meetings/${t.meetingId}">Open</a>` : ''}</dd>
          </dl>
        </details>
        <label class="drawer-label" for="drNotes">Description</label>
        <textarea id="drNotes" class="input drawer-notes" data-f="notes" rows="4" placeholder="What is this task about? Links, context, definition of done…" ${ro ? 'readonly' : ''}>${esc(t.notes || '')}</textarea>
        <div class="drawer-label">Subtasks <span class="muted">${subs.filter((s) => s.status === 'done').length}/${subs.length}</span></div>
        <div class="drawer-subs">${subs.map((s) => `<div class="sub-row ${s.status === 'done' ? 'done' : ''}">
          <button type="button" class="task-check" data-d="subtoggle" data-id="${s.id}" aria-label="${s.status === 'done' ? 'Reopen' : 'Complete'} subtask">${UI.icon('check')}</button>
          <button type="button" class="sub-title" data-d="open" data-id="${s.id}">${esc(s.title)}</button>
          ${s.ownerId ? `<span title="${esc(S.nameOf(s.ownerId))}">${UI.avatar(S.nameOf(s.ownerId), 'sm')}</span>` : ''}${s.due ? UI.dueLabel(s.due, s.status === 'done') : ''}</div>`).join('')}
          ${ro ? '' : '<form class="sub-add" data-d="subform"><input class="input" name="sub" placeholder="Add a subtask and press Enter" aria-label="New subtask"></form>'}</div>
        <div class="drawer-label">Comments</div>
        <div class="drawer-comments" aria-live="polite">${(t.comments || []).map((c) => `<div class="cmt">${UI.avatar(c.name, 'sm')}<div><div class="cmt-head"><b>${esc(c.name)}</b><time>${esc(U.fmtDateTime(c.at))}</time></div><div class="cmt-body">${ChatUI.bodyHtml(c.body)}</div></div></div>`).join('') || '<div class="muted small">No comments yet.</div>'}</div>
        <form class="cmt-add" data-d="cmtform"><label class="sr-only" for="drComment">Write a comment</label><textarea id="drComment" class="input" name="c" rows="2" placeholder="Ask a question or post an update…"></textarea><button class="btn btn-sm btn-primary" type="submit">Comment</button></form>
        <p class="muted small" style="margin-top:14px">Created ${esc(U.fmtDate((t.createdAt || '').slice(0, 10)))}${t.createdBy ? ` by ${esc(S.nameOf(t.createdBy))}` : ''}${t.assignedBy ? ` · assigned by ${esc(S.nameOf(t.assignedBy))}` : ''}${done && t.completedBy ? ` · completed by ${esc(S.nameOf(t.completedBy))}` : ''}</p>
      </div>`;
  }

  function render() {
    const t = S.get('tasks', taskId);
    if (!t) { close(); return; }
    el.innerHTML = html(t);
    const title = el.querySelector('#drTitle');
    const grow = () => { title.style.height = 'auto'; title.style.height = `${title.scrollHeight}px`; };
    grow();
    title.addEventListener('input', grow);
    if (!Cloud.canWrite) el.querySelectorAll('select, input').forEach((x) => { if (!x.closest('.cmt-add')) x.disabled = true; });
  }

  function save(patch) {
    const t = S.get('tasks', taskId);
    if (!t || !Cloud.canWrite) return;
    const prevOwner = t.ownerId;
    S.update('tasks', t.id, patch);
    if ('ownerId' in patch) Work.assigned(S.get('tasks', t.id), prevOwner);
  }

  function onChange(e) {
    const x = e.target;
    const t = S.get('tasks', taskId);
    if (!t) return;
    if (x.dataset.f) {
      const f = x.dataset.f;
      let v = x.value;
      if (f === 'title') v = v.replace(/\s+/g, ' ').trim() || t.title;
      const patch = { [f]: v };
      if (f === 'projectId') patch.sectionId = Work.sectionsOf(S.get('projects', v))[0]?.id || '';
      if (f === 'contactId' && v && !t.orgId) patch.orgId = S.get('contacts', v)?.orgId || '';
      save(patch);
      if (f === 'projectId') render();
    } else if (x.dataset.tag !== undefined) {
      const tags = new Set(t.tags || []);
      if (x.checked) tags.add(x.dataset.tag); else tags.delete(x.dataset.tag);
      save({ tags: [...tags] });
    } else if (x.dataset.follower !== undefined) {
      const f = new Set(t.followerIds || []);
      if (x.checked) f.add(x.dataset.follower); else f.delete(x.dataset.follower);
      save({ followerIds: [...f] });
    }
  }

  async function onClick(e) {
    const b = e.target.closest('[data-d]');
    if (!b || b.tagName === 'FORM') return;
    const t = S.get('tasks', taskId);
    const d = b.dataset.d;
    if (d === 'close') close();
    else if (d === 'open') open(b.dataset.id);
    else if (d === 'complete') { Actions.toggleTask({ id: t.id }); render(); }
    else if (d === 'subtoggle') { Actions.toggleTask({ id: b.dataset.id }); render(); }
    else if (d === 'email') {
      const to = Work.emailOf(t.ownerId);
      Mailer.deliver({ to: to || '', subject: `Task: ${t.title}`, body: `Hi ${S.nameOf(t.ownerId).split(' ')[0] || ''},\n\n${Work.taskSummary(t)}\n\nOpen your tasks: ${Mailer.taskLink()}` });
    } else if (d === 'delete') {
      if (!(await UI.confirm(`Delete "${t.title}"${Work.subtasksOf(t.id).length ? ' and its subtasks' : ''}?`))) return;
      Work.subtasksOf(t.id).forEach((s) => S.remove('tasks', s.id));
      S.remove('tasks', t.id);
      UI.toast('Task deleted');
      close();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const t = S.get('tasks', taskId);
    if (f.dataset.d === 'subform') {
      const title = f.sub.value.trim();
      if (!title || !Cloud.canWrite) return;
      S.upsert('tasks', {
        title, parentId: t.id, projectId: t.projectId || '', sectionId: t.sectionId || '', ownerId: '', due: '', priority: 'Normal', kind: t.kind || 'To-do',
        status: 'open', doneAt: '', contactId: '', orgId: t.orgId || '', dealId: '', meetingId: t.meetingId || '', notes: '', createdBy: S.currentUser()?.id || '',
        order: Work.subtasksOf(t.id).length,
      });
      render();
      el.querySelector('.sub-add input')?.focus();
    } else if (f.dataset.d === 'cmtform') {
      const body = f.c.value.trim();
      if (!body) return;
      const me = S.currentUser();
      const c = { id: U.uid('cmt'), by: me?.id || '', name: me?.name || 'Someone', body, at: U.now() };
      S.update('tasks', t.id, { comments: [...(t.comments || []), c] });
      Work.commented(S.get('tasks', t.id), c);
      render();
      el.querySelector('#drComment')?.focus();
    }
  }

  function open(id) {
    if (!S.get('tasks', id)) return;
    if (!el) {
      el = document.createElement('aside');
      el.className = 'drawer';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Task details');
      document.body.appendChild(el);
      el.addEventListener('change', onChange);
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        if (e.key === 'Enter' && e.target.id === 'drTitle') { e.preventDefault(); e.target.blur(); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'drComment') { e.preventDefault(); e.target.form.requestSubmit(); }
      });
      Store.onChange(() => {
        if (!el.classList.contains('open')) return;
        if (el.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        render();
      });
    }
    if (!el.classList.contains('open')) lastFocus = document.activeElement;
    taskId = id;
    render();
    el.classList.add('open');
    document.body.classList.add('drawer-open');
    setTimeout(() => el.querySelector('#drTitle')?.focus({ preventScroll: true }), 30);
  }

  function close() {
    if (!el) return;
    el.classList.remove('open');
    document.body.classList.remove('drawer-open');
    taskId = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  return { open, close, get openId() { return taskId; } };
})();
