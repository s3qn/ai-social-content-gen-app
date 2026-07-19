'use no memo';

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';

import { Chip } from '@/components/onboarding/chip';
import { RevealFallback } from '@/components/onboarding/reveal-fallback';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';
import { formatCompact } from '@/lib/format';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

type Props = {
  /** The chosen main goal value (drives the illustrative multiplier). */
  goal?: string;
  /** Jump back to the scan step if the scan result is missing. */
  onRescan?: () => void;
};

/**
 * Per-goal illustrative growth multiplier applied to today's followers. These
 * are deliberately motivational, NOT a real forecast — the copy says so.
 */
const GOAL_FACTORS: Record<string, number> = {
  grow_following: 2.5,
  make_money: 1.8,
  build_brand: 2.0,
  more_engagement: 1.6,
  go_viral: 3.0,
  brand_deals: 2.2,
};
const DEFAULT_FACTOR = 2.0;

const GOAL_BENEFITS: Record<string, string[]> = {
  grow_following: ['Compounding reach', 'Momentum'],
  make_money: ['Compounding reach', 'Faster than avg'],
  build_brand: ['Compounding reach', 'Momentum'],
  more_engagement: ['Momentum', 'Faster than avg'],
  go_viral: ['Faster than avg', 'Momentum'],
  brand_deals: ['Compounding reach', 'Faster than avg'],
};
const DEFAULT_BENEFITS = ['Compounding reach', 'Momentum'];

const TIMEFRAME_LABEL = 'Projected in 90 days';
const CHART_HEIGHT = 190;
const TRACE_MS = 900;
const ARROW_DELAY_MS = 700;

// Mojito-family greens for the SVG fills (fixed brand colors, same in light+dark).
const LINE_TOP = '#93F9B9';
const LINE_BOTTOM = '#1D976C';
const AREA_TOP = '#1D976C';

// Normalized chart points (x, y) where x is left→right and y is bottom(0)→top(1).
// A gentle rising zig-zag that trends clearly upward — reads like a stocks app.
// The final point is inset off the corner so the arrowhead has headroom.
const NORM_POINTS: [number, number][] = [
  [0.0, 0.1],
  [0.2, 0.26],
  [0.38, 0.2],
  [0.56, 0.46],
  [0.74, 0.4],
  [0.95, 0.86],
];

const PAD_L = 10;
const PAD_R = 14;
const PAD_T = 34;
const PAD_B = 18;

/**
 * F5 — Projected Growth reveal. Reads today's followers from the stored scan
 * result and the chosen `goal`, then renders an illustrative Today → target
 * projection as a stock-style rising line/arrow chart (SVG) with a green area
 * gradient. The line PLOTS ITSELF on entry (left→right trace, area fades in,
 * arrowhead pops). Falls back gracefully (RevealFallback → back to scan) if the
 * scan result / follower count is missing.
 */
