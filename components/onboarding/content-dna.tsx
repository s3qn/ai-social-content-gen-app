import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { Chip } from '@/components/onboarding/chip';
import { DnaBar } from '@/components/onboarding/dna-bar';
import { RevealFallback } from '@/components/onboarding/reveal-fallback';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';

type Props = {
  onRescan?: () => void;
};

// STUB: placeholder until backend Claude vibe/themes (F3-real).
// The backend returns `dna: null` for now, so the vibe tags + top themes below
// are fixed placeholder copy. The post-type bar + engagement insight above them
// are REAL scan data — only this block is stubbed.
const STUB_DNA = {
  vibe: ['Aspirational', 'Polished', 'Playful', 'Authentic'],
  topThemes: [
    { label: 'Behind the scenes', weight: 'Frequent' },
    { label: 'Product & showcases', weight: 'Frequent' },
    { label: 'Lifestyle & routine', weight: 'Occasional' },
  ],
};

/**
 * F3 — Content DNA reveal. The post-type DnaBar + engagement insight are REAL
 * scan data; the vibe chips + top themes are stubbed placeholders (STUB_DNA)
 * until the backend Claude analysis lands. Falls back gracefully if the scan
 * result is missing.
 */
export function ContentDna({ onRescan }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { scanResult } = useOnboarding();

  if (!scanResult) return <RevealFallback onRescan={onRescan} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.section}>
        <Text style={styles.eyebrow}>Content Mix</Text>
        <DnaBar
          breakdown={scanResult.postTypeBreakdown}
          engagement={scanResult.engagementInsight}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Your Vibe</Text>
        <View style={styles.chips}>
          {STUB_DNA.vibe.map((v, i) => (
            <Chip key={v} label={v} variant={i === 0 ? 'accent' : 'subtle'} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Top Themes</Text>
        <View style={styles.themes}>
          {STUB_DNA.topThemes.map((t) => (
            <View key={t.label} style={styles.themeRow}>
              <Text style={styles.themeLabel}>{t.label}</Text>
              <Text style={styles.themeWeight}>{t.weight}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          🧬 This is your Content DNA — the mix, vibe and themes that make your profile yours.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.xl },
    section: { gap: Spacing.sm },
    eyebrow: {
      ...(Type.eyebrow as TextStyle),
      color: palette.muted,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    themes: {
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.line,
    },
    themeLabel: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: palette.ink,
    },
    themeWeight: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    callout: {
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.lg,
    },
    calloutText: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      lineHeight: 22,
    },
  });
