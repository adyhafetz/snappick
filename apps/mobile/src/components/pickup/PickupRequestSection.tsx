import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { CircleAlert, LocateFixed, MapPin, ShieldCheck } from 'lucide-react-native';
import { Camera as MapCamera, Map } from '@maplibre/maplibre-react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { BUNDLED_RULE_SET, type RuleSet } from '@/lib/detector/rules';
import { parseRuleSet } from '@/lib/guidance/service';
import { clearPickupDraft } from '@/lib/pickup/draft-storage';
import {
  evaluatePickupItems,
  isValidCoordinate,
  validatePickupForm,
  type PickupItemDraft,
  type PickupForm,
} from '@/lib/pickup/pickup';
import { supabase } from '@/lib/supabase';

const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_POINT: [number, number] = [101.0901, 4.5975];
const DATE_CHOICES = [1, 2, 3] as const;
const TIME_CHOICES = [
  { id: 'morning', label: 'Morning (9am - 12pm)', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon (1pm - 4pm)', startHour: 13, endHour: 16 },
] as const;

type AreaResolution = { districtId: string; districtName: string; ruleSet: RuleSet };
type TimeChoice = typeof TIME_CHOICES[number]['id'];

export interface PickupRequestSectionProps {
  items: PickupItemDraft[];
  safetyConfirmed: boolean;
  activeRuleSet: RuleSet;
  onSuccess: () => void;
}

export function PickupRequestSection({
  items,
  safetyConfirmed,
  activeRuleSet,
  onSuccess,
}: PickupRequestSectionProps) {
  const camera = useRef<React.ElementRef<typeof MapCamera>>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const networkState = Network.useNetworkState();
  const online = networkState.isConnected === true && networkState.isInternetReachable === true;
  const mapStyle = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE;

  const [point, setPoint] = useState<[number, number]>(INITIAL_POINT);
  const [area, setArea] = useState<AreaResolution | null>(null);
  const [areaState, setAreaState] = useState<'loading' | 'ready' | 'outside' | 'unavailable' | 'unauthenticated' | 'error'>('loading');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [locationState, setLocationState] = useState('');
  const [ruleSet, setRuleSet] = useState<RuleSet>(activeRuleSet ?? BUNDLED_RULE_SET);
  const [form, setForm] = useState<PickupForm>({
    unitNumber: '',
    street: '',
    landmark: '',
    accessInstructions: '',
    pickupNote: '',
  });
  const [pickupDay, setPickupDay] = useState<(typeof DATE_CHOICES)[number]>(1);
  const [pickupTime, setPickupTime] = useState<TimeChoice>('morning');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const evaluatedItems = useMemo(() => evaluatePickupItems(items, ruleSet), [items, ruleSet]);
  const eligibleItems = evaluatedItems.filter((item) => item.eligibility === 'eligible');
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
    const timer = setTimeout(() => void resolveArea(INITIAL_POINT[1], INITIAL_POINT[0]), 0);
    return () => clearTimeout(timer);
  }, [resolveArea]);

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
    if (eligibleItems.length === 0) return setError('At least one reviewed item must be eligible for pickup.');
    const formError = validatePickupForm(form);
    if (formError) return setError(formError);
    if (!safetyConfirmed) return setError('Confirm that restricted and hazardous items have been removed or handled separately.');
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
        p_restricted_item_confirmation: safetyConfirmed,
      });
      if (createError) throw new Error(safeCreateError(createError.message));
      const created = Array.isArray(data) ? data[0] : data;
      if (!created || typeof created !== 'object' || !('id' in created)) {
        throw new Error('The request could not be confirmed. Refresh My Requests before trying again.');
      }
      await clearPickupDraft();
      onSuccess();
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
    <View className="mt-8 border-t border-border pt-6">
      <View className="mb-3">
        <Text className="text-lg font-bold text-foreground">Pickup location & address</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">Select a pickup point in Perak and enter collection details.</Text>
      </View>

      {/* Map selector */}
      <View className="h-[220px] overflow-hidden rounded-xl bg-muted relative border border-border">
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
          <MapPin size={32} fill="#c94e3b" color="#ffffff" strokeWidth={2.2} />
        </View>
        {!mapReady && !mapError && (
          <View pointerEvents="none" className="absolute bottom-3 right-3 flex-row items-center gap-2 rounded-md bg-white/95 px-3 py-1.5 shadow-sm">
            <ActivityIndicator size="small" color="#176c60" />
            <Text className="text-xs font-medium text-foreground">Loading map…</Text>
          </View>
        )}
        <View className="absolute left-3 top-3 max-w-[76%] rounded-md bg-white/95 px-3 py-1.5 shadow-sm">
          <Text className="text-xs font-semibold text-foreground">{areaMessage}</Text>
          <Text className="text-[10px] text-muted-foreground">Drag map or hold to position pin.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          onPress={() => void detectLocation()}
          className="absolute bottom-3 left-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-border"
        >
          <LocateFixed size={18} color="#176c60" />
        </Pressable>
      </View>
      {!!locationState && <Text className="pt-1 text-xs text-muted-foreground">{locationState}</Text>}

      {/* Address fields */}
      <View className="mt-4 gap-3">
        <Field label="House or unit number" value={form.unitNumber} onChangeText={(value) => updateForm('unitNumber', value)} placeholder="12A" maxLength={40} />
        <Field label="Street" value={form.street} onChangeText={(value) => updateForm('street', value)} placeholder="Jalan Sultan Azlan Shah" maxLength={160} />
        <Field label="Landmark (optional)" value={form.landmark} onChangeText={(value) => updateForm('landmark', value)} placeholder="Near community hall" maxLength={160} />
        <Field label="Access instructions (optional)" value={form.accessInstructions} onChangeText={(value) => updateForm('accessInstructions', value)} placeholder="Gate code or buzzer" multiline maxLength={500} />
        <Field label="Pickup note (optional)" value={form.pickupNote} onChangeText={(value) => updateForm('pickupNote', value)} placeholder="Any special instructions for collector" multiline maxLength={500} />
      </View>

      <View className="mt-3 flex-row items-start gap-2">
        <ShieldCheck size={16} color="#176c60" />
        <Text className="flex-1 text-xs leading-4 text-muted-foreground">
          Your exact address and notes stay strictly private until assigned to a verified collector.
        </Text>
      </View>

      {/* Pickup Window */}
      <View className="mt-5">
        <Text className="text-sm font-semibold text-foreground">Preferred collection window</Text>
        <View className="mt-2 flex-row gap-2">
          {DATE_CHOICES.map((choice) => (
            <WindowChoice key={choice} label={dayLabel(choice)} selected={pickupDay === choice} onPress={() => setPickupDay(choice)} />
          ))}
        </View>
        <View className="mt-2 flex-row gap-2">
          {TIME_CHOICES.map((choice) => (
            <WindowChoice key={choice.id} label={choice.label} selected={pickupTime === choice.id} onPress={() => setPickupTime(choice.id)} />
          ))}
        </View>
      </View>

      {/* Error display */}
      {!!error && (
        <View className="mt-4 rounded-lg bg-destructive/10 p-3 flex-row items-start gap-2">
          <CircleAlert size={16} color="#b42318" />
          <Text className="flex-1 text-xs font-medium text-destructive">{error}</Text>
        </View>
      )}

      {/* Final Submit Button */}
      <Button
        disabled={submitting || eligibleItems.length === 0 || !safetyConfirmed || !allAddressValid || areaState !== 'ready'}
        onPress={() => void submit()}
        className={`w-full mt-6 ${
          eligibleItems.length === 0 || !safetyConfirmed || !allAddressValid || areaState !== 'ready'
            ? 'bg-muted opacity-50'
            : 'bg-primary'
        }`}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className="text-base font-semibold text-white">Submit Pickup Request</Text>
        )}
      </Button>

      <Text className="text-[11px] text-muted-foreground text-center mt-2.5 mb-8">
        Requests are placed on the community marketplace. Approximate area is shown publicly.
      </Text>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength: number;
}) {
  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-muted-foreground">{props.label}</Text>
      <Input
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        multiline={props.multiline}
        numberOfLines={props.multiline ? 2 : 1}
        maxLength={props.maxLength}
        className="bg-card text-foreground"
      />
    </View>
  );
}

function WindowChoice(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className={`min-h-10 flex-1 items-center justify-center rounded-lg border px-2 ${
        props.selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <Text className={`text-xs font-semibold ${props.selected ? 'text-primary' : 'text-foreground'}`}>
        {props.label}
      </Text>
    </Pressable>
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
