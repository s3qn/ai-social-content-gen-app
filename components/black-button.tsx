import { StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline';
};

// Plain black button used across the onboarding screens. `solid` = filled
// near-black pill; `outline` = transparent with a near-black hairline border.
export function BlackButton({ label, onPress, variant = 'solid' }: Props) {
  const isSolid = variant === 'solid';
  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isSolid ? styles.solid : styles.outline,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.label, isSolid ? styles.solidLabel : styles.outlineLabel]}>{label}</Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
  } as ViewStyle,
  solid: {
    backgroundColor: Palette.ink,
  },
  outline: {
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.ink,
  },
  label: {
    ...(Type.body as TextStyle),
    fontWeight: '600',
  },
  solidLabel: {
    color: Palette.surface,
  },
  outlineLabel: {
    color: Palette.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
