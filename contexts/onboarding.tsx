import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth';
import type { ScanResult } from '@/lib/scan';

/**
 * Onboarding progress + answers, structured exactly like contexts/theme.tsx:
 * the completion flag and stored answers are seeded SYNCHRONOUSLY from the same
 * expo-sqlite localStorage shim on first render. Seeding sync is the crux of the
 * native-tab-freeze fix — once F6 wires the router gate on `hasOnboarded`, the
 * guard is already correct on the first paint and never flips after mount (a
 * late flip is what froze the native tab bar; see contexts/auth.tsx).
 *
 * Storage is NAMESPACED by the signed-in user's id so two accounts on one device
 * don't share onboarding state. F1 keeps this in localStorage; a later phase
 * unifies it into the Supabase `profiles` table.
 */

// Arbitrary per-step answers (string, string[], etc.), keyed by step id.
export type OnboardingAnswers = Record<string, unknown>;

type OnboardingState = {
  /** True once the user has finished (or skipped to the end of) the funnel. */
  hasOnboarded: boolean;
  /** All answers collected so far, keyed by step id. */
  answers: OnboardingAnswers;
  /** Persist a single step's answer. */
  setAnswer: (key: string, value: unknown) => void;
  /** The most recent real Instagram scan result (F2), or null before scanning. */
  scanResult: ScanResult | null;
  /** Store (and persist) the scan result once the fetch resolves. */
  setScanResult: (result: ScanResult) => void;
  /** Mark onboarding complete (sets + persists the flag). */
  complete: () => void;
  /** Clear the flag + answers — used by the temporary Settings dev entry so the
   *  flow can be replayed from the top. */
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const FLAG_PREFIX = 'app-onboarding-complete';
const ANSWERS_PREFIX = 'app-onboarding-answers';
const SCAN_PREFIX = 'app-onboarding-scan';

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

// Namespaced keys. A signed-out user (no id) uses a shared "anon" bucket so the
// dev entry still works before real per-user gating lands.
function ns(uid: string | null): string {
  return uid ?? 'anon';
}
function flagKey(uid: string | null): string {
  return `${FLAG_PREFIX}:${ns(uid)}`;
}
function answersKey(uid: string | null): string {
  return `${ANSWERS_PREFIX}:${ns(uid)}`;
}
function scanKey(uid: string | null): string {
  return `${SCAN_PREFIX}:${ns(uid)}`;
}

function readFlag(uid: string | null): boolean {
  try {
    return storage()?.getItem(flagKey(uid)) === 'true';
  } catch {
    return false;
  }
}

function readAnswers(uid: string | null): OnboardingAnswers {
  try {
    const raw = storage()?.getItem(answersKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as OnboardingAnswers) : {};
  } catch {
    return {};
  }
}

function readScan(uid: string | null): ScanResult | null {
  try {
    const raw = storage()?.getItem(scanKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ScanResult) : null;
  } catch {
    return null;
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // `session` is itself seeded synchronously by SessionProvider, so the user id
  // is already known on the first render — the seeds below read the right bucket.
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => readFlag(uid));
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => readAnswers(uid));
  const [scanResult, setScanResultState] = useState<ScanResult | null>(() => readScan(uid));

  // Re-seed when the signed-in user changes (sign in/out swaps the namespace).
  // On the very first render this matches the initializer above, so it's a no-op.
  useEffect(() => {
    setHasOnboarded(readFlag(uid));
    setAnswers(readAnswers(uid));
    setScanResultState(readScan(uid));
  }, [uid]);

  const value = useMemo<OnboardingState>(
    () => ({
      hasOnboarded,
      answers,
      scanResult,
      setAnswer: (key, next) => {
        setAnswers((prev) => {
          const merged = { ...prev, [key]: next };
          try {
            storage()?.setItem(answersKey(uid), JSON.stringify(merged));
          } catch {
            // best-effort persistence; in-memory state still updates
          }
          return merged;
        });
      },
      setScanResult: (result) => {
        setScanResultState(result);
        try {
          storage()?.setItem(scanKey(uid), JSON.stringify(result));
        } catch {
          // best-effort persistence; in-memory state still updates
        }
      },
      complete: () => {
        setHasOnboarded(true);
        try {
          storage()?.setItem(flagKey(uid), 'true');
        } catch {
          // best-effort
        }
      },
      reset: () => {
        setHasOnboarded(false);
        setAnswers({});
        setScanResultState(null);
        try {
          storage()?.setItem(flagKey(uid), 'false');
          storage()?.setItem(answersKey(uid), '{}');
          storage()?.setItem(scanKey(uid), '');
        } catch {
          // best-effort
        }
      },
    }),
    [hasOnboarded, answers, scanResult, uid],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
