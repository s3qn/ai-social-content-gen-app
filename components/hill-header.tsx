import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { CharacterTheme } from '@/constants/characters';
import { Spacing } from '@/constants/theme';

// How far the curved center "tongue" bulges below the solid green block.
// The solid block fills its full rectangle (corners included) so nothing but
// green is pinned; only this central dip overhangs into the scroll content.
export const CURVE_DEPTH = 36;

type HillHeaderProps = {
  theme: CharacterTheme;
  /** Height of the flat portion below the safe-area inset. */
  height?: number;
  /** Extra styles for the header container (e.g. zIndex so the dip overhangs). */
  style?: StyleProp<ViewStyle>;
  /** Header content (e.g. Instagram pill + settings gear), laid out in the safe area. */
  children?: ReactNode;
};

/**
 * The character-colored header: a solid green block (fully filled, including its
 * bottom corners) with a curved center dip that overhangs below the block into
 * the scroll content. The block's own rectangle is 100% green, so when pinned
 * only green sticks — no page color peeks through the corners.
 */
export function HillHeader({ theme, height = 132, style, children }: HillHeaderProps) {
  const insets = useSafeAreaInsets();
  // solidH = the fully-green pinned rectangle; the tongue bulges CURVE_DEPTH past it.
  const solidH = insets.top + height;
  const total = solidH + CURVE_DEPTH;

  return (
    <View style={[styles.root, { height: solidH }, style]}>
      <Svg
        width="100%"
        height={total}
        // Fixed viewBox width keeps the control-point math simple;
        // preserveAspectRatio="none" stretches it to the real screen width.
        viewBox={`0 0 100 ${total}`}
        preserveAspectRatio="none"
        style={styles.svg}>
        <Defs>
          <LinearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.hillTop} />
            <Stop offset="1" stopColor={theme.hillBottom} />
          </LinearGradient>
        </Defs>
        {/* Full-width green block down to solidH, then a central tongue to `total`. */}
        <Path d={`M0 0 L100 0 L100 ${solidH} Q50 ${total} 0 ${solidH} Z`} fill="url(#hill)" />
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
    // The curved tongue extends below the block's height; don't clip it.
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
