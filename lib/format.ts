/**
 * Small display formatters for the onboarding reveals.
 */

/**
 * Compact big-number formatting for stat tiles: 1_234 -> "1.2K",
 * 104_300_000 -> "104.3M", 2_000_000_000 -> "2B". Null / undefined -> "-".
 * Values under 1000 are shown as-is. One decimal, trailing ".0" trimmed.
 */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const units: { limit: number; suffix: string }[] = [
    { limit: 1_000_000_000, suffix: 'B' },
    { limit: 1_000_000, suffix: 'M' },
    { limit: 1_000, suffix: 'K' },
  ];
  for (const { limit, suffix } of units) {
    if (abs >= limit) {
      const n = abs / limit;
      // One decimal, but drop a trailing ".0" (e.g. 2.0M -> 2M).
      const text = n >= 100 ? Math.round(n).toString() : trimZero(n.toFixed(1));
      return `${sign}${text}${suffix}`;
    }
  }
  return `${sign}${Math.round(abs)}`;
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
