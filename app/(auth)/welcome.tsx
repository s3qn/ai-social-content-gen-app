import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlackButton } from '@/components/black-button';
import { VirloWave } from '@/components/virlo-wave';
import { WelcomeAura } from '@/components/welcome-aura';
import { AppPalette, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/contexts/theme';

// Mirrors carousel.tsx: change this one const to rebrand the wordmark.
const APP_NAME = 'Larch';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { startAnonymous } = useAuth();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the anonymous session lands, the router guard swaps this group out for
  // the onboarding group, so there is no explicit navigation to do here. If
  // anonymous sign-ins are disabled in the Supabase dashboard we surface the
  // error instead of leaving a dead button.
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await startAnonymous();
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      <WelcomeAura />
      <VirloWave />

      <View style={styles.hero}>
        <Text style={styles.wordmark}>{APP_NAME}</Text>
        <Text style={styles.tagline}>Turn one idea into a week of scroll-stopping posts.</Text>
      </View>

      <View style={styles.actions}>
        {/* Getting started does NOT require signing up: it opens an anonymous
            Supabase session (a real user id, so RLS works) and drops straight
            into onboarding. Creating an email account is optional and lives
            behind "Log in" → "Create account"; its payoff is syncing and
            connecting more than one Instagram account. */}
        <BlackButton label={busy ? 'Starting…' : 'Get started'} variant="solid" onPress={start} />
        <BlackButton label="Log in" variant="outline" onPress={() => router.push('/sign-in')} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg,
      paddingHorizontal: Spacing.xl,
      justifyContent: 'space-between',
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.md,
    },
    wordmark: {
      ...(Type.display as TextStyle),
      color: palette.ink,
      fontSize: 44, // hero-scale the display token
    },
    tagline: {
      ...(Type.heading as TextStyle),
      color: palette.muted,
      fontWeight: '400',
    },
    actions: {
      gap: Spacing.md,
      marginBottom: 140, // lift the buttons so the mascot is visible below them
    },
    error: {
      ...(Type.body as TextStyle),
      color: palette.warn,
      textAlign: 'center',
    },
  });
