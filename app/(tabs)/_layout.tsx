import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Palette } from '@/constants/theme';

// JS tab bar (React Navigation, via expo-router's <Tabs>). We used the native
// tab bar (unstable-native-tabs) but it's alpha and its native tab-switching
// doesn't function in Expo Go — the bar renders yet taps never fire. JS tabs
// work reliably in Expo Go, our required runtime. Same route names / labels /
// tint as before; icons mapped from SF Symbols to Ionicons.
export default function TabLayout() {
  'use no memo';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.tabIcon,
        tabBarInactiveTintColor: Palette.tabIconMuted,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="competitors"
        options={{
          title: 'Peers',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="brainstorm"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bulb' : 'bulb-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reel"
        options={{
          title: 'Trends',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
