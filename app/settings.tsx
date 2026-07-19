import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { BlackButton } from '@/components/black-button';
import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';
import { ThemeMode, useTheme } from '@/contexts/theme';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Settings screen, pushed from the header gear. Appearance selector (Light /
 * Dark / System) + Log out. On sign-out the auth guard flips and the navigator
 * redirects back to the welcome flow.
 */
export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { mode, palette, setMode } = useTheme();
  const { reset: resetOnboarding } = useOnboarding();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Dev/utility entry. The router gate (app/_layout.tsx) is live as of F6, so
  // clearing the flag is enough: the guard flips back to the onboarding group.
  // The explicit replace makes the hand-off deterministic rather than relying on
  // the guard's fallback redirect. Kept deliberately: without it there's no way
  // to re-test the funnel once the gate is enforced.
  const replayOnboarding = () => {
    resetOnboarding();
    router.replace('/step');
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.segment}>
          {MODES.map((m) => {
            const selected = mode === m.value;
            return (
              <HapticPressable
                key={m.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setMode(m.value)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  selected && styles.segmentItemActive,
                  pressed && !selected && styles.segmentItemPressed,
                ]}>
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                  {m.label}
                </Text>
              </HapticPressable>
            );
          })}
        </View>
      </View>

      {/* Dev/utility row: the only way back into the funnel now that the gate
          is enforced. */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Developer</Text>
        <HapticPressable
          accessibilityRole="button"
          onPress={replayOnboarding}
          style={({ pressed }) => [styles.devRow, pressed && styles.devRowPressed]}>
          <Ionicons name="flask-outline" size={20} color={palette.accent} />
          <View style={styles.devRowText}>
            <Text style={styles.devRowTitle}>Replay onboarding</Text>
            <Text style={styles.devRowSub}>Clears your answers and runs the funnel again</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </HapticPressable>
      </View>

      <BlackButton label="Log out" onPress={() => signOut()} />
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
      padding: Spacing.xl,
      gap: Spacing.xl,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionLabel: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    // Track: a rounded row that holds the three segments.
    segment: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.xs,
      gap: Spacing.xs,
    },
    segmentItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radius.sm,
    },
    segmentItemActive: {
      backgroundColor: palette.accent,
    },
    segmentItemPressed: {
      opacity: 0.6,
    },
    segmentText: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: palette.surface,
    },
    devRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    devRowPressed: {
      opacity: 0.6,
    },
    devRowText: {
      flex: 1,
      gap: 2,
    },
    devRowTitle: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
    },
    devRowSub: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
  });
