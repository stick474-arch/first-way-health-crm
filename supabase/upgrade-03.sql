-- =====================================================================================
-- Aetherium — upgrade 03 (October 2026): agents & operations. Run once in Supabase → SQL Editor.
-- Safe to re-run. After this, new record types (agents, operations and future modules) no longer
-- need a database change: any lowercase collection name is accepted. Access is still governed by
-- the same row-level security (team members read, admins/members write).
-- =====================================================================================

alter table public.crm_records drop constraint if exists crm_records_collection_check;
alter table public.crm_records add constraint crm_records_collection_check
  check (collection ~ '^[a-z][a-z_]{1,39}$');
