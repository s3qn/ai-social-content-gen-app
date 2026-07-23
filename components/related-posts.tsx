import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';

import { CopyStrategyButton } from '@/components/copy-strategy-button';
import { HapticPressable } from '@/components/haptic-pressable';
import { SkeletonBlock, useSkeletonSweep } from '@/components/skeleton';
import { useViewMode } from '@/components/view-toggle';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { formatCompact } from '@/lib/format';
import { fetchRelated, readCachedRelated, type RelatedPost } from '@/lib/related';

/**
 * Posts from the user's own niche, rendered under the RELATED TO YOU heading on
 * the Trends tab. Unlike the trending panel above it, this list IS personal: it
 * asks the scan service for the caller's niche/subtopic and the service caches
 * the answer 6h per niche, so the call stays cheap even so.
 *
 * The grid/rows preference is read from the SAME storage key as the trending
 * panel ('trending-view-mode') on purpose, with no toggle button of its own, so
 * one flip up there keeps the whole page consistent.
 *
 * Row and tile layouts mirror trending-panel.tsx but are written here rather
 * than imported: the two panels evolve independently and neither should be able
 * to reshape the other.
 */

const THUMB = 56;
const CAPTION_LINES = 2;

function relativeAge(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Captions routinely carry thirty hashtags, so collapse them to one line. */
function captionSnippet(caption: string): string {
  return (caption || '').replace(/\s+/g, ' ').trim();
}

function Row({
  post,
  onPress,
  styles,
  palette,
}: {
  post: RelatedPost;
  onPress: (post: RelatedPost) => void;
  styles: Styles;
  palette: AppPalette;
}) {
  // Instagram thumbnails are signed CDN links that expire in days. A dead image
  // must still leave a tappable row behind, so track failure instead of hiding.
  const [broken, setBroken] = useState(false);
  const uri = post.thumbnailUrl;
  const showImage = !!uri && !broken;

  return (
    <HapticPressable
      accessibilityRole="link"
      accessibilityLabel={`Open @${post.ownerUsername ?? 'this post'} on Instagram`}
      onPress={() => onPress(post)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.thumb}>
        {showImage ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onError={() => setBroken(true)}
          />
        ) : (
          <Ionicons name="image-outline" size={THUMB * 0.4} color={palette.muted} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.handle} numberOfLines={1}>
            @{post.ownerUsername ?? 'unknown'}
          </Text>
          <Text style={styles.age}>{relativeAge(post.ageHours)}</Text>
        </View>

        {captionSnippet(post.caption) ? (
          <Text style={styles.caption} numberOfLines={CAPTION_LINES}>
            {captionSnippet(post.caption)}
          </Text>
        ) : null}

        <View style={styles.statRow}>
          <Ionicons name="heart" size={12} color={palette.muted} />
          <Text style={styles.stat}>{formatCompact(post.likes)}</Text>
          <Ionicons name="chatbubble" size={12} color={palette.muted} />
          <Text style={styles.stat}>{formatCompact(post.comments)}</Text>
          {post.views != null ? (
            <>
              <Ionicons name="play" size={12} color={palette.muted} />
              <Text style={styles.stat}>{formatCompact(post.views)}</Text>
            </>
          ) : null}
        </View>

        <CopyStrategyButton compact />
      </View>

      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </HapticPressable>
  );
}

/**
 * One post as a big 4:5 rectangle tile for the grid view: cover image, bottom
 * scrim with the handle and stats overlaid, age in a small dark pill top-right.
 */
function Tile({
  post,
  onPress,
  styles,
  palette,
}: {
  post: RelatedPost;
  onPress: (post: RelatedPost) => void;
  styles: Styles;
  palette: AppPalette;
}) {
  const [broken, setBroken] = useState(false);
  const uri = post.thumbnailUrl;
  const showImage = !!uri && !broken;
  const age = relativeAge(post.ageHours);

  return (
    <HapticPressable
      accessibilityRole="link"
      accessibilityLabel={`Open @${post.ownerUsername ?? 'this post'} on Instagram`}
      onPress={() => onPress(post)}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onError={() => setBroken(true)}
        />
      ) : (
        <View style={styles.tileFallback}>
          <Ionicons name="image-outline" size={36} color={palette.muted} />
        </View>
      )}

      {age ? (
        <View style={styles.agePill}>
          <Text style={styles.agePillText}>{age}</Text>
        </View>
      ) : null}

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={styles.scrim}>
        <Text style={styles.tileHandle} numberOfLines={1}>
          @{post.ownerUsername ?? 'unknown'}
        </Text>
        <View style={styles.tileStatRow}>
          <Ionicons name="heart" size={12} color="#FFFFFF" />
          <Text style={styles.tileStat}>{formatCompact(post.likes)}</Text>
          {post.views != null ? (
            <>
              <Ionicons name="play" size={12} color="#FFFFFF" />
              <Text style={styles.tileStat}>{formatCompact(post.views)}</Text>
            </>
          ) : null}
        </View>
      </LinearGradient>
    </HapticPressable>
  );
}

