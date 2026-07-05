import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { INPUT, ON_HILL, PRIMARY, themeIndex } from '@/constants/theme-transition';
import { Radius, Spacing, Type } from '@/constants/theme';

type AccentPillProps = {
  label: string;
  onPress?: () => void;
};

/**
 * A filled call-to-action pill (e.g. "Add Competitors +") whose background
 * self-drives from the shared `themeIndex`, so it cross-fades with the rest of
 * the character scheme on tab change. White label + trailing "+" icon.
 */
export function AccentPill({ label, onPress }: AccentPillProps) {
  'use no memo';
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY),
  }));

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <Animated.View style={[styles.pill, bg]}>
        <Text style={styles.label}>{label}</Text>
        <Ionicons name="add" size={20} color={ON_HILL} />
      </Animated.View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  label: {
    ...(Type.body as TextStyle),
    color: ON_HILL,
    fontWeight: '700',
  },
});
