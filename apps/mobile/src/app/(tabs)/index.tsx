import * as React from 'react';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  ArrowRight,
  SunMedium,
  Target,
  AlertTriangle,
  History,
  Sparkles,
  MapPin,
  Truck,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-6 pt-4">
        {/* Brand Bar */}
        <View className="flex-row items-center justify-between mb-5">
          <View>
            <Text className="text-2xl font-black tracking-tight text-ink">SnapPick</Text>
            <View className="h-1 w-7 rounded-full bg-primary mt-1" />
          </View>
          <View className="h-10 w-10 rounded-2xl bg-primary/10 items-center justify-center">
            <Sparkles size={20} color="#19806d" />
          </View>
        </View>

        {/* Hero Title */}
        <View className="mb-5">
          <Text className="text-3xl font-black tracking-tight text-foreground leading-tight">
            Sort smarter.
          </Text>
          <Text className="text-sm font-medium text-muted-foreground mt-1">
            Point camera to identify recyclable materials instantly.
          </Text>
        </View>

        {/* Primary Scan Card */}
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/scan')}
        >
          <Card className="bg-primary border-0 shadow-lg p-5 rounded-3xl">
            <View className="flex-row items-center gap-4">
              <View className="h-14 w-14 rounded-2xl bg-white/20 border border-white/25 items-center justify-center">
                <Camera size={26} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-black text-white leading-tight">
                  Scan Waste
                </Text>
                <Text className="text-xs font-medium text-white/80 mt-1">
                  On-device ML sorting & bin guide
                </Text>
              </View>
              <View className="h-10 w-10 rounded-full bg-white/20 items-center justify-center">
                <ArrowRight size={20} color="#ffffff" />
              </View>
            </View>
          </Card>
        </AnimatedPressable>

        {/* Quick Tips Chips */}
        <View className="mt-8 mb-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Quick tips for best scan
          </Text>
        </View>

        <View className="flex-row gap-2.5">
          <View className="flex-1 p-3.5 rounded-2xl bg-card border border-border/70 items-center text-center shadow-sm">
            <View className="h-9 w-9 rounded-xl bg-amber-500/10 items-center justify-center mb-2">
              <SunMedium size={18} color="#b45309" />
            </View>
            <Text className="text-xs font-bold text-foreground text-center">Good Light</Text>
            <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Bright focus</Text>
          </View>

          <View className="flex-1 p-3.5 rounded-2xl bg-card border border-border/70 items-center text-center shadow-sm">
            <View className="h-9 w-9 rounded-xl bg-primary/10 items-center justify-center mb-2">
              <Target size={18} color="#19806d" />
            </View>
            <Text className="text-xs font-bold text-foreground text-center">Center Item</Text>
            <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Fill frame</Text>
          </View>

          <View className="flex-1 p-3.5 rounded-2xl bg-card border border-border/70 items-center text-center shadow-sm">
            <View className="h-9 w-9 rounded-xl bg-destructive/10 items-center justify-center mb-2">
              <AlertTriangle size={18} color="#b42318" />
            </View>
            <Text className="text-xs font-bold text-foreground text-center">No Hazards</Text>
            <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Batteries out</Text>
          </View>
        </View>

        {/* Shortcuts Section */}
        <View className="mt-8 mb-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Activity & Pickups
          </Text>
        </View>

        <View className="space-y-3">
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/request')}
          >
            <Card className="p-4 rounded-2xl border-border/70 bg-card flex-row items-center gap-3.5 shadow-sm">
              <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                <MapPin size={20} color="#19806d" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">Nearby Pickups</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Browse community requests in your area
                </Text>
              </View>
              <ArrowRight size={16} color="#5b7072" />
            </Card>
          </AnimatedPressable>

          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/activity')}
            className="mt-3"
          >
            <Card className="p-4 rounded-2xl border-border/70 bg-card flex-row items-center gap-3.5 shadow-sm">
              <View className="h-10 w-10 rounded-xl bg-blue-500/10 items-center justify-center">
                <History size={20} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">My Activity</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Track ongoing pickup requests & history
                </Text>
              </View>
              <ArrowRight size={16} color="#5b7072" />
            </Card>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
