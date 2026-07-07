import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';

import { ChatFab } from '@/components/chat-fab';
import { HapticPressable } from '@/components/haptic-pressable';
import { CURVE_DEPTH, HillHeader } from '@/components/hill-header';
import { HillFooter } from '@/components/hill-footer';
import { CharacterId } from '@/constants/characters';
import { Fonts, Palette, Radius, Spacing, TAB_BAR_CLEARANCE, Type } from '@/constants/theme';
import { BG_TINT, INPUT, ON_HILL, themeIndex, transitionToCharacter } from '@/constants/theme-transition';

const FOOTER_HEIGHT = 150;

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
 * self-driving hill header, a scrolling body, pinned footer hills, and the chat
 * FAB. On focus it eases the shared `themeIndex` toward this tab's character, so
 * the whole scheme cross-fades when switching tabs (snaps under reduced motion).
 */
export function ThemedScreen({ character, header, children }: ThemedScreenProps) {
  'use no memo';
  const reduced = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      transitionToCharacter(character, !reduced);
    }, [character, reduced]),
  );

  const washStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(themeIndex.value, INPUT, BG_TINT),
  }));

  return (
    <Animated.View style={[styles.root, washStyle]}>
      <HillHeader style={styles.header}>{header}</HillHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.body}>{children}</View>
      </ScrollView>

      <View style={styles.footerFixed} pointerEvents="none">
        <HillFooter height={FOOTER_HEIGHT} />
      </View>

      <ChatFab />
    </Animated.View>
  );
}

/** White title shown on the hill header (left side). */
export function HeaderTitle({ title }: { title: string }) {
  return <Text style={styles.headerTitle}>{title}</Text>;
}

/** Settings gear for the hill header (right side). White on the hill. */
export function SettingsGear() {
  return (
    <HapticPressable
      hitSlop={12}
      style={({ pressed }) => pressed && styles.pressed}
      onPress={() => {
        // Settings nav is a later phase (sign-out will move here); give feedback for now.
        Alert.alert('Settings', 'Coming soon.');
      }}>
      <Ionicons name="settings-outline" size={22} color={ON_HILL} />
    </HapticPressable>
  );
}

/** Bold slab-serif section heading (e.g. "STATS", "MY PEERS"). */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

/** Neutral grey placeholder block, standing in for not-yet-built content. */
export function PlaceholderCard({ height = 96 }: { height?: number }) {
  return <View style={[styles.placeholder, { height }]} />;
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
    color: Palette.ink,
  },
  headerTitle: {
    ...(Type.heading as TextStyle),
    color: ON_HILL,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  placeholder: {
    backgroundColor: '#DEDAD2',
    borderRadius: Radius.lg,
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
