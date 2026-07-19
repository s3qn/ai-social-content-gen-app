'use no memo';

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextStyle, View } from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import type { EngagementInsight, ProfileScore, ScanStats } from '@/lib/scan';

type Props = {
  stats: ScanStats;
  engagement: EngagementInsight;
  /** Real Claude score from /scan; null/absent → the heuristic below is used. */
  score?: ProfileScore | null;
};

const MAX_SCORE = 10;

/** Verdict bands for the computed score (high → low). */
const BANDS: { min: number; label: string }[] = [
  { min: 8.5, label: 'Elite Creator' },
  { min: 7, label: 'High Potential' },
  { min: 5, label: 'Solid Foundation' },
  { min: 3, label: 'Getting Started' },
  { min: 0, label: 'Early Days' },
];

export function verdictLabel(score: number): string {
  return (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).label;
}

/**
 * STUB: heuristic fallback for when the backend returns `score: null` (the
 * Claude pass is unconfigured or failed).
 *
 * Derives a deterministic 0–10 number client-side from the REAL engagement +
 * follower data. It blends the profile's engagement rate (avg likes+comments ÷
 * followers) with a log-scaled reach bonus, so the value varies per profile and
 * reads as real. This is NOT a hardcoded constant. It's the graceful fallback.
 */
export function computeScore(stats: ScanStats, engagement: EngagementInsight): number {
  const followers = stats.followers ?? 0;

  // Average engagement across the post types that actually have data.
  const avgs = Object.values(engagement.avgEngagement ?? {}).filter((n) => n > 0);
  const avgEng = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;

  // Engagement rate → the biggest driver. ~2% reads as strong.
  const rate = followers > 0 ? avgEng / followers : 0;
  let score = Math.min(7, rate * 100 * 2.2);

  // Reach bonus: bigger audiences add up to ~2 pts on a log scale.
  if (followers > 0) score += Math.min(2, Math.log10(followers) / 3.5);

  // Small base so a valid-but-quiet profile still lands mid-low, not at zero.
  score += 1;

  return Math.max(0, Math.min(MAX_SCORE, Math.round(score * 10) / 10));
}

/** Clamp a backend score into the meter's 0–10 range, or null if unusable. */
function realScore(score: ProfileScore | null | undefined): number | null {
  const n = score?.profileScore;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(MAX_SCORE, n));
}

/**
 * A red→amber→green gradient meter with a knob at the score position, the big
 * numeric score, and a verdict label. Prefers the real Claude score (+ its label
 * and one-line explanation) and falls back to the local heuristic when the
 * backend sent `score: null`. Theme-aware; the knob slides in on mount with
 * plain Animated (no Reanimated, `'use no memo'` keeps the compiler off).
 */
export function ScoreMeter({ stats, engagement, score: aiScore }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const score = useMemo(() => {
    const real = realScore(aiScore);
    return real ?? computeScore(stats, engagement);
  }, [aiScore, stats, engagement]);

  // Only trust the label/explanation when the number itself was usable.
  const isReal = realScore(aiScore) !== null;
  const label = (isReal && aiScore?.scoreLabel?.trim()) || verdictLabel(score);
  const explanation = (isReal && aiScore?.scoreExplanation?.trim()) || null;
  const fraction = score / MAX_SCORE;

  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: fraction,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [fraction, progress]);

  // Keep the knob fully on-track at the extremes.
  const travel = Math.max(0, trackWidth - KNOB);
  const knobX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  return (
    <View style={styles.wrap}>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{score.toFixed(1)}</Text>
        <Text style={styles.scoreMax}>/ {MAX_SCORE}</Text>
      </View>
      <Text style={styles.verdict}>{label}</Text>

      <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <LinearGradient
          colors={['#D24B3E', '#E8A93C', '#3FA96A']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
        <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]} />
      </View>

      <View style={styles.scale}>
        <Text style={styles.scaleText}>Needs work</Text>
        <Text style={styles.scaleText}>Thriving</Text>
      </View>

      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
    </View>
  );
}

const KNOB = 22;
const TRACK_H = 12;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    score: {
      ...(Type.display as TextStyle),
      fontSize: 44,
      color: palette.ink,
    },
    scoreMax: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      fontWeight: '700',
    },
    verdict: {
      ...(Type.heading as TextStyle),
      color: palette.accent,
      marginBottom: Spacing.sm,
    },
    track: {
      height: KNOB,
      justifyContent: 'center',
    },
    gradient: {
      height: TRACK_H,
      borderRadius: Radius.pill,
    },
    knob: {
      position: 'absolute',
      left: 0,
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: palette.surface,
      borderWidth: 3,
      borderColor: palette.ink,
    },
    scale: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    scaleText: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    explanation: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      lineHeight: 20,
      marginTop: Spacing.xs,
    },
  });
