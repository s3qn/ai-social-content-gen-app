import { StyleSheet, Text, View } from 'react-native';

import { ChatFab } from '@/components/chat-fab';

// Placeholder screen: centered label plus the shared floating chat button.
export default function BrainstormScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Brainstorm</Text>
      <ChatFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 20 },
});
