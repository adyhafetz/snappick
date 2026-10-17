import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  Camera,
  Image as ImageIcon,
  RotateCcw,
  MapPin,
  Check,
  AlertTriangle,
  AlertCircle,
  Plus,
  Sparkles,
  ShieldAlert,
} from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { scanPhoto, type ScanResult } from '@/lib/detector/scanner';
import {
  BUNDLED_RULE_SET,
  evaluateEligibility,
  MANUAL_SAFETY_LABELS,
  type ManualSafetyKey,
  type RuleSet,
} from '@/lib/detector/rules';
import { materialPresentation, pickupDecision } from '@/lib/detector/presentation';
import type { Condition, Detection } from '@/lib/detector/types';
import { hazardGuidanceKey, parseRuleSet, requestGuidance, type GuidanceCard } from '@/lib/guidance/service';
import {
  bundledAdvice,
  resolveLocationRuleSet,
  resolvePreferredRuleSet,
  sourceBadge,
} from '@/lib/guidance/presentation';
import bundledAdviceData from '@/assets/bundled_advice.json';
import { supabase } from '@/lib/supabase';
import modelManifest from '@/assets/models/model_manifest.json';
import { savePickupDraft } from '@/lib/pickup/draft-storage';
import { type PickupDraft } from '@/lib/pickup/pickup';

type Photo = { uri: string; width: number; height: number };
type ReviewItem = {
  id: string;
  detection?: Detection;
  label: string;
  condition: Condition;
  removed: boolean;
  userAdded: boolean;
  confirmed: boolean;
  guidance: GuidanceCard;
};
const RULE_SET_STORAGE_KEY = 'snappick:last-confirmed-rule-set';
const BUNDLED_ACTIVE_RULE_SET = BUNDLED_RULE_SET as RuleSet;

const LABELS = modelManifest.labels;
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'clean_dry', label: 'Clean & dry' },
  { value: 'contaminated_wet', label: 'Wet' },
  { value: 'broken_unsafe', label: 'Broken' },
  { value: 'unknown', label: 'Unknown' },
];

