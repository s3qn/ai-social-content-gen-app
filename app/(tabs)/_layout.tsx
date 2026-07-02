import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

// Phase 1: prove a dev build renders native glass tabs.
// Four tabs, exact route names and labels. Icons are SF Symbols on iOS; on
// Android the API falls back to the label (no drawable asset required here).
// No styling, no theme, no manual glass. The OS provides Liquid Glass on iOS 26.
export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="carousel">
        <Label>Carousel</Label>
        <Icon sf="rectangle.stack" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reel">
        <Label>Reel</Label>
        <Icon sf="film" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="brainstorm">
        <Label>Brainstorm</Label>
        <Icon sf="lightbulb" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="competitors">
        <Label>Competitors</Label>
        <Icon sf="person.2" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
