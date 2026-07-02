import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

// TEMPORARY haptics self-test. Remove once haptics are confirmed working.
// Press the button: you should see the alert AND feel a strong triple-tap.
// - Alert shows but NO tap  -> code runs, device is suppressing haptics
//   (Low Power Mode on? Camera/dictation active? -> see Expo docs caveat)
// - No alert at all         -> you are not running this build yet
export default function BrainstormScreen() {
  const [count, setCount] = useState(0);

  async function runTest() {
    const next = count + 1;
    setCount(next);
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // notificationAsync(Success) is a distinct triple-tap — far easier to
        // feel than a single impact.
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      Alert.alert('Haptic test', `Fired OK (press #${next}). Feel it?`);
    } catch (e) {
      Alert.alert('Haptic test FAILED', String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Brainstorm</Text>
      <Pressable
        onPress={runTest}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <Text style={styles.buttonText}>Tap to test haptics</Text>
      </Pressable>
      <Text style={styles.hint}>Presses: {count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  label: { fontSize: 20 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  hint: { fontSize: 14, color: '#666' },
});
