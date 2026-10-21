import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useIsFocused } from 'expo-router';
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
  Trash2,
  Edit3,
  Battery,
  Lightbulb,
  Cpu,
  FlaskConical,
  Scissors,
  HelpCircle,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { scanPhoto, type ScanResult } from '@/lib/detector/scanner';
import {
  BUNDLED_RULE_SET,
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
} from '@/lib/guidance/presentation';
import { supabase } from '@/lib/supabase';
import modelManifest from '@/assets/models/model_manifest.json';
import { PickupRequestSection } from '@/components/pickup/PickupRequestSection';

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
  { value: 'clean_dry', label: 'Clean' },
  { value: 'contaminated_wet', label: 'Wet' },
  { value: 'broken_unsafe', label: 'Broken' },
  { value: 'unknown', label: 'Unsure' },
];

const HAZARD_ICONS: Record<ManualSafetyKey, React.ComponentType<{ size: number; color: string }>> = {
  batteries: Battery,
  bulbs: Lightbulb,
  e_waste: Cpu,
  chemicals: FlaskConical,
  sharp_objects: Scissors,
  other_hazards: HelpCircle,
};

const INITIAL_HAZARDS: Record<ManualSafetyKey, boolean> = {
  batteries: false,
  bulbs: false,
  e_waste: false,
  chemicals: false,
  sharp_objects: false,
  other_hazards: false,
};

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);

  const [photo, setPhoto] = useState<Photo | undefined>();
  const [result, setResult] = useState<ScanResult | undefined>();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRuleSet, setActiveRuleSet] = useState<RuleSet>(BUNDLED_ACTIVE_RULE_SET);
  const [ruleSetMessage, setRuleSetMessage] = useState<string>('General Perak guidance');
  const [hazards, setHazards] = useState<Record<ManualSafetyKey, boolean>>(INITIAL_HAZARDS);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  const reviewScroll = useRef<ScrollView | null>(null);
  const rows = useRef<Record<string, number>>({});
  const sheetTop = useRef(0);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    let unmounted = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RULE_SET_STORAGE_KEY);
        if (!unmounted && stored) {
          const parsed = parseRuleSet(JSON.parse(stored));
          if (parsed) {
            setActiveRuleSet(parsed);
            setRuleSetMessage(parsed.label);
          }
        }
      } catch {
        // Fall back to bundled
      }
    })();
    return () => {
      unmounted = true;
    };
  }, []);

  const selectItem = (id: string) => {
    setSelectedId(id);
    const targetY = rows.current[id];
    if (targetY !== undefined && reviewScroll.current) {
      reviewScroll.current.scrollTo({ y: Math.max(0, targetY - 120), animated: true });
    }
  };

  const updateItem = (id: string, patch: Partial<ReviewItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const refreshGuidance = useCallback(
    async (id: string, label: string, condition: Condition) => {
      try {
        const nextGuidance = await requestGuidance(label, condition, activeRuleSet);
        updateItem(id, { guidance: nextGuidance });
      } catch {
        // Fallback already assigned
      }
    },
    [activeRuleSet]
  );

  const processPhoto = useCallback(
    async (targetPhoto: Photo) => {
      setBusy(true);
      setError(null);
      try {
        const scan = await scanPhoto(targetPhoto.uri, targetPhoto.width, targetPhoto.height);
        setResult(scan);

        const initialItems: ReviewItem[] = scan.detections.map((detection, index) => {
          const fallback = bundledAdvice(detection.label, 'unknown');
          return {
            id: `det-${index}-${detection.label}`,
            detection,
            label: detection.label,
            condition: 'unknown',
            removed: false,
            userAdded: false,
            confirmed: detection.confidence === 'confident',
            guidance: {
              ...fallback,
              source: 'fallback',
              ruleSetId: activeRuleSet.id,
              ruleSetLabel: activeRuleSet.label,
              ruleSetVersion: activeRuleSet.version,
              offline: true,
            },
          };
        });

        setItems(initialItems);
        setSelectedId(initialItems[0]?.id);

        initialItems.forEach((item) => {
          void refreshGuidance(item.id, item.label, item.condition);
        });
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : 'Scan failed. Please retry.');
      } finally {
        setBusy(false);
      }
    },
    [activeRuleSet, refreshGuidance]
  );

  const capture = async () => {
    if (!camera.current || busy) return;
    try {
      const pic: CameraCapturedPicture | undefined = await camera.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!pic) return;
      const nextPhoto: Photo = { uri: pic.uri, width: pic.width, height: pic.height };
      setPhoto(nextPhoto);
      await processPhoto(nextPhoto);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Capture failed');
    }
  };

  const pick = async () => {
    if (busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const nextPhoto: Photo = {
      uri: asset.uri,
      width: asset.width ?? 640,
      height: asset.height ?? 640,
    };
    setPhoto(nextPhoto);
    await processPhoto(nextPhoto);
  };

  const resolveLocationGuidance = async () => {
    setRuleSetMessage('Checking local guidance…');
    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== 'granted') {
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
              thresholds: (row as { rules?: { thresholds?: unknown } }).rules?.thresholds,
              materials: (row as { rules?: { materials?: unknown } }).rules?.materials,
            })
          : null;
      const resolved = resolutionError
        ? null
        : resolveLocationRuleSet(resolvedCandidate, activeRuleSet);
      if (!resolvedCandidate || !resolved) {
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
        .forEach((item) => refreshGuidance(item.id, item.label, item.condition));
    } catch {
      Alert.alert('Location resolution', 'Could not fetch district guidance. Defaulting to current rules.');
    }
  };

  const draftItems = useMemo(
    () =>
      items
        .filter((item) => !item.removed)
        .map((item) => ({
          id: item.id,
          className: item.label,
          source: (item.userAdded ? 'user_added' : 'detector') as 'detector' | 'user_added',
          condition: item.condition,
          quantity: 1,
        })),
    [items]
  );

  const handlePickupSuccess = useCallback(() => {
    setPhoto(undefined);
    setResult(undefined);
    setItems([]);
    setSelectedId(undefined);
    setError(null);
    setSafetyConfirmed(false);
    setHazards(INITIAL_HAZARDS);
  }, []);

  const changeLabel = (item: ReviewItem) =>
    Alert.alert(
      'Change Material',
      'Select detected material:',
      LABELS.map((label) => ({
        text: label.toUpperCase(),
        onPress: () => {
          updateItem(item.id, { label, confirmed: true });
          void refreshGuidance(item.id, label, item.condition);
        },
      }))
    );

  const addItem = () =>
    Alert.alert(
      'Add Item',
      'Select material to add:',
      LABELS.map((label) => ({
        text: label.toUpperCase(),
        onPress: () => {
          const id = `manual-${Date.now()}`;
          const fallback = bundledAdvice(label, 'unknown');
          const guidance: GuidanceCard = {
            ...fallback,
            source: 'fallback',
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

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color="#19806d" size="large" />
      </View>
    );
  }

  if (!permission.granted && !photo) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="h-16 w-16 rounded-3xl bg-primary/10 items-center justify-center mb-4">
          <Camera size={30} color="#19806d" />
        </View>
        <Text className="text-2xl font-black text-foreground text-center">
          Camera access needed
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 mb-6 max-w-xs leading-relaxed">
          SnapPick uses your camera to identify recyclable materials locally on your device.
        </Text>
        <Button onPress={() => void requestPermission()} className="w-full h-12 rounded-2xl bg-primary mb-3">
          <Text className="text-base font-bold text-white">Enable Camera</Text>
        </Button>
        <Button variant="outline" onPress={() => void pick()} className="w-full h-12 rounded-2xl">
          <Text className="text-sm font-bold text-foreground">Choose from Gallery</Text>
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
          {isFocused && (
            <CameraView
              key={isFocused ? 'camera-focused' : 'camera-blurred'}
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              onMountError={(event) => setError(event.message)}
            />
          )}

          {/* Minimal Floating Viewfinder Pill */}
          <View className="absolute top-12 self-center px-4 py-2 rounded-full bg-black/60 border border-white/15 flex-row items-center gap-2 shadow-sm">
            <Sparkles size={14} color="#19806d" />
            <Text className="text-xs font-bold text-white">Center item in frame</Text>
          </View>

          {error && (
            <View className="absolute top-24 left-6 right-6 rounded-2xl bg-destructive/90 p-3.5 flex-row items-center gap-2">
              <AlertCircle size={16} color="#ffffff" />
              <Text className="text-xs text-white font-medium flex-1">{error}</Text>
            </View>
          )}

          {/* Bottom Floating Controls */}
          <View className="absolute bottom-10 left-0 right-0 px-8 flex-row items-center justify-between">
            <View className="flex-1 items-start">
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
                onPress={() => void pick()}
                className="h-12 w-12 rounded-2xl bg-white/20 border border-white/30 items-center justify-center shadow-lg"
              >
                <ImageIcon size={22} color="#ffffff" />
              </AnimatedPressable>
            </View>

            {/* Shutter Button with tactile spring */}
            <View className="items-center justify-center">
              <AnimatedPressable
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                onPress={() => void capture()}
                className="h-20 w-20 rounded-full border-4 border-white items-center justify-center shadow-xl"
              >
                <View className="h-16 w-16 rounded-full bg-primary" />
              </AnimatedPressable>
            </View>

            <View className="flex-1 items-end" />
          </View>
        </View>
      ) : (
        <ScrollView ref={reviewScroll} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Photo Preview with Bounding Boxes */}
          <View
            style={{ width: imageWidth, height: imageHeight }}
            className="mx-4 mt-4 rounded-3xl overflow-hidden bg-slate-900 self-center relative shadow-sm border border-border"
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
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.boxLabel,
                        { backgroundColor: itemPresentation(item, activeRuleSet).color },
                      ]}
                    >
                      <Text className="text-[10px] font-black text-white uppercase tracking-wider">
                        {itemPresentation(item, activeRuleSet).label} · {Math.round(item.detection.score * 100)}%
                      </Text>
                    </View>
                  </Pressable>
                )
            )}
          </View>

          {/* Action Toolbar below image */}
          <View className="flex-row items-center justify-between px-6 py-3">
            <AnimatedPressable
              onPress={() => {
                setPhoto(undefined);
                setResult(undefined);
                setItems([]);
              }}
            >
              <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/80">
                <RotateCcw size={13} color="#183e48" />
                <Text className="text-xs font-bold text-foreground">Retake</Text>
              </View>
            </AnimatedPressable>

            {busy && (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#19806d" size="small" />
                <Text className="text-xs font-medium text-muted-foreground">Analyzing...</Text>
              </View>
            )}
          </View>

          {error && (
            <View className="mx-6 mb-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 flex-row items-center gap-2">
              <AlertCircle size={16} color="#b42318" />
              <Text className="text-xs font-medium text-destructive flex-1">{error}</Text>
            </View>
          )}

          {/* Review Sheet Container */}
          <View
            onLayout={(event) => {
              sheetTop.current = event.nativeEvent.layout.y;
            }}
            className="bg-card rounded-t-3xl border-t border-border px-6 pt-5"
          >
            {/* Header with status pill */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-black text-foreground">Detected Items</Text>
              <Badge variant="secondary" className="px-3 py-1 rounded-full">
                <Text className="text-xs font-bold">{eligibleCount} eligible</Text>
              </Badge>
            </View>

            {/* Regional district pill */}
            <View className="flex-row items-center justify-between p-3 rounded-2xl bg-secondary/40 border border-border/70 mb-3">
              <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                <MapPin size={14} color="#19806d" />
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {activeRuleSet.label}
                </Text>
              </View>
              <AnimatedPressable onPress={() => void resolveLocationGuidance()}>
                <Text className="text-xs font-bold text-primary">Use GPS</Text>
              </AnimatedPressable>
            </View>

            {/* Bulk Clean Action */}
            <AnimatedPressable
              accessibilityRole="button"
              onPress={confirmEverythingClean}
              className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex-row items-center justify-between"
            >
              <Text className="text-xs font-bold text-primary">Mark all clean & dry</Text>
              <Check size={16} color="#19806d" />
            </AnimatedPressable>

            {/* Empty state */}
            {result?.detections.length === 0 && (
              <View className="py-6 items-center">
                <Text className="text-xs font-medium text-muted-foreground text-center">
                  No items detected. Add one below if visible.
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

                const statusLabel = item.removed
                  ? 'Removed'
                  : decision.eligibility === 'eligible'
                  ? 'Eligible'
                  : decision.eligibility === 'needs_confirmation'
                  ? 'Confirm'
                  : 'Excluded';

                return (
                  <Card
                    key={item.id}
                    onLayout={(event) => {
                      rows.current[item.id] = sheetTop.current + event.nativeEvent.layout.y;
                    }}
                    className={`p-4 rounded-2xl border transition-all mt-3 ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary/40 bg-primary/[0.02]'
                        : 'border-border/80 bg-card'
                    }`}
                  >
                    {/* Item Title Row */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelectedId(item.id)}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2.5 flex-1">
                        <View
                          style={{
                            backgroundColor: item.removed ? '#5b7072' : presentation.color,
                          }}
                          className="h-3.5 w-3.5 rounded-full"
                        />
                        <Text className="text-base font-bold text-foreground capitalize">
                          {presentation.label}
                        </Text>
                        <Badge variant={badgeVariant} className="px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] font-bold">{statusLabel}</Text>
                        </Badge>
                      </View>

                      {/* Item Quick Actions */}
                      <View className="flex-row items-center gap-1">
                        <AnimatedPressable onPress={() => changeLabel(item)} className="p-1.5">
                          <Edit3 size={15} color="#5b7072" />
                        </AnimatedPressable>
                        <AnimatedPressable
                          onPress={() => updateItem(item.id, { removed: !item.removed })}
                          className="p-1.5"
                        >
                          <Trash2
                            size={15}
                            color={item.removed ? '#19806d' : '#b42318'}
                          />
                        </AnimatedPressable>
                      </View>
                    </Pressable>

                    {/* Condition Selector Chips */}
                    <View className="flex-row gap-1.5 mt-3">
                      {CONDITIONS.map((cond) => {
                        const active = item.condition === cond.value;
                        return (
                          <AnimatedPressable
                            key={cond.value}
                            onPress={() => {
                              updateItem(item.id, { condition: cond.value });
                              void refreshGuidance(item.id, item.label, cond.value);
                            }}
                            className={`flex-1 py-1.5 rounded-xl border items-center justify-center ${
                              active
                                ? 'bg-primary border-primary'
                                : 'bg-secondary/40 border-border/70'
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-bold ${
                                active ? 'text-white' : 'text-foreground'
                              }`}
                            >
                              {cond.label}
                            </Text>
                          </AnimatedPressable>
                        );
                      })}
                    </View>

                    {/* Compact Preparation Snippet */}
                    <View className="mt-3 p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                      <Text className="text-xs text-foreground leading-relaxed">
                        {item.guidance.preparation}
                      </Text>
                      {item.guidance.safety_warning && (
                        <View className="mt-1.5 flex-row items-center gap-1.5">
                          <AlertTriangle size={13} color="#b42318" />
                          <Text className="text-[11px] font-semibold text-destructive flex-1">
                            {item.guidance.safety_warning}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Add missing item button */}
            <AnimatedPressable onPress={addItem} className="mt-4">
              <View className="w-full py-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 flex-row items-center justify-center gap-2">
                <Plus size={16} color="#19806d" />
                <Text className="text-xs font-bold text-primary">Add item not in photo</Text>
              </View>
            </AnimatedPressable>

            {/* Safety Hazards Quick Grid */}
            <View className="mt-8 mb-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Safety Declaration (Exclude if present)
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {(
                Object.entries(MANUAL_SAFETY_LABELS) as [ManualSafetyKey, string][]
              ).map(([key, label]) => {
                const isChecked = hazards[key];
                const IconComponent = HAZARD_ICONS[key] || AlertTriangle;
                return (
                  <AnimatedPressable
                    key={key}
                    onPress={() => {
                      setHazards((current) => ({ ...current, [key]: !current[key] }));
                      setSafetyConfirmed(false);
                    }}
                    className={`flex-row items-center px-3 py-2 rounded-xl border ${
                      isChecked
                        ? 'bg-destructive/10 border-destructive/40'
                        : 'bg-card border-border/70'
                    }`}
                  >
                    <IconComponent
                      size={14}
                      color={isChecked ? '#b42318' : '#5b7072'}
                    />
                    <Text
                      className={`text-xs font-bold ml-1.5 ${
                        isChecked ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Hazard alert cards if any active */}
            {Object.entries(hazards)
              .filter(([, declared]) => declared)
              .map(([key]) => {
                const advice = bundledAdvice(
                  hazardGuidanceKey(key as ManualSafetyKey),
                  'unknown'
                );
                return (
                  <Card key={key} className="p-3 bg-amber-500/10 border-amber-500/30 rounded-2xl mt-2.5">
                    <Text className="text-xs font-bold text-amber-900">
                      {MANUAL_SAFETY_LABELS[key as ManualSafetyKey]}: Exclude from pickup
                    </Text>
                    <Text className="text-[11px] text-amber-800 mt-0.5 leading-tight">
                      {advice.disposal}
                    </Text>
                  </Card>
                );
              })}

            {/* Mandatory confirmation checkbox */}
            <Pressable
              onPress={() => setSafetyConfirmed((val) => !val)}
              className="mt-4 p-3 rounded-2xl border border-border/80 bg-secondary/30 flex-row items-center gap-3"
            >
              <Checkbox
                checked={safetyConfirmed}
                onCheckedChange={() => setSafetyConfirmed((val) => !val)}
              />
              <Text className="text-xs font-semibold text-foreground flex-1">
                I will keep declared restricted items out of pickup.
              </Text>
            </Pressable>

            {/* Unified Pickup Location & Address Form */}
            <PickupRequestSection
              items={draftItems}
              safetyConfirmed={safetyConfirmed}
              activeRuleSet={activeRuleSet}
              onSuccess={handlePickupSuccess}
            />
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

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  boxLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomRightRadius: 6,
    borderTopLeftRadius: 6,
  },
});
