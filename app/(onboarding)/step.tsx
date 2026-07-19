import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticPressable } from '@/components/haptic-pressable';
import { ContentDna } from '@/components/onboarding/content-dna';
import { GradientButton, LEMON } from '@/components/onboarding/gradient';
import { CtaCard } from '@/components/onboarding/cta-card';
import { Interstitial } from '@/components/onboarding/interstitial';
import { MascotBubble } from '@/components/onboarding/mascot-bubble';
import { GrowthChart } from '@/components/onboarding/growth-chart';
import { MultiSelect } from '@/components/onboarding/multi-select';
import { Personalising } from '@/components/onboarding/personalising';
import { ProfileSummary } from '@/components/onboarding/profile-summary';
import { ScanChecklist } from '@/components/onboarding/scan-checklist';
import { Segmented } from '@/components/onboarding/segmented';
import { SingleSelect } from '@/components/onboarding/single-select';
import { OnboardingStep, onboardingSteps } from '@/constants/onboarding-steps';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/contexts/onboarding';
import { useTheme } from '@/contexts/theme';

/**
 * The onboarding driver. Walks `onboardingSteps`, renders the current step by
 * its `type`, owns the top progress bar + back button, and writes every answer
 * straight to the onboarding context (so answers persist as you go). The last
 * step's "Continue" marks onboarding complete and exits.
 *
 * F1: reached via the temporary "Run onboarding" row in Settings — the real
 * router gate is wired in F6.
 */
