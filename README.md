# First Way Health · CRM & Board

A lightweight CRM built for a small health-services company that is starting to win its first clients — and that also needs to run its **board of directors** properly from day one.

- **Client tracking**: organizations, contacts, deals pipeline, interaction log, follow-ups.
- **Contact categorization system**: every contact has one *type* (inside one *group*), a *priority tier*, a *source*, an *owner* and optional *tags*, plus a "keep-in-touch" cadence that flags relationships going cold.
- **Board of directors**: members with roles, committees, terms and conflict-of-interest disclosures; meetings with agenda, attendance & quorum, minutes, printable/PDF minutes; a resolution register (meeting votes and written consents); board action items that carry over until done.
- **Two storage modes**: runs fully in the browser with zero setup (local mode), or connects to **Supabase** for a shared team workspace with sign-in, a team allowlist, Row Level Security and realtime updates (cloud mode).

No framework, no build step: plain HTML, CSS and JavaScript.

**Live demo:** https://stick474-arch.github.io/first-way-health-crm/ (choose *Explore with sample data*; demo data stays in your browser).

---

## Why it looks like this: what founders say in forums

Before building, I reviewed founder and small-business discussions (Hacker News "Ask HN" CRM threads, Indie Hackers CRM threads) plus small-business CRM guidance. The recurring themes shaped the design:

| What people said | Design decision |
|---|---|
| Early on, teams mostly need **contacts + interaction history**; extra features go unused for a long time. | Core = contacts, organizations, activity log. No marketing automation, no custom-field builder. |
| CRMs fail when they are **too complex** or built for admins; teams drift back to spreadsheets. | Few required fields, sensible defaults, one-click "Log call / email / meeting", keyboard shortcuts, CSV export. |
| The real pain is **losing track of follow-ups**. | Logging an interaction asks for the **next step** (task + date) in the same form. Dashboard "Today's focus". Each contact shows its next step. |
| **Tag sprawl** ("account manager" vs "Account Manager", hundreds of tags) ruins categorization. Use a lifecycle stage as the backbone and `Group: value` tags. | One **type** per contact (Lead → Prospect → Client → Past Client, Partner, Referral Source, Vendor, Investor, Board Member, Advisor, Team) grouped into 4 groups; tags are a managed list with groups and colors; duplicate checks. |
| Automate stage changes where possible. | When a deal moves forward or is **won**, the contact and organization are re-categorized automatically (Lead → Prospect → Client). |
| Spreadsheets are fine for the first ~10 customers, then you need reminders. | Keep-in-touch **cadence per type** (e.g. Prospects every 14 days, Board members every 30) with a "Needs attention" list. |
| Early-stage board meetings work best as **discussion meetings** driven by a CEO memo sent in advance; separate items *for decision* from *for discussion*; assign owners and follow-ups before people leave. Minutes and votes are short but must be recorded. | Agenda items are typed *Information / Discussion / Decision*; standard agenda template; "board pack due" reminder 5 days before; attendance & automatic quorum; minutes drafted from the agenda; resolution register with vote counts; action items with owners (team or directors) and carry-over. |

