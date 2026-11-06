'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      setErrorMsg('Access denied: this account does not have administrator privileges.');
    }
  }, [searchParams]);

  if (!loading && user && isAdmin) {
    router.replace('/');
    return null;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setBusy(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile?.is_admin) {
          setErrorMsg('Access denied: account is not an admin.');
          await supabase.auth.signOut();
          setBusy(false);
          return;
        }

        router.replace('/');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <svg
          width="64"
          height="64"
          viewBox="0 0 144 144"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-3"
          aria-label="SnapPick Logo"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M72 0C91.1 0 109.41 7.59 122.91 21.09C136.41 34.59 144 52.9 144 72C144 91.1 136.41 109.41 122.91 122.91C109.41 136.41 91.1 144 72 144C52.9 144 34.59 136.41 21.09 122.91C7.59 109.41 0 91.1 0 72C0 52.9 7.59 34.59 21.09 21.09C34.59 7.59 52.9 0 72 0ZM40.32 99.36C33.12 64.8 60.48 38.88 105.12 36C74.88 46.08 51.84 67.68 40.32 99.36ZM48.96 103.68C54.72 74.88 74.88 54.72 106.56 43.2C106.56 53.28 103.68 61.92 97.92 70.56C77.76 74.88 61.92 86.4 48.96 103.68ZM57.6 108C67.68 89.28 80.64 80.64 93.6 77.76C83.52 97.92 72 106.56 57.6 108Z"
            fill="#19806D"
          />
        </svg>
        <h1 className="text-3xl font-black tracking-tight text-foreground text-center">
          Welcome Back
        </h1>
      </div>

      {/* Card Form */}
      <Card className="w-full border-border/70 bg-card shadow-sm p-6 rounded-3xl">
        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 mb-4">
            <AlertCircle size={18} className="text-destructive shrink-0" />
            <p className="flex-1 text-xs font-semibold text-destructive leading-tight">
              {errorMsg}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col">
          {/* Form Fields */}
          <div className="space-y-3">
            {/* Email Field */}
            <div className="relative flex items-center">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="pl-11 h-12 rounded-2xl bg-secondary/40 border-border/60 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 focus:ring-transparent focus:border-border/60 focus:bg-secondary/40 shadow-none focus:shadow-none transition-none"
              />
              <div className="absolute left-3.5 pointer-events-none text-muted-foreground">
                <Mail size={18} />
              </div>
            </div>

            {/* Password Field */}
            <div className="relative flex items-center">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="pl-11 h-12 rounded-2xl bg-secondary/40 border-border/60 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 focus:ring-transparent focus:border-border/60 focus:bg-secondary/40 shadow-none focus:shadow-none transition-none"
              />
              <div className="absolute left-3.5 pointer-events-none text-muted-foreground">
                <Lock size={18} />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-base shadow-sm mt-4 hover:bg-primary-dark transition-all disabled:opacity-60"
          >
            {busy ? (
              <div className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Suspense
        fallback={
          <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
