import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { ShieldAlert, AlertTriangle, Users, MapPin, AlertCircle } from 'lucide-react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { CONSENT_VERSION, hasImageStorageConsent, hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function SafetyConsentScreen() {
  const { profile, profileLoading, profileError, updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (profileLoading) return <LoadingScreen message="Loading profile..." />;
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
      setMessage(error instanceof Error ? error.message : 'Could not save choice. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
        className="px-6 py-6"
      >
        <View>
          {/* Step indicator */}
          <View className="flex-row items-center gap-2 mb-8">
            <View className="h-1.5 flex-1 rounded-full bg-primary" />
            <View className="h-1.5 flex-1 rounded-full bg-primary" />
          </View>

          {/* Icon Badge */}
          <View className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 items-center justify-center mb-5">
            <ShieldAlert size={30} color="#b45309" />
          </View>

          <Text className="text-3xl font-black tracking-tight text-foreground leading-tight">
            Community Safety
          </Text>
          <Text className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Quick safety checks ensure clean, reliable pickups for everyone.
          </Text>

          {/* Safety Chips */}
          <View className="mt-6 space-y-3">
            <Card className="p-4 rounded-2xl border-border/70 bg-card flex-row items-center gap-3.5 shadow-sm">
              <View className="h-10 w-10 rounded-xl bg-destructive/10 items-center justify-center">
                <AlertTriangle size={18} color="#b42318" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">No hazardous materials</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Batteries, chemicals & sharps excluded</Text>
              </View>
            </Card>

            <Card className="p-4 rounded-2xl border-border/70 bg-card flex-row items-center gap-3.5 shadow-sm mt-3">
              <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                <MapPin size={18} color="#19806d" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">Safe, accessible meetup</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Clear access instructions & daytime hours</Text>
              </View>
            </Card>

            <Card className="p-4 rounded-2xl border-border/70 bg-card flex-row items-center gap-3.5 shadow-sm mt-3">
              <View className="h-10 w-10 rounded-xl bg-blue-500/10 items-center justify-center">
                <Users size={18} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">Community respect</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Accurate item counts & prompt handoffs</Text>
              </View>
            </Card>
          </View>
        </View>

        <View className="pt-6">
          {(profileError || message) && (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5">
              <AlertCircle size={16} color="#b42318" />
              <Text className="text-xs text-destructive flex-1 font-medium">
                {message || profileError}
              </Text>
            </View>
          )}

          <Button
            disabled={busy}
            onPress={() => void accept()}
            className="w-full h-12 rounded-2xl bg-primary shadow-sm"
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-bold text-white">I Agree & Understand</Text>
            )}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
