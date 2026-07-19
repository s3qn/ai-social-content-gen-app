-- 0002_instagram_scans.sql
-- Cache of Instagram profile scans so we never re-hit the Apify scraper for a
-- handle we've already scanned for a given user (saves Apify credits).
-- One row per (user_id, handle); `result` is the full ScanResult JSON from
-- lib/scan.ts. RLS restricts every row to its owning user (auth.uid() = user_id).

create table if not exists public.instagram_scans (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  handle     text        not null,
  result     jsonb       not null,
  fetched_at timestamptz not null default now(),
  primary key (user_id, handle)
);

alter table public.instagram_scans enable row level security;

-- Users may only read/write their own scan cache rows.
drop policy if exists "instagram_scans_select_own" on public.instagram_scans;
create policy "instagram_scans_select_own"
  on public.instagram_scans
  for select
  using (auth.uid() = user_id);

drop policy if exists "instagram_scans_insert_own" on public.instagram_scans;
create policy "instagram_scans_insert_own"
  on public.instagram_scans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "instagram_scans_update_own" on public.instagram_scans;
create policy "instagram_scans_update_own"
  on public.instagram_scans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "instagram_scans_delete_own" on public.instagram_scans;
create policy "instagram_scans_delete_own"
  on public.instagram_scans
  for delete
  using (auth.uid() = user_id);
