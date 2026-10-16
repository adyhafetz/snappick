import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/ui/text';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="items-center gap-3">
        <ActivityIndicator color="#19806d" size="large" />
        {message ? (
          <Text className="text-sm font-medium text-muted-foreground">{message}</Text>
        ) : null}
      </View>
    </View>
  );
}
