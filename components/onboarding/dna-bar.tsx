import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import type { EngagementInsight, PostTypeBreakdown } from '@/lib/scan';

type Props = {
  breakdown: PostTypeBreakdown;
  engagement: EngagementInsight;
};

// The three normalized post types the backend reports, in stack order, with a
// display label and a distinct segment color that reads on light + dark.
const SEGMENTS: { key: string; label: string; color: string }[] = [
  { key: 'image', label: 'Photos', color: '#5B8DEF' },
  { key: 'carousel', label: 'Carousels', color: '#2E5E4E' },
  { key: 'reel', label: 'Reels', color: '#B4552D' },
];

/**
 * A segmented bar of the REAL post-type mix (image / carousel / reel) with a
 * legend, plus the real "best type" engagement insight ("Carousels get 2.3×
 * more engagement"). Theme-aware via useTheme().
 */
export function DnaBar({ breakdown, engagement }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const pct = breakdown.percentages ?? {};
  const hasData = (breakdown.total ?? 0) > 0;
  const insight = bestTypeInsight(engagement);

  return (
    <View style={styles.wrap}>
      {hasData ? (
        <View style={styles.bar}>
          {SEGMENTS.map((s) => {
            const value = pct[s.key] ?? 0;
            if (value <= 0) return null;
            return (
              <View key={s.key} style={{ flex: value, backgroundColor: s.color }} />
            );
          })}
        </View>
      ) : (
        <View style={[styles.bar, styles.barEmpty]} />
      )}

      <View style={styles.legend}>
        {SEGMENTS.map((s) => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendPct}>{hasData ? `${pct[s.key] ?? 0}%` : '—'}</Text>
          </View>
        ))}
      </View>

      {insight ? (
        <View style={styles.insight}>
          <Text style={styles.insightText}>{insight}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Build the "<Best> get Nx more engagement than your <other>" line, if we can. */
function bestTypeInsight(engagement: EngagementInsight): string | null {
  const best = engagement.bestType;
  if (!best) return null;
  const label = SEGMENTS.find((s) => s.key === best)?.label ?? best;

  const avg = engagement.avgEngagement ?? {};
  const bestAvg = avg[best] ?? 0;
  const others = Object.entries(avg).filter(([k, v]) => k !== best && v > 0);
  if (!others.length || bestAvg <= 0) {
    return `${label} are your strongest format.`;
  }
  const otherAvg = others.reduce((a, [, v]) => a + v, 0) / others.length;
  if (otherAvg <= 0) return `${label} are your strongest format.`;
  const ratio = bestAvg / otherAvg;
  if (ratio < 1.15) return `${label} are your strongest format.`;
  return `${label} get ${ratio.toFixed(1)}× more engagement than your other posts.`;
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.lg },
    bar: {
      flexDirection: 'row',
      height: 18,
      borderRadius: Radius.pill,
      overflow: 'hidden',
      backgroundColor: palette.line,
    },
    barEmpty: { opacity: 0.5 },
    legend: { gap: Spacing.sm },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendLabel: {
      ...(Type.body as TextStyle),
      flex: 1,
      fontWeight: '600',
      color: palette.ink,
    },
    legendPct: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.muted,
    },
    insight: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.lg,
    },
    insightText: {
      ...(Type.body as TextStyle),
      flex: 1,
      fontWeight: '600',
      color: palette.ink,
    },
  });
