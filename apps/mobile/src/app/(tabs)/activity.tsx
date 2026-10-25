import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ArrowRight, Ban, Camera, Check, Inbox, RefreshCw, RotateCcw, ShieldAlert, Truck } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
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

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'unsure' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'in_progress':
    case 'accepted':
      return 'default';
    case 'pending':
    case 'awaiting_confirmation':
      return 'warning';
    case 'cancelled':
    case 'disputed':
    case 'not_collected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

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
      setLoadError('Your requests could not be loaded. Check connection.');
      setRequests([]);
    } else {
      setRequests((data ?? []) as MyRequest[]);
    }
    const { data: claimedRows, error: claimedError } = await supabase.from('my_claimed_pickups')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,created_at,updated_at')
      .order('updated_at', { ascending: false });
    if (claimedError) {
      setClaimedLoadError('Claimed pickups could not be loaded.');
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
    Alert.alert('Cancel pickup?', 'This pending request will be cancelled.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          setCancelling(requestId);
          void (async () => {
            try {
              const { error } = await supabase.rpc('cancel_pickup_request', { request_id: requestId });
              if (error) {
                Alert.alert('Could not cancel', 'This request may no longer be cancellable.');
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

  const confirmPickup = async (requestId: string) => {
    const { error } = await supabase.rpc('confirm_pickup', { request_id: requestId });
    if (error) Alert.alert('Could not confirm', 'Confirmation window may have closed.');
    await loadRequests();
  };

  const disputePickup = (requestId: string) => {
    Alert.alert('Report a problem', 'Report that the collection needs review?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => void (async () => {
        const { error } = await supabase.rpc('raise_dispute', { request_id: requestId, reason: 'Pickup proof disputed' });
        if (error) Alert.alert('Could not report', 'The dispute window may have closed.');
        await loadRequests();
      })() },
    ]);
  };

  const openProof = async (requestId: string) => {
    const { data, error } = await supabase.functions.invoke('get-pickup-proof', { body: { request_id: requestId } });
    if (error || typeof data?.signed_url !== 'string') {
      Alert.alert('Unavailable', 'Collection proof photo could not be loaded.');
      return;
    }
    await Linking.openURL(data.signed_url);
  };

  const relistPickup = async (requestId: string) => {
    const { error } = await supabase.rpc('relist_pickup', { request_id: requestId });
    if (error) Alert.alert('Could not relist', 'Only uncollected requests can be relisted.');
    await loadRequests();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 56 }} className="px-6 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-black tracking-tight text-foreground">Activity</Text>
          <Text className="text-sm font-medium text-muted-foreground mt-1">
            Track your pickup requests & claimed tasks.
          </Text>
        </View>

        {/* Section 1: My requests */}
        <View className="mb-7">
          <View className="flex-row items-center gap-2 mb-3">
            <Inbox size={18} color="#19806d" />
            <Text className="text-base font-bold text-foreground">My Requests</Text>
          </View>

          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator color="#19806d" size="small" />
              <Text className="mt-2 text-xs font-bold text-muted-foreground">Loading...</Text>
            </View>
          ) : loadError ? (
            <View className="py-4 items-center">
              <Text className="text-xs text-destructive text-center font-medium">{loadError}</Text>
              <Button onPress={() => void loadRequests()} variant="outline" size="sm" className="rounded-xl gap-1.5 mt-3">
                <RefreshCw size={14} color="#19806d" />
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </View>
          ) : requests.length === 0 ? (
            <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-2xl shadow-sm">
              <View className="h-12 w-12 rounded-2xl bg-secondary/60 items-center justify-center mb-2.5">
                <Inbox size={22} color="#5b7072" />
              </View>
              <Text className="text-sm font-bold text-foreground text-center">
                No active requests
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">
                Scan recyclable items to schedule a pickup.
              </Text>
              <Button onPress={() => router.push('/(tabs)/scan')} className="h-10 px-4 rounded-2xl bg-primary flex-row items-center gap-1.5 shadow-sm mt-4">
                <Text className="text-xs font-bold text-white">Scan Waste</Text>
                <ArrowRight size={14} color="#ffffff" />
              </Button>
            </Card>
          ) : (
            <View className="gap-3">
              {requests.map((request) => (
                <Card key={request.id} className="p-4 rounded-2xl border-border/70 bg-card shadow-sm">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground">
                        {request.district_name ?? 'Perak area'}
                      </Text>
                      <Text className="mt-1 text-xs font-semibold text-primary">
                        {formatSummary(request.material_summary)}
                      </Text>
                    </View>
                    <Badge variant={statusVariant(request.status)} className="px-2.5 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold capitalize">
                        {request.status.replaceAll('_', ' ')}
                      </Text>
                    </Badge>
                  </View>

                  <Text className="mt-2 text-xs text-muted-foreground">
                    {formatWindow(request.pickup_window_start, request.pickup_window_end)}
                  </Text>

                  {request.status === 'pending' && (
                    <Button
                      onPress={() => cancelRequest(request.id)}
                      disabled={cancelling === request.id}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 rounded-xl border-destructive/20 bg-destructive/5 gap-1.5 mt-3 self-start"
                    >
                      {cancelling === request.id ? (
                        <ActivityIndicator size="small" color="#b42318" />
                      ) : (
                        <Ban size={13} color="#b42318" />
                      )}
                      <Text className="text-xs font-bold text-destructive">Cancel</Text>
                    </Button>
                  )}

                  {request.status === 'awaiting_confirmation' && (
                    <View className="mt-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => void openProof(request.id)}
                        className="self-start rounded-xl gap-1.5 h-9 px-3"
                      >
                        <Camera size={13} color="#19806d" />
                        <Text className="text-xs font-bold text-primary">View Proof</Text>
                      </Button>
                      <View className="flex-row gap-2">
                        <Button
                          size="sm"
                          onPress={() => void confirmPickup(request.id)}
                          className="flex-1 h-9 rounded-xl bg-primary gap-1"
                        >
                          <Check size={14} color="#ffffff" />
                          <Text className="text-xs font-bold text-white">Confirm</Text>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => disputePickup(request.id)}
                          className="flex-1 h-9 rounded-xl border-destructive/20 bg-destructive/5 gap-1"
                        >
                          <ShieldAlert size={14} color="#b42318" />
                          <Text className="text-xs font-bold text-destructive">Report</Text>
                        </Button>
                      </View>
                    </View>
                  )}

                  {request.status === 'not_collected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => void relistPickup(request.id)}
                      className="rounded-xl h-9 px-3 gap-1.5 mt-3 self-start"
                    >
                      <RotateCcw size={13} color="#19806d" />
                      <Text className="text-xs font-bold text-primary">Relist</Text>
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

          {claimedLoadError ? (
            <View className="py-3 items-center">
              <Text className="text-xs text-destructive text-center">{claimedLoadError}</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => void loadRequests()}
                className="rounded-xl mt-2"
              >
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </View>
          ) : claimed.length === 0 ? (
            <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-2xl shadow-sm">
              <View className="h-12 w-12 rounded-2xl bg-secondary/60 items-center justify-center mb-2.5">
                <Truck size={22} color="#5b7072" />
              </View>
              <Text className="text-sm font-bold text-foreground text-center">
                No claimed pickups
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">
                Browse nearby pickups in the Request tab to claim tasks.
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {claimed.map((pickup) => (
                <Card key={pickup.id} className="p-4 rounded-2xl border-border/70 bg-card shadow-sm">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground">
                        {pickup.district_name ?? 'Perak area'}
                      </Text>
                      <Text className="mt-1 text-xs font-semibold text-primary">
                        {formatPickupSummary(pickup.material_summary)}
                      </Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {formatPickupWindow(pickup.pickup_window_start, pickup.pickup_window_end)}
                      </Text>
                    </View>
                    <Badge variant={statusVariant(pickup.status)} className="px-2.5 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold capitalize">
                        {pickup.status.replaceAll('_', ' ')}
                      </Text>
                    </Badge>
                  </View>

                  <Button
                    size="sm"
                    onPress={() => router.push(`/pickup/${pickup.id}` as Href)}
                    className="h-9 px-3 rounded-xl bg-primary flex-row items-center gap-1.5 mt-3 self-start"
                  >
                    <Text className="text-xs font-bold text-white">Open Pickup</Text>
                    <ArrowRight size={13} color="#ffffff" />
                  </Button>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatSummary(summary: MyRequest['material_summary']): string {
  if (!Array.isArray(summary) || summary.length === 0) return 'No items';
  return summary.map((item) => `${item.quantity ?? 1} × ${item.class ?? 'item'}`).join(', ');
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start || !end) return 'Pickup window unavailable';
  const format = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  return `${format(start)} – ${new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
