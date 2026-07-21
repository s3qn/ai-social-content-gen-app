-- 0007_delete_own_account.sql
-- Lets a signed-in user delete THEIR OWN account and everything attached to it.
--
-- This is the most privileged function in the schema: it writes to auth.users,
-- which the anon key can never touch directly. Three properties keep that safe,
-- and none of them are optional:
--
--   1. It takes NO ARGUMENTS. A p_user_id parameter would let any signed-in user
--      delete any other user, which is the entire risk here. There is no version
--      of this function that should accept a target.
--   2. It deletes strictly `where id = auth.uid()`, so the caller's own JWT is
--      the only thing that can select a row.
--   3. EXECUTE is granted only to `authenticated`, and it raises when auth.uid()
--      is null, so an unauthenticated call cannot reach the delete at all.
--
-- Everything the user owns is already `on delete cascade` on user_id, so one
-- delete clears them completely:
--   connected_accounts (0003), instagram_scans (0002),
--   tracked_peers (0005), account_niches (0006).
-- The GLOBAL caches (peer_scans, peer_suggestions) carry no user column and are
-- deliberately left alone: they hold public role-model data shared by everyone,
-- and wiping them on one user's exit would make every other user pay to refill.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_own_account requires an authenticated session';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
