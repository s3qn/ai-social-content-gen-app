-- 0006_peers_per_account.sql
-- Two fixes to the peers feature, which share one cause.
--
-- 1. Peers belong to a CONNECTED ACCOUNT, not to the login. A user with a
--    fitness account and a food account needs a separate peer list for each,
--    so tracked_peers gains `account_handle` and the cap counts within it.
--
-- 2. Suggestions were keyed on the onboarding niche answer alone: ten coarse
--    self-declared slugs. The first user in a slug filled the shared row and
--    everyone else inherited it regardless of what they post. The key becomes
--    (niche, subtopic), where both are DERIVED from the account's own scanned
--    content by a cheap Claude call and stored per account in account_niches.
--
-- 0005 is already applied and may hold rows, so every step here is idempotent
-- and backfills rather than assuming an empty table.

-- Which connected account a tracked peer belongs to. Defaults to '' so the
-- column can be added to a populated table; the backfill below fills it in.
alter table public.tracked_peers
  add column if not exists account_handle text not null default '';

-- Backfill existing rows onto the user's active connected account. Rows for a
-- user with no active account stay '' and simply stop showing up, which is
-- correct: there is no account for them to belong to.
update public.tracked_peers tp
set account_handle = coalesce(
  (select ca.handle
   from public.connected_accounts ca
   where ca.user_id = tp.user_id and ca.is_active
   limit 1),
  ''
)
where tp.account_handle = '';

-- Move the primary key from (user_id, handle) to
-- (user_id, account_handle, handle), so two of your accounts can track the same
-- peer independently. Guarded on the constraint's current column count so a
-- re-run is a no-op.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tracked_peers_pkey'
      and conrelid = 'public.tracked_peers'::regclass
      and array_length(conkey, 1) = 2
  ) then
    alter table public.tracked_peers drop constraint tracked_peers_pkey;
    alter table public.tracked_peers
      add constraint tracked_peers_pkey primary key (user_id, account_handle, handle);
  end if;
end;
$$;

-- The cap is now PER CONNECTED ACCOUNT: 3 peers per account while anonymous,
-- 10 per account once a real identity is attached.
--
-- The reasoning is unchanged from 0004 and 0005 and is repeated because it is
-- the easy part to get wrong:
--
--   SECURITY DEFINER, because a policy on tracked_peers cannot itself select
--   from tracked_peers (Postgres reports infinite recursion in the policy).
--
--   VOLATILE rather than stable, because a stable function reads the calling
--   statement's start snapshot, so every row of one multi-row insert would
--   count zero and slip past the cap in a single request.
--
--   The count EXCLUDES the row's own handle, because INSERT ... ON CONFLICT
--   evaluates the insert WITH CHECK on every proposed row even when the update
--   path is taken, so counting it would refuse an at-cap user re-tracking a
--   peer they already have.
create or replace function public.tracked_peers_other_count(
  p_user_id uuid,
  p_account_handle text,
  p_handle text
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*)::integer into n
  from public.tracked_peers
  where user_id = p_user_id
    and account_handle = p_account_handle
    and handle <> p_handle;
  return n;
end;
$$;

revoke all on function public.tracked_peers_other_count(uuid, text, text) from public;
grant execute on function public.tracked_peers_other_count(uuid, text, text) to authenticated;

-- Recreate the policy against the new signature. The policy must be dropped
-- BEFORE the old two-argument function, since it depends on it.
drop policy if exists "tracked_peers_cap" on public.tracked_peers;
drop function if exists public.tracked_peers_other_count(uuid, text);

-- RESTRICTIVE so it ANDs with tracked_peers_insert_own. A plain policy would be
-- permissive, OR into the existing set, and widen access instead of capping it.
-- Caps must stay in sync with PEER_CAP_ANON / PEER_CAP_AUTHED in lib/peers.ts.
create policy "tracked_peers_cap"
  on public.tracked_peers
  as restrictive
  for insert
  to authenticated
  with check (
    public.tracked_peers_other_count(user_id, account_handle, handle)
      < case when coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
             then 3
             else 10
        end
  );

-- Suggestions are now keyed (niche, subtopic). Rows written before this
-- migration keep subtopic '' and are simply never read again, because
-- classification always produces a real subtopic.
alter table public.peer_suggestions
  add column if not exists subtopic text not null default '';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'peer_suggestions_pkey'
      and conrelid = 'public.peer_suggestions'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table public.peer_suggestions drop constraint peer_suggestions_pkey;
    alter table public.peer_suggestions
      add constraint peer_suggestions_pkey primary key (niche, subtopic);
  end if;
end;
$$;

-- The derived niche for one of the user's OWN connected accounts (`handle` is
-- the connected account, not a peer). Written once per account from a single
-- Claude call over that account's already-cached scan, so the Peers tab never
-- re-scrapes the user to work out what they post about.
--
-- Per-user rather than global: it is derived from the user's own scan, and the
-- shared thing is peer_suggestions, which this table supplies the key for.
create table if not exists public.account_niches (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  handle     text        not null,
  niche      text        not null,
  subtopic   text        not null,
  fetched_at timestamptz not null default now(),
  primary key (user_id, handle)
);

alter table public.account_niches enable row level security;

drop policy if exists "account_niches_select_own" on public.account_niches;
create policy "account_niches_select_own"
  on public.account_niches
  for select
  using (auth.uid() = user_id);

drop policy if exists "account_niches_insert_own" on public.account_niches;
create policy "account_niches_insert_own"
  on public.account_niches
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "account_niches_update_own" on public.account_niches;
create policy "account_niches_update_own"
  on public.account_niches
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "account_niches_delete_own" on public.account_niches;
create policy "account_niches_delete_own"
  on public.account_niches
  for delete
  using (auth.uid() = user_id);
