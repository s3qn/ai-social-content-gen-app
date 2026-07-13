import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { Segmented } from '@/components/onboarding/segmented';
import { SelectOption } from '@/constants/onboarding-steps';
import { AppPalette, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  headline: string;
  body?: string;
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string) => void;
};

/**
 * A light social-proof interstitial: a headline + optional supporting line and
 * a Yes/No segmented answer. The mascot question is rendered by the driver above
 * this card. Theme-aware via useTheme().
 */
export function Interstitial({ headline, body, options, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <Segmented options={options} value={value} onChange={onChange} />
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md },
    headline: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      marginBottom: Spacing.sm,
    },
  });
