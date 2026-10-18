/* Aetherium CRM — create/edit flows shared by every view (contacts, orgs, deals, activities, tasks, board). */
const Actions = (() => {
  const S = Store;
  const go = (hash) => { location.hash = hash; };

  // ---- Contacts --------------------------------------------------------------------------
  function contactFields() {
    const bw = 'type:Board Member|Advisor';
    return [
      { type: 'section', label: 'Basics' },
      { name: 'firstName', label: 'First name', required: true },
      { name: 'lastName', label: 'Last name' },
      { name: 'title', label: 'Job title' },
      { name: 'orgId', label: 'Organization', type: 'select', options: UI.opts.orgs(), empty: '— None —' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'linkedin', label: 'LinkedIn / profile URL', span: 2 },
      { type: 'section', label: 'Categorization', help: 'One type per contact. Tags, tier and source add detail without clutter.' },
      {
        name: 'type', label: 'Contact type', type: 'select', required: true,
        options: S.CONTACT_TYPES.map((t) => ({ value: t.id, label: `${t.id} — ${t.hint}`, group: S.GROUPS.find((g) => g.id === t.group).label })),
      },
      { name: 'priority', label: 'Priority tier', type: 'select', options: S.PRIORITIES.map((p) => ({ value: p.id, label: p.label })) },
      { name: 'source', label: 'How we met (source)', type: 'select', options: S.settings.sources, empty: '— Unknown —' },
      { name: 'ownerId', label: 'Relationship owner', type: 'select', options: UI.opts.users(), empty: '— Unassigned —' },
      { name: 'cadenceDays', label: 'Keep in touch every … days', type: 'number', min: 0, placeholder: 'Default for type', help: 'Blank = default for the type (Settings). 0 = no reminders.' },
      { name: 'tags', label: 'Tags', type: 'chips', options: UI.opts.tags(), span: 2, emptyText: 'No tags yet. Create them in Settings → Tags.' },
      { type: 'section', label: 'Board / advisory role', showWhen: bw },
      { name: 'board_role', label: 'Board role', type: 'select', options: S.BOARD_ROLES, showWhen: bw },
      { name: 'board_termStart', label: 'Term start', type: 'date', showWhen: bw },
      { name: 'board_termEnd', label: 'Term end', type: 'date', showWhen: bw, help: 'You will be alerted 120 days before it ends.' },
      { name: 'board_voting', type: 'checkbox', checkLabel: 'Voting member (counts toward quorum)', showWhen: bw },
      { name: 'board_independent', type: 'checkbox', checkLabel: 'Independent director', showWhen: bw },
      { name: 'board_committees', label: 'Committees', type: 'chips', options: S.settings.committees, span: 2, showWhen: bw },
      { name: 'board_coi', label: 'Conflict-of-interest disclosures', type: 'textarea', rows: 2, span: 2, showWhen: bw, placeholder: 'e.g. 2026-03-01: Advisory role at a payer; recuses from payer contract votes.' },
      { type: 'section', label: 'Notes' },
      { name: 'notes', label: 'Background, preferences, context', type: 'textarea', rows: 3, span: 2 },
    ];
  }

  // ---- Board members: our own people, not external contacts -------------------------------
  const teamUserFor = (email, name) => S.all('users').find((u) => (email && (u.email || '').toLowerCase() === email.toLowerCase())
    || (!email && name && u.name.toLowerCase() === name.toLowerCase())) || null;

  function editBoardMember(ds = {}) {
    const existing = S.get('contacts', ds.id);
    const b = existing?.board || {};
    let first = existing?.firstName || '';
    let last = existing?.lastName || '';
    if (!existing && ds.name) [first, ...last] = ds.name.trim().split(/\s+/), last = last.join(' ');
    if (!existing && !first && ds.email) first = ds.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    const email = existing?.email || ds.email || '';
    const type = existing?.type || ds.type || 'Board Member';
    const values = {
      firstName: first, lastName: last, email, phone: existing?.phone || '', title: existing?.title || '',
      type, board_role: b.role || (type === 'Advisor' ? 'Advisor' : 'Director'),
      board_voting: existing ? b.voting !== false : type !== 'Advisor', board_independent: !!b.independent,
      board_termStart: b.termStart || U.today(), board_termEnd: b.termEnd || U.addDays(U.today(), 730),
      board_committees: b.committees || [], board_coi: b.coi || '', notes: existing?.notes || '',
      isTeam: existing ? !!teamUserFor(email, S.contactName(existing)) : ds.team !== 'no',
    };
    UI.formModal({
      title: existing ? `${S.contactName(existing)} · board seat` : 'Add someone to our board',
      intro: existing ? '' : 'Board members are people of the company, not clients: name, seat and term are enough to start.',
      size: 'lg', values,
      submitText: existing ? 'Save' : 'Add to the board',
      fields: [
        { type: 'section', label: 'Who' },
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name' },
        { name: 'email', label: 'Email', type: 'email', help: 'Use the same email they sign in with.' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'title', label: 'What they do', placeholder: 'e.g. Co-founder & CEO, Aetherium', span: 2 },
        { type: 'section', label: 'Seat on the board' },
        { name: 'type', label: 'Seat', type: 'select', options: [{ value: 'Board Member', label: 'Director (votes)' }, { value: 'Advisor', label: 'Advisor (does not vote)' }] },
        { name: 'board_role', label: 'Role', type: 'select', options: S.BOARD_ROLES },
        { name: 'board_termStart', label: 'Term starts', type: 'date' },
        { name: 'board_termEnd', label: 'Term ends', type: 'date', help: 'Founding boards usually serve 2 years.' },
        { name: 'board_voting', type: 'checkbox', checkLabel: 'Counts toward quorum', showWhen: 'type:Board Member' },
        { name: 'board_independent', type: 'checkbox', checkLabel: 'Independent (not a founder, employee or investor)' },
        { name: 'board_committees', label: 'Committees', type: 'chips', options: S.settings.committees, span: 2 },
        { type: 'section', label: 'In the company' },
        { name: 'isTeam', type: 'checkbox', span: 2, checkLabel: 'Also part of the team: can own tasks and follow-ups, and appears in “Team members”' },
        { name: 'notes', label: 'Background, expertise and how they help', type: 'textarea', rows: 2, span: 2 },
        { name: 'board_coi', label: 'Conflict-of-interest disclosures', type: 'textarea', rows: 2, span: 2, placeholder: 'e.g. 2026-10-17: also advises a payer; abstains from payer votes.' },
      ],
      onSubmit: (d) => {
        if (d.email) {
          const dup = S.all('contacts').find((c) => c.id !== existing?.id && (c.email || '').toLowerCase() === d.email.toLowerCase());
          if (dup) { UI.toast(`${S.contactName(dup)} already uses ${d.email}. Open that record instead.`, 'error'); return false; }
        }
        const rec = S.upsert('contacts', {
          ...(existing || { priority: 'A', source: 'Founding board', ownerId: S.currentUser()?.id || '', tags: [], cadenceDays: null, orgId: '' }),
          firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, title: d.title, notes: d.notes, type: d.type,
          board: {
            role: d.board_role, committees: d.board_committees, termStart: d.board_termStart, termEnd: d.board_termEnd,
            voting: d.type === 'Board Member' ? d.board_voting : false, independent: d.board_independent, coi: d.board_coi,
          },
        });
        const name = S.contactName(rec);
        const user = teamUserFor(d.email, name);
        if (d.isTeam && !user) S.upsert('users', { name, email: d.email, role: d.board_role });
        else if (d.isTeam && user && user.name !== name && user.name === (user.email || '').split('@')[0]) S.update('users', user.id, { name });
        UI.toast(existing ? 'Board seat updated' : `${name} joined the board`, 'success');
      },
      onDelete: existing ? () => { S.remove('contacts', existing.id); UI.toast('Removed from the board'); } : null,
      deleteText: 'Remove from board',
      deleteConfirm: 'Remove this person from the board? Past meetings keep their attendance and minutes.',
    });
  }

  function editContact(ds = {}) {
    const existing = S.get('contacts', ds.id);
    if ((existing && S.isBoardType(existing.type)) || (!existing && S.isBoardType(ds.type))) return editBoardMember(ds);
    const preset = existing || {
      type: ds.type || 'Lead', priority: 'B', ownerId: S.currentUser()?.id || '', orgId: ds.org || '', tags: [],
    };
    const b = preset.board || {};
    const values = {
      ...preset,
      board_role: b.role || (preset.type === 'Advisor' ? 'Advisor' : 'Director'),
      board_committees: b.committees || [],
      board_termStart: b.termStart || '',
      board_termEnd: b.termEnd || '',
      board_voting: preset.board ? b.voting !== false : preset.type !== 'Advisor',
      board_independent: !!b.independent,
      board_coi: b.coi || '',
    };
    const fields = contactFields();
    UI.formModal({
      title: existing ? `Edit ${S.contactName(existing)}` : 'New contact',
      fields, values, size: 'lg',
      submitText: existing ? 'Save changes' : 'Create contact',
      onMount: (form) => {
        if (existing) return;
        form.elements.type.addEventListener('change', () => {
          const adv = form.elements.type.value === 'Advisor';
          form.elements.board_voting.checked = !adv;
          if (adv) form.elements.board_role.value = 'Advisor';
        });
      },
      onSubmit: async (d) => {
        if (d.email) {
          const dup = S.all('contacts').find((c) => c.id !== existing?.id && (c.email || '').toLowerCase() === d.email.toLowerCase());
          if (dup && !(await UI.confirm(`${S.contactName(dup)} already uses ${d.email}. Save a second contact anyway?`, { title: 'Possible duplicate', okText: 'Save anyway', danger: false }))) return false;
        }
        const rec = {
          ...(existing || {}),
          firstName: d.firstName, lastName: d.lastName, title: d.title, orgId: d.orgId, email: d.email, phone: d.phone,
          linkedin: d.linkedin, type: d.type, priority: d.priority, source: d.source, ownerId: d.ownerId,
          cadenceDays: d.cadenceDays, tags: d.tags, notes: d.notes,
        };
        if (S.isBoardType(d.type)) {
          rec.board = {
            role: d.board_role, committees: d.board_committees, termStart: d.board_termStart, termEnd: d.board_termEnd,
            voting: d.type === 'Board Member' ? d.board_voting : false, independent: d.board_independent, coi: d.board_coi,
          };
        }
        const saved = S.upsert('contacts', rec);
        UI.toast(existing ? 'Contact updated' : `${S.contactName(saved)} added`, 'success');
        if (!existing && ds.navigate !== 'no') go(`#/contacts/${saved.id}`);
      },
      onDelete: existing ? () => {
        S.remove('contacts', existing.id);
        UI.toast('Contact deleted');
        if (location.hash.includes(existing.id)) go('#/contacts');
      } : null,
      deleteConfirm: 'Delete this contact? Their past activities stay in the log but are unlinked.',
    });
  }

  // ---- Organizations ---------------------------------------------------------------------
  function editOrg(ds = {}) {
    const existing = S.get('organizations', ds.id);
    const values = existing || { type: ds.type || 'Lead', ownerId: S.currentUser()?.id || '', tags: [] };
    UI.formModal({
      title: existing ? `Edit ${existing.name}` : 'New organization',
      size: 'lg',
      submitText: existing ? 'Save changes' : 'Create organization',
      values,
      fields: [
        { name: 'name', label: 'Name', required: true, span: 2 },
        { name: 'type', label: 'Relationship', type: 'select', options: S.ORG_TYPES },
        { name: 'industry', label: 'Industry / segment', type: 'select', options: S.settings.industries, empty: '— Select —' },
        { name: 'size', label: 'Size (employees)', type: 'select', options: S.ORG_SIZES, empty: '— Unknown —' },
        { name: 'ownerId', label: 'Account owner', type: 'select', options: UI.opts.users(), empty: '— Unassigned —' },
        { name: 'website', label: 'Website' },
        { name: 'phone', label: 'Main phone', type: 'tel' },
        { name: 'address', label: 'City / address', span: 2 },
        { name: 'tags', label: 'Tags', type: 'chips', options: UI.opts.tags(), span: 2, emptyText: 'No tags yet. Create them in Settings → Tags.' },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      onSubmit: (d) => {
        const dup = S.all('organizations').find((o) => o.id !== existing?.id && o.name.trim().toLowerCase() === d.name.toLowerCase());
        if (dup) { UI.toast(`"${dup.name}" already exists`, 'error'); return false; }
        const saved = S.upsert('organizations', { ...(existing || {}), ...d });
        UI.toast(existing ? 'Organization updated' : `${saved.name} added`, 'success');
        if (!existing && ds.navigate !== 'no') go(`#/organizations/${saved.id}`);
      },
      onDelete: existing ? () => {
        S.remove('organizations', existing.id);
        UI.toast('Organization deleted');
        if (location.hash.includes(existing.id)) go('#/organizations');
      } : null,
      deleteConfirm: 'Delete this organization? Its contacts and deals are kept but unlinked.',
    });
  }

  // ---- Deals -----------------------------------------------------------------------------
  function editDeal(ds = {}) {
    const existing = S.get('deals', ds.id);
    const contact = S.get('contacts', ds.contact);
    const values = existing || {
      stage: ds.stage || 'lead', ownerId: S.currentUser()?.id || '', orgId: ds.org || contact?.orgId || '', contactId: ds.contact || '',
      expectedClose: U.addDays(U.today(), 30),
    };
    UI.formModal({
      title: existing ? 'Edit deal' : 'New deal',
      submitText: existing ? 'Save changes' : 'Create deal',
      values,
      fields: [
        { name: 'name', label: 'Deal name', required: true, span: 2, placeholder: 'e.g. Northside employee wellness program' },
        { name: 'orgId', label: 'Organization', type: 'select', options: UI.opts.orgs(), empty: '— None —' },
        { name: 'contactId', label: 'Main contact', type: 'select', options: UI.opts.contacts(), empty: '— None —' },
        { name: 'stage', label: 'Stage', type: 'select', options: S.STAGES.map((s) => ({ value: s.id, label: `${s.name} (${s.prob}%)` })) },
        { name: 'value', label: 'Value (USD / year)', type: 'number', min: 0, step: 100 },
        { name: 'expectedClose', label: 'Expected close', type: 'date' },
        { name: 'ownerId', label: 'Owner', type: 'select', options: UI.opts.users(), empty: '— Unassigned —' },
        { name: 'lostReason', label: 'Lost reason', type: 'select', options: S.LOST_REASONS, empty: '— Select —', showWhen: 'stage:lost', span: 2 },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      onSubmit: (d) => {
        if (d.stage === 'lost' && !d.lostReason) { UI.toast('Pick a lost reason — it helps you learn why deals slip', 'error'); return false; }
        const { msgs } = S.saveDeal({ ...(existing || {}), ...d, value: d.value || 0 });
        UI.toast([existing ? 'Deal updated' : 'Deal created', ...msgs].join(' · '), 'success');
      },
      onDelete: existing ? () => { S.remove('deals', existing.id); UI.toast('Deal deleted'); } : null,
    });
  }

  async function moveDeal(id, stage) {
    const d = S.get('deals', id);
    if (!d || d.stage === stage) return;
    let extra = {};
    if (stage === 'lost') {
      const reason = await UI.prompt('Why was this deal lost?', { label: 'Lost reason', options: S.LOST_REASONS, okText: 'Mark as lost' });
      if (!reason) { App.rerender(); return; }
      extra = { lostReason: reason };
    }
    const { msgs } = S.setDealStage(id, stage, extra);
    UI.toast([`Moved to ${S.stageInfo(stage).name}`, ...msgs].join(' · '), stage === 'won' ? 'success' : 'info');
  }

  // ---- Activities (interactions) ---------------------------------------------------------
  function logActivity(ds = {}) {
    const existing = S.get('activities', ds.id);
    const contactIds = ds.contactIds || (ds.contact ? [ds.contact] : []);
    const firstContact = S.get('contacts', contactIds[0]);
    const values = existing || {
      type: ds.atype || 'Call', date: U.now(), contactIds, orgId: ds.org || firstContact?.orgId || '', dealId: ds.deal || '',
      meetingId: ds.meeting || '', subject: ds.subject || '', followOwner: S.currentUser()?.id || '', followDue: U.addDays(U.today(), 7),
    };
    const fields = [
      { name: 'type', label: 'Type', type: 'select', options: S.ACTIVITY_TYPES },
      { name: 'date', label: 'When', type: 'datetime-local', required: true },
      { name: 'subject', label: 'Subject', required: true, span: 2, placeholder: 'e.g. Discovery call, pricing follow-up, 1:1 with the Chair' },
      { name: 'contactIds', label: 'People involved (clients, partners, board members…)', type: 'picker', options: UI.opts.contacts(), span: 2, placeholder: 'Type a name to filter…' },
      { name: 'orgId', label: 'Organization', type: 'select', options: UI.opts.orgs(), empty: '— Auto from first person —' },
      { name: 'dealId', label: 'Related deal', type: 'select', options: UI.opts.deals(existing?.dealId), empty: '— None —' },
      { name: 'meetingId', label: 'Related board meeting', type: 'select', options: UI.opts.meetings(), empty: '— None —', span: 2 },
      { name: 'notes', label: 'Notes & outcome', type: 'textarea', rows: 4, span: 2, placeholder: 'What was discussed? What did they need? What did you agree?' },
    ];
    if (!existing) {
      fields.push(
        { type: 'section', label: 'Next step (recommended)', help: 'Every relationship should have a dated next step.' },
        { name: 'followTitle', label: 'Follow-up task', placeholder: 'e.g. Send proposal', span: 2 },
        { name: 'followDue', label: 'Due', type: 'date' },
        { name: 'followOwner', label: 'Owner', type: 'select', options: UI.opts.owners(), empty: '— Unassigned —' },
      );
    }
    UI.formModal({
      title: existing ? 'Edit activity' : 'Log an interaction',
      size: 'lg', values, fields,
      submitText: existing ? 'Save changes' : 'Log it',
      onSubmit: (d) => {
        const { followTitle, followDue, followOwner, ...act } = d;
        if (!act.orgId && act.contactIds.length) act.orgId = S.get('contacts', act.contactIds[0])?.orgId || '';
        const saved = S.upsert('activities', { ...(existing || { ownerId: S.currentUser()?.id || '' }), ...act });
        if (followTitle) {
          S.upsert('tasks', {
            title: followTitle, due: followDue, ownerId: followOwner, kind: act.meetingId ? 'Board action' : 'Follow-up', priority: 'Normal', status: 'open',
            contactId: act.contactIds[0] || '', orgId: act.orgId, dealId: act.dealId, meetingId: act.meetingId, notes: `From: ${act.subject}`,
          });
        }
        UI.toast(existing ? 'Activity updated' : followTitle ? 'Logged · follow-up created' : 'Interaction logged', 'success');
        return saved;
      },
      onDelete: existing ? () => { S.remove('activities', existing.id); UI.toast('Activity deleted'); } : null,
    });
  }

  // ---- Tasks -----------------------------------------------------------------------------
  function editTask(ds = {}) {
    const existing = S.get('tasks', ds.id);
    const contact = S.get('contacts', ds.contact);
    const values = existing || {
      kind: ds.kind || (ds.meeting ? 'Board action' : 'Follow-up'), priority: 'Normal', due: U.addDays(U.today(), ds.meeting ? 14 : 3),
      ownerId: ds.owner || S.currentUser()?.id || '', contactId: ds.contact || '', orgId: ds.org || contact?.orgId || '', dealId: ds.deal || '', meetingId: ds.meeting || '',
    };
    UI.formModal({
      title: existing ? 'Edit task' : values.kind === 'Board action' ? 'New board action item' : 'New task',
      size: 'lg', values,
      submitText: existing ? 'Save changes' : 'Create task',
      fields: [
        { name: 'title', label: 'What needs to happen?', required: true, span: 2 },
        { name: 'due', label: 'Due date', type: 'date' },
        { name: 'ownerId', label: 'Owner', type: 'select', options: UI.opts.owners(), empty: '— Unassigned —', help: 'Team members or board members.' },
        { name: 'kind', label: 'Kind', type: 'select', options: S.TASK_KINDS },
        { name: 'priority', label: 'Priority', type: 'select', options: S.TASK_PRIORITIES },
        { type: 'section', label: 'Linked to' },
        { name: 'contactId', label: 'Contact', type: 'select', options: UI.opts.contacts(), empty: '— None —' },
        { name: 'orgId', label: 'Organization', type: 'select', options: UI.opts.orgs(), empty: '— None —' },
        { name: 'dealId', label: 'Deal', type: 'select', options: UI.opts.deals(existing?.dealId), empty: '— None —' },
        { name: 'meetingId', label: 'Board meeting', type: 'select', options: UI.opts.meetings(), empty: '— None —' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2 },
      ],
      onSubmit: (d) => {
        if (!d.orgId && d.contactId) d.orgId = S.get('contacts', d.contactId)?.orgId || '';
        S.upsert('tasks', { ...(existing || { status: 'open', doneAt: '' }), ...d });
        UI.toast(existing ? 'Task updated' : 'Task created', 'success');
      },
      onDelete: existing ? () => { S.remove('tasks', existing.id); UI.toast('Task deleted'); } : null,
    });
  }

  function toggleTask(ds) {
    const t = S.get('tasks', ds.id);
    if (!t) return;
    const done = t.status !== 'done';
    S.update('tasks', t.id, { status: done ? 'done' : 'open', doneAt: done ? U.today() : '' });
    if (done && t.contactId && t.kind === 'Follow-up') {
      UI.toast('Task completed', 'success', {
        actionLabel: 'Log interaction',
        onAction: () => logActivity({ contactIds: [t.contactId], org: t.orgId, deal: t.dealId, subject: t.title }),
      });
    } else {
      UI.toast(done ? 'Task completed' : 'Task reopened', done ? 'success' : 'info');
    }
  }

  // ---- Board meetings & resolutions ------------------------------------------------------
  function editMeeting(ds = {}) {
    const existing = S.get('meetings', ds.id);
    const values = existing || {
      title: '', type: ds.type || 'Regular', status: 'Scheduled', durationMin: 90, date: `${U.addDays(U.today(), 14)}T17:00`, useTemplate: true,
    };
    const fields = [
      { name: 'title', label: 'Title', required: true, span: 2, placeholder: 'e.g. Q1 Regular Board Meeting' },
      { name: 'type', label: 'Meeting type', type: 'select', options: S.MEETING_TYPES },
      { name: 'committee', label: 'Committee', type: 'select', options: S.settings.committees, empty: '— Select —', showWhen: 'type:Committee' },
      { name: 'date', label: 'Date & time', type: 'datetime-local', required: true },
      { name: 'durationMin', label: 'Duration (minutes)', type: 'number', min: 0, step: 15 },
      { name: 'location', label: 'Location / video link', span: 2 },
      { name: 'status', label: 'Status', type: 'select', options: S.MEETING_STATUS },
    ];
    if (!existing) fields.push({ name: 'useTemplate', type: 'checkbox', checkLabel: 'Start with the standard board agenda (quorum, minutes, CEO & finance updates, action items, decisions)', span: 2 });
    UI.formModal({
      title: existing ? 'Edit meeting' : 'Schedule a meeting',
      values, fields,
      submitText: existing ? 'Save changes' : 'Schedule',
      onSubmit: (d) => {
        const { useTemplate, ...m } = d;
        if (existing) {
          S.upsert('meetings', { ...existing, ...m });
          UI.toast('Meeting updated', 'success');
          return;
        }
        const agenda = useTemplate && m.type !== 'Committee'
          ? (m.type === 'Inaugural' ? S.INAUGURAL_AGENDA : S.STANDARD_AGENDA).map((a) => ({ ...a, id: U.uid('agi'), presenter: '' }))
          : [{ id: U.uid('agi'), title: 'Call to order & quorum check', kind: 'Information', minutes: 5, presenter: '' }];
        const saved = S.upsert('meetings', { ...m, agenda, attendance: {}, minutes: '' });
        UI.toast('Meeting scheduled', 'success');
        go(`#/board/meetings/${saved.id}`);
      },
      onDelete: existing ? () => {
        S.remove('meetings', existing.id);
        UI.toast('Meeting deleted');
        go('#/board/meetings');
      } : null,
      deleteConfirm: 'Delete this meeting, its agenda, attendance and minutes? Linked resolutions and action items are kept.',
    });
  }

  function editResolution(ds = {}) {
    const existing = S.get('resolutions', ds.id);
    const meeting = S.get('meetings', ds.meeting);
    const date = meeting ? meeting.date.slice(0, 10) : U.today();
    const voting = S.boardMembers({ includeAdvisors: false }).filter(S.isVoting).length;
    const values = existing || {
      number: S.nextResolutionNumber(date), meetingId: ds.meeting || '', method: ds.method || (meeting ? 'Meeting vote' : 'Written consent'),
      date, status: 'Proposed', votesFor: 0, votesAgainst: 0, abstain: 0,
    };
    UI.formModal({
      title: existing ? `Edit ${existing.number}` : 'Record a resolution / decision',
      values,
      submitText: existing ? 'Save changes' : 'Save resolution',
      intro: `Tip: unanimous written consent is common for small boards between meetings. You have ${U.plural(voting, 'voting director')}.`,
      fields: [
        { name: 'number', label: 'Number', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'title', label: 'Resolution', required: true, span: 2, placeholder: 'e.g. Approve 2027 operating budget' },
        { name: 'description', label: 'Details / conditions', type: 'textarea', rows: 2, span: 2 },
        { name: 'method', label: 'Method', type: 'select', options: S.RESOLUTION_METHODS },
        { name: 'meetingId', label: 'Meeting', type: 'select', options: UI.opts.meetings(), empty: '— None (written consent) —' },
        { name: 'status', label: 'Status', type: 'select', options: S.RESOLUTION_STATUS },
        { type: 'html', html: '' },
        { name: 'votesFor', label: 'Votes for', type: 'number', min: 0 },
        { name: 'votesAgainst', label: 'Votes against', type: 'number', min: 0 },
        { name: 'abstain', label: 'Abstentions / recusals', type: 'number', min: 0 },
      ],
      onSubmit: (d) => {
        S.upsert('resolutions', { ...(existing || {}), ...d, votesFor: d.votesFor || 0, votesAgainst: d.votesAgainst || 0, abstain: d.abstain || 0 });
        UI.toast(existing ? 'Resolution updated' : 'Resolution recorded', 'success');
      },
      onDelete: existing ? () => { S.remove('resolutions', existing.id); UI.toast('Resolution deleted'); } : null,
    });
  }

  // ---- Users (team) ----------------------------------------------------------------------
  function editUser(ds = {}) {
    const existing = S.get('users', ds.id);
    UI.formModal({
      title: existing ? 'Edit team member' : 'Add team member',
      size: 'sm', values: existing || {},
      submitText: existing ? 'Save' : 'Add',
      fields: [
        { name: 'name', label: 'Name', required: true, span: 2 },
        { name: 'role', label: 'Role', span: 2, placeholder: 'e.g. Business Development' },
        { name: 'email', label: 'Email', type: 'email', span: 2 },
      ],
      onSubmit: (d) => {
        const saved = S.upsert('users', { ...(existing || {}), ...d });
        if (!S.settings.currentUserId) S.setSettings({ currentUserId: saved.id });
        UI.toast(existing ? 'Team member updated' : `${saved.name} added`, 'success');
      },
      onDelete: existing && S.all('users').length > 1 ? () => { S.remove('users', existing.id); UI.toast('Team member removed'); } : null,
      deleteText: 'Remove',
      deleteConfirm: 'Remove this team member? Records they own become unassigned.',
    });
  }

  function editTag(ds = {}) {
    const existing = S.get('tags', ds.id);
    const groups = [...new Set(S.all('tags').map((t) => t.group).filter(Boolean))];
    UI.formModal({
      title: existing ? 'Edit tag' : 'New tag',
      size: 'sm', values: existing || { color: S.TAG_COLORS[S.all('tags').length % S.TAG_COLORS.length] },
      submitText: existing ? 'Save' : 'Create tag',
      intro: 'Use a group to keep tags tidy, e.g. <b>Interest: Wellness program</b> or <b>Role: Decision maker</b>.',
      fields: [
        { name: 'group', label: 'Group', placeholder: 'e.g. Interest, Role, Segment', list: 'tagGroups', span: 2, help: groups.length ? `Existing: ${groups.join(', ')}` : '' },
        { name: 'name', label: 'Tag', required: true, span: 2 },
        { name: 'color', label: 'Color', type: 'select', options: S.TAG_COLORS, span: 2 },
      ],
      onMount: (form) => {
        const dl = document.createElement('datalist');
        dl.id = 'tagGroups';
        dl.innerHTML = groups.map((g) => `<option value="${U.esc(g)}">`).join('');
        form.appendChild(dl);
      },
      onSubmit: (d) => {
        const dup = S.all('tags').find((t) => t.id !== existing?.id && t.name.toLowerCase() === d.name.toLowerCase() && (t.group || '').toLowerCase() === d.group.toLowerCase());
        if (dup) { UI.toast('That tag already exists', 'error'); return false; }
        S.upsert('tags', { ...(existing || {}), ...d });
        UI.toast('Tag saved', 'success');
      },
      onDelete: existing ? () => { S.remove('tags', existing.id); UI.toast('Tag deleted'); } : null,
      deleteConfirm: 'Delete this tag? It will be removed from every contact and organization.',
    });
  }

  // data-act handlers (dataset → action)
  return {
    newContact: (ds) => editContact({ ...ds, id: '' }),
    editContact,
    newBoardMember: (ds) => editBoardMember({ ...ds, id: '' }),
    editBoardMember,
    newOrg: (ds) => editOrg({ ...ds, id: '' }),
    editOrg,
    newDeal: (ds) => editDeal({ ...ds, id: '' }),
    editDeal,
    moveDeal,
    logActivity: (ds) => logActivity({ ...ds, id: '' }),
    editActivity: logActivity,
    newTask: (ds) => editTask({ ...ds, id: '' }),
    editTask,
    toggleTask,
    newMeeting: (ds) => editMeeting({ ...ds, id: '' }),
    editMeeting,
    newResolution: (ds) => editResolution({ ...ds, id: '' }),
    editResolution,
    newUser: (ds) => editUser({ ...ds, id: '' }),
    editUser,
    newTag: (ds) => editTag({ ...ds, id: '' }),
    editTag,
    go: (ds) => go(ds.href),
  };
})();