export default function ScanScreen() {
  const camera = useRef<CameraView>(null);
  const rows = useRef<Record<string, number>>({});
  const sheetTop = useRef(0);
  const reviewScroll = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<Photo>();
  const [result, setResult] = useState<ScanResult>();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [hazards, setHazards] = useState<Record<ManualSafetyKey, boolean>>({
    batteries: false,
    bulbs: false,
    e_waste: false,
    chemicals: false,
    sharp_objects: false,
    other_hazards: false,
  });
  const [activeRuleSet, setActiveRuleSet] = useState<RuleSet>(BUNDLED_ACTIVE_RULE_SET);
  const [ruleSetMessage, setRuleSetMessage] = useState('General Perak guidance');

  useEffect(() => {
    void AsyncStorage.getItem(RULE_SET_STORAGE_KEY).then((serialized) => {
      if (!serialized) return;
      try {
        const saved = parseRuleSet(JSON.parse(serialized));
        const preferred = resolvePreferredRuleSet(saved, BUNDLED_ACTIVE_RULE_SET);
        if (
          preferred.id !== BUNDLED_ACTIVE_RULE_SET.id ||
          preferred.version !== BUNDLED_ACTIVE_RULE_SET.version
        ) {
          setActiveRuleSet(preferred);
          setRuleSetMessage(`${preferred.label} · v${preferred.version}`);
        }
      } catch {
        /* Invalid local cache falls back to the bundled rule set. */
      }
    });
  }, []);

  const runScan = async (nextPhoto: Photo) => {
    setPhoto(nextPhoto);
    setResult(undefined);
    setError(undefined);
    setBusy(true);
    setSafetyConfirmed(false);
    try {
      const nextResult = await scanPhoto(nextPhoto.uri, nextPhoto.width, nextPhoto.height);
      const nextItems = nextResult.detections.map((detection, index) => ({
        id: `det-${index}`,
        detection,
        label: detection.label,
        condition: 'clean_dry' as Condition,
        removed: false,
        userAdded: false,
        confirmed: false,
        guidance: {
          ...bundledAdvice(detection.label, 'clean_dry'),
          source: 'fallback' as const,
          ruleSetId: activeRuleSet.id,
          ruleSetLabel: activeRuleSet.label,
          ruleSetVersion: activeRuleSet.version,
          offline: true,
        },
      }));
      setResult(nextResult);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id);
      void Promise.all(
        nextItems.map(async (item) => ({
          id: item.id,
          label: item.label,
          condition: item.condition,
          guidance: await requestGuidance(item.label, item.condition, activeRuleSet),
        }))
      ).then((guidance) =>
        setItems((current) =>
          current.map((item) => {
            const res = guidance.find((entry) => entry.id === item.id);
            return res &&
              item.label === res.label &&
              item.condition === res.condition &&
              item.guidance.ruleSetId === activeRuleSet.id &&
              item.guidance.ruleSetVersion === activeRuleSet.version
              ? { ...item, guidance: res.guidance }
              : item;
          })
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The photo could not be scanned.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camera.current) return;
    try {
      const picture: CameraCapturedPicture = await camera.current.takePictureAsync({
        quality: 0.9,
      });
      await runScan({ uri: picture.uri, width: picture.width, height: picture.height });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Camera capture failed.');
    }
  };

  const pick = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!picked.canceled && picked.assets[0]) {
        const asset = picked.assets[0];
        await runScan({ uri: asset.uri, width: asset.width, height: asset.height });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The photo could not be opened.');
    }
  };

  const selectItem = (id: string) => {
    setSelectedId(id);
    const y = rows.current[id];
    if (typeof y === 'number') {
      reviewScroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  const updateItem = (id: string, patch: Partial<ReviewItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const refreshGuidance = (
    id: string,
    label: string,
    condition: Condition,
    ruleSet = activeRuleSet
  ) => {
    void requestGuidance(label, condition, ruleSet).then((guidance) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id &&
          item.label === label &&
          item.condition === condition &&
          item.guidance.ruleSetId === ruleSet.id &&
          item.guidance.ruleSetVersion === ruleSet.version
            ? { ...item, guidance }
            : item
        )
      );
    });
  };

  const updateCondition = (item: ReviewItem, condition: Condition) => {
    updateItem(item.id, {
      condition,
      guidance: {
        ...bundledAdvice(item.label, condition),
        source: 'fallback',
        ruleSetId: activeRuleSet.id,
        ruleSetLabel: activeRuleSet.label,
        ruleSetVersion: activeRuleSet.version,
        offline: true,
      },
    });
    refreshGuidance(item.id, item.label, condition);
  };

  const resolveLocationGuidance = async () => {
    setRuleSetMessage('Checking local guidance…');
    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        setRuleSetMessage(`${activeRuleSet.label} · location unavailable`);
        Alert.alert(
          activeRuleSet.label,
          `Location was not shared. ${activeRuleSet.label} will be used.`
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { data, error: resolutionError } = await supabase.rpc('resolve_rule_set', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      const row = Array.isArray(data) ? data[0] : data;
      const resolvedCandidate =
        row && typeof row === 'object'
          ? parseRuleSet({
              id: (row as { name?: string }).name,
              version: (row as { version?: number }).version,
              label: ((row as { rules?: { label?: string } }).rules?.label) ?? 'Local guidance',
              classes: (row as { rules?: { classes?: unknown } }).rules?.classes,
            })
          : null;
      const resolved = resolutionError
        ? null
        : resolveLocationRuleSet(resolvedCandidate, activeRuleSet);
      if (!resolvedCandidate || !resolved) {
        setRuleSetMessage(`${activeRuleSet.label} · local rules unavailable`);
        Alert.alert(
          activeRuleSet.label,
          `Local rules are unavailable for this area. ${activeRuleSet.label} will be used.`
        );
        return;
      }
      setActiveRuleSet(resolved);
      setRuleSetMessage(`${resolved.label} · v${resolved.version}`);
      await AsyncStorage.setItem(RULE_SET_STORAGE_KEY, JSON.stringify(resolved));
      setItems((current) =>
        current.map((item) => ({
          ...item,
          guidance: {
            ...bundledAdvice(item.label, item.condition),
            source: 'fallback',
            ruleSetId: resolved.id,
            ruleSetLabel: resolved.label,
            ruleSetVersion: resolved.version,
            offline: true,
          },
        }))
      );
      items
        .filter((item) => !item.removed)
        .forEach((item) =>
          refreshGuidance(item.id, item.label, item.condition, resolved)
        );
    } catch {
      setRuleSetMessage(`${activeRuleSet.label} · location unavailable`);
      Alert.alert(
        activeRuleSet.label,
        `Location or local rule lookup is unavailable. ${activeRuleSet.label} will be used.`
      );
    }
  };

  const changeLabel = (item: ReviewItem) =>
    Alert.alert(
      'Change label',
      'Choose the visual label for this item.',
      LABELS.map((label) => ({
        text: label,
        onPress: () => {
          updateItem(item.id, {
            label,
            guidance: {
              ...bundledAdvice(label, item.condition),
              source: 'fallback',
              ruleSetId: activeRuleSet.id,
              ruleSetLabel: activeRuleSet.label,
              ruleSetVersion: activeRuleSet.version,
              offline: true,
            },
          });
          refreshGuidance(item.id, label, item.condition);
        },
      }))
    );

  const addItem = () =>
    Alert.alert(
      'Add item not in photo',
      'Choose a label. This item has no detector box.',
      LABELS.filter(
        (label) =>
          evaluateEligibility(label, 'clean_dry', activeRuleSet).eligibility !== 'not_eligible'
      ).map((label) => ({
        text: label,
        onPress: () => {
          const id = `manual-${Date.now()}`;
          const guidance = {
            ...bundledAdvice(label, 'unknown'),
            source: 'fallback' as const,
            ruleSetId: activeRuleSet.id,
            ruleSetLabel: activeRuleSet.label,
            ruleSetVersion: activeRuleSet.version,
            offline: true,
          };
          setItems((current) => [
            ...current,
            {
              id,
              label,
              condition: 'unknown',
              removed: false,
              userAdded: true,
              confirmed: true,
              guidance,
            },
          ]);
          setSelectedId(id);
          void requestGuidance(label, 'unknown', activeRuleSet).then((nextGuidance) =>
            updateItem(id, { guidance: nextGuidance })
          );
        },
      }))
    );

  const confirmEverythingClean = () => {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        condition: 'clean_dry',
        guidance: {
          ...bundledAdvice(item.label, 'clean_dry'),
          source: 'fallback',
          ruleSetId: activeRuleSet.id,
          ruleSetLabel: activeRuleSet.label,
          ruleSetVersion: activeRuleSet.version,
          offline: true,
        },
      }))
    );
    items
      .filter((item) => !item.removed)
      .forEach((item) => refreshGuidance(item.id, item.label, 'clean_dry'));
  };

  const aggregate =
    Object.entries(
      (result?.detections ?? []).reduce<Record<string, number>>((counts, detection) => {
        counts[detection.label] = (counts[detection.label] ?? 0) + 1;
        return counts;
      }, {})
    )
      .map(([label, count]) => `${count} ${label}`)
      .join(', ') || 'No detected items';

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color="#19806d" size="large" />
        <Text className="text-sm font-medium text-muted-foreground mt-3">Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted && !photo) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center mb-4">
          <Camera size={30} color="#19806d" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center">
          Camera access needed
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 mb-6 max-w-xs leading-relaxed">
          Scanning runs directly on your device using on-device ML and does not require an active internet connection.
        </Text>
        <Button onPress={() => void requestPermission()} className="w-full bg-primary mb-3">
          <Text className="text-base font-semibold text-white">Allow camera access</Text>
        </Button>
        <Button variant="outline" onPress={() => void pick()} className="w-full">
          <Text className="text-sm font-semibold text-foreground">Choose from gallery</Text>
        </Button>
      </View>
    );
  }

  const imageWidth = Math.min(600, windowWidth - 32);
  const imageHeight = photo ? imageWidth * (photo.height / photo.width) : 480;
  const eligibleCount = items.filter(
    (item) => !item.removed && itemDecision(item, activeRuleSet).eligibility === 'eligible'
  ).length;

  return (
    <View style={{ flex: 1 }} className="flex-1 bg-background">
      {!photo ? (
        <View style={{ flex: 1, backgroundColor: '#020617', position: 'relative' }}>
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            onMountError={(event) => setError(event.message)}
          />

          {/* Top guidance overlay */}
          <View className="absolute top-12 left-4 right-4 rounded-2xl bg-slate-900/80 p-4 border border-white/10">
            <View className="flex-row items-center gap-2 mb-1">
              <Sparkles size={16} color="#ffffff" />
              <Text className="text-lg font-bold text-white">Scan your items</Text>
            </View>
            <Text className="text-xs text-slate-300">
              Keep the whole item visible in the frame for highest accuracy.
            </Text>
          </View>

          {error && (
            <View className="absolute top-32 left-4 right-4 rounded-xl bg-destructive/90 p-3.5 flex-row items-center gap-2">
              <AlertCircle size={16} color="#ffffff" />
              <Text className="text-xs text-white font-medium flex-1">{error}</Text>
            </View>
          )}

          {/* Bottom camera controls */}
          <View className="absolute bottom-10 left-6 right-6 flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a photo"
              onPress={() => void pick()}
              className="h-12 w-12 rounded-2xl bg-white/15 border border-white/20 items-center justify-center active:bg-white/25"
            >
              <ImageIcon size={22} color="#ffffff" />
            </Pressable>

            {/* Shutter Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              onPress={() => void capture()}
              className="h-20 w-20 rounded-full border-4 border-white items-center justify-center active:scale-95 transition-transform"
            >
              <View className="h-16 w-16 rounded-full bg-primary" />
            </Pressable>

            <View className="w-12" />
          </View>
        </View>
      ) : (
        <ScrollView ref={reviewScroll} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Photo Preview with Bounding Boxes */}
          <View
            style={{ width: imageWidth, height: imageHeight }}
            className="mx-4 mt-4 rounded-2xl overflow-hidden bg-slate-200 self-center relative shadow-sm border border-border"
          >
            <Image
              source={{ uri: photo.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
            />
            {items.map(
              (item) =>
                item.detection &&
                !item.removed && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label}, ${Math.round(
                      item.detection.score * 100
                    )} percent`}
                    key={item.id}
                    onPress={() => selectItem(item.id)}
                    style={[
                      styles.box,
                      {
                        left: item.detection.x1 * imageWidth,
                        top: item.detection.y1 * imageHeight,
                        width: Math.max(
                          2,
                          (item.detection.x2 - item.detection.x1) * imageWidth
                        ),
                        height: Math.max(
                          2,
                          (item.detection.y2 - item.detection.y1) * imageHeight
                        ),
                        borderColor: itemPresentation(item, activeRuleSet).color,
                        borderStyle:
                          item.detection.confidence === 'uncertain' && !item.confirmed
                            ? 'dashed'
                            : 'solid',
                        borderWidth: item.id === selectedId ? 3 : 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.boxLabel,
                        { backgroundColor: itemPresentation(item, activeRuleSet).color },
                      ]}
                    >
                      {itemPresentation(item, activeRuleSet).label} ·{' '}
                      {classificationText(itemPresentation(item, activeRuleSet).classification)}{' '}
                      · {Math.round(item.detection.score * 100)}%
                    </Text>
                  </Pressable>
                )
            )}
          </View>

          {/* Action Toolbar below image */}
          <View className="flex-row items-center justify-between px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setPhoto(undefined);
                setResult(undefined);
                setItems([]);
              }}
              className="gap-1.5"
            >
              <RotateCcw size={14} color="#183e48" />
              <Text className="text-xs font-semibold">Scan another</Text>
            </Button>

            <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <View className="h-2 w-2 rounded-full bg-primary" />
              <Text className="text-xs font-semibold text-primary">Offline scan</Text>
            </View>
          </View>

          {error && (
            <View className="mx-6 mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex-row items-center gap-2">
              <AlertCircle size={16} color="#b42318" />
              <Text className="text-xs font-medium text-destructive flex-1">{error}</Text>
            </View>
          )}

          {busy ? (
            <View className="flex-row items-center gap-2 px-6 py-2">
              <ActivityIndicator color="#19806d" size="small" />
              <Text className="text-xs text-muted-foreground">Scanning on device...</Text>
            </View>
          ) : (
            result && (
              <Text className="text-[11px] text-muted-foreground px-6 pb-2">
                Preprocess {result.timings.preprocessMs.toFixed(0)} ms · Inference{' '}
                {result.timings.inferenceMs.toFixed(0)} ms · Decode/NMS{' '}
                {result.timings.decodeNmsMs.toFixed(0)} ms
              </Text>
            )
          )}

          {/* Review Sheet Card Container */}
          <View
            onLayout={(event) => {
              sheetTop.current = event.nativeEvent.layout.y;
            }}
            className="bg-card rounded-t-3xl border-t border-border px-6 pt-5"
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xl font-extrabold text-foreground">Review items</Text>
              <Badge variant="secondary">
                <Text className="text-[11px] font-semibold">{eligibleCount} eligible</Text>
              </Badge>
            </View>

            <Text className="text-sm font-semibold text-foreground mt-1">{aggregate}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {result?.detections.length ?? 0} detected · Add a row below if an item was missed.
            </Text>

            {/* Regional rule set badge & location resolution */}
            <View className="mt-4 p-3.5 rounded-2xl bg-secondary/50 border border-border/80">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                  <MapPin size={15} color="#19806d" />
                  <Text className="text-xs font-bold text-foreground">
                    {activeRuleSet.label} · v{activeRuleSet.version}
                  </Text>
                </View>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => void resolveLocationGuidance()}
                  className="h-8 px-2.5 bg-card"
                >
                  <Text className="text-[11px] font-semibold text-primary">Use my location</Text>
                </Button>
              </View>
              {ruleSetMessage !== 'General Perak guidance' && (
                <Text className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                  {ruleSetMessage}
                </Text>
              )}
            </View>

            {/* Quick bulk action: Everything clean & dry */}
            <Pressable
              accessibilityRole="button"
              onPress={confirmEverythingClean}
              className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 flex-row items-center justify-between active:bg-primary/20"
            >
              <Text className="text-xs font-semibold text-primary">
                Everything looks clean and dry
              </Text>
              <Check size={16} color="#19806d" />
            </Pressable>

            {result?.detections.length === 0 && (
              <View className="py-6 items-center">
                <Text className="text-xs text-muted-foreground text-center">
                  No items were detected. You can add an eligible item manually below.
                </Text>
              </View>
            )}

            {/* Review Items List */}
            <View className="mt-4 space-y-3">
              {items.map((item) => {
                const decision = itemDecision(item, activeRuleSet);
                const presentation = itemPresentation(item, activeRuleSet);
                const isSelected = item.id === selectedId;

                const badgeVariant =
                  decision.eligibility === 'eligible'
                    ? 'success'
                    : decision.eligibility === 'needs_confirmation'
                    ? 'unsure'
                    : 'destructive';

                const statusText = item.removed
                  ? 'Removed'
                  : decision.eligibility === 'eligible'
                  ? 'Eligible for pickup'
                  : decision.eligibility === 'needs_confirmation'
                  ? 'Confirm label to check pickup'
                  : 'Not eligible for pickup';

                return (
                  <Card
                    key={item.id}
                    onLayout={(event) => {
                      rows.current[item.id] = sheetTop.current + event.nativeEvent.layout.y;
                    }}
                    className={`p-4 border transition-all mt-3 ${
                      isSelected ? 'border-primary ring-1 ring-primary/40 bg-primary/[0.02]' : 'border-border/80'
                    }`}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelectedId(item.id)}
                      className="flex-row items-start justify-between"
                    >
                      <View className="flex-row items-start gap-3 flex-1">
                        <View
                          style={{
                            backgroundColor: item.removed ? '#5b7072' : presentation.color,
                          }}
                          className="h-3.5 w-3.5 rounded-full mt-1"
                        />
                        <View className="flex-1">
                          <Text className="text-base font-bold text-foreground">
                            {item.label}
                            {item.userAdded ? ' · added' : ''}
                          </Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            {item.detection
                              ? `${Math.round(item.detection.score * 100)}% ${
                                  item.detection.confidence
                                }`
                              : 'No detector box'}
                          </Text>
                        </View>
                      </View>

                      <Badge variant={badgeVariant}>
                        <Text className="text-[11px] font-semibold">{statusText}</Text>
                      </Badge>
                    </Pressable>

                    {!item.removed && decision.eligibility !== 'eligible' && (
                      <Text className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {decision.reason}
                      </Text>
                    )}

                    {/* Condition Selector Chips */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row gap-2 mt-3"
                    >
                      {CONDITIONS.map((condition) => {
                        const isChecked = item.condition === condition.value;
                        return (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isChecked }}
                            key={condition.value}
                            onPress={() => updateCondition(item, condition.value)}
                            className={`px-3 py-1.5 rounded-full border mr-2 ${
                              isChecked
                                ? 'bg-primary border-primary'
                                : 'bg-secondary/60 border-border/80'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isChecked ? 'text-white' : 'text-foreground'
                              }`}
                            >
                              {condition.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {/* Guidance Card Block */}
                    <View className="mt-3.5 p-3 rounded-xl bg-secondary/50 border border-border/60">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Preparation
                        </Text>
                        <Badge
                          variant={item.guidance.offline ? 'warning' : 'success'}
                          className="px-2 py-0.5"
                        >
                          <Text className="text-[10px] font-bold">
                            {sourceBadge(item.guidance.source, item.guidance.offline)}
                          </Text>
                        </Badge>
                      </View>
                      <Text className="text-xs text-foreground leading-relaxed">
                        {item.guidance.preparation}
                      </Text>

                      <Text className="text-xs font-bold text-foreground uppercase tracking-wider mt-2.5 mb-0.5">
                        Acceptance / disposal
                      </Text>
                      <Text className="text-xs text-foreground leading-relaxed">
                        {item.guidance.disposal}
                      </Text>

                      {item.guidance.safety_warning && (
                        <View className="mt-2.5 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex-row items-center gap-1.5">
                          <AlertTriangle size={14} color="#b42318" />
                          <Text className="text-xs font-semibold text-destructive flex-1">
                            {item.guidance.safety_warning}
                          </Text>
                        </View>
                      )}

                      {item.guidance.confirmation_required && (
                        <Text className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                          Confirm with your local provider. Guidance only; not binding municipal advice.
                        </Text>
                      )}
                      <Text className="text-[10px] text-muted-foreground mt-1">
                        {item.guidance.ruleSetLabel} · v{item.guidance.ruleSetVersion}
                      </Text>
                    </View>

                    {/* Actions row */}
                    <View className="flex-row items-center flex-wrap gap-2 mt-3 pt-2 border-t border-border/40">
                      {item.detection?.confidence === 'uncertain' && !item.confirmed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => updateItem(item.id, { confirmed: true })}
                          className="h-8 px-2.5"
                        >
                          <Text className="text-xs font-semibold text-primary">Confirm label</Text>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => changeLabel(item)}
                        className="h-8 px-2.5"
                      >
                        <Text className="text-xs font-semibold text-foreground">Change label</Text>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => updateItem(item.id, { removed: !item.removed })}
                        className="h-8 px-2.5"
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            item.removed ? 'text-primary' : 'text-destructive'
                          }`}
                        >
                          {item.removed ? 'Restore' : 'Remove'}
                        </Text>
                      </Button>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Add missing item button */}
            <Button
              variant="outline"
              onPress={addItem}
              className="w-full mt-4 border-dashed border-primary/40 bg-primary/5 gap-2"
            >
              <Plus size={16} color="#19806d" />
              <Text className="text-xs font-bold text-primary">Add item not in photo</Text>
            </Button>

            {/* Safety Hazards Declaration Section */}
            <View className="mt-8 mb-2">
              <View className="flex-row items-center gap-2 mb-1">
                <ShieldAlert size={18} color="#805d13" />
                <Text className="text-base font-bold text-foreground">
                  Declare restricted or hazardous items
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                Mandatory safety check for community pickups
              </Text>
            </View>

            <View className="grid grid-cols-2 gap-2 mt-2">
              {(
                Object.entries(MANUAL_SAFETY_LABELS) as [ManualSafetyKey, string][]
              ).map(([key, label]) => {
                const isChecked = hazards[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setHazards((current) => ({ ...current, [key]: !current[key] }));
                      setSafetyConfirmed(false);
                    }}
                    className={`flex-row items-center p-3 rounded-xl border mb-2 ${
                      isChecked
                        ? 'bg-amber-50/80 border-amber-300'
                        : 'bg-card border-border/80'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        setHazards((current) => ({ ...current, [key]: !current[key] }));
                        setSafetyConfirmed(false);
                      }}
                      className="mr-3"
                    />
                    <Text className="text-xs font-medium text-foreground flex-1">{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Hazard Guidance Cards if declared */}
            {Object.entries(hazards)
              .filter(([, declared]) => declared)
              .map(([key]) => {
                const advice = bundledAdvice(
                  hazardGuidanceKey(key as ManualSafetyKey),
                  'unknown'
                );
                return (
                  <Card key={key} className="p-3.5 bg-amber-50/60 border-amber-200 mt-2">
                    <Text className="text-xs font-bold text-amber-900">
                      {MANUAL_SAFETY_LABELS[key as ManualSafetyKey]} · local guidance
                    </Text>
                    <Text className="text-xs text-amber-800 mt-1 leading-relaxed">
                      {advice.disposal}
                    </Text>
                    {advice.safety_warning && (
                      <Text className="text-xs font-semibold text-destructive mt-1.5">
                        {advice.safety_warning}
                      </Text>
                    )}
                  </Card>
                );
              })}

            {Object.values(hazards).some(Boolean) && (
              <Text className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {
                  (
                    bundledAdviceData.items as unknown as Record<
                      string,
                      { preparation: string }
                    >
                  )['hazard_confirmation'].preparation
                }
              </Text>
            )}

            {/* Mandatory final declaration checkbox */}
            <Pressable
              onPress={() => setSafetyConfirmed((val) => !val)}
              className="mt-5 p-3.5 rounded-xl border border-border bg-secondary/30 flex-row items-center gap-3"
            >
              <Checkbox
                checked={safetyConfirmed}
                onCheckedChange={() => setSafetyConfirmed((val) => !val)}
              />
              <Text className="text-xs font-medium text-foreground flex-1 leading-relaxed">
                I will leave declared restricted items out of pickup.
              </Text>
            </Pressable>

            {/* Request Pickup Button */}
            <Button
              disabled={eligibleCount === 0 || !safetyConfirmed}
              onPress={() => {
                const draft: PickupDraft = {
                  items: items.filter((item) => !item.removed).map((item) => ({
                    id: item.id,
                    className: item.label,
                    source: item.userAdded ? 'user_added' : 'detector',
                    condition: item.condition,
                    quantity: 1,
                  })),
                  restrictedItems: Object.entries(hazards)
                    .filter(([, selected]) => selected)
                    .map(([key]) => key as ManualSafetyKey),
                  restrictedItemsConfirmed: safetyConfirmed,
                  ruleSet: activeRuleSet,
                };
                void savePickupDraft(draft)
                  .then(() => router.push('/(tabs)/request'))
                  .catch(() => Alert.alert('Pickup request', 'The reviewed items could not be prepared. Please try again.'));
              }}
              className={`w-full mt-4 ${
                eligibleCount === 0 || !safetyConfirmed ? 'bg-muted opacity-50' : 'bg-primary'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  eligibleCount === 0 || !safetyConfirmed
                    ? 'text-muted-foreground'
                    : 'text-white'
                }`}
              >
                Request pickup
              </Text>
            </Button>

            <Text className="text-[11px] text-muted-foreground text-center mt-2.5">
              Detector labels never identify hazards. Safety declarations are manual.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function itemPresentation(item: ReviewItem, ruleSet: RuleSet) {
  return materialPresentation(
    item.label,
    item.detection?.confidence === 'uncertain',
    item.confirmed,
    ruleSet
  );
}

function itemDecision(item: ReviewItem, ruleSet: RuleSet) {
  return pickupDecision(
    item.label,
    item.condition,
    item.detection?.confidence === 'uncertain',
    item.confirmed,
    ruleSet
  );
}

function classificationText(
  classification: ReturnType<typeof itemPresentation>['classification']
): string {
  return classification === 'recyclable'
    ? 'Recyclable'
    : classification === 'not_recyclable'
    ? 'Not recyclable'
    : 'Unsure';
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  boxLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomRightRadius: 4,
  },
});
