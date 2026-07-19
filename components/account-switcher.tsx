import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/contexts/theme';

const AVATAR = 32;

/**
 * Bottom sheet listing every connected Instagram account, with the active one
 * checked. "Add account" re-enters the onboarding funnel to scan another handle.
 *
 * Tracking more than one account is the reason to create an email account, so an
 * anonymous user gets a one-line upsell here, the one place that payoff is
 * actually visible.
 */
export function AccountSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { accounts, setActive } = useAccounts();
  const { isAnonymous } = useAuth();

  const pick = (handle: string) => {
    setActive(handle);
    onClose();
  };

  const addAnother = () => {
    onClose();
    // The onboarding group is guard-protected on `!hasAccounts`, which is false
    // here, so push the route explicitly rather than relying on the guard.
    router.push('/step');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Accounts</Text>

        {accounts.map((a) => (
          <HapticPressable
            key={a.handle}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => pick(a.handle)}>
            {a.avatarUrl ? (
              <Image source={{ uri: a.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(a.displayName ?? a.handle).slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.handle} numberOfLines={1}>
                @{a.handle}
              </Text>
              {a.displayName ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {a.displayName}
                </Text>
              ) : null}
            </View>
            {a.isActive ? (
              <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
            ) : null}
          </HapticPressable>
        ))}

        <HapticPressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={addAnother}>
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="add" size={20} color={palette.ink} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.handle}>Add account</Text>
            <Text style={styles.subtitle}>Scan another Instagram profile</Text>
          </View>
        </HapticPressable>

        {isAnonymous ? (
          <Text style={styles.upsell}>
            Create an account in Settings to sync these across devices.
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      backgroundColor: palette.bg,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      gap: Spacing.xs,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.line,
      marginBottom: Spacing.md,
    },
    title: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    pressed: {
      opacity: 0.6,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: palette.surface,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    avatarInitial: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '700',
    },
    rowText: {
      flex: 1,
    },
    handle: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
    },
    subtitle: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      fontSize: 13,
    },
    upsell: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      fontSize: 13,
      paddingTop: Spacing.sm,
    },
  });
