import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

const FONT_FAMILY = 'Poppins_600SemiBold';

/**
 * The onboarding question header: a swappable mascot slot + a speech bubble.
 *
 * Only Virlo has real art today (components/virlo-wave.tsx, which is positioned
 * absolutely for the welcome screen), so this uses a simple placeholder avatar
 * slot. Pass a `mascot` node later to drop in real per-step art without touching
 * the callers. Heading uses Poppins (already a dep, see create-overlay.tsx);
 * until it loads the system font renders so text is never invisible.
 */
export function MascotBubble({ text, mascot }: { text: string; mascot?: ReactNode }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });

  return (
    <View style={styles.row}>
      <View style={styles.mascotSlot}>{mascot ?? <Text style={styles.mascotGlyph}>🌱</Text>}</View>
      <View style={styles.bubble}>
        <Text style={[styles.text, fontsLoaded ? { fontFamily: FONT_FAMILY } : null]}>{text}</Text>
      </View>
    </View>
  );
}

const MASCOT_SIZE = 56;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    mascotSlot: {
      width: MASCOT_SIZE,
      height: MASCOT_SIZE,
      borderRadius: MASCOT_SIZE / 2,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotGlyph: {
      fontSize: 28,
    },
    bubble: {
      flex: 1,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    text: {
      // Poppins-weighted question copy; falls back to a bold system font.
      fontSize: 19,
      fontWeight: '600',
      lineHeight: 26,
      letterSpacing: -0.2,
      color: palette.ink,
    } as TextStyle,
  });
