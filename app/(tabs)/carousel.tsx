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
import { Fonts, Spacing, TAB_BAR_CLEARANCE, Type } from '@/constants/theme';

// The Home tab belongs to Virlo (green — Viral Growth).
const theme = CHARACTERS.virlo;

export default function CarouselScreen() {
  // Instagram connection is a visual mock: tap the pill to toggle connect state.
  const [account, setAccount] = useState<typeof MOCK_INSTAGRAM | null>(MOCK_INSTAGRAM);
  const toggleConnect = () => setAccount((prev) => (prev ? null : MOCK_INSTAGRAM));

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundTint }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
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

        <HillFooter theme={theme} />
      </ScrollView>
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
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
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
