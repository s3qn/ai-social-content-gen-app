'use no memo';

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AnimatedGlow, { type PresetConfig } from 'react-native-animated-glow';

// Waiting overlay: a glowing neon ring around the screen while a long job runs
// (the Instagram scan is 30–90s), faded out when it finishes.
//
// This is built on `react-native-animated-glow` (Skia + Reanimated, animating on
// the UI thread). An earlier hand-rolled react-native-svg version tried to fake
// the bloom by stacking concentric translucent strokes; that can't work, because
// a glow IS a blur: hard-edged strokes always band into visible stripes instead
// of falling off, and stacking enough of them to hide the banding dropped
// frames. `glowSize: [dx, dy, blurRadius]` below is a real blurred shadow.
//
// Not a modal: no backdrop, `pointerEvents: 'none'`, so the screen underneath
// stays legible and interactive.

// The ring is sized to the FULL screen in exact pixels: no inset, no flex.
//
// Two reasons it must be exact. First, AnimatedGlow measures its own outer View
// via onLayout and draws the ring on that box, while `children` live in a
// separate auto-sized wrapper, so a `flex: 1` child collapses to zero height
// and drags the measured box in from the edges. Second, no inset is needed for
// the bloom: the library already renders its Skia canvas at GLOW_CANVAS_MARGIN
// (100px) beyond the box on every side, so the glow spills off the screen edge
// on its own, which is exactly the look we want.
const FADE_IN_MS = 220;
const FADE_OUT_MS = 300;
// A cached scan resolves in ~200ms. Without a floor the ring would strobe, so
// hold it on screen at least this long once shown.
const MIN_VISIBLE_MS = 700;

// "Neon Green" preset, from the reactnativeglow.com builder. Kept verbatim apart
// from `backgroundColor`, which is transparent here so the app shows through
// (the builder previews it on a solid #222 card).
const NEON_GREEN: PresetConfig = {
  metadata: {
    name: 'Neon Green',
    textColor: '#39FF14',
    category: 'Neon',
    tags: ['green', 'cyberpunk', 'bright', 'fast'],
  },
  states: [
    {
      name: 'default',
      preset: {
        cornerRadius: 50,
        outlineWidth: 4,
        borderColor: ['rgba(225, 255, 109, 1)', 'rgba(14, 255, 0, 1)', 'rgba(251, 255, 105, 1)'],
        backgroundColor: 'transparent',
        animationSpeed: 3,
        borderSpeedMultiplier: 1,
        glowLayers: [
          {
            glowPlacement: 'behind',
            colors: ['#00ff84', '#ffff00', '#15ff00'],
            glowSize: [10, 20, 10],
            opacity: 0.2,
            speedMultiplier: 1,
            coverage: 1,
          },
          {
            glowPlacement: 'behind',
            colors: ['#00ff84', '#ffff00', '#15ff00'],
            glowSize: [1, 8, 1],
            opacity: 0.3,
            speedMultiplier: 1,
            coverage: 1,
          },
          {
            glowPlacement: 'behind',
            colors: ['rgba(90, 255, 0, 1)', '#ffff00', '#15ff00'],
            glowSize: [1, 8, 1],
            opacity: 0.3,
            speedMultiplier: 1,
            coverage: 0.75,
          },
          {
            glowPlacement: 'behind',
            colors: ['#44ff00', '#00ff84', '#96ff96'],
            glowSize: [2, 8, 2],
            opacity: 0.5,
            speedMultiplier: 1,
            coverage: 1,
          },
        ],
      },
    },
  ],
};

// --- Refcounted imperative trigger (mirrors playScreenSwirl / playCreateOverlay) ---
// Refcounted rather than a plain boolean so two overlapping waits can't cut each
// other short: the ring hides only when the last one finishes.
type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
let refCount = 0;

export function beginWaiting() {
  refCount += 1;
  if (refCount === 1) listeners.forEach((l) => l(true));
}

export function endWaiting() {
  if (refCount === 0) return; // already settled, don't go negative
  refCount -= 1;
  if (refCount === 0) listeners.forEach((l) => l(false));
}

/**
 * Subscribe to the same refcount that drives the ring, so a second overlay can
 * follow the wait without running a parallel counter of its own (two counters
 * would eventually disagree about when a wait ended). Returns an unsubscribe.
 *
 * `components/statto-loader.tsx` is the only caller today.
 */
export function subscribeWaiting(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True if a wait is already in flight, for subscribers mounting mid-wait. */
export function isWaiting() {
  return refCount > 0;
}

/**
 * Show the waiting glow for as long as `active` is true.
 *
 * The cleanup runs on unmount too, so abandoning a wait (navigating back
 * mid-scan) releases the ring instead of stranding it on screen.
 */
export function useWaitingSwirl(active: boolean) {
  useEffect(() => {
    if (!active) return;
    beginWaiting();
    return endWaiting;
  }, [active]);
}

export function WaitingSwirl() {
  const { width: W, height: H } = useWindowDimensions();
  const [visible, setVisible] = useState(false); // unmount when idle → Skia canvas freed
  const opacity = useSharedValue(0);

  const shownAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    const show = () => {
      clearHideTimer();
      shownAt.current = Date.now();
      setVisible(true);
      cancelAnimation(opacity);
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
    };

    const hide = () => {
      clearHideTimer();
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        cancelAnimation(opacity);
        opacity.value = withTiming(
          0,
          { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) },
          (finished) => {
            'worklet';
            if (finished) runOnJS(setVisible)(false);
          },
        );
      }, remaining);
    };

    const listener: Listener = (on) => (on ? show() : hide());
    listeners.add(listener);
    if (refCount > 0) show(); // a wait may already be in flight

    return () => {
      listeners.delete(listener);
      clearHideTimer();
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible || W === 0) return null;

  // Exact pixels, not flex. See the note on sizing above.
  const box = { width: W, height: H };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, fadeStyle]}>
      <AnimatedGlow preset={NEON_GREEN} style={box}>
        {/* Transparent child: the glow traces its bounds, the app shows through. */}
        <View style={box} />
      </AnimatedGlow>
    </Animated.View>
  );
}
