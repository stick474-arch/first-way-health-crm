/* Agents & operations — the agent roster, the client operations they staff, the license kit each role
   needs (business need vs risk & compliance), who holds which license, seat utilization, and what each
   operation costs and earns per month. Licenses come from Finance → Subscriptions & licenses. */
Views.ops = (() => {
  const S = Store;
  const esc = U.esc;
  const state = { q: '', status: 'working', op: '', role: '' };
  const TABS = [['', 'Overview'], ['agents', 'Agents'], ['operations', 'Operations'], ['licenses', 'Licenses'], ['kits', 'License kits']];
  const WORKING = ['Onboarding', 'Active', 'On leave'];
  const STATUS_COLOR = { Recruiting: 'slate', Onboarding: 'blue', Active: 'green', 'On leave': 'amber', Offboarded: 'red' };
  const OPS_COLOR = { Planning: 'slate', 'Ramp-up': 'blue', Live: 'green', Paused: 'amber', Closed: 'red' };
  const NEED_ORDER = { 'Risk & compliance': 0, 'Business need': 1, 'Nice to have': 2 };

  // ---- Calculations ------------------------------------------------------------------------
  const money = (v, o) => esc(Fin.fmt(v, Fin.base(), o));
  const subs = () => U.sortBy(S.all('subscriptions').filter((s) => s.status !== 'Cancelled'), (s) => `${NEED_ORDER[s.need || 'Business need'] ?? 1}${s.name.toLowerCase()}`);
  const subName = (id) => S.get('subscriptions', id)?.name || 'Removed license';
  const kitOf = (role) => ((S.settings.ops || {}).kits || {})[role] || [];
  const opOf = (a) => S.get('operations', a.operationId);
  const working = (a) => WORKING.includes(a.status);
  const required = (a) => [...new Set([...kitOf(a.role || 'Agent'), ...(opOf(a)?.requiredLicenses || [])])].filter((id) => S.get('subscriptions', id));
  const missing = (a) => (working(a) ? required(a).filter((id) => !(a.licenses || []).includes(id)) : []);
  const holders = (subId) => S.all('agents').filter((a) => (a.licenses || []).includes(subId));
  const perSeat = (s) => s.cadence === 'Per seat / month';
  function seatCost(s) {
    if (!s) return 0;
    if (perSeat(s)) return Fin.toBase(Number(s.amount) || 0, s.currency || Fin.base());
    return Fin.subMonthly(s) / Math.max(1, holders(s.id).filter(working).length);
  }
  const licenseCost = (a) => (a.licenses || []).reduce((t, id) => t + seatCost(S.get('subscriptions', id)), 0);
  const payroll = (a) => Fin.toBase(Number(a.monthlyCost) || 0, a.currency || Fin.base());
  const agentCost = (a) => payroll(a) + licenseCost(a);
  function opStats(op) {
    const team = S.all('agents').filter((a) => a.operationId === op.id);
    const active = team.filter((a) => a.status === 'Active');
    const revenue = Fin.toBase(Number(op.ratePerAgent) || 0, op.currency || Fin.base()) * active.length;
    const pay = team.filter(working).reduce((t, a) => t + payroll(a), 0);
    const lic = team.filter(working).reduce((t, a) => t + licenseCost(a), 0);
    const cost = pay + lic;
    return { team, active, revenue, pay, lic, cost, margin: revenue - cost, pct: revenue ? (revenue - cost) / revenue : null, gaps: team.reduce((n, a) => n + missing(a).length, 0) };
  }
  function seats(s) {
    const used = holders(s.id).filter(working).length;
    const bought = perSeat(s) ? Number(s.seats) || 0 : null;
    return { used, bought, unused: bought == null ? 0 : Math.max(0, bought - used), short: bought == null ? 0 : Math.max(0, used - bought) };
  }
  const leftovers = () => S.all('agents').filter((a) => !working(a) && (a.licenses || []).length);

  const tabs = (active) => `<div class="segmented" role="tablist" aria-label="Operations sections" style="margin-bottom:16px">
    ${TABS.map(([id, label]) => `<a class="seg ${active === id ? 'active' : ''}" role="tab" href="#/ops${id ? `/${id}` : ''}" ${active === id ? 'aria-selected="true"' : ''}>${label}</a>`).join('')}</div>`;
  const head = (sub) => Parts.pageHead('Agents & operations', sub,
    `<button class="btn" data-act="newOperation">${UI.icon('building')}<span class="hide-sm">New operation</span></button>
     <button class="btn btn-primary" data-act="newAgent">${UI.icon('plus')}New agent</button>`);
  const licChip = (id, cls = '') => { const s = S.get('subscriptions', id); return s ? `<span class="lic-chip ${cls} ${s.need === 'Risk & compliance' ? 'risk' : ''}" title="${esc(s.need || 'Business need')}">${esc(s.name)}</span>` : ''; };

  // ---- Overview ----------------------------------------------------------------------------
  function overview(root) {
    const agents = S.all('agents');
    const active = agents.filter((a) => a.status === 'Active');
    const onb = agents.filter((a) => a.status === 'Onboarding');
    const ops = U.sortBy(S.all('operations').filter((o) => o.status !== 'Closed'), 'name');
    const planned = ops.reduce((t, o) => t + (Number(o.plannedAgents) || 0), 0);
    const lic = agents.filter(working).reduce((t, a) => t + licenseCost(a), 0);
    const waste = subs().reduce((t, s) => t + seats(s).unused * seatCost(s), 0);
    const gaps = agents.filter(working).reduce((t, a) => t + missing(a).length, 0);
    const avg = active.length ? active.reduce((t, a) => t + agentCost(a), 0) / active.length : null;
    const left = leftovers();
    const short = subs().filter((s) => seats(s).short);
    root.innerHTML = `
      ${head('Who works on which client, with which licenses, and what it costs')}
      ${tabs('')}
      ${!agents.length && !ops.length ? `<div class="card fin-start"><div class="card-body">
        <h3 style="margin-top:0">Set up operations in four steps</h3>
        <ol class="steps">
          <li><b>List your licenses</b> in Finance → Subscriptions & licenses (seats, price, business need or risk & compliance).</li>
          <li><b>Define license kits</b>: what every agent, team lead or QA needs to work and to stay compliant.</li>
          <li><b>Create an operation</b> per client program, with planned agents, the rate you bill per agent and any extra licenses the client requires.</li>
          <li><b>Add agents</b>, assign them to an operation and tick their licenses. Gaps, unused seats and offboarding risks show up here.</li>
        </ol>
        <div class="row wrap"><a class="btn" href="#/finance/subscriptions">Licenses</a><a class="btn" href="#/ops/kits">License kits</a><button class="btn" data-act="newOperation">New operation</button><button class="btn btn-primary" data-act="newAgent">New agent</button></div>
      </div></div>` : ''}
      ${left.length ? `<div class="banner danger">${UI.icon('shield')}<div><b>Security risk: ${U.plural(left.length, 'person', 'people')} who no longer work${left.length === 1 ? 's' : ''} here still hold${left.length === 1 ? 's' : ''} licenses</b> (${left.map((a) => esc(a.name)).join(', ')}). <a href="#" data-act="opsRevokeAll">Revoke now and create the tasks</a></div></div>` : ''}
      ${short.length ? `<div class="banner warn">${UI.icon('alert')}<div><b>More people than seats:</b> ${short.map((s) => `${esc(s.name)} (${seats(s).used}/${seats(s).bought})`).join(', ')}. Buy seats or unassign someone in <a href="#/ops/licenses">Licenses</a>.</div></div>` : ''}
      <div class="kpis">
        <a class="card kpi" href="#/ops/agents"><span class="kpi-label">${UI.icon('users')}Active agents</span><span class="kpi-value">${active.length}${planned ? `<small class="muted"> / ${planned}</small>` : ''}</span><span class="kpi-sub">${onb.length} onboarding · ${agents.filter((a) => a.status === 'Recruiting').length} recruiting</span></a>
        <a class="card kpi" href="#/ops/licenses"><span class="kpi-label">${UI.icon('list')}Licenses in use</span><span class="kpi-value">${money(lic, { compact: true })}</span><span class="kpi-sub">per month · ${active.length ? `${money(lic / Math.max(1, agents.filter(working).length), { compact: true })} per person` : 'no agents yet'}</span></a>
        <a class="card kpi ${gaps ? 'alert' : ''}" href="#/ops/licenses"><span class="kpi-label">${UI.icon('alert')}Missing licenses</span><span class="kpi-value">${gaps}</span><span class="kpi-sub">required by kit or client, not assigned</span></a>
        <a class="card kpi ${waste ? 'alert' : ''}" href="#/ops/licenses"><span class="kpi-label">${UI.icon('dollar')}Unused seats</span><span class="kpi-value">${money(waste, { compact: true })}</span><span class="kpi-sub">per month paid for nobody</span></a>
        <div class="card kpi"><span class="kpi-label">${UI.icon('userCheck')}Cost per active agent</span><span class="kpi-value">${avg != null ? money(avg, { compact: true }) : '—'}</span><span class="kpi-sub">pay + licenses, per month</span></div>
      </div>
      <h2 class="section-title">Operations</h2>
      ${ops.length ? `<div class="members">${ops.map(opCard).join('')}</div>` : `<div class="card">${UI.empty('building', 'No operations yet', 'An operation is a client program your agents work on. It tells you headcount vs plan, required licenses and the margin per month.', '<button class="btn btn-primary" data-act="newOperation">Create an operation</button>')}</div>`}`;
  }

  function opCard(o) {
    const st = opStats(o);
    const org = S.get('organizations', o.orgId);
    const planned = Number(o.plannedAgents) || 0;
    return `<div class="card member clickable" data-act="editOperation" data-id="${o.id}" role="button" tabindex="0">
      <div class="member-top">${org ? UI.orgLogo(org, 'sm') : `<span class="acc-ic">${UI.icon('building')}</span>`}<div><b>${esc(o.name)}</b><small>${esc(org?.name || 'No client linked')}</small></div></div>
      <div class="row wrap">${UI.badge(o.status || 'Planning', OPS_COLOR[o.status] || 'slate')}${st.gaps ? UI.badge(U.plural(st.gaps, "missing license"), "red") : ''}</div>
      <div class="term">${st.active.length}/${planned || '—'} agents active<div class="term-track"><div class="term-fill" style="width:${planned ? Math.min(100, Math.round((st.active.length / planned) * 100)) : 0}%"></div></div></div>
      <dl class="info ops-mini">
        <dt>Revenue / month</dt><dd>${st.revenue ? money(st.revenue, { compact: true }) : '—'}</dd>
        <dt>Cost / month</dt><dd>${money(st.cost, { compact: true })} <small class="muted">(${money(st.lic, { compact: true })} licenses)</small></dd>
        <dt>Margin</dt><dd class="${!st.revenue ? "" : st.margin < 0 ? "neg" : "pos"}"><b>${st.revenue ? `${money(st.margin, { compact: true })} · ${Math.round(st.pct * 100)}%` : '—'}</b></dd>
      </dl>
    </div>`;
  }

  // ---- Agents ------------------------------------------------------------------------------
  function agentRows() {
    const list = U.sortBy(S.all('agents').filter((a) => (state.status === 'all' || (state.status === 'working' ? working(a) : a.status === state.status))
      && (!state.op || (state.op === 'none' ? !a.operationId : a.operationId === state.op)) && (!state.role || a.role === state.role)
      && U.matches(state.q, a.name, a.email, a.languages, opOf(a)?.name)), (a) => `${['Active', 'On leave', 'Onboarding', 'Recruiting', 'Offboarded'].indexOf(a.status)}${a.name.toLowerCase()}`);
    if (!S.all('agents').length) return UI.empty('users', 'No agents yet', 'Add the people who work your operations. Their licenses, cost and client show up across the module.', '<button class="btn btn-primary" data-act="newAgent">Add the first agent</button>');
    if (!list.length) return UI.empty('search', 'No agents match these filters');
    return `<table class="table"><thead><tr><th>Agent</th><th>Operation</th><th class="hide-sm">Role · shift</th><th>Status</th><th>Licenses</th><th class="num hide-sm">Cost / month</th></tr></thead>
      <tbody>${list.map((a) => {
        const miss = missing(a);
        return `<tr class="clickable" data-act="editAgent" data-id="${a.id}">
          <td><div class="cell-main">${UI.avatar(a.name, 'sm')}<div><b>${esc(a.name)}</b><small>${esc([a.email, a.location, a.languages].filter(Boolean).join(' · '))}</small></div></div></td>
          <td>${esc(opOf(a)?.name || '—')}</td>
          <td class="hide-sm small">${esc([a.role || 'Agent', a.shift].filter(Boolean).join(' · '))}</td>
          <td>${UI.badge(a.status || 'Active', STATUS_COLOR[a.status] || 'slate')}</td>
          <td><div class="lic-chips">${(a.licenses || []).slice(0, 3).map((id) => licChip(id)).join('')}${(a.licenses || []).length > 3 ? `<span class="small muted">+${a.licenses.length - 3}</span>` : ''}${miss.length ? `<span class="lic-chip missing" title="Missing: ${esc(miss.map(subName).join(', '))}">${miss.length} missing</span>` : ''}${!working(a) && (a.licenses || []).length ? '<span class="lic-chip missing">revoke!</span>' : ''}</div></td>
          <td class="num hide-sm">${money(agentCost(a), { compact: true })}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  function agents(root) {
    root.innerHTML = `
      ${head('The people who staff your operations')}
      ${tabs('agents')}
      <div class="filters">
        <input class="input" type="search" id="aq" placeholder="Filter agents…" value="${esc(state.q)}" aria-label="Filter agents">
        <select class="select" data-filter="status" aria-label="Status">${UI.selectOptions([{ value: 'working', label: 'Working (onboarding, active, on leave)' }, ...S.AGENT_STATUS, { value: 'all', label: 'Everyone' }], state.status)}</select>
        <select class="select" data-filter="op" aria-label="Operation">${UI.selectOptions([...S.all('operations').map((o) => ({ value: o.id, label: o.name })), { value: 'none', label: 'Not assigned' }], state.op, 'All operations')}</select>
        <select class="select" data-filter="role" aria-label="Role">${UI.selectOptions(S.AGENT_ROLES, state.role, 'All roles')}</select>
        <button class="btn" data-act="exportAgents">${UI.icon('download')}<span class="hide-sm">Export CSV</span></button>
      </div>
      <div class="card"><div class="table-wrap" id="alist">${agentRows()}</div></div>`;
    root.oninput = (e) => { if (e.target.id === 'aq') { state.q = e.target.value; root.querySelector('#alist').innerHTML = agentRows(); } };
    root.onchange = (e) => { const f = e.target.dataset.filter; if (f) { state[f] = e.target.value; root.querySelector('#alist').innerHTML = agentRows(); } };
  }

  // ---- Operations --------------------------------------------------------------------------
  function operations(root) {
    const list = U.sortBy(S.all('operations'), (o) => `${o.status === 'Closed' ? 1 : 0}${o.name.toLowerCase()}`);
    const totals = list.filter((o) => o.status !== 'Closed').map(opStats).reduce((t, s) => ({ rev: t.rev + s.revenue, cost: t.cost + s.cost }), { rev: 0, cost: 0 });
    root.innerHTML = `
      ${head('Client programs: headcount vs plan, required licenses and monthly margin')}
      ${tabs('operations')}
      ${list.length ? `<div class="kpis">
        <div class="card kpi"><span class="kpi-label">${UI.icon('dollar')}Revenue / month</span><span class="kpi-value">${money(totals.rev, { compact: true })}</span><span class="kpi-sub">rate × active agents</span></div>
        <div class="card kpi"><span class="kpi-label">${UI.icon('activity')}Delivery cost / month</span><span class="kpi-value">${money(totals.cost, { compact: true })}</span><span class="kpi-sub">pay + licenses of assigned agents</span></div>
        <div class="card kpi ${totals.rev - totals.cost < 0 ? 'alert' : ''}"><span class="kpi-label">${UI.icon('star')}Contribution margin</span><span class="kpi-value">${money(totals.rev - totals.cost, { compact: true })}</span><span class="kpi-sub">${totals.rev ? `${Math.round(((totals.rev - totals.cost) / totals.rev) * 100)}% of revenue` : '—'}</span></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="table">
        <thead><tr><th>Operation</th><th>Status</th><th class="num">Agents</th><th class="hide-sm">Client requires</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Margin</th></tr></thead>
        <tbody>${list.map((o) => { const st = opStats(o); return `<tr class="clickable" data-act="editOperation" data-id="${o.id}">
          <td><div class="cell-main"><div><b>${esc(o.name)}</b><small>${esc([S.orgName(o.orgId), o.ownerId ? `Lead: ${S.nameOf(o.ownerId)}` : ''].filter(Boolean).join(' · '))}</small></div></div></td>
          <td>${UI.badge(o.status || 'Planning', OPS_COLOR[o.status] || 'slate')}</td>
          <td class="num">${st.active.length}/${Number(o.plannedAgents) || '—'}</td>
          <td class="hide-sm"><div class="lic-chips">${(o.requiredLicenses || []).map((id) => licChip(id)).join('') || '<span class="muted small">Kit only</span>'}</div></td>
          <td class="num">${st.revenue ? money(st.revenue, { compact: true }) : '—'}</td>
          <td class="num">${money(st.cost, { compact: true })}</td>
          <td class="num ${st.margin < 0 ? 'neg' : 'pos'}"><b>${st.revenue ? `${Math.round(st.pct * 100)}%` : '—'}</b></td>
        </tr>`; }).join('')}</tbody></table></div></div>`
      : `<div class="card">${UI.empty('building', 'No operations yet', 'Create one per client program: planned agents, rate per agent and the licenses the client requires.', '<button class="btn btn-primary" data-act="newOperation">Create an operation</button>')}</div>`}`;
  }

  // ---- Licenses: matrix + seats ------------------------------------------------------------
  function licenses(root) {
    const all = subs();
    const people = U.sortBy(S.all('agents').filter((a) => working(a) || (a.licenses || []).length), (a) => `${working(a) ? 0 : 1}${opOf(a)?.name || '~'}${a.name.toLowerCase()}`);
    const cols = all.filter((s) => perSeat(s) || holders(s.id).length || S.all('agents').some((a) => required(a).includes(s.id)));
    const ro = !Cloud.canWrite;
    root.innerHTML = `
      ${head('Who holds which license, what is missing, and which seats you pay for without using')}
      ${tabs('licenses')}
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><h3>Seats</h3><span class="sub">per-seat licenses: bought vs assigned to working people</span><div class="right"><a class="small" href="#/finance/subscriptions">Edit in Finance</a></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>License</th><th class="hide-sm">Why</th><th class="num">In use</th><th class="num">Bought</th><th class="num">Per seat / month</th><th>Status</th></tr></thead>
        <tbody>${all.map((s) => { const x = seats(s); return `<tr><td><b>${esc(s.name)}</b></td><td class="hide-sm">${UI.badge(s.need || 'Business need', s.need === 'Risk & compliance' ? 'red' : s.need === 'Nice to have' ? 'slate' : 'blue')}</td>
          <td class="num">${x.used}</td><td class="num">${x.bought ?? '<span class="muted">shared</span>'}</td><td class="num">${money(seatCost(s), { compact: true })}</td>
          <td>${x.short ? UI.badge(`${x.short} short`, 'red') : x.unused ? UI.badge(`${x.unused} unused · ${Fin.fmt(x.unused * seatCost(s), Fin.base(), { compact: true })}/mo`, 'amber') : UI.badge('OK', 'green')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">No licenses yet. Add them in Finance → Subscriptions & licenses.</td></tr>'}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Assignment matrix</h3><span class="sub">✓ assigned · ✕ required but missing · click a cell to assign or remove</span><div class="right"><button class="btn btn-sm" data-act="exportLicensePlan">${UI.icon('download')}License plan CSV</button></div></div>
        ${people.length && cols.length ? `<div class="table-wrap"><table class="table lic-matrix">
          <thead><tr><th>Person</th>${cols.map((s) => `<th class="lm-col" title="${esc(s.name)} · ${esc(s.need || 'Business need')}"><span>${esc(s.name)}</span>${s.need === 'Risk & compliance' ? ' 🛡️' : ''}</th>`).join('')}<th class="num">Licenses / mo</th></tr></thead>
          <tbody>${people.map((a) => {
            const req = required(a);
            return `<tr class="${working(a) ? '' : 'gone'}"><td><div class="cell-main"><div><b>${esc(a.name)}</b><small>${esc([opOf(a)?.name, a.role, working(a) ? '' : a.status].filter(Boolean).join(' · '))}</small></div></div></td>
              ${cols.map((s) => {
                const has = (a.licenses || []).includes(s.id);
                const need = req.includes(s.id);
                const cls = has ? (working(a) ? 'has' : 'revoke') : need && working(a) ? 'miss' : '';
                const label = has ? (working(a) ? '✓' : '⚠') : need && working(a) ? '✕' : '';
                return `<td class="lm ${cls}"><button type="button" class="lm-btn" data-act="opsToggleLic" data-a="${a.id}" data-s="${s.id}" ${ro ? 'disabled' : ''} aria-label="${has ? 'Remove' : 'Assign'} ${esc(s.name)} ${has ? 'from' : 'to'} ${esc(a.name)}" title="${has ? 'Assigned' : need ? 'Required, missing' : 'Not required'}">${label}</button></td>`;
              }).join('')}
              <td class="num">${money(licenseCost(a), { compact: true })}</td></tr>`;
          }).join('')}</tbody></table></div>` : UI.empty('list', 'Nothing to show yet', 'Add licenses in Finance and agents here to see who holds what.')}
      </div>`;
  }

  // ---- Kits --------------------------------------------------------------------------------
  function kits(root) {
    const all = subs();
    const ro = !Cloud.canWrite;
    const kitCost = (role) => kitOf(role).reduce((t, id) => { const s = S.get('subscriptions', id); return t + (s ? (perSeat(s) ? seatCost(s) : 0) : 0); }, 0);
    root.innerHTML = `
      ${head('The licenses every role needs, split into business need and risk & compliance')}
      ${tabs('kits')}
      <div class="banner info">${UI.icon('shield')}<div><b>How to read this:</b> a kit is the minimum each person in a role needs. <b>Business need</b> = to do the job; <b>Risk & compliance</b> = to keep client data safe and contracts honored (never skip these). Operations can add client-specific licenses on top. Missing licenses are flagged on every agent.</div></div>
      ${all.length ? `<div class="members">${S.AGENT_ROLES.map((role) => {
        const kit = kitOf(role);
        const people = S.all('agents').filter((a) => working(a) && (a.role || 'Agent') === role).length;
        return `<div class="card member kit-card">
          <div class="member-top"><span class="acc-ic">${UI.icon('userCheck')}</span><div><b>${esc(role)}</b><small>${U.plural(people, 'person', 'people')} · ${money(kitCost(role), { compact: true })} per person / month in per-seat licenses</small></div></div>
          ${['Business need', 'Risk & compliance', 'Nice to have'].map((need) => {
            const group = all.filter((s) => (s.need || 'Business need') === need);
            return group.length ? `<div class="kit-group"><div class="small muted kit-h">${need === 'Risk & compliance' ? '🛡️ ' : ''}${esc(need)}</div><div class="chips-input">${group.map((s) => `<label class="chip-check ${need === 'Risk & compliance' ? 'b-red' : 'b-blue'}"><input type="checkbox" data-kit="${esc(role)}" value="${s.id}" ${kit.includes(s.id) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div></div>` : '';
          }).join('')}
        </div>`;
      }).join('')}</div>`
      : `<div class="card">${UI.empty('list', 'Add your licenses first', 'Kits are built from the licenses listed in Finance → Subscriptions & licenses.', '<a class="btn btn-primary" href="#/finance/subscriptions">Go to licenses</a>')}</div>`}`;
    root.onchange = (e) => {
      const role = e.target.dataset.kit;
      if (!role) return;
      const ops = S.settings.ops || {};
      const set = new Set(kitOf(role));
      if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
      S.setSettings({ ops: { ...ops, kits: { ...(ops.kits || {}), [role]: [...set] } } });
    };
  }

  function render(root, params = []) {
    root.onchange = null;
    root.oninput = null;
    ({ agents, operations, licenses, kits }[params[0]] || overview)(root);
  }

  // ---- Forms -------------------------------------------------------------------------------
  const licOptions = () => subs().map((s) => ({ value: s.id, label: `${s.need === 'Risk & compliance' ? '🛡️ ' : ''}${s.name}` }));
  const me = () => S.currentUser()?.id || '';
  function task(title, extra = {}) {
    return S.upsert('tasks', { title, ownerId: me(), due: U.today(), priority: 'Normal', kind: 'To-do', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '', notes: '', tags: [], followerIds: [], comments: [], createdBy: me(), projectId: '', sectionId: '', ...extra }, { silent: true });
  }

  function onboardingTasks(a) {
    const op = opOf(a);
    const owner = op?.ownerId || me();
    const parent = task(`Onboard ${a.name}${op ? ` · ${op.name}` : ''}`, { ownerId: owner, due: a.startDate || U.addDays(U.today(), 3), notes: `Role: ${a.role || 'Agent'}\nStart: ${a.startDate || 'tbd'}`, orgId: op?.orgId || '' });
    const steps = [
      ...missing(a).map((id) => `Assign license: ${subName(id)}`),
      'Equipment: laptop, headset, secure workstation',
      'Accounts: corporate email and password manager',
      'Security & confidentiality training signed',
      op ? `Client training: ${op.name}` : 'Product and process training',
      'Shadowing and first QA review',
    ];
    steps.forEach((t, i) => task(t, { parentId: parent.id, ownerId: owner, due: a.startDate || U.addDays(U.today(), 3), order: i }));
    S.upsert('tasks', { ...parent }, { silent: false });
    return parent;
  }

  async function offboard(a, { silent = false } = {}) {
    const lic = [...(a.licenses || [])];
    if (!lic.length) return;
    if (!silent && !(await UI.confirm(`${a.name} is offboarded but still holds ${U.plural(lic.length, 'license')} (${lic.map(subName).join(', ')}). Remove them now and create a task to revoke each account?`, { title: 'Revoke access', okText: 'Revoke and create tasks', danger: false }))) return;
    const parent = task(`Offboard ${a.name}: revoke access`, { priority: 'High', notes: `Revoke every account the same day the person leaves. Licenses: ${lic.map(subName).join(', ')}` });
    lic.forEach((id, i) => task(`Revoke ${subName(id)} for ${a.name}`, { parentId: parent.id, priority: 'High', order: i }));
    task(`Recover equipment from ${a.name}`, { parentId: parent.id, order: lic.length });
    S.update('agents', a.id, { licenses: [], revokedAt: U.now() });
    UI.toast(`Licenses removed; revoke tasks created for ${a.name}`, 'success', { actionLabel: 'Open', onAction: () => TaskDrawer.open(parent.id) });
  }

  function editAgent(id, preset = {}) {
    const a = id ? S.get('agents', id) : null;
    const values = a ? { ...a } : { status: 'Onboarding', role: 'Agent', shift: 'Morning', location: 'Remote', employment: 'Employee', currency: Fin.base(), startDate: U.addDays(U.today(), 7), onboarding: true, licenses: [], ...preset };
    UI.formModal({
      title: a ? a.name : 'New agent',
      size: 'lg',
      values,
      fields: [
        { type: 'section', label: 'Person' },
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Work email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'languages', label: 'Languages', placeholder: 'e.g. Spanish, English C1' },
        { type: 'section', label: 'Work' },
        { name: 'operationId', label: 'Operation', type: 'select', options: S.all('operations').map((o) => ({ value: o.id, label: o.name })), empty: '— Not assigned —' },
        { name: 'role', label: 'Role', type: 'select', options: S.AGENT_ROLES },
        { name: 'status', label: 'Status', type: 'select', options: S.AGENT_STATUS },
        { name: 'shift', label: 'Shift', type: 'select', options: S.AGENT_SHIFTS },
        { name: 'location', label: 'Works from', type: 'select', options: S.WORK_LOCATIONS },
        { name: 'employment', label: 'Contract', type: 'select', options: S.EMPLOYMENT },
        { name: 'startDate', label: 'Start date', type: 'date' },
        { name: 'endDate', label: 'End date', type: 'date', showWhen: 'status:Offboarded' },
        { name: 'monthlyCost', label: 'Monthly cost (pay)', type: 'number', min: 0, step: 'any', help: 'Salary + benefits, or contractor fee. Used for margins; visible to the team.' },
        { name: 'currency', label: 'Currency', type: 'select', options: S.CURRENCIES },
        { type: 'section', label: 'Licenses', help: 'Tick what this person holds. Required ones come from the role kit and the operation.' },
        { type: 'html', html: `<div class="small muted" id="agReq"></div>` },
        { name: 'licenses', label: '', type: 'chips', span: 2, options: licOptions(), emptyText: 'No licenses yet: add them in Finance → Subscriptions & licenses.' },
        ...(a ? [] : [{ name: 'onboarding', type: 'checkbox', span: 2, checkLabel: 'Create onboarding tasks (missing licenses, equipment, accounts, training)' }]),
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2 },
      ],
      onMount: (form) => {
        const paint = () => {
          const draft = { role: form.elements.role.value, operationId: form.elements.operationId.value, status: form.elements.status.value, licenses: [...form.querySelectorAll('[name=licenses]:checked')].map((x) => x.value) };
          const req = required(draft);
          const miss = req.filter((rid) => !draft.licenses.includes(rid));
          form.querySelector('#agReq').innerHTML = req.length ? `Required: ${req.map((rid) => esc(subName(rid))).join(', ')}${miss.length && working(draft) ? ` · <b class="neg">missing ${esc(miss.map(subName).join(', '))}</b>` : ' · <span class="pos">all set</span>'}${draft.status !== 'Offboarded' ? '' : ' · offboarded people should hold none'}` : 'No kit defined for this role yet (Agents & operations → License kits).';
          form.querySelectorAll('[name=licenses]').forEach((x) => { x.closest('label').classList.toggle('req', req.includes(x.value)); });
        };
        form.addEventListener('change', paint);
        if (!a) {
          const fill = () => { req0().forEach((rid) => { const cb = form.querySelector(`[name=licenses][value="${rid}"]`); if (cb) cb.checked = cb.checked || form.elements.status.value === 'Active'; }); paint(); };
          const req0 = () => required({ role: form.elements.role.value, operationId: form.elements.operationId.value });
          form.elements.status.addEventListener('change', fill);
        }
        paint();
      },
      onSubmit: async (d) => {
        const { onboarding, ...data } = d;
        if (data.status !== 'Offboarded') data.endDate = '';
        const wasWorking = a ? working(a) : false;
        const rec = S.upsert('agents', a ? { ...data, id: a.id } : data);
        if (!a && onboarding) { const t = onboardingTasks(rec); UI.toast(`${rec.name} added with an onboarding checklist`, 'success', { actionLabel: 'Open', onAction: () => TaskDrawer.open(t.id) }); }
        else UI.toast(a ? 'Agent saved' : `${rec.name} added`, 'success');
        if (!working(rec) && (rec.licenses || []).length && (wasWorking || data.status === 'Offboarded')) setTimeout(() => offboard(S.get('agents', rec.id)), 150);
      },
      onDelete: a ? () => { S.remove('agents', a.id); UI.toast('Agent deleted'); } : null,
      deleteConfirm: 'Delete this agent? If they left, set the status to Offboarded instead to keep the history.',
    });
  }

  function editOperation(id) {
    const o = id ? S.get('operations', id) : null;
    UI.formModal({
      title: o ? o.name : 'New operation',
      size: 'lg',
      intro: o ? '' : 'An operation is a client program your agents work on (e.g. “Brightwater · patient line”).',
      values: o || { status: 'Planning', currency: 'USD', plannedAgents: 4, ownerId: me(), requiredLicenses: [] },
      fields: [
        { name: 'name', label: 'Name', required: true, span: 2, placeholder: 'e.g. Client X · inbound support' },
        { name: 'orgId', label: 'Client', type: 'select', options: UI.opts.orgs(), empty: '— None yet —' },
        { name: 'status', label: 'Status', type: 'select', options: S.OPS_STATUS },
        { name: 'ownerId', label: 'Operation lead', type: 'select', options: UI.opts.users(), empty: '—' },
        { name: 'startDate', label: 'Go-live date', type: 'date' },
        { name: 'plannedAgents', label: 'Planned agents', type: 'number', min: 0 },
        { name: 'ratePerAgent', label: 'Billing rate per agent / month', type: 'number', min: 0, step: 'any', help: 'What the client pays per full-time agent.' },
        { name: 'currency', label: 'Currency', type: 'select', options: S.CURRENCIES },
        { name: 'hours', label: 'Coverage', placeholder: 'e.g. Mon–Fri 7am–7pm ET' },
        { type: 'section', label: 'Licenses the client requires', help: 'On top of each role’s kit (e.g. the client’s own CRM or a HIPAA-compliant softphone).' },
        { name: 'requiredLicenses', label: '', type: 'chips', span: 2, options: licOptions(), emptyText: 'No licenses yet: add them in Finance → Subscriptions & licenses.' },
        { type: 'section', label: 'Service targets (SLA)' },
        { name: 'slaAnswer', label: 'Service level', placeholder: 'e.g. 80% answered in 20 s' },
        { name: 'slaAht', label: 'Average handle time', placeholder: 'e.g. 6 min' },
        { name: 'slaCsat', label: 'CSAT / quality', placeholder: 'e.g. CSAT ≥ 90%, QA ≥ 85%' },
        { name: 'slaOther', label: 'Other', placeholder: 'e.g. Occupancy 75–85%' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2 },
      ],
      onSubmit: (d) => { const rec = S.upsert('operations', o ? { ...d, id: o.id } : d); UI.toast(o ? 'Operation saved' : `${rec.name} created`, 'success'); },
      onDelete: o ? () => { S.all('agents').filter((a) => a.operationId === o.id).forEach((a) => S.update('agents', a.id, { operationId: '' }, { silent: true })); S.remove('operations', o.id); UI.toast('Operation deleted; its agents are kept without an operation'); } : null,
    });
  }

  // ---- Exports -----------------------------------------------------------------------------
  function exportAgents() {
    const cols = [
      { label: 'Name', get: (a) => a.name }, { label: 'Email', get: (a) => a.email }, { label: 'Operation', get: (a) => opOf(a)?.name || '' },
      { label: 'Role', get: (a) => a.role }, { label: 'Status', get: (a) => a.status }, { label: 'Shift', get: (a) => a.shift }, { label: 'Works from', get: (a) => a.location },
      { label: 'Start', get: (a) => a.startDate }, { label: 'End', get: (a) => a.endDate }, { label: 'Licenses', get: (a) => (a.licenses || []).map(subName).join('; ') },
      { label: 'Missing licenses', get: (a) => missing(a).map(subName).join('; ') }, { label: `License cost / month (${Fin.base()})`, get: (a) => Math.round(licenseCost(a)) },
    ];
    U.download(`aetherium-agents-${U.today()}.csv`, U.toCSV(S.all('agents'), cols), 'text/csv');
  }
  // The license plan per role and per operation, split by need — ready for the board presentation
  function exportLicensePlan() {
    const rows = [];
    S.AGENT_ROLES.forEach((role) => kitOf(role).forEach((id) => { const s = S.get('subscriptions', id); if (s) rows.push({ scope: `Role: ${role}`, s }); }));
    S.all('operations').forEach((o) => (o.requiredLicenses || []).forEach((id) => { const s = S.get('subscriptions', id); if (s) rows.push({ scope: `Operation: ${o.name}`, s }); }));
    const sorted = U.sortBy(rows, (r) => `${r.scope}${NEED_ORDER[r.s.need || 'Business need']}${r.s.name}`);
    U.download(`aetherium-license-plan-${U.today()}.csv`, U.toCSV(sorted, [
      { label: 'Scope', get: (r) => r.scope }, { label: 'Need', get: (r) => r.s.need || 'Business need' }, { label: 'License', get: (r) => r.s.name },
      { label: 'Vendor', get: (r) => S.orgName(r.s.orgId) }, { label: 'Billing', get: (r) => r.s.cadence }, { label: 'Price', get: (r) => r.s.amount }, { label: 'Currency', get: (r) => r.s.currency },
      { label: `Per person / month (${Fin.base()})`, get: (r) => Math.round(seatCost(r.s)) }, { label: 'Seats bought', get: (r) => seats(r.s).bought ?? 'shared' }, { label: 'In use', get: (r) => seats(r.s).used },
    ]), 'text/csv');
  }

  return {
    render,
    actions: {
      newAgent: (ds) => editAgent(null, ds.op ? { operationId: ds.op } : {}),
      editAgent: (ds) => editAgent(ds.id),
      newOperation: () => editOperation(),
      editOperation: (ds) => editOperation(ds.id),
      opsToggleLic: (ds) => {
        const a = S.get('agents', ds.a);
        if (!a) return;
        const set = new Set(a.licenses || []);
        if (set.has(ds.s)) set.delete(ds.s); else set.add(ds.s);
        S.update('agents', a.id, { licenses: [...set] });
      },
      opsRevokeAll: async () => { for (const a of leftovers()) await offboard(a, { silent: true }); },
      exportAgents, exportLicensePlan,
    },
  };
})();
