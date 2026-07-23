-- 0008_trending_cache.sql
-- Global cache of "what is trending on Instagram right now", scraped from a
-- fixed set of generic high-volume hashtags and ranked into two lists (Biggest
-- and Rising) by the scan service.
--
-- Trending is the same for EVERY user, so the entire point of this table is that
-- it is scraped once per refresh window and read by everybody. The client never
-- scrapes: it selects the newest row, renders it, and at most pings the refresh
-- endpoint when the row is older than the window. Per-user scraping here would
-- multiply Apify credits by the user count for identical data.
--
-- This is a GLOBAL-READ, SERVICE-WRITE table, deliberately NOT the
-- `auth.uid() = user_id` ownership pattern used by instagram_scans (0002),
-- connected_accounts (0003) and tracked_peers (0005). There is no per-user
-- ownership of trending data, so there is no user_id column to key on.
--
-- It is also NOT the client-writable shape used by the peer_suggestions /
-- peer_scans global caches in 0005_peers.sql. Those accept an explicit risk,
-- documented there, that any signed-in user can write junk into a shared row.
-- 0005 names the clean fix as "move both writes into the scan service behind the
-- service role and drop the insert/update policies" -- which is exactly what
-- this table does, because one poisoned row here would be served to every user
-- of the app as editorial content.

create table if not exists public.trending_batches (
  id         bigint generated always as identity primary key,
  posts      jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- Reads are always "newest batch wins", never by id.
create index if not exists trending_batches_fetched_at_desc
  on public.trending_batches (fetched_at desc);

alter table public.trending_batches enable row level security;

-- Any authenticated user may read the whole table. Supabase anonymous sign-ins
-- also carry role 'authenticated' (with is_anonymous true in the JWT), so
-- anonymous users are covered by this and need no separate policy, the same way
-- 0003 relies on auth.uid() being a real uuid for them.
drop policy if exists "trending_batches_select_all" on public.trending_batches;
create policy "trending_batches_select_all"
  on public.trending_batches
  for select
  to authenticated
  using (true);

-- There are deliberately NO insert / update / delete policies.
--
-- With RLS enabled and no permissive policy for a command, that command is
-- denied for every normal client, including the app's anon key. The service role
-- bypasses RLS entirely, so backend/instagram_scan/trending.py can still write.
-- Writing "create policy ... to service_role" would be noise: the service role
-- never consults policies in the first place.
--
-- Net effect: everyone reads, only the scheduled refresh writes.
