import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Camera as MapCamera, Map, Marker } from '@maplibre/maplibre-react-native';
import { CircleAlert, LocateFixed, RefreshCw, User, WifiOff, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { groupMarketplaceRequests, formatPickupSummary, formatPickupWindow, type MarketplaceRequest } from '@/lib/pickup/marketplace';
import { supabase } from '@/lib/supabase';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_POINT: [number, number] = [101.0901, 4.5975];

export function PickupMarketplace({ onCreateRequest }: { onCreateRequest?: () => void } = {}) {
  const camera = useRef<React.ElementRef<typeof MapCamera>>(null);
  const network = Network.useNetworkState();
  const online = network.isConnected === true && network.isInternetReachable !== false;
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);
  const [selected, setSelected] = useState<MarketplaceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [realtime, setRealtime] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');
  const [locating, setLocating] = useState(false);

  const locateCollector = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Please enable location permissions to find pickups near you.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      camera.current?.easeTo({
        center: [current.coords.longitude, current.coords.latitude],
        zoom: 13,
        duration: 750,
      });
    } catch {
      Alert.alert('Location unavailable', 'Could not detect your current location.');
    } finally {
      setLocating(false);
    }
  };

  const refresh = useCallback(async () => {
    if (!online) { setRealtime('offline'); setLoading(false); return; }
    setLoadError('');
    const { data, error } = await supabase.from('pending_pickup_marketplace')
      .select('id,district_name,material_summary,pickup_window_start,pickup_window_end,longitude,latitude,cell_count,is_mine');
    if (error) {
      setLoadError('Nearby requests could not be loaded. Please check your connection.');
      setRequests([]);
    } else {
      setRequests((data ?? []) as MarketplaceRequest[]);
      setSelected((prev) => (prev ? (data ?? []).find((item: MarketplaceRequest) => item.id === prev.id) ?? null : null));
    }
    setLoading(false);
  }, [online]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const stateTimer = setTimeout(() => setRealtime(online ? 'connecting' : 'offline'), 0);
    if (!online) return () => clearTimeout(stateTimer);
    const channel = supabase.channel('pickup-marketplace')
      .on('broadcast', { event: 'refresh' }, () => { void refresh(); })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { setRealtime('live'); void refresh(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtime('reconnecting');
      });
    return () => { clearTimeout(stateTimer); void supabase.removeChannel(channel); };
  }, [online, refresh]);

  const cells = useMemo(() => groupMarketplaceRequests(requests), [requests]);
  const selectedCell = selected ? cells.find((cell) => cell.requests.some((row) => row.id === selected.id)) : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Sleek Header */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-3xl font-black tracking-tight text-foreground">Nearby Pickups</Text>
        <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-border/80">
          {realtime === 'offline' ? (
            <WifiOff size={12} color="#b45309" />
          ) : (
            <View className={`h-2 w-2 rounded-full ${realtime === 'live' ? 'bg-primary' : 'bg-amber-500'}`} />
          )}
          <Text className="text-[11px] font-bold text-foreground capitalize">
            {realtime === 'live' ? 'Live' : realtime}
          </Text>
        </View>
      </View>

      <View className="flex-1 mx-4 mb-4 overflow-hidden rounded-3xl bg-muted border border-border shadow-sm relative">
        <Map
          mapStyle={MAP_STYLE}
          style={{ flex: 1 }}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          onDidFinishLoadingMap={() => { setMapError(false); setMapReady(true); }}
          onDidFailLoadingMap={() => { setMapError(true); setMapReady(false); }}
        >
          <MapCamera ref={camera} initialViewState={{ center: INITIAL_POINT, zoom: 10.5 }} minZoom={4} maxZoom={19} />
          {cells.map((cell) => {
            const isSelected = selectedCell?.key === cell.key;
            return (
              <Marker
                key={cell.key}
                id={cell.key}
                lngLat={cell.coordinate}
                onPress={() => {
                  setSelected(cell.requests[0] ?? null);
                  camera.current?.easeTo({ center: cell.coordinate, zoom: 13.5, duration: 450 });
                }}
              >
                <View
                  className={`min-w-11 h-11 px-2.5 items-center justify-center rounded-2xl border-2 shadow-md ${
                    cell.hasMine
                      ? isSelected
                        ? 'border-amber-300 bg-amber-600'
                        : 'border-white bg-amber-600'
                      : isSelected
                        ? 'border-emerald-300 bg-primary'
                        : 'border-white bg-primary'
                  }`}
                >
                  <View className="flex-row items-center gap-1">
                    {cell.hasMine && <User size={13} color="#ffffff" strokeWidth={2.6} />}
                    <Text className="text-xs font-bold text-white">{cell.count}</Text>
                  </View>
                </View>
              </Marker>
            );
          })}
        </Map>

        {!mapReady && !mapError && (
          <View pointerEvents="none" className="absolute top-4 left-4 flex-row items-center gap-2 rounded-2xl bg-card/90 px-3 py-2 border border-border shadow-sm">
            <ActivityIndicator size="small" color="#19806d" />
            <Text className="text-xs font-bold text-foreground">Loading map...</Text>
          </View>
        )}

        {mapError && (
          <View className="absolute top-4 left-4 right-4 rounded-2xl bg-card p-3 border border-destructive/20 shadow-sm">
            <Text className="text-xs font-bold text-destructive">Map unavailable</Text>
            <Text className="mt-0.5 text-[11px] text-muted-foreground">Check connection to view live map tiles.</Text>
          </View>
        )}

        {/* Floating Quick Actions */}
        <View className="absolute top-4 right-4 gap-2.5">
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Center map on your location"
            disabled={locating}
            onPress={() => void locateCollector()}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-md border border-border/80"
          >
            {locating ? <ActivityIndicator size="small" color="#19806d" /> : <LocateFixed size={18} color="#19806d" />}
          </AnimatedPressable>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Refresh nearby pickups"
            disabled={loading}
            onPress={() => {
              setLoading(true);
              void refresh();
            }}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-md border border-border/80"
          >
            {loading ? <ActivityIndicator size="small" color="#19806d" /> : <RefreshCw size={17} color="#19806d" />}
          </AnimatedPressable>
        </View>

        {/* Selected Area / Request Bottom Card */}
        {selected && selectedCell && (
          <View className="absolute bottom-6 left-4 right-4 max-h-[55%] rounded-3xl border border-border/80 bg-card p-4 shadow-2xl">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-black text-foreground">
                    {selected.district_name ?? 'Perak area'}
                  </Text>
                  {selected.is_mine && (
                    <View className="rounded-full bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
                      <Text className="text-[10px] font-bold text-amber-800">Your Request</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-1 text-sm font-bold text-foreground">
                  {formatPickupSummary(selected.material_summary)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {formatPickupWindow(selected.pickup_window_start, selected.pickup_window_end)}
                </Text>
              </View>

              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Close request details"
                onPress={() => setSelected(null)}
                className="h-8 w-8 items-center justify-center rounded-full bg-secondary/80"
              >
                <X size={16} color="#5b7072" />
              </AnimatedPressable>
            </View>

            {/* Multiple requests in cell selector */}
            {selectedCell.count > 1 && (
              <View className="mt-3">
                <ScrollView className="max-h-28" nestedScrollEnabled showsVerticalScrollIndicator>
                  {selectedCell.requests.map((request, index) => {
                    const isItemActive = request.id === selected.id;
                    return (
                      <AnimatedPressable
                        key={request.id}
                        onPress={() => setSelected(request)}
                        className={`p-2.5 rounded-xl mb-1.5 border flex-row items-center justify-between ${
                          isItemActive
                            ? 'border-primary bg-primary/10'
                            : 'border-border/70 bg-secondary/30'
                        }`}
                      >
                        <View className="flex-1 mr-2">
                          <Text className={`text-xs font-bold ${isItemActive ? 'text-primary' : 'text-foreground'}`}>
                            Pickup #{index + 1} · {formatPickupSummary(request.material_summary)}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {selected.is_mine ? (
              <View className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50 p-2.5">
                <Text className="text-xs font-semibold text-amber-800 text-center">
                  Your pickup is active and waiting for a collector.
                </Text>
              </View>
            ) : (
              <Button
                disabled={!online}
                onPress={() => void claim(selected.id, refresh)}
                className="w-full h-12 rounded-2xl bg-primary mt-3"
              >
                <Text className="text-base font-bold text-white">
                  {online ? 'Claim Pickup' : 'Offline'}
                </Text>
              </Button>
            )}
          </View>
        )}

        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-background/80">
            <ActivityIndicator color="#19806d" size="large" />
            <Text className="mt-2 text-xs font-bold text-muted-foreground">Finding pickups...</Text>
          </View>
        )}

        {!loading && requests.length === 0 && !loadError && (
          <View className="absolute bottom-6 left-4 right-4 rounded-2xl bg-card p-4 border border-border shadow-md">
            <Text className="text-sm font-bold text-foreground text-center">No pending pickups nearby</Text>
            <Text className="text-xs text-muted-foreground text-center mt-0.5">Check back later or scan waste to request one.</Text>
          </View>
        )}

        {!!loadError && (
          <View className="absolute bottom-6 left-4 right-4 rounded-2xl bg-card p-4 border border-destructive/20 shadow-md">
            <View className="flex-row items-center gap-2">
              <CircleAlert size={16} color="#b42318" />
              <Text className="flex-1 text-xs font-medium text-destructive">{loadError}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

async function claim(requestId: string, refresh: () => Promise<void>) {
  const { error } = await supabase.rpc('claim_pickup_request', { request_id: requestId });
  if (error) {
    const message = error.message.toLowerCase();
    Alert.alert('Could not claim pickup', message.includes('active_claim_limit')
      ? 'You already have three active pickups.'
      : message.includes('cannot_claim_own')
        ? 'You cannot claim your own request.'
        : message.includes('request_') || message.includes('unavailable')
          ? 'This pickup is no longer available.'
          : error.message);
    await refresh();
    return;
  }
  await refresh();
  router.replace('/(tabs)/activity');
}
