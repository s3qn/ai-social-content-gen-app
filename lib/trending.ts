/**
 * Client access to the GLOBAL trending cache (`trending_batches`, 0008).
 *
 * Trending is the same for every user, so there is exactly one shared batch and
 * the client's job is to READ it. This module never scrapes and never calls
 * Apify. The most it does is tell the scan service "that batch looks old", and
 * even then the service re-checks the age itself before spending any credits:
 * the client is not trusted to decide when money is spent.
 *
 * Everything degrades to an empty batch, exactly like lib/scan-cache.ts: with no
 * signed-in user, or if the table is missing (0008 not yet applied by hand), or
 * on ANY Supabase/network/RLS error. The Trends tab must keep rendering before
 * the migration is applied.
 */

import { supabase } from '@/lib/supabase';

/** One scraped post, already scored by backend/instagram_scan/trending.py. */
export type TrendingPost = {
  shortCode: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  ownerUsername: string | null;
  likes: number;
  comments: number;
  /** null for stills. Displayed only, never ranked on. */
  views: number | null;
  timestamp: string;
  ageHours: number;
  hashtag: string | null;
  /** likes + comments, computed at scrape time. */
  engagement: number;
  /** engagement per hour since posting, computed at scrape time. */
  risingScore: number;
  /** Passed the backend's age and engagement floors. */
  risingEligible: boolean;
};

export type TrendingBatch = {
  posts: TrendingPost[];
  /** ms since epoch, or null when the cache is empty or unreadable. */
  fetchedAt: number | null;
};

export const EMPTY_BATCH: TrendingBatch = { posts: [], fetchedAt: null };

/**
 * Must match REFRESH_AFTER in backend/instagram_scan/trending.py. If these two
 * ever drift, the backend's copy wins: it is the one guarding the credits.
 */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

const SCAN_URL = process.env.EXPO_PUBLIC_SCAN_URL;
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

/**
 * EXPO_PUBLIC_SCAN_URL is the full `/scan` endpoint (see lib/scan.ts), and the
 * refresh route is mounted beneath it, so appending is all that is needed. That
 * nesting is not cosmetic: cloudflared only forwards `^/scan(/.*)?$` to the
 * service, so a top-level /trending route would not be reachable at all.
 *
 * Deriving one endpoint from another rather than adding an env var is the
 * existing idiom here: lib/peer-classify.ts builds its URL the same way, off
 * EXPO_PUBLIC_PEERS_URL. It also means no .env edit and no Expo restart.
 */
function refreshUrl(): string | null {
  if (!SCAN_URL || !SCAN_TOKEN) return null;
  return `${SCAN_URL.replace(/\/+$/, '')}/trending/refresh`;
}

/** Read the newest cached batch. Never scrapes. */
export async function fetchTrending(): Promise<TrendingBatch> {
  try {
    const { data, error } = await supabase
      .from('trending_batches')
      .select('posts, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('[trending] cache read: no row', error ? `error=${error.message}` : '(empty)');
      return EMPTY_BATCH;
    }

    const fetchedAt = new Date(data.fetched_at as string).getTime();
    const posts = Array.isArray(data.posts) ? (data.posts as TrendingPost[]) : [];
    console.warn(`[trending] cache read: ${posts.length} posts, fetchedAt=${data.fetched_at}`);
    return {
      posts,
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : null,
    };
  } catch (e) {
    // Table missing (0008 not applied), RLS, or network. Render the empty state.
    console.warn('[trending] cache read threw:', (e as Error)?.message ?? e);
    return EMPTY_BATCH;
  }
}

/** True when the batch is past the refresh window, or absent entirely. */
export function isStale(fetchedAt: number | null): boolean {
  if (fetchedAt == null) return true;
  return Date.now() - fetchedAt >= REFRESH_AFTER_MS;
}

/**
 * Fire-and-forget nudge to the scan service. Deliberately returns nothing and
 * awaits nothing: a scrape runs 30-90s, the current user is not waiting for it,
 * and they keep looking at the cached batch meanwhile. Concurrent nudges from
 * many devices collapse into ONE Apify run inside the service.
 */
export function requestRefresh(): void {
  const url = refreshUrl();
  if (!url) {
    console.warn('[trending] refresh skipped: EXPO_PUBLIC_SCAN_URL/TOKEN not set');
    return;
  }
  console.warn('[trending] refresh POST', url);
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SCAN_TOKEN}`,
    },
    body: '{}',
  })
    .then(async (res) => {
      // 202 = refresh accepted; 404 = the running backend has no trending route
      // (it is the main-checkout copy, not the worktree one); 401 = bad token.
      console.warn(`[trending] refresh -> HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    })
    .catch((e) => {
      // Service down or unreachable: the cached batch still renders.
      console.warn('[trending] refresh failed:', (e as Error)?.message ?? e);
    });
}

/** Raw engagement. Skews to mega-accounts, which is what "biggest" means. */
export function biggest(posts: TrendingPost[], limit = 20): TrendingPost[] {
  return [...posts]
    .sort((a, b) => b.engagement - a.engagement || a.shortCode.localeCompare(b.shortCode))
    .slice(0, limit);
}

/**
 * Engagement per hour since posting, over posts that cleared the backend's age
 * and engagement floors. Those floors are what stop a 40-like post from ten
 * minutes ago topping the list on an almost-zero denominator.
 */
export function rising(posts: TrendingPost[], limit = 20): TrendingPost[] {
  return posts
    .filter((p) => p.risingEligible && Number.isFinite(p.risingScore))
    .sort((a, b) => b.risingScore - a.risingScore || a.shortCode.localeCompare(b.shortCode))
    .slice(0, limit);
}
