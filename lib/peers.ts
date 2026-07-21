/**
 * The role-model accounts ("peers") a user tracks, in Supabase.
 *
 * A peer is an account in the SAME niche with a meaningfully bigger following,
 * which the user studies and aims at. Three tables back this (see
 * supabase/migrations/0005_peers.sql): `tracked_peers` is per-user and is what
 * the cap counts, while `peer_suggestions` (per niche) and `peer_scans` (per
 * handle) are GLOBAL caches, because role models are shared across users.
 *
 * Everything here degrades gracefully, mirroring lib/accounts.ts and
 * lib/scan-cache.ts: if the migration has not been applied, or on ANY
 * Supabase/network/RLS error, callers get an empty list, `null`, or an
 * 'unavailable' result rather than a throw.
 */

import { normalizeHandle } from '@/lib/handle';
import { supabase } from '@/lib/supabase';
import type { ScanResult } from '@/lib/scan';

/** A role model the user tracks. */
export type TrackedPeer = {
  /** Normalized: lowercase, no leading @. */
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: number;
};

/** One verified suggestion, as returned by the scan service and cached per niche. */
export type PeerSuggestion = {
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: number;
  /** One line on why this account is worth studying. */
  why?: string;
};

/**
 * How many peers a user may track. Must stay in sync with the caps in
 * supabase/migrations/0005_peers.sql, where the database enforces the same
 * numbers via a restrictive RLS policy.
 */
export const PEER_CAP_ANON = 3;
export const PEER_CAP_AUTHED = 10;

export function peerCap(isAnonymous: boolean): number {
  return isAnonymous ? PEER_CAP_ANON : PEER_CAP_AUTHED;
}

/**
 * How long a cached peer snapshot stays fresh before opening it re-scrapes.
 * Shorter than the 7 days in lib/scan-cache.ts: a role model's numbers are the
 * point of the feature, so they should not be a week stale.
 */
export const PEER_SCAN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** How long a per-niche suggestion set stays fresh. */
export const SUGGESTIONS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Outcome of a remote write, matching lib/accounts.ts `addAccount`.
 * 'rejected' means the database refused on purpose (RLS, which includes the
 * cap) and the caller must undo any optimistic write; 'unavailable' means we
 * could not reach it and the optimistic write should stand.
 */
export type TrackPeerRemoteResult = 'ok' | 'rejected' | 'unavailable';

type PeerRow = {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number | null;
};

function toPeer(row: PeerRow): TrackedPeer {
  return {
    handle: row.handle,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    followerCount: row.follower_count ?? undefined,
  };
}

/**
 * Every peer this user tracks, oldest first. Never throws.
 *
 * Returns `null` when Supabase could not be reached, as distinct from `[]`
 * meaning "reached it, genuinely tracking nobody". The caller needs that
 * distinction so an offline device does not wipe its local mirror.
 */
export async function listTrackedPeers(
  userId: string,
  accountHandle: string,
): Promise<TrackedPeer[] | null> {
  try {
    const { data, error } = await supabase
      .from('tracked_peers')
      .select('handle, display_name, avatar_url, follower_count')
      .eq('user_id', userId)
      .eq('account_handle', accountHandle)
      .order('added_at', { ascending: true });

    if (error) return null;
    return ((data ?? []) as PeerRow[]).map(toPeer);
  } catch {
    return null;
  }
}

