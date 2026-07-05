/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * Design tokens for the app's screens (light-first pro-utility brief).
 * Additive: does not replace the Colors/Fonts above, which the tab navigator
 * still depends on. Green and rust are the only colored inks by design.
 */
export const Palette = {
  bg: '#FBFAF7', // warm off-white
  surface: '#FFFFFF',
  ink: '#1C1B19', // near-black text
  muted: '#6B6862', // secondary text
  line: '#E8E4DC', // hairline borders
  accent: '#2E5E4E', // deep green: primary action + connected status
  warn: '#B4552D', // muted rust: attention / not connected
  tabIcon: '#838E60', // floating tab bar icon (active)
  tabIconMuted: 'rgba(131, 142, 96, 0.5)', // #838E60 @ 50% (inactive)
} as const;

// Bottom padding a scroll/scene reserves to clear the floating tab bar.
// Use as: paddingBottom = insets.bottom + TAB_BAR_CLEARANCE
export const TAB_BAR_CLEARANCE = 88; // bar height 64 + rest gap 12 + breathing 12

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const Type = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400', letterSpacing: 0 },
  stat: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
