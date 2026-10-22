/* My notes — Google Keep style: quick notes and checklists in colored cards, pinned on top, labels,
   reminders, archive and trash, search, drag to reorder, share with a teammate, send to chat or tasks. */
Views.notes = (() => {
  const esc = U.esc;
  const state = { filter: 'notes', q: '', layout: 'grid' };
  try { state.layout = localStorage.getItem('fwh-notes-layout') || 'grid'; } catch { /* ignore */ }
  let editorId = '';

  const live = () => Notes.all().filter((n) => !n.trashedAt);
  const isEmpty = (n) => !n.title && !n.body && !(n.items || []).some((i) => i.text) && !n.image;
  const sorted = (arr) => U.sortBy(arr, (n) => `${String(n.order ?? 9999).padStart(6, '0')}${n.createdAt}`);
  const fmtRemind = (r) => { if (!r) return ''; const d = r.slice(0, 10); const t = r.slice(11, 16); return `${U.daysFromToday(d) === 0 ? 'Today' : U.daysFromToday(d) === 1 ? 'Tomorrow' : U.fmtDate(d)}${t ? `, ${t}` : ''}`; };
  const remindPast = (r) => r && r <= U.now();

  function visible() {
    const q = state.q.trim();
    const f = state.filter;
    let arr = f === 'trash' ? Notes.all().filter((n) => n.trashedAt) : live();
    if (f === 'notes') arr = arr.filter((n) => !n.archived);
    else if (f === 'archive') arr = arr.filter((n) => n.archived);
    else if (f === 'reminders') arr = arr.filter((n) => n.remind);
    else if (f === 'shared') arr = arr.filter((n) => n.sharedFrom || (n.sharedWith || []).length);
    else if (f.startsWith('label:')) arr = arr.filter((n) => (n.labels || []).includes(f.slice(6)));
    if (q) arr = (f === 'trash' ? arr : live()).filter((n) => U.matches(q, n.title, n.body, (n.items || []).map((i) => i.text), n.labels));
    return f === 'reminders' ? U.sortBy(arr, 'remind') : sorted(arr);
  }

  // ---- Card --------------------------------------------------------------------------------
  function card(n) {
    const items = n.items || [];
    const open = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done);
    const trash = !!n.trashedAt;
    return `<article class="keep-card nc-${n.color || 'default'}" data-note="${n.id}" ${trash ? '' : 'draggable="true"'}>
      <div class="kc-click" data-act="noteOpen" data-id="${n.id}" role="button" tabindex="0" aria-label="Open note ${esc(n.title || (n.body || '').slice(0, 40) || 'Untitled')}">
        ${n.image ? `<img class="kc-img" src="${esc(n.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
        ${n.title ? `<h4>${esc(n.title)}</h4>` : ''}
        ${n.kind === 'list'
          ? `<ul class="kc-list">${open.slice(0, 8).map((i) => `<li><label class="kc-check"><input type="checkbox" data-act="noteCheck" data-id="${n.id}" data-item="${i.id}" ${trash ? 'disabled' : ''}><span>${esc(i.text)}</span></label></li>`).join('')}
             ${open.length > 8 ? `<li class="muted small">… ${open.length - 8} more</li>` : ''}</ul>${done.length ? `<div class="kc-done small muted">+ ${U.plural(done.length, 'checked item')}</div>` : ''}`
          : (n.body ? `<div class="kc-body">${ChatUI.bodyHtml(n.body)}</div>` : '')}
        ${!n.title && isEmpty(n) ? '<div class="muted small">Empty note</div>' : ''}
      </div>
      <div class="kc-chips">
        ${n.remind ? `<button type="button" class="kc-chip ${remindPast(n.remind) ? 'past' : ''}" data-act="noteRemind" data-id="${n.id}" title="Reminder">⏰ ${esc(fmtRemind(n.remind))}</button>` : ''}
        ${(n.labels || []).map((l) => `<button type="button" class="kc-chip" data-act="noteFilter" data-f="label:${esc(l)}">${esc(l)}</button>`).join('')}
        ${n.sharedFrom ? `<span class="kc-chip" title="Shared with you by ${esc(n.sharedFrom)}">👤 ${esc(n.sharedFrom.split('@')[0])}</span>` : ''}
        ${(n.sharedWith || []).length && !n.sharedFrom ? `<span class="kc-chip" title="Shared with ${esc(n.sharedWith.join(', '))}">👥 ${n.sharedWith.length}</span>` : ''}
      </div>
      ${trash
        ? `<div class="kc-tools show"><button type="button" data-act="noteRestore" data-id="${n.id}" title="Restore">↩ Restore</button><button type="button" data-act="noteDestroy" data-id="${n.id}" title="Delete forever">${UI.icon('trash', 'ic-sm')} Delete forever</button></div>`
        : `<button type="button" class="kc-pin ${n.pinned ? 'on' : ''}" data-act="notePin" data-id="${n.id}" aria-pressed="${!!n.pinned}" aria-label="${n.pinned ? 'Unpin' : 'Pin'} note" title="${n.pinned ? 'Unpin' : 'Pin'}">📌</button>
        <div class="kc-tools" role="toolbar" aria-label="Note actions">
          <button type="button" data-act="noteRemind" data-id="${n.id}" aria-label="Remind me" title="Remind me">🔔</button>
          <button type="button" data-act="noteColor" data-id="${n.id}" aria-label="Background color" title="Background">🎨</button>
          <button type="button" data-act="noteArchive" data-id="${n.id}" aria-label="${n.archived ? 'Unarchive' : 'Archive'}" title="${n.archived ? 'Unarchive' : 'Archive'}">${n.archived ? '📤' : '🗄️'}</button>
          <button type="button" data-act="noteMore" data-id="${n.id}" aria-label="More" title="More">${UI.icon('more', 'ic-sm')}</button>
        </div>`}
    </article>`;
  }

  function sideHtml() {
    const labels = Notes.labels();
    const item = (f, icon, label, count = 0) => `<button type="button" class="keep-nav ${state.filter === f ? 'active' : ''}" data-act="noteFilter" data-f="${esc(f)}" ${state.filter === f ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><span>${esc(label)}</span>${count ? `<span class="nav-count ${f === 'reminders' ? 'hot' : ''}">${count}</span>` : ''}</button>`;
    return `${item('notes', '💡', 'Notes')}${item('reminders', '🔔', 'Reminders', Notes.dueCount())}
      ${Notes.mode === 'cloud' ? item('shared', '👥', 'Shared') : ''}
      ${labels.map((l) => item(`label:${l}`, '🏷️', l)).join('')}
      <button type="button" class="keep-nav" data-act="noteLabels"><span aria-hidden="true">✏️</span><span>Edit labels</span></button>
      ${item('archive', '🗄️', 'Archive')}${item('trash', '🗑️', 'Trash')}`;
  }

  function gridHtml() {
    const arr = visible();
    const f = state.filter;
    if (f === 'trash') {
      return `<div class="row" style="justify-content:center;margin-bottom:12px"><span class="muted small"><i>Notes in Trash are deleted after ${Notes.TRASH_DAYS} days.</i></span>${arr.length ? '<button class="btn btn-sm btn-ghost" data-act="noteEmptyTrash">Empty trash</button>' : ''}</div>
        ${arr.length ? `<div class="keep-grid ${state.layout === 'list' ? 'is-list' : ''}">${arr.map(card).join('')}</div>` : UI.empty('trash', 'No notes in Trash')}`;
    }
    if (!arr.length) {
      const msg = { notes: ['Notes you add appear here', 'Write ideas, checklists and reminders. They are private to you.'], reminders: ['Notes with upcoming reminders appear here', ''], archive: ['Your archived notes appear here', ''], shared: ['Notes shared with you appear here', ''] }[f] || ['No notes with this label yet', ''];
      return state.q ? UI.empty('search', 'No matching notes') : `<div class="keep-empty"><div class="keep-bulb">💡</div><h3>${esc(msg[0])}</h3><p class="muted">${esc(msg[1])}</p></div>`;
    }
    const pinned = arr.filter((n) => n.pinned && !n.archived);
    const others = arr.filter((n) => !(n.pinned && !n.archived));
    const grid = (list, id) => `<div class="keep-grid ${state.layout === 'list' ? 'is-list' : ''}" data-zone="${id}">${list.map(card).join('')}</div>`;
    return pinned.length && f !== 'reminders'
      ? `<div class="keep-sec">Pinned</div>${grid(pinned, 'pinned')}${others.length ? `<div class="keep-sec">Others</div>${grid(others, 'others')}` : ''}`
      : grid(arr, 'all');
  }

  function render(root) {
    const writeable = state.filter !== 'trash' && state.filter !== 'archive';
    root.innerHTML = `
      ${Parts.pageHead('My notes', Notes.mode === 'cloud' ? 'Private to you, synced to your account. Share a note with a teammate when you want to.' : 'Private to you, kept in this browser.',
        `<input class="input keep-search" type="search" id="noteQ" placeholder="Search notes" value="${esc(state.q)}" aria-label="Search notes">
         <button class="icon-btn" data-act="noteLayout" aria-label="${state.layout === 'grid' ? 'List view' : 'Grid view'}" title="${state.layout === 'grid' ? 'List view' : 'Grid view'}">${UI.icon(state.layout === 'grid' ? 'list' : 'kanban')}</button>`)}
      ${Notes.fallback ? `<div class="banner warn">${UI.icon('alert')}<div>Notes are saved <b>in this browser</b> until an admin runs <b>supabase/upgrade-02.sql</b> in Supabase. After that they sync to your account (still private).</div></div>` : ''}
      <div class="keep">
        <nav class="keep-side" aria-label="Notes sections">${sideHtml()}</nav>
        <div class="keep-main">
          ${writeable ? `<div class="keep-composer" role="group" aria-label="New note">
            <button type="button" class="keep-take" data-act="noteNew" data-kind="note">Take a note…</button>
            <button type="button" class="icon-btn" data-act="noteNew" data-kind="list" aria-label="New list" title="New list">${UI.icon('checkSquare')}</button>
            <button type="button" class="icon-btn" data-act="noteNew" data-kind="image" aria-label="New note with image" title="New note with image">🖼️</button>
          </div>` : ''}
          <div id="keepGrid">${gridHtml()}</div>
        </div>
      </div>`;
    root.oninput = (e) => { if (e.target.id === 'noteQ') { state.q = e.target.value; root.querySelector('#keepGrid').innerHTML = gridHtml(); wireDrag(root); } };
    wireDrag(root);
  }

  // Drag a card onto another to reorder (Keep-style)
  function wireDrag(root) {
    root.querySelectorAll('.keep-card[draggable="true"]').forEach((c) => {
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.note); c.classList.add('dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
      c.addEventListener('dragover', (e) => { e.preventDefault(); c.classList.add('drop'); });
      c.addEventListener('dragleave', () => c.classList.remove('drop'));
      c.addEventListener('drop', (e) => {
        e.preventDefault();
        c.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain');
        if (!id || id === c.dataset.note) return;
        const zone = c.closest('[data-zone]')?.dataset.zone;
        const arr = visible().filter((n) => n.id !== id);
        const at = arr.findIndex((n) => n.id === c.dataset.note);
        const moved = Notes.get(id);
        arr.splice(at, 0, moved);
        arr.forEach((n, i) => { if (n.order !== i) Notes.patch(n.id, { order: i }, { silent: true }); });
        if (zone === 'pinned' && !moved.pinned) Notes.patch(id, { pinned: true }, { silent: true });
        if (zone === 'others' && moved.pinned) Notes.patch(id, { pinned: false }, { silent: true });
        Notes.patch(id, {});
      });
    });
  }

  // ---- Editor (opens over the page, saves as you type) --------------------------------------
  function editorBody(n) {
    const items = n.items || [];
    const team = Store.all('users').filter((u) => u.email && u.email.toLowerCase() !== Notes.me());
    return `<div class="keep-editor nc-${n.color || 'default'}" data-editor="${n.id}">
      ${n.image ? `<div class="ke-img"><img src="${esc(n.image)}" alt="" referrerpolicy="no-referrer"><button type="button" class="icon-btn sm" data-ke="noimg" aria-label="Remove image">${UI.icon('x')}</button></div>` : ''}
      <input class="ke-title" data-k="title" placeholder="Title" value="${esc(n.title || '')}" aria-label="Title" ${n.sharedFrom ? '' : ''}>
      ${n.kind === 'list'
        ? `<ul class="ke-list">${items.filter((i) => !i.done).map((i) => itemRow(i)).join('')}
            <li class="ke-add">${UI.icon('plus', 'ic-sm')}<input data-ke-new placeholder="List item" aria-label="New list item"></li></ul>
           ${items.some((i) => i.done) ? `<details class="ke-donebox" open><summary>${U.plural(items.filter((i) => i.done).length, 'checked item')}</summary><ul class="ke-list">${items.filter((i) => i.done).map((i) => itemRow(i)).join('')}</ul></details>` : ''}`
        : `<textarea class="ke-body" data-k="body" placeholder="Take a note… (*bold*, - lists and links work)" aria-label="Note" rows="6">${esc(n.body || '')}</textarea>`}
      <div class="ke-meta">
        ${n.remind ? `<span class="kc-chip ${remindPast(n.remind) ? 'past' : ''}">⏰ ${esc(fmtRemind(n.remind))} <button type="button" data-ke="noremind" aria-label="Remove reminder">×</button></span>` : ''}
        ${(n.labels || []).map((l) => `<span class="kc-chip">${esc(l)} <button type="button" data-ke="unlabel" data-l="${esc(l)}" aria-label="Remove label ${esc(l)}">×</button></span>`).join('')}
        ${n.sharedFrom ? `<span class="kc-chip">👤 Shared by ${esc(n.sharedFrom)}</span>` : ''}
        <span class="spacer"></span><span class="small muted">Edited ${esc(U.fmtDateTime((n.updatedAt || U.now()).slice(0, 16)))}</span>
      </div>
      ${Notes.mode === 'cloud' && !n.sharedFrom && team.length ? `<details class="ke-share"><summary>👥 Collaborators${(n.sharedWith || []).length ? ` (${n.sharedWith.length})` : ''}</summary><div class="chips-input">${team.map((u) => `<label class="chip-check"><input type="checkbox" data-share="${esc(u.email.toLowerCase())}" ${(n.sharedWith || []).includes(u.email.toLowerCase()) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`).join('')}</div><small class="muted">They can read and edit this note. Nobody else can see it.</small></details>` : ''}
    </div>`;
  }
  const itemRow = (i) => `<li class="ke-item ${i.done ? 'done' : ''}" data-item="${i.id}"><input type="checkbox" data-ke-check ${i.done ? 'checked' : ''} aria-label="Done"><input class="ke-itext" data-ke-text value="${esc(i.text)}" aria-label="List item"><button type="button" class="icon-btn sm" data-ke="delitem" aria-label="Delete item">${UI.icon('x')}</button></li>`;

  function openEditor(id, { focus = 'title' } = {}) {
    const n = Notes.get(id);
    if (!n) return;
    editorId = id;
    const footer = `<div class="ke-tools">
        <button type="button" class="icon-btn" data-ke="remind" title="Remind me" aria-label="Remind me">🔔</button>
        <button type="button" class="icon-btn" data-ke="color" title="Background" aria-label="Background color">🎨</button>
        <button type="button" class="icon-btn" data-ke="image" title="Add image link" aria-label="Add image">🖼️</button>
        <button type="button" class="icon-btn" data-ke="label" title="Add label" aria-label="Add label">🏷️</button>
        <button type="button" class="icon-btn" data-ke="kind" title="${n.kind === 'list' ? 'Hide checkboxes' : 'Show checkboxes'}" aria-label="Toggle checklist">${UI.icon('checkSquare')}</button>
        <button type="button" class="icon-btn" data-ke="pin" title="${n.pinned ? 'Unpin' : 'Pin'}" aria-label="Pin">📌</button>
        <button type="button" class="icon-btn" data-ke="archive" title="${n.archived ? 'Unarchive' : 'Archive'}" aria-label="Archive">🗄️</button>
        <button type="button" class="icon-btn" data-ke="more" title="More" aria-label="More">${UI.icon('more')}</button>
      </div><span class="spacer"></span><button type="button" class="btn" data-close>Close</button>`;
    const m = UI.modal({ title: n.title || 'Note', body: editorBody(n), footer, size: 'md', dismissable: true, onClose: () => {
      const cur = Notes.get(id);
      editorId = '';
      if (cur && isEmpty(cur) && !cur.sharedFrom) { Notes.destroy(id); return; }
      App.rerender();
    } });
    m.el.classList.add('keep-modal');
    const el = m.el;
    const repaint = (focusSel) => {
      const cur = Notes.get(id);
      el.querySelector('.modal-body').innerHTML = editorBody(cur);
      paintColor(cur.color);
      if (focusSel) el.querySelector(focusSel)?.focus();
    };
    function paintColor(c) { [...el.classList].filter((k) => k.startsWith('nc-')).forEach((k) => el.classList.remove(k)); el.classList.add(`nc-${c || 'default'}`); }
    const itemsOf = () => [...(Notes.get(id).items || [])];
    el.addEventListener('input', (e) => {
      const x = e.target;
      if (x.dataset.k) Notes.patch(id, { [x.dataset.k]: x.value }, { silent: true });
      else if (x.dataset.keText !== undefined) {
        const iid = x.closest('[data-item]').dataset.item;
        Notes.patch(id, { items: itemsOf().map((i) => (i.id === iid ? { ...i, text: x.value } : i)) }, { silent: true });
      }
    });
    el.addEventListener('change', (e) => {
      const x = e.target;
      if (x.dataset.keCheck !== undefined) {
        const iid = x.closest('[data-item]').dataset.item;
        Notes.patch(id, { items: itemsOf().map((i) => (i.id === iid ? { ...i, done: x.checked } : i)) }, { silent: true });
        repaint();
      } else if (x.dataset.share !== undefined) {
        const set = new Set(Notes.get(id).sharedWith || []);
        if (x.checked) set.add(x.dataset.share); else set.delete(x.dataset.share);
        Notes.patch(id, { sharedWith: [...set] }, { silent: true });
      }
    });
    el.addEventListener('keydown', (e) => {
      const x = e.target;
      if (x.dataset.keNew !== undefined && e.key === 'Enter') {
        e.preventDefault();
        if (!x.value.trim()) return;
        Notes.patch(id, { items: [...itemsOf(), { id: U.uid('it'), text: x.value.trim(), done: false }] }, { silent: true });
        repaint('[data-ke-new]');
      } else if (x.dataset.keText !== undefined && e.key === 'Enter') {
        e.preventDefault();
        el.querySelector('[data-ke-new]')?.focus();
      } else if (x.dataset.keText !== undefined && e.key === 'Backspace' && !x.value) {
        e.preventDefault();
        const iid = x.closest('[data-item]').dataset.item;
        Notes.patch(id, { items: itemsOf().filter((i) => i.id !== iid) }, { silent: true });
        repaint('[data-ke-new]');
      } else if (x.classList.contains('ke-title') && e.key === 'Enter') {
        e.preventDefault();
        el.querySelector('.ke-body, [data-ke-new]')?.focus();
      }
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ke]');
      if (!b) return;
      const cur = Notes.get(id);
      const k = b.dataset.ke;
      if (k === 'delitem') { const iid = b.closest('[data-item]').dataset.item; Notes.patch(id, { items: itemsOf().filter((i) => i.id !== iid) }, { silent: true }); repaint(); }
      else if (k === 'noremind') { Notes.patch(id, { remind: '' }, { silent: true }); repaint(); }
      else if (k === 'unlabel') { Notes.patch(id, { labels: (cur.labels || []).filter((l) => l !== b.dataset.l) }, { silent: true }); repaint(); }
      else if (k === 'noimg') { Notes.patch(id, { image: '' }, { silent: true }); repaint(); }
      else if (k === 'kind') { toggleKind(id); repaint(); }
      else if (k === 'pin') { Notes.patch(id, { pinned: !cur.pinned, archived: false }, { silent: true }); UI.toast(cur.pinned ? 'Unpinned' : 'Pinned'); }
      else if (k === 'archive') { Notes.patch(id, { archived: !cur.archived, pinned: false }, { silent: true }); m.close(); UI.toast(cur.archived ? 'Note unarchived' : 'Note archived', 'info', { actionLabel: 'Undo', onAction: () => Notes.patch(id, { archived: cur.archived, pinned: cur.pinned }) }); }
      else if (k === 'color') colorPop(b, id, () => repaint());
      else if (k === 'remind') remindMenu(b, id, () => repaint());
      else if (k === 'label') { await addLabel(id); repaint(); }
      else if (k === 'image') { await addImage(id); repaint(); }
      else if (k === 'more') moreMenu(b, id, () => m.close());
    });
    paintColor(n.color);
    setTimeout(() => el.querySelector(focus === 'body' ? '.ke-body, [data-ke-new]' : '.ke-title')?.focus(), 30);
  }

  function toggleKind(id) {
    const n = Notes.get(id);
    if (n.kind === 'list') {
      Notes.patch(id, { kind: 'note', body: [n.body, ...(n.items || []).map((i) => i.text)].filter(Boolean).join('\n'), items: [] }, { silent: true });
    } else {
      const lines = (n.body || '').split('\n').map((l) => l.replace(/^\s*[-*•]\s+/, '').trim()).filter(Boolean);
      Notes.patch(id, { kind: 'list', items: lines.map((text) => ({ id: U.uid('it'), text, done: false })), body: '' }, { silent: true });
    }
  }

  // ---- Small pickers -----------------------------------------------------------------------
  function colorPop(anchor, id, after) {
    UI.menu(anchor, Notes.COLORS.map((c) => ({ label: c === 'default' ? 'Default' : c[0].toUpperCase() + c.slice(1), icon: '', onClick: () => { Notes.patch(id, { color: c }, { silent: !!after }); after?.(); } })));
    const menu = document.querySelector('.menu.popover');
    if (menu) {
      menu.classList.add('color-menu');
      menu.querySelectorAll('button[data-i]').forEach((b, i) => { b.classList.add(`nc-${Notes.COLORS[i]}`, 'swatch'); b.title = b.textContent.trim(); if (Notes.COLORS[i] === (Notes.get(id).color || 'default')) b.classList.add('on'); });
    }
  }
  function remindMenu(anchor, id, after) {
    const set = (v) => { Notes.patch(id, { remind: v }, { silent: !!after }); after?.(); if (v) UI.toast(`Reminder: ${fmtRemind(v)}`, 'success'); };
    const mon = U.addDays(U.today(), 8 - ((new Date().getDay() + 6) % 7) - 1);
    UI.menu(anchor, [
      { label: 'Later today (18:00)', icon: 'clock', onClick: () => set(`${U.today()}T18:00`) },
      { label: 'Tomorrow (08:00)', icon: 'clock', onClick: () => set(`${U.addDays(U.today(), 1)}T08:00`) },
      { label: 'Next week (Mon 08:00)', icon: 'calendar', onClick: () => set(`${mon}T08:00`) },
      { label: 'Pick date & time', icon: 'calendar', onClick: async () => { const v = await UI.prompt('Remind me', { label: 'Date and time', type: 'datetime-local', value: `${U.addDays(U.today(), 1)}T09:00`, okText: 'Save' }); if (v) set(v); } },
      ...(Notes.get(id).remind ? ['-', { label: 'Remove reminder', icon: 'x', onClick: () => set('') }] : []),
    ]);
  }
  async function addLabel(id) {
    const all = Notes.labels();
    const v = await UI.prompt('Label note', { label: 'Label (pick or type a new one)', value: '', okText: 'Add', type: 'text' });
    if (!v) return;
    const label = v.trim().slice(0, 40);
    if (!all.includes(label)) Notes.setLabels([...all, label]);
    const n = Notes.get(id);
    Notes.patch(id, { labels: [...new Set([...(n.labels || []), label])] }, { silent: true });
  }
  async function addImage(id) {
    const v = await UI.prompt('Image', { label: 'Image link (https://…)', type: 'url', okText: 'Add image' });
    if (!v) return;
    if (!/^https:\/\//i.test(v)) { UI.toast('Use an https:// link', 'error'); return; }
    Notes.patch(id, { image: v }, { silent: true });
  }
  function asText(n) {
    return [n.title ? `*${n.title}*` : '', n.kind === 'list' ? (n.items || []).map((i) => `- ${i.done ? '~' : ''}${i.text}${i.done ? '~' : ''}`).join('\n') : n.body].filter(Boolean).join('\n');
  }
  function moreMenu(anchor, id, closeEditor) {
    const n = Notes.get(id);
    UI.menu(anchor, [
      { label: 'Delete note', icon: 'trash', danger: true, onClick: () => {
        if (n.sharedFrom) { UI.toast('Only the owner can delete this note', 'info'); return; }
        Notes.patch(id, { trashedAt: U.now(), pinned: false });
        closeEditor?.();
        UI.toast('Note moved to Trash', 'info', { actionLabel: 'Undo', onAction: () => Notes.patch(id, { trashedAt: '' }) });
      } },
      { label: 'Make a copy', icon: 'note', onClick: () => { const { id: _x, sharedFrom, owner, sharedWith, ...rest } = n; Notes.save({ ...rest, title: n.title ? `${n.title} (copy)` : '', pinned: false, items: (n.items || []).map((i) => ({ ...i, id: U.uid('it') })) }); UI.toast('Copy created', 'success'); } },
      { label: n.kind === 'list' ? 'Hide checkboxes' : 'Show checkboxes', icon: 'checkSquare', onClick: () => { toggleKind(id); App.rerender(); } },
      { label: 'Add label', icon: 'tag', onClick: async () => { await addLabel(id); App.rerender(); } },
      '-',
      { label: 'Send to chat…', icon: 'message', onClick: async () => {
        const ch = await UI.prompt('Send note to chat', { label: 'Conversation', options: [...Chat.CHANNELS.map((c) => ({ value: c.id, label: `#${c.name}` })), ...Chat.people().map((p) => ({ value: p.channel, label: p.name }))], value: 'general', okText: 'Send' });
        if (!ch) return;
        if (await Chat.send(ch, `📝 ${asText(n)}`.slice(0, 4000))) UI.toast('Sent to chat', 'success', { actionLabel: 'Open', onAction: () => { location.hash = `#/chat/${encodeURIComponent(ch)}`; } });
      } },
      { label: 'Turn into a task', icon: 'checkSquare', onClick: () => {
        const me = Store.currentUser();
        const t = Store.upsert('tasks', { title: (n.title || (n.body || n.items?.[0]?.text || 'Note')).slice(0, 120), ownerId: me?.id || '', due: n.remind ? n.remind.slice(0, 10) : '', priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '', notes: asText(n).replace(/[*~]/g, ''), tags: [], followerIds: [], comments: [], createdBy: me?.id || '', projectId: '', sectionId: '' });
        closeEditor?.();
        TaskDrawer.open(t.id);
      } },
      { label: 'Copy text', icon: 'link', onClick: async () => { try { await navigator.clipboard.writeText(asText(n).replace(/[*~]/g, '')); UI.toast('Copied', 'success'); } catch { UI.toast('Copy is blocked in this browser', 'error'); } } },
    ]);
  }

  function editLabels() {
    const labels = Notes.labels();
    UI.formModal({
      title: 'Edit labels',
      size: 'sm',
      intro: 'One label per line. Rename a line to rename it on every note; remove a line to remove the label.',
      values: { list: labels.join('\n') },
      fields: [{ name: 'list', label: 'Labels', type: 'textarea', rows: 8 }],
      onSubmit: (d) => {
        const next = [...new Set(d.list.split('\n').map((s) => s.trim().slice(0, 40)).filter(Boolean))];
        const renamed = {};
        labels.forEach((l, i) => { if (!next.includes(l) && next[i] && !labels.includes(next[i])) renamed[l] = next[i]; });
        Notes.all().forEach((n) => {
          if (!(n.labels || []).length) return;
          const nl = [...new Set(n.labels.map((l) => renamed[l] || l).filter((l) => next.includes(l)))];
          if (nl.join() !== n.labels.join()) Notes.patch(n.id, { labels: nl }, { silent: true });
        });
        Notes.setLabels(next);
        if (state.filter.startsWith('label:') && !next.includes(state.filter.slice(6))) state.filter = 'notes';
      },
    });
  }

  Notes.onChange(() => { if (location.hash.startsWith('#/notes') && !editorId) App.rerender(); else App.refreshNav?.(); });

  return {
    render,
    get editorOpen() { return !!editorId; },
    actions: {
      noteNew: async (ds) => {
        const label = state.filter.startsWith('label:') ? [state.filter.slice(6)] : [];
        const n = Notes.save({ title: '', body: '', kind: ds.kind === 'list' ? 'list' : 'note', items: [], color: 'default', pinned: false, archived: false, trashedAt: '', labels: label, sharedWith: [], order: -1, image: '', remind: state.filter === 'reminders' ? `${U.addDays(U.today(), 1)}T08:00` : '' }, { silent: true });
        if (ds.kind === 'image') await addImage(n.id);
        openEditor(n.id, { focus: ds.kind === 'list' ? 'body' : 'title' });
      },
      noteOpen: (ds) => openEditor(ds.id),
      noteCheck: (ds) => { const n = Notes.get(ds.id); Notes.patch(ds.id, { items: (n.items || []).map((i) => (i.id === ds.item ? { ...i, done: !i.done } : i)) }); },
      notePin: (ds) => { const n = Notes.get(ds.id); Notes.patch(ds.id, { pinned: !n.pinned, archived: false }); },
      noteArchive: (ds) => {
        const n = Notes.get(ds.id);
        Notes.patch(ds.id, { archived: !n.archived, pinned: false });
        UI.toast(n.archived ? 'Note unarchived' : 'Note archived', 'info', { actionLabel: 'Undo', onAction: () => Notes.patch(ds.id, { archived: n.archived, pinned: n.pinned }) });
      },
      noteColor: (ds, el) => colorPop(el, ds.id),
      noteRemind: (ds, el) => remindMenu(el, ds.id),
      noteMore: (ds, el) => moreMenu(el, ds.id),
      noteRestore: (ds) => { Notes.patch(ds.id, { trashedAt: '' }); UI.toast('Note restored', 'success'); },
      noteDestroy: async (ds) => { if (await UI.confirm('Delete this note forever?', { okText: 'Delete forever' })) Notes.destroy(ds.id); },
      noteEmptyTrash: async () => {
        const trash = Notes.all().filter((n) => n.trashedAt && !n.sharedFrom);
        if (await UI.confirm(`Delete ${U.plural(trash.length, 'note')} forever?`, { okText: 'Empty trash' })) trash.forEach((n) => Notes.destroy(n.id));
      },
      noteFilter: (ds) => { state.filter = ds.f; state.q = ''; App.rerender(); },
      noteLayout: () => { state.layout = state.layout === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('fwh-notes-layout', state.layout); } catch { /* ignore */ } App.rerender(); },
      noteLabels: () => editLabels(),
    },
  };
})();
