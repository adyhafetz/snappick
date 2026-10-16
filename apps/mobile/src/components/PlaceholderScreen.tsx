import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, ArrowRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function PlaceholderScreen({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-6">
      <View className="pt-4">
        <Text className="text-lg font-extrabold tracking-tight text-ink">SnapPick</Text>
        <View className="h-1 w-8 rounded-full bg-primary mt-1.5" />
      </View>

      <View className="flex-1 justify-center pb-16">
        <View className="h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center mb-6">
          <Package size={30} className="text-primary" color="#19806d" />
        </View>

        <Text className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          {title}
        </Text>

        <Text className="text-base text-muted-foreground mt-2 leading-relaxed max-w-xs">
          {description}
        </Text>

        {actionLabel && onAction && (
          <View className="mt-8 flex-row">
            <Button
              onPress={onAction}
              className="gap-2 bg-primary"
            >
              <Text className="font-semibold text-white">{actionLabel}</Text>
              <ArrowRight size={18} color="#ffffff" />
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
