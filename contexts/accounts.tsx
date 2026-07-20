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
  accountCap,
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
 * Seeding synchronously is not a style preference. `hasAccounts` is a ROUTER
 * GUARD (app/_layout.tsx). Resolving it in an effect would flip the guard a
 * frame after mount, which is exactly what froze the native tab bar before (see
 * the comment block in contexts/auth.tsx). Never make this async.
 *
 * Supabase is the source of truth; localStorage is a mirror that keeps the app
 * usable offline, before the 0003 migration is applied, or if anonymous sign-ins
 * are disabled in the dashboard.
 */

/**
 * What became of an add attempt.
 * - 'ok': accepted (optimistically; persistence continues in the background).
 * - 'needs-auth': refused, the anonymous cap (1) is used up. Logging in
 *   upgrades the user in place and raises the cap to 5, so the UI should
 *   prompt for login. That flow does not exist yet; consumers stub it.
 * - 'limit': refused, the authenticated cap (5) is used up.
 * - 'invalid': the handle normalized to nothing; nothing happened.
 */
export type AddAccountResult = 'ok' | 'needs-auth' | 'limit' | 'invalid';

type AccountsState = {
  accounts: ConnectedAccount[];
  /** The account the header/tabs are currently showing, or null if none. */
  activeAccount: ConnectedAccount | null;
  /** Router guard: owning ≥1 connected account is what grants app access. */
  hasAccounts: boolean;
  /**
   * Why the NEXT add would be refused, or null if it would be allowed. Lets UI
   * gate "add account" entry points without attempting the add.
   */
  addBlocked: 'needs-auth' | 'limit' | null;
  /**
   * Connect an account and make it active. Synchronous: the cap is checked
   * against local state before any write, and on 'ok' the local mirror updates
   * in the same render (the hasAccounts router guard depends on that) while
   * Supabase persistence continues in the background.
   */
  addAccount: (
    handle: string,
    meta?: { displayName?: string; avatarUrl?: string },
  ) => AddAccountResult;
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
  const { session, isAnonymous } = useAuth();
  const uid = session?.user?.id ?? null;

  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() => readAccounts(uid));

  // Re-seed when the user changes (sign in/out, or anonymous → upgraded).
  // On the first render this matches the initializer above, so it's a no-op.
  useEffect(() => {
    setAccounts(readAccounts(uid));
  }, [uid]);

  // Reconcile with Supabase in the background. `null` means we could not reach
  // it. Keep the mirror rather than wiping the user's accounts while offline.
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

  // The database refused an insert on purpose (the 0004 cap policy, or RLS in
  // general), so the optimistic row is a phantom. Repair by reconciling with
  // Supabase rather than blind-filtering: a cap rejection means the user has at
  // least one remote row, and if the local mirror was stale-empty the phantom
  // is the ONLY local row, so removing it outright would flip `hasAccounts` and
  // eject the user through the router guard mid-session.
  const repairRejectedAdd = useCallback(
    (handle: string) => {
      if (!uid) return;
      void listAccounts(uid).then((remote) => {
        if (remote && remote.length > 0) {
          setAccounts(remote);
          writeAccounts(uid, remote);
          return;
        }
        // Could not confirm the remote list. Drop the refused row, but keep an
        // active account and never empty the list on this weaker signal; the
        // mount-time reconcile finishes the job next launch.
        applyLocal((prev) => {
          const next = prev.filter((a) => a.handle !== handle);
          if (next.length === 0) return prev;
          if (!next.some((a) => a.isActive)) next[0] = { ...next[0], isActive: true };
          return next;
        });
      });
    },
    [uid, applyLocal],
  );

  const value = useMemo<AccountsState>(() => {
    const activeAccount = accounts.find((a) => a.isActive) ?? accounts[0] ?? null;
    const cap = accountCap(isAnonymous);
    return {
      accounts,
      activeAccount,
      hasAccounts: accounts.length > 0,
      addBlocked: accounts.length < cap ? null : isAnonymous ? 'needs-auth' : 'limit',

      addAccount: (rawHandle, meta = {}) => {
        const handle = normalizeHandle(rawHandle);
        if (!handle) return 'invalid';

        // Cap check BEFORE the optimistic write, so a blocked add leaves no
        // phantom row anywhere. Re-adding an already-connected handle is always
        // allowed (it updates a row instead of raising the count), mirroring
        // the handle exclusion in the 0004 policy.
        const isReAdd = accounts.some((a) => a.handle === handle);
        if (!isReAdd && accounts.length >= cap) {
          return isAnonymous ? 'needs-auth' : 'limit';
        }

        applyLocal((prev) => [
          // Only one account may be active at a time. The DB enforces the same
          // rule via the connected_accounts_one_active partial unique index.
          { handle, ...meta, isActive: true },
          ...prev.filter((a) => a.handle !== handle).map((a) => ({ ...a, isActive: false })),
        ]);
        if (uid) {
          // Background persistence. 'rejected' means the database refused the
          // row (e.g. the cap, when something raced or bypassed the check
          // above), so the optimistic row must be repaired away. 'unavailable'
          // keeps it, matching the offline-first mirror semantics.
          void addAccountRemote(uid, handle, meta).then((result) => {
            if (result === 'rejected') repairRejectedAdd(handle);
          });
        }
        return 'ok';
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
  }, [accounts, applyLocal, uid, isAnonymous, repairRejectedAdd]);

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}

export function useAccounts(): AccountsState {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error('useAccounts must be used within an AccountsProvider');
  return ctx;
}
