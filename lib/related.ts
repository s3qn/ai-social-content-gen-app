/**
 * Client for the related-posts endpoint (backend/instagram_scan `/scan/related`,
 * mounted under /scan because the cloudflared ingress only forwards
 * ^/scan(/.*)?$). Bearer-gated like lib/scan.ts and lib/peer-suggest.ts.
 *
 * The server caches 6h per niche, so a call is cheap, but not free of latency:
 * a device-local cache (same synchronous localStorage shim as contexts/theme.tsx)
 * lets the section paint instantly on revisits within the window.
 *
 * Degrades to an empty list on ANY failure (bad config, 401, 502, timeout,
 * network): the Trends tab must keep rendering regardless.
 */

/**
 * One related post. Field names match `TrendingPost` in lib/trending.ts so the
 * row/tile rendering patterns interop; the fields the /related endpoint does not
 * return (hashtag, scoring flags) are filled with neutral values.
 */
export type RelatedPost = {
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
  /** likes + comments, derived client-side for shape parity with TrendingPost. */
  engagement: number;
  risingScore: number;
  risingEligible: boolean;
};

const SCAN_URL = process.env.EXPO_PUBLIC_SCAN_URL;
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

const TIMEOUT_MS = 60_000;

/** Matches the server's per-niche cache window. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const CACHE_KEY = 'related-posts-cache';

/**
 * EXPO_PUBLIC_SCAN_URL is the full `/scan` endpoint (see lib/scan.ts) and the
 * related route is mounted beneath it, so appending is all that is needed. Same
 * idiom as refreshUrl() in lib/trending.ts.
 */
function relatedUrl(): string | null {
  if (!SCAN_URL || !SCAN_TOKEN) return null;
  return `${SCAN_URL.replace(/\/+$/, '')}/related`;
}

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

function cacheKeyFor(niche: string | null, subtopic: string | null): string {
  return `${niche ?? ''}/${subtopic ?? ''}`;
}

type CachedRelated = {
  /** `${niche}/${subtopic}`, so a niche change invalidates the entry. */
  key: string;
  /** ms since epoch. */
  fetchedAt: number;
  posts: RelatedPost[];
};

/** Cached posts for this niche/subtopic if fresh (6h TTL), else null. */
export function readCachedRelated(
  niche: string | null,
  subtopic: string | null,
): RelatedPost[] | null {
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRelated;
    if (parsed.key !== cacheKeyFor(niche, subtopic)) return null;
    if (typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    return Array.isArray(parsed.posts) ? parsed.posts : null;
  } catch {
    return null;
  }
}

function writeCachedRelated(
  niche: string | null,
  subtopic: string | null,
  posts: RelatedPost[],
): void {
  try {
    const value: CachedRelated = {
      key: cacheKeyFor(niche, subtopic),
      fetchedAt: Date.now(),
      posts,
    };
    storage()?.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Best-effort: the fetched posts still render this session.
  }
}

/** The wire shape before validation; only shortCode and url are load-bearing. */
type WirePost = Partial<Omit<RelatedPost, 'hashtag' | 'engagement' | 'risingScore' | 'risingEligible'>>;

function normalize(entry: WirePost): RelatedPost {
  const likes = typeof entry.likes === 'number' ? entry.likes : 0;
  const comments = typeof entry.comments === 'number' ? entry.comments : 0;
  const ageHours = typeof entry.ageHours === 'number' ? entry.ageHours : 0;
  const engagement = likes + comments;
  return {
    shortCode: entry.shortCode as string,
    url: entry.url as string,
    thumbnailUrl: typeof entry.thumbnailUrl === 'string' ? entry.thumbnailUrl : null,
    caption: typeof entry.caption === 'string' ? entry.caption : '',
    ownerUsername: typeof entry.ownerUsername === 'string' ? entry.ownerUsername : null,
    likes,
    comments,
    views: typeof entry.views === 'number' ? entry.views : null,
    timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : '',
    ageHours,
    hashtag: null,
    engagement,
    risingScore: engagement / Math.max(ageHours, 1),
    risingEligible: false,
  };
}

/**
 * Posts related to the user's niche/subtopic. Never throws: any failure logs and
 * returns []. An empty array from the server is a normal answer, not an error,
 * and is deliberately NOT cached so the next visit retries the (server-cached,
 * cheap) call.
 */
export async function fetchRelated(
  niche: string | null,
  subtopic: string | null,
): Promise<RelatedPost[]> {
  const url = relatedUrl();
  if (!url) {
    console.warn('[related] not configured: EXPO_PUBLIC_SCAN_URL/TOKEN missing');
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCAN_TOKEN}`,
      },
      body: JSON.stringify({ niche, subtopic }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[related] POST ${url} -> ${res.status}`);
      return [];
    }

    const json = (await res.json()) as { posts?: unknown };
    if (!Array.isArray(json.posts)) {
      console.warn('[related] response had no posts array');
      return [];
    }

    // Defensive: the payload crosses a network boundary and lands in a local
    // cache, so only keep entries that carry the fields the UI keys on.
    const posts = json.posts
      .filter(
        (p): p is WirePost =>
          !!p &&
          typeof (p as WirePost).shortCode === 'string' &&
          typeof (p as WirePost).url === 'string',
      )
      .map(normalize);

    if (posts.length > 0) writeCachedRelated(niche, subtopic, posts);
    return posts;
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.warn(`[related] POST ${url} failed: ${aborted ? 'timeout' : String(err)}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
