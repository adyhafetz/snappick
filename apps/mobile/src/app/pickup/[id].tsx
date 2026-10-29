import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { ArrowLeft, Camera, Check, Image as ImageIcon, Play, RotateCcw, MapPin, Clock, ShieldAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { toByteArray } from 'base64-js';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { openPickupNavigation } from '@/lib/pickup/navigation';
import { CollectionChecklist } from '@/components/pickup/CollectionChecklist';
import { RoutePreviewMap } from '@/components/pickup/RoutePreviewMap';
import { ProofPhotoModal } from '@/components/pickup/ProofPhotoModal';
import { prepareProofImage } from '@/lib/pickup/proof';
import { toSubmission, validateChecklist, type ChecklistReason, type ChecklistRow } from '@/lib/pickup/checklist';
import { stripJpegMetadata } from '@/lib/pickup/proof-metadata';

type PrivateDetails = { longitude: number; latitude: number; unit_number: string | null; street: string; landmark: string | null; access_instructions: string | null };
type SafePickup = { id: string; status: string; district_name: string | null; material_summary: { class?: string; quantity?: number }[]; pickup_window_start: string | null; pickup_window_end: string | null };
type WasteRow = { id: string; requester_quantity: number; preparation_state: 'clean_dry' | 'contaminated_wet' | 'broken_unsafe' | 'unknown' };

export default function ClaimedPickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pickup, setPickup] = useState<SafePickup | null>(null);
  const [details, setDetails] = useState<PrivateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [proof, setProof] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [nonCollectionReason] = useState<ChecklistReason | undefined>();

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
    const { data: waste } = await supabase.from('pickup_waste_items').select('id,requester_quantity,preparation_state').eq('request_id', id).eq('accepted', true).eq('eligibility', 'eligible').order('created_at');
    setRows(((waste ?? []) as WasteRow[]).map((row) => ({ id: row.id, requesterQuantity: row.requester_quantity, collectedQuantity: row.requester_quantity, condition: row.preparation_state })));
    if (safe.status === 'accepted' || safe.status === 'in_progress') {
      const { data: privateData, error: privateError } = await supabase.functions.invoke('get-pickup-private-details', { body: { request_id: id } });
      if (privateError || !isDetails(privateData)) {
        setError('Authorized destination could not be loaded. Retry when connected.');
        setDetails(null);
      } else setDetails(privateData);
    } else {
      setDetails(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const transition = async (action: 'start_pickup' | 'release_pickup_request') => {
    if (!id) return;
    setBusy(true);
    const { error: actionError } = await supabase.rpc(action, { request_id: id });
    setBusy(false);
    if (actionError) {
      Alert.alert(action === 'start_pickup' ? 'Could not start pickup' : 'Could not release pickup', 'State changed. Refresh and retry.');
      await load();
      return;
    }
    if (action === 'release_pickup_request') { router.back(); return; }
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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setProof({ uri: result.assets[0].uri, width: result.assets[0].width, height: result.assets[0].height });
    }
  };

  const chooseProofFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setProof({ uri: result.assets[0].uri, width: result.assets[0].width, height: result.assets[0].height });
    }
  };

  const submitCollection = async () => {
    if (!id || !proof) { Alert.alert('Proof photo required', 'Take a proof photo before submitting.'); return; }
    const total = rows.reduce((sum, row) => sum + row.collectedQuantity, 0);
    const validation = validateChecklist(rows, Boolean(proof), nonCollectionReason);
    if (validation) { Alert.alert('Incomplete checklist', validation); return; }
    setBusy(true);
    try {
      const image = await prepareProofImage(proof.uri, proof.width, proof.height);
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Sign in to upload proof.');
      const path = `${userId}/${id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('proofs').upload(path, stripJpegMetadata(toByteArray(image.base64!)), { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { error: submitError } = await supabase.rpc('submit_collection', { request_id: id, p_items: toSubmission(rows), p_non_collection_reason: total === 0 ? nonCollectionReason : null, p_proof_path: path, p_captured_at: new Date().toISOString() });
      if (submitError) throw submitError;
      Alert.alert('Success', 'Collection submitted for confirmation.');
      router.replace('/(tabs)/activity');
    } catch { Alert.alert('Error', 'Could not submit collection. Try again.'); } finally { setBusy(false); }
  };

  const openProof = async () => {
    if (!id) return;
    const { data, error: proofError } = await supabase.functions.invoke('get-pickup-proof', { body: { request_id: id } });
    if (proofError || typeof data?.signed_url !== 'string') { Alert.alert('Unavailable', 'Proof photo could not be opened.'); return; }
    setProofUrl(data.signed_url);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 56 }} className="px-6 pt-4">
        {/* Top Navigation Row */}
        <View className="flex-row items-center gap-3 mb-5">
          <AnimatedPressable onPress={() => router.back()} className="h-10 w-10 rounded-2xl bg-secondary/80 border border-border items-center justify-center">
            <ArrowLeft size={18} color="#183e48" />
          </AnimatedPressable>
          <Text className="text-2xl font-black tracking-tight text-foreground">Pickup Task</Text>
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
              <Button variant="outline" size="sm" className="rounded-xl">
                <Text className="text-xs font-bold">Retry</Text>
              </Button>
            </AnimatedPressable>
          </View>
        ) : pickup ? (
          <>
            {/* Overview Card */}
            <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-sm mb-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground">
                    {pickup.district_name ?? 'Perak area'}
                  </Text>
                  <Text className="text-sm font-bold text-primary mt-1">
                    {pickup.material_summary.map((item) => `${item.quantity ?? 1} × ${item.class ?? 'item'}`).join(', ')}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-1">
                    {formatWindow(pickup.pickup_window_start, pickup.pickup_window_end)}
                  </Text>
                </View>
                <Badge variant={pickup.status === 'in_progress' ? 'default' : 'secondary'} className="px-2.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold capitalize">
                    {pickup.status.replaceAll('_', ' ')}
                  </Text>
                </Badge>
              </View>
            </Card>

            {/* Address & Navigation */}
            {details && (
              <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-sm mb-4">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <MapPin size={16} color="#19806d" />
                  <Text className="text-sm font-bold text-foreground">Destination</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">
                  {[details.unit_number, details.street].filter(Boolean).join(', ')}
                </Text>
                {details.landmark && (
                  <Text className="text-xs text-muted-foreground mt-1">
                    Landmark: {details.landmark}
                  </Text>
                )}
                {details.access_instructions && (
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Access: {details.access_instructions}
                  </Text>
                )}
                <RoutePreviewMap
                  destination={{
                    latitude: details.latitude,
                    longitude: details.longitude,
                    street: details.street,
                  }}
                  onNavigateNative={() => void navigate()}
                />
              </Card>
            )}

            {/* State Actions: Accepted */}
            {pickup.status === 'accepted' && (
              <View className="gap-2.5 mt-2">
                <Button
                  disabled={busy}
                  onPress={() => void transition('start_pickup')}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2"
                >
                  <Play size={16} color="#ffffff" />
                  <Text className="text-base font-bold text-white">Start Pickup</Text>
                </Button>

                <Button
                  disabled={busy}
                  variant="outline"
                  onPress={() =>
                    Alert.alert('Release pickup?', 'This pickup will return to the map for other collectors.', [
                      { text: 'Keep', style: 'cancel' },
                      { text: 'Release', style: 'destructive', onPress: () => void transition('release_pickup_request') },
                    ])
                  }
                  className="w-full h-12 rounded-2xl border-border flex-row items-center justify-center gap-2"
                >
                  <RotateCcw size={15} color="#5b7072" />
                  <Text className="text-base font-bold text-foreground">Release to Map</Text>
                </Button>
              </View>
            )}

            {/* State Actions: In Progress */}
            {pickup.status === 'in_progress' && (
              <View className="gap-4 mt-2">
                <CollectionChecklist rows={rows} onChange={setRows} />

                {/* Proof Photo Uploader */}
                <View className="mt-1">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-bold text-foreground">Proof of Collection</Text>
                    <Badge variant={proof ? 'success' : 'destructive'} className="px-2.5 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold">{proof ? 'Proof Ready' : 'Required'}</Text>
                    </Badge>
                  </View>

                  {proof ? (
                    <Card className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
                      <View className="relative">
                        <Image source={{ uri: proof.uri }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                        <View className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 flex-row items-center gap-1.5 shadow-sm">
                          <Check size={12} color="#10b981" />
                          <Text className="text-[11px] font-bold text-white">Attached</Text>
                        </View>
                      </View>
                      <View className="p-3 bg-card border-t border-border flex-row gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => void takeProofWithCamera()}
                          className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-2"
                        >
                          <Camera size={15} color="#19806d" />
                          <Text className="text-xs font-bold text-primary">Retake</Text>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => void chooseProofFromGallery()}
                          className="flex-1 h-9 rounded-xl flex-row items-center justify-center gap-2"
                        >
                          <ImageIcon size={15} color="#19806d" />
                          <Text className="text-xs font-bold text-primary">Choose Gallery</Text>
                        </Button>
                      </View>
                    </Card>
                  ) : (
                    <View className="flex-row gap-3">
                      {/* Option 1: Camera */}
                      <AnimatedPressable
                        onPress={() => void takeProofWithCamera()}
                        className="flex-1 p-4 rounded-2xl border border-primary/30 bg-primary/5 items-center justify-center shadow-xs"
                      >
                        <View className="h-12 w-12 rounded-2xl bg-primary/10 items-center justify-center mb-2">
                          <Camera size={24} color="#19806d" />
                        </View>
                        <Text className="text-xs font-bold text-foreground text-center">Take Photo</Text>
                        <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Use camera</Text>
                      </AnimatedPressable>

                      {/* Option 2: Gallery */}
                      <AnimatedPressable
                        onPress={() => void chooseProofFromGallery()}
                        className="flex-1 p-4 rounded-2xl border border-border/80 bg-card items-center justify-center shadow-xs"
                      >
                        <View className="h-12 w-12 rounded-2xl bg-secondary/80 items-center justify-center mb-2">
                          <ImageIcon size={24} color="#5b7072" />
                        </View>
                        <Text className="text-xs font-bold text-foreground text-center">Photo Library</Text>
                        <Text className="text-[10px] text-muted-foreground text-center mt-0.5">Choose file</Text>
                      </AnimatedPressable>
                    </View>
                  )}
                </View>

                <Button
                  disabled={busy}
                  onPress={() => void submitCollection()}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-sm"
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" />
                      <Text className="text-base font-bold text-white">Complete & Submit</Text>
                    </>
                  )}
                </Button>
              </View>
            )}

            {pickup.status === 'awaiting_confirmation' && (
              <View className="gap-3 mt-3">
                <Card className="p-4 rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-sm">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Clock size={18} color="#d97706" />
                    <Text className="text-base font-bold text-amber-800">Awaiting Confirmation</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground leading-relaxed">
                    Your collection proof was submitted. The requester has been notified to verify and confirm the pickup.
                  </Text>
                </Card>
                <Button
                  variant="outline"
                  onPress={() => void openProof()}
                  className="w-full h-12 rounded-2xl flex-row items-center justify-center gap-2"
                >
                  <Camera size={16} color="#19806d" />
                  <Text className="text-base font-bold text-primary">View Submitted Proof</Text>
                </Button>
              </View>
            )}

            {pickup.status === 'disputed' && (
              <View className="gap-3 mt-3">
                <Card className="p-4 rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
                  <View className="flex-row items-center gap-2 mb-2">
                    <ShieldAlert size={18} color="#b42318" />
                    <Text className="text-base font-bold text-destructive">Collection Under Dispute Review</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground leading-relaxed">
                    The requester reported an issue with this collection. The verification team is reviewing the submitted proof and checklist.
                  </Text>
                </Card>
                <Button
                  variant="outline"
                  onPress={() => void openProof()}
                  className="w-full h-12 rounded-2xl flex-row items-center justify-center gap-2"
                >
                  <Camera size={16} color="#19806d" />
                  <Text className="text-base font-bold text-primary">View Submitted Proof</Text>
                </Button>
              </View>
            )}

            {pickup.status === 'completed' && (
              <View className="gap-3 mt-3">
                <Card className="p-4 rounded-2xl border-emerald-500/30 bg-emerald-500/5 shadow-sm">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Check size={18} color="#16a34a" />
                    <Text className="text-base font-bold text-emerald-800">Collection Verified & Completed</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground leading-relaxed">
                    This pickup request was confirmed and closed. Thank you for keeping our community clean!
                  </Text>
                </Card>
                <Button
                  variant="outline"
                  onPress={() => void openProof()}
                  className="w-full h-12 rounded-2xl flex-row items-center justify-center gap-2"
                >
                  <Camera size={16} color="#19806d" />
                  <Text className="text-base font-bold text-primary">View Submitted Proof</Text>
                </Button>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
      <ProofPhotoModal
        visible={Boolean(proofUrl)}
        photoUrl={proofUrl}
        onClose={() => setProofUrl(null)}
      />
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
