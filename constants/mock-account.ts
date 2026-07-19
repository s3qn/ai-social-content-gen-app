/**
 * UI-only mock data for the themed Home screen. No backend, no auth, no network.
 * Kept out of components (matching the existing mock-array convention in the
 * screens) so swapping in real data later is a one-file change.
 */

// The connected-account mock that used to live here is gone: the Home header now
// renders the user's real account from `contexts/accounts`, backed by the
// `connected_accounts` table. The stats and calendar below are still UI-only.

/** Day-of-month numbers with a planned post, for the Home "My Plan" calendar. */
export const MARKED_DAYS: number[] = [3, 8, 9, 15, 22, 27];

/** Home stat cards (UI-only). */
export const HOME_STATS: { caption: string; value: string }[] = [
  { caption: 'Posts generated', value: '128' },
  { caption: 'This week', value: '6' },
];
