'use no memo';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TextStyle, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { GradientTick } from '@/components/onboarding/gradient';
import { useWaitingSwirl } from '@/components/waiting-swirl';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  /** Checklist row labels, ticked one-by-one over `durationMs`. */
  rows: string[];
  /** Total run time before Continue enables. */
  durationMs?: number;
  /** True once the timer has already completed (persisted answer). */
  alreadyDone: boolean;
  /** Called once the timer finishes so the driver can enable Continue. */
  onDone: () => void;
};

const DEFAULT_DURATION_MS = 3600;

/**
 * F5, "Personalising Your Growth Strategy" cosmetic checklist.
 *
 * Unlike the F2 ScanChecklist, this calls NO real fetch. A self-contained timer
 * ticks the rows spinner → `GradientTick` one at a time; when the last row
 * completes it calls `onDone` so the driver stores a 'done' marker and enables
 * Continue. Uses React Native's `Animated` + timers (no Reanimated); the
 * `'use no memo'` directive matches the other animated onboarding components so
 * the React Compiler can't freeze the row fade.
 */
export function Personalising({ rows, durationMs, alreadyDone, onDone }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Rows [0..doneCount-1] are ticked; the row AT doneCount shows a live spinner.
  // doneCount === rows.length means the whole list is done.
  const [doneCount, setDoneCount] = useState(alreadyDone ? rows.length : 0);
  const [running, setRunning] = useState(!alreadyDone);

  // Same waiting affordance as the real scan, so the two steps feel alike.
  useWaitingSwirl(running);

  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    mounted.current = true;

    // Already completed (e.g. navigating back), leave every row ticked.
    if (alreadyDone) {
      return () => {
        mounted.current = false;
      };
    }

    const total = Math.max(1, durationMs ?? DEFAULT_DURATION_MS);
    const stepMs = total / rows.length;

    timer.current = setInterval(() => {
      setDoneCount((c) => {
        const next = c + 1;
        if (next >= rows.length) {
          if (timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
          if (mounted.current) {
            setRunning(false);
            onDoneRef.current();
          }
          return rows.length;
        }
        return next;
      });
    }, stepMs);

    return () => {
      mounted.current = false;
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
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
    </View>
  );
}

/** One checklist row: spinner while active, tick when done, dim when pending. */
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
  });
