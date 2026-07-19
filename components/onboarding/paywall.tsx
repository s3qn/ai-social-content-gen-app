import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { HapticPressable } from '@/components/haptic-pressable';
import { GradientButton } from '@/components/onboarding/gradient';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type PaywallPerk = {
  label: string;
  icon?: IoniconName;
};

export type PaywallPlan = {
  /** Stable id recorded as the step's answer when the user activates. */
  id: string;
  title: string;
  /** Big price line, e.g. "₪69.9". */
  price: string;
  /** Small line under the price, e.g. "per month". */
  period: string;
  /** Optional third line, e.g. "₪349 billed yearly". */
  note?: string;
  /** Renders the "Best value" ribbon and is selected on mount. */
  best?: boolean;
};

type Props = {
  headline: string;
  body?: string;
  perks: PaywallPerk[];
  plans: PaywallPlan[];
  ctaLabel: string;
  /** Called by BOTH the primary CTA and the ✕ — the paywall is deliberately soft. */
  onFinish: (planId: string | null) => void;
};

/**
 * F6 — the final onboarding step: a SOFT paywall.
 *
 * // STUB: no real IAP. RevenueCat + dev build + store products is a later phase.
 *
 * Selecting a plan is local state only; "Activate My Plan Now" does not charge
 * anything — it just completes onboarding and drops the user into the app. The ✕
 * does the same, so the user can never be trapped here. Terms / Privacy /
 * Restore are inert placeholders until there is something real behind them.
 */
export function Paywall({ headline, body, perks, plans, ctaLabel, onFinish }: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Default to the "best value" plan (or the first one) — local state only.
  const [selected, setSelected] = useState<string | null>(
    () => (plans.find((p) => p.best) ?? plans[0])?.id ?? null,
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.headline}>{headline}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>
        {/* Soft paywall escape hatch — completes onboarding, same as the CTA. */}
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={() => onFinish(null)}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Ionicons name="close" size={20} color={palette.muted} />
        </HapticPressable>
      </View>

      <View style={styles.perks}>
        {perks.map((p) => (
          <View key={p.label} style={styles.perkRow}>
            <View style={styles.perkIcon}>
              <Ionicons name={p.icon ?? 'sparkles'} size={16} color={palette.accent} />
            </View>
            <Text style={styles.perkLabel}>{p.label}</Text>
            <Ionicons name="lock-open-outline" size={16} color={palette.muted} />
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <HapticPressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(plan.id)}
              style={({ pressed }) => [
                styles.plan,
                isSelected && styles.planSelected,
                pressed && !isSelected && styles.pressed,
              ]}>
              {plan.best ? (
                <View style={styles.ribbon}>
                  <Text style={styles.ribbonText}>Best value</Text>
                </View>
              ) : null}
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planPeriod}>{plan.period}</Text>
              {plan.note ? <Text style={styles.planNote}>{plan.note}</Text> : null}
              <View style={[styles.radio, isSelected && styles.radioOn]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
            </HapticPressable>
          );
        })}
      </View>

      <GradientButton label={ctaLabel} onPress={() => onFinish(selected)} />

      <Text style={styles.legal}>Cancel anytime. No charge today.</Text>

      <View style={styles.links}>
        {['Terms', 'Privacy', 'Restore'].map((label, i) => (
          <View key={label} style={styles.linkItem}>
            {i > 0 ? <Text style={styles.linkDot}>·</Text> : null}
            {/* Inert placeholders — no destination wired yet. */}
            <HapticPressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {}}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.link}>{label}</Text>
            </HapticPressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.lg },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    headText: { flex: 1, gap: Spacing.sm },
    headline: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    perks: { gap: Spacing.md },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    perkIcon: {
      width: 30,
      height: 30,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    perkLabel: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      flex: 1,
    },
    plans: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    plan: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      backgroundColor: palette.surface,
      borderWidth: 1.5,
      borderColor: palette.line,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    planSelected: {
      borderColor: palette.accent,
    },
    ribbon: {
      position: 'absolute',
      top: -10,
      alignSelf: 'center',
      backgroundColor: palette.accent,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 3,
    },
    ribbonText: {
      ...(Type.caption as TextStyle),
      fontSize: 10,
      color: palette.surface,
    },
    planTitle: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: palette.muted,
    },
    planPrice: {
      ...(Type.heading as TextStyle),
      fontSize: 24,
      color: palette.ink,
    },
    planPeriod: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
    planNote: {
      ...(Type.body as TextStyle),
      fontSize: 11,
      color: palette.muted,
      textAlign: 'center',
    },
    radio: {
      marginTop: Spacing.md,
      width: 20,
      height: 20,
      borderRadius: Radius.pill,
      borderWidth: 2,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: palette.accent },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
    },
    legal: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
      textAlign: 'center',
    },
    links: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    linkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    linkDot: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
    link: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
      textDecorationLine: 'underline',
    },
    pressed: { opacity: 0.6 },
  });
