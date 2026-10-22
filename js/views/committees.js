/* Board → Committees: one page per committee with its purpose, members, main guide (a document with
   clickable checklists), other documents, meetings and the tasks it owns. Documents live in `docs`. */
const Committees = (() => {
  const S = Store;
  const esc = U.esc;
  const info = (name) => (S.settings.committeeInfo || {})[name] || {};
  const membersOf = (name) => S.boardMembers({ includeAdvisors: true }).filter((c) => (c.board?.committees || []).includes(name));
  const docsOf = (name) => U.sortBy(S.all('docs').filter((d) => d.committee === name), (d) => `${d.main ? 0 : 1}${d.title}`);
  const mainDoc = (name) => docsOf(name).find((d) => d.main) || null;
  const tasksOf = (name) => S.all('tasks').filter((t) => t.committee === name && !t.parentId);
  const meetingsOf = (name) => U.sortBy(S.all('meetings').filter((m) => m.committee === name), 'date', -1);
  const href = (name) => `#/board/committees/${encodeURIComponent(name)}`;

  function list(root, tabs, head) {
    const names = S.settings.committees || [];
    root.innerHTML = `
      ${head('Committees: who owns each area, its guide, documents and tasks')}
      ${tabs}
      <div class="row" style="margin-bottom:12px;gap:8px">${Cloud.canWrite ? `<button class="btn" data-act="newCommittee">${UI.icon('plus')}New committee</button>` : ''}<a class="small" href="#/settings">Rename or remove committees in Settings</a></div>
      ${names.length ? `<div class="members">${names.map((n) => {
        const mem = membersOf(n);
        const open = tasksOf(n).filter((t) => t.status !== 'done');
        const doc = mainDoc(n);
        const pr = doc ? Md.progress(doc.body) : null;
        return `<a class="card member committee-card" href="${href(n)}">
          <div class="member-top"><span class="acc-ic">${UI.icon('landmark')}</span><div><b>${esc(n)}</b><small>${esc(info(n).purpose || 'No purpose written yet')}</small></div></div>
          <div class="owners">${UI.ownersHtml(mem.map((c) => c.id))}${mem.length ? '' : '<span class="small muted">No members yet</span>'}</div>
          ${doc ? `<div class="term">📘 ${esc(doc.title)}${pr.total ? `<div class="term-track"><div class="term-fill" style="width:${Math.round((pr.done / pr.total) * 100)}%"></div></div><small class="muted">${pr.done}/${pr.total} checklist items</small>` : ''}</div>` : ''}
          <div class="small muted">${U.plural(docsOf(n).length, 'document')} · ${U.plural(open.length, 'open task')}</div>
        </a>`;
      }).join('')}</div>` : `<div class="card">${UI.empty('landmark', 'No committees yet', 'Add committees in Settings or here.')}</div>`}`;
  }

  function taskLine(t) {
    const done = t.status === 'done';
    return `<div class="task-row ${done ? 'done' : ''}">
      <button class="task-check" data-act="toggleTask" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Mark complete'}: ${esc(t.title)}">${UI.icon('check')}</button>
      <div class="li-main" data-act="editTask" data-id="${t.id}" role="button" tabindex="0"><b>${esc(t.title)}</b><small>${esc(S.nameOf(t.ownerId) || 'Unassigned')}</small></div>
      <div class="li-side">${UI.dueLabel(t.due, done)}</div></div>`;
  }

  function detail(root, name, tabs) {
    if (!(S.settings.committees || []).includes(name) && !docsOf(name).length) { root.innerHTML = `<a class="back" href="#/board/committees">${UI.icon('chevronLeft')} Committees</a>${UI.empty('landmark', 'Committee not found')}`; return; }
    const mem = membersOf(name);
    const doc = mainDoc(name);
    const others = docsOf(name).filter((d) => d !== doc);
    const tasks = U.sortBy(tasksOf(name), (t) => `${t.status === 'done' ? 1 : 0}${t.due || '9999'}`);
    const open = tasks.filter((t) => t.status !== 'done');
    const byOwner = {};
    open.forEach((t) => { const k = S.nameOf(t.ownerId) || 'Unassigned'; byOwner[k] = (byOwner[k] || 0) + 1; });
    const pr = doc ? Md.progress(doc.body) : null;
    const ro = !Cloud.canWrite;
    root.innerHTML = `
      <a class="back" href="#/board/committees">${UI.icon('chevronLeft')} Committees</a>
      <div class="page-head"><div><h1>${esc(name)}</h1><div class="page-sub">${esc(info(name).purpose || 'What does this committee own? Add a purpose.')}</div></div>
        <div class="actions">${ro ? '' : `<button class="btn" data-act="editCommittee" data-name="${esc(name)}">${UI.icon('edit')}<span class="hide-sm">Purpose & members</span></button>
          <button class="btn" data-act="newDoc" data-committee="${esc(name)}">${UI.icon('note')}<span class="hide-sm">New document</span></button>`}
          <button class="btn btn-primary" data-act="newMeeting" data-type="Committee">${UI.icon('calendar')}<span class="hide-sm">Committee meeting</span></button></div></div>
      ${tabs}
      <div class="grid grid-main">
        <div class="stack">
          ${doc ? `<div class="card guide-card">
            <div class="card-head"><h2>📘 ${esc(doc.title)}</h2><span class="sub">Main guide${pr.total ? ` · ${pr.done}/${pr.total} done` : ''}</span>
              <div class="right">${doc.source ? `<a class="btn btn-sm btn-ghost" href="${esc(doc.source)}" target="_blank" rel="noopener">${UI.icon('link')}Source</a>` : ''}<a class="btn btn-sm btn-ghost" href="#/board/docs/${doc.id}">Full page</a>${ro ? '' : `<button class="btn btn-sm" data-act="editDoc" data-id="${doc.id}">${UI.icon('edit')}Edit</button>`}</div></div>
            ${pr.total ? `<div class="guide-progress"><div class="term-track"><div class="term-fill" style="width:${Math.round((pr.done / pr.total) * 100)}%"></div></div></div>` : ''}
            <div class="card-body doc-body" data-doc="${doc.id}">${Md.render(doc.body, { checkable: true, readOnly: ro })}</div>
          </div>` : `<div class="card">${UI.empty('note', 'No main guide yet', 'Write or paste the document this committee works from: decisions, checklists, plans.', ro ? '' : `<button class="btn btn-primary" data-act="newDoc" data-committee="${esc(name)}" data-main="1">Add the main guide</button>`)}</div>`}
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h3>Tasks</h3><span class="sub">${open.length} open · ${tasks.length - open.length} done</span></div>
            ${Object.keys(byOwner).length ? `<div class="card-body" style="padding-bottom:0">${Object.entries(byOwner).map(([n, c]) => `<span class="kc-chip" style="margin:0 4px 4px 0">${esc(n)} · ${c}</span>`).join('')}</div>` : ''}
            <div class="card-body flush">${tasks.length ? tasks.slice(0, 30).map(taskLine).join('') : '<div class="empty-sm">Tasks linked to this committee show up here.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Members</h3></div><div class="card-body flush"><div class="list">${mem.length ? mem.map((c) => `<div class="list-item clickable" data-act="go" data-href="#/contacts/${c.id}">${UI.avatar(S.contactName(c), 'sm')}<div class="li-main"><b>${esc(S.contactName(c))}</b><small>${esc(c.title || c.board?.role || '')}</small></div></div>`).join('') : '<div class="empty-sm">No members yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Documents</h3>${ro ? '' : `<div class="right"><button class="btn btn-sm btn-ghost" data-act="newDoc" data-committee="${esc(name)}">${UI.icon('plus')}Add</button></div>`}</div>
            <div class="card-body flush"><div class="list">${[doc, ...others].filter(Boolean).map((d) => `<div class="list-item clickable" data-act="go" data-href="#/board/docs/${d.id}"><span aria-hidden="true">${d.main ? '📘' : '📄'}</span><div class="li-main"><b>${esc(d.title)}</b><small>${esc(U.fmtDate((d.updatedAt || '').slice(0, 10)))}</small></div></div>`).join('') || '<div class="empty-sm">No documents yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h3>Meetings</h3></div><div class="card-body flush"><div class="list">${meetingsOf(name).map((m) => `<div class="list-item clickable" data-act="go" data-href="#/board/meetings/${m.id}"><div class="li-main"><b>${esc(m.title)}</b><small>${esc(U.fmtDate(m.date))} · ${esc(m.status)}</small></div></div>`).join('') || '<div class="empty-sm">Meetings linked to this committee show up here.</div>'}</div></div></div>
        </div>
      </div>`;
    wireChecks(root);
  }

  function doc(root, id, tabs) {
    const d = S.get('docs', id);
    if (!d) { root.innerHTML = `<a class="back" href="#/board/committees">${UI.icon('chevronLeft')} Committees</a>${UI.empty('note', 'Document not found')}`; return; }
    const pr = Md.progress(d.body);
    const ro = !Cloud.canWrite;
    root.innerHTML = `
      <a class="back" href="${d.committee ? href(d.committee) : '#/board/committees'}">${UI.icon('chevronLeft')} ${esc(d.committee || 'Committees')}</a>
      <div class="page-head"><div><h1>${d.main ? '📘 ' : ''}${esc(d.title)}</h1><div class="page-sub">${esc([d.committee, d.main ? 'Main guide' : '', d.author, `updated ${U.fmtDate((d.updatedAt || '').slice(0, 10))}`].filter(Boolean).join(' · '))}${pr.total ? ` · ${pr.done}/${pr.total} checklist items done` : ''}</div></div>
        <div class="actions">${d.source ? `<a class="btn" href="${esc(d.source)}" target="_blank" rel="noopener">${UI.icon('link')}<span class="hide-sm">Source</span></a>` : ''}<button class="btn" data-act="printDoc" data-id="${d.id}">${UI.icon('printer')}<span class="hide-sm">Print</span></button>${ro ? '' : `<button class="btn btn-primary" data-act="editDoc" data-id="${d.id}">${UI.icon('edit')}Edit</button>`}</div></div>
      ${tabs}
      <div class="card doc-page"><div class="card-body doc-body" data-doc="${d.id}">${Md.render(d.body, { checkable: true, readOnly: ro })}</div></div>`;
    wireChecks(root);
  }

  function wireChecks(root) {
    root.onchange = (e) => {
      const n = e.target.dataset.mdLine;
      const box = e.target.closest('[data-doc]');
      if (n === undefined || !box) return;
      const d = S.get('docs', box.dataset.doc);
      if (d) S.update('docs', d.id, { body: Md.toggleLine(d.body, Number(n)) });
    };
  }

  function editDoc(id, preset = {}) {
    const d = id ? S.get('docs', id) : null;
    UI.formModal({
      title: d ? 'Edit document' : 'New document',
      size: 'lg',
      intro: 'Markdown works: # headings, - lists, - [ ] checklists (clickable), | tables |, **bold**, links.',
      values: d || { committee: preset.committee || '', main: !!preset.main, title: '', body: '' },
      fields: [
        { name: 'title', label: 'Title', required: true, span: 2 },
        { name: 'committee', label: 'Committee', type: 'select', options: S.settings.committees || [], empty: '— None —' },
        { name: 'main', label: 'Main guide', type: 'checkbox', checkLabel: 'Show it as the committee’s main guide' },
        { name: 'source', label: 'Source link', type: 'url', placeholder: 'https://…', span: 2 },
        { name: 'body', label: 'Content', type: 'textarea', rows: 18, span: 2 },
      ],
      onSubmit: (v) => {
        if (v.source && !/^https:\/\//i.test(v.source)) { UI.toast('Use an https:// link', 'error'); return false; }
        if (v.main && v.committee) S.all('docs').filter((x) => x.committee === v.committee && x.main && x.id !== d?.id).forEach((x) => S.update('docs', x.id, { main: false }, { silent: true }));
        const rec = S.upsert('docs', d ? { ...v, id: d.id } : { ...v, author: S.currentUser()?.name || '' });
        UI.toast(d ? 'Document saved' : 'Document added', 'success');
        if (!d) location.hash = `#/board/docs/${rec.id}`;
      },
      onDelete: d ? () => { S.remove('docs', d.id); location.hash = d.committee ? href(d.committee) : '#/board/committees'; } : null,
    });
  }

  function editCommittee(name) {
    const all = S.boardMembers({ includeAdvisors: true });
    UI.formModal({
      title: name,
      values: { purpose: info(name).purpose || '', members: membersOf(name).map((c) => c.id) },
      fields: [
        { name: 'purpose', label: 'Purpose', type: 'textarea', rows: 2, span: 2, placeholder: 'What this committee owns and decides' },
        { name: 'members', label: 'Members', type: 'chips', span: 2, options: all.map((c) => ({ value: c.id, label: S.contactName(c) })) },
      ],
      onSubmit: (v) => {
        S.setSettings({ committeeInfo: { ...(S.settings.committeeInfo || {}), [name]: { ...info(name), purpose: v.purpose } } });
        all.forEach((c) => {
          const has = (c.board?.committees || []).includes(name);
          const want = v.members.includes(c.id);
          if (has !== want) S.update('contacts', c.id, { board: { ...(c.board || {}), committees: want ? [...(c.board?.committees || []), name] : c.board.committees.filter((x) => x !== name) } });
        });
      },
    });
  }

  function printDoc(id) {
    const d = S.get('docs', id);
    if (!d) return;
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Allow pop-ups to print', 'error'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:820px;margin:32px auto;padding:0 20px;color:#111}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}h2,h3{margin-top:24px}ul.md-checks{list-style:none;padding-left:4px}</style></head><body><h1>${esc(d.title)}</h1>${Md.render(d.body)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return {
    list, detail, doc, mainDoc,
    actions: {
      newDoc: (ds) => editDoc(null, { committee: ds.committee, main: ds.main === '1' }),
      editDoc: (ds) => editDoc(ds.id),
      editCommittee: (ds) => editCommittee(ds.name),
      printDoc: (ds) => printDoc(ds.id),
      newCommittee: async () => {
        const n = await UI.prompt('New committee', { label: 'Name', okText: 'Create' });
        if (!n) return;
        const name = n.trim().slice(0, 60);
        if ((S.settings.committees || []).includes(name)) { UI.toast('That committee already exists', 'error'); return; }
        S.setSettings({ committees: [...(S.settings.committees || []), name] });
        location.hash = href(name);
      },
    },
  };
})();
