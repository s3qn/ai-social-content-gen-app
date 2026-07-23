/**
 * Client for the post analysis endpoint (backend/instagram_scan
 * `/scan/trending/analyze`, mounted under /scan because the cloudflared
 * ingress only forwards ^/scan(/.*)?$).
 *
 * One tapped trending post in, fresh public numbers plus a best-effort
 * strategist analysis out. The client sends everything the trending cache
 * already knows about the post so the backend can still answer when its fresh
 * scrape fails. Bearer-gated like lib/scan.ts and lib/peer-suggest.ts, and
 * like peer-suggest it never throws: it returns a discriminated outcome so the
 * modal can tell "no analysis" from "the request failed".
 */

const SCAN_URL = process.env.EXPO_PUBLIC_SCAN_URL;
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

// Cold call = one scrape HTTP call plus one Claude call, 10-40s typical.
const TIMEOUT_MS = 120_000;

/** The post's live numbers, as the backend saw them (or the cached fallback). */
export type PostNumbers = {
  url: string;
  shortCode: string | null;
  caption: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  ownerUsername: string | null;
  isVideo: boolean | null;
  thumbnailUrl: string | null;
  /** True when the backend's fresh scrape succeeded, false for cached numbers. */
  fresh: boolean;
};

/** Mirror of backend/instagram_scan/post_analysis.py's analysis shape. */
export type PostAnalysis = {
  hook: { verdict: string; alternatives: string[] };
  psychology: { emotion: string; value: string };
  sharability: string;
  seo: string;
  growthSteps: string[];
};

export type AnalyzeOutcome =
  | { ok: true; post: PostNumbers; analysis: PostAnalysis | null }
  | { ok: false; reason: 'unauthorized' | 'error' };

/**
 * EXPO_PUBLIC_SCAN_URL is the full `/scan` endpoint and the analyze route is
 * mounted beneath it, same derivation idiom as lib/trending.ts refreshUrl().
 */
function analyzeUrl(): string | null {
  if (!SCAN_URL || !SCAN_TOKEN) return null;
  return `${SCAN_URL.replace(/\/+$/, '')}/trending/analyze`;
}

/**
 * Analyze one trending post. `input` carries the trending cache's copy of the
 * post so a failed fresh scrape still yields numbers. `analysis: null` with
 * `ok: true` is a valid answer: the Claude call is best-effort server-side and
 * the modal shows the live numbers without the breakdown.
 */
export async function analyzePost(input: {
  url: string;
  shortCode?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number | null;
  thumbnailUrl?: string;
  ownerUsername?: string;
}): Promise<AnalyzeOutcome> {
  const url = analyzeUrl();
  if (!url) {
    console.warn('[post-analysis] not configured: EXPO_PUBLIC_SCAN_URL or EXPO_PUBLIC_SCAN_TOKEN missing');
    return { ok: false, reason: 'error' };
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
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok) {
      const reason = res.status === 401 || res.status === 403 ? 'unauthorized' : 'error';
      console.warn(`[post-analysis] POST ${url} -> ${res.status} (${reason})`);
      return { ok: false, reason };
    }

    const json = (await res.json()) as {
      post?: PostNumbers;
      analysis?: PostAnalysis | null;
    };
    if (!json.post || typeof json.post.url !== 'string') {
      console.warn('[post-analysis] response had no post object');
      return { ok: false, reason: 'error' };
    }

    // Defensive: the analysis crosses a network boundary; only trust it whole.
    const a = json.analysis;
    const analysis =
      a &&
      typeof a.hook?.verdict === 'string' &&
      Array.isArray(a.hook?.alternatives) &&
      typeof a.psychology?.emotion === 'string' &&
      typeof a.psychology?.value === 'string' &&
      typeof a.sharability === 'string' &&
      typeof a.seo === 'string' &&
      Array.isArray(a.growthSteps)
        ? a
        : null;

    return { ok: true, post: json.post, analysis };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.warn(`[post-analysis] POST ${url} failed: ${aborted ? 'timeout' : String(err)}`);
    return { ok: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
