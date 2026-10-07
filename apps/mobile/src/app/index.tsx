import { Redirect } from 'expo-router';
import { Pressable, Text, StyleSheet, View } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

export default function Index() {
  const { loading, session, profile, profileLoading, profileError, refreshProfile } = useAuth();
  if (loading || (session && profileLoading)) return <LoadingScreen />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profileError) return <View style={styles.loading}><Text style={styles.error}>{profileError}</Text><Pressable onPress={() => void refreshProfile()}><Text style={styles.retry}>Try again</Text></Pressable></View>;
  return <Redirect href={hasRequiredConsents(profile) ? '/(tabs)' : '/(consent)/image-storage'} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 16, padding: 24, textAlign: 'center' },
  retry: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});
