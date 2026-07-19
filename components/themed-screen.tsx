import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ReactNode, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { CURVE_DEPTH, HillHeader } from '@/components/hill-header';
import { HillFooter } from '@/components/hill-footer';
import { CharacterId } from '@/constants/characters';
import { Fonts, Radius, Spacing, TAB_BAR_CLEARANCE, Type } from '@/constants/theme';
import {
  INPUT,
  inkIndexFor,
  RAMPS,
  themeIndex,
  transitionToCharacter,
} from '@/constants/theme-transition';
import { useTheme } from '@/contexts/theme';

const FOOTER_HEIGHT = 132;

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

type ThemedScreenProps = {
  /** Which character owns this tab — drives the focus color transition. */
  character: CharacterId;
  /** Header row content (laid out left/right in the hill header). */
  header: ReactNode;
  /** Scrolling body content. */
  children: ReactNode;
};

/**
 * Shared scaffold for every character tab: an animated background wash, a pinned
 * self-driving hill header, a scrolling body, and pinned footer hills. On focus
 * it eases the shared `themeIndex` toward this tab's character, so the whole
 * scheme cross-fades when switching tabs (snaps under reduced motion).
 */
export function ThemedScreen({ character, header, children }: ThemedScreenProps) {
  'use no memo';
  const reduced = useReducedMotion();
  const { scheme } = useTheme();
  const { BG_TINT } = RAMPS[scheme];

  useFocusEffect(
    useCallback(() => {
      transitionToCharacter(character, !reduced);
    }, [character, reduced]),
  );

  const washStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(themeIndex.value, INPUT, BG_TINT) }),
    [scheme],
  );

  return (
    <Animated.View style={[styles.root, washStyle]}>
      <HillHeader style={styles.header}>{header}</HillHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.body}>{children}</View>
      </ScrollView>

      <View style={styles.footerFixed}>
        <HillFooter height={FOOTER_HEIGHT} />
      </View>
    </Animated.View>
  );
}

/**
 * Animated style for ink sitting on the hill.
 *
 * Every `HillHeader` reads the same global `themeIndex`, so a screen's hill is
 * mid-morph toward another character's hue during the 450ms tab fade. Ink
 * resolved statically per screen therefore goes wrong mid-transition — white on
 * Virlo's light lime, or Virlo's dark ink on a still-dark hill. Driving ink from
 * the same value keeps the two in lockstep. It *steps* rather than blends; see
 * `INK_STEP` for why interpolating ink is unreadable at the crossover.
 */
export function useOnHillInk() {
  'use no memo';
  const { scheme } = useTheme();
  const { ON_HILL_INKS } = RAMPS[scheme];
  return useAnimatedStyle(
    () => ({ color: ON_HILL_INKS[inkIndexFor(themeIndex.value)] }),
    [scheme],
  );
}

/** Title shown on the hill header (left side). Ink self-drives with the hill. */
export function HeaderTitle({ title }: { title: string }) {
  'use no memo';
  return <Animated.Text style={[styles.headerTitle, useOnHillInk()]}>{title}</Animated.Text>;
}

/** Settings gear for the hill header (right side). Ink self-drives with the hill. */
export function SettingsGear() {
  'use no memo';
  const router = useRouter();
  return (
    <HapticPressable
      hitSlop={12}
      style={({ pressed }) => pressed && styles.pressed}
      onPress={() => router.push('/settings')}>
      {/* Ionicons renders a Text, so an animated `color` style tints the glyph. */}
      <AnimatedIonicons name="settings-outline" size={22} style={useOnHillInk()} />
    </HapticPressable>
  );
}

/** Bold slab-serif section heading (e.g. "STATS", "MY PEERS"). Ink is theme-aware. */
export function SectionHeading({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  return <Text style={[styles.sectionHeading, { color: palette.ink }]}>{children}</Text>;
}

/** Neutral placeholder block, standing in for not-yet-built content. Theme-aware. */
export function PlaceholderCard({ height = 96 }: { height?: number }) {
  const { scheme } = useTheme();
  const backgroundColor = scheme === 'dark' ? '#2A2724' : '#DEDAD2';
  return <View style={[styles.placeholder, { height, backgroundColor }]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    zIndex: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: FOOTER_HEIGHT + TAB_BAR_CLEARANCE,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: CURVE_DEPTH + Spacing.md,
    gap: Spacing.lg,
  },
  sectionHeading: {
    ...(Type.display as TextStyle),
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  headerTitle: {
    ...(Type.heading as TextStyle),
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  placeholder: {
    borderRadius: Radius.lg,
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Prop form of pointerEvents is unreliable on the New Architecture (Fabric);
    // set it in style so the footer never intercepts native tab-bar taps.
    pointerEvents: 'none',
  },
});
