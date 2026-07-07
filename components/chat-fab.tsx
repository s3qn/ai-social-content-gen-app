import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

// Floating chat button: a green circle pinned bottom-right, sitting above the
// native tab bar and stacked above the root "+" create FAB (which lives at the
// same right edge). Reused across the four tab screens so it appears app-wide.
// The chat feature is parked, so the tap just surfaces a "coming soon" notice.
const TAB_BAR_ALLOWANCE = 64;
const SIZE = 56;
// Clear the create FAB below us (its size 52 + a gap) so the two don't overlap.
const CREATE_FAB_CLEARANCE = 52 + 14;

export function ChatFab() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open chat"
      hitSlop={8}
      onPress={() => {
        // Chat feature is parked (see stash "chat-feature-parked"); give feedback for now.
        Alert.alert('Chat', 'Coming soon.');
      }}
      style={({ pressed }) => [
        styles.fab,
        { bottom: insets.bottom + TAB_BAR_ALLOWANCE + CREATE_FAB_CLEARANCE, right: 16 },
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
