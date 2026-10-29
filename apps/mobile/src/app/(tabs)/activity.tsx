import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import {
  ArrowRight,
  Ban,
  Camera,
  Check,
  Inbox,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Truck,
} from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ProofPhotoModal } from '@/components/pickup/ProofPhotoModal';
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

type TabType = 'requests' | 'claimed';
type FilterType = 'all' | 'active' | 'completed';

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'in_progress', 'awaiting_confirmation']);
function isStatusActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

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

const ItemSeparator = () => <View className="h-3" />;

export default function ActivityScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [filter, setFilter] = useState<FilterType>('all');
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [claimed, setClaimed] = useState<ClaimedPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [claimedLoadError, setClaimedLoadError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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

    const { data: claimedRows, error: claimedError } = await supabase
      .from('my_claimed_pickups')
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
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
      const channel = supabase
        .channel('pickup-marketplace')
        .on('broadcast', { event: 'refresh' }, () => {
          void loadRequests();
        })
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [loadRequests])
  );

  const cancelRequest = useCallback((requestId: string) => {
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
  }, [loadRequests]);

  const confirmPickup = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc('confirm_pickup', { request_id: requestId });
    if (error) Alert.alert('Could not confirm', 'Confirmation window may have closed.');
    await loadRequests();
  }, [loadRequests]);

  const disputePickup = useCallback((requestId: string) => {
    Alert.alert('Report a problem', 'Report that the collection needs review?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            const { error } = await supabase.rpc('raise_dispute', {
              request_id: requestId,
              reason: 'Pickup proof disputed',
            });
            if (error) Alert.alert('Could not report', 'The dispute window may have closed.');
            await loadRequests();
          })(),
      },
    ]);
  }, [loadRequests]);

  const openProof = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.functions.invoke('get-pickup-proof', {
      body: { request_id: requestId },
    });
    if (error || typeof data?.signed_url !== 'string') {
      Alert.alert('Unavailable', 'Collection proof photo could not be loaded.');
      return;
    }
    setProofUrl(data.signed_url);
  }, []);

  const relistPickup = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc('relist_pickup', { request_id: requestId });
    if (error) Alert.alert('Could not relist', 'Only uncollected requests can be relisted.');
    await loadRequests();
  }, [loadRequests]);

  // Counts for My Requests
  const activeRequestsCount = useMemo(
    () => requests.filter((r) => isStatusActive(r.status)).length,
    [requests]
  );
  const completedRequestsCount = requests.length - activeRequestsCount;

  // Counts for Claimed Pickups
  const activeClaimedCount = useMemo(
    () => claimed.filter((p) => isStatusActive(p.status)).length,
    [claimed]
  );
  const completedClaimedCount = claimed.length - activeClaimedCount;

  // Current tab active / completed counts
  const currentTotal = activeTab === 'requests' ? requests.length : claimed.length;
  const currentActive = activeTab === 'requests' ? activeRequestsCount : activeClaimedCount;
  const currentCompleted = activeTab === 'requests' ? completedRequestsCount : completedClaimedCount;

  // Filtered lists
  const filteredRequests = useMemo(() => {
    if (filter === 'active') return requests.filter((r) => isStatusActive(r.status));
    if (filter === 'completed') return requests.filter((r) => !isStatusActive(r.status));
    return requests;
  }, [requests, filter]);

  const filteredClaimed = useMemo(() => {
    if (filter === 'active') return claimed.filter((p) => isStatusActive(p.status));
    if (filter === 'completed') return claimed.filter((p) => !isStatusActive(p.status));
    return claimed;
  }, [claimed, filter]);

  const activeData = activeTab === 'requests' ? filteredRequests : filteredClaimed;
  const isListLoading = loading && !refreshing;
  const activeError = activeTab === 'requests' ? loadError : claimedLoadError;

  const renderItem = useCallback(
    ({ item }: { item: MyRequest | ClaimedPickup }) => {
      if (activeTab === 'requests') {
        const request = item as MyRequest;
        return (
          <Card className="p-4 rounded-2xl border-border/70 bg-card shadow-sm">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground">
                  {request.district_name ?? 'Perak area'}
                </Text>
                <Text className="mt-1 text-xs font-semibold text-primary">
                  {formatPickupSummary(request.material_summary)}
                </Text>
              </View>
              <Badge variant={statusVariant(request.status)} className="px-2.5 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold capitalize">
                  {request.status.replaceAll('_', ' ')}
                </Text>
              </Badge>
            </View>

            <Text className="mt-2 text-xs text-muted-foreground">
              {formatPickupWindow(request.pickup_window_start, request.pickup_window_end)}
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
        );
      }

      const pickup = item as ClaimedPickup;
      const statusText = pickup.status ? pickup.status.replaceAll('_', ' ') : 'Unknown';
      return (
        <Card className="p-4 rounded-2xl border-border/70 bg-card shadow-sm">
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
              <Text className="text-[11px] font-bold capitalize">
                {statusText}
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
      );
    },
    [activeTab, cancelling, cancelRequest, confirmPickup, disputePickup, openProof, relistPickup]
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Sticky Header with Title, Segmented Tabs & Filter Chips */}
      <View className="px-6 pt-4 pb-3">
        <View className="mb-4">
          <Text className="text-3xl font-black tracking-tight text-foreground">Activity</Text>
          <Text className="text-sm font-medium text-muted-foreground mt-1">
            Track your pickup requests & claimed tasks.
          </Text>
        </View>

        {/* Primary Segmented Tabs: My Requests vs Claimed */}
        <View className="flex-row p-1 rounded-2xl bg-secondary/60 border border-border/80">
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel={`My Requests, ${requests.length} total`}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('requests');
              setFilter('all');
            }}
            className={`flex-1 py-2 flex-row items-center justify-center gap-1.5 rounded-xl border ${
              activeTab === 'requests'
                ? 'bg-card shadow-sm border-border/60'
                : 'bg-transparent shadow-none border-transparent'
            }`}
          >
            <Inbox
              size={15}
              color={activeTab === 'requests' ? '#19806d' : '#5b7072'}
              strokeWidth={activeTab === 'requests' ? 2.4 : 1.8}
            />
            <Text
              className={`text-xs ${
                activeTab === 'requests'
                  ? 'font-bold text-foreground'
                  : 'font-semibold text-muted-foreground'
              }`}
            >
              My Requests
            </Text>
            <View
              className={`px-1.5 py-0.5 rounded-full ${
                activeTab === 'requests' ? 'bg-primary/10' : 'bg-muted'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  activeTab === 'requests' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {requests.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel={`Claimed Pickups, ${claimed.length} total`}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('claimed');
              setFilter('all');
            }}
            className={`flex-1 py-2 flex-row items-center justify-center gap-1.5 rounded-xl border ${
              activeTab === 'claimed'
                ? 'bg-card shadow-sm border-border/60'
                : 'bg-transparent shadow-none border-transparent'
            }`}
          >
            <Truck
              size={15}
              color={activeTab === 'claimed' ? '#19806d' : '#5b7072'}
              strokeWidth={activeTab === 'claimed' ? 2.4 : 1.8}
            />
            <Text
              className={`text-xs ${
                activeTab === 'claimed'
                  ? 'font-bold text-foreground'
                  : 'font-semibold text-muted-foreground'
              }`}
            >
              Claimed
            </Text>
            <View
              className={`px-1.5 py-0.5 rounded-full ${
                activeTab === 'claimed' ? 'bg-primary/10' : 'bg-muted'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  activeTab === 'claimed' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {claimed.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips: All, Active, Completed */}
        <View className="flex-row items-center gap-2 mt-2.5">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Filter all, ${currentTotal} items`}
            activeOpacity={0.7}
            onPress={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
              filter === 'all'
                ? 'bg-primary border-primary'
                : 'bg-card border-border/80'
            }`}
          >
            <Text
              className={`text-xs ${
                filter === 'all' ? 'font-bold text-white' : 'font-semibold text-muted-foreground'
              }`}
            >
              All
            </Text>
            <Text
              className={`text-[10px] font-bold ${
                filter === 'all' ? 'text-white/80' : 'text-muted-foreground'
              }`}
            >
              {currentTotal}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Filter active, ${currentActive} items`}
            activeOpacity={0.7}
            onPress={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
              filter === 'active'
                ? 'bg-primary border-primary'
                : 'bg-card border-border/80'
            }`}
          >
            <Text
              className={`text-xs ${
                filter === 'active' ? 'font-bold text-white' : 'font-semibold text-muted-foreground'
              }`}
            >
              Active
            </Text>
            <Text
              className={`text-[10px] font-bold ${
                filter === 'active' ? 'text-white/80' : 'text-muted-foreground'
              }`}
            >
              {currentActive}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Filter completed, ${currentCompleted} items`}
            activeOpacity={0.7}
            onPress={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
              filter === 'completed'
                ? 'bg-primary border-primary'
                : 'bg-card border-border/80'
            }`}
          >
            <Text
              className={`text-xs ${
                filter === 'completed' ? 'font-bold text-white' : 'font-semibold text-muted-foreground'
              }`}
            >
              Completed
            </Text>
            <Text
              className={`text-[10px] font-bold ${
                filter === 'completed' ? 'text-white/80' : 'text-muted-foreground'
              }`}
            >
              {currentCompleted}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Single Unified Virtualized FlatList */}
      <FlatList
        data={activeData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 80 }}
        ItemSeparatorComponent={ItemSeparator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRequests(true)}
            colors={['#19806d']}
          />
        }
        ListEmptyComponent={
          isListLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#19806d" size="small" />
              <Text className="mt-2 text-xs font-bold text-muted-foreground">Loading...</Text>
            </View>
          ) : activeError ? (
            <View className="py-6 items-center">
              <Text className="text-xs text-destructive text-center font-medium">{activeError}</Text>
              <Button
                onPress={() => void loadRequests()}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 mt-3"
              >
                <RefreshCw size={14} color="#19806d" />
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </View>
          ) : activeTab === 'requests' ? (
            <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-2xl shadow-sm">
              <View className="h-12 w-12 rounded-2xl bg-secondary/60 items-center justify-center mb-2.5">
                <Inbox size={22} color="#5b7072" />
              </View>
              <Text className="text-sm font-bold text-foreground text-center">
                {filter === 'active'
                  ? 'No active requests'
                  : filter === 'completed'
                    ? 'No completed requests'
                    : 'No pickup requests'}
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">
                {filter === 'active' || filter === 'all'
                  ? 'Scan recyclable items to schedule a pickup.'
                  : 'Past completed or cancelled requests will appear here.'}
              </Text>
              {(filter === 'active' || filter === 'all') && (
                <Button
                  onPress={() => router.push('/(tabs)/scan')}
                  className="h-10 px-4 rounded-xl bg-primary flex-row items-center gap-1.5 shadow-sm mt-4"
                >
                  <Text className="text-sm font-bold text-white">Scan Waste</Text>
                  <ArrowRight size={14} color="#ffffff" />
                </Button>
              )}
            </Card>
          ) : (
            <Card className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-2xl shadow-sm">
              <View className="h-12 w-12 rounded-2xl bg-secondary/60 items-center justify-center mb-2.5">
                <Truck size={22} color="#5b7072" />
              </View>
              <Text className="text-sm font-bold text-foreground text-center">
                {filter === 'active'
                  ? 'No active claimed pickups'
                  : filter === 'completed'
                    ? 'No past claimed pickups'
                    : 'No claimed pickups'}
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">
                {filter === 'active' || filter === 'all'
                  ? 'Browse nearby pickups in the Marketplace tab to claim tasks.'
                  : 'Your completed collection tasks will appear here.'}
              </Text>
              {(filter === 'active' || filter === 'all') && (
                <Button
                  onPress={() => router.push('/(tabs)/request')}
                  className="h-10 px-4 rounded-xl bg-primary flex-row items-center gap-1.5 shadow-sm mt-4"
                >
                  <Text className="text-sm font-bold text-white">Browse Marketplace</Text>
                  <ArrowRight size={14} color="#ffffff" />
                </Button>
              )}
            </Card>
          )
        }
        renderItem={renderItem}
      />

      <ProofPhotoModal
        visible={Boolean(proofUrl)}
        photoUrl={proofUrl}
        onClose={() => setProofUrl(null)}
      />
    </SafeAreaView>
  );
}
