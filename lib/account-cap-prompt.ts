import { router } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Single consumer for the account-cap signals; both call sites (account
 * switcher, onboarding finish) route through here.
 *
 * 'needs-auth': the anonymous cap (1 account) is used up. Creating an account
 * upgrades the user in place (same uuid, cap becomes 5), so offer the /sign-up
 * screen, which is routable for anonymous users via the (auth) guard in
 * app/_layout.tsx.
 */
export function promptAccountCap(reason: 'needs-auth' | 'limit'): void {
  if (reason === 'needs-auth') {
    Alert.alert(
      'Log in to add more',
      'An anonymous profile can track one Instagram account. Create an account to track up to five; the one you connected stays with you.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create account', onPress: () => router.push('/sign-up') },
      ],
    );
    return;
  }
  Alert.alert(
    'Account limit reached',
    'You can connect up to five Instagram accounts. Remove one to add another.',
  );
}
