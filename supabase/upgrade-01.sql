-- =====================================================================================
-- Aetherium — upgrade 01 (October 2026). Run once in Supabase → SQL Editor. Safe to re-run.
-- Adds: projects (Asana-style tasks), corporate finance records and custom chat channels.
-- Requires schema.sql (and chat.sql for the channel part) to have been run before.
-- =====================================================================================

-- New record types: projects, accounts, transactions, subscriptions, budgets, shareholders
alter table public.crm_records drop constraint if exists crm_records_collection_check;
alter table public.crm_records add constraint crm_records_collection_check check (collection in (
  'settings', 'users', 'tags', 'organizations', 'contacts', 'deals', 'activities', 'tasks', 'meetings', 'resolutions',
  'projects', 'accounts', 'transactions', 'subscriptions', 'budgets', 'shareholders'));

-- Custom chat channels: 'c:<slug>' (lowercase letters, numbers, dashes)
do $$
begin
  if to_regclass('public.crm_messages') is not null then
    alter table public.crm_messages drop constraint if exists crm_messages_channel_check;
    alter table public.crm_messages add constraint crm_messages_channel_check
      check (channel ~ '^(general|board|c:[a-z0-9-]{1,40}|dm:[^|]+\|[^|]+)$');
  end if;
end $$;
