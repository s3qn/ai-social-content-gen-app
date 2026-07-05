import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { triggerImpact } from '@/components/haptic-pressable';

// --- "Ocean Sunset" preset, transcribed from the shared JSON spec. ---
// Experimental: a rotating tri-color gradient border with two glow layers,
// reacting on press. Values map directly to the spec so they're easy to tweak.
const CORNER_RADIUS = 70;
const OUTLINE_WIDTH = 4;

// Neon-green border, with the first color repeated so the rotation loops seamlessly.
const BORDER_COLORS = ['#39ff14', '#00ffa3', '#ccff00', '#39ff14'] as const;
const INNER_BG = 'rgba(21, 21, 21, 1)';

// animationSpeed: default 2 -> press 4. Higher speed = shorter rotation period.
const ROT_MS_DEFAULT = 8000 / 2; // 4s per revolution
const ROT_MS_PRESS = 8000 / 4; //   2s per revolution

// Two glow layers (RN has no view blur, so each is approximated with an iOS
// colored shadow). glowSize -> shadowRadius, opacity -> shadowOpacity.
const GLOW = {
  outer: { color: '#39ff14', size: 15, sizePress: 21, opacity: 0.1, opacityPress: 0.14 },
  inner: { color: '#aaff00', size: 5, sizePress: 7, opacity: 0.5, opacityPress: 0.7 },
};

type Props = {
  label: string;
  onPress?: () => void;
  children?: React.ReactNode; // e.g. a leading icon
};

export function GlowButton({ label, onPress, children }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Square sized to the button's diagonal so the rotating gradient always
  // covers the corners, whatever the button's dimensions.
  const diag = Math.ceil(Math.hypot(size.w, size.h));

  const angle = useSharedValue(0);
  const pressed = useSharedValue(0);

  function startRotation(durationMs: number) {
    cancelAnimation(angle);
    angle.value = 0;
    angle.value = withRepeat(
      withTiming(360, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
  }

  useEffect(() => {
    startRotation(ROT_MS_DEFAULT);
    return () => cancelAnimation(angle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    shadowRadius: GLOW.outer.size + pressed.value * (GLOW.outer.sizePress - GLOW.outer.size),
    shadowOpacity:
      GLOW.outer.opacity + pressed.value * (GLOW.outer.opacityPress - GLOW.outer.opacity),
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    shadowRadius: GLOW.inner.size + pressed.value * (GLOW.inner.sizePress - GLOW.inner.size),
    shadowOpacity:
      GLOW.inner.opacity + pressed.value * (GLOW.inner.opacityPress - GLOW.inner.opacity),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        triggerImpact();
        pressed.value = withTiming(1, { duration: 100 });
        startRotation(ROT_MS_PRESS);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 300 });
        startRotation(ROT_MS_DEFAULT);
      }}>
      <Animated.View style={scaleStyle}>
        {/* Glow layers (behind, iOS shadow bloom) */}
        <Animated.View
          style={[styles.glow, { shadowColor: GLOW.outer.color }, outerGlowStyle]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.glow, { shadowColor: GLOW.inner.color }, innerGlowStyle]}
          pointerEvents="none"
        />

        {/* Border clip: rotating gradient shows through the OUTLINE_WIDTH ring */}
        <View
          style={styles.clip}
          onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {diag > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: diag,
                  height: diag,
                  left: (size.w - diag) / 2,
                  top: (size.h - diag) / 2,
                },
                gradientStyle,
              ]}>
              <LinearGradient
                colors={BORDER_COLORS as unknown as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          <View style={styles.inner}>
            {children}
            <Text style={styles.label}>{label}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CORNER_RADIUS,
    backgroundColor: INNER_BG,
    shadowOffset: { width: 0, height: 0 },
  },
  clip: {
    borderRadius: CORNER_RADIUS,
    padding: OUTLINE_WIDTH,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: INNER_BG,
    borderRadius: CORNER_RADIUS - OUTLINE_WIDTH,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
