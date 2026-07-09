import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { AppPalette, darkPalette, lightPalette } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

type ThemeState = {
  /** The user's choice. `system` follows the OS appearance. */
  mode: ThemeMode;
  /** The resolved scheme actually in effect (`system` collapsed to light/dark). */
  scheme: ColorScheme;
  /** The active neutral palette for `scheme`. */
  palette: AppPalette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

// Persisted in the same synchronous expo-sqlite localStorage shim that
// contexts/auth.tsx uses (installed by lib/supabase.ts). Reading it
// synchronously on first render is the crux of the no-flash guarantee: the very
// first paint already knows dark mode, so there's no light→dark flash on cold
// start (same trick as the auth session seed).
const STORAGE_KEY = 'app-theme-mode';

type SyncStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

function readPersistedMode(): ThemeMode {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // fall through to default
  }
  return 'system';
}

function currentSystemScheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * App-wide theme, structured like contexts/auth.tsx's SessionProvider. `mode` is
 * seeded synchronously from persisted storage; `system` mode resolves via RN
 * Appearance and follows OS changes live.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readPersistedMode);
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(currentSystemScheme);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeState>(() => {
    const scheme: ColorScheme = mode === 'system' ? systemScheme : mode;
    return {
      mode,
      scheme,
      palette: scheme === 'dark' ? darkPalette : lightPalette,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        try {
          storage()?.setItem(STORAGE_KEY, next);
        } catch {
          // best-effort persistence; in-memory state still updates
        }
      },
    };
  }, [mode, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