export function GrowthChart({ goal, onRescan }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { scanResult } = useOnboarding();
  const reduced = useReducedMotion();

  const [chartW, setChartW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  const today = scanResult?.stats?.followers ?? null;

  // Draw-on drivers (SVG props can't use the native driver — fine for one-shots):
  //  · `dash`  — stroke-dashoffset from the full line length → 0 (reveals the
  //              line Today→arrow, left→right).
  //  · `area`  — fillOpacity of the gradient area, 0 → 1.
  //  · `arrow` — arrowhead opacity + a small upward translate, popping at the end.
  const dash = useRef(new Animated.Value(0)).current;
  const area = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (chartW <= 0) return;
    const { lineLength } = buildGeometry(chartW);

    if (reduced) {
      // Honor "reduce motion": show the finished chart with no trace.
      dash.setValue(0);
      area.setValue(1);
      arrow.setValue(1);
      return;
    }

    dash.setValue(lineLength);
    area.setValue(0);
    arrow.setValue(0);
    Animated.parallel([
      Animated.timing(dash, {
        toValue: 0,
        duration: TRACE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(area, {
        toValue: 1,
        duration: TRACE_MS,
        useNativeDriver: false,
      }),
      // Timing (not spring): a spring overshoots past 1, and any transform on an
      // SVG shape knocks the arrowhead off the line tip. Opacity-only pop keeps
      // the arrow welded to the end of the stroke.
      Animated.timing(arrow, {
        toValue: 1,
        delay: ARROW_DELAY_MS,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartW, today, goal, reduced]);

  if (today == null || !Number.isFinite(today) || today <= 0) {
    return <RevealFallback onRescan={onRescan} />;
  }

  const factor = (goal && GOAL_FACTORS[goal]) || DEFAULT_FACTOR;
  const target = Math.round(today * factor);
  const benefits = (goal && GOAL_BENEFITS[goal]) || DEFAULT_BENEFITS;
  const upliftPct = Math.round((factor - 1) * 100);

  const geo = chartW > 0 ? buildGeometry(chartW) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{TIMEFRAME_LABEL}</Text>

        {/* Value callouts live in a header row, OUT of the plot area. */}
        <View style={styles.statsRow}>
          <View style={styles.todayCol}>
            <Text style={styles.todayValue}>{formatCompact(today)}</Text>
            <Text style={styles.endCaption}>Today</Text>
          </View>
          <View style={styles.projectedCol}>
            <Text style={styles.projectedValue}>{formatCompact(target)}</Text>
            <Text style={styles.endCaption}>Projected</Text>
          </View>
        </View>

        <View style={styles.chart} onLayout={onLayout}>
          {geo ? (
            <Svg width={chartW} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={AREA_TOP} stopOpacity={0.32} />
                  <Stop offset="1" stopColor={AREA_TOP} stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="growthLine" x1="0" y1="1" x2="1" y2="0">
                  <Stop offset="0" stopColor={LINE_BOTTOM} />
                  <Stop offset="1" stopColor={LINE_TOP} />
                </LinearGradient>
              </Defs>

              <AnimatedPath d={geo.areaPath} fill="url(#growthArea)" fillOpacity={area} />
              <AnimatedPath
                d={geo.linePath}
                fill="none"
                stroke="url(#growthLine)"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={[geo.lineLength, geo.lineLength]}
                strokeDashoffset={dash}
              />
              <AnimatedPolygon points={geo.arrow} fill={LINE_TOP} fillOpacity={arrow} />
            </Svg>
          ) : null}
        </View>

        <View style={styles.upliftRow}>
          <Ionicons name="trending-up" size={16} color={palette.accent} />
          <Text style={styles.uplift}>+{upliftPct}% followers</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {benefits.map((b) => (
          <Chip key={b} label={b} variant="subtle" />
        ))}
      </View>

      <Text style={styles.disclaimer}>Projection, not a guarantee.</Text>
    </View>
  );
}

/** Track the OS "reduce motion" setting so we can skip the trace animation. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduced(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Map the normalized points into pixel-space SVG paths + an arrowhead polygon,
 * plus the total pixel length of the line (for the draw-on dash animation).
 */
function buildGeometry(width: number) {
  const innerW = Math.max(1, width - PAD_L - PAD_R);
  const innerH = CHART_HEIGHT - PAD_T - PAD_B;
  const baseline = CHART_HEIGHT - PAD_B;

  const pts = NORM_POINTS.map(([nx, ny]) => ({
    x: PAD_L + nx * innerW,
    y: baseline - ny * innerH,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`)
    .join(' ');

  let lineLength = 0;
  for (let i = 1; i < pts.length; i++) {
    lineLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }

  const first = pts[0];
  const last = pts[pts.length - 1];
  const areaPath = `${linePath} L ${round(last.x)} ${round(baseline)} L ${round(
    first.x,
  )} ${round(baseline)} Z`;

  // Arrowhead at the top-right tip, oriented along the final rising segment.
  const prev = pts[pts.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const size = 13;
  const spread = 0.5;
  const a1x = last.x - size * Math.cos(angle - spread);
  const a1y = last.y - size * Math.sin(angle - spread);
  const a2x = last.x - size * Math.cos(angle + spread);
  const a2y = last.y - size * Math.sin(angle + spread);
  const arrow = `${round(last.x)},${round(last.y)} ${round(a1x)},${round(a1y)} ${round(
    a2x,
  )},${round(a2y)}`;

  return { linePath, areaPath, arrow, lineLength: round(lineLength) };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.lg },
    card: {
      gap: Spacing.lg,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
    },
    eyebrow: {
      ...(Type.eyebrow as TextStyle),
      color: palette.muted,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    todayCol: { alignItems: 'flex-start' },
    projectedCol: { alignItems: 'flex-end' },
    todayValue: {
      ...(Type.stat as TextStyle),
      fontSize: 20,
      color: palette.ink,
    },
    projectedValue: {
      ...(Type.stat as TextStyle),
      fontSize: 26,
      color: palette.accent,
    },
    endCaption: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    chart: {
      width: '100%',
      height: CHART_HEIGHT,
    },
    upliftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    uplift: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.accent,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      justifyContent: 'center',
    },
    disclaimer: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
      textAlign: 'center',
    },
  });
