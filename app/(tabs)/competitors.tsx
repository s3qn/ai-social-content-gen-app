import { useRouter } from 'expo-router';

import { AccentPill } from '@/components/accent-pill';
import {
  HeaderTitle,
  PlaceholderCard,
  SectionHeading,
  SettingsGear,
  ThemedScreen,
} from '@/components/themed-screen';
import { NEW_POSTS, PEERS } from '@/constants/mock-screens';

// The Peers tab belongs to Statto (blue — Smart Insights).
export default function CompetitorsScreen() {
  const router = useRouter();
  return (
    <ThemedScreen
      character="statto"
      header={
        <>
          <HeaderTitle title="Peers" />
          <SettingsGear />
        </>
      }>
      <SectionHeading>MY PEERS</SectionHeading>
      {PEERS.map((id) => (
        <PlaceholderCard key={id} height={72} />
      ))}

      <AccentPill label="Add Competitors" onPress={() => router.push('/modal')} />

      <SectionHeading>NEW POSTS</SectionHeading>
      {NEW_POSTS.map((id) => (
        <PlaceholderCard key={id} height={120} />
      ))}
    </ThemedScreen>
  );
}