Sources: [Ask HN: For your startup, do you use a CRM?](https://news.ycombinator.com/item?id=13116175) · [Ask HN: Best CRM for small company](https://news.ycombinator.com/item?id=21137969) · [Ask HN: What do you like to discuss in your board meetings?](https://news.ycombinator.com/item?id=42066517) · [Indie Hackers: Do you use a CRM?](https://www.indiehackers.com/post/do-you-use-a-crm-a330ee7601) · [Indie Hackers: Which CRM do you use and why?](https://www.indiehackers.com/post/which-crm-do-you-use-and-why-8ed0eff179) · [SBA: 3 biggest problems implementing a CRM](https://www.sba.gov/blog/3-biggest-problems-implementing-crm-system-what-do-about-them) · [Nutshell: most important CRM features for small businesses](https://www.nutshell.com/blog/most-important-crm-features-small-businesses) · [BenchmarkONE: tagging best practices](https://www.benchmarkone.com/blog/best-practices-marketing-automation-tags/) · [Yale Insights: even small businesses need governance](https://insights.som.yale.edu/insights/even-small-businesses-need-corporate-governance)

---

## Features

**Dashboard** — active clients, open & weighted pipeline, won this quarter, tasks due, next board meeting; today's focus; relationships needing attention; pipeline by stage; lead sources; board snapshot.

**Contacts** — group tabs (Clients & leads · Network · Board & advisors · Internal), filters by type, tier, tag, owner and "needs attention", sortable table, CSV export. Profile with interaction timeline, next steps, deals, relationship health and, for directors, the board card (role, committees, term progress, attendance rate, conflicts of interest).

**Organizations** — relationship type, industry, size, people, open pipeline, last activity, full history.

**Pipeline** — Kanban with drag & drop (or a stage menu on each card for keyboard/mobile), stage probabilities, weighted forecast, win rate, stale-deal and past-close-date warnings, required lost reason.

**Activity log** — calls, emails, meetings, video calls, messages and notes with clients, partners **and** board members in one timeline; filter by audience, type, person and period; CSV export.

**Tasks & follow-ups** — Overdue / Today / Next 7 days / Later; kinds: Follow-up, Board action, To-do; owners can be team members or directors; completing a follow-up offers to log the interaction.

**Board of Directors** — overview with alerts (terms ending in 120 days, overdue action items, no meeting scheduled, board pack due); members; meetings (agenda editor, attendance & quorum, auto-saving minutes, "draft from agenda", printable minutes with signature lines); resolution register with numbering `R-YYYY-NNN`; action items.

**Settings** — company name, "you are", team members, tags, lead sources, industries, committees, cadence per contact type, JSON backup/restore, sample data, erase, cloud workspace & team access.

Global search (`/`), shortcuts (`C` contact, `L` log interaction, `T` task, `Ctrl+Enter` saves forms), light/dark theme, responsive down to phone width.

---

## Run it

**Local mode (no setup):** open `index.html` in a browser, or serve the folder:

```bash
node tools/serve.mjs
```

Then open http://localhost:5173. Data is stored in the browser's `localStorage`; use **Back up now** to download a JSON backup.

## Cloud mode with Supabase (shared team workspace)

Why Supabase over Firebase for this app: the data is relational (contacts ↔ organizations ↔ deals ↔ meetings ↔ resolutions), Postgres gives SQL reporting views and easy exports, Row Level Security keeps the public anon key safe, auth is built in, and the free tier is enough for a small team.

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Add the first admin(s) (edit the email and run):
   ```sql
   insert into public.crm_members (email, role) values ('you@firstwayhealth.com', 'admin')
   on conflict (email) do update set role = 'admin';
   ```
4. **Authentication → URL Configuration**: set *Site URL* to your app URL (e.g. `https://stick474-arch.github.io/first-way-health-crm/`) and add it to *Redirect URLs* (add `http://localhost:5173` too for local testing).
5. **Project Settings → API Keys**: copy the *Project URL* and the *publishable* key (`sb_publishable_…`, or the legacy *anon* key) into [`js/config.js`](js/config.js). Never use a secret / `service_role` key in the browser.
6. Commit and push. Open the app, choose **Create your account** (or **Email me a sign-in link**) with the allowlisted email, and pick *sample data*, *empty* or *upload what's in this browser*.

Admins add teammates in **Settings → Team access** and pick a role; the person then creates an account with that email and confirms it. Anyone not on the list can sign up but cannot read or write anything. Keep **Confirm email** enabled in Supabase Auth: access is granted only to confirmed emails.

### Roles

| Role | Can do |
|---|---|
| **Admin** | Everything, plus add/remove people, change roles, restore backups, load sample data, erase the workspace |
| **Member** | Read and edit all CRM and board data |
| **Viewer** | Read-only (e.g. a board observer or advisor) |

Roles are enforced in the database (RLS policies use `crm_role()`, `crm_can_write()` and `crm_is_admin()`), and the UI hides what a role cannot do. The workspace can never be left without an admin. To add a role later (for example *Board-only*), extend the `crm_members_role_check` constraint and its policies in `supabase/schema.sql` — policies can also filter by `crm_records.collection`.

Notes: Supabase's built-in email sender is rate-limited (fine for a few users; configure SMTP for more). Free projects pause after a week of inactivity and resume from the dashboard.

### How sync works

- One table, `crm_records (id, collection, data jsonb, updated_at, updated_by)`, holds every record; a `settings` row holds workspace settings. JSONB lets the product evolve without migrations; SQL views (`crm_contacts_v`, `crm_deals_v`, `crm_resolutions_v`) expose typed columns for reporting.
- Every create/update/delete is queued and upserted in small batches (debounced), with automatic retry when offline.
- Realtime (`postgres_changes`) applies teammates' edits live; a record you are editing locally is never overwritten by an incoming change, and the page never re-renders under your cursor while you type.
- RLS: only authenticated users with a confirmed email listed in `crm_members` can read; admins and members can write; only admins manage access. Anonymous access is revoked.

## Privacy

This tool is for **business relationships** (clinics, employers, partners, investors, the board). **Do not store patient health information (PHI)**: HIPAA-covered data requires a vendor that signs a Business Associate Agreement.

## Project structure

```
index.html            App shell
css/app.css           Design tokens (light/dark), layout, components
js/config.js          Supabase URL + anon key (empty = local mode)
js/util.js            Dates, money, CSV, helpers
js/store.js           Data model, categorization rules, lifecycle automation, persistence
js/sample.js          Realistic sample workspace (dates relative to today)
js/ui.js              Icons, badges, toasts, modals, form builder, menus
js/cloud.js           Supabase auth, allowlist check, sync queue, realtime
js/actions.js         Create/edit flows for every record type
js/views/*.js         Dashboard, contacts, organizations, pipeline, activities, tasks, board, settings
js/app.js             Router, navigation, global search, shortcuts, onboarding
supabase/schema.sql   Tables, RLS policies, realtime, reporting views
tools/serve.mjs       Zero-dependency local server
```

## Roadmap ideas

Email/calendar integration (Gmail/Outlook), file attachments for board packs (Supabase Storage), per-user notifications for due tasks, role-based permissions (admin vs member), import from CSV.
