import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { CreateFab } from '@/components/create-fab';
import { ScreenSwirl } from '@/components/screen-swirl';
import { SessionProvider, useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'index',
};

// Must be a child of SessionProvider so the guards can read auth state.
function RootNavigator() {
  const { isSignedIn, isLoading } = useAuth();

  // Hold on the native splash (render nothing) until the persisted session
  // resolves, so signed-in users don't see a flash of the welcome screen on
  // cold start before the guards settle.
  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Screen name="index" />

      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Create' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
      <StatusBar style="dark" />
      <ScreenSwirl />
      <CreateFab />
    </ThemeProvider>
  );
}
