import {
  HeaderTitle,
  PlaceholderCard,
  SectionHeading,
  SettingsGear,
  ThemedScreen,
} from '@/components/themed-screen';
import { BRAINSTORMS, IDEAS } from '@/constants/mock-screens';

// The Ideas tab belongs to Enga (purple: Engagement).
export default function BrainstormScreen() {
  return (
    <ThemedScreen
      character="enga"
      header={
        <>
          <HeaderTitle title="Ideas" />
          <SettingsGear />
        </>
      }>
      <SectionHeading>IDEAS</SectionHeading>
      {IDEAS.map((id) => (
        <PlaceholderCard key={id} height={72} />
      ))}

      <SectionHeading>BRAINSTORM</SectionHeading>
      {BRAINSTORMS.map((id) => (
        <PlaceholderCard key={id} height={120} />
      ))}
    </ThemedScreen>
  );
}
