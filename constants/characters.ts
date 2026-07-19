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
  /** Brand color — the character's identity hue. Carries white text (buttons, markers). */
  primary: string;
  /**
   * Fill of the header hill. Split from `primary` because a hill may be far
   * lighter than the accent it pairs with (Virlo's lime header vs its deep-green
   * buttons), and only the accent has to survive white text on top of it.
   */
  hillFill: string;
  /** Header hill gradient stops (top → bottom). */
  hillTop: string;
  hillBottom: string;
  /** Full-screen page background — a very light wash of `primary`. */
  backgroundTint: string;
  /** Card background on the tinted page (kept white). */
  surface: string;
  /** Text/icon color placed on the colored hill. Dark when the hill is light. */
  onHill: string;
  /** Secondary text on the hill. */
  onHillMuted: string;
  /** Scrim behind the header pill — tuned to stay visible on this hill's lightness. */
  pillScrim: string;
  /** Marker / highlight accent (may equal `primary` or a deeper shade). */
  accent: string;
  /** Layered footer hill colors, back-to-front (lightest ridge first). */
  footerHills: string[];
};

/** Footer ridge count — every character supplies exactly this many `footerHills`. */
export const FOOTER_LAYER_COUNT = 4;

export const CHARACTERS: Record<CharacterId, CharacterTheme> = {
  // Home tab — the only fully-designed character this build.
  virlo: {
    id: 'virlo',
    name: 'Virlo',
    tagline: 'Viral Growth',
    // Accent stays a deep lime so white text/markers still read on it.
    primary: '#3A8402',
    // The hill is the light lime from the design frame. Because it is light,
    // on-hill ink flips to dark — the status bar is already dark in light mode.
    hillFill: '#CFE58F',
    hillTop: '#CFE58F',
    hillBottom: '#BCD96B',
    backgroundTint: '#F5F9EC',
    surface: Palette.surface,
    onHill: '#26330F',
    onHillMuted: 'rgba(38,51,15,0.66)',
    pillScrim: 'rgba(255,255,255,0.55)',
    accent: '#3A8402',
    // Ridge 0 is the header's own lime, so the top and bottom of the screen
    // resolve to the same tone and read as one frame.
    footerHills: ['#CFE58F', '#A6CE58', '#79B024', '#54900E'],
  },
  // The next three are placeholders so the type is exhaustive and their
  // screens can adopt them later by swapping one import. Tune hues at design time.
  statto: {
    id: 'statto',
    name: 'Statto',
    tagline: 'Smart Insights',
    primary: '#1E63C4',
    hillFill: '#1E63C4',
    hillTop: '#3B82E0',
    hillBottom: '#1E63C4',
    backgroundTint: '#EFF4FB',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#1E63C4',
    footerHills: ['#6BA3EC', '#3B82E0', '#1E63C4', '#164B96'],
  },
  enga: {
    id: 'enga',
    name: 'Enga',
    tagline: 'Engagement',
    primary: '#7A3FB0',
    hillFill: '#7A3FB0',
    hillTop: '#9A5AD0',
    hillBottom: '#7A3FB0',
    backgroundTint: '#F5F0FA',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#7A3FB0',
    footerHills: ['#B584DF', '#9A5AD0', '#7A3FB0', '#5C2E86'],
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    tagline: 'Momentum',
    primary: '#E5A81E',
    hillFill: '#E5A81E',
    hillTop: '#F2BE3E',
    hillBottom: '#E5A81E',
    backgroundTint: '#FCF6E7',
    surface: Palette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.86)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#E5A81E',
    footerHills: ['#F7D275', '#F2BE3E', '#E5A81E', '#B48212'],
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
    // Dark mode keeps a deep hill, so on-hill ink stays white here.
    primary: '#4F8F15',
    hillFill: '#3E6B18',
    hillTop: '#3E6B18',
    hillBottom: '#2C4D11',
    backgroundTint: '#0F1408',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#4F8F15',
    footerHills: ['#3E6B18', '#325713', '#26430E', '#1A2E09'],
  },
  statto: {
    id: 'statto',
    name: 'Statto',
    tagline: 'Smart Insights',
    primary: '#3573C8',
    hillFill: '#3573C8',
    hillTop: '#274F86',
    hillBottom: '#1B3A63',
    backgroundTint: '#0C1420',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#3573C8',
    footerHills: ['#3B6FA8', '#274F86', '#1B3A63', '#0F2039'],
  },
  enga: {
    id: 'enga',
    name: 'Enga',
    tagline: 'Engagement',
    primary: '#7A4DAB',
    hillFill: '#7A4DAB',
    hillTop: '#5E3A85',
    hillBottom: '#472C64',
    backgroundTint: '#150E1D',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.82)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#7A4DAB',
    footerHills: ['#7A55A8', '#5E3A85', '#472C64', '#2C1B40'],
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    tagline: 'Momentum',
    primary: '#D9A02A',
    hillFill: '#D9A02A',
    hillTop: '#A6791C',
    hillBottom: '#7D5B14',
    backgroundTint: '#1A1405',
    surface: darkPalette.surface,
    onHill: '#FFFFFF',
    onHillMuted: 'rgba(255,255,255,0.86)',
    pillScrim: 'rgba(255,255,255,0.18)',
    accent: '#D9A02A',
    footerHills: ['#C9993A', '#A6791C', '#7D5B14', '#4F3A0D'],
  },
};

/** Pick the character registry for the active scheme. */
export function charactersFor(scheme: 'light' | 'dark'): Record<CharacterId, CharacterTheme> {
  return scheme === 'dark' ? CHARACTERS_DARK : CHARACTERS;
}
