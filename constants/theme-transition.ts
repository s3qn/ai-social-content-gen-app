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

import { CHARACTERS, CHARACTERS_DARK, CharacterId, CharacterTheme } from './characters';

// Tab order === character order.
export const CHAR_ORDER: CharacterId[] = ['virlo', 'statto', 'enga', 'spark'];

// Interpolation input range, one stop per character.
export const INPUT = CHAR_ORDER.map((_, i) => i);

// A frozen set of color ramps (plain string[] — safely captured inside
// worklets), one per scheme. Note each character has primary === accent ===
// hillBottom === footerHills[1], and footerHills === [hillTop, hillBottom, dark].
export type Ramps = {
  PRIMARY: string[];
  HILL_TOP: string[];
  BG_TINT: string[];
  FOOTER_DARK: string[];
  /** Footer layers back-to-front: [hillTop, primary, dark]. */
  FOOTER_RAMPS: string[][];
};

function buildRamps(reg: Record<CharacterId, CharacterTheme>): Ramps {
  const PRIMARY = CHAR_ORDER.map((id) => reg[id].primary);
  const HILL_TOP = CHAR_ORDER.map((id) => reg[id].hillTop);
  const BG_TINT = CHAR_ORDER.map((id) => reg[id].backgroundTint);
  const FOOTER_DARK = CHAR_ORDER.map((id) => reg[id].footerHills[2]);
  return { PRIMARY, HILL_TOP, BG_TINT, FOOTER_DARK, FOOTER_RAMPS: [HILL_TOP, PRIMARY, FOOTER_DARK] };
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

// On-hill text/icon color is white for every character, in both schemes.
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
