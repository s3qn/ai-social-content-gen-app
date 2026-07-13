import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  body?: string;
  icon?: IoniconName;
};

/**
 * A simple call-to-action card: an accent badge + supporting copy. The action
 * itself is the driver's footer button (labelled by the step's `buttonLabel`).
 * Theme-aware via useTheme().
 */
export function CtaCard({ body, icon }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name={icon ?? 'sparkles'} size={30} color={palette.surface} />
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const BADGE = 64;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.xl,
    },
    badge: {
      width: BADGE,
      height: BADGE,
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      ...(Type.body as TextStyle),
      textAlign: 'center',
      color: palette.muted,
      paddingHorizontal: Spacing.lg,
    },
  });
