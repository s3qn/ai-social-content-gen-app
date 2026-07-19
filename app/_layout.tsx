import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';
import 'react-native-reanimated';

import { CreateFab } from '@/components/create-fab';
import { CreateOverlay } from '@/components/create-overlay';
import { ScreenSwirl } from '@/components/screen-swirl';
import { WaitingSwirl } from '@/components/waiting-swirl';
import { AccountsProvider, useAccounts } from '@/contexts/accounts';
import { SessionProvider, useAuth } from '@/contexts/auth';
import { OnboardingProvider } from '@/contexts/onboarding';
import { ThemeProvider, useTheme } from '@/contexts/theme';

export const unstable_settings = {
  anchor: 'index',
};

// The navigator is memoized on two BOOLEANS (`hasSession`, `hasAccounts`) —
// never on the auth/accounts context objects themselves. Supabase emits a few
// session updates at startup (INITIAL_SESSION, token refresh), and the accounts
// context re-creates its value whenever the list is reconciled; both change the
// context object without changing these flags. Without this memo each of those
// would re-render the Stack and re-sync the native tab bar, which is exactly the
// kind of churn that leaves its taps frozen. Keyed on the two primitives, the
// tab subtree stays put unless the user actually gains/loses a session or
// connects/removes their last account.
//
// DO NOT widen this memo to pass objects/context values — that reintroduces the
// native-tab freeze.
const AuthedStack = memo(function AuthedStack({
  hasSession,
  hasAccounts,
}: {
  hasSession: boolean;
  hasAccounts: boolean;
}) {
  return (
    <Stack>
      <Stack.Screen name="index" />

      {/* The real gate is CONNECTED ACCOUNTS, not having signed up. Signing up
          with an email stays optional — it exists to sync and to hold more than
          one account.

          Note this is guarded on `hasSession` alone, NOT on `!hasAccounts`:
          Stack.Protected UNREGISTERS its screens when the guard is false, so
          gating the funnel on "has no accounts" would make `/step` unroutable
          exactly when we need to push it — adding a second account from the
          switcher, and the Settings "Replay onboarding" row. Which group a user
          LANDS on is decided by the redirect in app/index.tsx; this only decides
          what exists to navigate to.

          Both flags are seeded synchronously (the auth session and the
          localStorage accounts mirror), so the tab guard below is already
          correct on the first paint and never flips a frame after mount. */}
      <Stack.Protected guard={hasSession}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={hasSession && hasAccounts}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack.Protected>

      <Stack.Protected guard={!hasSession}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
});

// Must be a child of SessionProvider AND AccountsProvider so it can read both.
// `isSignedIn` (contexts/auth.tsx) and `hasAccounts` (contexts/accounts.tsx) are
// BOTH seeded synchronously, so they're already correct on the first render —
// the guards never flip after mount, and the native tab bar mounts on the first
// commit. Never resolve either flag asynchronously / in an effect.
function RootNavigator() {
  const { isSignedIn } = useAuth();
  const { hasAccounts } = useAccounts();
  return <AuthedStack hasSession={isSignedIn} hasAccounts={hasAccounts} />;
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
        {/* AccountsProvider reads the session (for the per-user namespace), and
            RootNavigator reads both — so it nests inside SessionProvider and
            outside the navigator. */}
        <AccountsProvider>
          <OnboardingProvider>
            <RootNavigator />
          </OnboardingProvider>
        </AccountsProvider>
      </SessionProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScreenSwirl />
      <WaitingSwirl />
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
