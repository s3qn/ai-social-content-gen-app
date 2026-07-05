import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthState = {
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * In-memory mock session. No persistence, no network — flipping `isSignedIn`
 * is the only source of truth the route guards read. Swap the body for real
 * auth later without changing consumers.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);

  const value = useMemo<AuthState>(
    () => ({
      isSignedIn,
      signIn: () => setIsSignedIn(true),
      signOut: () => setIsSignedIn(false),
    }),
    [isSignedIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within a SessionProvider');
  return ctx;
}
