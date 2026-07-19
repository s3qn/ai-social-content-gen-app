import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';

// Entry route ("/"). Redirects to the correct group so the app never lands on
// an unmatched (404) route. Three states, matching the guards in app/_layout.tsx:
//   not signed in                 -> /welcome
//   signed in, not onboarded      -> /step  (the onboarding funnel)
//   signed in, onboarded          -> /home
// Both flags are seeded synchronously, so this picks the right destination on
// the first render (no welcome-screen / tab flash).
export default function Index() {
  const { isSignedIn } = useAuth();
  const { hasOnboarded } = useOnboarding();

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (!hasOnboarded) return <Redirect href="/step" />;
  return <Redirect href="/home" />;
}
