import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/contexts/theme';

const SWEEP_MS = 1200;
/** Wider than any block so the highlight fully clears before it wraps. */
const SWEEP_WIDTH = 160;

/**
 * The app-wide loading-box primitives, extracted from the peers skeleton so
 * every surface that waits on data shimmers the same way.
 *
 * Usage: call `useSkeletonSweep()` ONCE per loading surface and pass the same
 * progress value to every `SkeletonBlock`, so the highlight reads as a single
 * pass across the whole layout instead of each box shimmering out of step.
 * Blocks are plain grey rectangles sized by the caller to mirror the real
 * content, so nothing jumps when the data lands.
 */
export function useSkeletonSweep(): SharedValue<number> {
  'use no memo';
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [progress]);
  return progress;
}

/** One grey block with a highlight sweeping left to right across it. */
export function SkeletonBlock({
  progress,
  style,
}: {
  progress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  'use no memo';
  const { palette } = useTheme();

  const sweep = useAnimatedStyle(() => ({
    // Enters from the left and fully exits before the loop restarts, so there
    // is no visible snap at the wrap point.
    transform: [{ translateX: -SWEEP_WIDTH + progress.value * (SWEEP_WIDTH * 2.5) }],
  }));

  return (
    <View style={[styles.block, { backgroundColor: palette.line }, style]}>
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

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  sweep: {
    width: SWEEP_WIDTH,
    opacity: 0.55,
  },
});
