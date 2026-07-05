import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';

import { ChatFab } from '@/components/chat-fab';
import { HapticPressable } from '@/components/haptic-pressable';
import { HillFooter } from '@/components/hill-footer';
import { HillHeader } from '@/components/hill-header';
import { InstagramPill } from '@/components/instagram-pill';
import { PlanCalendar } from '@/components/plan-calendar';
import { StatCard } from '@/components/stat-card';
import { CHARACTERS } from '@/constants/characters';
import { HOME_STATS, MARKED_DAYS, MOCK_INSTAGRAM } from '@/constants/mock-account';
import { Fonts, Spacing, Type } from '@/constants/theme';

// The Home tab belongs to Virlo (green — Viral Growth).
const theme = CHARACTERS.virlo;

// Matches HillFooter's default height; the scroll body reserves this much bottom
// padding so its last row can scroll clear of the pinned footer hills.
const FOOTER_HEIGHT = 150;

export default function CarouselScreen() {
  // Instagram connection is a visual mock: tap the pill to toggle connect state.
  const [account, setAccount] = useState<typeof MOCK_INSTAGRAM | null>(MOCK_INSTAGRAM);
  const toggleConnect = () => setAccount((prev) => (prev ? null : MOCK_INSTAGRAM));

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundTint }]}>
      {/* Pinned header — stays fixed while the body scrolls. */}
      <HillHeader theme={theme}>
        <InstagramPill theme={theme} account={account} onPress={toggleConnect} />
        <HapticPressable
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => {
            // TODO: settings nav later; sign-out moves to Settings.
          }}>
          <Ionicons name="settings-outline" size={22} color={theme.onHill} />
        </HapticPressable>
      </HillHeader>

      {/* Only this middle content scrolls, between the pinned header and hills. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <Text style={styles.sectionHeading}>STATS</Text>
          <View style={styles.statsRow}>
            {HOME_STATS.map((s) => (
              <StatCard key={s.caption} theme={theme} caption={s.caption} value={s.value} />
            ))}
          </View>

          <Text style={styles.sectionHeading}>My Plan</Text>
          <PlanCalendar theme={theme} markedDays={MARKED_DAYS} />
        </View>
      </ScrollView>

      {/* Pinned footer hills — decorative overlay anchored to the bottom. */}
      <View style={styles.footerFixed} pointerEvents="none">
        <HillFooter theme={theme} height={FOOTER_HEIGHT} />
      </View>

      <ChatFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: FOOTER_HEIGHT + Spacing.xl,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionHeading: {
    ...(Type.display as TextStyle),
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
