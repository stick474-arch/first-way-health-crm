-- =====================================================================================
-- Aetherium — Team chat (run once in Supabase → SQL Editor, after schema.sql). Safe to re-run.
-- Channels: 'general', 'board', and direct messages 'dm:<email-a>|<email-b>' (emails sorted).
-- Everyone on the team access list can read and post in channels; a direct message can only be
-- read by its two participants.
-- =====================================================================================

create table if not exists public.crm_messages (
  id           uuid primary key default gen_random_uuid(),
  channel      text not null check (channel ~ '^(general|board|dm:[^|]+\|[^|]+)$'),
  body         text not null check (char_length(body) between 1 and 4000),
  author_id    uuid not null default auth.uid(),
  author_email text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  author_name  text not null default '',
  created_at   timestamptz not null default now()
);
-- Allowed channels: built-in, public 'c:<slug>', private 'p:<slug>' and direct messages
alter table public.crm_messages drop constraint if exists crm_messages_channel_check;
alter table public.crm_messages add constraint crm_messages_channel_check
  check (channel ~ '^(general|board|[cp]:[a-z0-9-]{1,40}|dm:[^|]+\|[^|]+)$');
create index if not exists crm_messages_channel_idx on public.crm_messages (channel, created_at desc);

-- Can the signed-in person see this channel?
create or replace function public.crm_can_see_channel(ch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and (
    ch not like 'dm:%'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      split_part(substr(ch, 4), '|', 1),
      split_part(substr(ch, 4), '|', 2)
    )
  );
$$;
revoke all on function public.crm_can_see_channel(text) from public, anon;
grant execute on function public.crm_can_see_channel(text) to authenticated;

alter table public.crm_messages enable row level security;
drop policy if exists "team reads messages"     on public.crm_messages;
drop policy if exists "team posts messages"     on public.crm_messages;
drop policy if exists "authors delete messages" on public.crm_messages;
create policy "team reads messages" on public.crm_messages for select to authenticated
  using (public.crm_can_see_channel(channel));
create policy "team posts messages" on public.crm_messages for insert to authenticated
  with check (
    public.crm_can_see_channel(channel)
    and author_id = auth.uid()
    and author_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "authors delete messages" on public.crm_messages for delete to authenticated
  using (author_id = auth.uid() or public.crm_is_admin());

revoke all on public.crm_messages from anon;
grant select, insert, delete on public.crm_messages to authenticated;

-- Realtime: new messages appear instantly for everyone allowed to read them
alter table public.crm_messages replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_messages'
  ) then
    alter publication supabase_realtime add table public.crm_messages;
  end if;
end $$;
