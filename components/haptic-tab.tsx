import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

import { triggerImpact } from '@/components/haptic-pressable';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        // Add a soft haptic feedback when pressing down on the tabs.
        triggerImpact();
        props.onPressIn?.(ev);
      }}
    />
  );
}
