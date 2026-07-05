import { router } from 'expo-router';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlackButton } from '@/components/black-button';
import { VirloWave } from '@/components/virlo-wave';
import { WelcomeAura } from '@/components/welcome-aura';
import { Palette, Spacing, Type } from '@/constants/theme';

// Mirrors carousel.tsx: change this one const to rebrand the wordmark.
const APP_NAME = 'Larch';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

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
        <BlackButton label="Create account" variant="solid" onPress={() => router.push('/sign-up')} />
        <BlackButton label="Log in" variant="outline" onPress={() => router.push('/sign-in')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.bg,
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
    color: Palette.ink,
    fontSize: 44, // hero-scale the display token
  },
  tagline: {
    ...(Type.heading as TextStyle),
    color: Palette.muted,
    fontWeight: '400',
  },
  actions: {
    gap: Spacing.md,
    marginBottom: 140, // lift the buttons so the mascot is visible below them
  },
});