/** Track a peer. Never throws; see TrackPeerRemoteResult for the outcomes. */
export async function trackPeer(
  userId: string,
  accountHandle: string,
  rawHandle: string,
  meta: { displayName?: string; avatarUrl?: string; followerCount?: number } = {},
): Promise<TrackPeerRemoteResult> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return 'unavailable';

  try {
    const { error } = await supabase.from('tracked_peers').upsert(
      {
        user_id: userId,
        account_handle: accountHandle,
        handle,
        display_name: meta.displayName ?? null,
        avatar_url: meta.avatarUrl ?? null,
        follower_count: meta.followerCount ?? null,
      },
      { onConflict: 'user_id,account_handle,handle' },
    );
    if (!error) return 'ok';
    // 42501 is how a WITH CHECK (RLS) refusal surfaces through PostgREST, which
    // is what the cap policy raises. Match the code, never the message.
    return error.code === '42501' ? 'rejected' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Stop tracking a peer. Never throws. */
export async function untrackPeer(
  userId: string,
  accountHandle: string,
  rawHandle: string,
): Promise<boolean> {
  const handle = normalizeHandle(rawHandle);
  try {
    const { error } = await supabase
      .from('tracked_peers')
      .delete()
      .eq('user_id', userId)
      .eq('account_handle', accountHandle)
      .eq('handle', handle);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Cached suggestions for a niche, or null on a miss/stale row/any error. The
 * cache is global: one row per niche serves every user in that niche, which is
 * what keeps the LLM call to roughly once per niche.
 */
export async function readSuggestions(
  niche: string,
  subtopic: string,
): Promise<PeerSuggestion[] | null> {
  try {
    const { data, error } = await supabase
      .from('peer_suggestions')
      .select('handles, fetched_at')
      .eq('niche', niche)
      .eq('subtopic', subtopic)
      .maybeSingle();

    if (error || !data) return null;
    const fetchedAt = new Date(data.fetched_at as string).getTime();
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt >= SUGGESTIONS_TTL_MS) return null;

    const handles = data.handles as unknown;
    return Array.isArray(handles) ? (handles as PeerSuggestion[]) : null;
  } catch {
    return null;
  }
}

/** Best-effort write of a fresh suggestion set. Any failure is swallowed. */
export async function writeSuggestions(
  niche: string,
  subtopic: string,
  suggestions: PeerSuggestion[],
): Promise<void> {
  try {
    await supabase.from('peer_suggestions').upsert(
      {
        niche,
        subtopic,
        handles: suggestions,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'niche,subtopic' },
    );
  } catch {
    // Swallow: caching is a nicety, the suggestions already resolved.
  }
}

/** The derived niche of one of the user's OWN connected accounts. */
export type AccountNiche = {
  /** One of the ten coarse slugs shared with the onboarding quiz. */
  niche: string;
  /** Specific snake_case subtopic; the second half of the suggestion cache key. */
  subtopic: string;
};

/** The stored classification for a connected account, or null on a miss/error. */
export async function readAccountNiche(
  userId: string,
  rawHandle: string,
): Promise<AccountNiche | null> {
  const handle = normalizeHandle(rawHandle);
  try {
    const { data, error } = await supabase
      .from('account_niches')
      .select('niche, subtopic')
      .eq('user_id', userId)
      .eq('handle', handle)
      .maybeSingle();

    if (error || !data) return null;
    const niche = data.niche as string;
    const subtopic = data.subtopic as string;
    return niche ? { niche, subtopic: subtopic ?? '' } : null;
  } catch {
    return null;
  }
}

/** Best-effort write of a fresh classification. Any failure is swallowed. */
export async function writeAccountNiche(
  userId: string,
  rawHandle: string,
  value: AccountNiche,
): Promise<void> {
  const handle = normalizeHandle(rawHandle);
  try {
    await supabase.from('account_niches').upsert(
      {
        user_id: userId,
        handle,
        niche: value.niche,
        subtopic: value.subtopic,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,handle' },
    );
  } catch {
    // Swallow: the classification already resolved, caching it is a nicety.
  }
}

/**
 * The user's OWN cached scan for one of their connected accounts, or null.
 *
 * Deliberately reads `instagram_scans` directly instead of calling
 * `scanProfileCached`, which would SCRAPE on a miss. Classification is a
 * background nicety on tab open and must never spend Apify credits on the
 * user's own profile. No cached scan simply means no classification.
 */
export async function readOwnScan(userId: string, rawHandle: string): Promise<ScanResult | null> {
  const handle = normalizeHandle(rawHandle);
  try {
    const { data, error } = await supabase
      .from('instagram_scans')
      .select('result')
      .eq('user_id', userId)
      .eq('handle', handle)
      .maybeSingle();

    if (error || !data) return null;
    return data.result as ScanResult;
  } catch {
    return null;
  }
}

/** A cached peer snapshot, or null on a miss/any error. Staleness is the caller's call. */
export async function readPeerScan(
  rawHandle: string,
): Promise<{ result: ScanResult; fetchedAt: number } | null> {
  const handle = normalizeHandle(rawHandle);
  try {
    const { data, error } = await supabase
      .from('peer_scans')
      .select('result, fetched_at')
      .eq('handle', handle)
      .maybeSingle();

    if (error || !data) return null;
    const fetchedAt = new Date(data.fetched_at as string).getTime();
    if (!Number.isFinite(fetchedAt)) return null;
    return { result: data.result as ScanResult, fetchedAt };
  } catch {
    return null;
  }
}

/** Best-effort write of a fresh peer snapshot. Any failure is swallowed. */
export async function writePeerScan(rawHandle: string, result: ScanResult): Promise<void> {
  const handle = normalizeHandle(rawHandle);
  try {
    await supabase.from('peer_scans').upsert(
      {
        handle,
        display_name: result.stats?.fullName ?? null,
        avatar_url: result.stats?.avatarUrl ?? null,
        follower_count: result.stats?.followers ?? null,
        result,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'handle' },
    );
  } catch {
    // Swallow: caching is a nicety, the scan already succeeded.
  }
}
