'use no memo';

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { GradientTick } from '@/components/onboarding/gradient';
import { useWaitingSwirl } from '@/components/waiting-swirl';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';
import { ScanError } from '@/lib/scan';
import { scanProfileCached } from '@/lib/scan-cache';

type Props = {
  /** Checklist row labels, e.g. ["Scanning your profile", …]. */
  rows: string[];
  /** The @username to scan (from the earlier text step). */
  username: string;
  /** True once a scan has already completed for this step (persisted answer). */
  alreadyDone: boolean;
  /** Called once the scan resolves so the driver can enable Continue. */
  onDone: () => void;
};

// How long each intermediate row lingers as "in progress" before it ticks.
// Purely cosmetic pacing — the real fetch runs the whole time underneath and,
// when it resolves, every remaining row snaps to done.
const ROW_STAGGER_MS = 2200;

/**
 * Animated scan checklist tied to the REAL Instagram fetch.
 *
 * On mount it reads the @username, calls `scanProfile`, and staggers the rows
 * from spinner → `checkmark-circle` while the request runs. When the fetch
 * resolves it stores the result via `setScanResult`, completes every row, and
 * enables Continue. On failure it shows a friendly inline message + Retry.
 *
 * Uses React Native's `Animated` + timers (no Reanimated) to sidestep the
 * React-Compiler/Reanimated freeze; `'use no memo'` is belt-and-suspenders.
 */
export function ScanChecklist({ rows, username, alreadyDone, onDone }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { setScanResult } = useOnboarding();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  // Rows [0..doneCount-1] are complete; the row AT doneCount is the active one
  // showing a spinner. When doneCount === rows.length the whole list is done.
  const [doneCount, setDoneCount] = useState(alreadyDone ? rows.length : 0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // The scan can run 30–90s, long past the point the cosmetic row stagger runs
  // out — the looping swirl carries the wait from there.
  useWaitingSwirl(running);

  // Guards so unmount / re-runs don't call setState on a dead component or
  // double-advance the stagger.
  const mounted = useRef(true);
  const staggerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStagger = useCallback(() => {
    if (staggerTimer.current) {
      clearInterval(staggerTimer.current);
      staggerTimer.current = null;
    }
  }, []);

  const runScan = useCallback(async () => {
    setError(null);
    setRunning(true);
    setDoneCount(0);

    // Cosmetic stagger: tick rows one at a time but stop before the last one so
    // there's always a live spinner until the real fetch returns.
    stopStagger();
    staggerTimer.current = setInterval(() => {
      setDoneCount((c) => (c < rows.length - 1 ? c + 1 : c));
    }, ROW_STAGGER_MS);

    try {
      const result = await scanProfileCached(username, uid);
      if (!mounted.current) return;
      stopStagger();
      setScanResult(result);
      setDoneCount(rows.length);
      setRunning(false);
      onDone();
    } catch (err) {
      if (!mounted.current) return;
      stopStagger();
      setRunning(false);
      setDoneCount(0);
      const message =
        err instanceof ScanError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, rows.length]);

  useEffect(() => {
    mounted.current = true;
    // Don't re-scan if this step was already completed (e.g. navigating back).
    if (!alreadyDone) {
      void runScan();
    }
    return () => {
      mounted.current = false;
      stopStagger();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.list}>
        {rows.map((label, i) => (
          <Row
            key={label}
            label={label}
            done={i < doneCount}
            active={i === doneCount && running}
            styles={styles}
            palette={palette}
          />
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color={palette.warn} />
          <Text style={styles.errorText}>{error}</Text>
          <HapticPressable
            accessibilityRole="button"
            onPress={() => void runScan()}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={16} color={palette.surface} />
            <Text style={styles.retryText}>Retry</Text>
          </HapticPressable>
        </View>
      ) : null}
    </View>
  );
}

/** One checklist row: spinner while active, check when done, dim when pending. */
function Row({
  label,
  done,
  active,
  styles,
  palette,
}: {
  label: string;
  done: boolean;
  active: boolean;
  styles: ReturnType<typeof makeStyles>;
  palette: AppPalette;
}) {
  // Fade the checkmark in when a row completes.
  const opacity = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: done ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [done, opacity]);

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        {done ? (
          <Animated.View style={{ opacity }}>
            <GradientTick size={24} shape="circle" />
          </Animated.View>
        ) : active ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color={palette.line} />
        )}
      </View>
      <Text style={[styles.rowLabel, !done && !active && styles.rowLabelPending]}>{label}</Text>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.xl },
    list: {
      gap: Spacing.lg,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    icon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      ...(Type.body as TextStyle),
      flex: 1,
      fontWeight: '600',
      color: palette.ink,
    },
    rowLabelPending: { color: palette.muted },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.lg,
    },
    errorText: {
      ...(Type.body as TextStyle),
      flex: 1,
      minWidth: 160,
      color: palette.ink,
    },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: palette.accent,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    retryText: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.surface,
    },
    pressed: { opacity: 0.6 },
  });
