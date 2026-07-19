import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';
import 'react-native-reanimated';

import { CreateFab } from '@/components/create-fab';
import { CreateOverlay } from '@/components/create-overlay';
import { ScreenSwirl } from '@/components/screen-swirl';
import { SessionProvider, useAuth } from '@/contexts/auth';
import { OnboardingProvider, useOnboarding } from '@/contexts/onboarding';
import { ThemeProvider, useTheme } from '@/contexts/theme';

export const unstable_settings = {
  anchor: 'index',
};

// The navigator is memoized on two BOOLEANS (`isSignedIn`, `hasOnboarded`) —
// never on the auth/onboarding context objects themselves. Supabase emits a few
// session updates at startup (INITIAL_SESSION, token refresh), and the
// onboarding context re-creates its value on every answer written during the
// funnel; both change the context object without changing these flags. Without
// this memo each of those would re-render the Stack and re-sync the native tab
// bar, which is exactly the kind of churn that leaves its taps frozen. Keyed on
// the two primitives, the tab subtree stays put unless the user actually signs
// in/out or finishes (or replays) onboarding.
//
// DO NOT widen this memo to pass objects/context values — that reintroduces the
// native-tab freeze.
const AuthedStack = memo(function AuthedStack({
  isSignedIn,
  hasOnboarded,
}: {
  isSignedIn: boolean;
  hasOnboarded: boolean;
}) {
  return (
    <Stack>
      <Stack.Screen name="index" />

      {/* F6 — the real gate. A signed-in user who hasn't finished the funnel can
          ONLY see the onboarding group; once `hasOnboarded` is true the tabs +
          settings take over. Both flags are seeded synchronously (auth session +
          the localStorage onboarding flag), so this is already correct on the
          first paint and never flips a frame after mount. */}
      <Stack.Protected guard={isSignedIn && !hasOnboarded}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && hasOnboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
});

// Must be a child of SessionProvider AND OnboardingProvider so it can read both.
// `isSignedIn` (contexts/auth.tsx) and `hasOnboarded` (contexts/onboarding.tsx)
// are BOTH seeded synchronously, so they're already correct on the first render
// — the guards never flip after mount, and the native tab bar mounts on the
// first commit. Never resolve either flag asynchronously / in an effect.
function RootNavigator() {
  const { isSignedIn } = useAuth();
  const { hasOnboarded } = useOnboarding();
  return <AuthedStack isSignedIn={isSignedIn} hasOnboarded={hasOnboarded} />;
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
        <OnboardingProvider>
          <RootNavigator />
        </OnboardingProvider>
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
