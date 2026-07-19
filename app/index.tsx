import { Redirect } from 'expo-router';

import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';

// Entry route ("/"). Redirects to the correct group so the app never lands on
// an unmatched (404) route. Three states, matching the guards in app/_layout.tsx:
//   no session (anonymous or real) -> /welcome
//   session, no connected account  -> /step  (the onboarding funnel)
//   session + >=1 connected account -> /home
// The gate is CONNECTED ACCOUNTS, not having signed up — an anonymous user with
// one connected account goes straight to /home. Both flags are seeded
// synchronously, so this picks the right destination on the first render (no
// welcome-screen / tab flash).
export default function Index() {
  const { isSignedIn } = useAuth();
  const { hasAccounts } = useAccounts();

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (!hasAccounts) return <Redirect href="/step" />;
  return <Redirect href="/home" />;
}
