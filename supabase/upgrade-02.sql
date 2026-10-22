-- =====================================================================================
-- Aetherium — upgrade 02 (October 2026): Slack-style chat. Run once in Supabase → SQL Editor,
-- after chat.sql and upgrade-01.sql. Safe to re-run.
-- Adds: threads, edited messages, polls (meta), reactions / pins / poll votes, private channels,
-- and private personal notes (crm_notes).
-- =====================================================================================

-- 1. Messages: thread parent, edit time, extra data (polls, "also sent to channel")
alter table public.crm_messages add column if not exists parent_id uuid references public.crm_messages(id) on delete cascade;
alter table public.crm_messages add column if not exists edited_at timestamptz;
alter table public.crm_messages add column if not exists meta jsonb not null default '{}'::jsonb;
create index if not exists crm_messages_parent_idx on public.crm_messages (parent_id) where parent_id is not null;

-- Channels: built-in, public 'c:<slug>', private 'p:<slug>' and direct messages
alter table public.crm_messages drop constraint if exists crm_messages_channel_check;
alter table public.crm_messages add constraint crm_messages_channel_check
  check (channel ~ '^(general|board|[cp]:[a-z0-9-]{1,40}|dm:[^|]+\|[^|]+)$');

-- 2. Who can see a channel: DMs → the two people; private → the channel's members (kept in the
--    workspace settings record); everything else → everyone on the team access list.
create or replace function public.crm_can_see_channel(ch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and (
    case
      when ch like 'dm:%' then lower(coalesce(auth.jwt() ->> 'email', '')) in (
        split_part(substr(ch, 4), '|', 1), split_part(substr(ch, 4), '|', 2))
      when ch like 'p:%' then exists (
        select 1
        from public.crm_records r,
             jsonb_array_elements(coalesce(r.data -> 'channels', '[]'::jsonb)) c
        where r.collection = 'settings' and r.id = 'workspace'
          and c ->> 'id' = ch
          and coalesce(c -> 'memberEmails', '[]'::jsonb) ? lower(coalesce(auth.jwt() ->> 'email', '')))
      else true
    end
  );
$$;
revoke all on function public.crm_can_see_channel(text) from public, anon;
grant execute on function public.crm_can_see_channel(text) to authenticated;

-- Replies must stay in their parent's channel
drop policy if exists "team posts messages" on public.crm_messages;
create policy "team posts messages" on public.crm_messages for insert to authenticated
  with check (
    public.crm_can_see_channel(channel)
    and author_id = auth.uid()
    and author_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (parent_id is null or exists (select 1 from public.crm_messages p where p.id = parent_id and p.channel = channel))
  );

-- Authors can edit their own messages (only the text, edit time and extra data)
drop policy if exists "authors edit messages" on public.crm_messages;
create policy "authors edit messages" on public.crm_messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and public.crm_can_see_channel(channel));
revoke update on public.crm_messages from authenticated;
grant update (body, edited_at, meta) on public.crm_messages to authenticated;

-- 3. Reactions, pins and poll votes on messages
create table if not exists public.crm_message_marks (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.crm_messages(id) on delete cascade,
  kind        text not null check (kind in ('reaction', 'pin', 'vote')),
  value       text not null default '' check (char_length(value) <= 40),
  user_email  text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  user_name   text not null default '',
  created_at  timestamptz not null default now(),
  unique (message_id, kind, value, user_email)
);
create index if not exists crm_message_marks_msg_idx on public.crm_message_marks (message_id);

alter table public.crm_message_marks enable row level security;
drop policy if exists "team reads marks"   on public.crm_message_marks;
drop policy if exists "team adds marks"    on public.crm_message_marks;
drop policy if exists "team removes marks" on public.crm_message_marks;
-- visible when its message is visible (the messages policy applies inside the subquery)
create policy "team reads marks" on public.crm_message_marks for select to authenticated
  using (exists (select 1 from public.crm_messages m where m.id = message_id));
create policy "team adds marks" on public.crm_message_marks for insert to authenticated
  with check (
    user_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (select 1 from public.crm_messages m where m.id = message_id)
  );
-- your own reactions and votes; pins can be removed by anyone who can see the message
create policy "team removes marks" on public.crm_message_marks for delete to authenticated
  using (
    user_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    or (kind = 'pin' and exists (select 1 from public.crm_messages m where m.id = message_id))
    or public.crm_is_admin()
  );
revoke all on public.crm_message_marks from anon;
grant select, insert, delete on public.crm_message_marks to authenticated;

-- 4. Realtime for edits, reactions and pins
alter table public.crm_message_marks replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_message_marks'
  ) then
    alter publication supabase_realtime add table public.crm_message_marks;
  end if;
end $$;

-- 5. Personal notes (Google Keep style): private to their owner, optionally shared with teammates
create table if not exists public.crm_notes (
  id          text primary key check (char_length(id) between 4 and 64),
  owner_id    uuid not null default auth.uid(),
  owner_email text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  shared_with text[] not null default '{}',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists crm_notes_owner_idx on public.crm_notes (owner_id);

alter table public.crm_notes enable row level security;
drop policy if exists "owners and collaborators read notes" on public.crm_notes;
drop policy if exists "owners create notes"                 on public.crm_notes;
drop policy if exists "owners and collaborators edit notes" on public.crm_notes;
drop policy if exists "owners delete notes"                 on public.crm_notes;
create policy "owners and collaborators read notes" on public.crm_notes for select to authenticated
  using (owner_id = auth.uid() or lower(coalesce(auth.jwt() ->> 'email', '')) = any (shared_with));
create policy "owners create notes" on public.crm_notes for insert to authenticated
  with check (owner_id = auth.uid() and public.is_member());
create policy "owners and collaborators edit notes" on public.crm_notes for update to authenticated
  using (owner_id = auth.uid() or lower(coalesce(auth.jwt() ->> 'email', '')) = any (shared_with))
  with check (owner_id = auth.uid() or lower(coalesce(auth.jwt() ->> 'email', '')) = any (shared_with));
create policy "owners delete notes" on public.crm_notes for delete to authenticated
  using (owner_id = auth.uid());
revoke all on public.crm_notes from anon;
revoke update on public.crm_notes from authenticated;
grant select, insert, delete on public.crm_notes to authenticated;
grant update (data, shared_with, updated_at) on public.crm_notes to authenticated;

alter table public.crm_notes replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_notes'
  ) then
    alter publication supabase_realtime add table public.crm_notes;
  end if;
end $$;
