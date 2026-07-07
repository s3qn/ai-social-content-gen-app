import { useRouter } from 'expo-router';

import { AccentPill } from '@/components/accent-pill';
import {
  HeaderTitle,
  PlaceholderCard,
  SectionHeading,
  SettingsGear,
  ThemedScreen,
} from '@/components/themed-screen';
import { GLOBAL_TRENDS, RELATED } from '@/constants/mock-screens';

// The Trends tab belongs to Spark (yellow — Momentum).
export default function ReelScreen() {
  const router = useRouter();
  return (
    <ThemedScreen
      character="spark"
      header={
        <>
          <HeaderTitle title="Trends" />
          <SettingsGear />
        </>
      }>
      <SectionHeading>GLOBAL TRENDS</SectionHeading>
      {GLOBAL_TRENDS.map((id) => (
        <PlaceholderCard key={id} height={72} />
      ))}

      <SectionHeading>RELATED TO YOU</SectionHeading>
      {RELATED.map((id) => (
        <PlaceholderCard key={id} height={120} />
      ))}

      <AccentPill label="Add as Idea" onPress={() => router.push('/modal')} />
    </ThemedScreen>
  );
}
