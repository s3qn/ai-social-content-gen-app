import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';
import 'react-native-reanimated';

import { CreateFab } from '@/components/create-fab';
import { CreateOverlay } from '@/components/create-overlay';
import { ScreenSwirl } from '@/components/screen-swirl';
import { SessionProvider, useAuth } from '@/contexts/auth';
import { ThemeProvider, useTheme } from '@/contexts/theme';

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

// Reads the resolved scheme (seeded synchronously by ThemeProvider, so the first
// paint is already correct — no light→dark flash) and drives React Navigation's
// theme + the system status-bar style off it. The animated character surfaces
// select their dark/light color ramps reactively from the same `scheme`, so a
// theme switch recolors the whole app without remounting the navigator (which
// would refreeze the native tab bar / reset navigation state).
function ThemedRoot() {
  const { scheme } = useTheme();
  return (
    <NavThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScreenSwirl />
      <CreateFab />
      <CreateOverlay />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
