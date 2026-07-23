import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SkeletonBlock, useSkeletonSweep } from '@/components/skeleton';
import { AppPalette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

const AVATAR = 44;

/**
 * Loading state for the peers list, built on the shared skeleton primitives
 * in components/skeleton.tsx.
 *
 * Deliberately shaped like `PeerCard` (44pt avatar, two text bars, a 32pt
 * action) rather than a spinner: the rows occupy exactly the space the real
 * cards will, so nothing jumps when suggestions arrive. Suggestion fetches can
 * take 30-90s on a cold niche, which is far too long to stare at a spinner.
 */
export function PeerCardSkeleton({ count = 3 }: { count?: number }) {
  'use no memo';
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // One shared clock for every block, so the sweep reads as a single pass over
  // the list instead of each row shimmering out of step.
  const progress = useSkeletonSweep();

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel="Loading peers"
      accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={styles.card}
          accessibilityElementsHidden
          importantForAccessibility="no">
          <SkeletonBlock progress={progress} style={styles.avatar} />
          <View style={styles.body}>
            <SkeletonBlock progress={progress} style={styles.lineWide} />
            <SkeletonBlock progress={progress} style={styles.lineNarrow} />
          </View>
          <SkeletonBlock progress={progress} style={styles.action} />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.sm,
    },
    // Mirrors components/peer-card.tsx so the real cards land in place.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    body: {
      flex: 1,
      gap: Spacing.xs,
    },
    lineWide: {
      height: 12,
      width: '60%',
      borderRadius: 6,
    },
    lineNarrow: {
      height: 10,
      width: '40%',
      borderRadius: 5,
    },
    action: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
  });
