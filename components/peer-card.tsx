import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { INPUT, RAMPS, themeIndex } from '@/constants/theme-transition';
import { useTheme } from '@/contexts/theme';

const AVATAR = 44;

/** Compact follower counts: 1240000 reads as 1.2M, not a wall of digits. */
export function formatCount(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

type PeerCardProps = {
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
 * One peer row, used for both tracked peers and suggestions.
 *
 * Avatar URLs are signed Instagram CDN links that expire within days, so a
 * missing image is expected rather than an error: it falls back to the initial.
 */
export function PeerCard({
  handle,
  displayName,
  avatarUrl,
  followerCount,
  why,
  action = 'open',
  onPress,
}: PeerCardProps) {
  'use no memo';
  const { scheme, palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { PRIMARY } = RAMPS[scheme];
  const accentStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY) }),
    [scheme],
  );

  const followers = formatCount(followerCount);
  const subtitle = [displayName, followers ? `${followers} followers` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <HapticPressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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

      <View style={styles.body}>
        <Text style={styles.handle} numberOfLines={1}>
          @{handle}
        </Text>
        {why ? (
          <Text style={styles.meta} numberOfLines={2}>
            {why}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.meta} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action === 'track' ? (
        <Animated.View style={[styles.trackButton, accentStyle]}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Animated.View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      )}
    </HapticPressable>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    pressed: { opacity: 0.6 },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: palette.bg,
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
    body: { flex: 1, gap: 2 },
    handle: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontWeight: '600',
    },
    meta: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    trackButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
