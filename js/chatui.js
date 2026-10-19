/* Aetherium — chat UI kit shared by the Team chat page and the docked chat:
   message rendering, references to records ([[type:id|Label]]) and the @-autocomplete composer. */
const ChatUI = (() => {
  const S = Store;
  const esc = U.esc;
  const REF_RE = /\[\[(contact|org|deal|meeting|task|resolution):([A-Za-z0-9_-]{1,64})\|([^\]|\n]{1,80})\]\]/g;
  const TYPES = {
    contact: { icon: 'users', label: 'Person' },
    org: { icon: 'building', label: 'Organization' },
    deal: { icon: 'kanban', label: 'Deal' },
    meeting: { icon: 'landmark', label: 'Meeting' },
    task: { icon: 'checkSquare', label: 'Task' },
    resolution: { icon: 'gavel', label: 'Resolution' },
  };
  const COLL = { contact: 'contacts', org: 'organizations', deal: 'deals', meeting: 'meetings', task: 'tasks', resolution: 'resolutions' };

  const isDm = (ch) => ch.startsWith('dm:');
  const titleOf = (ch) => (isDm(ch) ? (Chat.people().find((p) => p.channel === ch)?.name || 'Direct message') : `#${ch}`);
  const hintOf = (ch) => (isDm(ch) ? 'Only the two of you can read this' : (Chat.CHANNELS.find((c) => c.id === ch)?.hint || ''));

  // Current display name of a referenced record (it may have been renamed or deleted)
  function refName(type, id) {
    const r = S.get(COLL[type], id);
    if (!r) return null;
    if (type === 'contact') return S.contactName(r);
    if (type === 'org' || type === 'deal') return r.name;
    if (type === 'resolution') return `${r.number} ${r.title}`;
    return r.title;
  }

  function refHtml(type, id, label) {
    const name = refName(type, id);
    const t = TYPES[type];
    if (!name) return `<span class="chat-ref missing" title="This ${t.label.toLowerCase()} no longer exists">${UI.icon(t.icon, 'ic-sm')}${esc(label)}</span>`;
    return `<a class="chat-ref ref-${type}" href="#" data-act="openRef" data-ref="${type}:${esc(id)}" title="Open ${esc(t.label.toLowerCase())}: ${esc(name)}">${UI.icon(t.icon, 'ic-sm')}<span>${esc(name)}</span></a>`;
  }

  // Message text → safe HTML with clickable references and links
  function bodyHtml(body) {
    let out = '';
    let last = 0;
    const linkify = (txt) => esc(txt).replace(/\bhttps:\/\/[^\s<]{3,300}/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
    String(body || '').replace(REF_RE, (m, type, id, label, at) => {
      out += linkify(body.slice(last, at)) + refHtml(type, id, label);
      last = at + m.length;
      return m;
    });
    return out + linkify(String(body || '').slice(last));
  }

  function logHtml(channel, { compact = false } = {}) {
    const list = Chat.messagesIn(channel);
    if (!list.length) {
      return `<div class="empty" style="margin:auto">${UI.icon('message')}<h3>No messages in ${esc(titleOf(channel))} yet</h3><p>${compact ? 'Write the first one below.' : 'Start the conversation below. Type @ to link a person, meeting, task or deal.'}</p></div>`;
    }
    let lastDay = '';
    let prev = null;
    return list.map((m) => {
      const d = new Date(m.created_at);
      const day = U.toDateStr(d);
      const sameRun = prev && prev.author_email === m.author_email && day === lastDay && (d - new Date(prev.created_at)) < 5 * 60000;
      const head = day !== lastDay ? `<div class="chat-day" role="separator"><span>${esc(U.daysFromToday(day) === 0 ? 'Today' : U.daysFromToday(day) === -1 ? 'Yesterday' : U.fmtDateLong(day))}</span></div>` : '';
      lastDay = day;
      prev = m;
      const mine = (m.author_email || '').toLowerCase() === Chat.me.email;
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const who = m.author_name || m.author_email;
      return `${head}<article class="msg ${sameRun ? 'cont' : ''}" aria-label="${esc(who)} at ${esc(time)}">
        ${sameRun ? `<span class="msg-gutter" aria-hidden="true">${esc(time)}</span>` : UI.avatar(who)}
        <div class="msg-main">
          ${sameRun ? '' : `<div class="msg-head"><b>${esc(who)}</b><time datetime="${esc(m.created_at)}">${esc(time)}</time></div>`}
          <div class="msg-body">${bodyHtml(m.body)}</div>
        </div>
        ${mine ? `<button class="icon-btn sm msg-del" data-act="deleteMsg" data-id="${esc(m.id)}" aria-label="Delete your message from ${esc(time)}" title="Delete">${UI.icon('trash')}</button>` : '<span></span>'}
      </article>`;
    }).join('');
  }

  // ---- Records you can tag ---------------------------------------------------------------
  function candidates(q) {
    const items = [];
    const push = (type, id, label, sub) => items.push({ type, id, label, sub });
    S.all('contacts').forEach((c) => push('contact', c.id, S.contactName(c), [c.board?.role && S.isBoardType(c.type) ? c.board.role : c.type, S.orgName(c.orgId)].filter(Boolean).join(' · ')));
    S.all('organizations').forEach((o) => push('org', o.id, o.name, o.type === 'Main' ? 'Our company' : o.type));
    S.all('meetings').forEach((m) => push('meeting', m.id, m.title, U.fmtDate(m.date)));
    S.all('tasks').filter((t) => t.status !== 'done').forEach((t) => push('task', t.id, t.title, [S.nameOf(t.ownerId), t.due ? `due ${U.relDays(t.due)}` : ''].filter(Boolean).join(' · ')));
    S.all('deals').forEach((d) => push('deal', d.id, d.name, S.stageInfo(d.stage).name));
    S.all('resolutions').forEach((r) => push('resolution', r.id, `${r.number} ${r.title}`, r.status));
    const query = (q || '').trim().toLowerCase();
    const order = ['contact', 'meeting', 'task', 'org', 'deal', 'resolution'];
    return items
      .filter((it) => !query || U.matches(query, it.label, it.sub))
      .map((it) => ({ ...it, rank: (it.label.toLowerCase().startsWith(query) ? 0 : 1) * 10 + order.indexOf(it.type) }))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .slice(0, 8);
  }

  // ---- Composer with @-autocomplete (textarea + listbox) --------------------------------
  let seq = 0;
  function attachComposer(form, { onSend, draftKey }) {
    const input = form.querySelector('textarea');
    const box = form.querySelector('.ref-list');
    const linkBtn = form.querySelector('[data-ref-open]');
    const id = `refl${++seq}`;
    box.id = id;
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', 'Link a record');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', id);
    input.setAttribute('aria-expanded', 'false');
    let refs = []; // { label, token }
    let results = [];
    let sel = 0;
    let at = -1;

    const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(140, input.scrollHeight)}px`; };
    const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); at = -1; };
    const paint = () => {
      if (!results.length) {
        box.innerHTML = '<div class="ref-empty" role="presentation">Nothing matches. Keep typing a name, meeting, task or deal.</div>';
      } else {
        box.innerHTML = results.map((r, i) => `<div class="ref-opt ${i === sel ? 'sel' : ''}" role="option" id="${id}-${i}" aria-selected="${i === sel}" data-i="${i}">
          ${UI.icon(TYPES[r.type].icon)}<span class="ref-txt"><b>${esc(r.label)}</b><small>${esc(TYPES[r.type].label)}${r.sub ? ` · ${esc(r.sub)}` : ''}</small></span></div>`).join('');
      }
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (results.length) input.setAttribute('aria-activedescendant', `${id}-${sel}`);
      const cur = box.querySelector('.sel');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    const detect = () => {
      const pos = input.selectionStart;
      const before = input.value.slice(0, pos);
      const i = before.lastIndexOf('@');
      if (i < 0 || (i > 0 && !/\s/.test(before[i - 1]))) return close();
      const q = before.slice(i + 1);
      if (q.length > 40 || /\n/.test(q)) return close();
      at = i;
      results = candidates(q);
      sel = 0;
      paint();
    };
    const pick = (r) => {
      if (!r || at < 0) return;
      const label = r.label.replace(/[[\]|\n]/g, ' ').trim().slice(0, 80);
      const end = input.selectionStart;
      input.value = `${input.value.slice(0, at)}@${label} ${input.value.slice(end)}`;
      const caret = at + label.length + 2;
      input.setSelectionRange(caret, caret);
      refs.push({ label, token: `[[${r.type}:${r.id}|${label}]]` });
      close();
      grow();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };

    input.addEventListener('input', () => { if (draftKey) ChatUI.drafts[draftKey()] = input.value; grow(); detect(); });
    input.addEventListener('click', detect);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (!box.hidden && results.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % results.length; paint(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + results.length) % results.length; paint(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(results[sel]); return; }
      }
      if (!box.hidden && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    box.addEventListener('mousedown', (e) => {
      const o = e.target.closest('[data-i]');
      if (o) { e.preventDefault(); pick(results[Number(o.dataset.i)]); }
    });
    if (linkBtn) {
      linkBtn.addEventListener('click', () => {
        const pos = input.selectionStart ?? input.value.length;
        const needsSpace = pos > 0 && !/\s/.test(input.value[pos - 1]);
        input.value = `${input.value.slice(0, pos)}${needsSpace ? ' ' : ''}@${input.value.slice(pos)}`;
        const caret = pos + (needsSpace ? 2 : 1);
        input.focus();
        input.setSelectionRange(caret, caret);
        detect();
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let text = input.value;
      if (!text.trim()) return;
      // turn the @Labels picked from the list into references
      [...refs].sort((a, b) => b.label.length - a.label.length).forEach((r) => { text = text.split(`@${r.label}`).join(r.token); });
      const original = input.value;
      input.value = '';
      grow();
      close();
      const ok = await onSend(text);
      if (!ok) { input.value = original; grow(); return; }
      refs = [];
      if (draftKey) ChatUI.drafts[draftKey()] = '';
      input.focus();
    });
    grow();
    return { input, focus: () => input.focus({ preventScroll: true }) };
  }

  const composerHtml = (channel, value = '') => `
    <form class="chat-compose" novalidate>
      <div class="ref-list" hidden></div>
      <button type="button" class="icon-btn" data-ref-open aria-label="Link a person, meeting, task or deal" title="Link a record (@)">${UI.icon('link')}</button>
      <textarea rows="1" aria-label="Message ${esc(titleOf(channel))}" placeholder="Message ${esc(titleOf(channel))} · @ to link a record">${esc(value)}</textarea>
      <button class="btn btn-primary" type="submit" aria-label="Send message">${UI.icon('arrowRight')}<span class="hide-sm">Send</span></button>
    </form>`;

  // Navigate to a referenced record (used by the chat page and the dock)
  function openRef(ref) {
    const [type, id] = String(ref || '').split(':');
    if (!COLL[type] || !S.get(COLL[type], id)) { UI.toast('That record no longer exists', 'info'); return; }
    const later = (fn) => setTimeout(fn, 60);
    if (type === 'contact') location.hash = `#/contacts/${id}`;
    else if (type === 'org') location.hash = `#/organizations/${id}`;
    else if (type === 'meeting') location.hash = `#/board/meetings/${id}`;
    else if (type === 'deal') { location.hash = '#/pipeline'; later(() => Actions.editDeal({ id })); }
    else if (type === 'task') { location.hash = '#/tasks'; later(() => Actions.editTask({ id })); }
    else if (type === 'resolution') { location.hash = '#/board/resolutions'; later(() => Actions.editResolution({ id })); }
  }

  return { TYPES, isDm, titleOf, hintOf, bodyHtml, logHtml, candidates, attachComposer, composerHtml, openRef, drafts: {} };
})();
