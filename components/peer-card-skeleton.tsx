import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

import { AppPalette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

const AVATAR = 44;
const SWEEP_MS = 1200;
/** Wider than any block so the highlight fully clears before it wraps. */
const SWEEP_WIDTH = 160;

/**
 * Loading state for the peers list.
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
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [progress]);

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
          <Block progress={progress} styles={styles} style={styles.avatar} />
          <View style={styles.body}>
            <Block progress={progress} styles={styles} style={styles.lineWide} />
            <Block progress={progress} styles={styles} style={styles.lineNarrow} />
          </View>
          <Block progress={progress} styles={styles} style={styles.action} />
        </View>
      ))}
    </View>
  );
}

/** One grey block with a highlight sweeping left to right across it. */
function Block({
  progress,
  styles,
  style,
}: {
  progress: SharedValue<number>;
  styles: ReturnType<typeof makeStyles>;
  style: object;
}) {
  'use no memo';
  const { palette } = useTheme();

  const sweep = useAnimatedStyle(() => ({
    // Enters from the left and fully exits before the loop restarts, so there
    // is no visible snap at the wrap point.
    transform: [{ translateX: -SWEEP_WIDTH + progress.value * (SWEEP_WIDTH * 2.5) }],
  }));

  return (
    <View style={[styles.block, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.sweep, sweep]}>
        <LinearGradient
          colors={['transparent', palette.bg, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
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
    block: {
      backgroundColor: palette.line,
      overflow: 'hidden',
    },
    sweep: {
      width: SWEEP_WIDTH,
      opacity: 0.55,
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
