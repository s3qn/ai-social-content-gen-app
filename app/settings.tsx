import { StyleSheet, View } from 'react-native';

import { BlackButton } from '@/components/black-button';
import { Palette, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';

// Minimal settings screen, pushed from the header gear. Just log out for now
// (testing); real settings land here in a later phase. On sign-out the auth
// guard flips and the navigator redirects back to the welcome flow.
export default function SettingsScreen() {
  const { signOut } = useAuth();
  return (
    <View style={styles.container}>
      <BlackButton label="Log out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.bg,
    padding: Spacing.xl,
  },
});
