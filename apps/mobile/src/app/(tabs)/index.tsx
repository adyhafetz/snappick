import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  ArrowRight,
  Sparkles,
  Bot,
  CheckCircle2,
  PackageCheck,
  Layers,
  Clock,
  RefreshCw,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { SnapBotModal } from '@/components/guidance/SnapBotModal';
import { fetchHomeStats, type HomeStats, DEFAULT_HOME_STATS } from '@/lib/home/stats';
import { flushOfflineUploadQueue } from '@/lib/detector/upload-queue';

function formatRecentDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;

    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return 'Recently';
  }
}

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const [snapBotVisible, setSnapBotVisible] = useState(false);
  const [stats, setStats] = useState<HomeStats>(DEFAULT_HOME_STATS);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const loadStats = useCallback(async () => {
    const { stats: loadedStats, fromCache } = await fetchHomeStats();
    setStats(loadedStats);
    setIsOfflineCache(fromCache);
    void flushOfflineUploadQueue();
  }, []);

  useEffect(() => {
    let active = true;
    if (isFocused) {
      void fetchHomeStats().then(({ stats: loadedStats, fromCache }) => {
        if (active) {
          setStats(loadedStats);
          setIsOfflineCache(fromCache);
        }
      });
      void flushOfflineUploadQueue();
    }
    return () => {
      active = false;
    };
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const recentScans = stats.recent_scans.slice(0, 3);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 56 }}
        className="px-6 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#19806d']}
          />
        }
      >
        {/* Brand Bar */}
        <View className="flex-row items-center justify-between mb-5">
          <View>
            <Text className="text-2xl font-black tracking-tight text-ink">SnapPick</Text>
            <View className="h-1 w-7 rounded-full bg-primary mt-1" />
          </View>
          <View className="flex-row items-center gap-2">
            {isOfflineCache && (
              <View className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Text className="text-[10px] font-bold text-amber-700">Offline</Text>
              </View>
            )}
            <View className="h-10 w-10 rounded-2xl bg-primary/10 items-center justify-center">
              <Sparkles size={20} color="#19806d" />
            </View>
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

        {/* Real Statistics Section */}
        <View className="mt-6 mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Recycling Impact
          </Text>
          <AnimatedPressable onPress={() => void loadStats()}>
            <RefreshCw size={13} color="#5b7072" />
          </AnimatedPressable>
        </View>

        <View className="flex-row gap-2.5">
          {/* Total Scans Card */}
          <Card className="flex-1 p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm">
            <View className="h-8 w-8 rounded-xl bg-primary/10 items-center justify-center mb-2">
              <Layers size={16} color="#19806d" />
            </View>
            <Text className="text-xl font-black text-foreground">
              {stats.total_scans}
            </Text>
            <Text className="text-[11px] font-semibold text-muted-foreground mt-0.5">
              Total Scans
            </Text>
          </Card>

          {/* Verified Items Card */}
          <Card className="flex-1 p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm">
            <View className="h-8 w-8 rounded-xl bg-emerald-500/10 items-center justify-center mb-2">
              <CheckCircle2 size={16} color="#16a34a" />
            </View>
            <Text className="text-xl font-black text-foreground">
              {stats.verified_recyclable_items}
            </Text>
            <Text className="text-[11px] font-semibold text-muted-foreground mt-0.5">
              Verified Items
            </Text>
          </Card>

          {/* Active Pickups Card */}
          <Card className="flex-1 p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm">
            <View className="h-8 w-8 rounded-xl bg-blue-500/10 items-center justify-center mb-2">
              <PackageCheck size={16} color="#2563eb" />
            </View>
            <Text className="text-xl font-black text-foreground">
              {stats.active_requests}
            </Text>
            <Text className="text-[11px] font-semibold text-muted-foreground mt-0.5">
              Active Pickups
            </Text>
          </Card>
        </View>

        {/* SnapBot AI Assistant Card */}
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => setSnapBotVisible(true)}
          className="mt-4"
        >
          <Card className="bg-card border border-border/80 p-4 rounded-3xl flex-row items-center gap-3.5 shadow-sm">
            <View className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
              <Bot size={24} className="text-primary" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-sm font-bold text-foreground">Ask SnapBot</Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Have questions about sorting or recycling? Ask anytime
              </Text>
            </View>
            <View className="h-8 w-8 rounded-full bg-muted/60 items-center justify-center">
              <ArrowRight size={16} className="text-muted-foreground" />
            </View>
          </Card>
        </AnimatedPressable>

        {/* Recent Activity Section */}
        <View className="mt-8 mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </Text>
          <AnimatedPressable onPress={() => router.push('/(tabs)/activity')}>
            <Text className="text-xs font-bold text-primary">View all</Text>
          </AnimatedPressable>
        </View>

        {recentScans.length > 0 ? (
          <View className="space-y-2.5">
            {recentScans.map((scan) => (
              <Card
                key={scan.id}
                className="p-3.5 rounded-2xl border-border/70 bg-card flex-row items-center justify-between shadow-sm mt-2"
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 rounded-xl bg-secondary/70 items-center justify-center">
                    <Camera size={16} color="#183e48" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-foreground">
                      Waste Scan ({scan.item_count} {scan.item_count === 1 ? 'item' : 'items'})
                    </Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Clock size={11} color="#5b7072" />
                      <Text className="text-[11px] text-muted-foreground">
                        {formatRecentDate(scan.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="h-7 px-2.5 rounded-full bg-primary/10 items-center justify-center">
                  <Text className="text-[10px] font-bold text-primary">Recorded</Text>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card className="p-4 rounded-2xl border border-dashed border-border/80 bg-card/60 items-center">
            <Text className="text-xs font-medium text-muted-foreground text-center">
              No scans recorded yet. Tap Scan Waste above to begin!
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* SnapBot AI Modal on Home Screen */}
      <SnapBotModal
        visible={snapBotVisible}
        onClose={() => setSnapBotVisible(false)}
      />
    </SafeAreaView>
  );
}
