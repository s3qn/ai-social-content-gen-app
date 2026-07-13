import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline';
  /** Dim + block presses (e.g. a step whose answer isn't ready yet). */
  disabled?: boolean;
};

// Primary button used across the onboarding + settings screens. `solid` = filled
// ink pill (near-white label); `outline` = surface fill with an ink hairline
// border. Colors follow the active theme.
export function BlackButton({ label, onPress, variant = 'solid', disabled = false }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isSolid = variant === 'solid';
  return (
    <HapticPressable
      onPress={disabled ? undefined : onPress}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isSolid ? styles.solid : styles.outline,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.label, isSolid ? styles.solidLabel : styles.outlineLabel]}>{label}</Text>
    </HapticPressable>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      borderRadius: Radius.md,
    } as ViewStyle,
    solid: {
      backgroundColor: palette.ink,
    },
    outline: {
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.ink,
    },
    label: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
    },
    solidLabel: {
      color: palette.surface,
    },
    outlineLabel: {
      color: palette.ink,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });
