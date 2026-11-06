import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Clock,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Navigation,
  Play,
  RotateCcw,
  ShieldAlert,
  Star,
  User,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { toByteArray } from 'base64-js';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { openPickupNavigation } from '@/lib/pickup/navigation';
import { CollectionChecklist } from '@/components/pickup/CollectionChecklist';
import { RoutePreviewMap } from '@/components/pickup/RoutePreviewMap';
import { ProofPhotoModal } from '@/components/pickup/ProofPhotoModal';
import { PickupRatingModal } from '@/components/pickup/PickupRatingModal';
import { formatRating } from '@/lib/pickup/rating';
import { isProofFresh, proofCapturedAt , stripJpegMetadata } from '@/lib/pickup/proof-metadata';
import { PickupDisputeModal } from '@/components/pickup/PickupDisputeModal';
import { PickupStatusPill } from '@/components/pickup/PickupStatusPill';
import { prepareProofImage } from '@/lib/pickup/proof';
import {
  type ChecklistCondition,
  type ChecklistReason,
  type ChecklistRow,
} from '@/lib/pickup/checklist';

type PrivateDetails = {
  longitude: number;
  latitude: number;
  unit_number: string | null;
  street: string;
  landmark: string | null;
  access_instructions: string | null;
};

type RequesterAddress = {
  unitNumber: string | null;
  street: string | null;
  landmark: string | null;
  note: string | null;
};

type SafePickup = {
  id: string;
  status: string;
  district_name: string | null;
  material_summary: { class?: string; quantity?: number }[];
  pickup_window_start: string | null;
  pickup_window_end: string | null;
};

type PartnerInfo = {
  name: string;
  rating: number | null;
  ratingCount: number | null;
  roleLabel: 'Collector' | 'Requester';
};

type WasteRow = {
  id: string;
  app_class: string;
  requester_quantity: number;
  preparation_state: 'clean_dry' | 'contaminated_wet' | 'broken_unsafe' | 'unknown';
};

