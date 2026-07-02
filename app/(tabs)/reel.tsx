import { StyleSheet, Text, View } from 'react-native';

// Phase 1: near-empty screen. Centered label only. No content, no styling.
export default function ReelScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Reel</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 20 },
});
