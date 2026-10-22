/* Settings — workspace, cloud sync & team access, categorization lists, cadences, data. */
Views.settings = (() => {
  const S = Store;
  const esc = U.esc;
  let members = null; // Supabase allowlist, loaded on demand

  function cloudCard() {
    const st = Cloud.status.state;
    if (S.mode === 'cloud') {
      const meEmail = (Cloud.user?.email || '').toLowerCase();
      const roleColor = { admin: 'teal', member: 'blue', viewer: 'slate' };
      const roleOpts = Cloud.ROLES.map((r) => ({ value: r.id, label: `${r.label} — ${r.hint}` }));
      const list = members === null ? '<div class="empty-sm">Loading…</div>'
        : members.map((m) => {
          const self = m.email === meEmail;
          return `<div class="list-item"><div class="li-main"><b>${esc(m.email)}</b><small>added ${esc(U.fmtDate((m.added_at || '').slice(0, 10)))}</small></div>
          <div class="li-side">
            ${Cloud.isAdmin && !self
              ? `<select class="select" data-member-role="${esc(m.email)}" aria-label="Role for ${esc(m.email)}">${UI.selectOptions(Cloud.ROLES.map((r) => ({ value: r.id, label: r.label })), m.role)}</select>
                 <button class="btn btn-sm btn-danger-ghost" data-act="removeMember" data-email="${esc(m.email)}">Remove</button>`
              : `${UI.badge(Cloud.ROLES.find((r) => r.id === m.role)?.label || m.role, roleColor[m.role] || 'slate')}${self ? UI.badge('You', 'teal') : ''}`}
          </div></div>`;
        }).join('');
      return `<div class="card"><div class="card-head"><h2>${UI.icon('database')} Cloud workspace (Supabase)</h2><div class="right">${UI.badge(st === 'error' ? 'Sync error' : st === 'saving' ? 'Saving…' : 'Synced', st === 'error' ? 'red' : 'green')}</div></div>
        <div class="card-body">
          <p>Signed in as <b>${esc(Cloud.user?.email || '')}</b> · role <b>${esc(Cloud.ROLES.find((r) => r.id === Cloud.role)?.label || Cloud.role || '')}</b>. Changes save automatically and appear for teammates in real time.</p>
          ${st === 'error' ? `<div class="banner danger">${UI.icon('alert')}<div>${esc(Cloud.status.detail)}</div></div>` : ''}
          <h3 style="font-size:14px;margin:14px 0 4px">Team access</h3>
          <p class="muted small">Only these emails can sign in and see data, enforced by Row Level Security in the database. <b>Admin</b>: everything plus team access · <b>Member</b>: read and edit all data · <b>Viewer</b>: read-only.
            ${Cloud.isAdmin ? 'After you add someone, they open the app and choose “Create your account” with that email.' : 'Only admins can change team access.'}</p>
          <div class="list member-list">${list}</div>
          ${Cloud.isAdmin ? `<form class="row wrap" id="addMemberForm" style="margin-top:10px">
            <input class="input" style="flex:1;min-width:200px" type="email" name="email" placeholder="teammate@company.com" aria-label="Email to allow" required>
            <select class="select" name="role" aria-label="Role">${UI.selectOptions(roleOpts, 'member')}</select>
            <button class="btn" type="submit">${UI.icon('plus')}Allow</button></form>` : ''}
          <div class="row" style="margin-top:14px"><button class="btn btn-sm" data-act="signOut">Sign out</button></div>
        </div></div>`;
    }
    if (st === 'demo') {
      return `<div class="card"><div class="card-head"><h2>${UI.icon('database')} Demo workspace</h2></div><div class="card-body">
        <p>Everything here is fictional and saved only in your browser. Nothing is sent to a server, and the real team workspace is a separate, sign-in-only page.</p>
        <button class="btn" data-act="resetDemo">Reset demo data</button></div></div>`;
    }
    return `<div class="card"><div class="card-head"><h2>${UI.icon('database')} Storage: this browser</h2></div><div class="card-body">
      <p>Data is saved only in this browser on this computer. That is fine to start, but back up often.</p>
      <p class="muted">To share one workspace with your team (with sign-in, team allowlist and realtime updates), connect a free Supabase project: run <code>supabase/schema.sql</code> and paste the project URL and anon key into <code>js/config.js</code>. Step-by-step instructions are in the README.</p>
      ${Cloud.status.state === 'error' ? `<div class="banner danger">${UI.icon('alert')}<div>Cloud connection failed: ${esc(Cloud.status.detail)}</div></div>` : ''}
    </div></div>`;
  }

  function sampleSummary() {
    const found = S.findSample();
    const total = Object.values(found).reduce((n, ids) => n + ids.length, 0);
    const parts = Object.entries(found).map(([c, ids]) => `${ids.length} ${c}`);
    return { total, parts };
  }
  function sampleBanner() {
    if (Cloud.demo || !Cloud.isAdmin) return '';
    const { total, parts } = sampleSummary();
    if (!total) return '';
    return `<div class="banner warn" style="margin-top:10px">${UI.icon('alert')}<div><b>This workspace still has ${total} records from the fictional sample company</b> (${esc(parts.join(', '))}): Brightwater, Northside, Jordan Ellis and friends. Your own people and records are not touched.
      <div style="margin-top:8px"><button class="btn btn-sm btn-danger" data-act="removeSample">${UI.icon('trash')}Remove sample data</button></div></div></div>`;
  }

  function emailCard() {
    const e = S.settings.email || {};
    const n = S.settings.notify || {};
    const on = Mailer.configured();
    const board = S.boardMembers().filter((c) => c.email);
    return `<div class="card"><div class="card-head"><h2>${UI.icon('mail')} Email</h2><div class="right">${UI.badge(on ? 'Direct sending on' : 'Opens your mail app', on ? 'green' : 'slate')}</div></div>
      <div class="card-body">
        <p class="muted small">${on ? 'Emails are sent directly from the app through EmailJS, from the connected Gmail account.' : 'Emails open ready to send in Gmail, Outlook or your mail app. Turn on direct sending below (free, no domain needed).'}</p>
        <div class="row wrap" style="margin:10px 0 4px;">
          <button class="btn btn-brand" data-act="testBoardEmail" ${board.length ? '' : 'disabled'}>${UI.icon('mail')}Send test email to the board</button>
          <span class="muted small">${board.length ? `To ${board.map((c) => esc(S.contactName(c).split(' ')[0])).join(', ')} (${board.length})` : 'Add board members with an email first.'}</span>
        </div>
        <h3 style="font-size:14px;margin:16px 0 6px">Notifications</h3>
        <label class="check"><input type="checkbox" data-notify="assign" ${n.assign !== false ? 'checked' : ''}> <span>Email people when a task is assigned to them</span></label><br>
        <label class="check"><input type="checkbox" data-notify="comment" ${n.comment ? 'checked' : ''}> <span>Email the assignee and collaborators when someone comments on a task</span></label>
        ${Cloud.isAdmin ? `<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">Direct sending with EmailJS (${on ? 'connected' : 'set up in 5 minutes'})</summary>
          <ol class="small" style="line-height:1.6;padding-left:18px;margin:8px 0">
            <li>Create a free account at <a href="https://www.emailjs.com" target="_blank" rel="noopener">emailjs.com</a> (200 emails/month).</li>
            <li><b>Email Services → Add service → Gmail</b>, connect the company Gmail. Copy the <b>Service ID</b>.</li>
            <li><b>Email Templates → Create</b>: To email <code>{{to_email}}</code>, Subject <code>{{subject}}</code>, Content <code>{{message}}</code>, From name <code>{{from_name}}</code>, Reply to <code>{{reply_to}}</code>. Copy the <b>Template ID</b>.</li>
            <li><b>Account → General</b>: copy the <b>Public key</b>. In <b>Account → Security</b>, allow only <code>stick474-arch.github.io</code>.</li>
          </ol>
          <div class="form-grid">
            <div class="field"><label for="ejService">Service ID</label><input id="ejService" class="input" value="${esc(e.serviceId || '')}" placeholder="service_xxx"></div>
            <div class="field"><label for="ejTemplate">Template ID</label><input id="ejTemplate" class="input" value="${esc(e.templateId || '')}" placeholder="template_xxx"></div>
            <div class="field span-2"><label for="ejKey">Public key</label><input id="ejKey" class="input" value="${esc(e.publicKey || '')}" placeholder="Your EmailJS public key"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn btn-sm btn-primary" data-act="saveEmailCfg">Save</button>${on ? '<button class="btn btn-sm btn-ghost" data-act="clearEmailCfg">Turn off</button>' : ''}</div>
        </details>` : ''}
      </div></div>`;
  }

  function render(root) {
    const st = S.settings;
    const me = S.currentUser();
    const tags = S.tagsSorted();
    const usage = (id) => S.all('contacts').filter((c) => (c.tags || []).includes(id)).length + S.all('organizations').filter((o) => (o.tags || []).includes(id)).length;
    const groups = [...new Set(tags.map((t) => t.group || 'Other'))];

    root.innerHTML = `
      ${Parts.pageHead('Settings', 'Shape the categorization to your business. Keep lists short: fewer, clearer options get used.')}
      <div class="settings-grid">
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Workspace</h2></div><div class="card-body">
            <div class="form-grid">
              <div class="field span-2"><label for="sCompany">Company name</label><input id="sCompany" class="input" value="${esc(st.companyName)}" data-setting="companyName"></div>
              <div class="field span-2"><label for="sMe">You are</label><select id="sMe" class="input" data-me>${UI.selectOptions(UI.opts.users(), me?.id || '')}</select>
                <small class="help">Used for “My tasks” and as the default owner. Remembered in this browser.</small></div>
            </div>
          </div></div>
          ${cloudCard()}
          ${emailCard()}
          <div class="card"><div class="card-head"><h2>Team members</h2><span class="sub">people who own contacts, deals and tasks</span>
            <div class="right"><button class="btn btn-sm" data-act="newUser">${UI.icon('plus')}Add</button></div></div>
            <div class="card-body flush"><div class="list">${S.all('users').map((u) => `<div class="list-item clickable" data-act="editUser" data-id="${u.id}">
              ${UI.avatar(u.name, 'sm')}<div class="li-main"><b>${esc(u.name)}</b><small>${esc([u.role, u.email].filter(Boolean).join(' · '))}</small></div>
              <div class="li-side">${u.id === me?.id ? UI.badge('You', 'teal') : ''}${UI.icon('edit', 'ic-sm')}</div></div>`).join('') || '<div class="empty-sm">No team members yet.</div>'}</div></div></div>
          <div class="card"><div class="card-head"><h2>Tags</h2><span class="sub">${tags.length} · use “Group: value”</span>
            <div class="right"><button class="btn btn-sm" data-act="newTag">${UI.icon('plus')}New tag</button></div></div>
            <div class="card-body">${tags.length ? groups.map((g) => `<div style="margin-bottom:10px"><div class="small muted" style="font-weight:600;margin-bottom:4px">${esc(g)}</div>
              <div class="tags">${tags.filter((t) => (t.group || 'Other') === g).map((t) => `<button class="tag b-${t.color || 'slate'}" style="border:0;cursor:pointer" data-act="editTag" data-id="${t.id}" title="Edit tag">${esc(t.name)} <i>${usage(t.id)}</i></button>`).join('')}</div></div>`).join('')
              : '<div class="empty-sm" style="padding:0">No tags yet. Suggested groups: Interest, Role (Decision maker, Champion), Segment, Expertise.</div>'}</div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Keep-in-touch cadence</h2><span class="sub">default days between interactions, by contact type</span></div>
            <div class="card-body"><div class="cadence-grid">${S.CONTACT_TYPES.map((t) => `<label>${UI.badge(t.id, t.color)}<input class="input" type="number" min="0" value="${esc(st.cadence[t.id] ?? 0)}" data-cadence="${esc(t.id)}" aria-label="Cadence for ${esc(t.id)}"></label>`).join('')}</div>
            <p class="help" style="margin-top:8px">0 = no reminders. Contacts past their cadence show up in “Needs attention”. Each contact can override it.</p></div></div>
          <div class="card"><div class="card-head"><h2>Lists</h2><span class="sub">one option per line</span></div><div class="card-body">
            <div class="grid grid-3 list-editor">
              <div class="field"><label for="lSources">Lead sources</label><textarea id="lSources" data-list="sources">${esc(st.sources.join('\n'))}</textarea></div>
              <div class="field"><label for="lInd">Industries</label><textarea id="lInd" data-list="industries">${esc(st.industries.join('\n'))}</textarea></div>
              <div class="field"><label for="lCom">Board committees <button type="button" class="btn btn-sm btn-ghost" data-act="suggestCommittees" style="margin-left:6px; padding:2px 8px;">Use suggested</button></label><textarea id="lCom" data-list="committees">${esc(st.committees.join('\n'))}</textarea></div>
            </div>
            <button class="btn btn-sm" data-act="saveLists" style="margin-top:10px">Save lists</button>
          </div></div>
          <div class="card"><div class="card-head"><h2>Data</h2></div><div class="card-body">
            <div class="data-actions">
              <button class="btn" data-act="exportBackup">${UI.icon('download')}Download backup (JSON)</button>
              ${Cloud.canWrite ? `<label class="btn btn-primary" title="Adds people and records from a backup or recovery file. Nothing is deleted.">${UI.icon('upload')}Add from file<input type="file" id="mergeFile" hidden></label>` : ''}
              ${Cloud.isAdmin ? `<label class="btn" title="Replaces everything with the file">${UI.icon('upload')}Restore from backup (replace all)<input type="file" id="restoreFile" hidden></label>` : ''}
            </div>
            <p class="help" style="margin-top:8px">CSV exports for spreadsheets are on the Contacts, Organizations, Activity log and Resolutions pages.</p>
            ${sampleBanner()}
            ${S.mode === 'cloud' && Cloud.browserData() ? `<div class="banner info" style="margin-top:10px">${UI.icon('database')}<div><b>This browser still has ${Cloud.browserData().count} records from before the cloud</b>${Cloud.browserData().people.length ? ` (team: ${esc(Cloud.browserData().people.join(', '))})` : ''}. Download them, then use <b>Add from file</b> to bring them into the team workspace, or open <a href="recover.html">the recovery page</a> to pick specific people.<div style="margin-top:8px"><button class="btn btn-sm" data-act="downloadBrowserData">${UI.icon('download')}Download browser data</button></div></div></div>` : ''}
            ${Cloud.isAdmin ? `<hr>
            <div class="data-actions">
              ${S.mode !== 'cloud' && !Cloud.demo ? '<button class="btn" data-act="loadSample">Replace with sample data</button>' : ''}
              <button class="btn btn-danger-ghost" data-act="eraseAll">${UI.icon('trash')}Erase everything</button>
            </div>` : '<p class="help">Restore, sample data and erase are admin-only.</p>'}
          </div></div>
          <div class="card"><div class="card-head"><h2>Privacy & shortcuts</h2></div><div class="card-body">
            <div class="banner warn">${UI.icon('shield')}<div><b>Do not store patient health information (PHI) here.</b> This tool is for business relationships (clinics, employers, partners, board). HIPAA-covered data needs a vendor that signs a BAA.</div></div>
            <div class="shortcut-list"><kbd>/</kbd><span>Search everything</span><kbd>C</kbd><span>New contact</span><kbd>L</kbd><span>Log an interaction</span><kbd>T</kbd><span>New task</span><kbd>Esc</kbd><span>Close dialogs</span><kbd>Ctrl</kbd><span>+ Enter saves any form</span></div>
          </div></div>
        </div>
      </div>`;

    root.onchange = async (e) => {
      const t = e.target;
      if (t.dataset.notify) {
        S.setSettings({ notify: { ...S.settings.notify, [t.dataset.notify]: t.checked } }, { silent: true });
        UI.toast('Saved', 'success');
        return;
      }
      if (t.dataset.memberRole) {
        try { await Cloud.setMemberRole(t.dataset.memberRole, t.value); UI.toast(`${t.dataset.memberRole} is now ${t.value}`, 'success'); } catch (err) { UI.toast(err.message, 'error'); }
        await loadMembers();
        return;
      }
      if (t.dataset.setting) { S.setSettings({ [t.dataset.setting]: t.value.trim() || 'Aetherium' }); UI.toast('Saved', 'success'); }
      else if (t.dataset.me !== undefined) { S.setMe(t.value); if (S.mode !== 'cloud') S.setSettings({ currentUserId: t.value }); else App.rerender(); UI.toast('Saved', 'success'); }
      else if (t.dataset.cadence) { S.setSettings({ cadence: { ...S.settings.cadence, [t.dataset.cadence]: Math.max(0, Number(t.value) || 0) } }, { silent: true }); UI.toast(`Cadence for ${t.dataset.cadence} saved`, 'success'); }
      else if (t.id === 'mergeFile' && t.files[0]) {
        const text = await t.files[0].text();
        t.value = '';
        try {
          const { added, skipped } = S.mergeJSON(text);
          const parts = Object.entries(added).map(([c, n]) => `${n} ${c}`);
          UI.toast(parts.length ? `Added ${parts.join(', ')}${skipped.length ? ` · linked to existing: ${skipped.join(', ')}` : ''}` : (skipped.length ? `Linked to existing: ${skipped.join(', ')}` : 'Nothing new in that file'), parts.length ? 'success' : 'info', { duration: 8000 });
        } catch (err) { UI.toast(err.message || 'That file could not be read', 'error'); }
      }
      else if (t.id === 'restoreFile' && t.files[0]) {
        const text = await t.files[0].text();
        t.value = '';
        if (!(await UI.confirm('Restoring replaces ALL current data with the backup file. Continue?', { okText: 'Replace data' }))) return;
        try { S.importJSON(text); UI.toast('Backup restored', 'success'); } catch (err) { UI.toast(err.message || 'Invalid file', 'error'); }
      }
    };
    const form = root.querySelector('#addMemberForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { UI.toast('Enter a valid email', 'error'); return; }
        try { await Cloud.addMember(email, form.role.value); form.reset(); UI.toast(`${email} can now create an account and sign in`, 'success'); await loadMembers(); } catch (err) { UI.toast(err.message, 'error'); }
      };
      if (members === null) loadMembers();
    }
  }

  // Directors keep committee names as text: when a committee disappears from the list, ask where to move them.
  const COMMITTEE_GUESS = {
    'Audit & Finance': 'Finance & Licensing', Compensation: 'People & Governance', 'Governance & Nominating': 'People & Governance',
    'Clinical Quality': 'Operations & Service Delivery',
  };
  function remapCommittees(list) {
    const members = S.boardMembers({ includeFormer: true });
    const orphans = [...new Set(members.flatMap((c) => c.board?.committees || []))].filter((n) => !list.includes(n));
    if (!orphans.length) return;
    const options = [...list.map((n) => ({ value: n, label: n })), { value: '', label: '— Remove from directors —' }];
    UI.formModal({
      title: 'Move directors to the new committees',
      intro: `Some directors are still on committees that are no longer in the list. Choose where each one goes.`,
      size: 'md',
      submitText: 'Move directors',
      values: Object.fromEntries(orphans.map((n, i) => [`c${i}`, list.includes(COMMITTEE_GUESS[n]) ? COMMITTEE_GUESS[n] : ''])),
      fields: orphans.map((n, i) => ({
        name: `c${i}`, type: 'select', span: 2, options,
        label: `${n} (${members.filter((c) => (c.board?.committees || []).includes(n)).map((c) => S.contactName(c).split(' ')[0]).join(', ')})`,
      })),
      onSubmit: (d) => {
        let moved = 0;
        members.forEach((c) => {
          const cur = c.board?.committees || [];
          if (!cur.some((n) => orphans.includes(n))) return;
          const next = [...new Set(cur.map((n) => (orphans.includes(n) ? d[`c${orphans.indexOf(n)}`] : n)).filter(Boolean))];
          S.update('contacts', c.id, { board: { ...c.board, committees: next } });
          moved++;
        });
        UI.toast(`Committees updated for ${U.plural(moved, 'director')}`, 'success');
      },
    });
  }

  async function loadMembers() {
    try { members = await Cloud.listMembers(); } catch (e) { members = []; UI.toast(`Could not load team access: ${e.message}`, 'error'); }
    if (location.hash.startsWith('#/settings')) App.rerender();
  }

  return {
    render,
    actions: {
      suggestCommittees: () => {
        const ta = document.querySelector('#lCom');
        if (ta) { ta.value = S.SUGGESTED_COMMITTEES.join('\n'); ta.focus(); }
        UI.toast('Suggested committees loaded. Press Save lists to apply.', 'info');
      },
      saveLists: () => {
        const view = document.querySelector('#view');
        const patch = {};
        view.querySelectorAll('[data-list]').forEach((ta) => { patch[ta.dataset.list] = [...new Set(ta.value.split('\n').map((s) => s.trim()).filter(Boolean))]; });
        S.setSettings(patch);
        UI.toast('Lists saved', 'success');
        remapCommittees(patch.committees || S.settings.committees);
      },
      loadSample: async () => {
        if (!(await UI.confirm('Replace ALL current data with the sample workspace?', { okText: 'Replace with sample' }))) return;
        const data = Sample.build(S.currentUser()?.name || 'You');
        data.settings.companyName = S.settings.companyName;
        if (S.mode === 'cloud' && Cloud.user) data.users[0].email = Cloud.user.email;
        S.replaceAll(data);
        S.setMe(data.users[0].id);
        UI.toast('Sample data loaded', 'success');
      },
      eraseAll: async () => {
        if (!(await UI.confirm(`Erase every contact, deal, activity, task, meeting and resolution${S.mode === 'cloud' ? ' for the WHOLE TEAM' : ''}? Download a backup first if unsure.`, { okText: 'Erase everything' }))) return;
        const me = S.currentUser();
        const d = S.defaults();
        d.settings.companyName = S.settings.companyName;
        if (me) { d.users.push(me); d.settings.currentUserId = me.id; }
        S.replaceAll(d);
        UI.toast('Workspace erased');
      },
      removeSample: async () => {
        const { total, parts } = sampleSummary();
        if (!total) { UI.toast('No sample data left', 'info'); return; }
        if (!(await UI.confirm(`Remove ${total} sample records (${parts.join(', ')})? Your own people and records stay.`, { okText: 'Remove sample data' }))) return;
        const n = S.removeSample();
        UI.toast(`Removed ${n} sample records. The workspace is ready for your own data.`, 'success', { duration: 7000 });
      },
      testBoardEmail: async () => {
        const board = S.boardMembers().filter((c) => c.email);
        if (!board.length) { UI.toast('No board member has an email yet', 'error'); return; }
        const me = S.currentUser()?.name || 'The team';
        const when = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
        const body = `Hello board,\n\nThis is a test email from the ${S.settings.companyName || 'Aetherium'} CRM & Board workspace, sent by ${me} on ${when}.\n\nRecipients: ${board.map((c) => `${S.contactName(c)} <${c.email}>`).join(', ')}.\n\nIf you received it, board emails work. Please reply to confirm.\n\nWorkspace: ${Mailer.APP_URL}`;
        try {
          await Mailer.deliver({ to: board.map((c) => c.email).join(', '), subject: `Test · ${S.settings.companyName || 'Aetherium'} board email`, body });
          if (Cloud.canWrite) S.upsert('activities', { type: 'Email', date: U.now(), subject: 'Test email to the board', notes: body, contactIds: board.map((c) => c.id), orgId: S.mainOrg()?.id || '', dealId: '', meetingId: '', ownerId: S.currentUser()?.id || '' });
          if (!Mailer.configured()) UI.toast('Opened in your mail with all board members. Press send there.', 'info', { duration: 7000 });
        } catch (err) { UI.toast(`Test email failed: ${err.message}`, 'error', { duration: 9000 }); }
      },
      saveEmailCfg: () => {
        const v = (id) => (document.querySelector(`#${id}`)?.value || '').trim();
        const email = { serviceId: v('ejService'), templateId: v('ejTemplate'), publicKey: v('ejKey') };
        if (Object.values(email).some((x) => !x)) { UI.toast('Fill in the three EmailJS values', 'error'); return; }
        S.setSettings({ email });
        UI.toast('Direct sending is on. Try “Send test email to the board”.', 'success', { duration: 7000 });
      },
      clearEmailCfg: () => { S.setSettings({ email: { serviceId: '', templateId: '', publicKey: '' } }); UI.toast('Direct sending turned off'); },
      signOut: () => Cloud.signOut(),
      downloadBrowserData: () => Cloud.downloadBrowserData(),
      removeMember: async (ds) => {
        if (!(await UI.confirm(`Remove ${ds.email} from team access? They will no longer be able to see any data.`, { okText: 'Remove access' }))) return;
        try { await Cloud.removeMember(ds.email); UI.toast('Access removed'); await loadMembers(); } catch (e) { UI.toast(e.message, 'error'); }
      },
    },
  };
})();
