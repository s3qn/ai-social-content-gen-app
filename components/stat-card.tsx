import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { INPUT, PRIMARY, themeIndex } from '@/constants/theme-transition';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

type StatCardProps = {
  caption: string;
  value: string;
};

/**
 * A single stat card. Neutral-on-white by design; a slim top accent bar carries
 * the character color, self-driving from the shared `themeIndex` so it cross-fades
 * on tab change.
 */
export function StatCard({ caption, value }: StatCardProps) {
  'use no memo';
  const accentStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY),
  }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.accentBar, accentStyle]} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  value: {
    ...(Type.stat as TextStyle),
    color: Palette.ink,
    marginTop: Spacing.xs,
  },
  caption: {
    ...(Type.caption as TextStyle),
    color: Palette.muted,
  },
});
