import { router } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Single consumer for every cap signal in the app, so the wording and the
 * upgrade route stay identical wherever a limit is hit.
 *
 * Two subjects share one prompt because they share one cause: an anonymous
 * profile is limited (1 connected account, 3 tracked peers), and creating an
 * account upgrades the user IN PLACE (same uuid) and raises both caps. That is
 * why 'needs-auth' offers /sign-up rather than explaining a dead end.
 *
 * Callers must close any open Modal BEFORE calling this: the needs-auth path
 * navigates, and a push underneath an open modal lands behind it.
 */

type CapSubject = 'account' | 'peer';
type CapReason = 'needs-auth' | 'limit';

const COPY: Record<CapSubject, Record<CapReason, { title: string; body: string }>> = {
  account: {
    'needs-auth': {
      title: 'Log in to add more',
      body: 'An anonymous profile can track one Instagram account. Create an account to track up to five; the one you connected stays with you.',
    },
    limit: {
      title: 'Account limit reached',
      body: 'You can connect up to five Instagram accounts. Remove one to add another.',
    },
  },
  peer: {
    'needs-auth': {
      title: 'Log in to track more',
      body: 'An anonymous profile can track three peers. Create an account to track up to ten; the ones you added stay with you.',
    },
    limit: {
      title: 'Peer limit reached',
      body: 'You can track up to ten peers. Remove one to add another.',
    },
  },
};

export function promptCap(subject: CapSubject, reason: CapReason): void {
  const { title, body } = COPY[subject][reason];

  if (reason === 'needs-auth') {
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create account', onPress: () => router.push('/sign-up') },
    ]);
    return;
  }
  Alert.alert(title, body);
}
