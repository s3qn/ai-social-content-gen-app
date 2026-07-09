import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { INPUT, RAMPS, themeIndex } from '@/constants/theme-transition';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type StatCardProps = {
  caption: string;
  value: string;
};

/**
 * A single stat card. Neutral card surface (theme-aware) with a slim top accent
 * bar that carries the character color, self-driving from the shared `themeIndex`
 * so it cross-fades on tab change and swaps ramp on light↔dark.
 */
export function StatCard({ caption, value }: StatCardProps) {
  'use no memo';
  const { scheme, palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { PRIMARY } = RAMPS[scheme];
  const accentStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY) }),
    [scheme],
  );

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.accentBar, accentStyle]} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: palette.surface,
      borderColor: palette.line,
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
      color: palette.ink,
      marginTop: Spacing.xs,
    },
    caption: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
  });
