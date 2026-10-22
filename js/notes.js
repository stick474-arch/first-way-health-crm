/* Aetherium — personal notes (Google Keep style). Private to each person: in the cloud they live in
   crm_notes (supabase/upgrade-02.sql), readable only by their owner and the teammates they share with.
   In demo/local mode, or until the upgrade is run, they stay in this browser. */
const Notes = (() => {
  const NS = (window.FWH_CONFIG || {}).demo ? 'fwh-demo' : 'fwh-crm';
  const LS = `${NS}-notes`;
  const COLORS = ['default', 'coral', 'peach', 'sand', 'mint', 'sage', 'fog', 'storm', 'dusk', 'blossom', 'clay', 'chalk'];
  const TRASH_DAYS = 7;
  let mode = 'local';
  let client = null;
  let list = [];
  let fallback = false; // cloud workspace, but the notes table is missing → this browser
  let started = false;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());
  const me = () => (Cloud.user?.email || Store.currentUser()?.email || 'you@this-browser').toLowerCase();

  const saveLocal = () => { try { localStorage.setItem(LS, JSON.stringify(list.filter((n) => !n.sharedFrom))); } catch { /* full */ } };
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };

  function seedDemo() {
    const d = (n) => U.addDays(U.today(), n);
    const it = (text, done = false) => ({ id: U.uid('it'), text, done });
    list = [
      { id: U.uid('note'), title: 'Licenses per agent — draft', kind: 'list', color: 'sand', pinned: true, labels: ['Work'], items: [it('Telephony seat'), it('CRM seat', true), it('Endpoint security'), it('Password manager'), it('Headset')], body: '', remind: `${d(1)}T09:00` },
      { id: U.uid('note'), title: 'Board meeting ideas', kind: 'note', color: 'dusk', pinned: true, labels: ['Board'], body: 'Ask for a 10% option pool.\nShow cash, burn and runway first.\nInvite Victor as advisor?' },
      { id: U.uid('note'), title: '', kind: 'note', color: 'mint', labels: [], body: 'Call the bank about the USD account fees ☎️' },
      { id: U.uid('note'), title: 'Groceries', kind: 'list', color: 'default', labels: ['Personal'], items: [it('Coffee'), it('Oat milk'), it('Bread', true)], body: '' },
      { id: U.uid('note'), title: 'Brand', kind: 'note', color: 'peach', labels: ['Work'], body: 'Amber A + aged gold wordmark.\nKeep the armillary star dark.', image: '' },
      { id: U.uid('note'), title: 'Book recommendations', kind: 'note', color: 'fog', labels: ['Personal'], body: 'The Hard Thing About Hard Things\nVenture Deals' },
    ].map((n, i) => ({ archived: false, trashedAt: '', sharedWith: [], order: i, image: '', remind: '', items: [], createdAt: U.now(), updatedAt: U.now(), ...n }));
    saveLocal();
  }

  async function start() {
    if (started) return;
    started = true;
    mode = Store.mode === 'cloud' && Cloud.client ? 'cloud' : 'local';
    if (mode === 'cloud') {
      client = Cloud.client;
      const { data, error } = await client.from('crm_notes').select('*');
      if (error) { fallback = true; mode = 'local'; } else {
        list = (data || []).map(fromRow);
        client.channel('crm-notes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_notes' }, (p) => {
            if (p.eventType === 'DELETE') list = list.filter((n) => n.id !== p.old?.id);
            else { const n = fromRow(p.new); const i = list.findIndex((x) => x.id === n.id); if (i < 0) list.push(n); else if (!pending.has(n.id)) list[i] = n; }
            emit();
          })
          .subscribe();
        purgeTrash();
        emit();
        return;
      }
    }
    list = loadLocal();
    if (!list.length && Cloud.demo) seedDemo();
    purgeTrash();
    emit();
  }
  const fromRow = (r) => ({ ...r.data, id: r.id, sharedWith: r.shared_with || [], owner: r.owner_email, sharedFrom: r.owner_email && r.owner_email !== me() ? r.owner_email : '' });

  // Save: instant in memory, debounced to the cloud
  const pending = new Map();
  let timer = null;
  function flush() {
    timer = null;
    const batch = [...pending.values()];
    pending.clear();
    if (mode !== 'cloud') return;
    batch.forEach(async (n) => {
      const { id, sharedWith, owner, sharedFrom, ...data } = n;
      const row = { id, data, shared_with: sharedWith || [], updated_at: new Date().toISOString() };
      const res = sharedFrom
        ? await client.from('crm_notes').update({ data, shared_with: row.shared_with, updated_at: row.updated_at }).eq('id', id)
        : await client.from('crm_notes').upsert(row);
      if (res.error) UI.toast(`Note not saved: ${res.error.message}`, 'error');
    });
  }
  function save(note, { silent = false } = {}) {
    const n = { ...note, updatedAt: U.now() };
    if (!n.id) { n.id = U.uid('note'); n.createdAt = n.updatedAt; }
    const i = list.findIndex((x) => x.id === n.id);
    if (i < 0) list.unshift(n); else list[i] = n;
    if (mode === 'local') saveLocal(); else { pending.set(n.id, n); clearTimeout(timer); timer = setTimeout(flush, 600); }
    if (!silent) emit();
    return n;
  }
  const patch = (id, p, opts) => { const n = get(id); return n ? save({ ...n, ...p }, opts) : null; };
  async function destroy(id) {
    const n = get(id);
    if (!n) return;
    if (n.sharedFrom) { UI.toast('Only the owner can delete this note', 'info'); return; }
    list = list.filter((x) => x.id !== id);
    if (mode === 'local') saveLocal(); else { const { error } = await client.from('crm_notes').delete().eq('id', id); if (error) UI.toast(error.message, 'error'); }
    emit();
  }
  function purgeTrash() {
    const limit = U.addDays(U.today(), -TRASH_DAYS);
    list.filter((n) => n.trashedAt && n.trashedAt.slice(0, 10) < limit && !n.sharedFrom).forEach((n) => destroy(n.id));
  }
  const get = (id) => list.find((n) => n.id === id) || null;
  const savedLabels = () => { try { return JSON.parse(localStorage.getItem(`${LS}-labels`) || '[]'); } catch { return []; } };
  const labels = () => [...new Set([...savedLabels(), ...list.flatMap((n) => n.labels || [])])].sort((a, b) => a.localeCompare(b));
  const setLabels = (arr) => { try { localStorage.setItem(`${LS}-labels`, JSON.stringify(arr)); } catch { /* ignore */ } emit(); };
  const dueCount = () => list.filter((n) => !n.trashedAt && !n.archived && n.remind && n.remind.slice(0, 10) <= U.today()).length;

  return {
    COLORS, TRASH_DAYS, start, save, patch, destroy, get, labels, setLabels, dueCount,
    all: () => list,
    onChange: (fn) => listeners.push(fn),
    get mode() { return mode; },
    get fallback() { return fallback; },
    me,
  };
})();
