/**
 * Cached wrapper around `scanProfile` for PEERS, the global twin of
 * lib/scan-cache.ts.
 *
 * The difference is the key. Onboarding scans are cached per (user_id, handle)
 * because they are the user's own account; a peer is a large public role model
 * that many users track, so its snapshot is cached per handle in `peer_scans`
 * and shared. One user opening @somebigaccount spares every other user the
 * Apify credits.
 *
 * Scraping only happens when a snapshot is missing or older than
 * PEER_SCAN_TTL_MS. Suggesting a peer never scrapes, and neither does tracking
 * one: that split is what keeps the Apify bill off the tab-open path.
 *
 * Degrades gracefully: if the 0005 migration has not been applied, or on ANY
 * Supabase error, this falls through to a live scan.
 */

import { scanProfile, type ScanResult } from '@/lib/scan';
import { PEER_SCAN_TTL_MS, readPeerScan, writePeerScan } from '@/lib/peers';

/**
 * Scan a peer, reusing the shared cached snapshot while it is fresh.
 *
 * @param handle the peer's handle (raw or normalized)
 * @param force  skip the freshness check and re-scrape now (pull to refresh)
 */
export async function peerScanCached(handle: string, force = false): Promise<ScanResult> {
  if (!force) {
    const cached = await readPeerScan(handle);
    if (cached && Date.now() - cached.fetchedAt < PEER_SCAN_TTL_MS) {
      // Fresh hit: DO NOT call the backend.
      return cached.result;
    }
  }

  const result = await scanProfile(handle);
  void writePeerScan(handle, result);
  return result;
}

/** True when a cached snapshot exists but has gone stale, used for the "updated" label. */
export function isStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt >= PEER_SCAN_TTL_MS;
}
