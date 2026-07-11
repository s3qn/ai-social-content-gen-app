import { Ionicons } from '@expo/vector-icons';

/**
 * Config-driven onboarding step engine.
 *
 * The funnel (~21 screens in the full plan) is modeled as an ordered list of
 * step configs. A single driver screen (app/(onboarding)/step.tsx) walks this
 * array, renders the current step by its `type`, owns the progress bar + back
 * button, and writes each answer to contexts/onboarding.tsx keyed by `step.id`.
 *
 * Adding / reordering a screen = edit this array, not the driver. Only the
 * "Connect" steps ship in F1; later phases (F3–F6) append scan / quiz / goals /
 * paywall steps and reuse the same archetypes.
 */

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** A selectable card / segment option. */
export type SelectOption = {
  value: string;
  label: string;
  icon?: IoniconName;
};

/** Fields shared by every step archetype. */
type StepBase = {
  /** Answer key in the onboarding context (must be unique). */
  id: string;
  /** Question shown in the mascot speech bubble. */
  mascotText: string;
};

/** Single-select card list (pick exactly one). */
export type SingleSelectStep = StepBase & {
  type: 'single-select';
  options: SelectOption[];
};

/** Multi-select card list with optional min/max (F3–F6). */
export type MultiSelectStep = StepBase & {
  type: 'multi-select';
  options: SelectOption[];
  min?: number;
  max?: number;
};

/** Segmented control — Often/Sometimes/Never, Yes/No (F4+). */
export type SegmentedStep = StepBase & {
  type: 'segmented';
  options: SelectOption[];
};

/** Free-text entry (e.g. the @username). */
export type TextStep = StepBase & {
  type: 'text';
  placeholder?: string;
  /** Fixed adornment rendered inside the field, e.g. '@'. */
  prefix?: string;
};

export type OnboardingStep =
  | SingleSelectStep
  | MultiSelectStep
  | SegmentedStep
  | TextStep;

/**
 * F1 — Connect. Two steps: pick the platform, then enter the handle. Kept short
 * and easy to extend: append more step objects (any archetype above) to grow the
 * funnel in later features.
 */
export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'platform',
    type: 'single-select',
    mascotText: 'Which platform should we grow first?',
    options: [
      { value: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
      { value: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
      { value: 'threads', label: 'Threads', icon: 'at-outline' },
      { value: 'x', label: 'X', icon: 'logo-twitter' },
    ],
  },
  {
    id: 'username',
    type: 'text',
    mascotText: "Nice! What's your @username there?",
    placeholder: 'yourhandle',
    prefix: '@',
  },
];
