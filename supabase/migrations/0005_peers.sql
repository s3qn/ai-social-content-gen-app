-- 0005_peers.sql
-- Peers are role models: accounts in the SAME niche as the user with a
-- meaningfully bigger following, which the user tracks and studies. Three
-- tables, deliberately split by who owns the data.
--
-- `tracked_peers` is per-user (this is what the cap counts). The other two are
-- GLOBAL caches: role models are shared across users, so one Claude call and one
-- Apify run per niche serves everybody, and a peer's scraped snapshot is reused
-- by every user tracking that peer. That sharing is the entire cost argument for
-- the feature.
--
-- Privacy note on the global caches: these hold third-party PUBLIC accounts
-- (large role models), not the app's own users, and the columns are kept minimal
-- on purpose. Avatar URLs are signed CDN links that expire within days, which is
-- why `fetched_at` exists on both: treat a stale avatar as expected, not broken.

-- The accounts a user tracks as role models. Same key shape as
-- connected_accounts / instagram_scans so a handle means the same thing
-- everywhere; handles are normalized client-side by lib/handle.ts.
create table if not exists public.tracked_peers (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  handle         text        not null,
  display_name   text,
  avatar_url     text,
  follower_count bigint,
  added_at       timestamptz not null default now(),
  primary key (user_id, handle)
);

alter table public.tracked_peers enable row level security;

-- Users may only read/write their own tracked peers.
drop policy if exists "tracked_peers_select_own" on public.tracked_peers;
create policy "tracked_peers_select_own"
  on public.tracked_peers
  for select
  using (auth.uid() = user_id);

drop policy if exists "tracked_peers_insert_own" on public.tracked_peers;
create policy "tracked_peers_insert_own"
  on public.tracked_peers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "tracked_peers_update_own" on public.tracked_peers;
create policy "tracked_peers_update_own"
  on public.tracked_peers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tracked_peers_delete_own" on public.tracked_peers;
create policy "tracked_peers_delete_own"
  on public.tracked_peers
  for delete
  using (auth.uid() = user_id);

-- Cap: 3 tracked peers while the session is anonymous, 10 once a real identity
-- is attached. Identical machinery to 0004_connected_accounts_cap.sql, including
-- the reasons, which are repeated here because they are easy to get wrong:
--
--   SECURITY DEFINER, because a policy on tracked_peers cannot itself select
--   from tracked_peers (Postgres reports infinite recursion in the policy).
--
--   VOLATILE rather than stable, because a stable function reads the calling
--   statement's start snapshot, so every row of one multi-row insert would count
--   zero and slip past the cap in a single request.
--
--   The count EXCLUDES the row's own handle, because INSERT ... ON CONFLICT
--   evaluates the insert WITH CHECK on every proposed row even when the update
--   path is taken, so counting it would refuse an at-cap user re-tracking a peer
--   they already have.
create or replace function public.tracked_peers_other_count(p_user_id uuid, p_handle text)
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
  where user_id = p_user_id and handle <> p_handle;
  return n;
end;
$$;

revoke all on function public.tracked_peers_other_count(uuid, text) from public;
grant execute on function public.tracked_peers_other_count(uuid, text) to authenticated;

-- RESTRICTIVE so it ANDs with tracked_peers_insert_own. A plain policy would be
-- permissive, OR into the existing set, and widen access instead of capping it.
-- Caps must stay in sync with PEER_CAP_ANON / PEER_CAP_AUTHED in lib/peers.ts.
--
-- Known race (accepted, same as 0004): count-then-insert is not serialized, so
-- two concurrent inserts under READ COMMITTED can both pass and leave the user
-- one row over cap. The only party able to race here is the same user on their
-- own rows.
drop policy if exists "tracked_peers_cap" on public.tracked_peers;
create policy "tracked_peers_cap"
  on public.tracked_peers
  as restrictive
  for insert
  to authenticated
  with check (
    public.tracked_peers_other_count(user_id, handle)
      < case when coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
             then 3
             else 10
        end
  );

-- Suggested role models per niche, shared by every user in that niche. Keyed on
-- the niche slug alone (the 10 values of the onboarding `niche` step), NOT on
-- niche plus subtopics: ten buckets collide well across users, which is what
-- makes the cache worth having. Subtopics and content themes still shape the
-- prompt, they just do not fragment the key.
--
-- `handles` is the verified suggestion array as returned by the scan service:
-- [{"handle": "...", "displayName": "...", "avatarUrl": "...",
--   "followerCount": 1234, "why": "..."}]
create table if not exists public.peer_suggestions (
  niche      text        primary key,
  handles    jsonb       not null,
  fetched_at timestamptz not null default now()
);

alter table public.peer_suggestions enable row level security;

-- Scraped snapshot of a peer's public profile, keyed by handle and shared by
-- every user tracking that peer. `result` is the full ScanResult JSON from
-- lib/scan.ts, the same payload instagram_scans stores, so the peer detail view
-- reuses the components the onboarding reveal already uses. The scalar columns
-- are denormalized copies for cheap list rendering without parsing the jsonb.
create table if not exists public.peer_scans (
  handle         text        primary key,
  display_name   text,
  avatar_url     text,
  follower_count bigint,
  result         jsonb       not null,
  fetched_at     timestamptz not null default now()
);

alter table public.peer_scans enable row level security;

-- Both caches are readable and writable by any signed-in user, because the
-- client fills them (mirroring how lib/scan-cache.ts fills instagram_scans).
--
-- ACCEPTED RISK, stated plainly: this means a signed-in user can write junk into
-- a shared cache row. Nothing here is another user's data, and the blast radius
-- is a bad suggestion or a stale follower count rather than any access-control
-- failure, so it is acceptable for the MVP. The clean fix, if these ever carry
-- more weight, is to move both writes into the scan service behind the service
-- role and drop the insert/update policies below.
drop policy if exists "peer_suggestions_select_all" on public.peer_suggestions;
create policy "peer_suggestions_select_all"
  on public.peer_suggestions
  for select
  to authenticated
  using (true);

drop policy if exists "peer_suggestions_insert_any" on public.peer_suggestions;
create policy "peer_suggestions_insert_any"
  on public.peer_suggestions
  for insert
  to authenticated
  with check (true);

drop policy if exists "peer_suggestions_update_any" on public.peer_suggestions;
create policy "peer_suggestions_update_any"
  on public.peer_suggestions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "peer_scans_select_all" on public.peer_scans;
create policy "peer_scans_select_all"
  on public.peer_scans
  for select
  to authenticated
  using (true);

drop policy if exists "peer_scans_insert_any" on public.peer_scans;
create policy "peer_scans_insert_any"
  on public.peer_scans
  for insert
  to authenticated
  with check (true);

drop policy if exists "peer_scans_update_any" on public.peer_scans;
create policy "peer_scans_update_any"
  on public.peer_scans
  for update
  to authenticated
  using (true)
  with check (true);
