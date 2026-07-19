/**
 * Cached wrapper around `scanProfile` (lib/scan.ts).
 *
 * Instagram scans are expensive (each one spends Apify credits), so we persist
 * every result in the `instagram_scans` Supabase table keyed by (user_id,
 * handle). A subsequent scan of the same handle by the same user within
 * `CACHE_TTL_MS` is served straight from the row — the backend/Apify actor is
 * never called.
 *
 * Everything degrades gracefully: with no signed-in user, or if the table is
 * missing (migration not yet applied), or on ANY Supabase/network/RLS error, we
 * fall through to a live `scanProfile`. Onboarding must keep working before the
 * user applies supabase/migrations/0002_instagram_scans.sql.
 */

import { supabase } from '@/lib/supabase';
import { scanProfile, type ScanResult } from '@/lib/scan';

/** How long a cached scan stays fresh before we re-scan. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Normalize a handle for use as a stable cache key: lowercase, no leading @. */
function normalizeHandle(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Best-effort write of a fresh scan into the cache. Any failure (missing table,
 * RLS, network) is swallowed — a cache-write failure must never break the scan.
 */
async function cacheResult(userId: string, handle: string, result: ScanResult): Promise<void> {
  try {
    await supabase
      .from('instagram_scans')
      .upsert(
        {
          user_id: userId,
          handle,
          result,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,handle' },
      );
  } catch {
    // Swallow — caching is a nicety, the scan already succeeded.
  }
}

/**
 * Scan a profile, reusing a cached result when one exists and is still fresh.
 *
 * @param username the raw @handle the user typed
 * @param userId   the signed-in user's id, or null to bypass the cache entirely
 */
export async function scanProfileCached(
  username: string,
  userId: string | null,
): Promise<ScanResult> {
  const handle = normalizeHandle(username);

  // No user → no per-user cache; just scan live.
  if (!userId) {
    return scanProfile(username);
  }

  // Cache READ: any failure falls through to a live scan.
  try {
    const { data, error } = await supabase
      .from('instagram_scans')
      .select('result, fetched_at')
      .eq('user_id', userId)
      .eq('handle', handle)
      .maybeSingle();

    if (!error && data) {
      const fetchedAt = new Date(data.fetched_at as string).getTime();
      if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS) {
        // Fresh hit — return cached result, DO NOT call the backend.
        return data.result as ScanResult;
      }
    }
  } catch {
    // Table missing / network / RLS — fall through to a live scan below.
  }

  // Cache miss/stale/error → live scan, then best-effort cache the fresh result.
  const result = await scanProfile(username);
  void cacheResult(userId, handle, result);
  return result;
}
