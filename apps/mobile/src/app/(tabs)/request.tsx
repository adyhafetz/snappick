import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { Check, CircleAlert, LocateFixed, MapPin, ShieldCheck, WifiOff } from 'lucide-react-native';
import { Camera as MapCamera, Map } from '@maplibre/maplibre-react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { BUNDLED_RULE_SET, MANUAL_SAFETY_LABELS, type RuleSet } from '@/lib/detector/rules';
import { requestGuidance, parseRuleSet, type GuidanceCard } from '@/lib/guidance/service';
import { clearPickupDraft, loadPickupDraft } from '@/lib/pickup/draft-storage';
import {
  eligibilityChanges,
  canSubmitPickup,
  evaluatePickupItems,
  isValidCoordinate,
  validatePickupForm,
  type EvaluatedPickupItem,
  type PickupDraft,
  type PickupForm,
} from '@/lib/pickup/pickup';
import { supabase } from '@/lib/supabase';

const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_POINT: [number, number] = [101.0901, 4.5975];
const DATE_CHOICES = [1, 2, 3] as const;
const TIME_CHOICES = [
  { id: 'morning', label: 'Morning', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 13, endHour: 16 },
] as const;

type AreaResolution = { districtId: string; districtName: string; ruleSet: RuleSet };
type TimeChoice = typeof TIME_CHOICES[number]['id'];

