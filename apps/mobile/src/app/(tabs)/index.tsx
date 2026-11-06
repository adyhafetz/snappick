import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { Alert, Linking, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import {
  Camera,
  ArrowRight,
  Bot,
  CheckCircle2,
  PackageCheck,
  Layers,
  Newspaper,
  ArrowUpRight,
  TrendingUp,
  Activity,
  ChevronRight,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { SnapBotModal } from '@/components/guidance/SnapBotModal';
import { fetchHomeStats, type HomeStats, DEFAULT_HOME_STATS } from '@/lib/home/stats';
import { syncOfflineScans } from '@/lib/detector/pending-sessions';
import { maybePromptForModelUpdate } from '@/lib/detector/model-update-prompt';
import { PERAK_ECO_NEWS } from '@/lib/news/perakNews';

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
    void syncOfflineScans();
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
      void syncOfflineScans();
      void maybePromptForModelUpdate();
    }
    return () => {
      active = false;
    };
  }, [isFocused]);

  const onRefreshNews = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), onRefreshNews()]);
    setRefreshing(false);
  }, [loadStats, onRefreshNews]);

  const recentScans = stats.recent_scans.slice(0, 3);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
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
        <View className="items-center justify-center mb-6 relative">
          <ExpoImage
            source={require('../../../assets/images/logo-full.png')}
            style={{ width: 154, height: 32 }}
            contentFit="contain"
            accessibilityLabel="SnapPick"
          />
          {isOfflineCache && (
            <View className="absolute right-0 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Text className="text-[11px] font-bold text-amber-700">Offline</Text>
            </View>
          )}
        </View>



        {/* Primary Scan Card (Without Footer) */}
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/scan')}
        >
          <View className="rounded-3xl overflow-hidden bg-primary shadow-md shadow-primary/25 relative">
            {/* Subtle ambient glowing background orbs */}
            <View
              style={{
                position: 'absolute',
                right: -25,
                top: -25,
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: 45,
                bottom: -35,
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: -15,
                bottom: -15,
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
              }}
            />

            <View className="p-4 flex-row items-center gap-3.5">
              <View style={{ flexShrink: 0 }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    backgroundColor: '#359d8a',
                  }}
                  className="rounded-2xl items-center justify-center border border-white/20 shadow-sm"
                >
                  <Camera size={26} color="#ffffff" />
                </View>
              </View>

              <View className="flex-1 justify-center">
                <Text className="text-xl font-black text-white leading-tight">
                  Scan Waste
                </Text>
                <Text className="text-xs font-medium text-white/80 mt-1">
                  {"Instantly check if it's recyclable"}
                </Text>
              </View>

              <View
                style={{ backgroundColor: '#359d8a' }}
                className="h-10 w-10 rounded-full items-center justify-center border border-white/20 shadow-sm"
              >
                <ArrowRight size={18} color="#ffffff" />
              </View>
            </View>
          </View>
        </AnimatedPressable>

        {/* SnapBot Card (Same design & size as Scan Waste, Light Color Scheme) */}
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Ask SnapBot for instant sorting advice"
          onPress={() => setSnapBotVisible(true)}
          className="mt-3.5"
        >
          <View
            style={{ backgroundColor: '#eaf6f2' }}
            className="rounded-3xl overflow-hidden border border-primary/20 shadow-xs relative"
          >
            {/* Subtle ambient glowing background orbs */}
            <View
              style={{
                position: 'absolute',
                right: -25,
                top: -25,
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: 'rgba(25, 128, 109, 0.08)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: 45,
                bottom: -35,
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: 'rgba(25, 128, 109, 0.05)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: -15,
                bottom: -15,
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
              }}
            />

            <View className="p-4 flex-row items-center gap-3.5">
              <View style={{ flexShrink: 0 }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    backgroundColor: '#ffffff',
                  }}
                  className="rounded-2xl items-center justify-center border border-primary/20 shadow-xs"
                >
                  <Bot size={26} color="#19806d" />
                </View>
              </View>

              <View className="flex-1 justify-center">
                <Text className="text-xl font-black text-foreground leading-tight">
                  Ask SnapBot
                </Text>
                <Text className="text-xs font-medium text-muted-foreground mt-1">
                  Instant recycling & sorting advice
                </Text>
              </View>

              <View
                style={{ backgroundColor: '#ffffff' }}
                className="h-10 w-10 rounded-full items-center justify-center border border-primary/20 shadow-xs"
              >
                <ArrowRight size={18} color="#19806d" />
              </View>
            </View>
          </View>
        </AnimatedPressable>

        {/* Real Statistics Section */}
        <View className="mt-8 mb-3 flex-row items-center gap-1.5">
          <TrendingUp size={14} color="#5b7072" />
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Impact
          </Text>
        </View>

        <View className="flex-row gap-2.5">
          {/* Total Scans Card */}
          <Card className="flex-1 p-3.5 rounded-3xl bg-card border border-primary/20 shadow-xs justify-between">
            <View className="h-9 w-9 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-2.5">
              <Layers size={17} color="#19806d" />
            </View>
            <View>
              <Text className="text-2xl font-black text-foreground tracking-tight">
                {stats.total_scans}
              </Text>
              <Text className="text-[11px] font-bold text-muted-foreground mt-0.5">
                Total Scans
              </Text>
            </View>
          </Card>

          {/* Verified Items Card */}
          <Card className="flex-1 p-3.5 rounded-3xl bg-card border border-emerald-500/20 shadow-xs justify-between">
            <View className="h-9 w-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mb-2.5">
              <CheckCircle2 size={17} color="#16a34a" />
            </View>
            <View>
              <Text className="text-2xl font-black text-foreground tracking-tight">
                {stats.verified_recyclable_items}
              </Text>
              <Text className="text-[11px] font-bold text-muted-foreground mt-0.5">
                Verified Items
              </Text>
            </View>
          </Card>

          {/* Active Pickups Card */}
          <Card className="flex-1 p-3.5 rounded-3xl bg-card border border-blue-500/20 shadow-xs justify-between">
            <View className="h-9 w-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 items-center justify-center mb-2.5">
              <PackageCheck size={17} color="#2563eb" />
            </View>
            <View>
              <Text className="text-2xl font-black text-foreground tracking-tight">
                {stats.active_requests}
              </Text>
              <Text className="text-[11px] font-bold text-muted-foreground mt-0.5">
                Active Pickups
              </Text>
            </View>
          </Card>
        </View>

        {/* Latest News (Real News Carousel) */}
        <View className="mt-8 mb-3 flex-row items-center gap-1.5">
          <Newspaper size={14} color="#5b7072" />
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Latest News
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 24 }}
          className="-mx-6 px-6"
        >
          {PERAK_ECO_NEWS.map((item) => (
            <AnimatedPressable
              key={item.id}
              accessibilityRole="link"
              accessibilityLabel={`Read article: ${item.title}`}
              onPress={() => {
                Linking.openURL(item.url).catch(() => {
                  Alert.alert('Unable to open link', item.url);
                });
              }}
              style={{ width: 265 }}
              className="mr-3.5 rounded-3xl overflow-hidden bg-card border border-border/80 shadow-sm"
            >
              <View className="relative w-full h-36 bg-muted/60">
                <ExpoImage
                  source={{ uri: item.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={250}
                />
                <View className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-black/55 items-center justify-center">
                  <ArrowUpRight size={13} color="#ffffff" />
                </View>
              </View>

              <View className="p-3.5 flex-1 justify-between">
                <Text
                  className="text-xs font-black text-foreground leading-snug"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <View className="mt-3 flex-row items-center justify-between pt-2.5 border-t border-border/50">
                  <Text className="text-[11px] font-black text-primary">
                    {item.source}
                  </Text>
                  <Text className="text-[10px] font-medium text-muted-foreground">
                    {item.publishedDate}
                  </Text>
                </View>
              </View>
            </AnimatedPressable>
          ))}
        </ScrollView>

        {/* Recent Activity Section */}
        <View className="mt-8 mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Activity size={14} color="#5b7072" />
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </Text>
          </View>
          <AnimatedPressable onPress={() => router.push('/(tabs)/activity')}>
            <Text className="text-xs font-bold text-primary">View all</Text>
          </AnimatedPressable>
        </View>

        {recentScans.length > 0 ? (
          <View className="space-y-2.5">
            {recentScans.map((scan) => (
              <AnimatedPressable
                key={scan.id}
                accessibilityRole="button"
                accessibilityLabel={`View scan from ${formatRecentDate(scan.created_at)}`}
                onPress={() => router.push('/(tabs)/activity')}
              >
                <Card className="p-3.5 rounded-3xl border-border/80 bg-card flex-row items-center justify-between shadow-xs mt-2.5">
                  <View className="flex-row items-center gap-3.5">
                    <View className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                      <Camera size={19} color="#19806d" />
                    </View>
                    <View>
                      <Text className="text-sm font-black text-foreground tracking-tight">
                        Waste Scan
                      </Text>
                      <Text className="text-xs font-medium text-muted-foreground mt-0.5">
                        {formatRecentDate(scan.created_at)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <View className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                      <Text className="text-xs font-black text-primary">
                        {scan.item_count} {scan.item_count === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                    <ChevronRight size={15} color="#8a9ea0" />
                  </View>
                </Card>
              </AnimatedPressable>
            ))}
          </View>
        ) : (
          <Card className="p-4 rounded-3xl border border-dashed border-border/80 bg-card/60 items-center">
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
