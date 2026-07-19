import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlackButton } from '@/components/black-button';
import { HapticPressable } from '@/components/haptic-pressable';
import { AppPalette, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/contexts/theme';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success (with email confirmation OFF) the route guard flips and enters
    // the tabs automatically. If confirmation is ON, no session is created until
    // the emailed link is clicked. Phase 1 does not add a confirmation screen.
  };

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
        <Ionicons name="chevron-back" size={26} color={palette.ink} />
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
            placeholderTextColor={palette.muted}
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
            placeholderTextColor={palette.muted}
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
            placeholderTextColor={palette.muted}
            secureTextEntry
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BlackButton
        label={submitting ? 'Creating account…' : 'Create account'}
        variant="solid"
        onPress={handleSubmit}
      />

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

const makeStyles = (palette: AppPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.xl,
    },
    head: { gap: Spacing.xs },
    title: { ...(Type.display as TextStyle), color: palette.ink },
    subtitle: { ...(Type.body as TextStyle), color: palette.muted },

    form: { gap: Spacing.lg },
    field: { gap: Spacing.sm },
    label: { ...(Type.caption as TextStyle), color: palette.muted },
    input: {
      ...(Type.body as TextStyle),
      color: palette.ink,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },

    error: { ...(Type.body as TextStyle), color: palette.warn, marginTop: -Spacing.md },

    switchLink: { alignItems: 'center', paddingVertical: Spacing.sm },
    switchText: { ...(Type.body as TextStyle), color: palette.muted },
    switchStrong: { color: palette.accent, fontWeight: '600' },

    pressed: { opacity: 0.6 },
  });