export default function PickupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [role, setRole] = useState<'collector' | 'requester'>('collector');
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [pickup, setPickup] = useState<SafePickup | null>(null);
  const [details, setDetails] = useState<PrivateDetails | null>(null);
  const [requesterAddress, setRequesterAddress] = useState<RequesterAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [proof, setProof] = useState<{ uri: string; width: number; height: number; capturedAt: string } | null>(null);
  const [submittedProofUrl, setSubmittedProofUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    // 1. Try my_claimed_pickups (if current user is the collector)
    const { data: claimedData } = await supabase
      .from('my_claimed_pickups')
      .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,requester_name,requester_rating,requester_rating_count')
      .eq('id', id)
      .maybeSingle();

    let activePickup: SafePickup | null = null;

    if (claimedData) {
      activePickup = claimedData as SafePickup;
      setRole('collector');
      setPartner({
        name: claimedData.requester_name ?? 'Resident',
        rating: claimedData.requester_rating,
        ratingCount: claimedData.requester_rating_count,
        roleLabel: 'Requester',
      });

      // Collector: Only fetch private address & route details once the pickup has started
      if (claimedData.status !== 'accepted' && claimedData.status !== 'pending' && claimedData.status !== 'cancelled') {
        const { data: privateData, error: privateError } = await supabase.functions.invoke(
          'get-pickup-private-details',
          { body: { request_id: id } }
        );
        if (privateError || !isDetails(privateData)) {
          setDetails(null);
        } else {
          setDetails(privateData);
        }
      } else {
        setDetails(null);
      }
    } else {
      // 2. Try my_pickup_requests (if current user is the resident / requester)
      const { data: requestData } = await supabase
        .from('my_pickup_requests')
        .select('id,status,district_name,material_summary,pickup_window_start,pickup_window_end,collector_name,collector_rating,collector_rating_count')
        .eq('id', id)
        .maybeSingle();

      if (requestData) {
        activePickup = requestData as SafePickup;
        setRole('requester');
        setPartner({
          name: requestData.collector_name ?? (requestData.status === 'pending' ? 'Looking for Collector' : 'Assigned Collector'),
          rating: requestData.collector_rating,
          ratingCount: requestData.collector_rating_count,
          roleLabel: 'Collector',
        });

        // Requester: Read own pickup address details
        const { data: priv } = await supabase
          .from('pickup_request_private_details')
          .select('unit_number,street,landmark,pickup_note')
          .eq('request_id', id)
          .maybeSingle();

        if (priv) {
          setRequesterAddress({
            unitNumber: priv.unit_number,
            street: priv.street,
            landmark: priv.landmark,
            note: priv.pickup_note,
          });
        }
      }
    }

    if (!activePickup) {
      setError('This pickup was not found or is no longer active.');
      setPickup(null);
      setDetails(null);
      setLoading(false);
      return;
    }

    setPickup(activePickup);

    // 3. Load item manifest
    const { data: waste } = await supabase
      .from('pickup_waste_items')
      .select('id,app_class,requester_quantity,preparation_state')
      .eq('request_id', id)
      .eq('accepted', true)
      .eq('eligibility', 'eligible')
      .order('created_at');

    if (waste && waste.length > 0) {
      setRows(
        (waste as WasteRow[]).map((row) => ({
          id: row.id,
          appClass: row.app_class,
          requesterQuantity: row.requester_quantity,
          collectedQuantity: row.requester_quantity,
          condition: row.preparation_state,
        }))
      );
    } else if (Array.isArray(activePickup.material_summary)) {
      setRows(
        activePickup.material_summary.map((item, i) => ({
          id: `item-${i}`,
          appClass: item.class,
          requesterQuantity: item.quantity ?? 1,
          collectedQuantity: item.quantity ?? 1,
          condition: 'clean_dry' as ChecklistCondition,
        }))
      );
    }

    // 4. Automatically load the submitted proof photo for completed/awaiting review statuses
    if (activePickup.status === 'awaiting_confirmation' || activePickup.status === 'completed' || activePickup.status === 'disputed') {
      setLoadingProof(true);
      const { data: proofData } = await supabase.functions.invoke('get-pickup-proof', {
        body: { request_id: id },
      });
      if (typeof proofData?.signed_url === 'string') {
        setSubmittedProofUrl(proofData.signed_url);
      }
      setLoadingProof(false);
    } else {
      setSubmittedProofUrl(null);
    }

    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const transition = async (action: 'start_pickup' | 'release_pickup_request') => {
    if (!id) return;
    setBusy(true);
    const { error: actionError } = await supabase.rpc(action, { request_id: id });
    setBusy(false);
    if (actionError) {
      Alert.alert(
        action === 'start_pickup' ? 'Could not start pickup' : 'Could not release pickup',
        'State changed. Refresh and retry.'
      );
      await load();
      return;
    }
    if (action === 'release_pickup_request') {
      router.back();
      return;
    }
    await load();
  };

  const relist = async () => {
    if (!id) return;
    setBusy(true);
    const { error: relistError } = await supabase.rpc('relist_pickup', { request_id: id });
    setBusy(false);
    if (relistError) {
      Alert.alert('Could not relist pickup', 'This request can no longer be relisted. Refresh and try again.');
    }
    await load();
  };

  const navigate = async () => {
    if (!details) return;
    try {
      await openPickupNavigation(details.latitude, details.longitude, {
        canOpenURL: async (url) => {
          if (url.startsWith('google.navigation:')) return true;
          return Linking.canOpenURL(url);
        },
        openURL: (url) => Linking.openURL(url),
      });
    } catch {
      Alert.alert('Maps unavailable', 'No navigation app could open this destination.');
    }
  };

  const takeProofWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Camera access is required to take proof photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setProof({
        uri: result.assets[0].uri,
        width: result.assets[0].width,
        height: result.assets[0].height,
        capturedAt: new Date().toISOString(),
      });
    }
  };

  const chooseProofFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const capturedAt = proofCapturedAt('gallery', asset.exif as Record<string, unknown> | null | undefined);
    if (!capturedAt) {
      Alert.alert('Cannot verify photo', 'This photo has no capture time. Take a new photo with the camera.');
      return;
    }
    if (!isProofFresh(capturedAt)) {
      Alert.alert('Photo is too old', 'Proof photos must be taken within the last 12 hours.');
      return;
    }
    setProof({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      capturedAt: capturedAt.toISOString(),
    });
  };

  const submitCollection = async (reason?: ChecklistReason) => {
    if (!id || !proof) {
      Alert.alert('Proof photo required', 'Take a photo of the items before submitting.');
      return;
    }
    setBusy(true);
    try {
      const image = await prepareProofImage(proof.uri, proof.width, proof.height);
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Sign in to upload proof.');
      const path = `${userId}/${id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(path, stripJpegMetadata(toByteArray(image.base64!)), {
          contentType: 'image/jpeg',
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { error: submitError } = await supabase.rpc('submit_collection', {
        request_id: id,
        p_items: null,
        p_non_collection_reason: reason ?? null,
        p_proof_path: path,
        p_captured_at: proof.capturedAt,
      });
      if (submitError) throw submitError;
      Alert.alert(
        reason ? 'Pickup Updated' : 'Success',
        reason
          ? 'Pickup marked as unable to collect.'
          : 'Collection submitted for resident confirmation.'
      );
      router.replace({ pathname: '/(tabs)/activity', params: { tab: 'claimed' } });
    } catch (cause) {
      const detail = ((cause as { message?: string } | null)?.message ?? '').toLowerCase();
      Alert.alert(
        'Error',
        detail.includes('proof_time_invalid')
          ? 'Proof photos must be taken within the last 12 hours. Take a new photo.'
          : detail.includes('proof_file_invalid')
            ? 'The proof photo did not upload correctly. Take a new photo and try again.'
            : 'Could not submit collection. Try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUnableToCollect = () => {
    Alert.alert(
      'Report issue collecting items?',
      'If items are missing or hazardous, record proof and report.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Items Missing', onPress: () => void submitCollection('missing') },
        { text: 'Contaminated / Unsafe', onPress: () => void submitCollection('unsafe') },
        { text: 'Access Issue', onPress: () => void submitCollection('access_issue') },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 px-4 pt-3">
        {/* Top Header Bar */}
        <View className="flex-row items-center gap-3 mb-5">
          <AnimatedPressable
            onPress={() => router.back()}
            className="h-10 w-10 rounded-2xl bg-secondary/80 border border-border items-center justify-center"
          >
            <ArrowLeft size={18} color="#183e48" />
          </AnimatedPressable>
          <View className="flex-1">
            <Text className="text-2xl font-black tracking-tight text-foreground">Pickup Details</Text>
          </View>
        </View>

        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color="#19806d" size="large" />
            <Text className="mt-3 text-xs font-bold text-muted-foreground">Loading details...</Text>
          </View>
        ) : error ? (
          <View className="py-8 items-center">
            <Text className="text-sm font-semibold text-destructive text-center mb-3">{error}</Text>
            <AnimatedPressable onPress={() => void load()}>
              <Button variant="outline" size="sm" className="rounded-2xl h-10 px-4">
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </AnimatedPressable>
          </View>
        ) : pickup ? (
          <>
            {/* 1. Schedule Window Card (Date & Time) */}
            <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                  <Clock size={18} color="#19806d" strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Schedule Window
                  </Text>
                  <Text className="text-sm font-bold text-foreground mt-0.5" numberOfLines={1}>
                    {formatWindow(pickup.pickup_window_start, pickup.pickup_window_end)}
                  </Text>
                </View>
              </View>
              <PickupStatusPill status={pickup.status} role={role} />
            </View>

            {/* 2. Partner Profile Card (Collector or Requester) */}
            {partner && (
              <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                    <User size={18} color="#19806d" strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {partner.roleLabel}
                    </Text>
                    <Text className="text-sm font-bold text-foreground mt-0.5" numberOfLines={1}>
                      {partner.name}
                    </Text>
                  </View>
                </View>
                {(() => {
                  // Only collectors are rated; requesters never show a rating.
                  // ratingCount is null when no collector is assigned (e.g. cancelled before a claim).
                  if (partner.roleLabel !== 'Collector' || partner.ratingCount == null) return null;
                  const shown = formatRating(partner.rating, partner.ratingCount);
                  return (
                    <View className="flex-row items-center gap-1.5 bg-secondary/60 px-3 py-1.5 rounded-2xl border border-border/60">
                      {shown.rated ? (
                        <>
                          <Star size={13} color="#f59e0b" fill="#f59e0b" />
                          <Text className="text-xs font-bold text-foreground">{shown.average}</Text>
                          <Text className="text-[10px] text-muted-foreground font-medium">
                            ({shown.count})
                          </Text>
                        </>
                      ) : (
                        <Text className="text-xs font-bold text-muted-foreground">New</Text>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* 3. Items to Collect Manifest (Uniform Receipt matching Modal) */}
            <CollectionChecklist rows={rows} />

            {/* 4. Location & Navigation / Address Card */}
            {role === 'collector' ? (
              details && pickup.status !== 'accepted' ? (
                <RoutePreviewMap
                  destination={{
                    latitude: details.latitude,
                    longitude: details.longitude,
                    street: [details.unit_number, details.street].filter(Boolean).join(', '),
                  }}
                  onNavigateNative={() => void navigate()}
                />
              ) : pickup.status === 'accepted' ? (
                <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3 flex-1 mr-3">
                      <View className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                        <MapPin size={18} color="#19806d" strokeWidth={2.2} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Destination Area
                        </Text>
                        <Text className="text-sm font-bold text-foreground mt-0.5" numberOfLines={1}>
                          {pickup.district_name ?? 'Service Area'}
                        </Text>
                      </View>
                    </View>
                    <View className="px-3 py-1 rounded-full bg-secondary/80 border border-border">
                      <Text className="text-[11px] font-bold text-muted-foreground">Locked</Text>
                    </View>
                  </View>

                  <View className="p-3.5 rounded-2xl bg-secondary/40 border border-border/60 flex-row items-start gap-2.5">
                    <Navigation size={15} color="#19806d" style={{ marginTop: 2 }} />
                    <Text className="text-xs text-muted-foreground flex-1 leading-5">
                      Full street address unlocks upon starting.
                    </Text>
                  </View>
                </View>
              ) : null
            ) : (
              // Requester Address & Status Card
              requesterAddress && (
                <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4">
                  <View className="flex-row items-center gap-3 mb-2">
                    <View className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                      <MapPin size={18} color="#19806d" strokeWidth={2.2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Pickup Address
                      </Text>
                      <Text className="text-sm font-bold text-foreground mt-0.5" numberOfLines={2}>
                        {[requesterAddress.unitNumber, requesterAddress.street].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </View>
                  {requesterAddress.landmark && (
                    <Text className="text-xs text-muted-foreground mt-1 pl-1">
                      Landmark: {requesterAddress.landmark}
                    </Text>
                  )}
                </View>
              )
            )}

            {/* Requester En Route Notice when In Progress */}
            {role === 'requester' && pickup.status === 'in_progress' && (
              <View className="p-4 rounded-3xl border border-blue-500/25 bg-blue-500/5 shadow-xs mb-4 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 items-center justify-center">
                  <Navigation size={18} color="#2563eb" strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    Collection In Progress
                  </Text>
                  <Text className="text-xs font-semibold text-foreground mt-0.5">
                    Collector is on the way to collect your recyclables.
                  </Text>
                </View>
              </View>
            )}

            {/* 5. Proof Photo Uploader (When In Progress for Collector) */}
            {role === 'collector' && pickup.status === 'in_progress' && (
              <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4">
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                    <Camera size={18} color="#19806d" strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Collection Proof
                    </Text>
                    <Text className="text-sm font-bold text-foreground mt-0.5" numberOfLines={1}>
                      {proof ? 'Photo Attached' : 'Required'}
                    </Text>
                  </View>
                </View>

                {proof ? (
                  <View className="rounded-2xl border border-border/80 overflow-hidden bg-card shadow-2xs">
                    <View className="relative">
                      <Image source={{ uri: proof.uri }} style={{ width: '100%', height: 210 }} resizeMode="cover" />
                      <View className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 flex-row items-center gap-1.5 shadow-sm">
                        <Check size={12} color="#10b981" />
                        <Text className="text-[11px] font-bold text-white">Attached</Text>
                      </View>
                    </View>
                    <View className="p-3 bg-card border-t border-border/60 flex-row gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => void takeProofWithCamera()}
                        className="flex-1 h-10 rounded-2xl flex-row items-center justify-center gap-2"
                      >
                        <Camera size={15} color="#19806d" />
                        <Text className="text-xs font-bold text-primary">Retake</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => void chooseProofFromGallery()}
                        className="flex-1 h-10 rounded-2xl flex-row items-center justify-center gap-2"
                      >
                        <ImageIcon size={15} color="#19806d" />
                        <Text className="text-xs font-bold text-primary">Gallery</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-3">
                    <AnimatedPressable
                      onPress={() => void takeProofWithCamera()}
                      className="flex-1 p-4 rounded-2xl border border-primary/30 bg-primary/5 items-center justify-center shadow-2xs"
                    >
                      <View className="h-11 w-11 rounded-2xl bg-primary/10 items-center justify-center mb-2">
                        <Camera size={22} color="#19806d" />
                      </View>
                      <Text className="text-xs font-bold text-foreground text-center">Camera</Text>
                      <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Use camera</Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                      onPress={() => void chooseProofFromGallery()}
                      className="flex-1 p-4 rounded-2xl border border-border/80 bg-card items-center justify-center shadow-2xs"
                    >
                      <View className="h-11 w-11 rounded-2xl bg-secondary/80 items-center justify-center mb-2">
                        <ImageIcon size={22} color="#5b7072" />
                      </View>
                      <Text className="text-xs font-bold text-foreground text-center">Gallery</Text>
                      <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Choose file</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>
            )}

            {/* 6. Submitted Proof Photo Display (For both Collector & Requester on review / completed / disputed) */}
            {(pickup.status === 'awaiting_confirmation' ||
              pickup.status === 'disputed' ||
              pickup.status === 'completed') && (
              <View className="p-5 rounded-3xl border border-border/80 bg-card shadow-xs mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center">
                      <Camera size={16} color="#19806d" />
                    </View>
                    <Text className="text-sm font-bold text-foreground">Collection Proof</Text>
                  </View>
                  <Badge
                    variant={pickup.status === 'completed' ? 'success' : 'secondary'}
                    className="px-2.5 py-0.5 rounded-full flex-row items-center gap-1"
                  >
                    {pickup.status === 'completed' && <Check size={11} color="#16a34a" />}
                    <Text
                      className={
                        pickup.status === 'completed'
                          ? 'text-[10px] font-bold text-emerald-800'
                          : 'text-[10px] font-bold text-muted-foreground'
                      }
                    >
                      {pickup.status === 'completed'
                        ? 'Confirmed'
                        : pickup.status === 'disputed'
                          ? 'Disputed'
                          : 'Awaiting confirmation'}
                    </Text>
                  </Badge>
                </View>

                {submittedProofUrl ? (
                  <AnimatedPressable
                    onPress={() => setProofModalUrl(submittedProofUrl)}
                    className="rounded-2xl overflow-hidden border border-border/70 bg-black/5"
                  >
                    <Image
                      source={{ uri: submittedProofUrl }}
                      style={{ width: '100%', height: 230 }}
                      resizeMode="cover"
                    />
                    <View className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 flex-row items-center gap-1.5 shadow-sm">
                      <Maximize2 size={12} color="#ffffff" />
                      <Text className="text-[10px] font-bold text-white">Tap to expand</Text>
                    </View>
                  </AnimatedPressable>
                ) : loadingProof ? (
                  <View className="h-44 rounded-2xl border border-border/80 bg-secondary/30 items-center justify-center">
                    <ActivityIndicator color="#19806d" size="small" />
                    <Text className="text-xs text-muted-foreground mt-2 font-medium">Loading proof photo...</Text>
                  </View>
                ) : (
                  <View className="p-6 rounded-2xl border border-dashed border-border/80 bg-secondary/20 items-center justify-center">
                    <Text className="text-xs text-muted-foreground font-medium">Proof photo unavailable</Text>
                  </View>
                )}
              </View>
            )}

            {/* 7. Action Buttons */}
            {/* Collector: Accepted state */}
            {role === 'collector' && pickup.status === 'accepted' && (
              <View className="gap-2.5 mt-1">
                <Button
                  disabled={busy}
                  onPress={() => void transition('start_pickup')}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                >
                  <Play size={16} color="#ffffff" />
                  <Text className="text-base font-bold text-white">Start Pickup</Text>
                </Button>

                <Button
                  disabled={busy}
                  variant="outline"
                  onPress={() =>
                    Alert.alert('Release pickup task?', 'This pickup will return to the map for other collectors.', [
                      { text: 'Keep Task', style: 'cancel' },
                      { text: 'Release', style: 'destructive', onPress: () => void transition('release_pickup_request') },
                    ])
                  }
                  className="w-full h-12 rounded-2xl border-border/80 bg-card flex-row items-center justify-center gap-2"
                >
                  <RotateCcw size={15} color="#5b7072" />
                  <Text className="text-base font-bold text-foreground">Release Task</Text>
                </Button>
              </View>
            )}

            {/* Collector: In Progress state */}
            {role === 'collector' && pickup.status === 'in_progress' && (
              <View className="gap-2.5 mt-2">
                <Button
                  disabled={busy}
                  onPress={() => void submitCollection()}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" strokeWidth={2.5} />
                      <Text className="text-base font-bold text-white">Complete Pickup</Text>
                    </>
                  )}
                </Button>

                <Button
                  disabled={busy}
                  variant="outline"
                  onPress={() => handleUnableToCollect()}
                  className="w-full h-12 rounded-2xl border-amber-600/30 bg-card flex-row items-center justify-center gap-2"
                >
                  <AlertTriangle size={15} color="#b45309" />
                  <Text className="text-sm font-bold text-amber-800">Report Issue</Text>
                </Button>
              </View>
            )}

            {/* Requester: Awaiting Confirmation state (Confirm or Dispute) */}
            {role === 'requester' && pickup.status === 'awaiting_confirmation' && (
              <View className="gap-2.5 mt-2">
                <Button
                  disabled={busy}
                  onPress={() => setRatingModalVisible(true)}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                >
                  <Check size={16} color="#ffffff" strokeWidth={2.5} />
                  <Text className="text-base font-bold text-white">Confirm Collection</Text>
                </Button>

                <Button
                  disabled={busy}
                  variant="outline"
                  onPress={() => setDisputeModalVisible(true)}
                  className="w-full h-12 rounded-2xl border-destructive/25 bg-destructive/5 flex-row items-center justify-center gap-2"
                >
                  <ShieldAlert size={15} color="#b42318" />
                  <Text className="text-sm font-bold text-destructive">Report Issue</Text>
                </Button>
              </View>
            )}

            {/* Requester: pickup was not collected (e.g. dispute upheld) -> offer a new collector */}
            {role === 'requester' && pickup.status === 'not_collected' && (
              <View className="gap-2.5 mt-2 mb-4">
                <Text className="text-xs font-semibold text-muted-foreground">
                  This pickup was not collected.
                </Text>
                <Button
                  disabled={busy}
                  onPress={() => void relist()}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                >
                  <Text className="text-base font-bold text-white">Find another collector</Text>
                </Button>
              </View>
            )}

            {/* Status Notices */}
            {pickup.status === 'disputed' && (
              <View className="p-4 rounded-3xl border border-destructive/25 bg-destructive/5 shadow-xs mb-4 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-destructive/10 border border-destructive/20 items-center justify-center">
                  <AlertTriangle size={18} color="#b42318" strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-destructive uppercase tracking-wider">
                    Disputed
                  </Text>
                  <Text className="text-xs font-semibold text-foreground mt-0.5 leading-snug">
                    Dispute in progress. Admin is investigating the collection proof.
                  </Text>
                </View>
              </View>
            )}

            {pickup.status === 'completed' && (
              <View className="p-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/5 shadow-xs mb-4 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                  <Check size={18} color="#16a34a" strokeWidth={2.4} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Completed
                  </Text>
                  <Text className="text-xs font-semibold text-foreground mt-0.5">
                    Pickup successfully collected and verified.
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Proof Expanded Photo Modal */}
      <ProofPhotoModal
        visible={Boolean(proofModalUrl)}
        photoUrl={proofModalUrl}
        onClose={() => setProofModalUrl(null)}
      />

      {/* Requester Rating Confirmation Modal */}
      {pickup && (
        <PickupRatingModal
          visible={ratingModalVisible}
          requestId={pickup.id}
          onClose={() => setRatingModalVisible(false)}
          onSuccess={() => void load()}
        />
      )}

      {/* Requester Dispute Modal */}
      {pickup && (
        <PickupDisputeModal
          visible={disputeModalVisible}
          requestId={pickup.id}
          onClose={() => setDisputeModalVisible(false)}
          onSuccess={() => void load()}
        />
      )}
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
