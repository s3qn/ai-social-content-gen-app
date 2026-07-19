import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { CharacterTheme } from '@/constants/characters';
import { InstagramAccount } from '@/constants/mock-account';
import { Radius, Spacing, Type } from '@/constants/theme';

type InstagramPillProps = {
  theme: CharacterTheme;
  /** The connected account, or null to show the "Connect" state. */
  account: InstagramAccount | null;
  onPress?: () => void;
};

const AVATAR = 24;

/**
 * The account-being-analyzed pill that sits on the colored hill header.
 * Visual mock only: `onPress` is expected to toggle local screen state.
 */
export function InstagramPill({ theme, account, onPress }: InstagramPillProps) {
  const initials = account ? account.displayName.slice(0, 1).toUpperCase() : '';

  return (
    <HapticPressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        // A faint white scrim vanishes on a light hill, so each character supplies
        // a scrim tuned to its own hill lightness.
        { backgroundColor: theme.pillScrim },
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      {account ? (
        <>
          {account.avatarUrl ? (
            <Image source={{ uri: account.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.initialsCircle]}>
              <Text style={[styles.initials, { color: theme.primary }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.label, { color: theme.onHill }]} numberOfLines={1}>
            @{account.handle}
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="logo-instagram" size={18} color={theme.onHill} />
          <Text style={[styles.label, { color: theme.onHill }]} numberOfLines={1}>
            Connect Instagram
          </Text>
        </>
      )}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    paddingLeft: Spacing.xs + 2,
    paddingRight: Spacing.md,
    borderRadius: Radius.pill,
    maxWidth: 220,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#FFFFFF',
  },
  initialsCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    ...(Type.body as TextStyle),
    fontWeight: '600',
    flexShrink: 1,
  },
});
