/**
 * UI-only mock data for the themed Home screen. No backend, no auth, no network.
 * Kept out of components (matching the existing mock-array convention in the
 * screens) so swapping in real data later is a one-file change.
 */

export type InstagramAccount = {
  /** Handle without the leading "@". */
  handle: string;
  displayName: string;
  /** Optional avatar URL; falls back to an initials circle when absent. */
  avatarUrl?: string;
};

/** The account currently being analyzed. Reuses the value already in the app. */
export const MOCK_INSTAGRAM: InstagramAccount = {
  handle: 'mock.creator',
  displayName: 'Mock Creator',
};

/** Day-of-month numbers with a planned post, for the Home "My Plan" calendar. */
export const MARKED_DAYS: number[] = [3, 8, 9, 15, 22, 27];

/** Home stat cards (UI-only). */
export const HOME_STATS: { caption: string; value: string }[] = [
  { caption: 'Posts generated', value: '128' },
  { caption: 'This week', value: '6' },
];
