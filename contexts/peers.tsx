import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAccounts } from '@/contexts/accounts';
import { useAuth } from '@/contexts/auth';
import {
  listTrackedPeers,
  peerCap,
  trackPeer as trackPeerRemote,
  untrackPeer as untrackPeerRemote,
  type TrackedPeer,
} from '@/lib/peers';
import { normalizeHandle } from '@/lib/handle';

/**
 * The role models ("peers") this user tracks.
 *
 * Scoped to the ACTIVE CONNECTED ACCOUNT, not to the login: a fitness account
 * and a food account under one user are different workspaces and need different
 * role models. Every read, write and cap check is per (user, account), matching
 * the composite key in supabase/migrations/0006_peers_per_account.sql.
 *
 * Structured exactly like contexts/accounts.tsx: seeded SYNCHRONOUSLY from the
 * expo-sqlite localStorage shim on first render, then reconciled against
 * Supabase in the background. Unlike `hasAccounts` this feeds no router guard,
 * so the synchronous seed is insurance rather than load-bearing, but it also
 * means the Peers tab never flashes empty on a warm start.
 *
 * Supabase is the source of truth; localStorage is a mirror that keeps the tab
 * readable offline and before supabase/migrations/0005_peers.sql is applied.
 */

/**
 * What became of a track attempt. Same shape as AddAccountResult in
 * contexts/accounts.tsx so both caps behave identically at call sites.
 * - 'needs-auth': the anonymous cap (3) is used up; creating an account raises
 *   it to 10, so the UI should prompt for the upgrade.
 * - 'limit': the authenticated cap (10) is used up.
 */
export type AddPeerResult = 'ok' | 'needs-auth' | 'limit' | 'invalid';

type PeersState = {
  peers: TrackedPeer[];
  hasPeers: boolean;
  /** Why the NEXT track would be refused, or null if it would be allowed. */
  addBlocked: 'needs-auth' | 'limit' | null;
  /**
   * Track a peer. Synchronous: the cap is checked against local state before any
   * write, so a refused track leaves no optimistic row anywhere.
   */
  addPeer: (
    handle: string,
    meta?: { displayName?: string; avatarUrl?: string; followerCount?: number },
  ) => AddPeerResult;
  /** Stop tracking a peer. */
  removePeer: (handle: string) => void;
};

const PeersContext = createContext<PeersState | null>(null);

const PEERS_PREFIX = 'app-peers';

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

// Namespaced by user AND by connected account, so switching account swaps the
// mirror rather than blending two accounts' peers together.
function peersKey(uid: string | null, accountHandle: string): string {
  return `${PEERS_PREFIX}:${uid ?? 'anon'}:${accountHandle || 'none'}`;
}

function readPeers(uid: string | null, accountHandle: string): TrackedPeer[] {
  try {
    const raw = storage()?.getItem(peersKey(uid, accountHandle));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TrackedPeer[]) : [];
  } catch {
    return [];
  }
}

function writePeers(uid: string | null, accountHandle: string, next: TrackedPeer[]): void {
  try {
    storage()?.setItem(peersKey(uid, accountHandle), JSON.stringify(next));
  } catch {
    // best-effort mirror; in-memory state still updates
  }
}

export function PeersProvider({ children }: { children: ReactNode }) {
  const { session, isAnonymous } = useAuth();
  const { activeAccount } = useAccounts();
  const uid = session?.user?.id ?? null;
  // '' while no account is connected yet. Peers are meaningless then, and the
  // empty string is also what the 0006 backfill leaves on orphaned rows.
  const accountHandle = activeAccount?.handle ?? '';

  const [peers, setPeers] = useState<TrackedPeer[]>(() => readPeers(uid, accountHandle));

  // Re-seed when the user OR the selected account changes. The uid does not
  // change on an anonymous upgrade, so upgrading keeps every account's peers and
  // simply raises the cap.
  useEffect(() => {
    setPeers(readPeers(uid, accountHandle));
  }, [uid, accountHandle]);

  // Reconcile with Supabase in the background. `null` means unreachable, so keep
  // the mirror rather than blanking the tab while offline.
  useEffect(() => {
    if (!uid || !accountHandle) return;
    let mounted = true;
    void listTrackedPeers(uid, accountHandle).then((remote) => {
      if (!mounted || remote === null) return;
      setPeers(remote);
      writePeers(uid, accountHandle, remote);
    });
    return () => {
      mounted = false;
    };
  }, [uid, accountHandle]);

  const applyLocal = useCallback(
    (fn: (prev: TrackedPeer[]) => TrackedPeer[]) => {
      setPeers((prev) => {
        const next = fn(prev);
        writePeers(uid, accountHandle, next);
        return next;
      });
    },
    [uid, accountHandle],
  );

  // The database refused an insert on purpose (the 0005 cap policy, or RLS in
  // general), so the optimistic row is a phantom. Repair by reconciling rather
  // than blind-filtering, matching the accounts context: a re-list is both the
  // rollback and a drift check.
  const repairRejected = useCallback(
    (handle: string) => {
      if (!uid || !accountHandle) return;
      void listTrackedPeers(uid, accountHandle).then((remote) => {
        if (remote !== null) {
          setPeers(remote);
          writePeers(uid, accountHandle, remote);
          return;
        }
        applyLocal((prev) => prev.filter((p) => p.handle !== handle));
      });
    },
    [uid, accountHandle, applyLocal],
  );

  const value = useMemo<PeersState>(() => {
    const cap = peerCap(isAnonymous);
    return {
      peers,
      hasPeers: peers.length > 0,
      addBlocked: peers.length < cap ? null : isAnonymous ? 'needs-auth' : 'limit',

      addPeer: (rawHandle, meta = {}) => {
        const handle = normalizeHandle(rawHandle);
        if (!handle) return 'invalid';

        // Re-tracking someone already tracked does not raise the count, matching
        // the handle exclusion in the 0005 cap policy.
        const isReTrack = peers.some((p) => p.handle === handle);
        if (!isReTrack && peers.length >= cap) {
          return isAnonymous ? 'needs-auth' : 'limit';
        }

        applyLocal((prev) => [...prev.filter((p) => p.handle !== handle), { handle, ...meta }]);
        if (uid && accountHandle) {
          void trackPeerRemote(uid, accountHandle, handle, meta).then((result) => {
            if (result === 'rejected') repairRejected(handle);
          });
        }
        return 'ok';
      },

      removePeer: (rawHandle) => {
        const handle = normalizeHandle(rawHandle);
        applyLocal((prev) => prev.filter((p) => p.handle !== handle));
        if (uid && accountHandle) void untrackPeerRemote(uid, accountHandle, handle);
      },
    };
  }, [peers, applyLocal, uid, accountHandle, isAnonymous, repairRejected]);

  return <PeersContext.Provider value={value}>{children}</PeersContext.Provider>;
}

export function usePeers(): PeersState {
  const ctx = useContext(PeersContext);
  if (!ctx) throw new Error('usePeers must be used within a PeersProvider');
  return ctx;
}
