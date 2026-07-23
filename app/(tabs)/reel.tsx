import { AccentPill } from '@/components/accent-pill';
import { playCreateOverlay } from '@/components/create-overlay';
import {
  HeaderTitle,
  PlaceholderCard,
  SectionHeading,
  SettingsGear,
  ThemedScreen,
} from '@/components/themed-screen';
import { TrendingPanel } from '@/components/trending-panel';
import { RELATED } from '@/constants/mock-screens';

// The Trends tab belongs to Spark (yellow: Momentum).
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
      {/* Renders its own GLOBAL TRENDS heading, plus the Biggest/Rising tabs.
          Reads the shared trending cache only: it never triggers a scrape. */}
      <TrendingPanel />

      <SectionHeading>RELATED TO YOU</SectionHeading>
      {RELATED.map((id) => (
        <PlaceholderCard key={id} height={120} />
      ))}

      <AccentPill label="Add as Idea" onPress={() => playCreateOverlay()} />
    </ThemedScreen>
  );
}
