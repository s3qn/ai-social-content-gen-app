import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/theme';

// Native OS tab bar (Liquid Glass on iOS 26 dev builds; renders in Expo Go too).
// Relabelled Home/Peers/Ideas/Trends; route files unchanged. Icons tinted #838E60.
export default function TabLayout() {
  // React Compiler freezes this repo's interactive components (see GlowButton);
  // NativeTabs feeds its Trigger/Icon/Label children in as config, which the
  // compiler's memoization can break — opt this host out so taps register.
  'use no memo';
  return (
    <NativeTabs
      tintColor={Palette.tabIcon}
      iconColor={{ default: Palette.tabIconMuted, selected: Palette.tabIcon }}>
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
