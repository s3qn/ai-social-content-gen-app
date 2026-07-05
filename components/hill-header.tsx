import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { INPUT, PRIMARY, themeIndex } from '@/constants/theme-transition';
import { Spacing } from '@/constants/theme';

// How far the curved center "tongue" bulges below the solid block.
export const CURVE_DEPTH = 36;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type HillHeaderProps = {
  /** Height of the flat portion below the safe-area inset. */
  height?: number;
  /** Extra styles for the header container (e.g. zIndex so the dip overhangs). */
  style?: StyleProp<ViewStyle>;
  /** Header content (e.g. Instagram pill + settings gear), laid out in the safe area. */
  children?: ReactNode;
};

/**
 * The character-colored header: a solid block (corners included) with a curved
 * center dip that overhangs into the scroll content. The fill color self-drives
 * from the shared `themeIndex`, so it cross-fades when tabs change. A static
 * white sheen overlay preserves the top-lit gradient depth (animating gradient
 * <Stop> colors is unreliable on Fabric, so only the solid fill animates).
 */
export function HillHeader({ height = 132, style, children }: HillHeaderProps) {
  'use no memo';
  const insets = useSafeAreaInsets();
  const solidH = insets.top + height;
  const total = solidH + CURVE_DEPTH;
  const d = `M0 0 L100 0 L100 ${solidH} Q50 ${total} 0 ${solidH} Z`;

  const animatedProps = useAnimatedProps(() => ({
    fill: interpolateColor(themeIndex.value, INPUT, PRIMARY),
  }));

  return (
    <View style={[styles.root, { height: solidH }, style]}>
      <Svg
        width="100%"
        height={total}
        viewBox={`0 0 100 ${total}`}
        preserveAspectRatio="none"
        style={styles.svg}>
        <Defs>
          <LinearGradient id="hillSheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Animated solid hue (self-driving). */}
        <AnimatedPath animatedProps={animatedProps} d={d} />
        {/* Static top-lit sheen for depth. */}
        <Path d={d} fill="url(#hillSheen)" />
      </Svg>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.sm, height }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'visible',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
});
