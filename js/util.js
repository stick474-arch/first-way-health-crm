/* Aetherium CRM — small shared helpers (no dependencies). */
const Views = {}; // each file in js/views registers one page here

const U = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Dates are stored as local strings: 'YYYY-MM-DD' (date) or 'YYYY-MM-DDTHH:mm' (date + time).
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toDateTimeStr = (d) => `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = () => toDateStr(new Date());
  const now = () => toDateTimeStr(new Date());

  const parse = (s) => {
    if (!s) return null;
    if (s.length === 10) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const addDays = (s, n) => {
    const d = parse(s) || new Date();
    d.setDate(d.getDate() + n);
    return s && s.length > 10 ? toDateTimeStr(d) : toDateStr(d);
  };

  // Whole calendar days from today to s (negative = in the past).
  const daysFromToday = (s) => {
    const d = parse(s);
    if (!d) return null;
    return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  };

  const fmtDate = (s) => {
    const d = parse(s);
    if (!d) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : `, ${d.getFullYear()}`}`;
  };

  const fmtDateLong = (s) => {
    const d = parse(s);
    if (!d) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const fmtTime = (s) => {
    const d = parse(s);
    if (!d || !s || s.length <= 10) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const fmtDateTime = (s) => {
    const t = fmtTime(s);
    return t ? `${fmtDate(s)} · ${t}` : fmtDate(s);
  };

  const relDays = (s) => {
    const n = daysFromToday(s);
    if (n === null) return '';
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    if (n > 0) return n < 45 ? `in ${n} days` : `in ${Math.round(n / 30)} mo`;
    const a = -n;
    return a < 45 ? `${a} days ago` : a < 365 ? `${Math.round(a / 30)} mo ago` : `${(a / 365).toFixed(1)} yr ago`;
  };

  const quarterStart = (d = new Date()) => toDateStr(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1));

  const money = (n, compact = false) => {
    const v = Number(n) || 0;
    if (compact && Math.abs(v) >= 1000) {
      return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  };

  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  const plural = (n, word, many) => `${n} ${n === 1 ? word : (many || word + 's')}`;

  const debounce = (fn, ms = 200) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const sortBy = (arr, key, dir = 1) => [...arr].sort((a, b) => {
    const x = typeof key === 'function' ? key(a) : a[key];
    const y = typeof key === 'function' ? key(b) : b[key];
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });

  const download = (filename, text, mime = 'text/plain') => {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  const toCSV = (rows, cols) => {
    const cell = (v) => {
      const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.map((c) => cell(c.label)).join(','), ...rows.map((r) => cols.map((c) => cell(c.get(r))).join(','))].join('\r\n');
  };

  const matches = (q, ...fields) => {
    if (!q) return true;
    const hay = fields.flat().filter(Boolean).join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
  };

  return {
    uid, esc, today, now, parse, addDays, daysFromToday, fmtDate, fmtDateLong, fmtTime, fmtDateTime,
    relDays, quarterStart, money, initials, plural, debounce, sortBy, download, toCSV, matches, toDateStr,
  };
})();
