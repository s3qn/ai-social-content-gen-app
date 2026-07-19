import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { Chip } from '@/components/onboarding/chip';
import { DnaBar } from '@/components/onboarding/dna-bar';
import { RevealFallback } from '@/components/onboarding/reveal-fallback';
import { TopPosts } from '@/components/onboarding/top-posts';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';
import type { TopPost } from '@/lib/scan';

type Props = {
  onRescan?: () => void;
};

// STUB: fallback for when the backend's Claude pass is unavailable.
// `/scan` returns `dna: null` whenever the AI analysis is unconfigured or fails,
// and these fixed placeholders stand in for the vibe tags + top themes. The
// post-type bar + engagement insight above them are always REAL scan data.
const STUB_DNA = {
  vibe: ['Aspirational', 'Polished', 'Playful', 'Authentic'],
  topThemes: [
    { label: 'Behind the scenes', weight: 'Frequent' },
    { label: 'Product & showcases', weight: 'Frequent' },
    { label: 'Lifestyle & routine', weight: 'Occasional' },
  ],
};

/**
 * Claude returns the vibe as one short phrase ("Warm, polished and playful").
 * Split it into chips so real data lands in the row the stub designed for,
 * falling back to the whole phrase as a single chip.
 */
function vibeChips(vibe: string): string[] {
  const parts = vibe
    .split(/,|\/|&|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return (parts.length ? parts : [vibe.trim()]).slice(0, 4);
}

/**
 * Backstop only: the backend already caps at TOP_POSTS_LIMIT (12). Kept so a
 * hand-edited or future payload can't render an unbounded rail.
 */
const MAX_TILES = 12;

/**
 * Keep only posts we can actually link to. `topPosts` is optional on ScanResult:
 * a result cached before the field existed (7-day Supabase cache, or a payload
 * rehydrated from local storage) simply has none, and must degrade to "no
 * section" rather than render blanks.
 */
function usableTopPosts(raw: unknown): TopPost[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is TopPost =>
        !!p && typeof p === 'object' && typeof (p as TopPost).shortCode === 'string',
    )
    .filter((p) => !!p.shortCode.trim())
    .slice(0, MAX_TILES);
}

/**
 * F3, Content DNA reveal. The post-type DnaBar + engagement insight are always
 * REAL scan data. The vibe chips + top themes come from the backend's Claude
 * analysis (`scanResult.dna`) when present, and fall back to STUB_DNA when it's
 * null. Top posts are a sideways rail of thumbnails shown under the mix they
 * evidence, and are omitted entirely when the scan has none. Falls back to
 * RevealFallback if there's no scan result at all.
 */
export function ContentDna({ onRescan }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { scanResult } = useOnboarding();

  // Guard the shape as well as presence: a cached result from an older backend
  // (or a partial payload) must degrade to the stub rather than render blanks.
  const vibeRaw = scanResult?.dna?.vibe;
  const themesRaw = scanResult?.dna?.topThemes;
  const realVibe = typeof vibeRaw === 'string' && vibeRaw.trim() ? vibeRaw : null;
  const realThemes = Array.isArray(themesRaw)
    ? themesRaw.filter((t) => typeof t === 'string' && !!t.trim())
    : [];

  const vibe = useMemo(() => (realVibe ? vibeChips(realVibe) : STUB_DNA.vibe), [realVibe]);
  const topPosts = useMemo(() => usableTopPosts(scanResult?.topPosts), [scanResult?.topPosts]);

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

      {/* Straight after the mix: the posts are the evidence for the percentages
          above them. Omitted entirely when the scan produced none, so the step
          falls back to its original layout. */}
      {topPosts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Your Top Posts</Text>
          <TopPosts posts={topPosts} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Your Vibe</Text>
        <View style={styles.chips}>
          {vibe.map((v, i) => (
            <Chip key={v} label={v} variant={i === 0 ? 'accent' : 'subtle'} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Top Themes</Text>
        <View style={styles.themes}>
          {realThemes.length
            ? realThemes.map((t) => (
                <View key={t} style={styles.themeRow}>
                  <Text style={styles.themeLabel}>{t}</Text>
                </View>
              ))
            : STUB_DNA.topThemes.map((t) => (
                <View key={t.label} style={styles.themeRow}>
                  <Text style={styles.themeLabel}>{t.label}</Text>
                  <Text style={styles.themeWeight}>{t.weight}</Text>
                </View>
              ))}
        </View>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          🧬 This is your Content DNA: the mix, vibe and themes that make your profile yours.
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
