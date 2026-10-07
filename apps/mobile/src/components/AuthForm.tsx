import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

type AuthFormProps = { mode: 'sign-in' | 'sign-up' };

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
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

  return (
    <View style={styles.container}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
      <Text style={styles.eyebrow}>SNAPPICK</Text>
      <Text style={styles.title}>{isSignIn ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={styles.subtitle}>{isSignIn ? 'Sign in to continue sorting smarter.' : 'Start making household recycling easier.'}</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <Text style={styles.label}>Password</Text>
        <TextInput autoCapitalize="none" autoComplete={isSignIn ? 'current-password' : 'new-password'} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>{isSignIn ? 'Sign in' : 'Create account'}</Text>}
        </Pressable>
      </View>
      <Text style={styles.switchText}>
        {isSignIn ? 'New to SnapPick? ' : 'Already have an account? '}
        <Link href={isSignIn ? '/(auth)/sign-up' : '/(auth)/sign-in'} style={styles.link}>{isSignIn ? 'Create an account' : 'Sign in'}</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: spacing.lg, justifyContent: 'center' },
  brandMark: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  brandMarkText: { color: colors.surface, fontSize: 28, fontWeight: '800' },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.xs },
  form: { marginTop: spacing.xl },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: 14 },
  error: { color: colors.danger, backgroundColor: colors.dangerSurface, borderRadius: 8, marginTop: spacing.md, padding: spacing.sm },
  notice: { color: colors.primaryDark, backgroundColor: '#ecfdf5', borderRadius: 8, marginTop: spacing.md, padding: spacing.sm },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, justifyContent: 'center', marginTop: spacing.lg, minHeight: 52 },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  switchText: { color: colors.muted, fontSize: 14, marginTop: spacing.xl, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '800' },
});
