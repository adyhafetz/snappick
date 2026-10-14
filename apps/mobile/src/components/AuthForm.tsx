import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

type AuthFormProps = { mode: 'sign-in' | 'sign-up' };

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isSignIn = mode === 'sign-in';

  async function submit() {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (isSignIn) await signIn(trimmedEmail, password);
      else {
        const result = await signUp(trimmedEmail, password);
        if (result.needsEmailConfirmation) setNotice('Account created. Check your email to confirm your address, then sign in.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'Google sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>SnapPick</Text>
      <View style={styles.brandRule} />
      <Text style={styles.title}>{isSignIn ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={styles.subtitle}>{isSignIn ? 'Sign in to continue.' : 'Create an account to get started.'}</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <Text style={styles.label}>Password</Text>
        <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete={isSignIn ? 'current-password' : 'new-password'} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>{isSignIn ? 'Sign in' : 'Create account'}</Text>}
        </Pressable>
        <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} /></View>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitGoogle()} style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
        </Pressable>
      </View>
      <Text style={styles.switchText}>
        {isSignIn ? 'New to SnapPick? ' : 'Already have an account? '}
        <Link href={isSignIn ? '/(auth)/sign-up' : '/(auth)/sign-in'} style={styles.link}>{isSignIn ? 'Create an account' : 'Sign in'}</Link>
      </Text>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xl },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  brandRule: { backgroundColor: colors.primary, borderRadius: 2, height: 3, marginTop: spacing.sm, width: 34 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', lineHeight: 35, marginTop: spacing.xl },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xxs },
  form: { marginTop: spacing.lg },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.xxs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md },
  error: { color: colors.danger, backgroundColor: colors.dangerSurface, borderRadius: 8, marginTop: spacing.md, padding: spacing.sm },
  notice: { color: colors.success, backgroundColor: colors.successSurface, borderRadius: 8, marginTop: spacing.md, padding: spacing.sm },
  button: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: 8, justifyContent: 'center', marginTop: spacing.lg, minHeight: 52 },
  buttonPressed: { backgroundColor: colors.ink },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  divider: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  googleButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 52 },
  googleButtonPressed: { backgroundColor: colors.surfaceAlt },
  googleButtonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  switchText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.lg, textAlign: 'center' },
  link: { color: colors.primaryDark, fontWeight: '800' },
});
