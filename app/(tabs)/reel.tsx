import { AccentPill } from '@/components/accent-pill';
import { playCreateOverlay } from '@/components/create-overlay';
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

      <AccentPill label="Add as Idea" onPress={() => playCreateOverlay()} />
    </ThemedScreen>
  );
}
