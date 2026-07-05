import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

// Floating chat button: a green circle pinned bottom-right, sitting just above
// the native tab bar. Reused across the four tab screens so it appears app-wide.
// Tap is a no-op for now (the chat feature is parked).
const TAB_BAR_ALLOWANCE = 64;
const SIZE = 56;

export function ChatFab() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open chat"
      hitSlop={8}
      onPress={() => {
        // TODO: chat feature is parked (see stash "chat-feature-parked"); wire up later
      }}
      style={({ pressed }) => [
        styles.fab,
        { bottom: insets.bottom + TAB_BAR_ALLOWANCE, right: 20 },
        pressed && styles.pressed,
      ]}>
      <Ionicons name="chatbubble-ellipses" size={26} color={Palette.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // One soft shadow is allowed on a primary action; the FAB qualifies.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    opacity: 0.9,
  },
});
