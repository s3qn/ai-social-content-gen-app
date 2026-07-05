import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/auth';

// Entry route ("/"). Redirects to the correct group so the app never lands on
// an unmatched (404) route. The Stack.Protected guards still enforce access,
// and this is the anchor, so a guard flip (sign in/out) falls back here and
// re-redirects to the right place.
export default function Index() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? '/home' : '/welcome'} />;
}
