import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InstagramPill } from '@/components/instagram-pill';
import { PlanCalendar } from '@/components/plan-calendar';
import { StatCard } from '@/components/stat-card';
import { SectionHeading, SettingsGear, ThemedScreen } from '@/components/themed-screen';
import { charactersFor } from '@/constants/characters';
import { HOME_STATS, MARKED_DAYS, MOCK_INSTAGRAM } from '@/constants/mock-account';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

// The Home tab belongs to Virlo (green — Viral Growth).
export default function HomeScreen() {
  const { scheme } = useTheme();
  // Character theme (drives the InstagramPill hue) follows light/dark.
  const theme = charactersFor(scheme).virlo;
  // Instagram connection is a visual mock: tap the pill to toggle connect state.
  const [account, setAccount] = useState<typeof MOCK_INSTAGRAM | null>(MOCK_INSTAGRAM);
  const toggleConnect = () => setAccount((prev) => (prev ? null : MOCK_INSTAGRAM));

  return (
    <ThemedScreen
      character="virlo"
      header={
        <>
          <InstagramPill theme={theme} account={account} onPress={toggleConnect} />
          {/* Virlo's hill is light lime in light mode, so the gear takes dark ink. */}
          <SettingsGear color={theme.onHill} />
        </>
      }>
      <SectionHeading>STATS</SectionHeading>
      <View style={styles.statsRow}>
        {HOME_STATS.map((s) => (
          <StatCard key={s.caption} caption={s.caption} value={s.value} />
        ))}
      </View>

      <SectionHeading>My Plan</SectionHeading>
      <PlanCalendar markedDays={MARKED_DAYS} />
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
