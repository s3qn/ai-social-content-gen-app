import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

/**
 * Onboarding-LOCAL gradient helpers. Instagram-style brand gradients applied to
 * the check / confirm affordances within the onboarding flow ONLY. Fixed brand
 * gradients (identical in light + dark by design) — the neutral theme palette
 * still drives everything around them.
 *
 * Ticks use a RADIAL ("inside out") fill — bright core radiating to a deeper
 * edge. The primary CTA uses a subtle dark-GREEN linear fill (green-forward but
 * still deep, not a loud bright pill).
 */

// "Mojito" tick — bright light-green core -> deep-green edge (check affordances).
const MOJITO_CORE = '#A8FBC8';
const MOJITO_EDGE = '#1D976C';

// Primary CTA — a green pill in the Mojito family. Theme-aware: on DARK surfaces
// a brighter pair reads well; on LIGHT (white) surfaces the same-shade greens
// look washed out, so we deepen them for contrast against the page + white label.
const BTN_COLORS_DARK = ['#2CB489', '#1D976C'] as const;
const BTN_COLORS_LIGHT = ['#1D976C', '#146F51'] as const;

/** "Lemon Twist" — a small, subtle accent (the progress-bar fill). */
export const LEMON = ['#3CA55C', '#B5AC49'] as const;

/**
 * A radial gradient filling its parent. The parent sets `overflow:'hidden'` + a
 * borderRadius to clip it to shape. Explicit 100% width/height props (not just
 * style) so react-native-svg always paints the fill.
 */
function RadialFill({ core, edge }: { core: string; edge: string }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="rg" cx="50%" cy="50%" r="65%">
          <Stop offset="0%" stopColor={core} />
          <Stop offset="100%" stopColor={edge} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#rg)" />
    </Svg>
  );
}

type TickProps = {
  size: number;
  /** `circle` = radio/row check; `square` = multi-select checkbox. */
  shape?: 'circle' | 'square';
};

/**
 * A Mojito radial tick: bright in the center, deepening to the edge, with a white
 * checkmark on top and a small drop shadow to lift it off the card. An outer
 * (unclipped) View carries the shadow; the inner clipped View holds the fill.
 */
export function GradientTick({ size, shape = 'circle' }: TickProps) {
  const radius = shape === 'circle' ? size / 2 : Radius.sm;
  return (
    <View
      style={{
        borderRadius: radius,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 2,
      }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <RadialFill core={MOJITO_CORE} edge={MOJITO_EDGE} />
        <Ionicons name="checkmark" size={Math.round(size * 0.68)} color="#FFFFFF" />
      </View>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** Dim + block presses (e.g. a step whose answer isn't ready yet). */
  disabled?: boolean;
};

/**
 * The onboarding primary confirm/continue CTA — a subtle dark-green pill.
 * Mirrors the shared BlackButton's shape + API but is scope-local to onboarding
 * so the shared button is never touched. Full-width via `alignSelf:'stretch'`.
 */
export function GradientButton({ label, onPress, disabled = false }: ButtonProps) {
  const { palette, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const colors = scheme === 'light' ? BTN_COLORS_LIGHT : BTN_COLORS_DARK;
  return (
    <HapticPressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </HapticPressable>
  );
}

const makeStyles = (_palette: AppPalette) =>
  StyleSheet.create({
    base: {
      alignSelf: 'stretch',
      borderRadius: Radius.md,
      overflow: 'hidden',
    } as ViewStyle,
    fill: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
    },
    label: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: '#FFFFFF',
    },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.4 },
  });
