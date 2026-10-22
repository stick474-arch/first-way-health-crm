/* Aetherium — corporate finance engine: currencies, balances, P&L, burn, runway, subscriptions,
   budget vs actual and the cap table. Follows a lean startup model: one cash ledger, a small chart
   of accounts mapped to P&L lines, financing kept outside the P&L, everything reported in a base currency. */
const Fin = (() => {
  const S = Store;
  const cfg = () => S.settings.finance || { baseCurrency: 'COP', usdRate: 4000, agents: 0 };
  const base = () => cfg().baseCurrency || 'COP';
  const cat = (id) => S.FIN_CATEGORIES.find((c) => c.id === id) || null;
  const group = (id) => S.FIN_GROUPS.find((g) => g.id === id) || null;
  const accountOf = (id) => S.get('accounts', id);
  const curOf = (t) => accountOf(t.accountId)?.currency || base();

  // Convert to the base currency. USD↔COP uses the transaction's own rate or the workspace rate.
  function toBase(amount, currency, rate) {
    const a = Number(amount) || 0;
    const b = base();
    if (!currency || currency === b) return a;
    const r = Number(rate) || Number(cfg().usdRate) || 1;
    if (b === 'COP' && currency === 'USD') return a * r;
    if (b === 'USD' && currency === 'COP') return a / r;
    return a;
  }

  // Convert between the two supported currencies (COP per 1 USD)
  function convert(amount, from, to, rate) {
    const a = Number(amount) || 0;
    if (!from || !to || from === to) return a;
    const r = Number(rate) || Number(cfg().usdRate) || 1;
    if (from === 'USD' && to === 'COP') return a * r;
    if (from === 'COP' && to === 'USD') return a / r;
    return a;
  }

  function fmt(amount, currency = base(), { compact = false, sign = false } = {}) {
    const v = Number(amount) || 0;
    const locale = currency === 'COP' ? 'es-CO' : 'en-US';
    const opts = { style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2, minimumFractionDigits: 0 };
    if (compact && Math.abs(v) >= 10000) Object.assign(opts, { notation: 'compact', maximumFractionDigits: 1 });
    const s = new Intl.NumberFormat(locale, opts).format(Math.abs(v));
    return `${sign ? (v < 0 ? '−' : v > 0 ? '+' : '') : (v < 0 ? '−' : '')}${s}`;
  }

  const active = (t) => t.status !== 'Planned';
  const kindOf = (t) => (t.kind === 'transfer' ? 'transfer' : group(cat(t.category)?.group)?.id || 'opex');

  // Signed amount in the transaction's own currency, from the point of view of its account
  function signed(t) {
    const a = Number(t.amount) || 0;
    if (t.kind === 'transfer') return -a;
    const c = cat(t.category);
    if (!c) return -a;
    if (c.group === 'financing') return (c.dir || 1) * a;
    return group(c.group).sign * a;
  }
  const baseAmount = (t) => toBase(t.amount, curOf(t), t.fxRate);

  function balance(accountId) {
    const acc = accountOf(accountId);
    if (!acc) return 0;
    let b = Number(acc.openingBalance) || 0;
    for (const t of S.all('transactions')) {
      if (!active(t)) continue;
      if (t.accountId === accountId) b += signed(t);
      if (t.kind === 'transfer' && t.toAccountId === accountId) b += Number(t.toAmount || t.amount) || 0;
    }
    return b;
  }
  const cash = () => S.all('accounts').filter((a) => !a.archived).reduce((s, a) => s + toBase(balance(a.id), a.currency), 0);

  const monthKey = (d) => (d || '').slice(0, 7);
  const monthsBack = (n) => {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
    return out;
  };
  const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); };

  function pl(month) {
    const r = { revenue: 0, cogs: 0, opex: 0, financingIn: 0, financingOut: 0, byCategory: {} };
    for (const t of S.all('transactions')) {
      if (!active(t) || t.kind === 'transfer' || monthKey(t.date) !== month) continue;
      const c = cat(t.category);
      if (!c) continue;
      const v = baseAmount(t);
      if (c.group === 'financing') { if ((c.dir || 1) > 0) r.financingIn += v; else r.financingOut += v; continue; }
      r[c.group] += v;
      r.byCategory[c.id] = (r.byCategory[c.id] || 0) + v;
    }
    r.expenses = r.cogs + r.opex;
    r.net = r.revenue - r.expenses;
    r.grossMargin = r.revenue ? (r.revenue - r.cogs) / r.revenue : null;
    return r;
  }

  // Burn = average monthly operating loss over the last 3 complete months (or what exists so far)
  function burn() {
    const months = monthsBack(4).slice(0, 3).filter((m) => S.all('transactions').some((t) => monthKey(t.date) === m));
    const list = months.length ? months : [monthsBack(1)[0]];
    const losses = list.map((m) => -pl(m).net);
    const avg = losses.reduce((s, v) => s + v, 0) / list.length;
    return { monthly: Math.max(0, avg), months: list.length };
  }
  function runway() {
    const b = burn().monthly;
    const c = cash();
    if (b <= 0) return { months: Infinity, label: c > 0 ? 'Profitable / no burn' : '—' };
    const m = c / b;
    return { months: m, label: `${m.toFixed(1)} months`, until: U.addDays(U.today(), Math.round(m * 30.4)) };
  }

  // ---- Subscriptions & licenses ------------------------------------------------------------
  function subMonthly(s) {
    const amount = Number(s.amount) || 0;
    const seats = Number(s.seats) || 1;
    const perPeriod = s.cadence === 'Per seat / month' ? amount * seats : amount;
    const monthly = s.cadence === 'Annual' ? perPeriod / 12 : perPeriod;
    return toBase(monthly, s.currency || base());
  }
  const subsActive = () => S.all('subscriptions').filter((s) => s.status !== 'Cancelled');
  const committedMonthly = () => subsActive().reduce((t, s) => t + subMonthly(s), 0);
  const perAgent = () => {
    const agents = Number(cfg().agents) || 0;
    const delivery = subsActive().filter((s) => s.category === 'cogs-licenses').reduce((t, s) => t + subMonthly(s), 0);
    return agents ? delivery / agents : null;
  };

  function upcoming(days = 30) {
    const until = U.addDays(U.today(), days);
    const items = [];
    subsActive().forEach((s) => { if (s.nextDate && s.nextDate <= until) items.push({ date: s.nextDate, label: s.name, amount: toBase(subPeriodAmount(s), s.currency), kind: 'subscription', id: s.id }); });
    S.all('transactions').filter((t) => t.status === 'Planned' && t.date && t.date <= until).forEach((t) => items.push({ date: t.date, label: t.description, amount: baseAmount(t) * Math.sign(signed(t) || -1), kind: 'planned', id: t.id }));
    return U.sortBy(items, 'date');
  }
  const subPeriodAmount = (s) => (Number(s.amount) || 0) * (s.cadence === 'Per seat / month' ? (Number(s.seats) || 1) : 1);
  const nextDateAfter = (s) => {
    const d = U.parse(s.nextDate || U.today()) || new Date();
    if (s.cadence === 'Annual') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
    return U.toDateStr(d);
  };

  // ---- Founders: money they put in, and expenses they paid personally ------------------------
  const owedToFounders = () => S.all('transactions').filter((t) => active(t) && t.paidBy && !t.reimbursed && t.kind !== 'transfer' && signed(t) < 0)
    .reduce((s, t) => s + baseAmount(t), 0);
  const contributions = (personId) => S.all('transactions')
    .filter((t) => active(t) && (t.category === 'fin-capital' || t.category === 'fin-investment') && t.contributorId === personId)
    .reduce((s, t) => s + baseAmount(t), 0);

  // ---- Cap table ---------------------------------------------------------------------------
  function vested(sh) {
    const total = Number(sh.shares) || 0;
    if (!sh.vestingStart || !Number(sh.vestingMonths)) return total;
    const start = U.parse(sh.vestingStart);
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) - (now.getDate() < start.getDate() ? 1 : 0);
    if (months < (Number(sh.cliffMonths) || 0)) return 0;
    return Math.min(total, Math.round((total * Math.max(0, months)) / Number(sh.vestingMonths)));
  }

  const budgetFor = (catId) => Number(S.all('budgets').find((b) => b.category === catId)?.monthly) || 0;

  return {
    cfg, base, cat, group, toBase, convert, fmt, signed, baseAmount, balance, cash, pl, burn, runway, monthsBack, monthLabel, monthKey,
    subMonthly, committedMonthly, perAgent, upcoming, subPeriodAmount, nextDateAfter, owedToFounders, contributions, vested, budgetFor, kindOf, curOf, active,
  };
})();
