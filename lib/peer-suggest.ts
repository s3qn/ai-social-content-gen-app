/**
 * Client for the peer suggestion endpoint (backend/instagram_scan
 * `/scan/peers/suggest`, mounted under /scan because the cloudflared ingress
 * only forwards ^/scan(/.*)?$).
 *
 * Two modes, both Bearer-gated like lib/scan.ts:
 *   suggestPeers(...)  one Claude call plus one batched Apify verification for a
 *                      whole niche, so the result is worth caching globally.
 *   verifyHandles(...) verification only, no LLM, used when the user types a
 *                      handle by hand so a typo never becomes a tracked peer.
 *
 * Never throws, but never lies either: it returns a DISCRIMINATED outcome, not a
 * bare list. An earlier version collapsed every failure into `[]`, which made a
 * stale backend (404), a bad token (401) and a genuinely empty niche completely
 * indistinguishable on screen. The UI still degrades to the same add-your-own
 * state, it just gets to say why.
 */

import type { PeerSuggestion } from '@/lib/peers';

const PEERS_URL = process.env.EXPO_PUBLIC_PEERS_URL;
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

// One Claude call plus one Apify actor run; the run dominates and takes ~30-90s.
const TIMEOUT_MS = 120_000;

/**
 * Why a suggestion fetch produced nothing.
 * - 'not-configured': EXPO_PUBLIC_PEERS_URL or the token is missing from .env.
 * - 'stale-backend': the service answered 404, so it is running a build without
 *   the peers route. This is the classic "I restarted the app but not the API".
 * - 'unauthorized': the Bearer token does not match the service's SCAN_TOKEN.
 * - 'server-error', 'timeout', 'network': as named.
 */
export type SuggestFailure =
  | 'not-configured'
  | 'stale-backend'
  | 'unauthorized'
  | 'server-error'
  | 'timeout'
  | 'network';

export type SuggestOutcome =
  | { ok: true; suggestions: PeerSuggestion[] }
  | { ok: false; reason: SuggestFailure; status?: number };

/** Short, human-readable line for the UI. Deliberately mentions the fix. */
export function describeFailure(reason: SuggestFailure, status?: number): string {
  switch (reason) {
    case 'not-configured':
      return 'Suggestions are not configured (missing EXPO_PUBLIC_PEERS_URL).';
    case 'stale-backend':
      return 'The scan service is running an older build without the peers route (404).';
    case 'unauthorized':
      return 'The scan service rejected the token (401).';
    case 'server-error':
      return `The scan service errored${status ? ` (${status})` : ''}.`;
    case 'timeout':
      return 'The scan service took too long to answer.';
    case 'network':
      return 'Could not reach the scan service.';
  }
}

type SuggestBody = {
  niche?: string;
  /** Derived specific subtopic; the second half of the shared cache key. */
  subtopic?: string;
  subtopics?: string[];
  themes?: string[];
  vibe?: string | null;
  followers?: number | null;
  handles?: string[];
};

function failureFor(status: number): SuggestFailure {
  if (status === 404) return 'stale-backend';
  if (status === 401 || status === 403) return 'unauthorized';
  return 'server-error';
}

async function post(body: SuggestBody): Promise<SuggestOutcome> {
  if (!PEERS_URL || !SCAN_TOKEN) {
    console.warn('[peers] not configured: EXPO_PUBLIC_PEERS_URL or EXPO_PUBLIC_SCAN_TOKEN missing');
    return { ok: false, reason: 'not-configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PEERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCAN_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const reason = failureFor(res.status);
      console.warn(`[peers] POST ${PEERS_URL} -> ${res.status} (${reason})`);
      return { ok: false, reason, status: res.status };
    }

    const json = (await res.json()) as { suggestions?: unknown };
    const list = json.suggestions;
    if (!Array.isArray(list)) {
      console.warn('[peers] response had no suggestions array');
      return { ok: false, reason: 'server-error', status: res.status };
    }

    // Defensive: the payload crosses a network boundary and is persisted to a
    // shared cache, so only keep entries that actually carry a handle.
    const suggestions = list.filter(
      (s): s is PeerSuggestion =>
        !!s && typeof (s as PeerSuggestion).handle === 'string' && !!(s as PeerSuggestion).handle,
    );
    console.log(`[peers] ${suggestions.length} suggestion(s) from ${PEERS_URL}`);
    return { ok: true, suggestions };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.warn(`[peers] POST ${PEERS_URL} failed: ${aborted ? 'timeout' : String(err)}`);
    return { ok: false, reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Suggest verified role models for a niche.
 *
 * `themes` and `vibe` come from the user's own scan and give the model context.
 * `followers` is the user's follower count, used server-side to drop anything
 * that is not meaningfully bigger. An empty list with `ok: true` is normal for a
 * narrow niche and is what drives the add-your-own fallback.
 */
export async function suggestPeers(input: {
  niche: string;
  subtopic?: string;
  subtopics?: string[];
  themes?: string[];
  vibe?: string | null;
  followers?: number | null;
}): Promise<SuggestOutcome> {
  return post({
    niche: input.niche,
    subtopic: input.subtopic ?? '',
    subtopics: input.subtopics ?? [],
    themes: input.themes ?? [],
    vibe: input.vibe ?? null,
    followers: input.followers ?? null,
  });
}

/**
 * Check that handles resolve to real public accounts, returning only those that
 * do (with their display name, avatar and follower count). No LLM call.
 */
export async function verifyHandles(handles: string[]): Promise<SuggestOutcome> {
  if (handles.length === 0) return { ok: true, suggestions: [] };
  return post({ handles });
}
