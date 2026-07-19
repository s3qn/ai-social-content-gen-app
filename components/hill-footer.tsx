import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FOOTER_LAYER_COUNT } from '@/constants/characters';
import { INPUT, RAMPS, themeIndex } from '@/constants/theme-transition';
import { useTheme } from '@/contexts/theme';

/**
 * Ridge silhouettes, back-to-front. Each is a run of peaks given as `x` across
 * the 0..100 viewBox and `rise` as a fraction of the footer height, so the shape
 * is resolution-independent. Multiple peaks per ridge (rather than the single
 * broad arc this used to draw) is what makes the band read as hills instead of
 * stacked color bands.
 *
 * The backmost ridge rises to 0.88 (above TAB_BAR_CLEARANCE), so the floating
 * tab bar sits against color rather than against the bare page wash.
 */
const LAYERS = [
  [
    { x: 0, rise: 0.6 },
    { x: 26, rise: 0.88 },
    { x: 55, rise: 0.62 },
    { x: 80, rise: 0.82 },
    { x: 100, rise: 0.66 },
  ],
  [
    { x: 0, rise: 0.48 },
    { x: 34, rise: 0.68 },
    { x: 64, rise: 0.44 },
    { x: 88, rise: 0.6 },
    { x: 100, rise: 0.52 },
  ],
  [
    { x: 0, rise: 0.34 },
    { x: 20, rise: 0.46 },
    { x: 52, rise: 0.3 },
    { x: 78, rise: 0.44 },
    { x: 100, rise: 0.36 },
  ],
  [
    { x: 0, rise: 0.2 },
    { x: 30, rise: 0.28 },
    { x: 60, rise: 0.16 },
    { x: 86, rise: 0.26 },
    { x: 100, rise: 0.2 },
  ],
];

// Bleed past the viewBox edges so no anti-aliased sliver of page shows at the sides.
const BLEED = 2;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Smooth closed silhouette through `peaks`. Each peak becomes a quadratic
 * control point and the curve passes through the midpoints between them, which
 * keeps the crests rounded instead of pinched.
 */
function ridgePath(peaks: { x: number; rise: number }[], height: number): string {
  const y = (rise: number) => height - rise * height;
  const first = peaks[0];
  let d = `M${-BLEED} ${height} L${-BLEED} ${y(first.rise)}`;
  for (let i = 0; i < peaks.length - 1; i++) {
    const cur = peaks[i];
    const next = peaks[i + 1];
    d += ` Q${cur.x} ${y(cur.rise)} ${(cur.x + next.x) / 2} ${(y(cur.rise) + y(next.rise)) / 2}`;
  }
  const last = peaks[peaks.length - 1];
  return `${d} L${100 + BLEED} ${y(last.rise)} L${100 + BLEED} ${height} Z`;
}

/** One self-driving hill ridge. Its own hook so we never call hooks in a loop. */
function FooterLayer({ index, height }: { index: number; height: number }) {
  'use no memo';
  const { scheme } = useTheme();
  const ramp = RAMPS[scheme].FOOTER_RAMPS[index];
  const d = ridgePath(LAYERS[index], height);

  const animatedProps = useAnimatedProps(
    () => ({ fill: interpolateColor(themeIndex.value, INPUT, ramp) }),
    [scheme],
  );

  return <AnimatedPath animatedProps={animatedProps} d={d} />;
}

/**
 * Decorative layered "hills" that close the character motif at the bottom.
 * Colors self-drive from the shared `themeIndex`, so they cross-fade with the
 * rest of the scheme on tab change. Purely visual: pointerEvents none.
 *
 * The backmost ridge deliberately uses the same tone as the header hill, so the
 * top and bottom of the screen resolve to one color family instead of reading
 * as two unrelated pieces of chrome.
 */
export function HillFooter({ height = 132 }: { height?: number }) {
  return (
    <View style={[styles.root, { height }]}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}>
        {LAYERS.slice(0, FOOTER_LAYER_COUNT).map((_, i) => (
          <FooterLayer key={i} index={i} height={height} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    // Style form of pointerEvents (prop form is unreliable on Fabric/New Arch).
    pointerEvents: 'none',
  },
});
