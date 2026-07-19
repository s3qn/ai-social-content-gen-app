import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/auth';
import {
  addAccount as addAccountRemote,
  listAccounts,
  removeAccount as removeAccountRemote,
  setActive as setActiveRemote,
  type ConnectedAccount,
} from '@/lib/accounts';
import { normalizeHandle } from '@/lib/handle';

/**
 * The Instagram accounts this user has connected.
 *
 * Structured exactly like contexts/onboarding.tsx: the list is seeded
 * SYNCHRONOUSLY from the expo-sqlite localStorage shim on first render, then
 * reconciled against Supabase in the background.
 *
 * Seeding synchronously is not a style preference — `hasAccounts` is a ROUTER
 * GUARD (app/_layout.tsx). Resolving it in an effect would flip the guard a
 * frame after mount, which is exactly what froze the native tab bar before (see
 * the comment block in contexts/auth.tsx). Never make this async.
 *
 * Supabase is the source of truth; localStorage is a mirror that keeps the app
 * usable offline, before the 0003 migration is applied, or if anonymous sign-ins
 * are disabled in the dashboard.
 */

type AccountsState = {
  accounts: ConnectedAccount[];
  /** The account the header/tabs are currently showing, or null if none. */
  activeAccount: ConnectedAccount | null;
  /** Router guard: owning ≥1 connected account is what grants app access. */
  hasAccounts: boolean;
  /** Connect an account and make it active. Optimistic; persists in background. */
  addAccount: (handle: string, meta?: { displayName?: string; avatarUrl?: string }) => void;
  /** Switch the active account. */
  setActive: (handle: string) => void;
  /** Disconnect an account. */
  removeAccount: (handle: string) => void;
};

const AccountsContext = createContext<AccountsState | null>(null);

const ACCOUNTS_PREFIX = 'app-accounts';

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

// Namespaced per user id, matching contexts/onboarding.tsx. Anonymous users have
// a real uuid, so 'anon' only applies in the brief window before the anonymous
// session exists.
function accountsKey(uid: string | null): string {
  return `${ACCOUNTS_PREFIX}:${uid ?? 'anon'}`;
}

function readAccounts(uid: string | null): ConnectedAccount[] {
  try {
    const raw = storage()?.getItem(accountsKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ConnectedAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(uid: string | null, next: ConnectedAccount[]): void {
  try {
    storage()?.setItem(accountsKey(uid), JSON.stringify(next));
  } catch {
    // best-effort mirror; in-memory state still updates
  }
}

export function AccountsProvider({ children }: { children: ReactNode }) {
  // `session` is seeded synchronously by SessionProvider, so the uid is already
  // known on the first render and the seed below reads the right bucket.
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() => readAccounts(uid));

  // Re-seed when the user changes (sign in/out, or anonymous → upgraded).
  // On the first render this matches the initializer above, so it's a no-op.
  useEffect(() => {
    setAccounts(readAccounts(uid));
  }, [uid]);

  // Reconcile with Supabase in the background. `null` means we could not reach
  // it — keep the mirror rather than wiping the user's accounts while offline.
  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    void listAccounts(uid).then((remote) => {
      if (!mounted || remote === null) return;
      if (remote.length === 0) return; // nothing upstream yet; keep local mirror
      setAccounts(remote);
      writeAccounts(uid, remote);
    });
    return () => {
      mounted = false;
    };
  }, [uid]);

  /** Apply a local change immediately and mirror it to storage. */
  const applyLocal = useCallback(
    (fn: (prev: ConnectedAccount[]) => ConnectedAccount[]) => {
      setAccounts((prev) => {
        const next = fn(prev);
        writeAccounts(uid, next);
        return next;
      });
    },
    [uid],
  );

  const value = useMemo<AccountsState>(() => {
    const activeAccount = accounts.find((a) => a.isActive) ?? accounts[0] ?? null;
    return {
      accounts,
      activeAccount,
      hasAccounts: accounts.length > 0,

      addAccount: (rawHandle, meta = {}) => {
        const handle = normalizeHandle(rawHandle);
        if (!handle) return;
        applyLocal((prev) => [
          // Only one account may be active at a time — the DB enforces the same
          // rule via the connected_accounts_one_active partial unique index.
          { handle, ...meta, isActive: true },
          ...prev.filter((a) => a.handle !== handle).map((a) => ({ ...a, isActive: false })),
        ]);
        if (uid) void addAccountRemote(uid, handle, meta);
      },

      setActive: (rawHandle) => {
        const handle = normalizeHandle(rawHandle);
        applyLocal((prev) => prev.map((a) => ({ ...a, isActive: a.handle === handle })));
        if (uid) void setActiveRemote(uid, handle);
      },

      removeAccount: (rawHandle) => {
        const handle = normalizeHandle(rawHandle);
        applyLocal((prev) => {
          const next = prev.filter((a) => a.handle !== handle);
          // Never leave the user with accounts but no active one.
          if (next.length && !next.some((a) => a.isActive)) next[0] = { ...next[0], isActive: true };
          return next;
        });
        if (uid) void removeAccountRemote(uid, handle);
      },
    };
  }, [accounts, applyLocal, uid]);

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}

export function useAccounts(): AccountsState {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error('useAccounts must be used within an AccountsProvider');
  return ctx;
}
