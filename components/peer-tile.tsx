import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { formatCount } from '@/components/peer-card';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { INPUT, RAMPS, themeIndex } from '@/constants/theme-transition';
import { useTheme } from '@/contexts/theme';

const AVATAR = 64;

type PeerTileProps = {
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: number;
  /** One line on why this account is worth studying (suggestions only). */
  why?: string;
  /** Rendered as a filled "track" affordance instead of a chevron. */
  action?: 'track' | 'open';
  onPress?: () => void;
};

/**
 * Grid counterpart of `PeerCard`: the same data as one big rectangle tile,
 * sized by the parent's two-column wrap cell. Untracking has no swipe in the
 * grid on purpose; opening the tile reaches PeerDetail's "Stop tracking".
 *
 * Avatar URLs are signed Instagram CDN links that expire within days, so a
 * missing image is expected rather than an error: it falls back to the initial.
 */
export function PeerTile({
  handle,
  displayName,
  avatarUrl,
  followerCount,
  why,
  action = 'open',
  onPress,
}: PeerTileProps) {
  'use no memo';
  const { scheme, palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { PRIMARY } = RAMPS[scheme];
  const accentStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY) }),
    [scheme],
  );

  const followers = formatCount(followerCount);

  return (
    <HapticPressable
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      onPress={onPress}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>
            {(displayName ?? handle).slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={styles.handle} numberOfLines={1}>
        @{handle}
      </Text>
      {displayName ? (
        <Text style={styles.meta} numberOfLines={1}>
          {displayName}
        </Text>
      ) : null}
      {followers ? <Text style={styles.meta}>{followers} followers</Text> : null}
      {why ? (
        <Text style={styles.why} numberOfLines={2}>
          {why}
        </Text>
      ) : null}

      {action === 'track' ? (
        <Animated.View style={[styles.trackButton, accentStyle]}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Animated.View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={palette.muted} style={styles.open} />
      )}
    </HapticPressable>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    tile: {
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
    },
    pressed: { opacity: 0.6 },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: palette.bg,
      marginBottom: Spacing.xs,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    avatarInitial: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
      fontWeight: '700',
    },
    handle: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
      maxWidth: '100%',
    },
    meta: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
      maxWidth: '100%',
    },
    why: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
      textAlign: 'center',
      maxWidth: '100%',
    },
    trackButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.xs,
    },
    open: {
      marginTop: Spacing.xs,
    },
  });
