-- 0004_connected_accounts_cap.sql
-- Cap how many accounts a user may connect: 1 while the session is anonymous,
-- 5 once a real (email) identity is attached. Logging in upgrades the user in
-- place (same uuid, is_anonymous flips false in the JWT), so the cap widens to
-- 5 automatically and no rows move.
--
-- The cap is a RESTRICTIVE policy on purpose: Supabase policies are permissive
-- and OR together by default, so a plain extra policy would WIDEN access. A
-- restrictive one ANDs with the existing connected_accounts_insert_own.
--
-- Known race (accepted): count-then-insert is not serialized, so two truly
-- concurrent inserts under READ COMMITTED can both pass the check and leave the
-- user one row over cap. The only party who can race here is the same user on
-- their own rows, so we document it instead of paying for locking. The
-- commented-out trigger at the bottom closes the race if that ever changes.

-- Counts the user's OTHER connected accounts, excluding the handle being
-- written. The exclusion matters: the client upserts on (user_id, handle), and
-- INSERT ... ON CONFLICT evaluates the INSERT policies' WITH CHECK on every
-- proposed row even when the update path is taken, so counting the row's own
-- handle would reject an at-cap user rescanning an account they already have.
--
-- SECURITY DEFINER: a policy on connected_accounts cannot itself select from
-- connected_accounts (Postgres reports infinite recursion in the policy); the
-- function owner bypasses RLS, which sidesteps that.
--
-- VOLATILE, not stable: a stable function reads the calling statement's start
-- snapshot, so every row of a multi-row bulk insert would count 0 and slip past
-- the cap in one request. A volatile plpgsql function sees the rows the same
-- statement already inserted.
create or replace function public.connected_accounts_other_count(p_user_id uuid, p_handle text)
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
  from public.connected_accounts
  where user_id = p_user_id and handle <> p_handle;
  return n;
end;
$$;

-- The policy runs this as the calling role, so authenticated needs EXECUTE.
revoke all on function public.connected_accounts_other_count(uuid, text) from public;
grant execute on function public.connected_accounts_other_count(uuid, text) to authenticated;

-- Caps must stay in sync with ACCOUNT_CAP_ANON / ACCOUNT_CAP_AUTHED in
-- lib/accounts.ts. Anonymous sessions hit PostgREST as the authenticated role
-- with a JSON boolean is_anonymous claim in the JWT; tokens without the claim
-- (plain email users, older tokens) coalesce to false and get the cap of 5.
-- The (select ...) wrap makes the JWT read an initplan, evaluated once per
-- statement rather than per row.
drop policy if exists "connected_accounts_cap" on public.connected_accounts;
create policy "connected_accounts_cap"
  on public.connected_accounts
  as restrictive
  for insert
  to authenticated
  with check (
    public.connected_accounts_other_count(user_id, handle)
      < case when coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
             then 1
             else 5
        end
  );

-- OPTIONAL, not applied: serialize per-user inserts to close the race above.
-- Correct only because the count function is volatile (BEFORE ROW triggers run
-- before WITH CHECK is evaluated, and the volatile function takes its snapshot
-- after the lock is granted).
--
-- create or replace function public.connected_accounts_cap_lock()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   perform pg_advisory_xact_lock(hashtext('connected_accounts:' || new.user_id::text));
--   return new;
-- end;
-- $$;
-- drop trigger if exists connected_accounts_cap_lock on public.connected_accounts;
-- create trigger connected_accounts_cap_lock
--   before insert on public.connected_accounts
--   for each row execute function public.connected_accounts_cap_lock();
