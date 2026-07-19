import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { useOnHillInk } from '@/components/themed-screen';
import { inkIndexFor, RAMPS, themeIndex } from '@/constants/theme-transition';
import { useTheme } from '@/contexts/theme';
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

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

/**
 * The account-being-analyzed pill that sits on the colored hill header.
 * Visual mock only: `onPress` is expected to toggle local screen state.
 */
export function InstagramPill({ theme, account, onPress }: InstagramPillProps) {
  'use no memo';
  const initials = account ? account.displayName.slice(0, 1).toUpperCase() : '';
  const { scheme } = useTheme();
  const { PILL_SCRIMS } = RAMPS[scheme];
  const ink = useOnHillInk();
  // A faint white scrim vanishes on a light hill, so each character supplies one
  // tuned to its own hill lightness. Stepped on the same threshold as the ink, so
  // the chip and the glyphs on it always belong to the same character.
  const scrimStyle = useAnimatedStyle(
    () => ({ backgroundColor: PILL_SCRIMS[inkIndexFor(themeIndex.value)] }),
    [scheme],
  );

  return (
    <HapticPressable
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      onPress={onPress}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      {account ? (
        <>
          {account.avatarUrl ? (
            <Image source={{ uri: account.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.initialsCircle]}>
              <Text style={[styles.initials, { color: theme.primary }]}>{initials}</Text>
            </View>
          )}
          <Animated.Text style={[styles.label, ink]} numberOfLines={1}>
            @{account.handle}
          </Animated.Text>
        </>
      ) : (
        <>
          <AnimatedIonicons name="logo-instagram" size={18} style={ink} />
          <Animated.Text style={[styles.label, ink]} numberOfLines={1}>
            Connect Instagram
          </Animated.Text>
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
    // The scrim is a sibling layer (its color animates), so clip it to the pill.
    overflow: 'hidden',
  },
  scrim: {
    borderRadius: Radius.pill,
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
