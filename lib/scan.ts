/**
 * Client for the Instagram scan service (backend/instagram_scan).
 *
 * `scanProfile(username)` POSTs to the Bearer-gated `/scan` endpoint exposed at
 * EXPO_PUBLIC_SCAN_URL and returns the parsed profile stats. The Apify actor
 * behind it takes ~30–90s, so the request is guarded by a ~120s AbortController
 * timeout. Every failure is mapped to a typed, friendly `ScanError` the UI can
 * show inline (no raw status codes / stack traces reach the user).
 *
 * The response shape mirrors backend/instagram_scan/main.py. `dna` and `score`
 * come from the backend's best-effort Claude pass and are null whenever that
 * pass is unconfigured or fails — callers must handle both.
 */

const SCAN_URL = process.env.EXPO_PUBLIC_SCAN_URL;
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

// The actor runs ~30–90s; give it generous headroom before aborting.
const TIMEOUT_MS = 120_000;

/** Profile stats (any field may be null if Instagram hides it). */
export type ScanStats = {
  followers: number | null;
  following: number | null;
  posts: number | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export type PostTypeBreakdown = {
  counts: Record<string, number>;
  percentages: Record<string, number>;
  total: number;
};

export type EngagementInsight = {
  avgEngagement: Record<string, number>;
  bestType: string | null;
};

/**
 * Claude-derived content vibe + recurring themes. Null when the backend's AI
 * pass is unavailable (no key) or failed — the UI falls back to its stub.
 */
export type ContentDna = {
  vibe: string;
  topThemes: string[];
};

/** Claude-derived creator score. Null under the same conditions as `dna`. */
export type ProfileScore = {
  profileScore: number; // 0–10, one decimal
  scoreLabel: string;
  scoreExplanation: string;
};

/** The full POST /scan success payload. */
export type ScanResult = {
  stats: ScanStats;
  postTypeBreakdown: PostTypeBreakdown;
  engagementInsight: EngagementInsight;
  dna: ContentDna | null;
  score: ProfileScore | null;
};

/** Machine-readable failure category, used by the UI to pick a message. */
export type ScanErrorKind =
  | 'bad_handle'
  | 'unauthorized'
  | 'not_found'
  | 'private'
  | 'apify'
  | 'network'
  | 'timeout'
  | 'unknown';

const FRIENDLY: Record<ScanErrorKind, string> = {
  bad_handle: "That doesn't look like a valid username. Check it and try again.",
  unauthorized: "We couldn't authenticate the scan. Please try again later.",
  not_found: "We couldn't find that profile. Double-check the @username.",
  private: "That profile is private, so we can't scan it. Try a public account.",
  apify: 'Instagram is busy right now. Please try again in a moment.',
  network: 'No connection. Check your internet and try again.',
  timeout: 'The scan is taking longer than expected. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** A typed scan failure carrying a friendly, user-facing message. */
export class ScanError extends Error {
  readonly kind: ScanErrorKind;
  constructor(kind: ScanErrorKind, message?: string) {
    super(message ?? FRIENDLY[kind]);
    this.name = 'ScanError';
    this.kind = kind;
  }
}

/** Map a non-2xx response to a typed error, preferring the backend `error` code. */
function mapHttpError(status: number, code: string | undefined): ScanError {
  switch (code) {
    case 'bad_handle':
      return new ScanError('bad_handle');
    case 'unauthorized':
      return new ScanError('unauthorized');
    case 'not_found':
      return new ScanError('not_found');
    case 'private':
      return new ScanError('private');
    case 'apify_error':
      return new ScanError('apify');
    case 'server_misconfigured':
      return new ScanError('unauthorized');
  }
  // Fall back to the HTTP status when the body has no recognizable code.
  switch (status) {
    case 400:
      return new ScanError('bad_handle');
    case 401:
      return new ScanError('unauthorized');
    case 404:
      return new ScanError('not_found');
    case 502:
      return new ScanError('apify');
    default:
      return new ScanError('unknown');
  }
}

/**
 * Scan a public Instagram profile. Resolves with the stats payload or rejects
 * with a typed `ScanError`.
 */
export async function scanProfile(username: string): Promise<ScanResult> {
  if (!SCAN_URL || !SCAN_TOKEN) {
    throw new ScanError('unknown', 'Scan is not configured. Please try again later.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(SCAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCAN_TOKEN}`,
      },
      body: JSON.stringify({ username }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ScanError('timeout');
    }
    throw new ScanError('network');
  }
  clearTimeout(timer);

  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      code = body?.error;
    } catch {
      // no/invalid JSON body — fall back to status mapping
    }
    throw mapHttpError(res.status, code);
  }

  try {
    return (await res.json()) as ScanResult;
  } catch {
    throw new ScanError('unknown');
  }
}
