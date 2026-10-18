/* Aetherium CRM — UI building blocks: icons, badges, toasts, modals, forms, menus. */
const UI = (() => {
  const esc = U.esc;
  const $ = (s, root = document) => root.querySelector(s);

  // Lucide-style 24px stroke icons
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    kanban: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkSquare: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
    landmark: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    video: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    gavel: '<path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    tag: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  };
  const ACTIVITY_ICONS = { Call: 'phone', Email: 'mail', Meeting: 'users', 'Video call': 'video', Message: 'message', Note: 'note' };

  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const actIcon = (type) => icon(ACTIVITY_ICONS[type] || 'note');

  const badge = (text, color = 'slate', cls = '') => `<span class="badge b-${color} ${cls}">${esc(text)}</span>`;
  const typeBadge = (type) => badge(type, Store.typeInfo(type).color);
  const priorityBadge = (p) => {
    const info = Store.priorityInfo(p);
    return info ? `<span class="prio prio-${p}" title="Priority ${esc(info.label)}">${esc(p)}</span>` : '';
  };
  const stageBadge = (stage) => {
    const s = Store.stageInfo(stage);
    return badge(s.name, stage === 'won' ? 'green' : stage === 'lost' ? 'red' : 'blue');
  };

  function tagChips(ids = []) {
    return ids.map((id) => Store.tag(id)).filter(Boolean).map((t) => (
      `<span class="tag b-${t.color || 'slate'}">${t.group ? `<i>${esc(t.group)}:</i> ` : ''}${esc(t.name)}</span>`
    )).join('');
  }

  function avatar(name, size = '') {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `<span class="avatar ${size}" style="--av: var(--av-${h % 8})" aria-hidden="true">${esc(U.initials(name))}</span>`;
  }

  const healthDot = (h) => `<span class="dot dot-${h.status}" title="${esc(h.label)}"></span>`;

  const empty = (iconName, title, text = '', action = '') => (
    `<div class="empty">${icon(iconName)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`
  );

  const dueLabel = (due, done) => {
    if (!due) return '<span class="muted">No date</span>';
    const n = U.daysFromToday(due);
    const cls = done ? 'muted' : n < 0 ? 'due-over' : n === 0 ? 'due-today' : '';
    return `<span class="due ${cls}" title="${esc(U.fmtDate(due))}">${n < 0 && !done ? icon('alert') : ''}${esc(U.relDays(due))}</span>`;
  };

  // ---- Toasts ----------------------------------------------------------------------------
  function toast(msg, type = 'info', opts = {}) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${esc(msg)}</span>${opts.actionLabel ? `<button class="toast-action">${esc(opts.actionLabel)}</button>` : ''}`;
    if (opts.actionLabel) el.querySelector('button').onclick = () => { el.remove(); opts.onAction(); };
    $('#toasts').appendChild(el);
    const ms = opts.duration || (opts.actionLabel ? 6000 : 3500);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 300);
  }

  // ---- Modals ----------------------------------------------------------------------------
  const stack = [];
  function modal({ title, body, footer = '', size = 'md', onClose, dismissable = false }) {
    const lastFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
        <div class="modal-body">${body}</div>
        ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
      </div>`;
    let closed = false;
    const entry = {
      close() {
        if (closed) return;
        closed = true;
        wrap.classList.add('closing');
        setTimeout(() => wrap.remove(), 120);
        stack.splice(stack.indexOf(entry), 1);
        if (onClose) onClose();
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      },
    };
    if (dismissable) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) entry.close(); });
    wrap.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => entry.close(); });
    $('#modals').appendChild(wrap);
    stack.push(entry);
    const first = wrap.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    setTimeout(() => (first || wrap.querySelector('.modal')).focus({ preventScroll: true }), 30);
    entry.el = wrap.querySelector('.modal');
    return entry;
  }
  const closeTopModal = () => { if (stack.length) { stack[stack.length - 1].close(); return true; } return false; };
  const hasModal = () => stack.length > 0;

  function confirm(message, { title = 'Are you sure?', okText = 'Delete', danger = true } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const m = modal({
        title, size: 'sm', dismissable: true,
        body: `<p class="confirm-text">${esc(message)}</p>`,
        footer: `<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
        onClose: () => { if (!answered) resolve(false); },
      });
      m.el.querySelector('[data-ok]').onclick = () => { answered = true; resolve(true); m.close(); };
      setTimeout(() => m.el.querySelector('[data-ok]').focus(), 40);
    });
  }

  function prompt(title, { label = '', value = '', okText = 'Save', type = 'text', options = null } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const fields = [{ name: 'v', label, type: options ? 'select' : type, options, required: true }];
      const m = formModal({
        title, fields, values: { v: value }, submitText: okText, size: 'sm',
        onSubmit: (d) => { answered = true; resolve(d.v); },
        onClose: () => { if (!answered) resolve(null); },
      });
      return m;
    });
  }

  // ---- Forms -----------------------------------------------------------------------------
  const normOptions = (options = []) => options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));

  function selectOptions(options, val, emptyLabel) {
    const opts = normOptions(options);
    let html = emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : '';
    const groups = [...new Set(opts.map((o) => o.group || ''))];
    for (const g of groups) {
      const inner = opts.filter((o) => (o.group || '') === g)
        .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      html += g ? `<optgroup label="${esc(g)}">${inner}</optgroup>` : inner;
    }
    return html;
  }

  function field(f, values) {
    if (f.type === 'section') return `<div class="form-section span-2" ${f.showWhen ? `data-show-when="${esc(f.showWhen)}"` : ''}>${esc(f.label)}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
    if (f.type === 'html') return `<div class="span-2" ${f.showWhen ? `data-show-when="${esc(f.showWhen)}"` : ''}>${f.html}</div>`;
    const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`;
    const raw = values[f.name];
    const val = raw === undefined || raw === null ? (f.default ?? '') : raw;
    const req = f.required ? 'required' : '';
    const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
    let input;
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${ph}>${esc(val)}</textarea>`;
        break;
      case 'select':
        input = `<select id="${id}" name="${f.name}" ${req}>${selectOptions(f.options, val, f.empty)}</select>`;
        break;
      case 'checkbox':
        input = `<label class="check"><input id="${id}" type="checkbox" name="${f.name}" ${val ? 'checked' : ''}><span>${esc(f.checkLabel || '')}</span></label>`;
        break;
      case 'chips': {
        const arr = Array.isArray(val) ? val : [];
        const opts = normOptions(f.options);
        input = opts.length
          ? `<div class="chips-input">${opts.map((o) => `<label class="chip-check ${o.color ? `b-${o.color}` : ''}"><input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${arr.includes(o.value) ? 'checked' : ''}><span>${o.html || esc(o.label)}</span></label>`).join('')}</div>`
          : `<div class="muted small">${esc(f.emptyText || 'Nothing to choose yet.')}</div>`;
        break;
      }
      case 'picker': {
        const arr = Array.isArray(val) ? val : [];
        const opts = normOptions(f.options);
        const sorted = [...opts.filter((o) => arr.includes(o.value)), ...opts.filter((o) => !arr.includes(o.value))];
        input = `<div class="picker" data-picker>
          <div class="picker-selected"></div>
          <input type="text" class="picker-search" placeholder="${esc(f.placeholder || 'Type to filter…')}" aria-label="Filter ${esc(f.label)}">
          <div class="picker-list">${sorted.map((o) => `<label class="picker-item" data-search="${esc(`${o.label} ${o.sub || ''}`.toLowerCase())}">
            <input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${arr.includes(o.value) ? 'checked' : ''}>
            <span class="pi-name">${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</label>`).join('') || '<div class="muted small pad">No contacts yet.</div>'}</div>
        </div>`;
        break;
      }
      default:
        input = `<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" ${req} ${ph} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.list ? `list="${f.list}"` : ''}>`;
    }
    return `<div class="field ${f.span === 2 ? 'span-2' : ''}" ${f.showWhen ? `data-show-when="${esc(f.showWhen)}"` : ''}>
      ${f.type === 'checkbox' && !f.label ? '' : `<label for="${id}">${esc(f.label || '')}${f.required ? ' <b class="req">*</b>' : ''}</label>`}
      ${input}${f.help ? `<small class="help">${esc(f.help)}</small>` : ''}</div>`;
  }

  function readForm(form, fields) {
    const fd = new FormData(form);
    const out = {};
    for (const f of fields) {
      if (!f.name || f.type === 'section' || f.type === 'html') continue;
      if (f.type === 'chips' || f.type === 'picker') out[f.name] = fd.getAll(f.name);
      else if (f.type === 'checkbox') out[f.name] = fd.has(f.name);
      else if (f.type === 'number') {
        const s = String(fd.get(f.name) ?? '').trim();
        out[f.name] = s === '' ? null : Number(s);
      } else out[f.name] = String(fd.get(f.name) ?? '').trim();
    }
    return out;
  }

  function applyShowWhen(form) {
    form.querySelectorAll('[data-show-when]').forEach((el) => {
      const [name, vals] = el.dataset.showWhen.split(':');
      const ctl = form.elements[name];
      const v = ctl ? (ctl.type === 'checkbox' ? String(ctl.checked) : ctl.value) : '';
      el.hidden = !vals.split('|').includes(v);
    });
  }

  function initPickers(root) {
    root.querySelectorAll('[data-picker]').forEach((p) => {
      const sel = p.querySelector('.picker-selected');
      const search = p.querySelector('.picker-search');
      const paint = () => {
        const checked = [...p.querySelectorAll('input[type=checkbox]:checked')];
        sel.innerHTML = checked.map((c) => `<span class="pchip">${esc(c.parentElement.querySelector('.pi-name').textContent)}<button type="button" data-uncheck="${esc(c.value)}" aria-label="Remove">×</button></span>`).join('')
          || '<span class="muted small">Nobody selected</span>';
      };
      p.addEventListener('change', paint);
      sel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-uncheck]');
        if (!b) return;
        const cb = [...p.querySelectorAll('input[type=checkbox]')].find((c) => c.value === b.dataset.uncheck);
        if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        p.querySelectorAll('.picker-item').forEach((it) => { it.hidden = q && !it.dataset.search.includes(q); });
      });
      search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const first = [...p.querySelectorAll('.picker-item')].find((it) => !it.hidden);
        if (first) { const cb = first.querySelector('input'); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); search.select(); }
      });
      paint();
    });
  }

  function formModal({ title, fields, values = {}, submitText = 'Save', size = 'md', onSubmit, onDelete, deleteText = 'Delete', deleteConfirm, onMount, onClose, intro = '' }) {
    const body = `${intro ? `<p class="form-intro">${intro}</p>` : ''}<form class="form-grid" novalidate autocomplete="off">${fields.map((f) => field(f, values)).join('')}</form>`;
    const footer = `${onDelete ? `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')}<span>${esc(deleteText)}</span></button>` : ''}
      <span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-submit>${esc(submitText)}</button>`;
    const m = modal({ title, body, footer, size, onClose });
    const form = m.el.querySelector('form');
    const submit = async () => {
      for (const f of fields) {
        if (!f.required || !f.name) continue;
        const el = form.elements[f.name];
        const wrap = el && el.closest ? el.closest('[data-show-when]') : null;
        if (wrap && wrap.hidden) continue;
        if (el && !String(el.value || '').trim()) {
          el.classList.add('invalid');
          el.focus();
          toast(`${f.label} is required`, 'error');
          return;
        }
      }
      const res = await onSubmit(readForm(form, fields), form);
      if (res !== false) m.close();
    };
    m.el.querySelector('[data-submit]').onclick = submit;
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    form.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))
        || (e.key === 'Enter' && e.target.tagName === 'INPUT' && !['checkbox', 'radio'].includes(e.target.type) && !e.target.closest('.picker'))) {
        e.preventDefault();
        submit();
      }
    });
    form.addEventListener('input', (e) => e.target.classList.remove('invalid'));
    if (onDelete) {
      m.el.querySelector('[data-del]').onclick = async () => {
        if (await confirm(deleteConfirm || 'This cannot be undone.')) { m.close(); onDelete(); }
      };
    }
    applyShowWhen(form);
    form.addEventListener('change', () => applyShowWhen(form));
    initPickers(form);
    if (onMount) onMount(form, m);
    return m;
  }

  // ---- Popover menu ----------------------------------------------------------------------
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function menu(anchor, items) {
    closeMenu();
    const el = document.createElement('div');
    el.className = 'menu popover';
    el.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button type="button" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span></button>`)).join('');
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`;
    el.style.top = `${r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      closeMenu();
      items[Number(b.dataset.i)].onClick();
    });
    openMenu = el;
    setTimeout(() => el.querySelector('button')?.focus(), 0);
  }
  document.addEventListener('mousedown', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });

  // ---- Option lists for selects ----------------------------------------------------------
  const opts = {
    users: () => Store.all('users').map((u) => ({ value: u.id, label: u.name })),
    owners: () => [
      ...Store.all('users').map((u) => ({ value: u.id, label: u.name, group: 'Team' })),
      ...Store.boardMembers().map((c) => ({ value: c.id, label: Store.contactName(c), group: 'Board & advisors' })),
    ],
    orgs: () => U.sortBy(Store.all('organizations'), (o) => o.name.toLowerCase()).map((o) => ({ value: o.id, label: o.name })),
    contacts: () => U.sortBy(Store.all('contacts'), (c) => Store.contactName(c).toLowerCase()).map((c) => ({
      value: c.id, label: Store.contactName(c), sub: [Store.orgName(c.orgId), c.type].filter(Boolean).join(' · '), group: Store.GROUPS.find((g) => g.id === Store.groupOf(c.type))?.label,
    })),
    deals: (includeId) => U.sortBy(Store.all('deals').filter((d) => Store.isOpenDeal(d) || d.id === includeId), 'name').map((d) => ({ value: d.id, label: d.name })),
    meetings: () => U.sortBy(Store.all('meetings'), 'date', -1).map((m) => ({ value: m.id, label: `${m.title} (${U.fmtDate(m.date)})` })),
    tags: () => Store.tagsSorted().map((t) => ({ value: t.id, label: `${t.group ? `${t.group}: ` : ''}${t.name}`, color: t.color })),
  };

  return {
    icon, actIcon, badge, typeBadge, priorityBadge, stageBadge, tagChips, avatar, healthDot, empty, dueLabel,
    toast, modal, confirm, prompt, formModal, field, readForm, initPickers, menu, closeMenu, closeTopModal, hasModal, opts, ICONS, selectOptions,
  };
})();
