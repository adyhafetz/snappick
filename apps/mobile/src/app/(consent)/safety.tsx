import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { ShieldCheck, AlertCircle, RefreshCw, AlertTriangle, Users, MapPin } from 'lucide-react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { CONSENT_VERSION, hasImageStorageConsent, hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function SafetyConsentScreen() {
  const { profile, profileLoading, profileError, updateProfile, refreshProfile } = useAuth();
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
      setMessage(error instanceof Error ? error.message : 'We could not save your choice.');
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
        {/* Step indicator */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <View className="h-1.5 w-14 rounded-full bg-primary" />
            <View className="h-1.5 w-14 rounded-full bg-primary" />
          </View>
          <Text className="text-xs font-bold uppercase tracking-wider text-primary">
            Step 2 of 2 · Community Safety
          </Text>
        </View>

        <View className="h-14 w-14 rounded-2xl bg-primary/10 items-center justify-center mb-4">
          <ShieldCheck size={28} color="#19806d" />
        </View>

        <Text className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
          Community pickups need a safety check
        </Text>

        <Text className="text-sm text-muted-foreground mt-3 leading-relaxed">
          SnapPick connects neighbours for community pickups. You remain responsible for following local guidance and for deciding what is safe to hand over.
        </Text>

        {/* Safety checklist items in a clean card */}
        <Card className="mt-5 border-border/70 p-4 space-y-3">
          <View className="flex-row items-start gap-3">
            <View className="h-7 w-7 rounded-full bg-primary/10 items-center justify-center mt-0.5">
              <Users size={15} color="#19806d" />
            </View>
            <Text className="flex-1 text-xs text-foreground leading-relaxed">
              Keep people, pets, and valuables safely separated from pickup items.
            </Text>
          </View>

          <View className="flex-row items-start gap-3 pt-2 border-t border-border/40">
            <View className="h-7 w-7 rounded-full bg-destructive/10 items-center justify-center mt-0.5">
              <AlertTriangle size={15} color="#b42318" />
            </View>
            <Text className="flex-1 text-xs text-foreground leading-relaxed">
              Never hand over hazardous, leaking, sharp, corrosive, or unknown materials.
            </Text>
          </View>

          <View className="flex-row items-start gap-3 pt-2 border-t border-border/40">
            <View className="h-7 w-7 rounded-full bg-primary/10 items-center justify-center mt-0.5">
              <MapPin size={15} color="#19806d" />
            </View>
            <Text className="flex-1 text-xs text-foreground leading-relaxed">
              Coordinate and meet only in safe, well-lit spaces and use in-app report tools if needed.
            </Text>
          </View>
        </Card>

        {profileError && (
          <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle size={16} color="#b42318" />
            <Text className="text-xs text-destructive flex-1 font-medium">{profileError}</Text>
          </View>
        )}

        {message && (
          <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle size={16} color="#b42318" />
            <Text className="text-xs text-destructive flex-1 font-medium">{message}</Text>
          </View>
        )}

        <View className="mt-8 space-y-3">
          <Button
            disabled={busy || !profile}
            onPress={() => void accept()}
            className="w-full bg-primary"
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                I understand and acknowledge
              </Text>
            )}
          </Button>

          <Button
            disabled={busy}
            variant="ghost"
            onPress={() =>
              setMessage('The safety acknowledgement is required to use pickups. Your choice has not been changed.')
            }
            className="w-full mt-2"
          >
            <Text className="text-sm font-medium text-muted-foreground">
              Decline for now
            </Text>
          </Button>

          {profileError && (
            <Button
              variant="outline"
              onPress={() => void refreshProfile()}
              className="w-full gap-2 mt-2"
            >
              <RefreshCw size={14} color="#183e48" />
              <Text className="text-xs font-semibold">Try again</Text>
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
