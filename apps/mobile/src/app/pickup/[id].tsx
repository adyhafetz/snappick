import * as React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { Camera, Check, Image as ImageIcon, Play, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { toByteArray } from 'base64-js';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { openPickupNavigation } from '@/lib/pickup/navigation';
import { CollectionChecklist } from '@/components/pickup/CollectionChecklist';
import { RoutePreviewMap } from '@/components/pickup/RoutePreviewMap';
import { prepareProofImage } from '@/lib/pickup/proof';
import { CHECKLIST_REASONS, toSubmission, validateChecklist, type ChecklistReason, type ChecklistRow } from '@/lib/pickup/checklist';
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
  const [nonCollectionReason, setNonCollectionReason] = useState<ChecklistReason | undefined>();

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
        setError('The authorized destination could not be loaded. Retry when connected.');
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
      await openPickupNavigation(details.latitude, details.longitude, {
        canOpenURL: async (url) => {
          // Android 11+ package visibility blocks canOpenURL for custom schemes,
          // but openURL works directly for google.navigation intents.
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
      Alert.alert('Camera permission needed', 'SnapPick requires camera access to capture pickup proof photos.');
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
    if (!id || !proof) { Alert.alert('Proof photo required', 'Add a JPEG proof photo before submitting.'); return; }
    const total = rows.reduce((sum, row) => sum + row.collectedQuantity, 0);
    const validation = validateChecklist(rows, Boolean(proof), nonCollectionReason); if (validation) { Alert.alert('Checklist incomplete', validation); return; }
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
      Alert.alert('Collection submitted', 'Proof and checklist submitted for requester confirmation.');
      router.replace('/(tabs)/activity');
    } catch { Alert.alert('Could not submit collection', 'Check your connection and try again.'); } finally { setBusy(false); }
  };
  const openProof = async () => {
    if (!id) return;
    const { data, error: proofError } = await supabase.functions.invoke('get-pickup-proof', { body: { request_id: id } });
    if (proofError || typeof data?.signed_url !== 'string') { Alert.alert('Proof unavailable', 'The authorized proof could not be opened.'); return; }
    await Linking.openURL(data.signed_url);
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
            <RoutePreviewMap
              destination={{
                latitude: details.latitude,
                longitude: details.longitude,
                street: details.street,
              }}
              onNavigateNative={() => void navigate()}
            />
          </View>}
          {pickup.status === 'accepted' && <View className="mt-4 gap-3">
            <Button disabled={busy} onPress={() => void transition('start_pickup')}><Play size={16} color="#ffffff" /><Text className="ml-2 font-semibold text-white">Start pickup</Text></Button>
            <Button disabled={busy} variant="outline" onPress={() => Alert.alert('Release this pickup?', 'It will return to the pending map for other collectors.', [{ text: 'Keep pickup', style: 'cancel' }, { text: 'Release', style: 'destructive', onPress: () => void transition('release_pickup_request') }])}><RotateCcw size={16} color="#176c60" /><Text className="ml-2">Release pickup</Text></Button>
          </View>}
          {pickup.status === 'in_progress' && <View className="mt-4 gap-3"><CollectionChecklist rows={rows} onChange={setRows} />{rows.every((row) => row.collectedQuantity === 0) && <View className="flex-row flex-wrap gap-2">{CHECKLIST_REASONS.map((reason) => <Pressable key={reason} accessibilityRole="radio" accessibilityState={{ selected: nonCollectionReason === reason }} onPress={() => setNonCollectionReason(reason)} className={`rounded-md border px-2 py-2 ${nonCollectionReason === reason ? 'border-amber-600 bg-amber-50' : 'border-border'}`}><Text className="text-xs text-foreground">{reason.replaceAll('_', ' ')}</Text></Pressable>)}</View>}{proof ? (
              <View className="rounded-xl border border-border bg-card overflow-hidden">
                <View className="relative">
                  <Image source={{ uri: proof.uri }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                  <View className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1">
                    <Text className="text-[11px] font-medium text-white">Proof photo</Text>
                  </View>
                </View>
                <View className="p-3 bg-card border-t border-border">
                  <Text className="text-xs text-muted-foreground mb-2.5">
                    Photo attached. Resized to 800 px and metadata stripped on submit.
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => void takeProofWithCamera()}
                      className="flex-1 flex-row items-center justify-center gap-1.5"
                    >
                      <Camera size={14} color="#176c60" />
                      <Text className="text-xs font-semibold text-primary">Retake photo</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => void chooseProofFromGallery()}
                      className="flex-1 flex-row items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={14} color="#176c60" />
                      <Text className="text-xs font-semibold text-primary">From gallery</Text>
                    </Button>
                  </View>
                </View>
              </View>
            ) : (
              <View className="rounded-xl border border-border p-3 bg-card/60">
                <Pressable
                  onPress={() => void takeProofWithCamera()}
                  className="items-center justify-center rounded-lg bg-primary/10 border border-primary/30 p-4"
                >
                  <Camera size={26} color="#176c60" />
                  <Text className="mt-2 text-sm font-semibold text-primary">Take proof photo</Text>
                  <Text className="mt-1 text-xs text-muted-foreground text-center">
                    Captures directly with camera. Resized to 800 px and metadata stripped.
                  </Text>
                </Pressable>
                <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-border/60">
                  <Text className="text-xs text-muted-foreground">Have a photo already?</Text>
                  <Pressable
                    onPress={() => void chooseProofFromGallery()}
                    className="flex-row items-center gap-1.5 py-1 px-2"
                  >
                    <ImageIcon size={14} color="#176c60" />
                    <Text className="text-xs font-semibold text-primary">Choose from gallery</Text>
                  </Pressable>
                </View>
              </View>
            )}<Button disabled={busy} onPress={() => void submitCollection()}><Check size={16} color="#ffffff" /><Text className="ml-2 font-semibold text-white">Submit collection</Text></Button></View>}
          {pickup.status === 'awaiting_confirmation' && <Button variant="outline" onPress={() => void openProof()} className="mt-4 self-start"><Camera size={16} color="#176c60" /><Text className="ml-2">View collection proof</Text></Button>}
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
