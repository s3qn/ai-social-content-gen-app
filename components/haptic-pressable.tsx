import * as Haptics from 'expo-haptics';
import { Pressable, PressableProps } from 'react-native';

/**
 * Drop-in replacement for `Pressable` that adds a soft tactile "tap" on iOS
 * the instant a finger presses down — the same feel the tab bar already uses.
 * Use this for any button so touch feedback is consistent across the app.
 */
export function HapticPressable({ onPressIn, ...rest }: PressableProps) {
  return (
    <Pressable
      {...rest}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
