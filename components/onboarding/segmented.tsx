import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { SelectOption } from '@/constants/onboarding-steps';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string) => void;
};

/**
 * Horizontal segmented control (Often/Sometimes/Never, Yes/No). Mirrors the
 * settings appearance selector (app/settings.tsx) so the whole app shares one
 * segment look. Not used by F1's Connect steps; part of the archetype set for
 * later quiz steps (F4).
 */
export function Segmented({ options, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <HapticPressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.itemActive,
              pressed && !selected && styles.itemPressed,
            ]}>
            <Text style={[styles.text, selected && styles.textActive]}>{opt.label}</Text>
          </HapticPressable>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.xs,
      gap: Spacing.xs,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radius.sm,
    },
    itemActive: { backgroundColor: palette.accent },
    itemPressed: { opacity: 0.6 },
    text: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
    },
    textActive: { color: palette.surface },
  });
