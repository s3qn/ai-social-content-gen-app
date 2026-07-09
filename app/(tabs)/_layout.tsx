import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/contexts/theme';

// Native OS tab bar (Liquid Glass on iOS 26 dev builds; renders in Expo Go too).
// Relabelled Home/Peers/Ideas/Trends; route files unchanged. Icon tint follows
// the active theme (updates as a prop change — the bar is not remounted, so the
// native-tab-freeze fix is unaffected).
export default function TabLayout() {
  const { palette } = useTheme();
  return (
    <NativeTabs
      tintColor={palette.tabIcon}
      iconColor={{ default: palette.tabIconMuted, selected: palette.tabIcon }}>
      <NativeTabs.Trigger name="home">
        <Label>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="competitors">
        <Label>Peers</Label>
        <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="brainstorm">
        <Label>Ideas</Label>
        <Icon sf={{ default: 'lightbulb', selected: 'lightbulb.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reel">
        <Label>Trends</Label>
        <Icon sf={{ default: 'flame', selected: 'flame.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
