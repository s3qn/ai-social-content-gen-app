import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  label: string;
  /** `accent` tints the pill with the brand green; `subtle` is a neutral fill. */
  variant?: 'accent' | 'subtle';
};

/**
 * A small pill used for the Content DNA "vibe" tags. Theme-aware via useTheme();
 * the accent variant reads against both light and dark surfaces.
 */
export function Chip({ label, variant = 'subtle' }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const accent = variant === 'accent';
  return (
    <View style={[styles.chip, accent ? styles.chipAccent : styles.chipSubtle]}>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
    },
    chipSubtle: {
      backgroundColor: palette.surface,
      borderColor: palette.line,
    },
    chipAccent: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    label: {
      ...(Type.body as TextStyle),
      fontSize: 13,
      fontWeight: '600',
      color: palette.ink,
    },
    labelAccent: { color: palette.surface },
  });
