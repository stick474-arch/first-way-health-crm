-- =====================================================================================
-- First Way Health CRM & Board — Supabase schema
-- Run once in: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent).
-- =====================================================================================

-- 1) Team allowlist: only these emails can read or write CRM data -----------------------
create table if not exists public.crm_members (
  email     text primary key check (email = lower(email)),
  role      text not null default 'member' check (role in ('admin', 'member')),
  added_at  timestamptz not null default now(),
  added_by  uuid default auth.uid()
);

-- Is the signed-in user on the allowlist? (security definer so it can read crm_members under RLS)
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_members m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

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
create policy "members read records"   on public.crm_records for select to authenticated using (public.is_member());
create policy "members insert records" on public.crm_records for insert to authenticated with check (public.is_member());
create policy "members update records" on public.crm_records for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "members delete records" on public.crm_records for delete to authenticated using (public.is_member());

-- Small team: any member can see and manage the allowlist.
drop policy if exists "members read allowlist"   on public.crm_members;
drop policy if exists "members add to allowlist" on public.crm_members;
drop policy if exists "members remove from allowlist" on public.crm_members;
create policy "members read allowlist"        on public.crm_members for select to authenticated using (public.is_member());
create policy "members add to allowlist"      on public.crm_members for insert to authenticated with check (public.is_member());
create policy "members remove from allowlist" on public.crm_members for delete to authenticated
  using (public.is_member() and email <> lower(coalesce(auth.jwt() ->> 'email', '')));  -- can't remove yourself

-- No access at all for anonymous visitors.
revoke all on public.crm_records from anon;
revoke all on public.crm_members from anon;
grant select, insert, update, delete on public.crm_records to authenticated;
grant select, insert, delete on public.crm_members to authenticated;

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

grant select on public.crm_contacts_v, public.crm_deals_v, public.crm_resolutions_v to authenticated;

-- 6) Bootstrap: add YOUR email as the first admin (edit, then run this line) -------------
-- insert into public.crm_members (email, role) values ('you@firstwayhealth.com', 'admin') on conflict do nothing;
