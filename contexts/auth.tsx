import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  isSignedIn: boolean;
  /** True when this is an anonymous session (no email attached yet). */
  isAnonymous: boolean;
  isLoading: boolean; // kept for API compat; always false now (seeded synchronously)
  session: Session | null; // raw Supabase session (for later phases)
  /** Start an anonymous session so the user can onboard without signing up. */
  startAnonymous: () => Promise<{ error: string | null }>;
  /**
   * Attach an email/password. On an ANONYMOUS session this upgrades the existing
   * user in place (same uuid), so connected_accounts / instagram_scans rows stay
   * valid. There is nothing to migrate. Falls back to a fresh sign-up otherwise.
   */
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Supabase persists the session under this key in the (synchronous) expo-sqlite
// localStorage shim. Key format mirrors supabase-js:
// `sb-${new URL(url).hostname.split('.')[0]}-auth-token`.
function storageKey(): string {
  return `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
}

// Read the persisted session SYNCHRONOUSLY on first render. This is the crux of
// the native-tab fix: seeding `isSignedIn` correctly up front means the auth
// guard never flips false→true after mount, so the native tab bar mounts on the
// very first commit (mounting it a frame late froze its taps).
function readPersistedSession(): Session | null {
  try {
    const raw = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage?.getItem(
      storageKey(),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.access_token === 'string' ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Real Supabase-backed session, seeded synchronously from persisted storage so
 * the first render already knows the auth state (no async guard flip). We then
 * revalidate via `getSession()` and follow `onAuthStateChange` in the
 * background. We never poll getSession/getUser or refresh manually.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readPersistedSession);

  useEffect(() => {
    let mounted = true;

    // Revalidate/refresh in the background; the synchronous seed already covered
    // the first paint, so a matching result here is a no-op re-render.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    // Track every subsequent change (sign in/out, background refresh) once.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      // Single source of truth: derived from `session`, never tracked separately.
      isSignedIn: !!session,
      isAnonymous: !!session?.user?.is_anonymous,
      isLoading: false,
      session,
      startAnonymous: async () => {
        const { error } = await supabase.auth.signInAnonymously();
        return { error: error ? error.message : null };
      },
      signUp: async (email, password) => {
        // Anonymous → upgrade in place. `updateUser` keeps the SAME user id, so
        // every connected_accounts / instagram_scans row already points at the
        // right user and no data has to be copied anywhere.
        if (session?.user?.is_anonymous) {
          const { error } = await supabase.auth.updateUser({ email, password });
          return { error: error ? error.message : null };
        }
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error ? error.message : null };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? error.message : null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within a SessionProvider');
  return ctx;
}
