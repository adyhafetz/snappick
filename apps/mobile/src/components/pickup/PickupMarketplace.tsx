import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Camera as MapCamera, Map, Marker } from '@maplibre/maplibre-react-native';
import { CircleAlert, LocateFixed, RefreshCw, WifiOff } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';

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
        Alert.alert('Location permission', 'Enable location permission to find pickups near you.');
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
      .select('id,district_name,material_summary,pickup_window_start,pickup_window_end,longitude,latitude,cell_count');
    if (error) {
      setLoadError('Nearby requests could not be loaded. Check your connection and retry.');
      setRequests([]);
    } else {
      setRequests((data ?? []) as MarketplaceRequest[]);
      setSelected(null);
    }
    setLoading(false);
  }, [online]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
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
      <View className="px-5 pt-3 pb-2">
        <Text className="text-2xl font-bold text-foreground">Nearby pickups</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Approximate areas only</Text>
      </View>

      <View className="flex-1 mx-3 mb-3 overflow-hidden rounded-lg bg-muted">
        <Map mapStyle={MAP_STYLE} style={{ flex: 1 }} attribution attributionPosition={{ bottom: 8, right: 8 }}
          onDidFinishLoadingMap={() => { setMapError(false); setMapReady(true); }}
          onDidFailLoadingMap={() => { setMapError(true); setMapReady(false); }}>
          <MapCamera ref={camera} initialViewState={{ center: INITIAL_POINT, zoom: 10.5 }} minZoom={4} maxZoom={19} />
          {cells.map((cell) => (
            <Marker key={cell.key} id={cell.key} lngLat={cell.coordinate} onPress={() => setSelected(cell.requests[0] ?? null)}>
              <View className="min-w-11 h-11 px-2 items-center justify-center rounded-full border-2 border-white bg-primary">
                <Text className="text-sm font-bold text-white">{cell.count}</Text>
              </View>
            </Marker>
          ))}
        </Map>

        {!mapReady && !mapError && <View pointerEvents="none" className="absolute top-3 left-3 flex-row items-center gap-2 rounded-md bg-white px-3 py-2"><ActivityIndicator size="small" color="#176c60" /><Text className="text-xs text-foreground">Loading map</Text></View>}
        {mapError && <View className="absolute top-3 left-3 right-3 rounded-md bg-white p-3"><Text className="text-sm font-semibold text-destructive">Map unavailable</Text><Text className="mt-1 text-xs text-muted-foreground">Request summaries remain available below. Check your connection and retry.</Text></View>}

        <View className="absolute top-3 right-3 rounded-md bg-white/95 px-3 py-2 flex-row items-center gap-2">
          {realtime === 'offline' ? <WifiOff size={14} color="#8a4b18" /> : <View className={`h-2 w-2 rounded-full ${realtime === 'live' ? 'bg-primary' : 'bg-amber-500'}`} />}
          <Text className="text-xs font-medium text-foreground">{realtime === 'live' ? 'Live updates' : realtime === 'offline' ? 'Offline' : realtime === 'reconnecting' ? 'Reconnecting' : 'Connecting'}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Center map on your location"
          disabled={locating}
          onPress={() => void locateCollector()}
          className="absolute top-14 right-3 h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md border border-border active:bg-muted"
        >
          {locating ? <ActivityIndicator size="small" color="#176c60" /> : <LocateFixed size={20} color="#176c60" />}
        </Pressable>

        {selected && selectedCell && (
          <View className="absolute bottom-16 left-3 right-3 max-h-[46%] rounded-lg border border-border bg-background p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground">{selected.district_name ?? 'Perak service area'}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">{formatPickupSummary(selected.material_summary)}</Text>
                <Text className="mt-1 text-xs text-muted-foreground">{formatPickupWindow(selected.pickup_window_start, selected.pickup_window_end)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close request details" onPress={() => setSelected(null)} className="h-12 w-12 items-center justify-center rounded-full bg-muted"><Text className="text-lg text-foreground">×</Text></Pressable>
            </View>
            <Text className="mt-2 text-xs text-muted-foreground">Approximate area · {selectedCell.count} {selectedCell.count === 1 ? 'request' : 'requests'} in this grid cell</Text>
            <ScrollView className="mt-2 max-h-24" nestedScrollEnabled>
              {selectedCell.requests.map((request, index) => (
                <Pressable key={request.id} onPress={() => setSelected(request)} className="py-2 border-t border-border">
                  <Text className="text-sm font-semibold text-foreground">{formatPickupSummary(request.material_summary)}</Text>
                  {index === 0 && <Text className="text-xs text-primary">Selected request</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Button disabled={!online} onPress={() => void claim(selected.id, refresh)} className="mt-2 w-full">
              <Text className="text-sm font-semibold text-white">{online ? 'Claim pickup' : 'Connect to claim pickup'}</Text>
            </Button>
          </View>
        )}

        {loading && <View className="absolute inset-0 items-center justify-center bg-background/80"><ActivityIndicator color="#176c60" /><Text className="mt-2 text-sm text-muted-foreground">Loading nearby requests</Text></View>}
        {!loading && requests.length === 0 && !loadError && <View className="absolute bottom-16 left-4 right-4 rounded-lg bg-background p-4"><Text className="text-sm font-semibold text-foreground">{online ? 'No pending pickups nearby' : 'Connect to browse pending pickups'}</Text><Text className="mt-1 text-xs text-muted-foreground">{online ? 'New requests will appear here when available.' : 'Nearby requests need an internet connection.'}</Text></View>}
        {!!loadError && <View className="absolute bottom-16 left-3 right-3 rounded-lg bg-background p-4"><View className="flex-row items-start gap-2"><CircleAlert size={17} color="#b42318" /><Text className="flex-1 text-sm text-destructive">{loadError}</Text></View><Button variant="outline" onPress={() => { setLoading(true); void refresh(); }} className="mt-2 self-start"><RefreshCw size={15} color="#176c60" /><Text className="ml-2 text-sm">Retry</Text></Button></View>}
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
        : 'This pickup is no longer available. Refresh the map and try another.');
    await refresh();
    return;
  }
  await refresh();
  router.replace('/(tabs)/activity');
}
