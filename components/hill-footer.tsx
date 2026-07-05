import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FOOTER_RAMPS, INPUT, themeIndex } from '@/constants/theme-transition';

// Each layer's crown as a fraction of height (how high the ridge rises) and a
// horizontal offset for the peak, so the ridges read as distinct overlapping hills.
const LAYERS = [
  { rise: 0.62, peakX: 32 },
  { rise: 0.44, peakX: 68 },
  { rise: 0.26, peakX: 50 },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One self-driving hill ridge. Its own hook so we never call hooks in a loop. */
function FooterLayer({ index, height }: { index: number; height: number }) {
  'use no memo';
  const layer = LAYERS[index];
  const crownY = height - layer.rise * height;
  const d = `M0 ${height} L0 ${crownY + 20} C${layer.peakX * 0.4} ${crownY} ${
    layer.peakX * 1.6
  } ${crownY} 100 ${crownY + 20} L100 ${height} Z`;

  const animatedProps = useAnimatedProps(() => ({
    fill: interpolateColor(themeIndex.value, INPUT, FOOTER_RAMPS[index]),
  }));

  return <AnimatedPath animatedProps={animatedProps} d={d} />;
}

/**
 * Decorative layered "hills" that close the character motif at the bottom.
 * Colors self-drive from the shared `themeIndex`, so they cross-fade with the
 * rest of the scheme on tab change. Purely visual — pointerEvents none.
 */
export function HillFooter({ height = 150 }: { height?: number }) {
  return (
    <View style={[styles.root, { height }]} pointerEvents="none">
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}>
        {LAYERS.map((_, i) => (
          <FooterLayer key={i} index={i} height={height} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
