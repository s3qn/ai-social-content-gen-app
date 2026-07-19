/**
 * The Instagram accounts a user has connected, in Supabase.
 *
 * Owning at least one of these is what grants access to the app (see the guards
 * in app/_layout.tsx) — an email account is optional and only exists to sync and
 * to hold MORE than one connected account.
 *
 * Everything here degrades gracefully, mirroring lib/scan-cache.ts: if the
 * migration has not been applied, if anonymous sign-ins are disabled, or on ANY
 * Supabase/network/RLS error, callers get an empty list or `false` rather than a
 * throw. The context layer keeps a local mirror, so the app stays usable and the
 * header keeps showing the last known account.
 */

import { normalizeHandle } from '@/lib/handle';
import { supabase } from '@/lib/supabase';

export type ConnectedAccount = {
  /** Normalized: lowercase, no leading @. */
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  isActive: boolean;
};

type Row = {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

function toAccount(row: Row): ConnectedAccount {
  return {
    handle: row.handle,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    isActive: !!row.is_active,
  };
}

/**
 * Every account this user has connected, active one first. Never throws.
 *
 * Returns `null` when Supabase could not be reached (table missing, offline,
 * RLS) as distinct from `[]` meaning "reached it, genuinely no accounts". The
 * caller needs that distinction: treating an error as an empty list would wipe
 * the local mirror and log the user out of their own app while offline.
 */
export async function listAccounts(userId: string): Promise<ConnectedAccount[] | null> {
  try {
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('handle, display_name, avatar_url, is_active')
      .eq('user_id', userId)
      .order('is_active', { ascending: false })
      .order('added_at', { ascending: true });

    if (error) return null;
    return ((data ?? []) as Row[]).map(toAccount);
  } catch {
    return null;
  }
}

/**
 * Connect an account and make it the active one. Returns false if it could not
 * be persisted, so the caller can keep it locally and retry later.
 *
 * Clearing the other rows' `is_active` first is required, not cosmetic: the
 * `connected_accounts_one_active` partial unique index rejects a second active
 * row for the same user.
 */
export async function addAccount(
  userId: string,
  rawHandle: string,
  meta: { displayName?: string; avatarUrl?: string } = {},
): Promise<boolean> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return false;

  try {
    await supabase
      .from('connected_accounts')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    const { error } = await supabase.from('connected_accounts').upsert(
      {
        user_id: userId,
        handle,
        display_name: meta.displayName ?? null,
        avatar_url: meta.avatarUrl ?? null,
        is_active: true,
      },
      { onConflict: 'user_id,handle' },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Make an already-connected account the active one. Never throws. */
export async function setActive(userId: string, rawHandle: string): Promise<boolean> {
  const handle = normalizeHandle(rawHandle);
  try {
    // Deactivate first — the partial unique index allows only one active row.
    await supabase
      .from('connected_accounts')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    const { error } = await supabase
      .from('connected_accounts')
      .update({ is_active: true })
      .eq('user_id', userId)
      .eq('handle', handle);
    return !error;
  } catch {
    return false;
  }
}

/** Disconnect an account. Never throws. */
export async function removeAccount(userId: string, rawHandle: string): Promise<boolean> {
  const handle = normalizeHandle(rawHandle);
  try {
    const { error } = await supabase
      .from('connected_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('handle', handle);
    return !error;
  } catch {
    return false;
  }
}
