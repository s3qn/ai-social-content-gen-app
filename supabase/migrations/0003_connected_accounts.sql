-- 0003_connected_accounts.sql
-- The Instagram accounts a user has onboarded ("connected"). Having at least one
-- row here is what grants access to the app, not having an email account, which
-- stays optional and exists only to sync/track MORE than one account.
--
-- One row per (user_id, handle), deliberately the SAME key shape as
-- instagram_scans, so the scan cache works per-account with no changes. `handle`
-- is stored normalized (lowercase, no leading @) by lib/handle.ts, so both tables
-- agree on the key. RLS restricts every row to its owning user, including
-- anonymous users (auth.uid() is a real uuid for them too).

create table if not exists public.connected_accounts (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  handle       text        not null,
  display_name text,
  avatar_url   text,
  is_active    boolean     not null default false,
  added_at     timestamptz not null default now(),
  primary key (user_id, handle)
);

-- At most one active account per user, enforced by the database rather than by
-- app code: a partial unique index only constrains the rows where is_active.
create unique index if not exists connected_accounts_one_active
  on public.connected_accounts (user_id)
  where is_active;

alter table public.connected_accounts enable row level security;

-- Users may only read/write their own connected accounts.
drop policy if exists "connected_accounts_select_own" on public.connected_accounts;
create policy "connected_accounts_select_own"
  on public.connected_accounts
  for select
  using (auth.uid() = user_id);

drop policy if exists "connected_accounts_insert_own" on public.connected_accounts;
create policy "connected_accounts_insert_own"
  on public.connected_accounts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "connected_accounts_update_own" on public.connected_accounts;
create policy "connected_accounts_update_own"
  on public.connected_accounts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "connected_accounts_delete_own" on public.connected_accounts;
create policy "connected_accounts_delete_own"
  on public.connected_accounts
  for delete
  using (auth.uid() = user_id);
