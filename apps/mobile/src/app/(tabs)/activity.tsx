import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ArrowRight, Ban, Inbox, RefreshCw, Truck } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { formatPickupSummary, formatPickupWindow } from '@/lib/pickup/marketplace';

type MyRequest = {
  id: string;
  status: string;
  district_name: string | null;
  material_summary: { class?: string; quantity?: number }[];
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  created_at: string;
};
type ClaimedPickup = Omit<MyRequest, 'created_at'> & { updated_at: string };

export default function ActivityScreen() {
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<ClaimedPickup[]>([]);
  const [claimedLoadError, setClaimedLoadError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('my_pickup_requests')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError('Your requests could not be loaded. Check your connection and try again.');
      setRequests([]);
    } else {
      setRequests((data ?? []) as MyRequest[]);
    }
    const { data: claimedRows, error: claimedError } = await supabase.from('my_claimed_pickups')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,created_at,updated_at')
      .order('updated_at', { ascending: false });
    if (claimedError) {
      setClaimedLoadError('Claimed pickups could not be loaded. Retry to refresh their status.');
      setClaimed([]);
    } else {
      setClaimedLoadError('');
      setClaimed((claimedRows ?? []) as ClaimedPickup[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadRequests();
    const channel = supabase.channel('pickup-marketplace')
      .on('broadcast', { event: 'refresh' }, () => { void loadRequests(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadRequests]));

  const cancelRequest = (requestId: string) => {
    Alert.alert('Cancel pickup request?', 'This pending request will be cancelled.', [
      { text: 'Keep request', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => {
          setCancelling(requestId);
          void (async () => {
            try {
              const { error } = await supabase.rpc('cancel_pickup_request', { request_id: requestId });
              if (error) {
                Alert.alert('Could not cancel', 'This request may no longer be cancellable. Refresh your requests and try again.');
                return;
              }
              await loadRequests();
            } finally {
              setCancelling(null);
            }
          })();
        },
      },
    ]);
  };

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
          <Text className="text-sm text-muted-foreground mt-1.5 leading-relaxed">Your pickup requests and claimed community pickups.</Text>
        </View>

        {/* Section 1: My requests */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Inbox size={18} color="#19806d" />
            <Text className="text-base font-bold text-foreground">My requests</Text>
          </View>

          {loading ? (
            <View className="py-8 items-center"><ActivityIndicator color="#19806d" /><Text className="mt-2 text-sm text-muted-foreground">Loading requests…</Text></View>
          ) : loadError ? (
            <View className="py-4 items-center">
              <Text className="text-sm text-destructive text-center">{loadError}</Text>
              <Button onPress={() => void loadRequests()} variant="outline" className="mt-3 gap-2">
                <RefreshCw size={15} color="#176c60" /><Text className="text-sm font-semibold text-foreground">Retry</Text>
              </Button>
            </View>
          ) : requests.length === 0 ? (
            <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card/60">
            <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mb-2">
              <Inbox size={20} color="#5b7072" />
            </View>
            <Text className="text-sm font-semibold text-foreground text-center">
              No active pickup requests
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1 max-w-xs">
              Requests you create will appear here with their current status.
            </Text>
            <Button
              onPress={() => router.push('/(tabs)/scan')}
              className="mt-4 bg-primary gap-1.5 h-10 px-4 rounded-xl"
            >
              <Text className="text-xs font-semibold text-white">Scan materials</Text>
              <ArrowRight size={14} color="#ffffff" />
            </Button>
            </Card>
          ) : (
            <View className="gap-3">
              {requests.map((request) => (
                <Card key={request.id} className="p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{request.district_name ?? 'Perak service area'}</Text>
                      <Text className="mt-1 text-xs text-muted-foreground">{formatSummary(request.material_summary)}</Text>
                    </View>
                    <Text className="text-xs font-bold capitalize text-primary">{request.status.replaceAll('_', ' ')}</Text>
                  </View>
                  <Text className="mt-2 text-xs text-muted-foreground">{formatWindow(request.pickup_window_start, request.pickup_window_end)}</Text>
                  <Text className="mt-1 text-[11px] text-muted-foreground">Created {new Date(request.created_at).toLocaleString()}</Text>
                  {request.status === 'pending' && (
                    <Button
                      onPress={() => cancelRequest(request.id)}
                      disabled={cancelling === request.id}
                      variant="outline"
                      size="sm"
                      className="mt-3 self-start gap-2"
                    >
                      {cancelling === request.id ? <ActivityIndicator size="small" color="#b42318" /> : <Ban size={14} color="#b42318" />}
                      <Text className="text-xs font-semibold text-destructive">Cancel request</Text>
                    </Button>
                  )}
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Section 2: Pickups I claimed */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Truck size={18} color="#19806d" />
            <Text className="text-base font-bold text-foreground">Pickups I Claimed</Text>
          </View>

          {claimedLoadError ? <View className="py-3"><Text className="text-sm text-destructive">{claimedLoadError}</Text><Button onPress={() => void loadRequests()} variant="outline" className="mt-3 self-start gap-2"><RefreshCw size={15} color="#176c60" /><Text>Retry</Text></Button></View> : claimed.length === 0 ? <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card/60">
            <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mb-2">
              <Truck size={20} color="#5b7072" />
            </View>
            <Text className="text-sm font-semibold text-foreground text-center">
              No claimed pickups
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1 max-w-xs">
              Claimed pickup history and coordination will appear here.
            </Text>
          </Card> : <View className="gap-3">{claimed.map((pickup) => (
            <Card key={pickup.id} className="p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-foreground">{pickup.district_name ?? 'Perak service area'}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">{formatPickupSummary(pickup.material_summary)}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">{formatPickupWindow(pickup.pickup_window_start, pickup.pickup_window_end)}</Text>
                </View>
                <Text className="text-xs font-bold capitalize text-primary">{pickup.status.replaceAll('_', ' ')}</Text>
              </View>
              <Button onPress={() => router.push(`/pickup/${pickup.id}` as Href)} className="mt-3 self-start gap-2" size="sm">
                <ArrowRight size={14} color="#ffffff" /><Text className="text-xs font-semibold text-white">Open pickup</Text>
              </Button>
            </Card>
          ))}</View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatSummary(summary: MyRequest['material_summary']): string {
  if (!Array.isArray(summary) || summary.length === 0) return 'No item summary available';
  return summary.map((item) => `${item.quantity ?? 1} × ${item.class ?? 'item'}`).join(', ');
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start || !end) return 'Pickup window unavailable';
  const format = (value: string) => new Date(value).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
  return `${format(start)} – ${new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
