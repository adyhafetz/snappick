import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CircleAlert, LocateFixed, MapPin, ShieldCheck } from 'lucide-react-native';
import { Camera as MapCamera, Map } from '@maplibre/maplibre-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
const LAST_ADDRESS_STORAGE_KEY = 'snappick:last-pickup-address';
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
    let unmounted = false;
    void AsyncStorage.getItem(LAST_ADDRESS_STORAGE_KEY).then((stored) => {
      if (!unmounted && stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            setForm((current) => ({
              ...current,
              unitNumber: parsed.unitNumber || current.unitNumber,
              street: parsed.street || current.street,
              landmark: parsed.landmark || current.landmark,
              accessInstructions: parsed.accessInstructions || current.accessInstructions,
            }));
          }
        } catch {
          // ignore
        }
      }
    });
    return () => { unmounted = true; };
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

      void Location.reverseGeocodeAsync({ latitude: current.coords.latitude, longitude: current.coords.longitude })
        .then((places) => {
          if (places && places[0]) {
            const place = places[0];
            const detectedStreet = [place.streetNumber, place.street].filter(Boolean).join(' ') || place.name || '';
            if (detectedStreet) {
              setForm((curr) => (curr.street ? curr : { ...curr, street: detectedStreet }));
            }
          }
        })
        .catch(() => {});
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
      await AsyncStorage.setItem(LAST_ADDRESS_STORAGE_KEY, JSON.stringify({
        unitNumber: form.unitNumber.trim(),
        street: form.street.trim(),
        landmark: form.landmark.trim(),
        accessInstructions: form.accessInstructions.trim(),
      }));
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
    <View className="px-6 pt-3 pb-12">
      {/* Map & Location Card */}
      <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-sm mb-4">
        <View className="flex-row items-center gap-1.5 mb-2.5">
          <MapPin size={16} color="#19806d" />
          <Text className="text-sm font-bold text-foreground">Collection Location</Text>
        </View>

        <View className="h-[200px] overflow-hidden rounded-xl bg-muted relative border border-border/70 shadow-xs">
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
            <View pointerEvents="none" className="absolute bottom-3 right-3 flex-row items-center gap-2 rounded-xl bg-card/95 px-3 py-1.5 shadow-sm">
              <ActivityIndicator size="small" color="#19806d" />
              <Text className="text-xs font-bold text-foreground">Loading...</Text>
            </View>
          )}
          <View className="absolute left-3 top-3 max-w-[76%] rounded-xl bg-card/95 px-3 py-1.5 shadow-sm border border-border/60">
            <Text className="text-xs font-bold text-foreground">{areaMessage}</Text>
          </View>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            onPress={() => void detectLocation()}
            className="absolute bottom-3 left-3 h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-sm border border-border"
          >
            <LocateFixed size={18} color="#19806d" />
          </AnimatedPressable>
        </View>
        {!!locationState && <Text className="pt-2 text-xs text-muted-foreground">{locationState}</Text>}
      </Card>

      {/* Address fields Card */}
      <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-sm mb-4">
        <Text className="text-sm font-bold text-foreground mb-3">Address & Access Details</Text>
        <View className="gap-2.5">
          <Field label="Unit / House No." value={form.unitNumber} onChangeText={(value) => updateForm('unitNumber', value)} placeholder="e.g. 12A" maxLength={40} />
          <Field label="Street" value={form.street} onChangeText={(value) => updateForm('street', value)} placeholder="e.g. Jalan Sultan Azlan Shah" maxLength={160} />
          <Field label="Landmark (optional)" value={form.landmark} onChangeText={(value) => updateForm('landmark', value)} placeholder="e.g. Next to community hall" maxLength={160} />
          <Field label="Access instructions (optional)" value={form.accessInstructions} onChangeText={(value) => updateForm('accessInstructions', value)} placeholder="Gate code or entrance notes" multiline maxLength={500} />
          <Field label="Pickup note (optional)" value={form.pickupNote} onChangeText={(value) => updateForm('pickupNote', value)} placeholder="Notes for collector" multiline maxLength={500} />
        </View>

        <View className="mt-3.5 flex-row items-center gap-1.5 pt-2.5 border-t border-border/50">
          <ShieldCheck size={14} color="#19806d" />
          <Text className="flex-1 text-[11px] text-muted-foreground">
            Address is kept private until assigned to a collector.
          </Text>
        </View>
      </Card>

      {/* Pickup Window Card */}
      <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-sm mb-4">
        <Text className="text-sm font-bold text-foreground mb-2.5">Preferred Collection Time</Text>
        <Text className="text-xs text-muted-foreground mb-1.5 font-medium">Select day:</Text>
        <View className="flex-row gap-2 mb-3">
          {DATE_CHOICES.map((choice) => (
            <WindowChoice key={choice} label={dayLabel(choice)} selected={pickupDay === choice} onPress={() => setPickupDay(choice)} />
          ))}
        </View>
        <Text className="text-xs text-muted-foreground mb-1.5 font-medium">Select time window:</Text>
        <View className="flex-row gap-2">
          {TIME_CHOICES.map((choice) => (
            <WindowChoice key={choice.id} label={choice.label} selected={pickupTime === choice.id} onPress={() => setPickupTime(choice.id)} />
          ))}
        </View>
      </Card>

      {/* Error display */}
      {!!error && (
        <View className="mt-2 mb-4 rounded-2xl bg-destructive/10 p-3.5 flex-row items-center gap-2 border border-destructive/20">
          <CircleAlert size={16} color="#b42318" />
          <Text className="flex-1 text-xs font-medium text-destructive">{error}</Text>
        </View>
      )}

      {/* Final Submit Button */}
      {(() => {
        const isSubmitDisabled =
          submitting ||
          eligibleItems.length === 0 ||
          !safetyConfirmed ||
          !allAddressValid ||
          areaState !== 'ready';

        return (
          <View className="mt-2">
            <Button
              disabled={isSubmitDisabled}
              onPress={() => void submit()}
              className="w-full h-12 rounded-2xl bg-primary shadow-sm"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-base font-bold text-white">Submit Pickup Request</Text>
              )}
            </Button>

            {isSubmitDisabled && !submitting && (
              <Text className="mt-2.5 text-center text-xs text-muted-foreground font-medium">
                {eligibleItems.length === 0
                  ? 'At least one item must be eligible for pickup'
                  : !safetyConfirmed
                  ? 'Please confirm the safety declaration above'
                  : !allAddressValid
                  ? 'Please enter your unit/house number and street'
                  : areaState === 'loading'
                  ? 'Checking service area...'
                  : areaState === 'outside'
                  ? 'Selected location is outside supported Perak service area'
                  : 'Complete required fields to submit'}
              </Text>
            )}
          </View>
        );
      })()}
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
      <Text className="mb-1 text-xs font-bold text-muted-foreground">{props.label}</Text>
      <Input
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        multiline={props.multiline}
        numberOfLines={props.multiline ? 2 : 1}
        maxLength={props.maxLength}
        className="bg-card text-foreground rounded-xl border-border/70"
      />
    </View>
  );
}

function WindowChoice(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className={`min-h-10 flex-1 items-center justify-center rounded-xl border px-2 ${
        props.selected ? 'border-primary bg-primary/10' : 'border-border/70 bg-card'
      }`}
    >
      <Text className={`text-xs font-bold ${props.selected ? 'text-primary' : 'text-foreground'}`}>
        {props.label}
      </Text>
    </AnimatedPressable>
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
