import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { playCreateOverlay } from '@/components/create-overlay';
import { triggerImpact } from '@/components/haptic-pressable';
import { useTheme } from '@/contexts/theme';

// --- Tuning knobs: nudge these on-device to sit above the native tab bar, right side ---
const SIZE = 52; // circle diameter
const RIGHT = 16; // inset from the screen's right edge
const BOTTOM_GAP = 64; // clears the full-width native tab bar (~49pt) so the "+" floats above it

// iOS "Reduce Transparency" → fall back to a translucent solid (also on Android).
function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => mounted && setReduce(!!v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

// Frosted-glass "+" create button floating above the native tab bar (right side).
// Rendered once at the root; self-gates to the (tabs) group so it only shows on
// tab screens. (The native tab bar has no side-button API, so this is an overlay.)
export function CreateFab() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const reduceTransparency = useReduceTransparency();
  const { scheme, palette } = useTheme();
  const useSolid = Platform.OS === 'android' || reduceTransparency;
  const isDark = scheme === 'dark';

  if (segments[0] !== '(tabs)') return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create"
      hitSlop={8}
      onPress={() => {
        triggerImpact();
        playCreateOverlay();
      }}
      style={({ pressed }) => [
        styles.fab,
        { right: RIGHT, bottom: insets.bottom + BOTTOM_GAP },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.glass, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)' }]}>
        {useSolid ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(30,28,26,0.92)' : 'rgba(251,250,247,0.92)' },
            ]}
          />
        ) : (
          <BlurView
            tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            intensity={65}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Ionicons name="add" size={28} color={palette.tabIcon} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    // shadow lives on the wrapper (the glass clips its own children via overflow:'hidden')
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  glass: {
    flex: 1,
    borderRadius: SIZE / 2,
    overflow: 'hidden', // REQUIRED so the blur clips to the circle
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor set inline (theme-aware).
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }], // static dip on press — no animation lib (avoids React Compiler)
  },
});
