import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { AlertCircle, CheckCircle2, Mail, Lock, Sparkles } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
          setNotice('Account created! Please check your email to confirm.');
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed. Try again.');
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
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View className="items-center mb-8">
          <View className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 items-center justify-center mb-4 shadow-sm">
            <Sparkles size={32} color="#19806d" />
          </View>
          <Text className="text-3xl font-black tracking-tight text-foreground">SnapPick</Text>
          <Text className="text-sm font-medium text-muted-foreground mt-1">
            {isSignIn ? 'Welcome back' : 'Smart waste sorting made simple'}
          </Text>
        </View>

        {/* Card Form */}
        <Card className="border-border/70 bg-card shadow-sm p-5 rounded-3xl">
          <CardContent className="p-0 space-y-4">
            {error && (
              <View className="flex-row items-center gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 mb-2">
                <AlertCircle size={18} color="#b42318" />
                <Text className="flex-1 text-xs font-semibold text-destructive leading-tight">
                  {error}
                </Text>
              </View>
            )}

            {notice && (
              <View className="flex-row items-center gap-2.5 rounded-2xl bg-primary/10 border border-primary/20 p-3.5 mb-2">
                <CheckCircle2 size={18} color="#19806d" />
                <Text className="flex-1 text-xs font-semibold text-primary leading-tight">
                  {notice}
                </Text>
              </View>
            )}

            {/* Email Field */}
            <View className="relative justify-center">
              <Input
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email address"
                value={email}
                className="pl-11 h-12 rounded-2xl bg-secondary/40 border-border/60"
              />
              <View className="absolute left-3.5">
                <Mail size={18} color="#5b7072" />
              </View>
            </View>

            {/* Password Field */}
            <View className="relative justify-center mt-3">
              <Input
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                onChangeText={setPassword}
                placeholder="Password (6+ chars)"
                secureTextEntry
                value={password}
                className="pl-11 h-12 rounded-2xl bg-secondary/40 border-border/60"
              />
              <View className="absolute left-3.5">
                <Lock size={18} color="#5b7072" />
              </View>
            </View>

            {/* Submit Button */}
            <Button
              disabled={busy}
              onPress={() => void submit()}
              className="w-full h-12 rounded-2xl bg-primary shadow-sm mt-2"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-bold text-white">
                  {isSignIn ? 'Sign In' : 'Get Started'}
                </Text>
              )}
            </Button>

            {/* Divider */}
            <View className="my-2 flex-row items-center gap-3">
              <Separator className="flex-1" />
              <Text className="text-[11px] font-bold text-muted-foreground uppercase">or</Text>
              <Separator className="flex-1" />
            </View>

            {/* Google Button */}
            <Button
              disabled={busy}
              variant="outline"
              onPress={() => void submitGoogle()}
              className="w-full h-12 rounded-2xl bg-card border-border/80"
            >
              {busy ? (
                <ActivityIndicator color="#183e48" />
              ) : (
                <Text className="text-base font-bold text-foreground">
                  Continue with Google
                </Text>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Toggle Mode */}
        <View className="mt-8 flex-row justify-center items-center">
          <Text className="text-sm text-muted-foreground">
            {isSignIn ? "Don't have an account? " : 'Already registered? '}
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