export default function RequestScreen() {
  const camera = useRef<React.ElementRef<typeof MapCamera>>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const guidanceRuleTransition = useRef('');
  const networkState = Network.useNetworkState();
  const online = networkState.isConnected === true && networkState.isInternetReachable === true;
  const mapStyle = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE;
  const [draft, setDraft] = useState<PickupDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [point, setPoint] = useState<[number, number]>(INITIAL_POINT);
  const [area, setArea] = useState<AreaResolution | null>(null);
  const [areaState, setAreaState] = useState<'loading' | 'ready' | 'outside' | 'unavailable' | 'unauthenticated' | 'error'>('loading');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [locationState, setLocationState] = useState('');
  const [ruleSet, setRuleSet] = useState<RuleSet>(BUNDLED_RULE_SET);
  const [guidance, setGuidance] = useState<Record<string, GuidanceCard>>({});
  const [form, setForm] = useState<PickupForm>({ unitNumber: '', street: '', landmark: '', accessInstructions: '', pickupNote: '' });
  const [pickupDay, setPickupDay] = useState<(typeof DATE_CHOICES)[number]>(1);
  const [pickupTime, setPickupTime] = useState<TimeChoice>('morning');
  const [restrictedConfirmed, setRestrictedConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadPickupDraft().then((nextDraft) => {
      setDraft(nextDraft);
      setRuleSet(nextDraft?.ruleSet ?? BUNDLED_RULE_SET);
      setDraftLoaded(true);
    });
  }, []);

  const originalEvaluation = useMemo(() => draft ? evaluatePickupItems(draft.items, draft.ruleSet) : [], [draft]);
  const evaluatedItems = useMemo(() => draft ? evaluatePickupItems(draft.items, ruleSet) : [], [draft, ruleSet]);
  const changedItems = useMemo(() => eligibilityChanges(originalEvaluation, evaluatedItems), [originalEvaluation, evaluatedItems]);
  const eligibleItems = evaluatedItems.filter((item) => item.eligibility === 'eligible');
  const ineligibleItems = evaluatedItems.filter((item) => item.eligibility !== 'eligible');
  const allAddressValid = !validatePickupForm(form);

  const resolveArea = useCallback(async (latitude: number, longitude: number) => {
    if (!isValidCoordinate(latitude, longitude)) {
      setArea(null);
      setAreaState('outside');
      return;
    }
    setAreaState('loading');
    try {
      const { data, error: resolveError } = await supabase.rpc('resolve_pickup_area', { lat: latitude, lng: longitude });
      if (resolveError) {
        setArea(null);
        if (resolveError.message.includes('AUTHENTICATION_REQUIRED') || resolveError.code === '28000') {
          setAreaState('unauthenticated');
        } else if (resolveError.message.toLowerCase().includes('service_area_unavailable')) {
          setAreaState('unavailable');
        } else {
          setAreaState('error');
        }
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== 'object') {
        setArea(null);
        setAreaState('outside');
        return;
      }
      const record = row as Record<string, unknown>;
      const rules = record.rules as { label?: string; classes?: unknown } | undefined;
      const nextRuleSet = parseRuleSet({
        id: record.rule_set_name,
        version: record.rule_set_version,
        label: rules?.label ?? 'Local guidance',
        classes: rules?.classes,
      });
      if (!nextRuleSet || typeof record.district_id !== 'string' || typeof record.district_name !== 'string') {
        setArea(null);
        setAreaState('error');
        return;
      }
      setArea({ districtId: record.district_id, districtName: record.district_name, ruleSet: nextRuleSet });
      setRuleSet(nextRuleSet);
      setAreaState('ready');
    } catch {
      setArea(null);
      setAreaState('error');
    }
  }, []);

  useEffect(() => {
    if (draftLoaded) void Promise.resolve().then(() => resolveArea(INITIAL_POINT[1], INITIAL_POINT[0]));
  }, [draftLoaded, resolveArea]);

  useEffect(() => {
    if (!draft || !area || (draft.ruleSet.id === ruleSet.id && draft.ruleSet.version === ruleSet.version)) return;
    const transition = `${draft.ruleSet.id}:${draft.ruleSet.version}->${ruleSet.id}:${ruleSet.version}`;
    if (guidanceRuleTransition.current === transition) return;
    guidanceRuleTransition.current = transition;
    void Promise.all(draft.items.map(async (item) => [
      item.id,
      await requestGuidance(item.className, item.condition, ruleSet),
    ] as const)).then((entries) => {
      setGuidance((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
  }, [area, draft, ruleSet]);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const updatePoint = useCallback((nextPoint: [number, number]) => {
    if (!isValidCoordinate(nextPoint[1], nextPoint[0])) return;
    setPoint(nextPoint);
    setLocationState('');
    setAreaState('loading');
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void resolveArea(nextPoint[1], nextPoint[0]), 450);
  }, [resolveArea]);

  const detectLocation = async () => {
    setLocationState('Finding your location…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationState('Location permission denied. Move the map pin manually.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextPoint: [number, number] = [current.coords.longitude, current.coords.latitude];
      setPoint(nextPoint);
      camera.current?.easeTo({ center: nextPoint, zoom: 15, duration: 650 });
      setLocationState('Current location selected.');
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void resolveArea(nextPoint[1], nextPoint[0]), 450);
    } catch {
      setLocationState('Location unavailable. Move the map pin manually.');
    }
  };

  const pickupWindow = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + pickupDay);
    const choice = TIME_CHOICES.find((item) => item.id === pickupTime) ?? TIME_CHOICES[0];
    start.setHours(choice.startHour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(choice.endHour, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString(), choice };
  }, [pickupDay, pickupTime]);

  const submit = async () => {
    setError('');
    if (!online) return setError('Connect to submit pickup.');
    if (!draft || eligibleItems.length === 0) return setError('At least one reviewed item must be eligible for pickup.');
    const formError = validatePickupForm(form);
    if (formError) return setError(formError);
    if (!restrictedConfirmed) return setError('Confirm that restricted and hazardous items have been removed or handled separately.');
    if (areaState !== 'ready' || !area) {
      return setError(areaState === 'outside'
        ? 'This point is outside the supported Perak service area.'
        : 'Wait for the pickup district to be verified before submitting.');
    }

    setSubmitting(true);
    try {
      const { data, error: createError } = await supabase.rpc('create_pickup_request', {
        p_lat: point[1],
        p_lng: point[0],
        p_unit_number: form.unitNumber.trim(),
        p_street: form.street.trim(),
        p_landmark: form.landmark.trim() || null,
        p_access_instructions: form.accessInstructions.trim() || null,
        p_pickup_note: form.pickupNote.trim() || null,
        p_pickup_window_start: pickupWindow.start,
        p_pickup_window_end: pickupWindow.end,
        p_items: evaluatedItems.map((item) => ({
          id: item.id,
          class: item.className,
          source: item.source,
          condition: item.condition,
          quantity: item.quantity,
          eligibility: item.eligibility,
        })),
        p_restricted_item_confirmation: restrictedConfirmed,
      });
      if (createError) throw new Error(safeCreateError(createError.message));
      const created = Array.isArray(data) ? data[0] : data;
      if (!created || typeof created !== 'object' || !('id' in created)) {
        throw new Error('The request could not be confirmed. Refresh My Requests before trying again.');
      }
      await clearPickupDraft();
      Alert.alert('Pickup requested', 'Your request is pending and your exact address remains private.');
      router.replace('/(tabs)/activity');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pickup could not be submitted. Try again when connected.');
    } finally {
      setSubmitting(false);
    }
  };

  const areaMessage = areaState === 'ready' && area
    ? `${area.districtName} · ${ruleSet.label} v${ruleSet.version}`
    : areaState === 'outside'
      ? 'Outside the supported Perak service area'
      : areaState === 'unauthenticated'
        ? 'Sign in to check service area'
        : areaState === 'unavailable'
          ? 'Perak service-area data is unavailable'
          : areaState === 'error'
            ? 'Could not verify this location. Try again.'
            : 'Checking district…';
  const updateForm = (key: keyof PickupForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-5 pt-3 pb-2">
        <Text className="text-2xl font-bold text-foreground">Pickup request</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Choose a private pickup point in Perak.</Text>
      </View>

      <View className="h-[270px] mx-4 overflow-hidden rounded-lg bg-muted">
        <Map
          mapStyle={mapStyle}
          style={{ flex: 1 }}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          onDidFinishLoadingMap={() => { setMapError(false); setMapReady(true); }}
          onDidFailLoadingMap={() => { setMapError(true); setMapReady(false); }}
          onLongPress={(event) => {
            const next = event.nativeEvent.lngLat as [number, number];
            setPoint(next);
            camera.current?.easeTo({ center: next, duration: 250 });
            updatePoint(next);
          }}
          onRegionDidChange={(event) => updatePoint(event.nativeEvent.center as [number, number])}
        >
          <MapCamera ref={camera} initialViewState={{ center: INITIAL_POINT, zoom: 12.5 }} minZoom={4} maxZoom={19} />
        </Map>
        <View pointerEvents="none" className="absolute left-1/2 top-1/2 -ml-4 -mt-8">
          <MapPin size={34} fill="#c94e3b" color="#ffffff" strokeWidth={2.2} />
        </View>
        {!mapReady && !mapError && (
          <View pointerEvents="none" className="absolute bottom-3 right-3 flex-row items-center gap-2 rounded-md bg-white/95 px-3 py-2">
            <ActivityIndicator size="small" color="#176c60" />
            <Text className="text-xs font-medium text-foreground">Loading map…</Text>
          </View>
        )}
        {mapError && (
          <View className="absolute left-3 right-3 top-3 rounded-md bg-white/95 p-3">
            <Text className="text-xs font-semibold text-destructive">Map tiles could not be loaded.</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">Check your connection or configure an approved MapTiler style URL.</Text>
          </View>
        )}
        <View className={`absolute left-3 max-w-[74%] rounded-md bg-white/95 px-3 py-2 ${mapError ? 'top-14' : 'top-3'}`}>
          <Text className="text-xs font-semibold text-foreground">{areaMessage}</Text>
          <Text className="mt-0.5 text-[11px] text-muted-foreground">Drag the map or press and hold to move the pin.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Use current location" onPress={() => void detectLocation()} className="absolute bottom-3 left-3 h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <LocateFixed size={21} color="#176c60" />
        </Pressable>
      </View>
      {!!locationState && <Text className="px-5 pt-1 text-xs text-muted-foreground">{locationState}</Text>}

      <ScrollView className="mt-1 flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {!draftLoaded ? <ActivityIndicator color="#176c60" /> : !draft ? (
          <View className="border-b border-border pb-5">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-foreground">Review a scan first</Text>
            </View>
            <Text className="mt-1 text-sm leading-5 text-muted-foreground">Pickup requests use the items you reviewed on the Scan screen.</Text>
            <Button onPress={() => router.push('/(tabs)/scan')} className="mt-3 self-start">
              <Text className="text-sm font-semibold text-white">Open scan</Text>
            </Button>
          </View>
        ) : (
          <>
            <View className="border-b border-border pb-4">
              <Text className="text-base font-semibold text-foreground">Items to pack</Text>
              {eligibleItems.length === 0
                ? <Text className="mt-2 text-sm text-destructive">No reviewed items are eligible under the selected district rules.</Text>
                : eligibleItems.map((item) => <ItemLine key={item.id} item={item} guidance={guidance[item.id]} />)}
            </View>

            <View className="border-b border-border py-4">
              <Text className="text-base font-semibold text-foreground">Not accepted for this pickup</Text>
              {ineligibleItems.length === 0
                ? <Text className="mt-1 text-sm text-muted-foreground">None of the reviewed items are currently restricted by these rules.</Text>
                : ineligibleItems.map((item) => <ItemLine key={item.id} item={item} guidance={guidance[item.id]} muted />)}
              {changedItems.length > 0 && <Text className="mt-2 text-xs font-medium text-amber-800">Eligibility changed after the pickup pin selected {area?.districtName ?? 'this district'} rules.</Text>}
              <View className="mt-3 rounded-md bg-muted/60 p-3">
                <Text className="text-xs font-medium text-foreground">Batteries, bulbs, e-waste, chemicals, and sharp objects are not detector labels.</Text>
                {draft.restrictedItems.length > 0 && <Text className="mt-1 text-xs text-muted-foreground">Manually declared: {draft.restrictedItems.map((key) => MANUAL_SAFETY_LABELS[key]).join(', ')}.</Text>}
              </View>
              <View className="mt-3 flex-row items-start gap-3">
                <Checkbox checked={restrictedConfirmed} onCheckedChange={(checked) => setRestrictedConfirmed(checked === true)} />
                <Pressable className="flex-1" onPress={() => setRestrictedConfirmed((value) => !value)}>
                  <Text className="text-sm leading-5 text-foreground">I have removed restricted items from this pickup or will handle them separately.</Text>
                </Pressable>
              </View>
            </View>

            <View className="border-b border-border py-4">
              <Text className="text-base font-semibold text-foreground">Pickup address</Text>
              <View className="mt-3 gap-3">
                <Field label="House or unit number" value={form.unitNumber} onChangeText={(value) => updateForm('unitNumber', value)} placeholder="12A" maxLength={40} />
                <Field label="Street" value={form.street} onChangeText={(value) => updateForm('street', value)} placeholder="Jalan Example" maxLength={160} />
                <Field label="Landmark (optional)" value={form.landmark} onChangeText={(value) => updateForm('landmark', value)} placeholder="Near the community hall" maxLength={160} />
                <Field label="Access instructions (optional)" value={form.accessInstructions} onChangeText={(value) => updateForm('accessInstructions', value)} placeholder="Gate or entrance details" multiline maxLength={500} />
                <Field label="Pickup note (optional)" value={form.pickupNote} onChangeText={(value) => updateForm('pickupNote', value)} placeholder="Any details for the collection" multiline maxLength={500} />
              </View>
              <View className="mt-3 flex-row items-start gap-2">
                <ShieldCheck size={16} color="#176c60" />
                <Text className="flex-1 text-xs leading-5 text-muted-foreground">Your address and access details are private. They are released only to the authorized collector after a successful claim.</Text>
              </View>
            </View>

            <View className="py-4">
              <Text className="text-base font-semibold text-foreground">Pickup window</Text>
              <Text className="mt-1 text-xs text-muted-foreground">Choose a day and a three-hour window.</Text>
              <View className="mt-3 flex-row gap-2">
                {DATE_CHOICES.map((day) => <Choice key={day} selected={pickupDay === day} label={dayLabel(day)} onPress={() => setPickupDay(day)} />)}
              </View>
              <View className="mt-2 flex-row gap-2">
                {TIME_CHOICES.map((choice) => <Choice key={choice.id} selected={pickupTime === choice.id} label={choice.label} onPress={() => setPickupTime(choice.id)} />)}
              </View>
              <Text className="mt-2 text-xs text-muted-foreground">
                {new Date(pickupWindow.start).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short' })} · {pickupWindow.choice.startHour}:00–{pickupWindow.choice.endHour}:00
              </Text>
            </View>

            {!online && <View className="mb-3 flex-row items-center gap-2 rounded-md bg-amber-50 p-3"><WifiOff size={16} color="#8a4b18" /><Text className="text-sm font-semibold text-amber-900">Connect to submit pickup</Text></View>}
            {!!error && <View accessibilityRole="alert" className="mb-3 flex-row items-start gap-2 rounded-md bg-destructive/10 p-3"><CircleAlert size={16} color="#b42318" /><Text className="flex-1 text-sm text-destructive">{error}</Text></View>}
            <Button disabled={!canSubmitPickup({ online, submitting, addressValid: allAddressValid, restrictedConfirmed, eligibleCount: eligibleItems.length, areaResolved: areaState === 'ready' && area !== null })} onPress={() => void submit()} className="w-full">
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Check size={17} color="#ffffff" />}
              <Text className="ml-2 text-base font-semibold text-white">Submit pickup request</Text>
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; maxLength: number }) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-foreground">{props.label}</Text>
      {props.multiline ? (
        <TextInput value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#617476" multiline textAlignVertical="top" maxLength={props.maxLength} className="min-h-20 rounded-lg border border-input bg-card px-3 py-3 text-sm text-foreground" />
      ) : (
        <Input value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} maxLength={props.maxLength} className="rounded-lg" />
      )}
    </View>
  );
}

