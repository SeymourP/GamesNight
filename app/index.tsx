import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🃏 Games Night</Text>
      <Text style={styles.subtitle}>BLE Test Coming Soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#f0c040',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    fontSize: 16,
  },
});