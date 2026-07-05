import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { INPUT, ON_HILL, PRIMARY, themeIndex } from '@/constants/theme-transition';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

type PlanCalendarProps = {
  /** Any date within the month to display. Defaults to today. */
  month?: Date;
  /** Day-of-month numbers that have a planned post. */
  markedDays?: number[];
  /** "Today" for the highlight. Defaults to now. */
  today?: Date;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Split a flat list of day numbers (with null blanks) into weeks of 7. */
function toWeeks(cells: (number | null)[]): (number | null)[][] {
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/**
 * A month grid built from plain JS Date — no calendar library. Marks planned-post
 * days with a dot and highlights today with a filled circle; both accents self-drive
 * from the shared `themeIndex` (one reusable animated style, reused across cells) so
 * they cross-fade on tab change. Non-interactive (v1).
 */
export function PlanCalendar({ month, markedDays = [], today }: PlanCalendarProps) {
  'use no memo';
  const base = month ?? new Date();
  const now = today ?? new Date();
  const year = base.getFullYear();
  const monthIndex = base.getMonth();

  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const marked = new Set(markedDays);
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIndex;
  const todayDate = now.getDate();

  const title = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // One animated accent color, reused across the today-circle and every marker.
  const accentBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(themeIndex.value, INPUT, PRIMARY),
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.weekday}>{w}</Text>
          </View>
        ))}
      </View>

      {toWeeks(cells).map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            const isToday = isCurrentMonth && day === todayDate;
            const isMarked = day != null && marked.has(day);
            return (
              <View key={di} style={styles.cell}>
                {day != null && (
                  <View style={styles.dayInner}>
                    <Animated.View style={[styles.dayCircle, isToday && accentBg]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          isToday && { color: ON_HILL, fontWeight: '700' },
                        ]}>
                        {day}
                      </Text>
                    </Animated.View>
                    <Animated.View
                      style={[styles.marker, isMarked && !isToday && accentBg]}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CIRCLE = 30;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  title: {
    ...(Type.heading as TextStyle),
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  weekday: {
    ...(Type.caption as TextStyle),
    color: Palette.muted,
    paddingVertical: Spacing.xs,
  },
  dayInner: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  dayCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    ...(Type.body as TextStyle),
    color: Palette.ink,
  },
  marker: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});
