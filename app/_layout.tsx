import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';
import 'react-native-reanimated';

import { CreateFab } from '@/components/create-fab';
import { ScreenSwirl } from '@/components/screen-swirl';
import { SessionProvider, useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'index',
};

// The navigator is memoized on the `isSignedIn` BOOLEAN, not the whole auth
// value. Supabase emits a few session updates at startup (INITIAL_SESSION,
// token refresh) that change the context object without changing sign-in state;
// without this memo those would re-render the Stack and re-sync the native tab
// bar, which is exactly the kind of churn that leaves its taps frozen. Keyed on
// the boolean, the tab subtree stays put unless the user actually signs in/out.
const AuthedStack = memo(function AuthedStack({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <Stack>
      <Stack.Screen name="index" />

      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Create' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
});

// Must be a child of SessionProvider so it can read auth state. `isSignedIn` is
// seeded synchronously (see contexts/auth.tsx), so it's already correct on the
// first render — the guard never flips after mount, and the native tab bar
// mounts on the first commit.
function RootNavigator() {
  const { isSignedIn } = useAuth();
  return <AuthedStack isSignedIn={isSignedIn} />;
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
