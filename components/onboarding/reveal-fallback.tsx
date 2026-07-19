import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { BlackButton } from '@/components/black-button';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  /** Jump back to the scan step to re-run the fetch. */
  onRescan?: () => void;
};

/**
 * Graceful fallback for the reveal steps when the scan result is missing (e.g.
 * storage cleared, or the step was reached out of order). Never crashes, offers
 * a one-tap way back to the scan.
 */
export function RevealFallback({ onRescan }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={40} color={palette.muted} />
      <Text style={styles.title}>We couldn’t load your results</Text>
      <Text style={styles.body}>
        Your profile scan isn’t available. Head back and run it again to see your summary.
      </Text>
      {onRescan ? (
        <View style={styles.button}>
          <BlackButton label="Back to scan" onPress={onRescan} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xxl,
    },
    title: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
      textAlign: 'center',
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
    },
    button: { alignSelf: 'stretch', marginTop: Spacing.sm },
  });
