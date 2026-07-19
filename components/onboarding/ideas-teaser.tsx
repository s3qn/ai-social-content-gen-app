import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type IdeaTeaser = {
  title: string;
  meta: string;
  icon?: IoniconName;
};

type Props = {
  headline: string;
  body?: string;
  caption: string;
  ideas: IdeaTeaser[];
};

// iOS "Reduce Transparency" → fall back to a translucent solid (also on Android).
// Same pattern as components/create-fab.tsx / create-overlay.tsx.
function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => mounted && setReduce(!!v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/**
 * F6 — locked "content ideas" teaser. A few illustrative idea cards rendered
 * BEHIND a blur with a lock badge, so the value is visible but not readable.
 * The cards are placeholder copy (no generation happens here); unlocking is the
 * paywall's job on the next step.
 */
export function IdeasTeaser({ headline, body, caption, ideas }: Props) {
  const { palette, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const reduceTransparency = useReduceTransparency();
  const useSolid = Platform.OS === 'android' || reduceTransparency;
  const isDark = scheme === 'dark';

  return (
    <View style={styles.wrap}>
      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      <View style={styles.stack}>
        {/* The (fake) ideas underneath. */}
        <View style={styles.cards}>
          {ideas.map((idea) => (
            <View key={idea.title} style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name={idea.icon ?? 'bulb-outline'} size={18} color={palette.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {idea.title}
                </Text>
                <Text style={styles.cardMeta}>{idea.meta}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* The lock layer: blur (or solid fallback) + lock badge + caption. */}
        <View style={styles.lockLayer} pointerEvents="none">
          {useSolid ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(18,17,16,0.86)' : 'rgba(251,250,247,0.86)' },
              ]}
            />
          ) : (
            <BlurView
              tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
              intensity={28}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={22} color={palette.surface} />
          </View>
          <Text style={styles.caption}>{caption}</Text>
        </View>
      </View>
    </View>
  );
}

const LOCK = 48;

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md },
    headline: {
      ...(Type.heading as TextStyle),
      color: palette.ink,
    },
    body: {
      ...(Type.body as TextStyle),
      color: palette.muted,
    },
    // Positioning context for the lock overlay; clips the blur to the rounded box.
    stack: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.sm,
    },
    cards: { gap: Spacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      padding: Spacing.lg,
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    cardText: { flex: 1, gap: 2 },
    cardTitle: {
      ...(Type.body as TextStyle),
      fontWeight: '600',
      color: palette.ink,
    },
    cardMeta: {
      ...(Type.body as TextStyle),
      fontSize: 12,
      color: palette.muted,
    },
    lockLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
    },
    lockBadge: {
      width: LOCK,
      height: LOCK,
      borderRadius: Radius.pill,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caption: {
      ...(Type.body as TextStyle),
      fontWeight: '700',
      color: palette.ink,
    },
  });
