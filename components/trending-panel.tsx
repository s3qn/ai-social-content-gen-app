import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { SectionHeading } from '@/components/themed-screen';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { formatCompact } from '@/lib/format';
import {
  biggest,
  EMPTY_BATCH,
  fetchTrending,
  isStale,
  requestRefresh,
  rising,
  type TrendingBatch,
  type TrendingPost,
} from '@/lib/trending';

/**
 * What is trending on Instagram right now, as two lists over ONE shared scrape.
 *
 *   Biggest  raw engagement. Skews to mega-accounts, by design.
 *   Rising   engagement per hour since posting, over posts that cleared the
 *            backend's age and engagement floors.
 *
 * This panel only ever READS the global cache. It never scrapes: trending is
 * identical for every user, so one scheduled scrape serves everybody, and a
 * per-user or per-open scrape would multiply Apify credits by the user count for
 * the same data. When the cached batch is past its window the panel says so to
 * the scan service and carries on rendering what it already has.
 *
 * All state is local to this component. It reads no context beyond the theme and
 * touches no provider, so it cannot re-render the root navigator or disturb the
 * native tab bar's guard timing.
 */

type Tab = 'biggest' | 'rising';

const THUMB = 56;
const ROW_LIMIT = 20;
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
  styles,
  palette,
}: {
  post: TrendingPost;
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
      onPress={() => void Linking.openURL(post.url).catch(() => {})}
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
      </View>

      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </HapticPressable>
  );
}

export function TrendingPanel() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [batch, setBatch] = useState<TrendingBatch>(EMPTY_BATCH);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('biggest');
  const mounted = useRef(true);

  // Re-read the cache every time the tab gains focus, not just on mount. That is
  // one cheap select, and it is how a batch written by a refresh we kicked off
  // earlier actually reaches the screen.
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;

      void (async () => {
        const next = await fetchTrending();
        if (!mounted.current) return;
        setBatch(next);
        setLoaded(true);
        // Ask the service to refresh, but keep showing what we have. The service
        // re-checks the age itself and collapses concurrent asks into one run.
        if (isStale(next.fetchedAt)) requestRefresh();
      })();

      return () => {
        mounted.current = false;
      };
    }, []),
  );

  const rows = useMemo(
    () => (tab === 'biggest' ? biggest(batch.posts, ROW_LIMIT) : rising(batch.posts, ROW_LIMIT)),
    [tab, batch.posts],
  );

  return (
    <>
      <SectionHeading>GLOBAL TRENDS</SectionHeading>

      <View style={styles.tabs}>
        {(['biggest', 'rising'] as const).map((key) => (
          <HapticPressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {key === 'biggest' ? 'Biggest' : 'Rising'}
            </Text>
          </HapticPressable>
        ))}
      </View>

      {rows.length ? (
        <View style={styles.list}>
          {rows.map((post) => (
            <Row key={post.shortCode} post={post} styles={styles} palette={palette} />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {!loaded
              ? 'Loading trends…'
              : tab === 'rising'
                ? 'Nothing is taking off right now. Check back after the next refresh.'
                : 'No trends yet. The first scan is running, check back shortly.'}
          </Text>
        </View>
      )}
    </>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      gap: Spacing.xs,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.pill,
      padding: 3,
      marginBottom: Spacing.md,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
    },
    tabActive: { backgroundColor: palette.accent },
    tabLabel: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.muted,
    },
    tabLabelActive: { color: palette.surface },
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
