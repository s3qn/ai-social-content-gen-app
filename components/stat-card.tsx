import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { CharacterTheme } from '@/constants/characters';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

type StatCardProps = {
  theme: CharacterTheme;
  caption: string;
  value: string;
};

/**
 * A single stat card. Promoted from the inline version in the Home screen so
 * every character's screen can share it. Neutral-on-white by design; a slim
 * top accent bar carries the character color.
 */
export function StatCard({ theme, caption, value }: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  value: {
    ...(Type.stat as TextStyle),
    color: Palette.ink,
    marginTop: Spacing.xs,
  },
  caption: {
    ...(Type.caption as TextStyle),
    color: Palette.muted,
  },
});
