import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import type { ScanStats } from '@/lib/scan';
import { formatCompact } from '@/lib/format';

type Props = {
  /** Real profile stats from the scan (any field may be null). */
  stats: ScanStats;
};

/**
 * Profile header + three real stat tiles (followers / posts / following) from
 * the scan. Avatar + full name render when Instagram exposed them. Big numbers
 * are formatted compactly (104.3M). Theme-aware via useTheme().
 */
export function StatTrio({ stats }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tiles = [
    { key: 'followers', label: 'Followers', value: stats.followers },
    { key: 'posts', label: 'Posts', value: stats.posts },
    { key: 'following', label: 'Following', value: stats.following },
  ];

  return (
    <View style={styles.wrap}>
      {(stats.avatarUrl || stats.fullName) && (
        <View style={styles.header}>
          {stats.avatarUrl ? (
            <Image
              source={{ uri: stats.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(stats.fullName ?? '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {stats.fullName ? <Text style={styles.name}>{stats.fullName}</Text> : null}
        </View>
      )}

      <View style={styles.row}>
        {tiles.map((t, i) => (
          <View key={t.key} style={[styles.tile, i < tiles.length - 1 && styles.tileDivider]}>
            <Text style={styles.value}>{formatCompact(t.value)}</Text>
            <Text style={styles.label}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const AVATAR = 64;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.lg },
    header: { alignItems: 'center', gap: Spacing.sm },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: palette.line,
    },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: {
      ...(Type.heading as TextStyle),
      color: palette.muted,
    },
    name: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.lg,
    },
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    tileDivider: {
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: palette.line,
    },
    value: {
      ...(Type.stat as TextStyle),
      fontSize: 26,
      color: palette.ink,
    },
    label: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
  });
