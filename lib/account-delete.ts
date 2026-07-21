/**
 * Permanently deleting the signed-in user.
 *
 * The anon key cannot touch `auth.users`, so the actual delete lives in the
 * `delete_own_account()` security-definer RPC (see
 * supabase/migrations/0007_delete_own_account.sql). It takes no arguments and
 * deletes only `auth.uid()`, so the caller can never name someone else.
 *
 * Every user-owned table cascades off `auth.users`, so the remote side is one
 * call. The LOCAL mirrors are not: they are plain localStorage keys that would
 * happily repopulate a deleted user's accounts and peers on the next launch, so
 * they have to be cleared explicitly, and BEFORE sign-out while the handles are
 * still known.
 */

import { supabase } from '@/lib/supabase';

export type DeleteAccountResult = 'ok' | 'unavailable';

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

/** Best-effort removal; the shim may expose removeItem or only setItem. */
function drop(key: string): void {
  try {
    const s = storage();
    if (!s) return;
    if (typeof s.removeItem === 'function') s.removeItem(key);
    else s.setItem(key, '');
  } catch {
    // Ignore: a stubborn key is cosmetic next to the account being gone.
  }
}

/**
 * Wipe every local mirror belonging to this user.
 *
 * `accountHandles` must be the user's connected-account handles, read BEFORE the
 * delete: the peers mirror is namespaced per account (`app-peers:<uid>:<handle>`)
 * and there is no way to enumerate those keys afterwards.
 */
export function clearLocalUserData(uid: string, accountHandles: string[]): void {
  drop(`app-accounts:${uid}`);
  drop(`app-onboarding-complete:${uid}`);
  drop(`app-onboarding-answers:${uid}`);
  drop(`app-onboarding-scan:${uid}`);
  for (const handle of accountHandles) drop(`app-peers:${uid}:${handle}`);
  // The 'anon' bucket is what a session-less render falls back to, so clear it
  // too or a fresh guest inherits the deleted user's leftovers.
  drop('app-peers:anon:none');
}

/**
 * Delete the signed-in user in Supabase. Never throws.
 *
 * Returns 'unavailable' when the RPC is missing (migration not applied) or the
 * call fails, so the caller can say so rather than pretending it worked and
 * signing the user out of an account that still exists.
 */
export async function deleteOwnAccount(): Promise<DeleteAccountResult> {
  try {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      console.warn(`[delete-account] rpc failed: ${error.code ?? ''} ${error.message}`);
      return 'unavailable';
    }
    return 'ok';
  } catch (err) {
    console.warn(`[delete-account] rpc threw: ${String(err)}`);
    return 'unavailable';
  }
}
