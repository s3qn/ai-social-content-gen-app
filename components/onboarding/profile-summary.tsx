import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { RevealFallback } from '@/components/onboarding/reveal-fallback';
import { ScoreMeter } from '@/components/onboarding/score-meter';
import { StatTrio } from '@/components/onboarding/stat-trio';
import { AppPalette, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';

type Props = {
  onRescan?: () => void;
};

/**
 * F3 — Profile Summary reveal. Composes the real stat tiles + the (heuristic,
 * stubbed) score meter from the scan result stored in context. Falls back
 * gracefully if the scan result is missing.
 */
export function ProfileSummary({ onRescan }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { scanResult } = useOnboarding();

  if (!scanResult) return <RevealFallback onRescan={onRescan} />;

  return (
    <View style={styles.wrap}>
      <StatTrio stats={scanResult.stats} />
      <View style={styles.section}>
        <Text style={styles.eyebrow}>Your Creator Score</Text>
        <ScoreMeter stats={scanResult.stats} engagement={scanResult.engagementInsight} />
      </View>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.xl },
    section: { gap: Spacing.sm },
    eyebrow: {
      ...(Type.eyebrow as TextStyle),
      color: palette.muted,
    },
  });
