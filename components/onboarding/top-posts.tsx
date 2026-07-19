import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View, useWindowDimensions } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { formatCompact } from '@/lib/format';
import type { TopPost } from '@/lib/scan';

/**
 * The account's best posts as a sideways-scrolling rail of square thumbnails,
 * each overlaid with its headline counts and linking out to Instagram.
 *
 * Replaces an earlier WebView-embed version: real embeds read as a third-party
 * widget bolted into the step, and each one cost a WebView, which capped us at
 * three posts. Plain images are cheap, so the whole rail is shown.
 */

type Props = {
  posts: TopPost[];
};

// Mirrors SHORTCODE_RE in backend/instagram_scan/analyze.py. Validated server
// side already, but this value is scraped and goes into a URL we hand to the OS.
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,30}$/;

// The step's ScrollView pads content by Spacing.xl each side (step.tsx `body`).
const CONTENT_PAD = Spacing.xl;
const GAP = Spacing.sm;
// Deliberately fractional: the third tile is cut off by the screen edge, which
// is what tells you the rail scrolls sideways.
const PER_SCREEN = 2.2;
// 4:5 portrait, matching Instagram's own post ratio.
const ASPECT = 1.25;

/** Darkens the foot of the tile so white counts stay legible on pale photos. */
const SCRIM = ['transparent', 'rgba(0,0,0,0.78)'] as const;

function postUrl(shortCode: string): string | null {
  return SHORTCODE_RE.test(shortCode)
    ? `https://www.instagram.com/p/${shortCode}/`
    : null;
}

/** Small badge marking reels and carousels, the way Instagram's own grid does. */
function typeIcon(type: TopPost['type']): keyof typeof Ionicons.glyphMap | null {
  if (type === 'reel') return 'play';
  if (type === 'carousel') return 'copy';
  return null;
}

function Tile({ post, width, height }: { post: TopPost; width: number; height: number }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  // Instagram's thumbnail links are signed and expire; a dead image must still
  // leave a tappable tile behind, so track failure instead of unmounting.
  const [broken, setBroken] = useState(false);

  const url = postUrl(post.shortCode);
  const uri = post.thumbnailUrl;
  const showImage = !!uri && !broken;
  const badge = typeIcon(post.type);

  // Reels lead with plays; stills have no view count, so they lead with likes.
  const primary =
    post.views != null
      ? { icon: 'play' as const, value: post.views }
      : { icon: 'heart' as const, value: post.likes };
  const secondary =
    post.views != null
      ? { icon: 'heart' as const, value: post.likes }
      : { icon: 'chatbubble' as const, value: post.comments };

  return (
    <HapticPressable
      // A post with an unusable shortcode has nowhere to go, so show it inert.
      disabled={!url}
      onPress={() => {
        if (url) void Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={`Open this ${post.type} on Instagram`}
      style={({ pressed }) => [styles.tile, { width, height }, pressed && styles.tilePressed]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onError={() => setBroken(true)}
        />
      ) : (
        // Expired or missing image: keep the tile, its counts and its link.
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Ionicons name="image-outline" size={width * 0.34} color={palette.muted} />
        </View>
      )}

      {badge ? (
        <View style={styles.badge}>
          <Ionicons name={badge} size={12} color="#fff" />
        </View>
      ) : null}

      {/* One figure per full-width row. They previously shared a single row and
          could be silently clipped to a leading digit, which read as a wrong
          number rather than a layout fault. Nothing here truncates. */}
      <LinearGradient colors={SCRIM} style={styles.scrim} pointerEvents="none">
        <View style={styles.statRow}>
          <Ionicons name={primary.icon} size={13} color="#fff" />
          <Text style={styles.statText}>{formatCompact(primary.value)}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name={secondary.icon} size={13} color="#fff" />
          <Text style={styles.statText}>{formatCompact(secondary.value)}</Text>
        </View>
      </LinearGradient>
    </HapticPressable>
  );
}

export function TopPosts({ posts }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { width } = useWindowDimensions();

  if (!posts.length) return null;

  const tileWidth = Math.floor((width - CONTENT_PAD * 2 - GAP) / PER_SCREEN);
  const tileHeight = Math.round(tileWidth * ASPECT);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleed to the screen edges so the last tile can scroll fully clear,
      // while the first still lines up with the section heading above it.
      style={styles.rail}
      contentContainerStyle={styles.railContent}>
      {posts.map((p) => (
        <Tile key={p.shortCode} post={p} width={tileWidth} height={tileHeight} />
      ))}
    </ScrollView>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    rail: {
      marginHorizontal: -CONTENT_PAD,
    },
    railContent: {
      paddingHorizontal: CONTENT_PAD,
      gap: GAP,
    },
    tile: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    tilePressed: {
      opacity: 0.75,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: Spacing.xs,
      right: Spacing.xs,
      width: 20,
      height: 20,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    scrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      gap: 2,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    statText: {
      ...(Type.body as TextStyle),
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
  });
