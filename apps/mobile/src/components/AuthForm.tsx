import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { AlertCircle, CheckCircle2, Mail, Lock } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';

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
      if (isSignIn) {
        await signIn(trimmedEmail, password);
      } else {
        const result = await signUp(trimmedEmail, password);
        if (result.needsEmailConfirmation) {
          setNotice('Account created. Check your email to confirm your address, then sign in.');
        }
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
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6">
          <Text className="text-xl font-extrabold tracking-tight text-ink">SnapPick</Text>
          <View className="h-1 w-8 rounded-full bg-primary mt-1" />
        </View>

        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {isSignIn ? 'Welcome back' : 'Create an account'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {isSignIn ? 'Sign in to access your recycling guidance and pickups.' : 'Join your local community in smart material sorting.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {error && (
              <View className="flex-row items-center gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 mb-2">
                <AlertCircle size={18} color="#b42318" />
                <Text className="flex-1 text-xs font-medium text-destructive leading-tight">
                  {error}
                </Text>
              </View>
            )}

            {notice && (
              <View className="flex-row items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 p-3.5 mb-2">
                <CheckCircle2 size={18} color="#19806d" />
                <Text className="flex-1 text-xs font-semibold text-primary leading-tight">
                  {notice}
                </Text>
              </View>
            )}

            <View className="space-y-1.5 mb-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <View className="relative justify-center">
                <Input
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  value={email}
                  className="pl-11"
                />
                <View className="absolute left-3.5">
                  <Mail size={18} color="#5b7072" />
                </View>
              </View>
            </View>

            <View className="space-y-1.5 mb-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <View className="relative justify-center">
                <Input
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                  value={password}
                  className="pl-11"
                />
                <View className="absolute left-3.5">
                  <Lock size={18} color="#5b7072" />
                </View>
              </View>
            </View>

            <Button
              disabled={busy}
              onPress={() => void submit()}
              className="w-full bg-primary"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {isSignIn ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Button>

            <View className="my-3 flex-row items-center gap-3">
              <Separator className="flex-1" />
              <Text className="text-xs font-semibold text-muted-foreground uppercase">OR</Text>
              <Separator className="flex-1" />
            </View>

            <Button
              disabled={busy}
              variant="outline"
              onPress={() => void submitGoogle()}
              className="w-full bg-card border-border"
            >
              {busy ? (
                <ActivityIndicator color="#183e48" />
              ) : (
                <Text className="text-sm font-semibold text-foreground">
                  Continue with Google
                </Text>
              )}
            </Button>
          </CardContent>
        </Card>

        <View className="mt-6 flex-row justify-center items-center">
          <Text className="text-sm text-muted-foreground">
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Link href={isSignIn ? '/(auth)/sign-up' : '/(auth)/sign-in'}>
            <Text className="text-sm font-bold text-primary">
              {isSignIn ? 'Sign up' : 'Sign in'}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
