import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCount } from '@/components/peer-card';
import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import { peerScanCached } from '@/lib/peer-scan-cache';
import type { TrackedPeer } from '@/lib/peers';
import type { ScanResult } from '@/lib/scan';

/**
 * A tracked peer, opened.
 *
 * THIS is the only place a peer scrape can start, and only when the shared
 * snapshot is missing or older than PEER_SCAN_TTL_MS. Suggesting and tracking
 * are free; opening is what can spend Apify credits, which is why it happens on
 * an explicit tap rather than on tab open.
 */
export function PeerDetail({
  peer,
  onClose,
  onUntrack,
}: {
  peer: TrackedPeer | null;
  onClose: () => void;
  onUntrack: (handle: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [failed, setFailed] = useState(false);

  const handle = peer?.handle ?? null;

  useEffect(() => {
    if (!handle) return;
    let mounted = true;
    setScan(null);
    setFailed(false);
    // Serves the shared cache when fresh; only a stale/missing snapshot scrapes.
    peerScanCached(handle)
      .then((result) => {
        if (mounted) setScan(result);
      })
      .catch(() => {
        // A scrape can fail for reasons we cannot fix here (private account,
        // Apify hiccup). Show what we already know rather than an error screen.
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [handle]);

  if (!peer) return null;

  const stats = scan?.stats;
  const best = scan?.engagementInsight?.bestType;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.grabber} />

        <View style={styles.head}>
          {peer.avatarUrl ? (
            <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{peer.handle.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headText}>
            <Text style={styles.handle} numberOfLines={1}>
              @{peer.handle}
            </Text>
            {peer.displayName ? (
              <Text style={styles.muted} numberOfLines={1}>
                {peer.displayName}
              </Text>
            ) : null}
          </View>
          <HapticPressable hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={22} color={palette.muted} />
          </HapticPressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {scan ? (
            <>
              <View style={styles.statsRow}>
                <Stat
                  styles={styles}
                  label="Followers"
                  value={formatCount(stats?.followers ?? undefined)}
                />
                <Stat styles={styles} label="Posts" value={formatCount(stats?.posts ?? undefined)} />
                <Stat
                  styles={styles}
                  label="Best format"
                  value={best ? best[0].toUpperCase() + best.slice(1) : ''}
                />
              </View>

              {scan.dna?.topThemes?.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>What they post about</Text>
                  <Text style={styles.muted}>{scan.dna.topThemes.join(' · ')}</Text>
                </View>
              ) : null}

              {scan.postTypeBreakdown?.percentages ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Format mix</Text>
                  <Text style={styles.muted}>
                    {Object.entries(scan.postTypeBreakdown.percentages)
                      .map(([type, pct]) => `${type} ${pct}%`)
                      .join(' · ')}
                  </Text>
                </View>
              ) : null}
            </>
          ) : failed ? (
            <Text style={styles.muted}>
              We could not refresh this profile right now. Try again in a moment.
            </Text>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.muted} />
              <Text style={styles.muted}>Pulling their latest numbers…</Text>
            </View>
          )}
        </ScrollView>

        <HapticPressable
          style={({ pressed }) => [styles.untrack, pressed && styles.pressed]}
          onPress={() => {
            onUntrack(peer.handle);
            onClose();
          }}>
          <Text style={styles.untrackText}>Stop tracking</Text>
        </HapticPressable>
      </View>
    </Modal>
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
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
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
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.surface },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    avatarInitial: { ...(Type.body as TextStyle), color: palette.ink, fontWeight: '700' },
    handle: { ...(Type.heading as TextStyle), color: palette.ink, fontWeight: '700' },
    muted: { ...(Type.body as TextStyle), color: palette.muted, fontSize: 13 },
    body: { gap: Spacing.lg, paddingBottom: Spacing.md },
    loading: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
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
    block: { gap: Spacing.xs },
    blockTitle: { ...(Type.body as TextStyle), color: palette.ink, fontWeight: '600' },
    untrack: { alignItems: 'center', paddingVertical: Spacing.md },
    untrackText: { ...(Type.body as TextStyle), color: palette.warn },
    pressed: { opacity: 0.6 },
  });
