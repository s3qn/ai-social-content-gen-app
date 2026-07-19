import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountSwitcher } from '@/components/account-switcher';
import { InstagramPill } from '@/components/instagram-pill';
import { PlanCalendar } from '@/components/plan-calendar';
import { StatCard } from '@/components/stat-card';
import { SectionHeading, SettingsGear, ThemedScreen } from '@/components/themed-screen';
import { charactersFor } from '@/constants/characters';
import { HOME_STATS, MARKED_DAYS } from '@/constants/mock-account';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/contexts/accounts';
import { useTheme } from '@/contexts/theme';

// The Home tab belongs to Virlo (green: Viral Growth).
export default function HomeScreen() {
  const { scheme } = useTheme();
  // Character theme (drives the InstagramPill hue) follows light/dark.
  const theme = charactersFor(scheme).virlo;
  // The real connected account the user onboarded. Owning one is what let them
  // reach this screen at all (see the guards in app/_layout.tsx), so it is
  // normally non-null. The pill still handles null defensively.
  const { activeAccount } = useAccounts();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <ThemedScreen
      character="virlo"
      header={
        <>
          <InstagramPill
            theme={theme}
            account={activeAccount}
            onPress={() => setSwitcherOpen(true)}
          />
          <SettingsGear />
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

      <AccountSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
