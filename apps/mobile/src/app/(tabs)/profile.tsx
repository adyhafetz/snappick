import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const { profile, profileLoading, session, signOut, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [storageSaving, setStorageSaving] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveDetails() {
    const nextName = displayName.trim();
    const nextPhone = phone.trim();
    if (!nextName) {
      setError('Enter a display name.');
      return;
    }
    if (nextPhone.length > 30) {
      setError('Phone numbers must be 30 characters or fewer.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ display_name: nextName, phone: nextPhone || null });
      setNotice('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTrainingOptIn(value: boolean) {
    setTrainingSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ training_opt_in: value, training_opt_in_at: value ? new Date().toISOString() : null });
      setNotice(value ? 'Training opt-in enabled.' : 'Training opt-in disabled.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save that privacy choice.');
    } finally {
      setTrainingSaving(false);
    }
  }

  async function revokeImageStorage() {
    setStorageSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ image_storage_consent: false, image_storage_consent_at: null, image_storage_consent_version: null });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save that privacy choice.');
      setStorageSaving(false);
    }
  }

  if (profileLoading || !profile) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return <SafeAreaView edges={['top']} style={styles.safe}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>SnapPick</Text>
    <Text style={styles.title}>Your account</Text>
    <Text style={styles.email}>{session?.user.email ?? 'Signed-in user'}</Text>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Personal details</Text>
      <Text style={styles.label}>Display name</Text>
      <TextInput autoCapitalize="words" onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} value={displayName} />
      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="For pickup coordination" placeholderTextColor={colors.muted} style={styles.input} value={phone} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <Pressable disabled={saving} onPress={() => void saveDetails()} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        {saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Save details</Text>}
      </Pressable>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Privacy</Text>
      <View style={styles.row}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Allow scan image storage</Text><Text style={styles.rowBody}>Required for SnapPick scans. Turn this off to leave the app and revisit consent later.</Text></View>
        <Switch accessibilityLabel="Allow scan image storage" disabled={storageSaving} onValueChange={(value) => { if (!value) void revokeImageStorage(); }} value={profile.image_storage_consent} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} />
      </View>
      <View style={styles.row}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Help improve SnapPick</Text><Text style={styles.rowBody}>Allow eligible, consented images to be considered for future detector training. This is stored now; uploads are added in a later phase.</Text></View>
        <Switch accessibilityLabel="Help improve SnapPick" disabled={trainingSaving} onValueChange={(value) => void toggleTrainingOptIn(value)} value={profile.training_opt_in} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} />
      </View>
    </View>

    <Pressable disabled style={styles.deleteButton}><Text style={styles.deleteText}>Delete account is not available in this build.</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}><Text style={styles.signOutText}>Sign out</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  loading: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginTop: spacing.lg },
  email: { color: colors.muted, fontSize: 14, marginTop: spacing.xxs },
  section: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.xl, paddingTop: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.xxs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md },
  error: { backgroundColor: colors.dangerSurface, borderRadius: 8, color: colors.danger, marginTop: spacing.md, padding: spacing.sm },
  notice: { backgroundColor: colors.successSurface, borderRadius: 8, color: colors.success, marginTop: spacing.md, padding: spacing.sm },
  button: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: 8, justifyContent: 'center', marginTop: spacing.lg, minHeight: 50 },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 78, paddingVertical: spacing.sm },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  deleteButton: { alignItems: 'flex-start', borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: 'center', marginTop: spacing.xl, minHeight: 50, paddingHorizontal: spacing.md },
  deleteText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  signOut: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, minHeight: 48 },
  signOutPressed: { backgroundColor: colors.dangerSurface },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
});
