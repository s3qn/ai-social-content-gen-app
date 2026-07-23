import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TextStyle } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

/**
 * "Copy strategy" pill under a post. STUB: the tap explains what is coming
 * until the brainstorm panel exists; wiring it later happens in this one file.
 */
export function CopyStrategyButton({ compact = false }: { compact?: boolean }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel="Copy strategy"
      onPress={() =>
        Alert.alert(
          'Copy strategy',
          'Coming soon: this will send the post to your brainstorm panel.',
        )
      }
      style={({ pressed }) => [
        styles.pill,
        compact && styles.pillCompact,
        pressed && styles.pressed,
      ]}>
      <Ionicons name="copy-outline" size={14} color={palette.muted} />
      <Text style={styles.label}>Copy strategy</Text>
    </HapticPressable>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.pill,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    pillCompact: {
      alignSelf: 'flex-start',
      marginTop: Spacing.xs,
    },
    pressed: { opacity: 0.6 },
    label: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
  });
