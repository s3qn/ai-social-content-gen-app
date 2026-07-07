import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Rect } from 'react-native-svg';

// One-shot neon overlay. Two phases:
//  1. Intro (~0.45s "mirror zipper"): two lines emerge from the top-center and
//     bottom-center of the screen edge, split, and race down/up both sides,
//     meeting at the left/right middle — the rounded border draws itself on.
//  2. Swirl: a bright dashed arc travels once around the rounded frame over a
//     dim static base ring, then everything fades out.
// fill="none" keeps the screen centre transparent + interactive throughout.

const CORE_COLOR = '#ccff00'; // bright neon-lime core
const GLOW_COLOR = '#39ff14'; // neon-green bloom underlay
const THICKNESS = 6; // core stroke width, px
const CORNER_RADIUS = 48; // rounded-corner radius (≈ iPhone screen), px
const ARC_FRACTION = 0.6; // fraction of the ring lit during the swirl
const SPIN_MS = 1500; // swirl duration
const REVOLUTIONS = 1; // swirl laps over SPIN_MS
const INTRO_MS = 250; // draw-on intro duration (fast zipper)
const XFADE_MS = 80; // intro→swirl cross-fade (kills the full-ring → arc pop)
const BASE_DIM = 0.22; // opacity of the dim full-ring base under the swirl
const EDGE_OVERSHOOT = 40; // intro lines start this far off the top/bottom edge → "emerge" in

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Perimeter of a rounded rectangle (straight sides + one full corner circle).
function roundedPerimeter(w: number, h: number, r: number) {
  return 2 * (w + h) - 8 * r + 2 * Math.PI * r;
}

// --- Lightweight imperative trigger (mirrors triggerImpact style; no Context) ---
type Listener = () => void;
const listeners = new Set<Listener>();

export function playScreenSwirl() {
  listeners.forEach((l) => l());
}

