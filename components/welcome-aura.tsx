import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

// Decorative welcome-screen backdrop: a neon-green "watercolor" rises from
// below, coalesces in the middle, and forms a hollow ring. All motion is
// native transform/opacity (no animated SVG props, no blur); soft edges come
// from radial gradients fading to transparent. pointerEvents="none" throughout.

const NEON = '#39ff14';
const MINT = '#00ffa3';
const LIME = '#ccff00';

export function WelcomeAura() {
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();

  const rise = useSharedValue(0); // 0→1 water rises from below to centre
  const morph = useSharedValue(0); // 0→1 blobs coalesce → hollow ring blooms
  const breathe = useSharedValue(0); // infinite gentle pulse once the ring exists

  useEffect(() => {
    if (reduced) {
      rise.value = 1;
      morph.value = 1;
      breathe.value = 0;
      return;
    }
    rise.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }, (f) => {
      'worklet';
      if (!f) return;
      morph.value = withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }, (g) => {
        'worklet';
        if (!g) return;
        breathe.value = withRepeat(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        );
      });
    });
    return () => {
      cancelAnimation(rise);
      cancelAnimation(morph);
      cancelAnimation(breathe);
    };
  }, [rise, morph, breathe, reduced]);

  const washStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(rise.value, [0, 0.35, 1], [0, 1, 1]) * interpolate(morph.value, [0, 1], [1, 0.28]),
    transform: [{ translateY: (1 - rise.value) * H * 0.6 }],
  }));

  const blobAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.35, 1], [0, 1, 1]) * (1 - morph.value),
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [H * 0.72, 0]) },
      { scale: (0.9 + rise.value * 0.1) * (1 - morph.value * 0.3) },
    ],
  }));
  const blobBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.35, 1], [0, 1, 1]) * (1 - morph.value),
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [H * 0.92, -H * 0.04]) },
      { scale: (0.9 + rise.value * 0.1) * (1 - morph.value * 0.3) },
    ],
  }));
  const blobCStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.35, 1], [0, 1, 1]) * (1 - morph.value),
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [H * 0.6, H * 0.03]) },
      { scale: (0.9 + rise.value * 0.1) * (1 - morph.value * 0.3) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => {
    const bloom = 0.86 + morph.value * 0.14; // settle 0.86 → 1.0
    const breatheAmt = breathe.value * 0.035 * morph.value; // pulse only after the ring exists
    return {
      opacity: morph.value * (1 - breathe.value * 0.1),
      transform: [{ scale: bloom + breatheAmt }],
    };
  });

  if (W === 0) return null;

  const CX = W / 2;
  const CY = H / 2;
  const ringR = Math.min(W, H) * 0.34;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Wash — the "body of water" rising from below */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]}>
        <LinearGradient
          colors={[
            'rgba(57,255,20,0)',
            'rgba(57,255,20,0.10)',
            'rgba(0,255,163,0.26)',
            'rgba(57,255,20,0.5)',
          ]}
          locations={[0, 0.45, 0.72, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Three parallax radial blobs (neon / mint / lime) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blobAStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="blobA" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={NEON} stopOpacity={0.85} />
              <Stop offset={0.55} stopColor={NEON} stopOpacity={0.35} />
              <Stop offset={1} stopColor={NEON} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={CX} cy={CY} rx={W * 0.46} ry={W * 0.44} fill="url(#blobA)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blobBStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="blobB" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={MINT} stopOpacity={0.7} />
              <Stop offset={0.5} stopColor={MINT} stopOpacity={0.3} />
              <Stop offset={1} stopColor={MINT} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={CX + W * 0.1} cy={CY} rx={W * 0.4} ry={W * 0.38} fill="url(#blobB)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blobCStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="blobC" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={LIME} stopOpacity={0.6} />
              <Stop offset={0.6} stopColor={LIME} stopOpacity={0.2} />
              <Stop offset={1} stopColor={LIME} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={CX - W * 0.12} cy={CY + H * 0.02} rx={W * 0.32} ry={W * 0.3} fill="url(#blobC)" />
        </Svg>
      </Animated.View>

      {/* Hollow ring — soft mint halo under a bright neon core band, transparent centre */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="ringHalo" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={MINT} stopOpacity={0} />
              <Stop offset={0.5} stopColor={MINT} stopOpacity={0} />
              <Stop offset={0.7} stopColor={MINT} stopOpacity={0.3} />
              <Stop offset={1} stopColor={MINT} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="ringCore" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={NEON} stopOpacity={0} />
              <Stop offset={0.55} stopColor={NEON} stopOpacity={0} />
              <Stop offset={0.62} stopColor={NEON} stopOpacity={0.12} />
              <Stop offset={0.72} stopColor={NEON} stopOpacity={0.95} />
              <Stop offset={0.8} stopColor={MINT} stopOpacity={0.9} />
              <Stop offset={0.88} stopColor={NEON} stopOpacity={0.22} />
              <Stop offset={1} stopColor={NEON} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={CX} cy={CY} r={ringR * 1.3} fill="url(#ringHalo)" />
          <Circle cx={CX} cy={CY} r={ringR} fill="url(#ringCore)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
