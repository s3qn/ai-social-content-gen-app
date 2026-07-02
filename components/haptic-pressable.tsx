import * as Haptics from 'expo-haptics';
import { Pressable, PressableProps } from 'react-native';

/**
 * Fire a soft tactile "tap" on iOS. No-op on other platforms (and silent in
 * the iOS Simulator — haptics only fire on a physical device). Call this from
 * any button's press handler so touch feedback is consistent across the app.
 */
export function triggerImpact() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
