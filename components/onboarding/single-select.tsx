import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { GradientTick } from '@/components/onboarding/gradient';
import { SelectOption } from '@/constants/onboarding-steps';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string) => void;
};

/**
 * Card list where the user picks exactly one option. The selected card is
 * highlighted with the accent color. Theme-aware via useTheme().
 */
export function SingleSelect({ options, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <HapticPressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.card,
              selected && styles.cardSelected,
              pressed && !selected && styles.cardPressed,
            ]}>
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={22}
                color={selected ? palette.accent : palette.muted}
              />
            ) : null}
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
            {selected ? (
              <GradientTick size={22} shape="circle" />
            ) : (
              <View style={styles.checkSpacer} />
            )}
          </HapticPressable>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    list: { gap: Spacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderWidth: 1.5,
      borderColor: palette.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    cardSelected: {
      borderColor: palette.accent,
      backgroundColor: palette.surface,
    },
    cardPressed: { opacity: 0.6 },
    label: {
      ...(Type.body as TextStyle),
      flex: 1,
      fontWeight: '600',
      color: palette.ink,
    },
    labelSelected: { color: palette.ink },
    checkSpacer: { width: 22, height: 22 },
  });
