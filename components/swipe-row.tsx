import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TextStyle, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

const ACTION_WIDTH = 88;

type SwipeRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
  confirmTitle: string;
  confirmMessage: string;
  /** Label under the trash glyph. Kept short; the action is only 88pt wide. */
  actionLabel?: string;
  /**
   * Row cannot be deleted. The gesture is not just ignored, it is not mounted at
   * all, and the grip glyph disappears with it: an affordance that hints at
   * something impossible is worse than no affordance.
   */
  disabled?: boolean;
};

/**
 * Wraps a list row so swiping left reveals a red Delete action.
 *
 * Deleting NEVER fires straight from the gesture: the swipe only reveals the
 * button, tapping it asks for confirmation, and the row closes either way. A
 * gesture that destroys data on its own is too easy to trigger by accident.
 *
 * The grip glyph at the leading edge exists purely as an affordance. A hidden
 * swipe is an undiscoverable feature, so the row advertises itself at rest.
 */
export function SwipeRow({
  children,
  onDelete,
  confirmTitle,
  confirmMessage,
  actionLabel = 'Delete',
  disabled = false,
}: SwipeRowProps) {
  'use no memo';
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const ref = useRef<SwipeableMethods>(null);

  const confirm = () => {
    Alert.alert(confirmTitle, confirmMessage, [
      { text: 'Cancel', style: 'cancel', onPress: () => ref.current?.close() },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          ref.current?.close();
          onDelete();
        },
      },
    ]);
  };

  const renderRightActions = (
    _progress: SharedValue<number>,
    translation: SharedValue<number>,
  ) => (
    <DeleteAction
      translation={translation}
      styles={styles}
      label={actionLabel}
      onPress={confirm}
    />
  );

  // Undeletable rows skip the gesture wrapper entirely rather than mounting a
  // swipe that refuses to do anything, and lose the grip so nothing advertises
  // an action that is not available.
  if (disabled) {
    return (
      <View style={styles.row}>
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderRightActions}>
      <View style={styles.row}>
        <Ionicons
          name="ellipsis-vertical"
          size={16}
          color={palette.muted}
          style={styles.grip}
          // Decorative: the row itself is the interactive element.
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={styles.content}>{children}</View>
      </View>
    </ReanimatedSwipeable>
  );
}

/** The revealed action. Tracks the drag so it does not pop in at full width. */
function DeleteAction({
  translation,
  styles,
  label,
  onPress,
}: {
  translation: SharedValue<number>;
  styles: ReturnType<typeof makeStyles>;
  label: string;
  onPress: () => void;
}) {
  'use no memo';
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.actionWrap, style]}>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={styles.actionText}>{label}</Text>
      </HapticPressable>
    </Animated.View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.bg,
    },
    grip: {
      paddingLeft: Spacing.xs,
      paddingRight: Spacing.xs,
    },
    content: {
      flex: 1,
    },
    actionWrap: {
      width: ACTION_WIDTH,
      justifyContent: 'center',
      paddingLeft: Spacing.xs,
    },
    action: {
      flex: 1,
      backgroundColor: palette.warn,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    actionPressed: {
      opacity: 0.75,
    },
    actionText: {
      ...(Type.caption as TextStyle),
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
