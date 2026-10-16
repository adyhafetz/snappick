import * as React from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  ArrowRight,
  Maximize2,
  AlertTriangle,
  History,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-6 pt-4">
        {/* Brand row */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xl font-extrabold tracking-tight text-ink">SnapPick</Text>
            <View className="h-1 w-8 rounded-full bg-primary mt-1" />
          </View>
          <View className="h-9 w-9 rounded-xl bg-primary/10 items-center justify-center">
            <Sparkles size={18} color="#19806d" />
          </View>
        </View>

        {/* Hero title */}
        <View className="mt-2 mb-6">
          <Text className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            Ready to sort?
          </Text>
          <Text className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Smart, local recycling guidance for everyday items right from your camera.
          </Text>
        </View>

        {/* Primary Scan Action Card */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/scan')}
          className="active:opacity-90"
        >
          <Card className="bg-primary border-0 shadow-lg p-5">
            <View className="flex-row items-center gap-4">
              <View className="h-12 w-12 rounded-2xl bg-white/20 border border-white/25 items-center justify-center">
                <Camera size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-white leading-tight">
                  Scan an item
                </Text>
                <Text className="text-xs text-white/80 mt-1">
                  On-device ML sorting guidance & bins
                </Text>
              </View>
              <View className="h-9 w-9 rounded-full bg-white/20 items-center justify-center">
                <ArrowRight size={18} color="#ffffff" />
              </View>
            </View>
          </Card>
        </Pressable>

        {/* Before You Begin Section */}
        <View className="mt-8 mb-3">
          <Text className="text-base font-bold text-foreground">Before you begin</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Tips for accurate scans and safe community sorting
          </Text>
        </View>

        <View className="space-y-3">
          <Card className="p-4 border-border/70">
            <View className="flex-row items-start gap-3.5">
              <View className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mt-0.5">
                <Maximize2 size={18} color="#19806d" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">
                  Keep the whole item in view
                </Text>
                <Text className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Center the item in good lighting. Clear photos help our local detector model identify materials accurately.
                </Text>
              </View>
            </View>
          </Card>

          <Card className="p-4 border-border/70 mt-3">
            <View className="flex-row items-start gap-3.5">
              <View className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200/60 items-center justify-center mt-0.5">
                <AlertTriangle size={18} color="#805d13" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">
                  Check safety & hazards
                </Text>
                <Text className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Hazards like batteries, lightbulbs, and e-waste are never collected for community pickups and require manual declaration.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Recent Activity Section */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-foreground">Recent activity</Text>
            <Pressable
              onPress={() => router.push('/(tabs)/activity')}
              className="flex-row items-center gap-1 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-primary">View all</Text>
              <ChevronRight size={14} color="#19806d" />
            </Pressable>
          </View>

          <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card/50">
            <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mb-2">
              <History size={18} color="#5b7072" />
            </View>
            <Text className="text-xs font-medium text-muted-foreground text-center">
              No recent scans or pickups yet.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
