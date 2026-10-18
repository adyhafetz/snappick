import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { MapPinned, Play, RotateCcw } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { openPickupNavigation } from '@/lib/pickup/navigation';

type PrivateDetails = { longitude: number; latitude: number; unit_number: string | null; street: string; landmark: string | null; access_instructions: string | null };
type SafePickup = { id: string; status: string; district_name: string | null; material_summary: { class?: string; quantity?: number }[]; pickup_window_start: string | null; pickup_window_end: string | null };

export default function ClaimedPickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pickup, setPickup] = useState<SafePickup | null>(null);
  const [details, setDetails] = useState<PrivateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    const { data: safe, error: safeError } = await supabase.from('my_claimed_pickups')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end').eq('id', id).maybeSingle();
    if (safeError || !safe) {
      setError('This pickup is not assigned to your account or is no longer active.');
      setPickup(null); setDetails(null); setLoading(false); return;
    }
    setPickup(safe as SafePickup);
    const { data: privateData, error: privateError } = await supabase.functions.invoke('get-pickup-private-details', { body: { request_id: id } });
    if (privateError || !isDetails(privateData)) {
      setError('The authorized destination could not be loaded. Retry when connected.');
      setDetails(null);
    } else setDetails(privateData);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const transition = async (action: 'start_pickup' | 'release_pickup_request') => {
    if (!id) return;
    setBusy(true);
    const { error: actionError } = await supabase.rpc(action, { request_id: id });
    setBusy(false);
    if (actionError) {
      Alert.alert(action === 'start_pickup' ? 'Could not start pickup' : 'Could not release pickup', 'The pickup state changed. Refresh and try again.');
      await load();
      return;
    }
    if (action === 'release_pickup_request') { router.back(); return; }
    await load();
  };

  const navigate = async () => {
    if (!details) return;
    try {
      await openPickupNavigation(details.latitude, details.longitude, Linking);
    }
    catch { Alert.alert('Maps unavailable', 'No navigation app could open this destination.'); }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
        <Text className="text-2xl font-bold text-foreground">Claimed pickup</Text>
        {loading ? <View className="py-12 items-center"><ActivityIndicator color="#176c60" /><Text className="mt-3 text-sm text-muted-foreground">Loading pickup details</Text></View> : error ? <View className="mt-5"><Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text><Button variant="outline" onPress={() => void load()} className="mt-3 self-start"><Text>Retry</Text></Button></View> : pickup ? <>
          <View className="mt-5 border-b border-border pb-4">
            <Text className="text-sm text-muted-foreground">{pickup.district_name ?? 'Perak service area'} · {pickup.status.replaceAll('_', ' ')}</Text>
            <Text className="mt-2 text-base font-semibold text-foreground">{pickup.material_summary.map((item) => `${item.quantity ?? 1} x ${item.class ?? 'item'}`).join(', ')}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">{formatWindow(pickup.pickup_window_start, pickup.pickup_window_end)}</Text>
          </View>
          {details && <View className="py-4 border-b border-border">
            <Text className="text-base font-semibold text-foreground">Pickup address</Text>
            <Text className="mt-2 text-sm text-foreground">{[details.unit_number, details.street].filter(Boolean).join(', ')}</Text>
            {details.landmark && <Text className="mt-2 text-sm text-muted-foreground">Landmark: {details.landmark}</Text>}
            {details.access_instructions && <Text className="mt-2 text-sm text-muted-foreground">Access: {details.access_instructions}</Text>}
            <Button onPress={() => void navigate()} className="mt-4 w-full"><MapPinned size={17} color="#ffffff" /><Text className="ml-2 text-sm font-semibold text-white">Navigate</Text></Button>
          </View>}
          {pickup.status === 'accepted' && <View className="mt-4 gap-3">
            <Button disabled={busy} onPress={() => void transition('start_pickup')}><Play size={16} color="#ffffff" /><Text className="ml-2 font-semibold text-white">Start pickup</Text></Button>
            <Button disabled={busy} variant="outline" onPress={() => Alert.alert('Release this pickup?', 'It will return to the pending map for other collectors.', [{ text: 'Keep pickup', style: 'cancel' }, { text: 'Release', style: 'destructive', onPress: () => void transition('release_pickup_request') }])}><RotateCcw size={16} color="#176c60" /><Text className="ml-2">Release pickup</Text></Button>
          </View>}
          {pickup.status === 'in_progress' && <View className="mt-4 rounded-md bg-primary/10 p-3"><Text className="text-sm font-semibold text-primary">Pickup in progress</Text></View>}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function isDetails(value: unknown): value is PrivateDetails {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.longitude === 'number' && typeof row.latitude === 'number' && typeof row.street === 'string';
}

function formatWindow(start: string | null, end: string | null) {
  if (!start || !end) return 'Pickup window unavailable';
  const date = new Date(start);
  return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}-${new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
