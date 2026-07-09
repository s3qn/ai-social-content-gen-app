/**
 * Per-character theme registry.
 *
 * The app has four mascot characters, each owning a tab and painting that
 * tab's screen in its signature color: a curved "hill" header, a full-screen
 * background wash, and accent color for markers/highlights.
 *
 * A screen statically knows which character it is (Home = Virlo), so it imports
 * its theme from here and passes it as a `theme` prop to the shared presentational
 * components (HillHeader, HillFooter, StatCard, PlanCalendar, InstagramPill).
 * No React context — there is no dynamic character switching within a screen.
 *
 * Only chromatic roles live here. Neutral tokens (ink/muted/line/surface) come
 * from `theme.ts` so this file never duplicates the neutral design layer.
 */
import { darkPalette, Palette } from './theme';

export type CharacterId = 'virlo' | 'statto' | 'enga' | 'spark';

export type CharacterTheme = {
  id: CharacterId;
  /** Display name, e.g. "Virlo". */
  name: string;
  /** One-line role, e.g. "Viral Growth". */
  tagline: string;
  /** Brand color — the character's identity hue. */
  primary: string;
  /** Header hill gradient stops (top → bottom). */
  hillTop: string;
  hillBottom: string;
  /** Full-screen page background — a very light wash of `primary`. */
  backgroundTint: string;
  /** Card background on the tinted page (kept white). */
  surface: string;
  /** Text/icon color placed on the colored hill (near-white). */
  onHill: string;
  /** Secondary text on the hill. */
  onHillMuted: string;
  /** Marker / highlight accent (may equal `primary` or a deeper shade). */
  accent: string;
  /** Layered footer hill colors, back-to-front. */
  footerHills: string[];
};

export const CHARACTERS: Record<CharacterId, CharacterTheme> = {
  // Home tab — the only fully-designed character this build.
  virlo: {
    id: 'virlo',
    name: 'Virlo',
    tagline: 'Viral Growth',
    primary: '#2E7D32',
    hillTop: '#3B9A41',
    hillBottom: '#2E7D32',
    backgroundTint: '#F1F7F0',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#2E7D32',
    footerHills: ['#3B9A41', '#2E7D32', '#215B26'],
  },
  // The next three are placeholders so the type is exhaustive and their
  // screens can adopt them later by swapping one import. Tune hues at design time.
  statto: {
    id: 'statto',
    name: 'Statto',
    tagline: 'Smart Insights',
    primary: '#1E63C4',
    hillTop: '#3B82E0',
    hillBottom: '#1E63C4',
    backgroundTint: '#EFF4FB',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#1E63C4',
    footerHills: ['#3B82E0', '#1E63C4', '#164B96'],
  },
  enga: {
    id: 'enga',
    name: 'Enga',
    tagline: 'Engagement',
    primary: '#7A3FB0',
    hillTop: '#9A5AD0',
    hillBottom: '#7A3FB0',
    backgroundTint: '#F5F0FA',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#7A3FB0',
    footerHills: ['#9A5AD0', '#7A3FB0', '#5C2E86'],
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    tagline: 'Momentum',
    primary: '#E5A81E',
    hillTop: '#F2BE3E',
    hillBottom: '#E5A81E',
    backgroundTint: '#FCF6E7',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.86)',
    accent: '#E5A81E',
    footerHills: ['#F2BE3E', '#E5A81E', '#B48212'],
  },
};

/**
 * Dark-mode variants of each character. Same shape/keys as the light registry,
 * but with darker hills/background-tint/footers and neutrals sourced from
 * `darkPalette`. The colored hills stay vivid enough that white on-hill text
 * still reads, so `onHill`/`onHillMuted` are unchanged. Selected reactively by
 * `useTheme().scheme` wherever a character theme (or its animated ramp) is used.
 */
export const CHARACTERS_DARK: Record<CharacterId, CharacterTheme> = {
  virlo: {
    id: 'virlo',
    name: 'Virlo',
    tagline: 'Viral Growth',
    primary: '#3E9A45',
    hillTop: '#2C6E31',
    hillBottom: '#1F4F23',
    backgroundTint: '#0E1A0F',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#3E9A45',
    footerHills: ['#2C6E31', '#1F4F23', '#122F15'],
  },
  statto: {
    id: 'statto',
    name: 'Statto',
    tagline: 'Smart Insights',
    primary: '#3573C8',
    hillTop: '#274F86',
    hillBottom: '#1B3A63',
    backgroundTint: '#0C1420',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#3573C8',
    footerHills: ['#274F86', '#1B3A63', '#0F2039'],
  },
  enga: {
    id: 'enga',
    name: 'Enga',
    tagline: 'Engagement',
    primary: '#7A4DAB',
    hillTop: '#5E3A85',
    hillBottom: '#472C64',
    backgroundTint: '#150E1D',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    accent: '#7A4DAB',
    footerHills: ['#5E3A85', '#472C64', '#2C1B40'],
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    tagline: 'Momentum',
    primary: '#D9A02A',
    hillTop: '#A6791C',
    hillBottom: '#7D5B14',
    backgroundTint: '#1A1405',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.86)',
    accent: '#D9A02A',
    footerHills: ['#A6791C', '#7D5B14', '#4F3A0D'],
  },
};

/** Pick the character registry for the active scheme. */
export function charactersFor(scheme: 'light' | 'dark'): Record<CharacterId, CharacterTheme> {
  return scheme === 'dark' ? CHARACTERS_DARK : CHARACTERS;
}
