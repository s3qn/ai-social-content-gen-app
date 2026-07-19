import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

// In-place "create" overlay. Pressing the "+" FAB blurs the current screen in
// place (no modal route push) and scale-animates in 4 stub creation options,
// centered on screen. Cloned from the imperative-trigger architecture of
// components/screen-swirl.tsx: a module-level listener Set + an exported
// play*() so any caller can fire it without a Context, and a `visible` state
// that unmounts the tree at rest.
//
// The 4 options are all just post types, so every button shares ONE background
// color and ONE typeface (Poppins).

const FONT_FAMILY = 'Poppins_600SemiBold';

const OPTIONS = [
  { id: 'post', emoji: '🖼️', label: 'Post' },
  { id: 'carousel', emoji: '🎠', label: 'Carousel' },
  { id: 'reel', emoji: '🎬', label: 'Reel' },
  { id: 'reference', emoji: '🔖', label: 'Reference' },
] as const;

// --- Lightweight imperative trigger (mirrors screen-swirl / triggerImpact) ---
type Listener = () => void;
const listeners = new Set<Listener>();

export function playCreateOverlay() {
  listeners.forEach((l) => l());
}

// iOS "Reduce Transparency" → fall back to a translucent solid (also on Android).
// Copied from components/create-fab.tsx so the blur backdrop degrades the same way.
function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => mounted && setReduce(!!v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

// Slower, gentler timings than a snappy default feel.
const OPEN_FADE_MS = 420;
const OPEN_SCALE_MS = 480;
const CLOSE_MS = 320;
const BTN_MS = 380;
const BTN_STAGGER_MS = 90;
const BTN_LEAD_MS = 120;
const HIDDEN_SCALE = 0.8; // scrim + stack scale in from / out to this

export function CreateOverlay() {
  'use no memo';
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const reduceTransparency = useReduceTransparency();
  const reducedMotion = useReducedMotion();
  const useSolid = Platform.OS === 'android' || reduceTransparency;
  const isDark = scheme === 'dark';

  // Load Poppins. Until it resolves we skip fontFamily so the labels still
  // render in the system font (no invisible text).
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });

  const [visible, setVisible] = useState(false); // unmount when idle → free at rest
  const opacity = useSharedValue(0); // master container fade
  const scale = useSharedValue(HIDDEN_SCALE); // master scrim + stack scale

  // One progress value per button (fixed count → stable hook order) for a
  // staggered entrance fade layered over the master scale. 0 = hidden, 1 = shown.
  const b0 = useSharedValue(0);
  const b1 = useSharedValue(0);
  const b2 = useSharedValue(0);
  const b3 = useSharedValue(0);
  const buttons = [b0, b1, b2, b3];

  useEffect(() => {
    const run = () => {
      setVisible(true);
      cancelAnimation(opacity);
      cancelAnimation(scale);
      buttons.forEach((b) => cancelAnimation(b));

      if (reducedMotion) {
        // Respect Reduce Motion: appear instantly, no scale tween / stagger.
        opacity.value = 1;
        scale.value = 1;
        buttons.forEach((b) => (b.value = 1));
        return;
      }

      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      opacity.value = withTiming(1, { duration: OPEN_FADE_MS, easing: Easing.out(Easing.quad) });
      scale.value = withTiming(1, { duration: OPEN_SCALE_MS, easing: Easing.out(Easing.cubic) });

      buttons.forEach((b, i) => {
        b.value = 0;
        b.value = withDelay(
          BTN_LEAD_MS + i * BTN_STAGGER_MS,
          withTiming(1, { duration: BTN_MS, easing: Easing.out(Easing.cubic) }),
        );
      });
    };
    listeners.add(run);
    return () => {
      listeners.delete(run);
      cancelAnimation(opacity);
      cancelAnimation(scale);
      buttons.forEach((b) => cancelAnimation(b));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opacity, scale, reducedMotion, b0, b1, b2, b3]);

  function dismiss() {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    buttons.forEach((b) => cancelAnimation(b));

    if (reducedMotion) {
      // Disappear instantly, no scale tween.
      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      buttons.forEach((b) => (b.value = 0));
      setVisible(false);
      return;
    }

    opacity.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      'worklet';
      if (finished) runOnJS(setVisible)(false);
    });
    scale.value = withTiming(HIDDEN_SCALE, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
    buttons.forEach((b) => {
      b.value = withTiming(0, { duration: CLOSE_MS });
    });
  }

  // Master fade + scale drives the scrim AND the button stack together (scale in/out).
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  // Per-button staggered fade, layered over the master scale.
  const s0 = useAnimatedStyle(() => ({ opacity: b0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: b1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: b2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: b3.value }));
  const btnStyles = [s0, s1, s2, s3];

  if (!visible) return null;

  // Generous centered stack: ~84% of screen width, capped for large screens.
  const stackWidth = Math.min(width * 0.84, 420);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
      {/* Backdrop: tapping anywhere off a button dismisses. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss create menu"
        onPress={dismiss}>
        {useSolid ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(18,17,16,0.92)' : 'rgba(251,250,247,0.92)' },
            ]}
          />
        ) : (
          <BlurView
            tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            intensity={48}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Pressable>

      {/* Centered vertical stack. box-none lets taps in the empty gaps fall
          through to the backdrop Pressable so they also dismiss. */}
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.stack, { width: stackWidth }]}>
          <Text style={[styles.title, fontsLoaded ? { fontFamily: FONT_FAMILY } : null]}>
            Create Content
          </Text>
          {OPTIONS.map((o, i) => (
            <Animated.View key={o.id} style={btnStyles[i]}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel={o.label}
                onPress={() => {
                  dismiss();
                  // TODO: real creation flow (later phase). Wire per-type editor here.
                }}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' },
                  pressed && styles.pressed,
                ]}>
                {/* Frosted-glass fill, clipped to the button's rounded shape.
                    Reduce Transparency / Android → translucent solid fallback. */}
                {useSolid ? (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: isDark ? 'rgba(40,38,35,0.62)' : 'rgba(255,255,255,0.5)' },
                    ]}
                  />
                ) : (
                  <BlurView
                    tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
                    intensity={40}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.buttonLabel, fontsLoaded ? { fontFamily: FONT_FAMILY } : null]}>
                  {`${o.emoji}  ${o.label}`}
                </Text>
              </HapticPressable>
            </Animated.View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  stack: {
    gap: Spacing.lg,
  },
  title: {
    // Heading above the stack; white with the same shadow as the labels so it
    // reads over the blurred backdrop in both schemes.
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  button: {
    // Big, chunky frosted-glass block.
    paddingVertical: 26,
    paddingHorizontal: 32,
    borderRadius: Radius.lg,
    overflow: 'hidden', // REQUIRED so the BlurView fill clips to the rounded shape
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor set inline (theme-aware glass edge)
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    // Uniform white label across all four; a dark text shadow keeps it legible
    // on the frosted glass in both light and dark schemes.
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pressed: {
    opacity: 0.85,
  },
});
