import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import {
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Check,
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
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  BookOpen,
  ChevronDown,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { scanPhoto, type ScanResult } from '@/lib/detector/scanner';
import {
  BUNDLED_RULE_SET,
  type RuleSet,
} from '@/lib/detector/rules';
import { materialPresentation, pickupDecision } from '@/lib/detector/presentation';
import type { Condition, Detection } from '@/lib/detector/types';
import { parseRuleSet, requestGuidance, type GuidanceCard } from '@/lib/guidance/service';
import {
  bundledAdvice,
} from '@/lib/guidance/presentation';
import modelManifest from '@/assets/models/model_manifest.json';
import { PickupRequestSection } from '@/components/pickup/PickupRequestSection';
import { SasGuideSection } from '@/components/guidance/SasGuideSection';

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
  const [safetyConfirmed, setSafetyConfirmed] = useState(true);
  const [step, setStep] = useState<'review' | 'schedule'>('review');
  const [expandedGuideIds, setExpandedGuideIds] = useState<Record<string, boolean>>({});

  const toggleGuide = useCallback((id: string) => {
    setExpandedGuideIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const reviewScroll = useRef<ScrollView | null>(null);
  const rows = useRef<Record<string, number>>({});
  const sheetTop = useRef(0);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let unmounted = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RULE_SET_STORAGE_KEY);
        if (!unmounted && stored) {
          const parsed = parseRuleSet(JSON.parse(stored));
          if (parsed && parsed.classes.plastic?.conditionRules.clean_dry.eligibility === 'eligible' && parsed.label === 'Community Recycling Guideline') {
            setActiveRuleSet(parsed);
          } else {
            await AsyncStorage.setItem(RULE_SET_STORAGE_KEY, JSON.stringify(BUNDLED_ACTIVE_RULE_SET));
            setActiveRuleSet(BUNDLED_ACTIVE_RULE_SET);
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
        if (initialItems[0]?.id) {
          setExpandedGuideIds({ [initialItems[0].id]: true });
        }

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
    setSafetyConfirmed(true);
    setStep('review');
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
          setExpandedGuideIds((prev) => ({ ...prev, [id]: true }));
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
        confirmed: true,
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
        <View style={{ flex: 1 }}>
          {/* STEP 1: REVIEW ITEMS */}
          <View style={{ flex: 1, display: step === 'review' ? 'flex' : 'none' }}>
            <ScrollView ref={reviewScroll} contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}>
              {/* Photo Preview with Bounding Boxes */}
              <View
                style={{ width: imageWidth, height: imageHeight }}
                className="mx-4 mt-4 rounded-3xl overflow-hidden bg-slate-900 self-center relative shadow-sm border border-border"
              >
                <ExpoImage
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="fill"
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
            className="px-6 pt-3 pb-12 flex-1"
          >
            {/* Header with status pill */}
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-xl font-black text-foreground">Detected Items</Text>
                <Text className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {activeRuleSet.label}
                </Text>
              </View>
              <Badge variant="secondary" className="px-3 py-1 rounded-full">
                <Text className="text-xs font-bold">{eligibleCount} eligible</Text>
              </Badge>
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
                              updateItem(item.id, { condition: cond.value, confirmed: true });
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

                    {/* Collapsible Malaysian SAS Guide Toggle */}
                    {(() => {
                      const isGuideExpanded =
                        expandedGuideIds[item.id] ?? (items.length === 1);

                      return (
                        <>
                          <AnimatedPressable
                            onPress={() => toggleGuide(item.id)}
                            className="mt-3 py-2 px-3.5 rounded-xl bg-muted/40 border border-border/60 flex-row items-center justify-between"
                          >
                            <View className="flex-row items-center gap-2">
                              <BookOpen size={14} color="#16a34a" />
                              <Text className="text-xs font-bold text-foreground">
                                {isGuideExpanded ? 'Hide Preparation Guide' : 'View Preparation Guide'}
                              </Text>
                            </View>
                            <ChevronDown
                              size={15}
                              color="#5b7072"
                              style={{ transform: [{ rotate: isGuideExpanded ? '180deg' : '0deg' }] }}
                            />
                          </AnimatedPressable>

                          {isGuideExpanded && (
                            <View className="mt-2.5">
                              <SasGuideSection itemClass={item.label} />
                            </View>
                          )}
                        </>
                      );
                    })()}
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

            {/* Safety Checklist Card */}
            <Card className="mt-6 p-4 rounded-2xl border-border/80 bg-card shadow-sm">
              <View className="flex-row items-center gap-2 mb-2">
                <ShieldCheck size={18} color="#19806d" />
                <Text className="text-sm font-bold text-foreground">Safety Checklist</Text>
              </View>

              <Text className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Ensure restricted items are separated and NOT placed with recyclables:
              </Text>

              {/* Exclusion Checklist Reminder Pills */}
              <View className="flex-row flex-wrap gap-1.5 mb-3.5">
                <View className="px-2.5 py-1 rounded-xl bg-secondary/50 border border-border/60 flex-row items-center gap-1.5">
                  <Battery size={13} color="#5b7072" />
                  <Text className="text-[11px] font-semibold text-foreground">Batteries</Text>
                </View>
                <View className="px-2.5 py-1 rounded-xl bg-secondary/50 border border-border/60 flex-row items-center gap-1.5">
                  <Lightbulb size={13} color="#5b7072" />
                  <Text className="text-[11px] font-semibold text-foreground">Bulbs</Text>
                </View>
                <View className="px-2.5 py-1 rounded-xl bg-secondary/50 border border-border/60 flex-row items-center gap-1.5">
                  <Cpu size={13} color="#5b7072" />
                  <Text className="text-[11px] font-semibold text-foreground">E-Waste</Text>
                </View>
                <View className="px-2.5 py-1 rounded-xl bg-secondary/50 border border-border/60 flex-row items-center gap-1.5">
                  <FlaskConical size={13} color="#5b7072" />
                  <Text className="text-[11px] font-semibold text-foreground">Chemicals</Text>
                </View>
                <View className="px-2.5 py-1 rounded-xl bg-secondary/50 border border-border/60 flex-row items-center gap-1.5">
                  <Scissors size={13} color="#5b7072" />
                  <Text className="text-[11px] font-semibold text-foreground">Sharps</Text>
                </View>
              </View>

              {/* 1-tap confirmation toggle */}
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => setSafetyConfirmed((prev) => !prev)}
                className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                  safetyConfirmed
                    ? 'bg-primary/10 border-primary'
                    : 'bg-secondary/30 border-border/70'
                }`}
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View
                    className={`h-5 w-5 rounded-full items-center justify-center ${
                      safetyConfirmed ? 'bg-primary' : 'border-2 border-border'
                    }`}
                  >
                    {safetyConfirmed && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <Text className="text-xs font-bold text-foreground flex-1">
                    I confirm no hazardous or restricted items are included
                  </Text>
                </View>
              </AnimatedPressable>
            </Card>

            {/* Continue to Step 2 Button */}
            <View className="mt-8 pt-2">
              <Button
                disabled={eligibleCount === 0 || !safetyConfirmed}
                onPress={() => setStep('schedule')}
                className={`w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center shadow-sm ${
                  eligibleCount === 0 || !safetyConfirmed ? 'opacity-60' : ''
                }`}
              >
                <Text className="text-base font-bold text-white mr-2">Continue to Schedule Pickup</Text>
                <ArrowRight size={18} color="#ffffff" />
              </Button>

              {(eligibleCount === 0 || !safetyConfirmed) && (
                <Text className="mt-2.5 text-center text-xs text-muted-foreground font-medium">
                  {eligibleCount === 0
                    ? 'Confirm at least one item as clean & eligible to continue'
                    : 'Please confirm clean recyclables above to continue'}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* STEP 2: SCHEDULE PICKUP */}
      <View style={{ flex: 1, display: step === 'schedule' ? 'flex' : 'none' }} className="flex-1 bg-background">
        {/* Sticky top navigation bar */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) }}
          className="px-6 pb-3 pt-2 flex-row items-center justify-between bg-background border-b border-border/40"
        >
          <View className="flex-row items-center gap-3">
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Back to detected items"
              onPress={() => setStep('review')}
              className="h-10 w-10 rounded-2xl bg-secondary/80 border border-border items-center justify-center"
            >
              <ArrowLeft size={18} color="#183e48" />
            </AnimatedPressable>
            <Text className="text-xl font-black text-foreground">Schedule Pickup</Text>
          </View>

          <Badge variant="secondary" className="px-3 py-1 rounded-full">
            <Text className="text-xs font-bold">{eligibleCount} eligible</Text>
          </Badge>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} className="flex-1 bg-background">

          {/* Items Summary Card */}
          <View className="mx-6 mt-4 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex-row items-center gap-3">
            <View className="h-8 w-8 rounded-xl bg-primary/20 items-center justify-center">
              <Sparkles size={16} color="#19806d" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-primary">Items Ready for Collection</Text>
              <Text className="text-xs font-semibold text-foreground mt-0.5" numberOfLines={2}>
                {draftItems
                  .filter((i) => i.condition === 'clean_dry')
                  .map((i) => i.className.toUpperCase())
                  .join(' · ') || 'Clean recyclables'}
              </Text>
            </View>
          </View>

          {/* Unified Pickup Location & Address Form */}
          <PickupRequestSection
            items={draftItems}
            safetyConfirmed={safetyConfirmed}
            activeRuleSet={activeRuleSet}
            onSuccess={handlePickupSuccess}
          />
        </ScrollView>
      </View>
    </View>
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
