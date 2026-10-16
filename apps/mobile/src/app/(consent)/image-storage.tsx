import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { Camera, ShieldAlert, AlertCircle, RefreshCw } from 'lucide-react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { CONSENT_VERSION, hasImageStorageConsent } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function ImageStorageConsentScreen() {
  const { profile, profileLoading, profileError, updateProfile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (profileLoading) return <LoadingScreen message="Loading profile..." />;
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
            <View className="h-1.5 w-14 rounded-full bg-border" />
          </View>
          <Text className="text-xs font-bold uppercase tracking-wider text-primary">
            Step 1 of 2 · Privacy
          </Text>
        </View>

        <View className="h-14 w-14 rounded-2xl bg-primary/10 items-center justify-center mb-4">
          <Camera size={28} color="#19806d" />
        </View>

        <Text className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
          Keep your photos private by default
        </Text>

        <Text className="text-sm text-muted-foreground mt-3 leading-relaxed">
          SnapPick can save a compressed copy of a scan for a short retention period so you can review it later. Photos stay in your private account and are not used for training unless you separately opt in.
        </Text>

        {/* Warning callout card */}
        <Card className="mt-5 border-amber-200/80 bg-amber-50/70 p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 rounded-full bg-amber-100 items-center justify-center mt-0.5">
              <ShieldAlert size={18} color="#805d13" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-900">
                Protect personal details
              </Text>
              <Text className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                Avoid faces, identity documents, vehicle plates, and children in photos. SnapPick strips location metadata before an upload.
              </Text>
            </View>
          </View>
        </Card>

        {profileError && (
          <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle size={16} color="#b42318" />
            <Text className="text-xs text-destructive flex-1 font-medium">
              {profileError} Pull to retry or try again below.
            </Text>
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
                I understand and agree
              </Text>
            )}
          </Button>

          <Button
            disabled={busy}
            variant="ghost"
            onPress={() =>
              setMessage('Image storage consent is required to use SnapPick. Your choice has not been changed.')
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