/** Loading state shaped like `Row` so the real rows land in place. */
function RelatedRowSkeleton({ count, styles }: { count: number; styles: Styles }) {
  'use no memo';
  const progress = useSkeletonSweep();

  return (
    <View
      style={styles.list}
      accessible
      accessibilityLabel="Loading related posts"
      accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={styles.row}
          accessibilityElementsHidden
          importantForAccessibility="no">
          <SkeletonBlock progress={progress} style={styles.thumbSkeleton} />
          <View style={styles.body}>
            <SkeletonBlock progress={progress} style={styles.lineWide} />
            <SkeletonBlock progress={progress} style={styles.lineNarrow} />
            <SkeletonBlock progress={progress} style={styles.lineStat} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Grid-mode loading state: tile-shaped blocks in the same horizontal rail. */
function RelatedTileSkeleton({ count, styles }: { count: number; styles: Styles }) {
  'use no memo';
  const progress = useSkeletonSweep();

  return (
    <View
      style={styles.rail}
      accessible
      accessibilityLabel="Loading related posts"
      accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} progress={progress} style={styles.tileSkeleton} />
      ))}
    </View>
  );
}

export function RelatedPosts({
  niche,
  subtopic,
  onOpenPost,
}: {
  niche: string | null;
  subtopic: string | null;
  onOpenPost?: (post: RelatedPost) => void;
}) {
  const { palette } = useTheme();
  // Explicit pixel tile size: the tiles' children are all absolutely
  // positioned, and percentage width + aspectRatio inside a wrap row lays out
  // at height 0 here, which blanks the whole grid. 2.2 per screen so a partial
  // third tile advertises the sideways scroll.
  const { width: screenW } = useWindowDimensions();
  const tileW = Math.floor((screenW - Spacing.xl * 2 - Spacing.sm) / 2.2);
  const tileH = Math.round(tileW * 1.25);
  const styles = useMemo(() => makeStyles(palette, tileW, tileH), [palette, tileW, tileH]);

  const [posts, setPosts] = useState<RelatedPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Same storage key as the trending panel on purpose: one preference for the
  // whole page. The toggle button lives up there, not here.
  const [mode] = useViewMode('trending-view-mode');

  useEffect(() => {
    let mounted = true;

    const cached = readCachedRelated(niche, subtopic);
    if (cached) {
      setPosts(cached);
      setLoaded(true);
      return;
    }

    setPosts([]);
    setLoaded(false);
    void (async () => {
      const next = await fetchRelated(niche, subtopic);
      if (!mounted) return;
      setPosts(next);
      setLoaded(true);
    })();

    return () => {
      mounted = false;
    };
  }, [niche, subtopic]);

  const open = (post: RelatedPost) => {
    if (onOpenPost) onOpenPost(post);
    else void Linking.openURL(post.url).catch(() => {});
  };

  if (!loaded) {
    return mode === 'grid' ? (
      <RelatedTileSkeleton count={4} styles={styles} />
    ) : (
      <RelatedRowSkeleton count={3} styles={styles} />
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing related right now. Check back later.</Text>
      </View>
    );
  }

  return mode === 'grid' ? (
    // ONE row, scrolled sideways, so this section stays reachable without deep
    // vertical scrolling past the trending grid above it.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}>
      {posts.map((post) => (
        <View key={post.shortCode} style={styles.railCell}>
          <Tile post={post} onPress={open} styles={styles} palette={palette} />
          <CopyStrategyButton />
        </View>
      ))}
    </ScrollView>
  ) : (
    <View style={styles.list}>
      {posts.map((post) => (
        <Row key={post.shortCode} post={post} onPress={open} styles={styles} palette={palette} />
      ))}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (palette: AppPalette, tileW: number, tileH: number) =>
  StyleSheet.create({
    rail: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    railCell: {
      gap: Spacing.xs,
    },
    // 4:5 portrait rectangles sized in pixels from the window width so two
    // columns fill the content width.
    tile: {
      width: tileW,
      height: tileH,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      backgroundColor: palette.surface,
      overflow: 'hidden',
    },
    tilePressed: { opacity: 0.75 },
    tileFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agePill: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    agePillText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    scrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.sm,
      gap: 2,
    },
    tileHandle: {
      ...(Type.body as TextStyle),
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    tileStatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    tileStat: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
      marginRight: Spacing.sm,
    },
    tileSkeleton: {
      width: tileW,
      height: tileH,
      borderRadius: Radius.lg,
    },
    list: { gap: Spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      padding: Spacing.md,
    },
    rowPressed: { opacity: 0.7 },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
    },
    thumbSkeleton: {
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.md,
    },
    lineWide: {
      height: 12,
      width: '60%',
      borderRadius: 6,
    },
    lineNarrow: {
      height: 10,
      width: '85%',
      borderRadius: 5,
    },
    lineStat: {
      height: 10,
      width: '40%',
      borderRadius: 5,
      marginTop: 2,
    },
    body: { flex: 1, gap: 2 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    handle: {
      ...(Type.body as TextStyle),
      flexShrink: 1,
      fontWeight: '700',
      color: palette.ink,
    },
    age: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
    caption: {
      ...(Type.body as TextStyle),
      fontSize: 13,
      color: palette.muted,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: 2,
    },
    stat: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      fontWeight: '600',
      color: palette.muted,
      marginRight: Spacing.sm,
    },
    empty: {
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
    },
    emptyText: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      textAlign: 'center',
    },
  });
