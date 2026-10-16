import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Inbox, Truck, ArrowRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

export default function ActivityScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-6 pt-4">
        <View className="mb-4">
          <Text className="text-xl font-extrabold tracking-tight text-ink">SnapPick</Text>
          <View className="h-1 w-8 rounded-full bg-primary mt-1" />
        </View>

        <View className="mt-2 mb-6">
          <Text className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            Activity
          </Text>
          <Text className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Your recycling requests and claimed community pickups.
          </Text>
        </View>

        {/* Section 1: My requests */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Inbox size={18} color="#19806d" />
            <Text className="text-base font-bold text-foreground">My requests</Text>
          </View>

          <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card/60">
            <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mb-2">
              <Inbox size={20} color="#5b7072" />
            </View>
            <Text className="text-sm font-semibold text-foreground text-center">
              No active pickup requests
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1 max-w-xs">
              Pickup request history will be available once community pickups go live.
            </Text>
            <Button
              onPress={() => router.push('/(tabs)/scan')}
              className="mt-4 bg-primary gap-1.5 h-10 px-4 rounded-xl"
            >
              <Text className="text-xs font-semibold text-white">Scan materials</Text>
              <ArrowRight size={14} color="#ffffff" />
            </Button>
          </Card>
        </View>

        {/* Section 2: Pickups I claimed */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Truck size={18} color="#19806d" />
            <Text className="text-base font-bold text-foreground">Pickups I claimed</Text>
          </View>

          <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card/60">
            <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mb-2">
              <Truck size={20} color="#5b7072" />
            </View>
            <Text className="text-sm font-semibold text-foreground text-center">
              No claimed pickups
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1 max-w-xs">
              Claimed pickup history and coordination will appear here.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
