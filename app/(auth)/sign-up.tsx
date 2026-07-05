import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlackButton } from '@/components/black-button';
import { HapticPressable } from '@/components/haptic-pressable';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  // Template only — captured but never validated or sent.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      <HapticPressable
        hitSlop={12}
        style={({ pressed }) => pressed && styles.pressed}
        onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color={Palette.ink} />
      </HapticPressable>

      <View style={styles.head}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start turning ideas into posts in minutes.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={Palette.muted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Palette.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Palette.muted}
            secureTextEntry
          />
        </View>
      </View>

      {/* Submit — mock: flips the guard, which auto-enters the tabs. */}
      <BlackButton label="Create account" variant="solid" onPress={() => signIn()} />

      <HapticPressable
        style={({ pressed }) => [styles.switchLink, pressed && styles.pressed]}
        onPress={() => router.replace('/sign-in')}>
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchStrong}>Log in</Text>
        </Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.bg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  head: { gap: Spacing.xs },
  title: { ...(Type.display as TextStyle), color: Palette.ink },
  subtitle: { ...(Type.body as TextStyle), color: Palette.muted },

  form: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
  label: { ...(Type.caption as TextStyle), color: Palette.muted },
  input: {
    ...(Type.body as TextStyle),
    color: Palette.ink,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  switchLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  switchText: { ...(Type.body as TextStyle), color: Palette.muted },
  switchStrong: { color: Palette.accent, fontWeight: '600' },

  pressed: { opacity: 0.6 },
});
