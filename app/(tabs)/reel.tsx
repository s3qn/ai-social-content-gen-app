import { StyleSheet, Text, View } from 'react-native';

import { ChatFab } from '@/components/chat-fab';

// Placeholder screen: centered label plus the shared floating chat button.
export default function ReelScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Reel</Text>
      <ChatFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 20 },
});
