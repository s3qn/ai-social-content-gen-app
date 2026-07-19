import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { GradientTick } from '@/components/onboarding/gradient';
import { SelectOption } from '@/constants/onboarding-steps';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type Props = {
  headline: string;
  body?: string;
  perks?: string[];
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string) => void;
};

/**
 * F6, notifications opt-in.
 *
 * // UI-only: real expo-notifications permission wiring lands with push.
 *
 * Nothing here touches the OS permission sheet: `expo-notifications` is not a
 * dependency and no part of the app sends a notification yet. Picking an option
 * simply records the user's intent as this step's answer so the real prompt can
 * be shown (once) at the right moment later.
 */
export function NotificationsOptIn({ headline, body, perks, options, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name="notifications-outline" size={28} color={palette.surface} />
      </View>

      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      {perks && perks.length > 0 ? (
        <View style={styles.perks}>
          {perks.map((p) => (
            <View key={p} style={styles.perkRow}>
              <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.choices}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <HapticPressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && !selected && styles.choicePressed,
              ]}>
              {o.icon ? (
                <Ionicons
                  name={o.icon}
                  size={20}
                  color={selected ? palette.accent : palette.muted}
                />
              ) : null}
              <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                {o.label}
              </Text>
              {selected ? <GradientTick size={22} /> : <View style={styles.tickSpacer} />}
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

const BADGE = 60;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md, alignItems: 'stretch' },
    badge: {
      alignSelf: 'center',
      width: BADGE,
      height: BADGE,
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    headline: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
      textAlign: 'center',
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
      textAlign: 'center',
    },
    perks: {
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    perkText: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      flex: 1,
    },
    choices: { gap: Spacing.md },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    choiceSelected: {
      borderColor: palette.accent,
    },
    choicePressed: { opacity: 0.7 },
    choiceLabel: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: palette.ink,
      flex: 1,
    },
    choiceLabelSelected: { color: palette.ink },
    tickSpacer: { width: 22, height: 22 },
  });
