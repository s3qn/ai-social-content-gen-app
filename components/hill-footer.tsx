import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CharacterTheme } from '@/constants/characters';

type HillFooterProps = {
  theme: CharacterTheme;
  height?: number;
};

// Each layer's crown as a fraction of height (how high the ridge rises) and a
// horizontal offset for the peak, so the ridges read as distinct overlapping hills.
const LAYERS = [
  { rise: 0.62, peakX: 32 },
  { rise: 0.44, peakX: 68 },
  { rise: 0.26, peakX: 50 },
];

/**
 * Decorative layered "hills" that close the green motif at the bottom of the
 * scroll content. Back-to-front so the frontmost (last) color sits lowest.
 * Purely visual — pointerEvents none, matching welcome-aura / virlo-wave.
 */
export function HillFooter({ theme, height = 150 }: HillFooterProps) {
  const H = height;
  return (
    <View style={[styles.root, { height: H }]} pointerEvents="none">
      <Svg
        width="100%"
        height={H}
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}>
        {LAYERS.map((layer, i) => {
          const crownY = H - layer.rise * H; // peak height from the top
          const color = theme.footerHills[i] ?? theme.footerHills[theme.footerHills.length - 1];
          // Start bottom-left, rise to a crown via a symmetric cubic, drop to
          // bottom-right, and close along the bottom edge.
          const d = `M0 ${H} L0 ${crownY + 20} C${layer.peakX * 0.4} ${crownY} ${
            layer.peakX * 1.6
          } ${crownY} 100 ${crownY + 20} L100 ${H} Z`;
          return <Path key={i} d={d} fill={color} />;
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