function Choice(props: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: props.selected }} onPress={props.onPress} className={`min-h-11 flex-1 items-center justify-center rounded-md border px-3 ${props.selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
      <Text className={`text-xs font-semibold ${props.selected ? 'text-primary' : 'text-foreground'}`}>{props.label}</Text>
    </Pressable>
  );
}

function ItemLine(props: { item: EvaluatedPickupItem; guidance?: GuidanceCard; muted?: boolean }) {
  return (
    <View className="mt-2 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${props.muted ? 'text-muted-foreground' : 'text-foreground'}`}>{props.item.quantity} × {props.item.className.replaceAll('_', ' ')}</Text>
        <Text className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.item.reason}</Text>
        {props.guidance && <Text className="mt-1 text-xs leading-4 text-muted-foreground">{props.guidance.preparation}</Text>}
      </View>
      <Text className={`text-[11px] font-bold ${props.muted ? 'text-destructive' : 'text-primary'}`}>{props.item.eligibility === 'eligible' ? 'Pack' : props.item.eligibility.replaceAll('_', ' ')}</Text>
    </View>
  );
}

function dayLabel(days: number): string {
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

function safeCreateError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('authentication_required')) return 'Sign in again before submitting your pickup.';
  if (lower.includes('outside_supported_service_area')) return 'This point is outside the supported Perak service area.';
  if (lower.includes('service_area_unavailable')) return 'Perak service-area data is unavailable. Try again later.';
  if (lower.includes('restricted_item_confirmation_required')) return 'Confirm that restricted items are handled separately.';
  if (lower.includes('no_eligible_items')) return 'At least one reviewed item must be eligible for pickup.';
  if (lower.includes('invalid_coordinates')) return 'The selected map point is invalid. Move the pin and try again.';
  if (lower.includes('invalid_pickup_window')) return 'Choose a valid future pickup window.';
  if (lower.includes('invalid_private_details')) return 'Check the required address fields and try again.';
  if (lower.includes('unsupported_pickup_item') || lower.includes('invalid_pickup_item')) return 'The reviewed item list changed. Return to Scan and review it again.';
  return 'Pickup could not be submitted. Check your connection and try again.';
}
