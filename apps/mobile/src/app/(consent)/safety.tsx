import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { CONSENT_VERSION, hasImageStorageConsent, hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

export default function SafetyConsentScreen() {
  const { profile, profileLoading, profileError, updateProfile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (profileLoading) return <LoadingScreen />;
  if (!hasImageStorageConsent(profile)) return <Redirect href="/(consent)/image-storage" />;
  if (hasRequiredConsents(profile)) return <Redirect href="/(tabs)" />;

  async function accept() {
    setBusy(true);
    setMessage(null);
    try {
      await updateProfile({
        community_pickup_safety_acknowledged: true,
        community_pickup_safety_acknowledged_at: new Date().toISOString(),
        community_pickup_safety_acknowledged_version: CONSENT_VERSION,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not save your choice.');
    } finally {
      setBusy(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.step}>STEP 2 OF 2</Text>
    <Text style={styles.title}>Community pickups need a safety check</Text>
    <Text style={styles.body}>SnapPick connects neighbours for community pickups. You remain responsible for following local guidance and for deciding what is safe to hand over.</Text>
    <Text style={styles.item}>• Keep people, pets, and valuables away from pickup items.</Text>
    <Text style={styles.item}>• Never hand over hazardous, leaking, sharp, or unknown materials.</Text>
    <Text style={styles.item}>• Meet only in a safe, public place and use the in-app report tools if something feels wrong.</Text>
    {profileError && <Text accessibilityRole="alert" style={styles.error}>{profileError}</Text>}
    {message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    <Pressable disabled={busy || !profile} onPress={() => void accept()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>I understand and acknowledge</Text>}
    </Pressable>
    <Pressable disabled={busy} onPress={() => setMessage('The safety acknowledgement is required to use pickups. Your choice has not been changed.')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Decline for now</Text></Pressable>
    {profileError && <Pressable onPress={() => void refreshProfile()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 37, marginTop: spacing.sm },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  item: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  error: { backgroundColor: colors.dangerSurface, borderRadius: 8, color: colors.danger, marginTop: spacing.md, padding: spacing.sm },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, justifyContent: 'center', marginTop: spacing.xl, minHeight: 52 },
  pressed: { backgroundColor: colors.primaryDark },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  retry: { alignItems: 'center', marginTop: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '800' },
});
