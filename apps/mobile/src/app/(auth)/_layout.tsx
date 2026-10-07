import { Redirect, Stack } from 'expo-router';

import { hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { loading, session, profile, profileLoading } = useAuth();
  if (!loading && session && !profileLoading) return <Redirect href={hasRequiredConsents(profile) ? '/(tabs)' : '/(consent)/image-storage'} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
