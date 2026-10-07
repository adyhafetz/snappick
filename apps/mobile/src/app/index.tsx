import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

export default function Index() {
  const { loading, session } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  return <Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
});