export default function OnboardingDriver() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { answers, setAnswer, complete } = useOnboarding();

  const total = onboardingSteps.length;
  const [index, setIndex] = useState(0);
  const step = onboardingSteps[index];

  const answered = isAnswered(step, answers[step.id]);
  const isLast = index === total - 1;

  // F4 — seed a sensible default the first time a step is shown so the user only
  // has to adjust, not pick from scratch (Continue is immediately enabled). Runs
  // once per step (keyed on index/id); no-op if the step has a stored answer or
  // carries no default. Only writes when the current answer is empty.
  useEffect(() => {
    const current = answers[step.id];
    const isEmpty =
      current === undefined ||
      current === '' ||
      (Array.isArray(current) && current.length === 0);
    if (!isEmpty) return;
    if ('defaultValues' in step && step.defaultValues && step.defaultValues.length > 0) {
      setAnswer(step.id, step.defaultValues);
    } else if ('defaultValue' in step && step.defaultValue) {
      setAnswer(step.id, step.defaultValue);
    }
    // Intentionally keyed only on the step so the seed happens once per step and
    // never clobbers a user's later edit back to empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step.id]);

  const goBack = () => {
    if (index > 0) setIndex((i) => i - 1);
    else router.back(); // leave the group (back to Settings in F1)
  };

  // Jump straight back to the scan step — used by the reveal fallbacks when the
  // scan result is missing so the flow can recover instead of dead-ending.
  const goToScan = () => {
    const scanIndex = onboardingSteps.findIndex((s) => s.type === 'scan');
    setIndex(scanIndex >= 0 ? scanIndex : 0);
  };

  const goNext = () => {
    if (!answered) return;
    if (isLast) {
      complete();
      router.back(); // F1 has nothing after Connect — exit the flow
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <HapticPressable
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => pressed && styles.pressed}>
          <Ionicons name="chevron-back" size={26} color={palette.ink} />
        </HapticPressable>

        {/* Progress bar — fills as the user advances through the steps. */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]}>
            <LinearGradient
              colors={LEMON}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>

        <Text style={styles.counter}>
          {index + 1}/{total}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <MascotBubble text={step.mascotText} />
        <View style={styles.stepArea}>
          {renderStep(step, answers, setAnswer, styles, palette, goToScan)}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <GradientButton label={continueLabel(step, isLast)} onPress={goNext} disabled={!answered} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** Continue/Finish is enabled only when the current step has a valid answer. */
function isAnswered(step: OnboardingStep, answer: unknown): boolean {
  // F5 — an `optional` step never blocks Continue, whatever its type (e.g. the
  // skippable secondary goal). Checked before the per-type rules below.
  if (step.optional) return true;
  switch (step.type) {
    case 'text':
      return typeof answer === 'string' && answer.trim().length > 0;
    case 'multi-select':
      return Array.isArray(answer) && answer.length >= (step.min ?? 1);
    case 'single-select':
    case 'segmented':
    case 'interstitial':
      return typeof answer === 'string' && answer.length > 0;
    case 'scan':
      // The ScanChecklist writes a truthy marker here once the fetch resolves.
      return answer === 'done';
    case 'personalising':
      // The Personalising timer writes 'done' once it finishes (same as scan).
      return answer === 'done';
    case 'cta':
    case 'profile-summary':
    case 'content-dna':
    case 'growth':
      // Reveal / CTA steps collect no answer — the button just advances the flow.
      return true;
  }
}

/** Footer button label: CTA steps carry their own; else Continue/Finish. */
function continueLabel(step: OnboardingStep, isLast: boolean): string {
  if (step.type === 'cta') return step.buttonLabel;
  return isLast ? 'Finish' : 'Continue';
}

/** Render the current step's archetype. Adding a step type = add a case here. */
function renderStep(
  step: OnboardingStep,
  answers: Record<string, unknown>,
  setAnswer: (key: string, value: unknown) => void,
  styles: ReturnType<typeof makeStyles>,
  palette: AppPalette,
  goToScan: () => void,
) {
  switch (step.type) {
    case 'single-select':
      return (
        <SingleSelect
          options={step.options}
          value={answers[step.id] as string | undefined}
          onChange={(v) => setAnswer(step.id, v)}
        />
      );
    case 'multi-select':
      return (
        <MultiSelect
          options={step.options}
          value={(answers[step.id] as string[] | undefined) ?? []}
          onChange={(v) => setAnswer(step.id, v)}
          max={step.max}
        />
      );
    case 'segmented':
      return (
        <Segmented
          options={step.options}
          value={answers[step.id] as string | undefined}
          onChange={(v) => setAnswer(step.id, v)}
        />
      );
    case 'interstitial':
      return (
        <Interstitial
          headline={step.headline}
          body={step.body}
          options={step.options}
          value={answers[step.id] as string | undefined}
          onChange={(v) => setAnswer(step.id, v)}
        />
      );
    case 'scan':
      return (
        <ScanChecklist
          rows={step.rows}
          username={(answers[step.usernameKey ?? 'username'] as string | undefined) ?? ''}
          alreadyDone={answers[step.id] === 'done'}
          onDone={() => setAnswer(step.id, 'done')}
        />
      );
    case 'personalising':
      return (
        <Personalising
          rows={step.rows}
          durationMs={step.durationMs}
          alreadyDone={answers[step.id] === 'done'}
          onDone={() => setAnswer(step.id, 'done')}
        />
      );
    case 'growth':
      return (
        <GrowthChart
          goal={answers[step.goalKey ?? 'goal'] as string | undefined}
          onRescan={goToScan}
        />
      );
    case 'cta':
      return <CtaCard body={step.body} icon={step.icon} />;
    case 'profile-summary':
      return <ProfileSummary onRescan={goToScan} />;
    case 'content-dna':
      return <ContentDna onRescan={goToScan} />;
    case 'text':
      // No container box — the "@" prefix + field float directly on the themed
      // background. Big font + tall touch target; caret/selection use the accent.
      return (
        <View style={styles.textStep}>
          {step.prefix ? <Text style={styles.textPrefix}>{step.prefix}</Text> : null}
          <TextInput
            style={styles.textInput}
            value={(answers[step.id] as string | undefined) ?? ''}
            onChangeText={(t) => setAnswer(step.id, t)}
            placeholder={step.placeholder}
            placeholderTextColor={palette.muted}
            selectionColor={palette.accent}
            cursorColor={palette.accent}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      );
  }
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: Radius.pill,
      backgroundColor: palette.line,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
    },
    counter: {
      ...(Type.caption as TextStyle),
      color: palette.muted,
    },
    body: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
      gap: Spacing.xxl,
    },
    stepArea: { gap: Spacing.md },
    // Boxless @username field: big text + tall touch target, floating directly
    // on the themed background (no card / border / fill). Centered + balanced.
    textStep: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xl,
    },
    textPrefix: {
      fontSize: 34,
      lineHeight: 42,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: palette.muted,
      marginRight: Spacing.xs,
    },
    textInput: {
      flexShrink: 1,
      minWidth: 160,
      fontSize: 34,
      lineHeight: 42,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: palette.ink,
      paddingVertical: Spacing.md,
    },
    footer: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    pressed: { opacity: 0.6 },
  });
