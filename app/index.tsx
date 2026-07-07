import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/auth';

// Entry route ("/"). Redirects to the correct group so the app never lands on
// an unmatched (404) route. `isSignedIn` is seeded synchronously, so this picks
// the right destination on the first render (no welcome-screen flash).
export default function Index() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? '/home' : '/welcome'} />;
}
