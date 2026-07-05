import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable, triggerImpact } from '@/components/haptic-pressable';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

// Create sheet opened by the floating tab bar's "+" button. Placeholder options
// for now — real creation flow is a later phase.
const CREATE_OPTIONS = [
  { id: 'carousel', label: 'New carousel', hint: 'Multi-slide post' },
  { id: 'reel', label: 'New reel', hint: 'Short-form video' },
] as const;

export default function CreateModal() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.grabber} />
      <Text style={styles.title}>Create</Text>
      <View style={styles.list}>
        {CREATE_OPTIONS.map((o) => (
          <HapticPressable
            key={o.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => {
              // TODO: real creation flow (later phase)
              router.back();
            }}>
            <Text style={styles.rowLabel}>{o.label}</Text>
            <Text style={styles.rowHint}>{o.hint}</Text>
          </HapticPressable>
        ))}
      </View>
      <HapticPressable
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        onPress={() => {
          triggerImpact();
          router.back();
        }}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bg, padding: Spacing.xl, gap: Spacing.lg },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Palette.line,
    marginBottom: Spacing.sm,
  },
  title: { ...(Type.display as TextStyle), color: Palette.ink },
  list: { gap: Spacing.md },
  row: {
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  rowLabel: { ...(Type.body as TextStyle), color: Palette.ink, fontWeight: '600' },
  rowHint: { ...(Type.body as TextStyle), color: Palette.muted, fontSize: 13 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.lg },
  cancelLabel: { ...(Type.body as TextStyle), color: Palette.muted, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
