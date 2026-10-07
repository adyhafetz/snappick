import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { CONSENT_VERSION, hasImageStorageConsent } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

export default function ImageStorageConsentScreen() {
  const { profile, profileLoading, profileError, updateProfile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (profileLoading) return <LoadingScreen />;
  if (hasImageStorageConsent(profile)) return <Redirect href="/(consent)/safety" />;

  async function accept() {
    setBusy(true);
    setMessage(null);
    try {
      await updateProfile({
        image_storage_consent: true,
        image_storage_consent_at: new Date().toISOString(),
        image_storage_consent_version: CONSENT_VERSION,
      });
      router.replace('/(consent)/safety');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not save your choice.');
    } finally {
      setBusy(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.step}>STEP 1 OF 2</Text>
    <Text style={styles.title}>Keep your photos private by default</Text>
    <Text style={styles.body}>SnapPick can save a compressed copy of a scan for a short retention period so you can review it later. Photos stay in your private account and are not used for training unless you separately opt in.</Text>
    <View style={styles.notice}><Text style={styles.noticeTitle}>Before you continue</Text><Text style={styles.noticeBody}>Avoid faces, identity documents, vehicle plates, and children in photos. SnapPick strips location metadata before an upload.</Text></View>
    {profileError && <Text accessibilityRole="alert" style={styles.error}>{profileError} Pull to retry or try again below.</Text>}
    {message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    <Pressable disabled={busy || !profile} onPress={() => void accept()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>I understand and agree</Text>}
    </Pressable>
    <Pressable disabled={busy} onPress={() => setMessage('Image storage consent is required to use SnapPick. Your choice has not been changed.')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Decline for now</Text></Pressable>
    {profileError && <Pressable onPress={() => void refreshProfile()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 37, marginTop: spacing.sm },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  notice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: spacing.xl, padding: spacing.md },
  noticeTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  noticeBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  error: { backgroundColor: colors.dangerSurface, borderRadius: 8, color: colors.danger, marginTop: spacing.md, padding: spacing.sm },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, justifyContent: 'center', marginTop: spacing.xl, minHeight: 52 },
  pressed: { backgroundColor: colors.primaryDark },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  retry: { alignItems: 'center', marginTop: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '800' },
});