export function ScreenSwirl() {
  const { width: W, height: H } = useWindowDimensions();

  const [visible, setVisible] = useState(false); // unmount when idle → free at rest
  const intro = useSharedValue(0); // draw-on progress 0→1
  const offset = useSharedValue(0); // swirl arc travel
  const opacity = useSharedValue(0); // master container fade
  const introFade = useSharedValue(1); // intro paths group opacity 1→0
  const baseFade = useSharedValue(0); // dim full-ring base opacity 0→BASE_DIM

  // Rounded-rect geometry. Inset by half the stroke so the ring sits on-screen.
  const inset = THICKNESS / 2;
  const rw = W - THICKNESS;
  const rh = H - THICKNESS;
  const perimeter = roundedPerimeter(rw, rh, CORNER_RADIUS);
  const arc = perimeter * ARC_FRACTION;
  const gap = perimeter - arc; // one lit arc + one gap = exactly one lap
  // Each intro path = quarter perimeter + the off-edge stub it emerges from.
  const L = perimeter / 4 + inset + EDGE_OVERSHOOT;

  useEffect(() => {
    const run = () => {
      setVisible(true);
      cancelAnimation(intro);
      cancelAnimation(offset);
      cancelAnimation(opacity);
      cancelAnimation(introFade);
      cancelAnimation(baseFade);
      intro.value = 0;
      offset.value = 0;
      opacity.value = 0;
      introFade.value = 1;
      baseFade.value = 0;

      const total = INTRO_MS + SPIN_MS;

      // Master fade: fade-in overlaps the intro, hold across intro+swirl, fade-out at the end.
      opacity.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: total - 200 - 300 }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }, (finished) => {
          'worklet';
          if (finished) runOnJS(setVisible)(false);
        }),
      );

      // Draw-on; on natural finish, hand off to the swirl + cross-fade phases.
      intro.value = withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        'worklet';
        if (!finished) return; // re-tap cancelled us → do nothing
        offset.value = withTiming(-perimeter * REVOLUTIONS, {
          duration: SPIN_MS,
          easing: Easing.linear,
        });
        introFade.value = withTiming(0, { duration: XFADE_MS });
        baseFade.value = withTiming(BASE_DIM, { duration: XFADE_MS });
      });
    };
    listeners.add(run);
    return () => {
      listeners.delete(run);
      cancelAnimation(intro);
      cancelAnimation(offset);
      cancelAnimation(opacity);
      cancelAnimation(introFade);
      cancelAnimation(baseFade);
    };
  }, [intro, offset, opacity, introFade, baseFade, perimeter]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const swirlProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const introDrawProps = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - intro.value) }));
  const introGroupProps = useAnimatedProps(() => ({ opacity: introFade.value }));
  const swirlGroupProps = useAnimatedProps(() => ({ opacity: 1 - introFade.value }));
  const baseGroupProps = useAnimatedProps(() => ({ opacity: baseFade.value }));

  if (!visible || W === 0) return null;

  const XL = inset;
  const XR = W - inset;
  const YT = inset;
  const YB = H - inset;
  const XC = W / 2;
  const YC = H / 2;
  const R = CORNER_RADIUS;

  // Four quarter paths. Each starts off-screen (above the top / below the bottom),
  // pokes in through the edge center, then races to a side-middle — so the lines
  // look like they emerge from the top and bottom of the phone.
  const dUR = `M ${XC} ${-EDGE_OVERSHOOT} V ${YT} H ${XR - R} A ${R} ${R} 0 0 1 ${XR} ${YT + R} V ${YC}`;
  const dUL = `M ${XC} ${-EDGE_OVERSHOOT} V ${YT} H ${XL + R} A ${R} ${R} 0 0 0 ${XL} ${YT + R} V ${YC}`;
  const dLR = `M ${XC} ${H + EDGE_OVERSHOOT} V ${YB} H ${XR - R} A ${R} ${R} 0 0 0 ${XR} ${YB - R} V ${YC}`;
  const dLL = `M ${XC} ${H + EDGE_OVERSHOOT} V ${YB} H ${XL + R} A ${R} ${R} 0 0 1 ${XL} ${YB - R} V ${YC}`;

  const ringGeom = { x: inset, y: inset, width: rw, height: rh, rx: R, ry: R, fill: 'none' as const };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, fadeStyle]}>
      <Svg width={W} height={H}>
        {/* (A) Dim static full-ring base — fades in at swirl start, persists under the arc */}
        <AnimatedG animatedProps={baseGroupProps}>
          <Rect {...ringGeom} stroke={CORE_COLOR} strokeWidth={THICKNESS} strokeLinecap="round" />
        </AnimatedG>

        {/* (B) Swirl: glow underlay + bright core moving arc (hidden until intro hands off) */}
        <AnimatedG animatedProps={swirlGroupProps}>
          <AnimatedRect
            {...ringGeom}
            stroke={GLOW_COLOR}
            strokeOpacity={0.35}
            strokeWidth={THICKNESS * 2.4}
            strokeDasharray={[arc, gap]}
            strokeLinecap="round"
            animatedProps={swirlProps}
          />
          <AnimatedRect
            {...ringGeom}
            stroke={CORE_COLOR}
            strokeWidth={THICKNESS}
            strokeDasharray={[arc, gap]}
            strokeLinecap="round"
            animatedProps={swirlProps}
          />
        </AnimatedG>

        {/* (C) Intro draw-on: 4 paths × (glow + core), fade out during the cross-fade */}
        <AnimatedG animatedProps={introGroupProps}>
          {[dUR, dUL, dLR, dLL].map((d) => [
            <AnimatedPath
              key={`${d}-glow`}
              d={d}
              fill="none"
              stroke={GLOW_COLOR}
              strokeOpacity={0.35}
              strokeWidth={THICKNESS * 2.4}
              strokeDasharray={[L, L]}
              strokeLinecap="round"
              animatedProps={introDrawProps}
            />,
            <AnimatedPath
              key={`${d}-core`}
              d={d}
              fill="none"
              stroke={CORE_COLOR}
              strokeWidth={THICKNESS}
              strokeDasharray={[L, L]}
              strokeLinecap="round"
              animatedProps={introDrawProps}
            />,
          ])}
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}
