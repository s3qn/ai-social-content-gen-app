import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

import { INPUT, RAMPS, themeIndex } from '@/constants/theme-transition';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

// How far the curved center "tongue" bulges below the solid block.
export const CURVE_DEPTH = 28;

// Fraction of the hill that stays fully opaque before it begins dissolving into
// the page. Everything below melts out, so there is no hard color seam. Kept
// below the control row: the pill/gear are painted outside the mask at full
// opacity, so if the dissolve started above them their backdrop would wash out
// toward the page tint and the pill's scrim would lose its edge.
const FADE_START = 0.7;

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
 * The character-colored header: a block (corners included) with a curved center
 * dip, whose lower half dissolves into the page rather than ending on a hard
 * edge. The fill self-drives from the shared `themeIndex`, so it cross-fades
 * when tabs change.
 *
 * The dissolve is an alpha `Mask`, not a fade to the page color: the page wash
 * is itself animated per character, so fading to any fixed color would leave a
 * seam on three of the four tabs. Masking to transparent lets whatever wash is
 * underneath show through exactly. Both gradients use static stops — animating
 * gradient <Stop> colors is unreliable on Fabric, so only the path fill animates.
 */
export function HillHeader({ height = 72, style, children }: HillHeaderProps) {
  'use no memo';
  const { scheme } = useTheme();
  const { HILL } = RAMPS[scheme];
  const insets = useSafeAreaInsets();
  const solidH = insets.top + height;
  const total = solidH + CURVE_DEPTH;
  const d = `M0 0 L100 0 L100 ${solidH} Q50 ${total} 0 ${solidH} Z`;

  // `scheme` is an explicit dependency so switching light↔dark re-derives the
  // worklet with the new ramp (snaps; tab changes still cross-fade via themeIndex).
  const animatedProps = useAnimatedProps(
    () => ({ fill: interpolateColor(themeIndex.value, INPUT, HILL) }),
    [scheme],
  );

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
          {/* White = keep, black = drop. Opaque down to FADE_START, gone by the base. */}
          <LinearGradient id="hillFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset={FADE_START} stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#000000" />
          </LinearGradient>
          <Mask id="hillFade">
            <Rect x="0" y="0" width="100" height={total} fill="url(#hillFadeGrad)" />
          </Mask>
        </Defs>
        <G mask="url(#hillFade)">
          {/* Animated solid hue (self-driving). */}
          <AnimatedPath animatedProps={animatedProps} d={d} />
          {/* Static top-lit sheen for depth. */}
          <Path d={d} fill="url(#hillSheen)" />
        </G>
      </Svg>
      {/*
        Pad by the inset only and span the full header, so the row centres in the
        `height` band below the status bar. Padding by `insets.top + sm` while
        capping the box at `height` left ~5pt of usable room on a Dynamic Island
        device once `height` dropped to 72, pushing the row down into the fade.
      */}
      <View style={[styles.content, { paddingTop: insets.top, height: solidH }]}>
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
