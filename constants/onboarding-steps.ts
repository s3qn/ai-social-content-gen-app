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
  /** F4 — option `value` seeded on first view so the user only has to adjust. */
  defaultValue?: string;
};

/** Multi-select card list with optional min/max (F3–F6). */
export type MultiSelectStep = StepBase & {
  type: 'multi-select';
  options: SelectOption[];
  min?: number;
  max?: number;
  /** F4 — option `value`s seeded on first view so the user only has to adjust. */
  defaultValues?: string[];
};

/** Segmented control — Often/Sometimes/Never, Yes/No (F4+). */
export type SegmentedStep = StepBase & {
  type: 'segmented';
  options: SelectOption[];
  /** F4 — option `value` seeded on first view so the user only has to adjust. */
  defaultValue?: string;
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
  /** F4 — option `value` seeded on first view so the user only has to adjust. */
  defaultValue?: string;
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

  // F4 — Creator DNA quiz. Continues from the F3 Content DNA reveal and profiles
  // the creator's niche, topics, style, habits and gear. All config-driven and
  // reusing the F1/F2 archetypes; answers persist by `id`. The closing card
  // (dna_complete) is a plain CTA that just advances — it deliberately does NOT
  // call complete(); that belongs to F6's paywall, which appends after this.
  {
    id: 'niche',
    type: 'single-select',
    mascotText: 'What best describes your niche?',
    defaultValue: 'lifestyle_vlogs',
    options: [
      { value: 'fashion_beauty', label: 'Fashion & Beauty', icon: 'shirt-outline' },
      { value: 'fitness_health', label: 'Fitness & Health', icon: 'barbell-outline' },
      { value: 'food_cooking', label: 'Food & Cooking', icon: 'restaurant-outline' },
      { value: 'travel', label: 'Travel', icon: 'airplane-outline' },
      { value: 'tech_gaming', label: 'Tech & Gaming', icon: 'game-controller-outline' },
      { value: 'business_finance', label: 'Business & Finance', icon: 'briefcase-outline' },
      { value: 'comedy_entertainment', label: 'Comedy & Entertainment', icon: 'happy-outline' },
      { value: 'lifestyle_vlogs', label: 'Lifestyle & Vlogs', icon: 'sunny-outline' },
      { value: 'education', label: 'Education', icon: 'school-outline' },
      { value: 'art_design', label: 'Art & Design', icon: 'color-palette-outline' },
    ],
  },
  {
    id: 'niche_subtopics',
    type: 'multi-select',
    mascotText: 'Which of these do you cover? Pick any that fit.',
    min: 1,
    defaultValues: ['tips_howtos', 'behind_the_scenes'],
    options: [
      { value: 'tips_howtos', label: 'Tips & how-tos', icon: 'bulb-outline' },
      { value: 'reviews', label: 'Product reviews', icon: 'pricetag-outline' },
      { value: 'behind_the_scenes', label: 'Behind the scenes', icon: 'aperture-outline' },
      { value: 'trends_news', label: 'Trends & news', icon: 'trending-up-outline' },
      { value: 'tutorials', label: 'Tutorials', icon: 'construct-outline' },
      { value: 'qa_advice', label: 'Q&A / advice', icon: 'chatbubbles-outline' },
      { value: 'storytelling', label: 'Storytelling', icon: 'book-outline' },
      { value: 'challenges', label: 'Challenges', icon: 'flame-outline' },
    ],
  },
  {
    id: 'personal_topics',
    type: 'multi-select',
    mascotText: 'What else are you into? Choose 2–5 personal topics.',
    min: 2,
    max: 5,
    defaultValues: ['travel', 'food'],
    options: [
      { value: 'family', label: 'Family & relationships', icon: 'people-outline' },
      { value: 'travel', label: 'Travel', icon: 'airplane-outline' },
      { value: 'food', label: 'Food', icon: 'fast-food-outline' },
      { value: 'fitness', label: 'Fitness', icon: 'barbell-outline' },
      { value: 'mental_health', label: 'Mental health', icon: 'heart-outline' },
      { value: 'career', label: 'Career', icon: 'briefcase-outline' },
      { value: 'money', label: 'Money', icon: 'cash-outline' },
      { value: 'pets', label: 'Pets', icon: 'paw-outline' },
      { value: 'music', label: 'Music', icon: 'musical-notes-outline' },
      { value: 'fashion', label: 'Fashion', icon: 'shirt-outline' },
    ],
  },
  {
    id: 'visual_style',
    type: 'single-select',
    mascotText: 'Which visual style feels most like you?',
    defaultValue: 'bright_colorful',
    options: [
      { value: 'bright_colorful', label: 'Bright & Colorful', icon: 'color-palette-outline' },
      { value: 'clean_minimal', label: 'Clean & Minimal', icon: 'square-outline' },
      { value: 'dark_moody', label: 'Dark & Moody', icon: 'moon-outline' },
      { value: 'warm_natural', label: 'Warm & Natural', icon: 'leaf-outline' },
      { value: 'bold_contrast', label: 'Bold & High-contrast', icon: 'contrast-outline' },
      { value: 'vintage_film', label: 'Vintage / Film', icon: 'film-outline' },
    ],
  },
  {
    id: 'grow_faster',
    type: 'interstitial',
    mascotText: 'One thing worth knowing…',
    defaultValue: 'yes',
    headline: 'Creators who follow a plan grow ~70% faster.',
    body: 'We’ll turn your Creator DNA into a plan built around what you love making.',
    options: [
      { value: 'yes', label: 'I’m in' },
      { value: 'later', label: 'Tell me more' },
    ],
  },
  {
    id: 'camera_frequency',
    type: 'segmented',
    mascotText: 'How often are you comfortable on camera?',
    defaultValue: 'sometimes',
    options: [
      { value: 'often', label: 'Often' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'never', label: 'Never' },
    ],
  },
  {
    id: 'equipment',
    type: 'multi-select',
    mascotText: 'What gear do you have to work with?',
    min: 1,
    defaultValues: ['smartphone'],
    options: [
      { value: 'smartphone', label: 'Smartphone', icon: 'phone-portrait-outline' },
      { value: 'dslr', label: 'DSLR / Mirrorless', icon: 'camera-outline' },
      { value: 'ring_light', label: 'Ring light', icon: 'bulb-outline' },
      { value: 'tripod', label: 'Tripod', icon: 'videocam-outline' },
      { value: 'external_mic', label: 'External mic', icon: 'mic-outline' },
      { value: 'gimbal', label: 'Gimbal', icon: 'move-outline' },
      { value: 'none_yet', label: 'None yet', icon: 'close-circle-outline' },
    ],
  },
  {
    id: 'dna_complete',
    type: 'cta',
    mascotText: 'Your Creator DNA is all set!',
    body: 'I’ve got a clear picture of who you are as a creator. Let’s build your plan.',
    buttonLabel: 'Continue',
    icon: 'sparkles',
  },
];
