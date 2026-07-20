'use no memo';

import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isWaiting, subscribeWaiting } from '@/components/waiting-swirl';

// Statto scrolling his phone, floating over the screen while a long job runs
// (the Instagram scan is 30–90s). He rides the SAME refcount as the neon ring
// in `waiting-swirl.tsx`, so anything already calling `useWaitingSwirl(active)`
// gets him for free and the two overlays can never disagree about the wait.
//
// The two are deliberately complementary, not alternatives: the ring is a
// screen-edge border effect, Statto is a character anchored near the bottom.
//
// The asset is an animated WebP with a real alpha channel, not a video. The
// source `statto-ds.mp4` is H.264 yuv420p with no alpha, so playing it would
// put a black rectangle on screen; `scripts/build-statto-loop.sh` keys it out
// offline and fixes the loop point. expo-image (already a dependency) renders
// animated WebP natively, which is why no video package is involved.

const SIZE = 180; // rendered width/height, pt
const BOTTOM_GAP = 96; // clears the onboarding footer button; nudge on-device
const FADE_IN_MS = 220;
const FADE_OUT_MS = 300;
// A cached scan resolves in ~200ms. Without a floor Statto would blink in and
// straight back out, which reads as a glitch rather than a loader. Matches the
// ring's own floor so the two always appear and leave together.
const MIN_VISIBLE_MS = 700;

const STATTO = require('@/assets/images/statto-loop.webp');

export function StattoLoader() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Unmounting when idle is what actually frees the WebP decoder; leaving the
  // <Image> mounted at opacity 0 would keep decoding frames off-screen.
  const [visible, setVisible] = useState(false);
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
      if (reducedMotion) {
        opacity.value = 1;
        return;
      }
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
    };

    const hide = () => {
      clearHideTimer();
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        cancelAnimation(opacity);
        if (reducedMotion) {
          opacity.value = 0;
          setVisible(false);
          return;
        }
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

    const unsubscribe = subscribeWaiting((on) => (on ? show() : hide()));
    if (isWaiting()) show(); // a wait may already be in flight when we mount

    return () => {
      unsubscribe();
      clearHideTimer();
      cancelAnimation(opacity);
    };
  }, [opacity, reducedMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.wrap, { bottom: insets.bottom + BOTTOM_GAP }, fadeStyle]}
      // Decorative. The screen that started the wait already announces its own
      // progress (the scan checklist reads out its rows), so labelling Statto
      // too would just say the same thing twice to a screen reader.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image
        source={STATTO}
        style={styles.statto}
        contentFit="contain"
        // The overlay owns its own fade; expo-image's cross-fade on top of that
        // would double up.
        transition={0}
        // Reduced motion still gets Statto, just held on his first frame.
        autoplay={!reducedMotion}
        priority="low"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // Never intercept a tap: the screen underneath stays fully interactive.
    pointerEvents: 'none',
  },
  statto: {
    width: SIZE,
    height: SIZE,
  },
});
