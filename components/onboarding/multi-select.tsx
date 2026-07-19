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
  value: string[];
  onChange: (value: string[]) => void;
  /** Reject new picks once this many are selected (F4+ quiz caps). */
  max?: number;
};

/**
 * Card list where the user toggles several options on/off. Selected cards get
 * the accent border + a filled checkbox. Not used by F1's Connect steps but part
 * of the archetype set the later quiz steps (F4) reuse.
 */
export function MultiSelect({ options, value, onChange, max }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      if (max !== undefined && value.length >= max) return; // at cap, ignore
      onChange([...value, v]);
    }
  };

  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <HapticPressable
            key={opt.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => toggle(opt.value)}
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
              <GradientTick size={22} shape="square" />
            ) : (
              <Ionicons name="square-outline" size={22} color={palette.muted} />
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
    cardSelected: { borderColor: palette.accent },
    cardPressed: { opacity: 0.6 },
    label: {
      ...(Type.body as TextStyle),
      flex: 1,
      fontWeight: '600',
      color: palette.ink,
    },
    labelSelected: { color: palette.ink },
  });
