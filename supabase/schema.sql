-- =====================================================================================
-- Aetherium CRM & Board — Supabase schema
-- Run in: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent): re-run it after pulling a new version of the app.
-- =====================================================================================

-- 1) Team access list + roles ------------------------------------------------------------
--    admin  : everything, plus manage team access and roles
--    member : read and write all CRM and board data
--    viewer : read-only (e.g. a board observer or an advisor)
--    To add a role later: extend the check constraint below, then decide its permissions in
--    crm_can_write() / the policies in section 3 (they can also look at crm_records.collection).
create table if not exists public.crm_members (
  email     text primary key check (email = lower(email)),
  role      text not null default 'member',
  added_at  timestamptz not null default now(),
  added_by  uuid default auth.uid()
);
alter table public.crm_members drop constraint if exists crm_members_role_check;
alter table public.crm_members add constraint crm_members_role_check check (role in ('admin', 'member', 'viewer'));

-- The signed-in user's role, or null. Only CONFIRMED emails count, so nobody can claim an
-- allowlisted address without proving they own it. Security definer: reads auth.users and
-- crm_members regardless of RLS.
create or replace function public.crm_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.role
  from public.crm_members m
  join auth.users u on lower(u.email) = m.email
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
  limit 1;
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select public.crm_role() is not null; $$;

create or replace function public.crm_can_write()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.crm_role() in ('admin', 'member'), false); $$;

create or replace function public.crm_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.crm_role() = 'admin', false); $$;

revoke all on function public.crm_role(), public.is_member(), public.crm_can_write(), public.crm_is_admin() from public, anon;
grant execute on function public.crm_role(), public.is_member(), public.crm_can_write(), public.crm_is_admin() to authenticated;

-- Never leave the workspace without an admin.
create or replace function public.crm_keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and (select count(*) from public.crm_members where role = 'admin') <= 1 then
    raise exception 'The workspace needs at least one admin.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists crm_members_keep_admin on public.crm_members;
create trigger crm_members_keep_admin before update or delete on public.crm_members
  for each row execute function public.crm_keep_one_admin();

-- 2) CRM records: one row per contact / organization / deal / activity / task / meeting /
--    resolution / tag / team member, plus one 'settings' row. The app's record shape lives
--    in the JSONB "data" column, so the product can evolve without migrations.
create table if not exists public.crm_records (
  id          text primary key,
  collection  text not null check (collection in (
                'settings', 'users', 'tags', 'organizations', 'contacts', 'deals',
                'activities', 'tasks', 'meetings', 'resolutions')),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists crm_records_collection_idx on public.crm_records (collection);
create index if not exists crm_records_data_gin_idx on public.crm_records using gin (data jsonb_path_ops);

create or replace function public.crm_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists crm_records_touch on public.crm_records;
create trigger crm_records_touch before update on public.crm_records
  for each row execute function public.crm_touch();

-- 3) Row Level Security ------------------------------------------------------------------
alter table public.crm_records enable row level security;
alter table public.crm_members enable row level security;

drop policy if exists "members read records"   on public.crm_records;
drop policy if exists "members insert records" on public.crm_records;
drop policy if exists "members update records" on public.crm_records;
drop policy if exists "members delete records" on public.crm_records;
drop policy if exists "team reads records"     on public.crm_records;
drop policy if exists "writers insert records" on public.crm_records;
drop policy if exists "writers update records" on public.crm_records;
drop policy if exists "writers delete records" on public.crm_records;
create policy "team reads records"     on public.crm_records for select to authenticated using (public.is_member());
create policy "writers insert records" on public.crm_records for insert to authenticated with check (public.crm_can_write());
create policy "writers update records" on public.crm_records for update to authenticated using (public.crm_can_write()) with check (public.crm_can_write());
create policy "writers delete records" on public.crm_records for delete to authenticated using (public.crm_can_write());

drop policy if exists "members read allowlist"        on public.crm_members;
drop policy if exists "members add to allowlist"      on public.crm_members;
drop policy if exists "members remove from allowlist" on public.crm_members;
drop policy if exists "team reads access list"        on public.crm_members;
drop policy if exists "admins add people"             on public.crm_members;
drop policy if exists "admins change roles"           on public.crm_members;
drop policy if exists "admins remove people"          on public.crm_members;
create policy "team reads access list" on public.crm_members for select to authenticated using (public.is_member());
create policy "admins add people"      on public.crm_members for insert to authenticated with check (public.crm_is_admin());
create policy "admins change roles"    on public.crm_members for update to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
create policy "admins remove people"   on public.crm_members for delete to authenticated
  using (public.crm_is_admin() and email <> lower(coalesce(auth.jwt() ->> 'email', '')));  -- can't remove yourself

-- No access at all for anonymous visitors.
revoke all on public.crm_records from anon;
revoke all on public.crm_members from anon;
grant select, insert, update, delete on public.crm_records to authenticated;
grant select, insert, update, delete on public.crm_members to authenticated;

-- 4) Realtime: teammates see each other's changes live ------------------------------------
alter table public.crm_records replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_records'
  ) then
    alter publication supabase_realtime add table public.crm_records;
  end if;
end $$;

-- 5) Reporting views (respect RLS via security_invoker) — handy for SQL, BI or CSV exports
create or replace view public.crm_contacts_v with (security_invoker = true) as
select
  r.id,
  r.data ->> 'firstName'  as first_name,
  r.data ->> 'lastName'   as last_name,
  r.data ->> 'title'      as title,
  r.data ->> 'type'       as contact_type,
  r.data ->> 'priority'   as tier,
  r.data ->> 'source'     as source,
  r.data ->> 'email'      as email,
  o.data ->> 'name'       as organization,
  r.data -> 'board' ->> 'role'    as board_role,
  r.data -> 'board' ->> 'termEnd' as board_term_end,
  r.updated_at
from public.crm_records r
left join public.crm_records o on o.collection = 'organizations' and o.id = r.data ->> 'orgId'
where r.collection = 'contacts';

create or replace view public.crm_deals_v with (security_invoker = true) as
select
  r.id,
  r.data ->> 'name'                        as deal,
  o.data ->> 'name'                        as organization,
  r.data ->> 'stage'                       as stage,
  nullif(r.data ->> 'value', '')::numeric  as annual_value,
  nullif(r.data ->> 'expectedClose', '')::date as expected_close,
  nullif(r.data ->> 'closedAt', '')::date      as closed_at,
  r.data ->> 'lostReason'                  as lost_reason,
  r.updated_at
from public.crm_records r
left join public.crm_records o on o.collection = 'organizations' and o.id = r.data ->> 'orgId'
where r.collection = 'deals';

create or replace view public.crm_resolutions_v with (security_invoker = true) as
select
  r.id,
  r.data ->> 'number'  as number,
  nullif(r.data ->> 'date', '')::date as resolution_date,
  r.data ->> 'title'   as resolution,
  r.data ->> 'method'  as method,
  r.data ->> 'status'  as status,
  nullif(r.data ->> 'votesFor', '')::int     as votes_for,
  nullif(r.data ->> 'votesAgainst', '')::int as votes_against,
  nullif(r.data ->> 'abstain', '')::int      as abstentions
from public.crm_records r
where r.collection = 'resolutions';

revoke all on public.crm_contacts_v, public.crm_deals_v, public.crm_resolutions_v from anon;
grant select on public.crm_contacts_v, public.crm_deals_v, public.crm_resolutions_v to authenticated;

-- 6) First admin(s): edit the email(s), then run these lines --------------------------------
-- insert into public.crm_members (email, role) values ('you@company.com', 'admin')
--   on conflict (email) do update set role = 'admin';
