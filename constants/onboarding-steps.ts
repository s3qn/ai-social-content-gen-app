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

/**
 * F2 — Scan. Animated checklist tied to the REAL Instagram fetch. On mount the
 * renderer reads the earlier @username answer, calls the scan service, ticks
 * the rows, stores the result in context, and enables Continue.
 */
export type ScanStep = StepBase & {
  type: 'scan';
  /** Checklist row labels shown while the fetch runs. */
  rows: string[];
  /** Answer key holding the @username to scan (defaults to 'username'). */
  usernameKey?: string;
};

/**
 * F2 — Interstitial social-proof card: mascot + headline + a light Yes/No
 * question (segmented). Used to break up the flow around the scan.
 */
export type InterstitialStep = StepBase & {
  type: 'interstitial';
  headline: string;
  body?: string;
  options: SelectOption[];
};

/**
 * F2 — Call-to-action step: mascot + optional body + a single primary button
 * (the footer button uses `buttonLabel`). No answer required; advances the flow.
 * The "Unlock Profile Summary" reveal it leads to is built in F3.
 */
export type CtaStep = StepBase & {
  type: 'cta';
  buttonLabel: string;
  body?: string;
  icon?: IoniconName;
};

/**
 * F3 — Reveal steps. Both consume the stored scan result from the onboarding
 * context (they take no extra config beyond the shared mascot header). No answer
 * is collected; a Continue/Finish advances the flow.
 *
 * `profile-summary` — real StatTrio + heuristic ScoreMeter + verdict.
 * `content-dna` — real post-type DnaBar + engagement insight + stubbed vibe/themes.
 */
export type ProfileSummaryStep = StepBase & {
  type: 'profile-summary';
};

export type ContentDnaStep = StepBase & {
  type: 'content-dna';
};

export type OnboardingStep =
  | SingleSelectStep
  | MultiSelectStep
  | SegmentedStep
  | TextStep
  | ScanStep
  | InterstitialStep
  | CtaStep
  | ProfileSummaryStep
  | ContentDnaStep;

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

  // F2 — Scan. An interstitial to set up the scan, the real fetch checklist, a
  // second interstitial for social proof, then the "Unlock" CTA (F3 builds the
  // Profile Summary reveal that the unlock leads into).
  {
    id: 'checks_analytics',
    type: 'interstitial',
    mascotText: 'Quick one before we look at your profile…',
    headline: 'Do you check your analytics every week?',
    body: 'Most creators who grow fast keep a close eye on what’s working.',
    options: [
      { value: 'yes', label: 'Yes, always' },
      { value: 'no', label: 'Not really' },
    ],
  },
  {
    id: 'scan',
    type: 'scan',
    mascotText: 'Give me a moment — I’m pulling your real numbers.',
    usernameKey: 'username',
    rows: [
      'Scanning your profile',
      'Checking your engagement',
      'Finding your top content',
    ],
  },
  {
    id: 'wants_more_reach',
    type: 'interstitial',
    mascotText: 'Got it — this is looking interesting.',
    headline: 'Want to reach more of the right people?',
    body: 'Creators using a clear content strategy grow up to 3× faster.',
    options: [
      { value: 'yes', label: 'Yes, show me' },
      { value: 'no', label: 'Maybe later' },
    ],
  },
  {
    id: 'unlock_summary',
    type: 'cta',
    mascotText: 'All done — your profile summary is ready.',
    body: 'See your real stats, engagement and a personalised score.',
    buttonLabel: 'Unlock Profile Summary',
    icon: 'sparkles',
  },

  // F3 — Reveal. The unlock CTA leads into the Profile Summary, then Content DNA.
  // Content DNA is the last step for now; the quiz (F4) will continue from here.
  {
    id: 'profile_summary',
    type: 'profile-summary',
    mascotText: 'Here’s how your profile is doing right now.',
  },
  {
    id: 'content_dna',
    type: 'content-dna',
    mascotText: 'And this is your Content DNA — what you post and how it lands.',
  },
];
