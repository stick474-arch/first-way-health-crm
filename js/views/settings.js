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
              <div class="field"><label for="lCom">Board committees</label><textarea id="lCom" data-list="committees">${esc(st.committees.join('\n'))}</textarea></div>
            </div>
            <button class="btn btn-sm" data-act="saveLists" style="margin-top:10px">Save lists</button>
          </div></div>
          <div class="card"><div class="card-head"><h2>Data</h2></div><div class="card-body">
            <div class="data-actions">
              <button class="btn" data-act="exportBackup">${UI.icon('download')}Download backup (JSON)</button>
              ${Cloud.isAdmin ? `<label class="btn">${UI.icon('upload')}Restore from backup<input type="file" accept="application/json,.json" id="restoreFile" hidden></label>` : ''}
            </div>
            <p class="help" style="margin-top:8px">CSV exports for spreadsheets are on the Contacts, Organizations, Activity log and Resolutions pages.</p>
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
      if (t.dataset.memberRole) {
        try { await Cloud.setMemberRole(t.dataset.memberRole, t.value); UI.toast(`${t.dataset.memberRole} is now ${t.value}`, 'success'); } catch (err) { UI.toast(err.message, 'error'); }
        await loadMembers();
        return;
      }
      if (t.dataset.setting) { S.setSettings({ [t.dataset.setting]: t.value.trim() || 'Aetherium' }); UI.toast('Saved', 'success'); }
      else if (t.dataset.me !== undefined) { S.setMe(t.value); if (S.mode !== 'cloud') S.setSettings({ currentUserId: t.value }); else App.rerender(); UI.toast('Saved', 'success'); }
      else if (t.dataset.cadence) { S.setSettings({ cadence: { ...S.settings.cadence, [t.dataset.cadence]: Math.max(0, Number(t.value) || 0) } }, { silent: true }); UI.toast(`Cadence for ${t.dataset.cadence} saved`, 'success'); }
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

  async function loadMembers() {
    try { members = await Cloud.listMembers(); } catch (e) { members = []; UI.toast(`Could not load team access: ${e.message}`, 'error'); }
    if (location.hash.startsWith('#/settings')) App.rerender();
  }

  return {
    render,
    actions: {
      saveLists: () => {
        const view = document.querySelector('#view');
        const patch = {};
        view.querySelectorAll('[data-list]').forEach((ta) => { patch[ta.dataset.list] = [...new Set(ta.value.split('\n').map((s) => s.trim()).filter(Boolean))]; });
        S.setSettings(patch);
        UI.toast('Lists saved', 'success');
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
      signOut: () => Cloud.signOut(),
      removeMember: async (ds) => {
        if (!(await UI.confirm(`Remove ${ds.email} from team access? They will no longer be able to see any data.`, { okText: 'Remove access' }))) return;
        try { await Cloud.removeMember(ds.email); UI.toast('Access removed'); await loadMembers(); } catch (e) { UI.toast(e.message, 'error'); }
      },
    },
  };
})();
