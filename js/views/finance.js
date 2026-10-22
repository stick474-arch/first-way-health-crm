/* Corporate finance — a lean startup finance stack: cash accounts, one transaction ledger mapped to a
   small chart of accounts (revenue · cost of revenue · operating expenses · financing), subscriptions and
   licenses, budget vs actual, the cap table, and the metrics a board asks for (cash, burn, runway, margin). */
Views.finance = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { q: '', month: '', account: '', group: '', status: '', budgetMonth: '' };
  const TABS = [['', 'Overview'], ['transactions', 'Transactions'], ['accounts', 'Accounts'], ['subscriptions', 'Subscriptions & licenses'], ['budget', 'Budget'], ['equity', 'Equity']];
  const NEEDS = ['Business need', 'Risk & compliance', 'Nice to have'];
  const SUB_STATUS = ['Active', 'Trial', 'Cancelled'];
  const CLOSE_STEPS = [
    ['reconcile', 'Reconcile every account balance with its bank or card statement'],
    ['categorize', 'Every movement has a category and a receipt or invoice link'],
    ['founders', 'Expenses paid personally by founders are logged as reimbursable'],
    ['subs', 'Subscription and license charges for the month are recorded'],
    ['invoices', 'Invoices for this month’s services are issued and logged as revenue'],
    ['budget', 'Budget vs actual reviewed; overruns explained'],
    ['report', 'Cash, burn and runway shared with the board'],
  ];

  const fmt = (v, cur, o) => Fin.fmt(v, cur || Fin.base(), o);
  const money = (v, o) => esc(fmt(v, Fin.base(), o));
  const catName = (id) => Fin.cat(id)?.name || 'Uncategorized';
  const accName = (id) => S.get('accounts', id)?.name || '—';
  const catOptions = (groups) => S.FIN_CATEGORIES.filter((c) => !groups || groups.includes(c.group))
    .map((c) => ({ value: c.id, label: c.name, group: Fin.group(c.group).label }));
  const accountOptions = () => S.all('accounts').filter((a) => !a.archived).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }));
  const peopleOptions = () => UI.opts.owners();
  const pct = (v) => (v == null || !isFinite(v) ? '—' : `${Math.round(v * 100)}%`);
  const tone = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  const tabs = (active) => `<div class="segmented" role="tablist" aria-label="Finance sections" style="margin-bottom:16px">
    ${TABS.map(([id, label]) => `<a class="seg ${active === id ? 'active' : ''}" role="tab" href="#/finance${id ? `/${id}` : ''}" ${active === id ? 'aria-selected="true"' : ''}>${label}</a>`).join('')}</div>`;

  const head = (sub) => Parts.pageHead('Corporate finance', sub,
    `<button class="btn" data-act="editFinanceSettings" title="Base currency, USD rate and agents">${UI.icon('sliders')}<span class="hide-sm">Settings</span></button>
     <button class="btn" data-act="newTransfer">${UI.icon('arrowRight')}<span class="hide-sm">Transfer</span></button>
     <button class="btn btn-primary" data-act="newTransaction">${UI.icon('plus')}New transaction</button>`);

  function bars(rows) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (!rows.some((r) => r.value)) return '<div class="empty-sm">No expenses recorded this month.</div>';
    return `<div class="bars" role="list">${rows.map((r) => `
      <div class="bar-row" role="listitem" aria-label="${esc(`${r.label}: ${fmt(r.value)}`)}">
        <span class="bar-label" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.max(1.5, (r.value / max) * 100)}%"></span></span>
        <span class="bar-value">${money(r.value, { compact: true })}</span>
      </div>`).join('')}</div>`;
  }

  // ---- Overview ----------------------------------------------------------------------------
  function overview(root) {
    const accounts = S.all('accounts').filter((a) => !a.archived);
    const months = Fin.monthsBack(6);
    const thisM = months[5];
    const prevM = months[4];
    const cur = Fin.pl(thisM);
    const prev = Fin.pl(prevM);
    const cash = Fin.cash();
    const burn = Fin.burn();
    const run = Fin.runway();
    const committed = Fin.committedMonthly();
    const owed = Fin.owedToFounders();
    const perAgent = Fin.perAgent();
    const mom = prev.revenue ? (cur.revenue - prev.revenue) / prev.revenue : null;
    const upcoming = Fin.upcoming(30);
    const expenseRows = Object.entries(cur.byCategory).filter(([id]) => Fin.cat(id)?.group !== 'revenue')
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ label: catName(id), value }));
    const closeDone = (Fin.cfg().close || {})[thisM] || [];
    const plRows = months.map((m) => ({ m, r: Fin.pl(m) }));
    const runwayAlert = isFinite(run.months) && run.months < 6;

    root.innerHTML = `
      ${head(`Cash, burn and runway in ${esc(Fin.base())} · USD at ${esc(Fin.fmt(Fin.cfg().usdRate, 'COP'))}`)}
      ${tabs('')}
      ${!accounts.length ? `<div class="card fin-start"><div class="card-body">
        <h3 style="margin-top:0">Set up finance in four steps</h3>
        <ol class="steps">
          <li><b>Add your accounts</b> — the company bank account, cash, cards and, until the company has a bank account, each founder’s wallet used for company money. Enter today’s balance as the opening balance.</li>
          <li><b>Record founder capital</b> — each contribution as a transaction in <i>Founder capital contribution</i>, naming the founder, so the cap table shows who put in what.</li>
          <li><b>List subscriptions & licenses</b> — every tool you pay for, marked as business need or risk & compliance, with seats per agent. This is your license cost per agent.</li>
          <li><b>Log every movement</b> — income, expenses (paid personally? mark it reimbursable), transfers, and close each month with the checklist.</li>
        </ol>
        <div class="row wrap"><button class="btn btn-primary" data-act="newAccount">${UI.icon('plus')}Add first account</button>
        <button class="btn" data-act="newSubscription">${UI.icon('plus')}Add a subscription</button></div>
      </div></div>` : ''}
      ${runwayAlert ? `<div class="banner danger">${UI.icon('alert')}<div><b>Runway is under 6 months.</b> At the current burn the cash lasts until about ${esc(U.fmtDate(run.until))}. Startups usually start raising or cutting costs with 6–9 months left.</div></div>` : ''}
      <div class="kpis">
        <a class="card kpi" href="#/finance/accounts"><span class="kpi-label">${UI.icon('database')}Cash on hand</span><span class="kpi-value">${money(cash, { compact: true })}</span><span class="kpi-sub">${U.plural(accounts.length, 'account')}</span></a>
        <div class="card kpi"><span class="kpi-label">${UI.icon('activity')}Monthly net burn</span><span class="kpi-value">${money(burn.monthly, { compact: true })}</span><span class="kpi-sub">average of ${U.plural(burn.months, 'month')}, excludes financing</span></div>
        <div class="card kpi ${runwayAlert ? 'alert' : ''}"><span class="kpi-label">${UI.icon('clock')}Runway</span><span class="kpi-value">${esc(isFinite(run.months) ? `${run.months.toFixed(1)} mo` : '∞')}</span><span class="kpi-sub">${esc(run.until ? `until ~${U.fmtDate(run.until)}` : run.label)}</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('dollar')}Revenue this month</span><span class="kpi-value">${money(cur.revenue, { compact: true })}</span><span class="kpi-sub">${mom == null ? 'no revenue last month' : `${mom >= 0 ? '+' : ''}${Math.round(mom * 100)}% vs last month`} · margin ${pct(cur.grossMargin)}</span></div>
        <a class="card kpi" href="#/finance/subscriptions"><span class="kpi-label">${UI.icon('list')}Committed per month</span><span class="kpi-value">${money(committed, { compact: true })}</span><span class="kpi-sub">subscriptions & licenses${perAgent != null ? ` · ${money(perAgent, { compact: true })} per agent` : ''}</span></a>
        <a class="card kpi ${owed ? 'alert' : ''}" href="#/finance/transactions"><span class="kpi-label">${UI.icon('users')}Owed to founders</span><span class="kpi-value">${money(owed, { compact: true })}</span><span class="kpi-sub">paid personally, not yet reimbursed</span></a>
      </div>
      <div class="grid grid-main">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Profit & loss</h2><span class="sub">last 6 months · ${esc(Fin.base())}</span><div class="right"><button class="btn btn-sm btn-ghost" data-act="exportPL">${UI.icon('download')}CSV</button></div></div>
            <div class="table-wrap"><table class="table fin-pl">
              <thead><tr><th></th>${plRows.map(({ m }) => `<th class="num">${esc(Fin.monthLabel(m))}</th>`).join('')}</tr></thead>
              <tbody>
                ${[['Revenue', (r) => r.revenue, ''], ['Cost of revenue', (r) => -r.cogs, ''], ['Gross profit', (r) => r.revenue - r.cogs, 'sum'],
                  ['Operating expenses', (r) => -r.opex, ''], ['Net income', (r) => r.net, 'sum total'], ['Gross margin', null, 'pctrow'],
                  ['Financing in (not P&L)', (r) => r.financingIn, 'muted-row'], ['Financing out', (r) => -r.financingOut, 'muted-row']]
                  .map(([label, get, cls]) => `<tr class="${cls}"><th scope="row">${label}</th>${plRows.map(({ r }) => {
                    if (!get) return `<td class="num">${pct(r.grossMargin)}</td>`;
                    const v = get(r);
                    return `<td class="num nowrap ${cls.includes('sum') ? tone(v) : ''}">${v ? money(v, { compact: true }) : '<span class="muted">—</span>'}</td>`;
                  }).join('')}</tr>`).join('')}
              </tbody></table></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Where the money went</h3><span class="sub">${esc(Fin.monthLabel(thisM))} by category</span><div class="right"><a class="small" href="#/finance/budget">Budget vs actual</a></div></div>
            <div class="card-body">${bars(expenseRows)}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Accounts</h3><div class="right"><button class="btn btn-sm btn-ghost" data-act="newAccount">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush"><div class="list">${accounts.length ? accounts.map((a) => {
              const b = Fin.balance(a.id);
              return `<div class="list-item clickable" data-act="editAccount" data-id="${a.id}"><span class="acc-ic">${UI.icon(a.type === 'Credit card' ? 'tag' : a.type === 'Founder wallet' ? 'users' : 'database')}</span>
                <div class="li-main"><b>${esc(a.name)}</b><small>${esc([a.type, a.institution, a.last4 ? `•••• ${a.last4}` : ''].filter(Boolean).join(' · '))}</small></div>
                <div class="li-side num ${b < 0 ? 'neg' : ''}"><b>${esc(fmt(b, a.currency, { compact: true }))}</b></div></div>`;
            }).join('') : '<div class="empty-sm">No accounts yet.</div>'}</div></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Next 30 days</h3><span class="sub">renewals and planned movements</span></div>
            <div class="card-body flush"><div class="list">${upcoming.length ? upcoming.slice(0, 8).map((u) => `<div class="list-item clickable" data-act="${u.kind === 'subscription' ? 'editSubscription' : 'editTransaction'}" data-id="${u.id}">
              <div class="meeting-date sm"><span>${esc(U.parse(u.date).toLocaleDateString('en-US', { month: 'short' }))}</span><b>${esc(String(Number(u.date.slice(8, 10))))}</b></div>
              <div class="li-main"><b>${esc(u.label)}</b><small>${u.kind === 'subscription' ? 'Renewal' : 'Planned'} · ${esc(U.relDays(u.date))}</small></div>
              <div class="li-side num ${u.amount < 0 || u.kind === 'subscription' ? 'neg' : 'pos'}">${money(u.kind === 'subscription' ? -u.amount : u.amount, { compact: true })}</div></div>`).join('') : '<div class="empty-sm">Nothing due in the next 30 days.</div>'}</div></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Month-end close</h3><span class="sub">${esc(Fin.monthLabel(thisM))} · ${closeDone.length}/${CLOSE_STEPS.length}</span></div>
            <div class="card-body"><div class="term-track" style="margin-bottom:10px"><div class="term-fill" style="width:${Math.round((closeDone.length / CLOSE_STEPS.length) * 100)}%"></div></div>
              ${CLOSE_STEPS.map(([id, label]) => `<label class="check close-step"><input type="checkbox" data-close="${id}" ${closeDone.includes(id) ? 'checked' : ''} ${Cloud.canWrite ? '' : 'disabled'}><span>${esc(label)}</span></label>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
    root.onchange = (e) => {
      const id = e.target.dataset.close;
      if (!id) return;
      const c = Fin.cfg();
      const close = { ...(c.close || {}) };
      const set = new Set(close[thisM] || []);
      if (e.target.checked) set.add(id); else set.delete(id);
      close[thisM] = [...set];
      S.setSettings({ finance: { ...c, close } });
    };
  }

  // ---- Transactions ------------------------------------------------------------------------
  function filtered() {
    return U.sortBy(S.all('transactions').filter((t) => (!state.month || Fin.monthKey(t.date) === state.month)
      && (!state.account || t.accountId === state.account || t.toAccountId === state.account)
      && (!state.group || Fin.kindOf(t) === state.group)
      && (!state.status || (state.status === 'reimburse' ? t.paidBy && !t.reimbursed : t.status === state.status))
      && U.matches(state.q, t.description, t.invoiceRef, t.notes, catName(t.category), S.orgName(t.orgId), accName(t.accountId))), (t) => `${t.date}${t.createdAt}`, -1);
  }

  function txnRows(list) {
    if (!S.all('transactions').length) {
      return UI.empty('dollar', 'No transactions yet', 'Log every peso that moves: income, expenses, founder contributions and transfers. Mark expenses a founder paid personally so the company can pay them back.',
        `<button class="btn btn-primary" data-act="newTransaction">Record a transaction</button>`);
    }
    if (!list.length) return UI.empty('search', 'No transactions match these filters');
    const totals = list.filter(Fin.active).reduce((s, t) => {
      if (t.kind === 'transfer') return s;
      const v = Fin.baseAmount(t) * Math.sign(Fin.signed(t));
      if (v > 0) s.in += v; else s.out -= v;
      return s;
    }, { in: 0, out: 0 });
    return `<table class="table fin-table"><thead><tr><th>Date</th><th>Description</th><th class="hide-sm">Category</th><th class="hide-sm">Account</th><th class="num">Amount</th><th class="hide-sm">Status</th></tr></thead>
      <tbody>${list.map((t) => {
        const v = Fin.signed(t);
        const cur = Fin.curOf(t);
        const isT = t.kind === 'transfer';
        const extra = [t.orgId ? S.orgName(t.orgId) : '', t.paidBy ? `Paid by ${S.nameOf(t.paidBy)}${t.reimbursed ? ' · reimbursed' : ' · to reimburse'}` : '', t.contributorId ? `From ${S.nameOf(t.contributorId)}` : '', t.invoiceRef ? `#${t.invoiceRef}` : ''].filter(Boolean).join(' · ');
        return `<tr class="clickable ${t.status === 'Planned' ? 'planned' : ''}" data-act="editTransaction" data-id="${t.id}">
          <td class="nowrap">${esc(U.fmtDate(t.date))}</td>
          <td><div class="cell-main"><div><b>${esc(t.description || '(no description)')}</b>${t.receiptUrl ? ` <span class="muted" title="Receipt attached">${UI.icon('link')}</span>` : ''}<small>${esc(extra)}</small></div></div></td>
          <td class="hide-sm">${isT ? UI.badge('Transfer', 'slate') : `<span class="small">${esc(catName(t.category))}</span>`}</td>
          <td class="hide-sm small">${esc(accName(t.accountId))}${isT ? ` → ${esc(accName(t.toAccountId))}` : ''}</td>
          <td class="num nowrap ${isT ? '' : tone(v)}"><b>${esc(fmt(isT ? Number(t.amount) : v, cur, { sign: !isT }))}</b>${cur !== Fin.base() && !isT ? `<small class="block muted">${money(Fin.baseAmount(t))}</small>` : ''}</td>
          <td class="hide-sm">${UI.badge(t.status || 'Cleared', { Cleared: 'green', Pending: 'amber', Planned: 'slate' }[t.status || 'Cleared'])}${t.paidBy && !t.reimbursed ? ` ${UI.badge('Reimburse', 'orange')}` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr><th colspan="4" class="hide-sm">${U.plural(list.length, 'transaction')} · excludes planned and transfers</th><th class="num nowrap"><span class="pos">+${money(totals.in, { compact: true })}</span> / <span class="neg">−${money(totals.out, { compact: true })}</span></th><th class="hide-sm"></th></tr></tfoot></table>`;
  }

  function transactions(root) {
    const months = [...new Set(S.all('transactions').map((t) => Fin.monthKey(t.date)).filter(Boolean))].sort().reverse();
    root.innerHTML = `
      ${head('One ledger for every movement of money')}
      ${tabs('transactions')}
      <div class="filters">
        <input class="input" type="search" id="fq" placeholder="Filter transactions…" value="${esc(state.q)}" aria-label="Filter transactions">
        <select class="select" data-filter="month" aria-label="Month">${UI.selectOptions(months.map((m) => ({ value: m, label: Fin.monthLabel(m) })), state.month, 'All months')}</select>
        <select class="select" data-filter="account" aria-label="Account">${UI.selectOptions(S.all('accounts').map((a) => ({ value: a.id, label: a.name })), state.account, 'All accounts')}</select>
        <select class="select" data-filter="group" aria-label="Type">${UI.selectOptions([...S.FIN_GROUPS.map((g) => ({ value: g.id, label: g.label })), { value: 'transfer', label: 'Transfers' }], state.group, 'All types')}</select>
        <select class="select" data-filter="status" aria-label="Status">${UI.selectOptions([...S.TXN_STATUS, { value: 'reimburse', label: 'To reimburse to founders' }], state.status, 'Any status')}</select>
        <button class="btn" data-act="exportTransactions">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
      </div>
      <div class="card"><div class="table-wrap" id="tlist"></div></div>`;
    const paint = () => { root.querySelector('#tlist').innerHTML = txnRows(filtered()); };
    paint();
    root.oninput = (e) => { if (e.target.id === 'fq') { state.q = e.target.value; paint(); } };
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; paint(); } };
  }

  // ---- Accounts ----------------------------------------------------------------------------
  function accounts(root) {
    const list = U.sortBy(S.all('accounts'), (a) => `${a.archived ? 1 : 0}${a.name.toLowerCase()}`);
    root.innerHTML = `
      ${head('Where the company’s money sits')}
      ${tabs('accounts')}
      <div class="banner info">${UI.icon('shield')}<div>Keep only names and the last 4 digits here — never full account numbers, card numbers or passwords.</div></div>
      ${list.length ? `<div class="members">${list.map((a) => {
        const b = Fin.balance(a.id);
        const txns = S.all('transactions').filter((t) => t.accountId === a.id || t.toAccountId === a.id);
        const last = U.sortBy(txns, 'date', -1)[0];
        return `<div class="card member clickable ${a.archived ? 'archived' : ''}" data-act="editAccount" data-id="${a.id}" role="button" tabindex="0">
          <div class="member-top"><span class="acc-ic">${UI.icon(a.type === 'Credit card' ? 'tag' : a.type === 'Founder wallet' ? 'users' : 'database')}</span><div><b>${esc(a.name)}</b><small>${esc([a.type, a.institution, a.last4 ? `•••• ${a.last4}` : ''].filter(Boolean).join(' · '))}</small></div></div>
          <div class="acc-balance num ${b < 0 ? 'neg' : ''}">${esc(fmt(b, a.currency))}</div>
          <div class="small muted">${a.currency !== Fin.base() ? `≈ ${money(Fin.toBase(b, a.currency))} · ` : ''}${U.plural(txns.length, 'movement')}${last ? ` · last ${esc(U.fmtDate(last.date))}` : ''}${a.archived ? ' · archived' : ''}</div>
          <div class="small muted">Opening ${esc(fmt(a.openingBalance || 0, a.currency))}${a.openingDate ? ` on ${esc(U.fmtDate(a.openingDate))}` : ''}</div>
        </div>`;
      }).join('')}
      <button class="card member add-col" data-act="newAccount">${UI.icon('plus')}Add account</button></div>`
      : `<div class="card">${UI.empty('database', 'No accounts yet', 'Add the company bank account and, while the company is being set up, the founder wallets used for company money.', '<button class="btn btn-primary" data-act="newAccount">Add first account</button>')}</div>`}`;
  }

  // ---- Subscriptions & licenses ------------------------------------------------------------
  function subscriptions(root) {
    const subs = S.all('subscriptions');
    const active = subs.filter((s) => s.status !== 'Cancelled');
    const agents = Fin.agentCount();
    const fromRoster = S.all('agents').some((a) => a.status === 'Active');
    const perAgent = Fin.perAgent();
    const byNeed = NEEDS.map((n) => ({ n, list: U.sortBy(subs.filter((s) => (s.need || 'Business need') === n), (s) => `${s.status === 'Cancelled' ? 1 : 0}${s.name.toLowerCase()}`) }));
    const needTotal = (list) => list.filter((s) => s.status !== 'Cancelled').reduce((t, s) => t + Fin.subMonthly(s), 0);
    root.innerHTML = `
      ${head('Every tool and license the company pays for, by business need and risk')}
      ${tabs('subscriptions')}
      <div class="kpis">
        <div class="card kpi"><span class="kpi-label">${UI.icon('list')}Committed monthly</span><span class="kpi-value">${money(Fin.committedMonthly(), { compact: true })}</span><span class="kpi-sub">${U.plural(active.length, 'active subscription')}</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('calendar')}Per year</span><span class="kpi-value">${money(Fin.committedMonthly() * 12, { compact: true })}</span><span class="kpi-sub">at today’s seats and rate</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('users')}Delivery licenses per agent</span><span class="kpi-value">${perAgent != null ? money(perAgent, { compact: true }) : '—'}</span><span class="kpi-sub">${agents ? `${U.plural(agents, 'active agent')} · ${fromRoster ? '<a href="#/ops">from the roster</a>' : '<a href="#" data-act="editFinanceSettings">change</a>'}` : '<a href="#/ops/agents">add your agents</a>'}</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('shield')}Risk & compliance</span><span class="kpi-value">${money(needTotal(byNeed[1].list), { compact: true })}</span><span class="kpi-sub">per month, non-negotiable</span></div>
      </div>
      <div class="row wrap" style="margin-bottom:12px;gap:8px"><button class="btn btn-primary" data-act="newSubscription">${UI.icon('plus')}New subscription or license</button><button class="btn" data-act="exportSubscriptions">${UI.icon('download')}Export for the license presentation</button></div>
      ${subs.length ? byNeed.filter((g) => g.list.length).map(({ n, list }) => `<div class="card" style="margin-bottom:16px">
        <div class="card-head"><h3>${esc(n)}</h3><span class="sub">${money(needTotal(list))} / month</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th class="hide-sm">Category</th><th class="hide-sm">Billing</th><th class="num">Per month</th><th class="hide-sm">Next charge</th><th></th></tr></thead>
        <tbody>${list.map((s) => `<tr class="clickable ${s.status === 'Cancelled' ? 'planned' : ''}" data-act="editSubscription" data-id="${s.id}">
          <td><div class="cell-main"><div><b>${esc(s.name)}</b><small>${esc([S.orgName(s.orgId), s.ownerId ? `Owner: ${S.nameOf(s.ownerId)}` : '', s.status !== 'Active' ? s.status : ''].filter(Boolean).join(' · '))}</small></div></div></td>
          <td class="hide-sm small">${esc(catName(s.category))}</td>
          <td class="hide-sm small">${esc(fmt(s.amount, s.currency))} ${esc(s.cadence === 'Per seat / month' ? `× ${s.seats || 1} seats / month` : s.cadence === 'Annual' ? '/ year' : '/ month')}</td>
          <td class="num"><b>${money(Fin.subMonthly(s))}</b></td>
          <td class="hide-sm">${s.nextDate ? `${esc(U.fmtDate(s.nextDate))} <small class="muted">${esc(U.relDays(s.nextDate))}</small>` : '<span class="muted">—</span>'}</td>
          <td class="num">${s.status !== 'Cancelled' ? `<button class="btn btn-sm" data-act="recordCharge" data-id="${s.id}" title="Log this period’s charge as a transaction and move the next date">Record charge</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div></div>`).join('')
      : `<div class="card">${UI.empty('list', 'No subscriptions or licenses yet', 'Add every tool the operation needs (per agent licenses, telephony, CRM, Google Workspace…) and mark whether it is a business need or a risk/compliance requirement.', '<button class="btn btn-primary" data-act="newSubscription">Add the first one</button>')}</div>`}`;
  }

  // ---- Budget vs actual --------------------------------------------------------------------
  function budget(root) {
    const months = Fin.monthsBack(12).reverse();
    const m = state.budgetMonth || months[0];
    const r = Fin.pl(m);
    const last3 = Fin.monthsBack(4).slice(0, 3).map(Fin.pl);
    const groups = S.FIN_GROUPS.filter((g) => g.pl);
    let totB = 0;
    let totA = 0;
    const body = groups.map((g) => {
      const cats = S.FIN_CATEGORIES.filter((c) => c.group === g.id);
      return `<tr class="group-row"><th colspan="6">${esc(g.label)}</th></tr>${cats.map((c) => {
        const b = Fin.budgetFor(c.id);
        const a = r.byCategory[c.id] || 0;
        const avg = last3.reduce((s, x) => s + (x.byCategory[c.id] || 0), 0) / 3;
        if (g.id !== 'revenue') { totB += b; totA += a; }
        const used = b ? a / b : null;
        const over = g.id === 'revenue' ? (b && a < b) : (b && a > b);
        return `<tr>
          <td>${esc(c.name)}</td>
          <td class="num"><input class="input input-num" type="number" min="0" step="any" data-budget="${c.id}" value="${b || ''}" placeholder="0" aria-label="Monthly budget for ${esc(c.name)}" ${Cloud.canWrite ? '' : 'disabled'}></td>
          <td class="num">${a ? money(a) : '<span class="muted">—</span>'}</td>
          <td class="num hide-sm muted">${avg ? money(avg, { compact: true }) : '—'}</td>
          <td class="num ${over ? 'neg' : b ? 'pos' : ''}">${b ? money(g.id === 'revenue' ? a - b : b - a, { sign: true }) : '<span class="muted">—</span>'}</td>
          <td class="hide-sm" style="min-width:110px">${used != null ? `<div class="term-track ${over ? 'over' : ''}"><div class="term-fill" style="width:${Math.min(100, Math.round(used * 100))}%"></div></div><small class="muted">${pct(used)}</small>` : ''}</td>
        </tr>`;
      }).join('')}`;
    }).join('');
    root.innerHTML = `
      ${head('A monthly budget per category, compared with what actually happened')}
      ${tabs('budget')}
      <div class="filters"><select class="select" id="bmonth" aria-label="Month">${UI.selectOptions(months.map((x) => ({ value: x, label: Fin.monthLabel(x) })), m)}</select>
        <span class="result-count">Budgets are monthly amounts in ${esc(Fin.base())}. Revenue shows how far you are from target; costs show what is left.</span></div>
      <div class="card"><div class="table-wrap"><table class="table fin-budget">
        <thead><tr><th>Category</th><th class="num">Budget / month</th><th class="num">Actual ${esc(Fin.monthLabel(m))}</th><th class="num hide-sm">3-month avg</th><th class="num">Left / (over)</th><th class="hide-sm">Used</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><th>Total costs</th><th class="num">${money(totB)}</th><th class="num">${money(totA)}</th><th class="hide-sm"></th><th class="num ${totB && totA > totB ? 'neg' : 'pos'}">${totB ? money(totB - totA, { sign: true }) : '—'}</th><th class="hide-sm"></th></tr></tfoot>
      </table></div></div>`;
    root.onchange = (e) => {
      if (e.target.id === 'bmonth') { state.budgetMonth = e.target.value; budget(root); return; }
      const c = e.target.dataset.budget;
      if (!c) return;
      const v = Number(e.target.value) || 0;
      const cur = S.all('budgets').find((b) => b.category === c);
      if (cur) S.update('budgets', cur.id, { monthly: v }); else if (v) S.upsert('budgets', { category: c, monthly: v });
    };
  }

  // ---- Equity / cap table ------------------------------------------------------------------
  function equity(root) {
    const list = U.sortBy(S.all('shareholders'), (s) => -(Number(s.shares) || 0));
    const total = list.reduce((t, s) => t + (Number(s.shares) || 0), 0);
    const contributed = (s) => (s.personId ? Fin.contributions(s.personId) : 0);
    const totalContrib = list.reduce((t, s) => t + contributed(s), 0);
    root.innerHTML = `
      ${head('Who owns the company, how it vests, and who put money in')}
      ${tabs('equity')}
      <div class="banner info">${UI.icon('landmark')}<div>Common practice: founder shares vest over <b>4 years with a 1-year cliff</b>, so if someone leaves early the unvested part returns to the company. Reserve an <b>option pool</b> (10–15%) for future key hires before raising. Any change here should be approved by the board as a resolution.</div></div>
      <div class="kpis">
        <div class="card kpi"><span class="kpi-label">${UI.icon('landmark')}Shares (fully diluted)</span><span class="kpi-value">${esc(total.toLocaleString('en-US'))}</span><span class="kpi-sub">${U.plural(list.length, 'holder')}</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('dollar')}Capital contributed</span><span class="kpi-value">${money(totalContrib, { compact: true })}</span><span class="kpi-sub">from Founder capital & Investment transactions</span></div>
      </div>
      ${list.length ? `<div class="card"><div class="table-wrap"><table class="table">
        <thead><tr><th>Holder</th><th class="hide-sm">Class</th><th class="num">Shares</th><th class="num">Ownership</th><th class="num">Vested today</th><th class="hide-sm">Vesting</th><th class="num hide-sm">Capital in</th></tr></thead>
        <tbody>${list.map((s) => {
          const v = Fin.vested(s);
          const sh = Number(s.shares) || 0;
          return `<tr class="clickable" data-act="editShareholder" data-id="${s.id}">
            <td><div class="cell-main">${UI.avatar(s.personId ? S.nameOf(s.personId) : s.name || '?', 'sm')}<div><b>${esc(s.personId ? S.nameOf(s.personId) : s.name || 'Unnamed')}</b><small>${esc(s.notes || '')}</small></div></div></td>
            <td class="hide-sm">${UI.badge(s.shareClass || 'Common (founders)', s.shareClass === 'Options pool' ? 'amber' : s.shareClass === 'SAFE / convertible' ? 'violet' : s.shareClass === 'Preferred' ? 'blue' : 'teal')}</td>
            <td class="num">${esc(sh.toLocaleString('en-US'))}</td>
            <td class="num"><b>${total ? `${((sh / total) * 100).toFixed(1)}%` : '—'}</b></td>
            <td class="num">${sh ? `${Math.round((v / sh) * 100)}%` : '—'}<small class="block muted">${esc(v.toLocaleString('en-US'))}</small></td>
            <td class="hide-sm small">${s.vestingStart && Number(s.vestingMonths) ? `${Math.round(s.vestingMonths / 12 * 10) / 10}y${Number(s.cliffMonths) ? `, ${s.cliffMonths}-mo cliff` : ''} from ${esc(U.fmtDate(s.vestingStart))}` : '<span class="muted">Fully vested</span>'}</td>
            <td class="num hide-sm">${contributed(s) ? money(contributed(s), { compact: true }) : '<span class="muted">—</span>'}</td>
          </tr>`;
        }).join('')}</tbody></table></div></div>
        <div style="margin-top:12px"><button class="btn btn-primary" data-act="newShareholder">${UI.icon('plus')}Add holder</button></div>`
      : `<div class="card">${UI.empty('landmark', 'No cap table yet', 'Add each founder with their shares and vesting schedule, and the option pool if you reserve one.', '<button class="btn btn-primary" data-act="newShareholder">Add the first holder</button> <button class="btn" data-act="newShareholder" data-founders="1">Add the founders</button>')}</div>`}`;
  }

  function render(root, params = []) {
    const tab = params[0] || '';
    root.onchange = null;
    root.oninput = null;
    ({ transactions, accounts, subscriptions, budget, equity }[tab] || overview)(root);
  }

  // ---- Forms -------------------------------------------------------------------------------
  function editTransaction(id, preset = {}) {
    const t = id ? S.get('transactions', id) : null;
    if (!S.all('accounts').length) {
      UI.toast('Add an account first: where does this money come from or go to?', 'info', { actionLabel: 'Add account', onAction: () => editAccount() });
      return;
    }
    const firstAcc = S.all('accounts').find((a) => !a.archived)?.id || '';
    const v = t ? { ...t, kind: t.kind || 'normal' } : { kind: 'normal', date: U.today(), status: 'Cleared', accountId: state.account || firstAcc, category: 'opex-software', ...preset };
    const fields = [
      { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'normal', label: 'Income, expense or financing' }, { value: 'transfer', label: 'Transfer between our accounts' }] },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'description', label: 'Description', required: true, placeholder: 'e.g. Google Workspace October, Invoice #12 to client', span: 2 },
      { name: 'category', label: 'Category', type: 'select', options: catOptions(), showWhen: 'kind:normal', help: 'Revenue and costs feed the P&L; financing (capital, loans) does not.' },
      { name: 'amount', label: 'Amount', type: 'number', step: 'any', min: 0, required: true, help: 'Always positive; the category decides if it is money in or out.' },
      { name: 'accountId', label: 'Account', type: 'select', options: accountOptions(), required: true, help: 'The amount is in this account’s currency.' },
      { name: 'toAccountId', label: 'To account', type: 'select', options: accountOptions(), empty: 'Choose…', showWhen: 'kind:transfer' },
      { name: 'toAmount', label: 'Amount received', type: 'number', step: 'any', min: 0, showWhen: 'kind:transfer', help: 'Only if the currencies differ (e.g. USD → COP).' },
      { name: 'status', label: 'Status', type: 'select', options: S.TXN_STATUS, help: 'Planned movements show in “Next 30 days” but do not touch balances.' },
      { name: 'fxRate', label: 'Exchange rate (COP per USD)', type: 'number', step: 'any', min: 0, placeholder: String(Fin.cfg().usdRate), help: 'Optional: the actual rate of this movement.' },
      { name: 'contributorId', label: 'Contributed by', type: 'select', options: peopleOptions(), empty: '—', showWhen: 'category:fin-capital|fin-investment', help: 'Counts towards this person’s capital in the cap table.' },
      { type: 'section', label: 'Details', showWhen: 'kind:normal' },
      { name: 'orgId', label: 'Client / vendor', type: 'select', options: UI.opts.orgs(), empty: '—', showWhen: 'kind:normal' },
      { name: 'invoiceRef', label: 'Invoice / receipt number', showWhen: 'kind:normal' },
      { name: 'paidBy', label: 'Paid personally by', type: 'select', options: peopleOptions(), empty: 'No — paid by the company', showWhen: 'kind:normal', help: 'The company owes this person until reimbursed.' },
      { name: 'reimbursed', label: 'Reimbursed', type: 'checkbox', checkLabel: 'Already paid back', showWhen: 'kind:normal' },
      { name: 'receiptUrl', label: 'Receipt or invoice link', type: 'url', placeholder: 'https://drive.google.com/…', span: 2 },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2 },
    ];
    UI.formModal({
      title: t ? 'Edit transaction' : preset.kind === 'transfer' ? 'Transfer between accounts' : 'New transaction',
      fields, values: v, size: 'lg', submitText: t ? 'Save' : 'Add transaction',
      onSubmit: (data) => {
        if (!(data.amount > 0)) { UI.toast('Enter an amount greater than zero', 'error'); return false; }
        if (data.receiptUrl && !/^https:\/\//i.test(data.receiptUrl)) { UI.toast('Use an https:// link for the receipt', 'error'); return false; }
        if (data.kind === 'transfer') {
          if (!data.toAccountId || data.toAccountId === data.accountId) { UI.toast('Choose a different destination account', 'error'); return false; }
          Object.assign(data, { category: '', orgId: '', paidBy: '', reimbursed: false, contributorId: '' });
        } else {
          data.toAccountId = ''; data.toAmount = null;
          if (!['fin-capital', 'fin-investment'].includes(data.category)) data.contributorId = '';
        }
        if (data.kind === 'normal') delete data.kind;
        const rec = S.upsert('transactions', t ? { ...data, id: t.id, kind: data.kind || '' } : { ...data, subscriptionId: preset.subscriptionId || '', createdBy: S.currentUser()?.id || '' });
        UI.toast(t ? 'Transaction saved' : 'Transaction added', 'success');
        return rec;
      },
      onDelete: t ? () => { S.remove('transactions', t.id); UI.toast('Transaction deleted'); } : null,
      deleteConfirm: 'Delete this transaction? Balances and reports will change.',
    });
  }

  function editAccount(id) {
    const a = id ? S.get('accounts', id) : null;
    UI.formModal({
      title: a ? 'Edit account' : 'New account',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Bancolombia Ahorros, Carlos wallet (company money)', span: 2 },
        { name: 'type', label: 'Type', type: 'select', options: S.ACCOUNT_TYPES },
        { name: 'currency', label: 'Currency', type: 'select', options: S.CURRENCIES },
        { name: 'openingBalance', label: 'Opening balance', type: 'number', step: 'any', help: 'Balance on the opening date; credit cards: negative if you owe.' },
        { name: 'openingDate', label: 'Opening date', type: 'date' },
        { name: 'institution', label: 'Bank / provider' },
        { name: 'last4', label: 'Last 4 digits', placeholder: '1234', help: 'Only the last 4, never the full number.' },
        { name: 'archived', label: 'Status', type: 'checkbox', checkLabel: 'Archived (closed account)' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2 },
      ],
      values: a || { type: 'Bank account', currency: Fin.base(), openingBalance: 0, openingDate: U.today() },
      onSubmit: (data) => {
        data.last4 = (data.last4 || '').replace(/\D/g, '').slice(-4);
        S.upsert('accounts', a ? { ...data, id: a.id } : data);
        UI.toast(a ? 'Account saved' : 'Account added', 'success');
      },
      onDelete: a ? () => {
        if (S.all('transactions').some((t) => t.accountId === a.id || t.toAccountId === a.id)) { UI.toast('This account has transactions. Archive it instead.', 'error'); return; }
        S.remove('accounts', a.id);
      } : null,
    });
  }

  function editSubscription(id) {
    const s = id ? S.get('subscriptions', id) : null;
    UI.formModal({
      title: s ? 'Edit subscription or license' : 'New subscription or license',
      intro: 'One row per tool. For per-agent licenses choose “Per seat / month” and the number of seats; the cost per agent appears on the Subscriptions tab.',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Five9 agent license, Google Workspace', span: 2 },
        { name: 'need', label: 'Why we need it', type: 'select', options: NEEDS, help: 'Business need: to operate. Risk & compliance: to stay safe and legal.' },
        { name: 'category', label: 'Category', type: 'select', options: catOptions(['cogs', 'opex']), help: 'Licenses agents use to serve clients → “Licenses for client delivery”.' },
        { name: 'cadence', label: 'Billing', type: 'select', options: S.SUB_CADENCE },
        { name: 'seats', label: 'Seats / agents', type: 'number', min: 1, showWhen: 'cadence:Per seat / month' },
        { name: 'amount', label: 'Price', type: 'number', step: 'any', min: 0, required: true, help: 'Per period, or per seat.' },
        { name: 'currency', label: 'Currency', type: 'select', options: S.CURRENCIES },
        { name: 'nextDate', label: 'Next charge', type: 'date' },
        { name: 'accountId', label: 'Charged to', type: 'select', options: accountOptions(), empty: '—' },
        { name: 'orgId', label: 'Vendor', type: 'select', options: UI.opts.orgs(), empty: '—' },
        { name: 'ownerId', label: 'Owner', type: 'select', options: UI.opts.users(), empty: '—' },
        { name: 'status', label: 'Status', type: 'select', options: SUB_STATUS },
        { name: 'url', label: 'Plan / pricing link', type: 'url', placeholder: 'https://' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2, placeholder: 'What happens if we drop it? Alternatives?' },
      ],
      values: s || { need: 'Business need', category: 'opex-software', cadence: 'Monthly', currency: 'USD', seats: 1, status: 'Active', ownerId: S.currentUser()?.id || '' },
      size: 'lg',
      onSubmit: (data) => {
        if (data.url && !/^https:\/\//i.test(data.url)) { UI.toast('Use an https:// link', 'error'); return false; }
        S.upsert('subscriptions', s ? { ...data, id: s.id } : data);
        UI.toast(s ? 'Saved' : 'Subscription added', 'success');
      },
      onDelete: s ? () => S.remove('subscriptions', s.id) : null,
    });
  }

  function recordCharge(id) {
    const s = S.get('subscriptions', id);
    if (!s) return;
    const acc = S.get('accounts', s.accountId) || S.all('accounts').find((a) => !a.archived);
    if (!acc) { UI.toast('Add an account first', 'error', { actionLabel: 'Add account', onAction: () => editAccount() }); return; }
    const date = s.nextDate && s.nextDate <= U.today() ? s.nextDate : U.today();
    const amount = Math.round(Fin.convert(Fin.subPeriodAmount(s), s.currency || Fin.base(), acc.currency) * 100) / 100;
    const before = s.nextDate || '';
    const txn = S.upsert('transactions', {
      date, description: `${s.name}${s.cadence === 'Annual' ? ' (annual)' : ` ${Fin.monthLabel(Fin.monthKey(date))}`}`, category: s.category || 'opex-software', amount, accountId: acc.id,
      status: 'Cleared', orgId: s.orgId || '', subscriptionId: s.id, notes: s.currency !== acc.currency ? `${Fin.fmt(Fin.subPeriodAmount(s), s.currency)} converted at ${Fin.cfg().usdRate}` : '', createdBy: S.currentUser()?.id || '',
    });
    S.update('subscriptions', s.id, { nextDate: Fin.nextDateAfter({ ...s, nextDate: before || date }), lastCharged: date });
    UI.toast(`Recorded ${Fin.fmt(amount, acc.currency)} in ${acc.name}`, 'success', {
      actionLabel: 'Undo', onAction: () => { S.remove('transactions', txn.id); S.update('subscriptions', s.id, { nextDate: before }); },
    });
  }

  function editShareholder(id, ds = {}) {
    if (!id && ds.founders) {
      const founders = S.all('users');
      if (!founders.length) { UI.toast('Add your team in Settings first', 'error'); return; }
      const each = Math.floor(9000000 / founders.length);
      founders.forEach((u) => S.upsert('shareholders', { personId: u.id, shareClass: 'Common (founders)', shares: each, vestingStart: U.today(), vestingMonths: 48, cliffMonths: 12 }, { silent: true }));
      S.upsert('shareholders', { name: 'Option pool (unallocated)', shareClass: 'Options pool', shares: 10000000 - each * founders.length, notes: 'Reserved for future key hires' });
      UI.toast('Founders added with equal shares and a 10% pool. Adjust the numbers to your agreement.', 'success');
      return;
    }
    const s = id ? S.get('shareholders', id) : null;
    UI.formModal({
      title: s ? 'Edit holder' : 'Add holder',
      fields: [
        { name: 'personId', label: 'Person', type: 'select', options: peopleOptions(), empty: '— Not in the CRM (type a name) —' },
        { name: 'name', label: 'Name (if not in the CRM)', placeholder: 'e.g. Option pool, Angel investor' },
        { name: 'shareClass', label: 'Class', type: 'select', options: S.SHARE_CLASSES },
        { name: 'shares', label: 'Shares', type: 'number', min: 0, required: true },
        { name: 'vestingStart', label: 'Vesting start', type: 'date', help: 'Leave empty if fully vested.' },
        { name: 'vestingMonths', label: 'Vesting months', type: 'number', min: 0, help: '48 = 4 years' },
        { name: 'cliffMonths', label: 'Cliff months', type: 'number', min: 0, help: '12 = nothing vests before 1 year' },
        { name: 'notes', label: 'Notes', placeholder: 'e.g. Approved in resolution 2026-01', span: 2 },
      ],
      values: s || { shareClass: 'Common (founders)', vestingStart: U.today(), vestingMonths: 48, cliffMonths: 12 },
      onSubmit: (data) => {
        if (!data.personId && !data.name) { UI.toast('Choose a person or type a name', 'error'); return false; }
        S.upsert('shareholders', s ? { ...data, id: s.id } : data);
      },
      onDelete: s ? () => S.remove('shareholders', s.id) : null,
    });
  }

  function editFinanceSettings() {
    const c = Fin.cfg();
    UI.formModal({
      title: 'Finance settings',
      fields: [
        { name: 'baseCurrency', label: 'Reporting currency', type: 'select', options: S.CURRENCIES, help: 'Every report, budget and KPI is shown in this currency.' },
        { name: 'usdRate', label: 'COP per 1 USD', type: 'number', step: 'any', min: 1, required: true, help: 'Used when a movement has no rate of its own.' },
        { name: 'agents', label: 'Agents in operation', type: 'number', min: 0, help: 'Used for license cost per agent.' },
      ],
      values: c,
      onSubmit: (data) => { S.setSettings({ finance: { ...c, ...data, usdRate: data.usdRate || c.usdRate, agents: data.agents || 0 } }); UI.toast('Finance settings saved', 'success'); },
    });
  }

  // ---- Exports -----------------------------------------------------------------------------
  function exportTransactions() {
    const rows = filtered();
    U.download(`aetherium-transactions-${U.today()}.csv`, U.toCSV(rows, [
      { label: 'Date', get: (t) => t.date }, { label: 'Description', get: (t) => t.description },
      { label: 'Type', get: (t) => (t.kind === 'transfer' ? 'Transfer' : Fin.group(Fin.cat(t.category)?.group)?.label || '') },
      { label: 'Category', get: (t) => (t.kind === 'transfer' ? '' : catName(t.category)) },
      { label: 'Account', get: (t) => accName(t.accountId) }, { label: 'To account', get: (t) => (t.toAccountId ? accName(t.toAccountId) : '') },
      { label: 'Currency', get: (t) => Fin.curOf(t) }, { label: 'Signed amount', get: (t) => Fin.signed(t) },
      { label: `Amount (${Fin.base()})`, get: (t) => Math.round(Fin.baseAmount(t) * Math.sign(Fin.signed(t)) * 100) / 100 },
      { label: 'Status', get: (t) => t.status || 'Cleared' }, { label: 'Client / vendor', get: (t) => S.orgName(t.orgId) },
      { label: 'Paid personally by', get: (t) => (t.paidBy ? S.nameOf(t.paidBy) : '') }, { label: 'Reimbursed', get: (t) => (t.paidBy ? (t.reimbursed ? 'Yes' : 'No') : '') },
      { label: 'Invoice', get: (t) => t.invoiceRef }, { label: 'Receipt', get: (t) => t.receiptUrl }, { label: 'Notes', get: (t) => t.notes },
    ]), 'text/csv');
  }
  function exportSubscriptions() {
    const agents = Fin.agentCount();
    U.download(`aetherium-licenses-${U.today()}.csv`, U.toCSV(U.sortBy(S.all('subscriptions'), (s) => `${NEEDS.indexOf(s.need || 'Business need')}${s.name}`), [
      { label: 'Need', get: (s) => s.need || 'Business need' }, { label: 'Name', get: (s) => s.name }, { label: 'Vendor', get: (s) => S.orgName(s.orgId) },
      { label: 'Category', get: (s) => catName(s.category) }, { label: 'Billing', get: (s) => s.cadence }, { label: 'Seats', get: (s) => (s.cadence === 'Per seat / month' ? s.seats || 1 : '') },
      { label: 'Price', get: (s) => s.amount }, { label: 'Currency', get: (s) => s.currency }, { label: `Monthly (${Fin.base()})`, get: (s) => Math.round(Fin.subMonthly(s)) },
      { label: `Per agent / month (${Fin.base()})`, get: (s) => (agents && s.category === 'cogs-licenses' ? Math.round(Fin.subMonthly(s) / agents) : '') },
      { label: 'Status', get: (s) => s.status }, { label: 'Owner', get: (s) => S.nameOf(s.ownerId) }, { label: 'Next charge', get: (s) => s.nextDate }, { label: 'Notes', get: (s) => s.notes },
    ]), 'text/csv');
  }
  function exportPL() {
    const months = Fin.monthsBack(12);
    const lines = [['Revenue', (r) => r.revenue], ['Cost of revenue', (r) => r.cogs], ['Gross profit', (r) => r.revenue - r.cogs], ['Operating expenses', (r) => r.opex], ['Net income', (r) => r.net], ['Financing in', (r) => r.financingIn], ['Financing out', (r) => r.financingOut],
      ...S.FIN_CATEGORIES.filter((c) => c.group !== 'financing').map((c) => [`  ${c.name}`, (r) => r.byCategory[c.id] || 0])];
    const data = months.map(Fin.pl);
    U.download(`aetherium-pl-${U.today()}.csv`, U.toCSV(lines, [{ label: `Line (${Fin.base()})`, get: (l) => l[0] }, ...months.map((m, i) => ({ label: Fin.monthLabel(m), get: (l) => Math.round(l[1](data[i])) }))]), 'text/csv');
  }

  return {
    render,
    actions: {
      newTransaction: () => editTransaction(),
      newTransfer: () => editTransaction(null, { kind: 'transfer' }),
      editTransaction: (ds) => editTransaction(ds.id),
      newAccount: () => editAccount(),
      editAccount: (ds) => editAccount(ds.id),
      newSubscription: () => editSubscription(),
      editSubscription: (ds) => editSubscription(ds.id),
      recordCharge: (ds) => recordCharge(ds.id),
      newShareholder: (ds) => editShareholder(null, ds),
      editShareholder: (ds) => editShareholder(ds.id),
      editFinanceSettings: () => editFinanceSettings(),
      exportTransactions, exportSubscriptions, exportPL,
    },
  };
})();
