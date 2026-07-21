/**
 * Client for the niche classification endpoint
 * (backend/instagram_scan `/scan/peers/classify`).
 *
 * Turns ONE connected account's already-cached scan into
 * `{niche, subtopic}`, which is the key the shared suggestion cache is stored
 * under. Runs once per connected account, ever: one Haiku call, no Apify, no
 * scrape. Everything after that reads from the cache.
 *
 * Why this is separate from suggestPeers: reading the suggestion cache needs the
 * key, and the key comes from the model, so classification cannot be folded into
 * the suggestion call without making the cache unreadable.
 *
 * Same discipline as lib/peer-suggest.ts: never throws, returns a typed outcome,
 * and warns to the console with the status so a stale backend is visible.
 */

import type { AccountNiche } from '@/lib/peers';
import { describeFailure, type SuggestFailure } from '@/lib/peer-suggest';

const CLASSIFY_URL = process.env.EXPO_PUBLIC_PEERS_URL?.replace(/\/suggest$/, '/classify');
const SCAN_TOKEN = process.env.EXPO_PUBLIC_SCAN_TOKEN;

// One Claude call, no scraping, so this is far quicker than the suggest path.
const TIMEOUT_MS = 30_000;

export type ClassifyOutcome =
  | { ok: true; niche: AccountNiche | null }
  | { ok: false; reason: SuggestFailure; status?: number };

export { describeFailure };

/**
 * Classify one connected account from its own scan signals.
 *
 * `ok: true` with `niche: null` is valid and means the model had nothing usable
 * (a near-empty profile, say). The caller falls back to the onboarding answer.
 */
export async function classifyAccount(input: {
  themes?: string[];
  vibe?: string | null;
  formatMix?: Record<string, number> | null;
  followers?: number | null;
}): Promise<ClassifyOutcome> {
  if (!CLASSIFY_URL || !SCAN_TOKEN) {
    console.warn('[peers] classify not configured: EXPO_PUBLIC_PEERS_URL missing');
    return { ok: false, reason: 'not-configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CLASSIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCAN_TOKEN}`,
      },
      body: JSON.stringify({
        themes: input.themes ?? [],
        vibe: input.vibe ?? null,
        formatMix: input.formatMix ?? null,
        followers: input.followers ?? null,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const reason: SuggestFailure =
        res.status === 404
          ? 'stale-backend'
          : res.status === 401 || res.status === 403
            ? 'unauthorized'
            : 'server-error';
      console.warn(`[peers] POST ${CLASSIFY_URL} -> ${res.status} (${reason})`);
      return { ok: false, reason, status: res.status };
    }

    const json = (await res.json()) as { niche?: unknown; subtopic?: unknown };
    if (typeof json.niche !== 'string' || !json.niche) {
      console.log('[peers] classify returned nothing usable');
      return { ok: true, niche: null };
    }
    const subtopic = typeof json.subtopic === 'string' ? json.subtopic : '';
    console.log(`[peers] classified as ${json.niche}/${subtopic}`);
    return { ok: true, niche: { niche: json.niche, subtopic } };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.warn(`[peers] POST ${CLASSIFY_URL} failed: ${aborted ? 'timeout' : String(err)}`);
    return { ok: false, reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
