/* Aetherium — work management helpers (Asana-style): who "me" is, projects and sections,
   assignment and comment notifications by email, and the inbox. */
const Work = (() => {
  const S = Store;
  const lower = (s) => (s || '').toLowerCase();

  // A person can own tasks as a team member (user) and/or as a board member (contact)
  function myIds() {
    const u = S.currentUser();
    const email = lower(u?.email || Cloud.user?.email);
    const ids = new Set([u?.id].filter(Boolean));
    if (email) S.all('contacts').forEach((c) => { if (lower(c.email) === email) ids.add(c.id); });
    return ids;
  }
  const emailOf = (id) => S.get('users', id)?.email || S.get('contacts', id)?.email || '';
  const projectOf = (t) => S.get('projects', t.projectId);
  const sectionsOf = (p) => (p?.sections || []);
  const sectionName = (t) => sectionsOf(projectOf(t)).find((s) => s.id === t.sectionId)?.name || '';
  const subtasksOf = (id) => U.sortBy(S.all('tasks').filter((t) => t.parentId === id), (t) => `${t.status === 'done' ? 1 : 0}${String(t.order ?? 9999).padStart(6, '0')}${t.createdAt}`);
  const progress = (p) => {
    const list = S.all('tasks').filter((t) => t.projectId === p.id && !t.parentId);
    const done = list.filter((t) => t.status === 'done').length;
    return { total: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  };

  function taskSummary(t) {
    const p = projectOf(t);
    const lines = [
      `Task: ${t.title}`,
      t.due ? `Due: ${U.fmtDateLong(t.due)}` : '',
      p ? `Project: ${p.name}${sectionName(t) ? ` · ${sectionName(t)}` : ''}` : '',
      t.priority && t.priority !== 'Normal' ? `Priority: ${t.priority}` : '',
      t.meetingId ? `From: ${S.get('meetings', t.meetingId)?.title || ''}` : '',
      t.notes ? `\nDetails:\n${t.notes}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function notify(ids, subject, body, label) {
    const to = [...new Set(ids.filter((id) => !myIds().has(id)).map(emailOf).filter(Boolean))];
    if (!to.length) return;
    if (Mailer.configured()) {
      try {
        const r = await Mailer.send({ to: to.join(', '), subject, body });
        if (r.sent) UI.toast(`Emailed ${label}`, 'success');
      } catch (e) { UI.toast(`Email not sent: ${e.message}`, 'error'); }
    } else {
      UI.toast(`Let ${label} know by email?`, 'info', { actionLabel: 'Email', onAction: () => Mailer.compose({ to: to.join(', '), subject, body }), duration: 8000 });
    }
  }

  // Call after changing a task's owner
  function assigned(t, prevOwner) {
    if (!t.ownerId || t.ownerId === prevOwner) return;
    const me = S.currentUser();
    S.update('tasks', t.id, { assignedBy: me?.id || '', assignedAt: U.now() }, { silent: true });
    if (myIds().has(t.ownerId) || S.settings.notify?.assign === false) return;
    const name = S.nameOf(t.ownerId);
    notify([t.ownerId], `Assigned to you: ${t.title}`,
      `Hi ${name.split(' ')[0]},\n\n${me?.name || 'A teammate'} assigned you a task in ${S.settings.companyName || 'Aetherium'}.\n\n${taskSummary(t)}\n\nOpen your tasks: ${Mailer.taskLink()}`, name);
  }

  function commented(t, comment) {
    if (!S.settings.notify?.comment) return;
    const ids = [t.ownerId, ...(t.followerIds || [])].filter(Boolean);
    notify(ids, `New comment on: ${t.title}`,
      `${comment.name} commented on "${t.title}":\n\n${comment.body}\n\n${taskSummary(t)}\n\nOpen your tasks: ${Mailer.taskLink()}`, 'the people on this task');
  }

  // ---- Inbox: what happened to my work -----------------------------------------------------
  const SEEN_KEY = `${(window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm'}-inbox-seen`;
  function inbox() {
    const mine = myIds();
    const items = [];
    for (const t of S.all('tasks')) {
      const involved = mine.has(t.ownerId) || (t.followerIds || []).some((id) => mine.has(id)) || mine.has(t.createdBy);
      if (mine.has(t.ownerId) && t.assignedAt && t.assignedBy && !mine.has(t.assignedBy)) {
        items.push({ at: t.assignedAt, kind: 'assigned', task: t, who: S.nameOf(t.assignedBy) });
      }
      if (involved) {
        (t.comments || []).forEach((c) => { if (!mine.has(c.by)) items.push({ at: c.at, kind: 'comment', task: t, who: c.name, text: c.body }); });
        if (t.status === 'done' && t.completedBy && !mine.has(t.completedBy) && t.doneAt) items.push({ at: `${t.doneAt}T23:59`, kind: 'done', task: t, who: S.nameOf(t.completedBy) });
      }
      if (mine.has(t.ownerId) && t.status !== 'done' && t.due && U.daysFromToday(t.due) <= 1) {
        items.push({ at: `${t.due}T00:00`, kind: U.daysFromToday(t.due) < 0 ? 'overdue' : 'due', task: t });
      }
    }
    return U.sortBy(items, 'at', -1).slice(0, 100);
  }
  const seen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };
  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, U.now()); } catch { /* ignore */ } };
  const unseen = () => { const s = seen(); return inbox().filter((i) => i.kind !== 'due' && i.kind !== 'overdue' && i.at > s).length; };

  return { myIds, emailOf, projectOf, sectionsOf, sectionName, subtasksOf, progress, taskSummary, assigned, commented, inbox, markSeen, unseen, seen };
})();
