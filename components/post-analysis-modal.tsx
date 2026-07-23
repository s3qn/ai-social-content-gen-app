import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticPressable } from '@/components/haptic-pressable';
import { SkeletonBlock, useSkeletonSweep } from '@/components/skeleton';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { formatCompact } from '@/lib/format';
import {
  analyzePost,
  type PostAnalysis,
  type PostNumbers,
} from '@/lib/post-analysis';
import type { TrendingPost } from '@/lib/trending';

/**
 * A trending post, opened: live numbers plus a strategist breakdown.
 *
 * Opening is what spends a scrape call and a Claude call server-side, which is
 * why it happens on an explicit tap (same reasoning as peer-detail). The modal
 * seeds itself from the trending cache's copy of the post so the header and
 * stats render instantly, then swaps in the fresh numbers and the analysis
 * when the endpoint answers. The backend caches per shortcode for a day, so
 * re-opening the same post is instant.
 */

/** Copied from trending-panel's relativeAge (deliberately not exported there). */
function relativeAge(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PostAnalysisModal({
  post,
  onClose,
}: {
  post: TrendingPost | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [numbers, setNumbers] = useState<PostNumbers | null>(null);
  const [analysis, setAnalysis] = useState<PostAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [broken, setBroken] = useState(false);

  const shortCode = post?.shortCode ?? null;

  useEffect(() => {
    if (!post || !shortCode) return;
    let mounted = true;
    setNumbers(null);
    setAnalysis(null);
    setFailed(false);
    setBroken(false);
    setLoading(true);
    // Send the cached copy of the post so a failed fresh scrape still answers.
    void analyzePost({
      url: post.url,
      shortCode: post.shortCode,
      caption: post.caption,
      likes: post.likes,
      comments: post.comments,
      views: post.views,
      thumbnailUrl: post.thumbnailUrl ?? undefined,
      ownerUsername: post.ownerUsername ?? undefined,
    }).then((outcome) => {
      if (!mounted) return;
      setLoading(false);
      if (outcome.ok) {
        setNumbers(outcome.post);
        setAnalysis(outcome.analysis);
      } else {
        // Keep the cached numbers on screen; only the breakdown is missing.
        setFailed(true);
      }
    });
    return () => {
      mounted = false;
    };
    // The post object identity changes on every cache read; key on the post.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode]);

  if (!post) return null;

  // Fresh numbers when the endpoint answered, the cached ones meanwhile.
  const likes = numbers?.likes ?? post.likes;
  const comments = numbers?.comments ?? post.comments;
  const views = numbers?.views ?? post.views;
  const thumbnailUrl = numbers?.thumbnailUrl ?? post.thumbnailUrl;
  const age = relativeAge(post.ageHours);
  const showImage = !!thumbnailUrl && !broken;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.grabber} />

        <View style={styles.head}>
          <View style={styles.thumb}>
            {showImage ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                onError={() => setBroken(true)}
              />
            ) : (
              <Ionicons name="image-outline" size={20} color={palette.muted} />
            )}
          </View>
          <View style={styles.headText}>
            <Text style={styles.handle} numberOfLines={1}>
              @{post.ownerUsername ?? 'unknown'}
            </Text>
            {age ? <Text style={styles.muted}>{age}</Text> : null}
          </View>
          <HapticPressable hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={22} color={palette.muted} />
          </HapticPressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.statsRow}>
            <Stat styles={styles} label="Likes" value={formatCompact(likes)} />
            <Stat styles={styles} label="Comments" value={formatCompact(comments)} />
            {views != null ? (
              <Stat styles={styles} label="Views" value={formatCompact(views)} />
            ) : null}
          </View>

          <HapticPressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
            onPress={() => void Linking.openURL(post.url).catch(() => {})}>
            <Text style={styles.openButtonText}>Open on Instagram</Text>
          </HapticPressable>

          {loading ? (
            <AnalysisSkeleton styles={styles} />
          ) : analysis ? (
            <>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>The hook</Text>
                <Text style={styles.blockText}>{analysis.hook.verdict}</Text>
                {analysis.hook.alternatives.map((alt, i) => (
                  <Text key={i} style={styles.quote}>
                    {'“'}
                    {alt}
                    {'”'}
                  </Text>
                ))}
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Who it hits</Text>
                <Text style={styles.blockText}>{analysis.psychology.emotion}</Text>
                <Text style={styles.blockText}>{analysis.psychology.value}</Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Why it gets shared</Text>
                <Text style={styles.blockText}>{analysis.sharability}</Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Search check</Text>
                <Text style={styles.blockText}>{analysis.seo}</Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Do this next</Text>
                {analysis.growthSteps.map((step, i) => (
                  <Text key={i} style={styles.blockText}>
                    {i + 1}. {step}
                  </Text>
                ))}
              </View>
            </>
          ) : failed ? (
            <Text style={styles.muted}>
              We could not analyze this post right now. The numbers above are what we last saw.
            </Text>
          ) : (
            <Text style={styles.muted}>
              Analysis is unavailable right now. The numbers above are live.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Loading state for the analysis: blocks shaped like the stats row and the
 * section blocks below, so the sheet keeps its height when the text lands.
 */
function AnalysisSkeleton({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  'use no memo';
  const progress = useSkeletonSweep();

  return (
    <View
      accessible
      accessibilityLabel="Analyzing this post"
      accessibilityRole="progressbar"
      style={styles.skeletonWrap}>
      <Text style={styles.muted}>Pulling the numbers apart…</Text>
      <View
        style={styles.statsRow}
        accessibilityElementsHidden
        importantForAccessibility="no">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBlock key={i} progress={progress} style={styles.statSkeleton} />
        ))}
      </View>
      <SkeletonBlock progress={progress} style={styles.blockSkeleton} />
      <SkeletonBlock progress={progress} style={styles.blockSkeleton} />
    </View>
  );
}

function Stat({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value || '?'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    backdrop: { flex: 1 },
    sheet: {
      backgroundColor: palette.bg,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      gap: Spacing.md,
      maxHeight: '80%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.line,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headText: { flex: 1 },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    handle: { ...(Type.heading as TextStyle), color: palette.ink, fontWeight: '700' },
    muted: { ...(Type.body as TextStyle), color: palette.muted, fontSize: 13 },
    body: { gap: Spacing.lg, paddingBottom: Spacing.md },
    skeletonWrap: { gap: Spacing.md },
    statSkeleton: { flex: 1, height: 64, borderRadius: Radius.md },
    blockSkeleton: { height: 72, borderRadius: Radius.md },
    statsRow: { flexDirection: 'row', gap: Spacing.md },
    stat: {
      flex: 1,
      backgroundColor: palette.surface,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      padding: Spacing.md,
      gap: 2,
    },
    statValue: { ...(Type.stat as TextStyle), color: palette.ink },
    statLabel: { ...(Type.caption as TextStyle), color: palette.muted },
    openButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
    },
    openButtonText: {
      ...(Type.body as TextStyle),
      color: palette.surface,
      fontWeight: '700',
    },
    pressed: { opacity: 0.7 },
    block: {
      backgroundColor: palette.surface,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    blockTitle: { ...(Type.body as TextStyle), color: palette.ink, fontWeight: '600' },
    blockText: { ...(Type.body as TextStyle), color: palette.muted, fontSize: 13 },
    quote: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      fontSize: 13,
      fontStyle: 'italic',
    },
  });
