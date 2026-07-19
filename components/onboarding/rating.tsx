import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

export type Testimonial = {
  name: string;
  handle?: string;
  quote: string;
};

type Props = {
  headline: string;
  body?: string;
  testimonials: Testimonial[];
};

/**
 * F6 — "Loved by creators" social-proof card. STATIC content only: this
 * deliberately does NOT call any store-review API (expo-store-review is not
 * installed and asking for a review mid-onboarding would be premature anyway).
 * The mascot line is rendered by the driver above this block.
 */
export function Rating({ headline, body, testimonials }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headlineRow}>
        <Stars size={18} />
        <Text style={styles.headline}>{headline}</Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      {testimonials.map((t) => (
        <View key={t.name} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{t.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.who}>
              <Text style={styles.name}>{t.name}</Text>
              {t.handle ? <Text style={styles.handle}>{t.handle}</Text> : null}
            </View>
            <Stars size={13} />
          </View>
          <Text style={styles.quote}>“{t.quote}”</Text>
        </View>
      ))}
    </View>
  );
}

/** Five filled stars — fixed gold so they read the same in light + dark. */
function Stars({ size }: { size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons key={i} name="star" size={size} color="#F2B733" />
      ))}
    </View>
  );
}

const AVATAR = 36;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md },
    headlineRow: { gap: Spacing.sm },
    headline: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      marginBottom: Spacing.xs,
    },
    card: {
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.surface,
    },
    who: { flex: 1 },
    name: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: palette.ink,
    },
    handle: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
    quote: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      lineHeight: 21,
    },
  });
