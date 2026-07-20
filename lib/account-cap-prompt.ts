import { Alert } from 'react-native';

/**
 * TODO(login-upgrade): stub consumer for the account-cap signals.
 *
 * 'needs-auth' is the signal a real login/upgrade flow will consume: the
 * anonymous cap (1 account) is used up, and logging in upgrades the user in
 * place (same uuid, cap becomes 5). Until that flow exists, this alert is the
 * single place both call sites (account switcher, onboarding finish) route
 * through, so the future flow replaces exactly one function.
 */
export function promptAccountCap(reason: 'needs-auth' | 'limit'): void {
  if (reason === 'needs-auth') {
    Alert.alert(
      'Log in to add more',
      'An anonymous profile can track one Instagram account. Log in to track up to five.',
    );
    return;
  }
  Alert.alert(
    'Account limit reached',
    'You can connect up to five Instagram accounts. Remove one to add another.',
  );
}
