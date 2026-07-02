import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatFab } from '@/components/chat-fab';
import { HapticPressable } from '@/components/haptic-pressable';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

// Working title only. Change this one constant to rebrand the wordmark.
const APP_NAME = 'Larch';

// Allowance for the native tab bar height so scroll content clears it.
// Added on top of the bottom safe-area inset (home indicator).
const TAB_BAR_ALLOWANCE = 64;

// --- Mock data (hardcoded, UI-only. No backend, no auth, no network) ---

type Connection = {
  id: string;
  network: string;
  connected: boolean;
  detail: string;
};

const CONNECTIONS: Connection[] = [
  { id: 'instagram', network: 'Instagram', connected: true, detail: '@mock.creator' },
  { id: 'facebook', network: 'Facebook', connected: false, detail: 'Connect to enable posting' },
];

type Stat = {
  caption: string;
  value: string;
};

const STATS: Stat[] = [
  { caption: 'Posts generated', value: '128' },
  { caption: 'This week', value: '6' },
];

type RecentItem = {
  id: string;
  title: string;
  meta: string;
};

const RECENT: RecentItem[] = [
  { id: 'r1', title: 'Five hooks that stop the scroll', meta: '2 hours ago, 7 slides' },
  { id: 'r2', title: 'Behind the scenes of a launch week', meta: 'Yesterday, 5 slides' },
  { id: 'r3', title: 'A simple framework for daily posts', meta: '2 days ago, 8 slides' },
  { id: 'r4', title: 'Myths about growing an audience', meta: '4 days ago, 6 slides' },
  { id: 'r5', title: 'What I changed after 100 posts', meta: 'Last week, 10 slides' },
];

// --- Local components ---

function StatusRow({ item, isLast }: { item: Connection; isLast: boolean }) {
  const dotColor = item.connected ? Palette.accent : Palette.warn;
  return (
    <View style={[styles.statusRow, isLast && styles.statusRowLast]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusNetwork}>{item.network}</Text>
      <Text style={styles.statusDetail} numberOfLines={1}>
        {item.detail}
      </Text>
    </View>
  );
}

function StatCard({ item }: { item: Stat }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.caption}>{item.caption}</Text>
    </View>
  );
}

function RecentRow({ item }: { item: RecentItem }) {
  return (
    <HapticPressable
      style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
      onPress={() => {
        // TODO: open item, later phase
      }}>
      <View style={styles.recentText}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.recentMeta} numberOfLines={1}>
          {item.meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Palette.muted} />
    </HapticPressable>
  );
}

// --- Screen ---

export default function CarouselScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>{APP_NAME}</Text>
          <HapticPressable
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => {
              // TODO: settings nav later
            }}>
            <Ionicons name="settings-outline" size={22} color={Palette.ink} />
          </HapticPressable>
        </View>

        {/* Status strip (signature element) */}
        <View style={styles.statusStrip}>
          {CONNECTIONS.map((c, i) => (
            <StatusRow key={c.id} item={c} isLast={i === CONNECTIONS.length - 1} />
          ))}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <StatCard key={s.caption} item={s} />
          ))}
        </View>

        {/* Primary action */}
        <HapticPressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={() => {
            // TODO: generation flow is a later phase
          }}>
          <Ionicons name="add" size={20} color={Palette.surface} />
          <Text style={styles.primaryLabel}>New carousel</Text>
        </HapticPressable>

        {/* Recent list (tab body) */}
        <Text style={styles.eyebrow}>Recent</Text>
        <View style={styles.recentList}>
          {RECENT.map((r) => (
            <RecentRow key={r.id} item={r} />
          ))}
        </View>
      </ScrollView>
      <ChatFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    ...(Type.display as TextStyle),
    color: Palette.ink,
  },

  // Status strip
  statusStrip: {
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomColor: Palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusRowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  statusNetwork: {
    ...(Type.body as TextStyle),
    color: Palette.ink,
    fontWeight: '600',
    width: 88,
  },
  statusDetail: {
    ...(Type.body as TextStyle),
    color: Palette.muted,
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statValue: {
    ...(Type.stat as TextStyle),
    color: Palette.ink,
  },
  caption: {
    ...(Type.caption as TextStyle),
    color: Palette.muted,
  },

  // Primary action
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    // The one permitted soft shadow, on the primary action only.
    shadowColor: Palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryLabel: {
    ...(Type.body as TextStyle),
    color: Palette.surface,
    fontWeight: '600',
  },

  // Recent list
  eyebrow: {
    ...(Type.eyebrow as TextStyle),
    color: Palette.muted,
    marginBottom: -Spacing.md,
  },
  recentList: {
    gap: Spacing.md,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  recentText: {
    flex: 1,
    gap: Spacing.xs,
  },
  recentTitle: {
    ...(Type.body as TextStyle),
    color: Palette.ink,
    fontWeight: '600',
  },
  recentMeta: {
    ...(Type.body as TextStyle),
    color: Palette.muted,
    fontSize: 13,
  },

  pressed: {
    opacity: 0.6,
  },
});
