import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export function LoadingScreen() {
  return <View style={styles.container}><ActivityIndicator color={colors.primary} size="large" /></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
});
