import * as Haptics from 'expo-haptics';
import { Platform, Pressable, PressableProps } from 'react-native';

/**
 * Fire a tactile "tap" on iOS. No-op on other platforms (and silent in the
 * iOS Simulator — haptics only fire on a physical device). Call this from any
 * button's press handler so touch feedback is consistent across the app.
 *
 * Guarded with `Platform.OS` (a runtime value) rather than
 * `process.env.EXPO_OS`, which is only inlined when babel-preset-expo runs and
 * is otherwise `undefined` — which would silently disable every haptic.
 */
export function triggerImpact() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/**
 * Drop-in replacement for `Pressable` that adds the tactile tap on press-in —
 * the same feel the tab bar uses. Prefer this over `Pressable` for buttons.
 */
export function HapticPressable({ onPressIn, ...rest }: PressableProps) {
  return (
    <Pressable
      {...rest}
      onPressIn={(ev) => {
        triggerImpact();
        onPressIn?.(ev);
      }}
    />
  );
}
