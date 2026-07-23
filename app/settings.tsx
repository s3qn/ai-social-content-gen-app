import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlackButton } from '@/components/black-button';
import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';
import { ThemeMode, useTheme } from '@/contexts/theme';
import { clearLocalUserData, deleteOwnAccount } from '@/lib/account-delete';

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
  const { signOut, session } = useAuth();
  const { accounts } = useAccounts();
  const { mode, palette, setMode } = useTheme();
  const { reset: resetOnboarding } = useOnboarding();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Permanent, and the confirm says so. The RPC deletes the auth user, which
  // cascades every row they own; the local mirrors have to be cleared by hand or
  // a deleted user's accounts and peers come back on the next launch. Clear them
  // BEFORE signing out, while the handles are still in memory.
  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your connected accounts, tracked peers, saved scans and onboarding answers. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const uid = session?.user?.id ?? null;
              const handles = accounts.map((a) => a.handle);
              const result = await deleteOwnAccount();
              if (result !== 'ok') {
                Alert.alert(
                  'Could not delete the account',
                  'The server refused the request, so nothing was deleted. Check that migration 0007 has been applied, then try again.',
                );
                return;
              }
              if (uid) clearLocalUserData(uid, handles);
              // The user no longer exists, so sign-out can legitimately fail.
              // Either way the session is dropped locally and the guard sends
              // us back to welcome.
              await signOut();
            })();
          },
        },
      ],
    );
  };

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
    <View style={styles.root}>
      {/* JS header, not the native stack header: a native back button freezes
          after an in-screen theme toggle (the nav bar re-syncs on recolor).
          router.back() on a Pressable is immune to that. */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
          <Ionicons name="chevron-back" size={26} color={palette.ink} />
        </HapticPressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

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

      {/* Destructive and irreversible, so it sits apart from Log out, is styled
          as a warning rather than a button, and confirms before doing anything. */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Danger zone</Text>
        <HapticPressable
          accessibilityRole="button"
          onPress={confirmDelete}
          style={({ pressed }) => [styles.devRow, pressed && styles.devRowPressed]}>
          <Ionicons name="trash-outline" size={20} color={palette.warn} />
          <View style={styles.devRowText}>
            <Text style={[styles.devRowTitle, styles.dangerTitle]}>Delete account</Text>
            <Text style={styles.devRowSub}>
              Permanently removes your accounts, peers, scans and answers
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </HapticPressable>
      </View>
      </View>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    back: {
      padding: Spacing.xs,
      marginLeft: -Spacing.xs,
    },
    backPressed: {
      opacity: 0.5,
    },
    headerTitle: {
      ...(Type.body as TextStyle),
      fontSize: 18,
      fontWeight: '700',
      color: palette.ink,
    },
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
    dangerTitle: {
      color: palette.warn,
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
