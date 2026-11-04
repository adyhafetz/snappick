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
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import {
  ArrowRight,
  Inbox,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ProofPhotoModal } from '@/components/pickup/ProofPhotoModal';
import { PickupRatingModal } from '@/components/pickup/PickupRatingModal';
import { PickupDisputeModal } from '@/components/pickup/PickupDisputeModal';
import { PickupStatusPill } from '@/components/pickup/PickupStatusPill';
import { MyRequestDetailsModal, type MyRequestItem } from '@/components/pickup/MyRequestDetailsModal';
import { supabase } from '@/lib/supabase';
import { formatPickupWindow } from '@/lib/pickup/collect';
import { isStatusActive } from '@/lib/pickup/status';

type MyRequest = MyRequestItem;
type ClaimedPickup = MyRequestItem;

type TabType = 'requests' | 'claimed';
type FilterType = 'all' | 'active' | 'completed';

const ItemSeparator = () => <View className="h-3.5" />;

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [prevParamTab, setPrevParamTab] = useState(params.tab);
  const [activeTab, setActiveTab] = useState<TabType>(params.tab === 'claimed' ? 'claimed' : 'requests');

  if (params.tab !== prevParamTab) {
    setPrevParamTab(params.tab);
    if (params.tab === 'requests' || params.tab === 'claimed') {
      setActiveTab(params.tab);
    }
  }

  const [filter, setFilter] = useState<FilterType>('all');
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [claimed, setClaimed] = useState<ClaimedPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [claimedLoadError, setClaimedLoadError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MyRequest | null>(null);
  const [selectedClaimed, setSelectedClaimed] = useState<ClaimedPickup | null>(null);
  const [startingClaimedId, setStartingClaimedId] = useState<string | null>(null);
  const [releasingClaimedId, setReleasingClaimedId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [ratingRequestId, setRatingRequestId] = useState<string | null>(null);
  const [disputeRequestId, setDisputeRequestId] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError('');

    const { data, error } = await supabase
      .from('my_pickup_requests')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,created_at,collector_name,collector_rating,collector_rating_count')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError('Your requests could not be loaded. Check connection.');
      setRequests([]);
    } else {
      setRequests((data ?? []) as MyRequest[]);
    }

    const { data: claimedRows, error: claimedError } = await supabase
      .from('my_claimed_pickups')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,created_at,updated_at,requester_name,requester_rating,requester_rating_count')
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

  const handleStartClaimedPickup = useCallback(async (requestId: string) => {
    setStartingClaimedId(requestId);
    try {
      const { error } = await supabase.rpc('start_pickup', { request_id: requestId });
      if (error) {
        Alert.alert('Could not start pickup', 'Pickup state may have changed. Please refresh.');
        await loadRequests();
        return;
      }
      setSelectedClaimed(null);
      router.push(`/pickup/${requestId}` as Href);
    } finally {
      setStartingClaimedId(null);
    }
  }, [loadRequests]);

  const handleReleaseClaimedPickup = useCallback((requestId: string) => {
    Alert.alert(
      'Release pickup?',
      'This task will be returned to the community marketplace for other collectors.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: () => {
            setReleasingClaimedId(requestId);
            void (async () => {
              try {
                const { error } = await supabase.rpc('release_pickup_request', { request_id: requestId });
                if (error) {
                  Alert.alert('Could not release', 'Pickup state may have changed.');
                  return;
                }
                setSelectedClaimed(null);
                await loadRequests();
              } finally {
                setReleasingClaimedId(null);
              }
            })();
          },
        },
      ]
    );
  }, [loadRequests]);

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
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Pickup request in ${request.district_name ?? 'Perak area'}`}
            onPress={() => {
              if (request.status === 'pending') {
                setSelectedRequest(request);
              } else {
                router.push(`/pickup/${request.id}` as Href);
              }
            }}
            className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs"
          >
            {/* Top Row: Icon + District & Day/Date + Status Badge */}
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                <Package size={20} color="#19806d" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {request.district_name ?? 'Perak area'}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground font-medium" numberOfLines={1}>
                  {formatPickupWindow(request.pickup_window_start, request.pickup_window_end)}
                </Text>
              </View>
              <PickupStatusPill status={request.status} role="requester" />
            </View>
          </TouchableOpacity>
        );
      }

      const pickup = item as ClaimedPickup;
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open claimed pickup for ${pickup.district_name ?? 'Perak area'}`}
          onPress={() => {
            if (pickup.status === 'accepted') {
              setSelectedClaimed(pickup);
            } else {
              router.push(`/pickup/${pickup.id}` as Href);
            }
          }}
          className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs"
        >
          {/* Top Row: Icon + District & Day/Date + Status Badge (Identical to My Requests) */}
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
              <Truck size={20} color="#19806d" strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                {pickup.district_name ?? 'Perak area'}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground font-medium" numberOfLines={1}>
                {formatPickupWindow(pickup.pickup_window_start, pickup.pickup_window_end)}
              </Text>
            </View>
            <PickupStatusPill status={pickup.status} role="collector" />
          </View>
        </TouchableOpacity>
      );
    },
    [activeTab]
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Sticky Header with Title, Segmented Tabs & Filter Chips */}
      <View className="px-6 pt-4 pb-3">
        <View className="mb-3.5">
          <Text className="text-3xl font-black tracking-tight text-foreground">Activity</Text>
        </View>

        {/* Primary Segmented Tabs: My Requests vs Claimed */}
        <View className="flex-row p-1.5 rounded-2xl bg-secondary/50 border border-border/80">
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel={`My Requests, ${requests.length} total`}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('requests');
              setFilter('all');
            }}
            className={`flex-1 py-2.5 flex-row items-center justify-center gap-2 rounded-xl border ${
              activeTab === 'requests'
                ? 'bg-card shadow-xs border-border/60'
                : 'bg-transparent shadow-none border-transparent'
            }`}
          >
            <Inbox
              size={16}
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
              className={`px-2 py-0.5 rounded-full ${
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
            className={`flex-1 py-2.5 flex-row items-center justify-center gap-2 rounded-xl border ${
              activeTab === 'claimed'
                ? 'bg-card shadow-xs border-border/60'
                : 'bg-transparent shadow-none border-transparent'
            }`}
          >
            <Truck
              size={16}
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
              Claimed Tasks
            </Text>
            <View
              className={`px-2 py-0.5 rounded-full ${
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
        <View className="flex-row items-center gap-2 mt-3">
          {(['all', 'active', 'completed'] as FilterType[]).map((tabFilter) => {
            const isActive = filter === tabFilter;
            const count = tabFilter === 'all' ? currentTotal : tabFilter === 'active' ? currentActive : currentCompleted;
            const label = tabFilter === 'all' ? 'All' : tabFilter === 'active' ? 'Active' : 'Completed';
            return (
              <TouchableOpacity
                key={tabFilter}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${label}, ${count} items`}
                activeOpacity={0.7}
                onPress={() => setFilter(tabFilter)}
                className={`px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
                  isActive
                    ? 'bg-primary border-primary shadow-2xs'
                    : 'bg-card border-border/80'
                }`}
              >
                <Text
                  className={`text-xs ${
                    isActive ? 'font-bold text-white' : 'font-semibold text-muted-foreground'
                  }`}
                >
                  {label}
                </Text>
                <View
                  className={`px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-secondary'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isActive ? 'text-white' : 'text-muted-foreground'
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Virtualized FlatList */}
      <FlatList
        data={activeData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 80 }}
        ItemSeparatorComponent={ItemSeparator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRequests(true)}
            colors={['#19806d']}
            progressViewOffset={10}
          />
        }
        ListEmptyComponent={
          isListLoading ? (
            <View className="py-14 items-center">
              <ActivityIndicator color="#19806d" size="small" />
              <Text className="mt-2 text-xs font-bold text-muted-foreground">Loading activity...</Text>
            </View>
          ) : activeError ? (
            <View className="py-8 items-center">
              <Text className="text-xs text-destructive text-center font-medium">{activeError}</Text>
              <Button
                onPress={() => void loadRequests()}
                variant="outline"
                size="sm"
                className="rounded-2xl gap-2 mt-3.5 h-10 px-4"
              >
                <RefreshCw size={14} color="#19806d" />
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </View>
          ) : activeTab === 'requests' ? (
            <View className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-3xl shadow-xs mt-2">
              <View className="h-14 w-14 rounded-2xl bg-secondary/60 items-center justify-center mb-3">
                <Inbox size={26} color="#5b7072" />
              </View>
              <Text className="text-base font-bold text-foreground text-center">
                {filter === 'active'
                  ? 'No active requests'
                  : filter === 'completed'
                    ? 'No completed requests'
                    : 'No Active Requests'}
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-1 max-w-[260px] leading-relaxed">
                {filter === 'active' || filter === 'all'
                  ? 'Scan items to schedule your first free pickup.'
                  : 'Past completed or cancelled requests will appear here.'}
              </Text>
              {(filter === 'active' || filter === 'all') && (
                <Button
                  onPress={() => router.push('/(tabs)/scan')}
                  className="h-11 px-5 rounded-2xl bg-primary flex-row items-center gap-2 shadow-xs mt-4"
                >
                  <Text className="text-sm font-bold text-white">Scan Waste</Text>
                  <ArrowRight size={15} color="#ffffff" />
                </Button>
              )}
            </View>
          ) : (
            <View className="p-6 items-center justify-center border-dashed border-border/80 bg-card rounded-3xl shadow-xs mt-2">
              <View className="h-14 w-14 rounded-2xl bg-secondary/60 items-center justify-center mb-3">
                <Truck size={26} color="#5b7072" />
              </View>
              <Text className="text-base font-bold text-foreground text-center">
                {filter === 'active'
                  ? 'No active claimed tasks'
                  : filter === 'completed'
                    ? 'No past claimed tasks'
                    : 'No Claimed Tasks'}
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-1 max-w-[260px] leading-relaxed">
                {filter === 'active' || filter === 'all'
                  ? 'Explore nearby pickups on the map to collect.'
                  : 'Your completed collection tasks will appear here.'}
              </Text>
              {(filter === 'active' || filter === 'all') && (
                <Button
                  onPress={() => router.push('/(tabs)/collect')}
                  className="h-11 px-5 rounded-2xl bg-primary flex-row items-center gap-2 shadow-xs mt-4"
                >
                  <Text className="text-sm font-bold text-white">Find Pickups</Text>
                  <ArrowRight size={15} color="#ffffff" />
                </Button>
              )}
            </View>
          )
        }
        renderItem={renderItem}
      />

      <MyRequestDetailsModal
        visible={Boolean(selectedRequest)}
        mode="request"
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onCancelRequest={cancelRequest}
        cancelling={cancelling === selectedRequest?.id}
        onViewProof={(requestId) => void openProof(requestId)}
        onConfirm={(requestId) => setRatingRequestId(requestId)}
        onReportDispute={(requestId) => setDisputeRequestId(requestId)}
      />

      <MyRequestDetailsModal
        visible={Boolean(selectedClaimed)}
        mode="claimed"
        request={selectedClaimed}
        onClose={() => setSelectedClaimed(null)}
        onStartPickup={(requestId) => void handleStartClaimedPickup(requestId)}
        starting={startingClaimedId === selectedClaimed?.id}
        onReleasePickup={(requestId) => handleReleaseClaimedPickup(requestId)}
        releasing={releasingClaimedId === selectedClaimed?.id}
        onContinuePickup={(requestId) => {
          setSelectedClaimed(null);
          router.push(`/pickup/${requestId}` as Href);
        }}
      />

      <ProofPhotoModal
        visible={Boolean(proofUrl)}
        photoUrl={proofUrl}
        onClose={() => setProofUrl(null)}
      />
      <PickupRatingModal
        visible={Boolean(ratingRequestId)}
        requestId={ratingRequestId}
        onClose={() => setRatingRequestId(null)}
        onSuccess={() => void loadRequests()}
      />
      <PickupDisputeModal
        visible={Boolean(disputeRequestId)}
        requestId={disputeRequestId}
        onClose={() => setDisputeRequestId(null)}
        onSuccess={() => void loadRequests()}
      />
    </SafeAreaView>
  );
}
