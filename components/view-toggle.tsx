import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';

import { HapticPressable } from '@/components/haptic-pressable';
import { useTheme } from '@/contexts/theme';

/**
 * Grid/rows view preference for a list section, plus the heading-line button
 * that flips it. Grid is the default; the choice is device-local and persists
 * via the synchronous localStorage shim (installed in lib/supabase.ts), same
 * pattern as the theme mode in contexts/theme.tsx.
 */
export type ViewMode = 'grid' | 'rows';

type SyncStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function storage(): SyncStorage | undefined {
  return (globalThis as { localStorage?: SyncStorage }).localStorage;
}

function readPersistedMode(key: string): ViewMode {
  try {
    const raw = storage()?.getItem(key);
    return raw === 'rows' ? 'rows' : 'grid';
  } catch {
    return 'grid';
  }
}

export function useViewMode(storageKey: string): [ViewMode, () => void] {
  const [mode, setMode] = useState<ViewMode>(() => readPersistedMode(storageKey));

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: ViewMode = current === 'grid' ? 'rows' : 'grid';
      try {
        storage()?.setItem(storageKey, next);
      } catch {
        // Best-effort persistence; the toggle still works for this session.
      }
      return next;
    });
  }, [storageKey]);

  return [mode, toggle];
}

/**
 * The heading-line toggle button. Shows the view you'd switch TO: a list icon
 * while the grid is showing, a grid icon while the rows are showing.
 */
export function ViewToggle({
  mode,
  onToggle,
  label,
}: {
  mode: ViewMode;
  onToggle: () => void;
  label: string;
}) {
  const { palette } = useTheme();
  const next = mode === 'grid' ? 'rows' : 'grid';

  return (
    <HapticPressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Show ${label} as ${next}`}
      onPress={onToggle}
      style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <Ionicons
        name={mode === 'grid' ? 'list-outline' : 'grid-outline'}
        size={22}
        color={palette.muted}
      />
    </HapticPressable>
  );
}
