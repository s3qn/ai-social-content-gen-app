import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { CharacterTheme } from '@/constants/characters';
import { Spacing } from '@/constants/theme';

// How far the curved bottom edge bulges below the header's flat sides.
const CURVE_DEPTH = 36;

type HillHeaderProps = {
  theme: CharacterTheme;
  /** Height of the flat portion below the safe-area inset (curve extends past this). */
  height?: number;
  /** Header content (e.g. Instagram pill + settings gear), laid out in the safe area. */
  children?: ReactNode;
};

/**
 * The character-colored header with a convex curved bottom edge ("hill crown").
 * The gradient fill and the curve are one SVG <Path> so no rectangular fill peeks
 * above the curve. Safe-area aware: children sit below the status bar.
 */
export function HillHeader({ theme, height = 132, children }: HillHeaderProps) {
  const insets = useSafeAreaInsets();
  // Total painted height: status bar + flat body + the curve's downward bulge.
  const flat = insets.top + height;
  const total = flat + CURVE_DEPTH;

  return (
    <View style={[styles.root, { height: total }]}>
      <Svg
        width="100%"
        height={total}
        // viewBox uses a fixed width so the control point math stays simple;
        // preserveAspectRatio="none" stretches it to the real screen width.
        viewBox={`0 0 100 ${total}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.hillTop} />
            <Stop offset="1" stopColor={theme.hillBottom} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0 0 L100 0 L100 ${flat} Q50 ${total} 0 ${flat} Z`}
          fill="url(#hill)"
        />
      </Svg>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm, height: flat - insets.top },
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
});
