import * as React from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function Index() {
  const { loading, session, profile, profileLoading, profileError, refreshProfile } = useAuth();

  if (loading || (session && profileLoading)) {
    return <LoadingScreen message="Checking account status..." />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="items-center max-w-sm text-center">
          <View className="h-14 w-14 rounded-full bg-destructive/10 items-center justify-center mb-4">
            <AlertCircle size={28} color="#b42318" />
          </View>
          <Text className="text-xl font-bold text-foreground mb-2 text-center">
            Something went wrong
          </Text>
          <Text className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
            {profileError}
          </Text>
          <Button
            onPress={() => void refreshProfile()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw size={16} color="#183e48" />
            <Text className="font-semibold">Try again</Text>
          </Button>
        </View>
      </View>
    );
  }

  return <Redirect href={hasRequiredConsents(profile) ? '/(tabs)' : '/(consent)/image-storage'} />;
}
