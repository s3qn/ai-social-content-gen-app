/**
 * Cross-tab color transition driver.
 *
 * A single module-level animated scalar (`themeIndex`, 0..3) holds the currently
 * focused character. Every color surface (hill header, background wash, footer
 * hills, accents) reads it via `interpolateColor(themeIndex.value, INPUT, RAMP)`,
 * so switching tabs cross-fades the whole scheme in lockstep. Each screen nudges
 * it on focus via `transitionToCharacter`.
 *
 * This mirrors the module-singleton idiom of `components/screen-swirl.tsx`
 * (`playScreenSwirl`) — a shared trigger with no React context. All four tab
 * screens stay mounted (native-tabs `freezeContents={false}`), so a self-driving
 * global value keeps every screen's chrome coherent, including offscreen ones.
 */
import { Easing, makeMutable, withTiming } from 'react-native-reanimated';

import {
  CHARACTERS,
  CHARACTERS_DARK,
  CharacterId,
  CharacterTheme,
  FOOTER_LAYER_COUNT,
} from './characters';

// Tab order === character order.
export const CHAR_ORDER: CharacterId[] = ['virlo', 'statto', 'enga', 'spark'];

// Interpolation input range, one stop per character.
export const INPUT = CHAR_ORDER.map((_, i) => i);

// A frozen set of color ramps (plain string[] — safely captured inside
// worklets), one per scheme. `HILL` is deliberately separate from `PRIMARY`:
// a character's header can be far lighter than its accent (Virlo's lime hill
// vs its deep-green buttons), so the two roles no longer share one value.
export type Ramps = {
  PRIMARY: string[];
  /** Header hill fill, per character. */
  HILL: string[];
  HILL_TOP: string[];
  BG_TINT: string[];
  /** One ramp per footer ridge, back-to-front — derived from `footerHills`. */
  FOOTER_RAMPS: string[][];
  /** Ink on the hill, one entry per character — stepped, never interpolated. */
  ON_HILL_INKS: string[];
  /** Header pill scrim, one entry per character — stepped, never interpolated. */
  PILL_SCRIMS: string[];
};

/**
 * Where on-hill ink swaps between Virlo's dark and the other characters' white.
 *
 * Ink **steps**; it is never interpolated. Virlo's hill is light lime and the other
 * three are dark, and any continuous dark→white tween necessarily passes through
 * mid-grey at the same moment the hill is itself mid-morph — measured at ~1.0:1
 * contrast, i.e. the glyph disappears. Narrowing the blend band does not fix this,
 * it only shortens the blind spot: a 0.50→0.62 band bottomed out at 1.02:1, and
 * tightening it to 0.74→0.76 still bottomed out at 1.03:1. A hard step has no
 * intermediate value to land on.
 *
 * 0.75 is the crossover where dark and white ink are equally legible against the
 * morphing hill (~3.9:1 each), so the swap never lands at the worst moment.
 */
export const INK_STEP = 0.75;

/**
 * Index of the character whose on-hill ink applies at a given `themeIndex`.
 * Worklet-safe: plain arithmetic over constants, no captured objects.
 */
export function inkIndexFor(value: number): number {
  'worklet';
  if (value < INK_STEP) return 0;
  return Math.min(3, Math.max(1, Math.round(value)));
}

function buildRamps(reg: Record<CharacterId, CharacterTheme>): Ramps {
  const PRIMARY = CHAR_ORDER.map((id) => reg[id].primary);
  const HILL = CHAR_ORDER.map((id) => reg[id].hillFill);
  const HILL_TOP = CHAR_ORDER.map((id) => reg[id].hillTop);
  const BG_TINT = CHAR_ORDER.map((id) => reg[id].backgroundTint);
  // One ramp per ridge index, so the ridge count is driven by the palette alone.
  const FOOTER_RAMPS = Array.from({ length: FOOTER_LAYER_COUNT }, (_, layer) =>
    CHAR_ORDER.map((id) => reg[id].footerHills[layer]),
  );
  const ON_HILL_INKS = CHAR_ORDER.map((id) => reg[id].onHill);
  const PILL_SCRIMS = CHAR_ORDER.map((id) => reg[id].pillScrim);
  return { PRIMARY, HILL, HILL_TOP, BG_TINT, FOOTER_RAMPS, ON_HILL_INKS, PILL_SCRIMS };
}

// Both ramp sets are derived once at module load and kept as frozen arrays. The
// animated surfaces select the active set by scheme at render time and pass
// `scheme` as an explicit useAnimatedStyle/Props dependency, so a theme switch
// re-derives the worklet and snaps to the new set (theme switches don't tween
// light↔dark; only tab changes cross-fade, driven by `themeIndex`).
export const RAMPS: Record<'light' | 'dark', Ramps> = {
  light: buildRamps(CHARACTERS),
  dark: buildRamps(CHARACTERS_DARK),
};

// Ink placed on a character's *accent* fill (calendar "today" dot, accent pill).
// Every `primary` stays dark enough to carry white, so this is a constant.
// Ink on the *header hill* is NOT constant — Virlo's hill is light lime and needs
// dark ink — so that comes from the character's own `onHill`, not from here.
export const ON_HILL = '#FFFFFF';

// The animated driver. Starts on Home (index 0).
export const themeIndex = makeMutable(0);

const TRANSITION_MS = 450;

// The first focus (cold start on Home) snaps rather than animating from 0.
let hasInit = false;

/**
 * Ease `themeIndex` toward the given character. `animate=false` (reduced motion)
 * snaps instantly. Interruption-safe: `withTiming` retargets from the current
 * value, so rapid tab taps redirect smoothly without tearing.
 */
export function transitionToCharacter(id: CharacterId, animate: boolean) {
  const target = CHAR_ORDER.indexOf(id);
  if (target < 0) return;
  if (!hasInit || !animate) {
    hasInit = true;
    themeIndex.value = target;
    return;
  }
  themeIndex.value = withTiming(target, {
    duration: TRANSITION_MS,
    easing: Easing.inOut(Easing.cubic),
  });
}
