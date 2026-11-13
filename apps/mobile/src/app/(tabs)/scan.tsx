import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  AlertTriangle,
  Plus,
  Sparkles,
  Zap,
  ZapOff,
  Trash2,
  Edit3,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  X,
  Milk,
  Package,
  FileText,
  Wine,
  Cylinder,
  Leaf,
  Undo2,
  Recycle,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { scanPhoto, type ScanResult } from '@/lib/detector/scanner';
import {
  BUNDLED_RULE_SET,
  parseRuleSet,
  type RuleSet,
} from '@/lib/detector/rules';
import { materialPresentation, pickupDecision } from '@/lib/detector/presentation';
import type { Condition, Detection } from '@/lib/detector/types';
import modelManifest from '@/assets/models/model_manifest.json';
import { getActiveModelVersion } from '@/lib/detector/manager';
import { PickupRequestSection } from '@/components/pickup/PickupRequestSection';
import { RecyclingAnimation } from '@/components/guidance/RecyclingAnimation';
import { getRecyclingGuide } from '@/lib/guidance/recyclingGuides';
import { useAuth } from '@/providers/AuthProvider';
import {
  persistScanSession,
  type PersistScanParams,
  type DetectionRecord,
  type UserCorrection,
} from '@/lib/detector/persistence';
import { queuePendingScanSession } from '@/lib/detector/pending-sessions';
import { enqueueScanUpload, flushOfflineUploadQueue } from '@/lib/detector/upload-queue';
import Animated from 'react-native-reanimated';
import { appear } from '@/lib/motion';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Photo = { uri: string; width: number; height: number };
type ReviewItem = {
  id: string;
  detection?: Detection;
  label: string;
  condition: Condition;
  removed: boolean;
  userAdded: boolean;
  confirmed: boolean;
};
const RULE_SET_STORAGE_KEY = 'snappick:last-confirmed-rule-set';
const BUNDLED_ACTIVE_RULE_SET = BUNDLED_RULE_SET as RuleSet;

const LABELS = modelManifest.labels;

function getMaterialIcon(label: string) {
  switch (label.toLowerCase()) {
    case 'plastic':
      return Milk;
    case 'cardboard':
      return Package;
    case 'paper':
      return FileText;
    case 'glass':
      return Wine;
    case 'metal':
      return Cylinder;
    case 'trash':
      return Trash2;
    case 'biological':
      return Leaf;
    default:
      return Sparkles;
  }
}



export default function ScanScreen() {
  const isFocused = useIsFocused();
  const { session, profile } = useAuth();
  const scanIdRef = useRef<string | null>(null);
  const persistedRef = useRef<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);

  const [photo, setPhoto] = useState<Photo | undefined>();
  const [result, setResult] = useState<ScanResult | undefined>();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRuleSet, setActiveRuleSet] = useState<RuleSet>(BUNDLED_ACTIVE_RULE_SET);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [torch, setTorch] = useState(false);
  const [step, setStep] = useState<'review' | 'guidance' | 'schedule'>('review');
  const [currentGuideIndex, setCurrentGuideIndex] = useState(0);
  const [maxViewedGuideIndex, setMaxViewedGuideIndex] = useState(0);
  const guidanceScrollRef = useRef<ScrollView | null>(null);
  const [materialModal, setMaterialModal] = useState<{
    visible: boolean;
    mode: 'add' | 'change';
    targetItemId?: string;
  }>({ visible: false, mode: 'add' });

  useEffect(() => {
    if (isFocused) {
      void flushOfflineUploadQueue();
    }
  }, [isFocused]);

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
          if (parsed && parsed.classes.plastic?.conditionRules.clean_dry.eligibility === 'eligible') {
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

  const processPhoto = useCallback(
    async (targetPhoto: Photo) => {
      setBusy(true);
      setError(null);
      const nextScanId = generateUUID();
      scanIdRef.current = nextScanId;
      persistedRef.current = false;
      try {
        const scan = await scanPhoto(targetPhoto.uri, targetPhoto.width, targetPhoto.height);
        setResult(scan);

        const initialItems: ReviewItem[] = scan.detections.map((detection, index) => {
          return {
            id: `det-${index}-${detection.label}`,
            detection,
            label: detection.label,
            condition: 'clean_dry',
            removed: false,
            userAdded: false,
            confirmed: detection.confidence === 'confident',
          };
        });

        setItems(initialItems);
        setSelectedId(initialItems[0]?.id);
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : 'Scan failed. Please retry.');
      } finally {
        setBusy(false);
      }
    },
    []
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

  const persistCurrentScan = useCallback(
    async (
      currentItems: ReviewItem[],
      targetPhoto?: Photo,
      targetResult?: ScanResult
    ) => {
      const activeScanId = scanIdRef.current;
      const activeUser = session?.user;
      if (!activeScanId || !activeUser || !targetPhoto || !targetResult) return;
      if (persistedRef.current) return;
      persistedRef.current = true;

      const detections: DetectionRecord[] = currentItems.map((item) => {
        if (item.detection) {
          return {
            model_label: item.detection.label,
            app_class: item.label,
            score: item.detection.score,
            box_x1: item.detection.x1,
            box_y1: item.detection.y1,
            box_x2: item.detection.x2,
            box_y2: item.detection.y2,
            source: 'detector',
            condition: item.condition,
            eligibility: itemDecision(item, activeRuleSet).eligibility,
            quantity: 1,
          };
        }
        return {
          model_label: item.label,
          app_class: item.label,
          score: 1.0,
          box_x1: null,
          box_y1: null,
          box_x2: null,
          box_y2: null,
          source: 'user_added',
          condition: item.condition,
          eligibility: itemDecision(item, activeRuleSet).eligibility,
          quantity: 1,
        };
      });

      const corrections: UserCorrection[] = [];
      currentItems.forEach((item) => {
        if (item.detection) {
          if (item.removed) {
            corrections.push({
              originalModelLabel: item.detection.label,
              feedbackType: 'remove',
            });
          } else if (item.label !== item.detection.label) {
            corrections.push({
              originalModelLabel: item.detection.label,
              correctedAppClass: item.label,
              feedbackType: 'change_label',
            });
          } else if (item.detection.confidence === 'uncertain' && item.confirmed) {
            corrections.push({
              originalModelLabel: item.detection.label,
              feedbackType: 'confirm',
            });
          }
          // Only a condition the person actually changed is feedback (every item starts as clean and dry).
          if (!item.removed && item.condition !== 'clean_dry') {
            corrections.push({
              originalModelLabel: item.detection.label,
              originalCondition: 'clean_dry',
              correctedCondition: item.condition,
              feedbackType: 'condition_change',
            });
          }
        }
      });

      const sessionParams: PersistScanParams = {
          scanId: activeScanId,
          userId: activeUser.id,
          modelVersion: (await getActiveModelVersion()) || modelManifest.version,
          ruleSetId: activeRuleSet.id,
          ruleSetVersion: activeRuleSet.version,
          imageStorageConsent: profile?.image_storage_consent ?? false,
          trainingOptIn: profile?.training_opt_in ?? false,
          imageWidth: targetPhoto.width,
          imageHeight: targetPhoto.height,
          preprocessMs: Math.round(targetResult.timings.preprocessMs),
          inferenceMs: Math.round(targetResult.timings.inferenceMs),
          detections,
          corrections,
      };

      try {
        const res = await persistScanSession(sessionParams);

        if (res.gating.shouldUpload) {
          await enqueueScanUpload({
            scanId: activeScanId,
            userId: activeUser.id,
            imageUri: targetPhoto.uri,
            imageWidth: targetPhoto.width,
            imageHeight: targetPhoto.height,
          });
          void flushOfflineUploadQueue();
        }
      } catch (persistError) {
        console.warn('Scan persistence error:', persistError);
        // Offline or a temporary failure: keep the scan and save it when the app is back online.
        await queuePendingScanSession(
          sessionParams,
          targetPhoto.uri,
          persistError instanceof Error ? persistError.message : String(persistError)
        );
      }
    },
    [session, profile, activeRuleSet]
  );

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

  const uniqueGuideClasses = useMemo(() => {
    const active = items.filter((item) => !item.removed);
    const classes = Array.from(new Set(active.map((item) => item.label)));
    return classes.length > 0 ? classes : ['plastic'];
  }, [items]);

  const resetScan = useCallback(() => {
    setPhoto(undefined);
    setResult(undefined);
    setItems([]);
    setSelectedId(undefined);
    setError(null);
    setSafetyConfirmed(false);
    setCurrentGuideIndex(0);
    setMaxViewedGuideIndex(0);
    setStep('review');
    scanIdRef.current = null;
    persistedRef.current = false;
  }, []);

  const handlePickupSuccess = useCallback(() => {
    resetScan();
  }, [resetScan]);

  const changeLabel = (item: ReviewItem) => {
    setMaterialModal({ visible: true, mode: 'change', targetItemId: item.id });
  };

  const addItem = () => {
    setMaterialModal({ visible: true, mode: 'add' });
  };

  const handleSelectMaterial = (label: string) => {
    if (materialModal.mode === 'add') {
      const id = `manual-${generateUUID()}`;
      setItems((current) => [
        ...current,
        {
          id,
          label,
          condition: 'clean_dry',
          removed: false,
          userAdded: true,
          confirmed: true,
        },
      ]);
      setSelectedId(id);
    } else if (materialModal.mode === 'change' && materialModal.targetItemId) {
      updateItem(materialModal.targetItemId, { label, confirmed: true });
    }
    setMaterialModal({ visible: false, mode: 'add' });
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
          Camera Access Needed
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 mb-6 max-w-xs leading-relaxed">
          SnapPick needs the camera to check your waste. The check happens on your phone.
        </Text>
        <Button onPress={() => void requestPermission()} className="w-full h-12 rounded-2xl bg-primary mb-3">
          <Text className="text-base font-bold text-white">Enable Camera</Text>
        </Button>
        <Button variant="outline" onPress={() => void pick()} className="w-full h-12 rounded-2xl">
          <Text className="text-base font-bold text-foreground">Open Gallery</Text>
        </Button>
      </View>
    );
  }

  const imageWidth = Math.min(600, windowWidth - 32);
  const imageHeight = photo ? imageWidth * (photo.height / photo.width) : 480;
  const activeItems = items.filter((item) => !item.removed);
  const eligibleCount = activeItems.filter(
    (item) => itemDecision(item, activeRuleSet).eligibility === 'eligible'
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
              enableTorch={torch}
              onMountError={(event) => setError(event.message)}
            />
          )}

          {/* Minimal Floating Viewfinder Pill */}
          <View
            style={{ top: Math.max(insets.top + 8, 36) }}
            className="absolute self-center px-4 py-2 rounded-full bg-black/60 border border-white/15 flex-row items-center gap-2 shadow-sm"
          >
            <Sparkles size={14} color="#19806d" />
            <Text className="text-xs font-bold text-white">Center Item in Frame</Text>
          </View>

          {error && (
            <View
              style={{ top: Math.max(insets.top + 54, 84) }}
              className="absolute left-6 right-6 rounded-2xl bg-destructive/90 p-3.5 flex-row items-center gap-2"
            >
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

            {/* Shutter Button with tactile spring and busy indicator */}
            <View className="items-center justify-center">
              <AnimatedPressable
                scaleTo={0.92}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                onPress={() => void capture()}
                className="h-20 w-20 rounded-full border-4 border-white items-center justify-center shadow-xl"
              >
                <View className="h-16 w-16 rounded-full bg-primary items-center justify-center">
                  {busy ? <ActivityIndicator color="#ffffff" size="small" /> : null}
                </View>
              </AnimatedPressable>
            </View>

            <View className="flex-1 items-end">
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={torch ? 'Turn off flash' : 'Turn on flash'}
                onPress={() => setTorch((prev) => !prev)}
                className={`h-12 w-12 rounded-2xl items-center justify-center shadow-lg border ${
                  torch
                    ? 'bg-primary border-white/40'
                    : 'bg-white/20 border border-white/30'
                }`}
              >
                {torch ? (
                  <Zap size={22} color="#ffffff" fill="#ffffff" />
                ) : (
                  <ZapOff size={22} color="#ffffff" />
                )}
              </AnimatedPressable>
            </View>
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
            {items.map((item) => {
              if (!item.detection || item.removed) return null;
              const boxX1 = item.detection.x1 * imageWidth;
              const boxY1 = item.detection.y1 * imageHeight;
              const boxWidth = Math.max(2, (item.detection.x2 - item.detection.x1) * imageWidth);
              const boxHeight = Math.max(2, (item.detection.y2 - item.detection.y1) * imageHeight);
              const presentation = itemPresentation(item, activeRuleSet);
              const isSelected = item.id === selectedId;
              const scorePercent = Math.round(item.detection.score * 100);
              const isTagOutside = boxY1 >= 24;
              const MaterialIcon = getMaterialIcon(item.label);
              const strokeColor = item.removed ? '#94a3b8' : presentation.color;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => selectItem(item.id)}
                  style={[
                    styles.box,
                    {
                      left: boxX1,
                      top: boxY1,
                      width: boxWidth,
                      height: boxHeight,
                      borderColor: strokeColor,
                      borderStyle: 'solid',
                      borderWidth: isSelected ? 2.5 : 2,
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
                      borderBottomLeftRadius: 8,
                    },
                  ]}
                >
                  {/* Seamlessly attached tag */}
                  <View
                    style={{
                      position: 'absolute',
                      top: isTagOutside ? (isSelected ? -24.5 : -24) : 0,
                      left: isSelected ? -2.5 : -2,
                      height: 22,
                      backgroundColor: strokeColor,
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      borderBottomRightRadius: 0,
                      borderBottomLeftRadius: 0,
                      paddingHorizontal: 7,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <MaterialIcon size={12} color="#ffffff" strokeWidth={2.5} />
                    <Text
                      numberOfLines={1}
                      style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                      className="text-[11px] font-black text-white capitalize tracking-wide"
                    >
                      {presentation.label}
                    </Text>
                    <View className="ml-0.5 px-1.5 py-0.5 rounded bg-black/25 items-center justify-center">
                      <Text
                        style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                        className="text-[10px] font-bold text-white"
                      >
                        {scorePercent}%
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Action Toolbar below image */}
          <View className="flex-row items-center justify-between px-6 py-3">
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
              onPress={resetScan}
            >
              <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/80">
                <RotateCcw size={13} color="#183e48" />
                <Text className="text-xs font-bold text-foreground">Retake</Text>
              </View>
            </AnimatedPressable>

            {busy && (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#19806d" size="small" />
                <Text className="text-xs font-medium text-muted-foreground">Checking your photo...</Text>
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
              <Text className="text-2xl font-black tracking-tight text-foreground">What We Found</Text>
              <Badge variant={eligibleCount > 0 ? 'success' : 'secondary'} className="px-3 py-1 rounded-full">
                <Text className={`text-[11px] font-bold ${eligibleCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {eligibleCount} eligible
                </Text>
              </Badge>
            </View>

            {/* Quick Bulk Action only if any item is not clean or needs confirmation */}
            {/* Empty state */}
            {items.length === 0 && (
              <View className="py-6 items-center">
                <Text className="text-xs font-medium text-muted-foreground text-center">
                  Nothing found. If you can see an item, add it below.
                </Text>
              </View>
            )}

            {/* Review Items List */}
            <View className="mt-4 space-y-3">
              {items.map((item, index) => {
                const decision = itemDecision(item, activeRuleSet);
                const presentation = itemPresentation(item, activeRuleSet);
                const isSelected = item.id === selectedId;
                const boxColor = item.removed ? '#94a3b8' : presentation.color;

                const badgeVariant =
                  decision.eligibility === 'eligible'
                    ? 'success'
                    : decision.eligibility === 'needs_confirmation'
                    ? 'unsure'
                    : 'destructive';

                const statusLabel = item.removed
                  ? 'Removed'
                  : decision.eligibility === 'eligible'
                  ? 'Recyclable'
                  : decision.eligibility === 'needs_confirmation'
                  ? 'Confirm'
                  : 'Non-recyclable';

                return (
                  <Animated.View
                    key={item.id}
                    entering={appear(index)}
                    onLayout={(event) => {
                      rows.current[item.id] = sheetTop.current + event.nativeEvent.layout.y;
                    }}
                  >
                  <Card
                    style={{
                      borderColor: isSelected ? boxColor : 'rgba(203, 213, 225, 0.8)',
                      borderWidth: isSelected ? 2 : 1,
                    }}
                    className={`p-3.5 rounded-2xl bg-card transition-all mt-3 ${
                      item.removed ? 'opacity-50' : ''
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      {/* Left: Material Icon & Name (press to focus bounding box) */}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Focus ${presentation.label}`}
                        onPress={() => setSelectedId(item.id)}
                        className="flex-row items-center gap-3 flex-1 mr-2"
                      >
                        {(() => {
                          const IconComponent = getMaterialIcon(item.label);
                          const iconColor = item.removed ? '#94a3b8' : presentation.color;
                          return (
                            <View
                              style={{
                                backgroundColor: item.removed ? '#f1f5f9' : `${presentation.color}15`,
                                borderColor: item.removed ? '#e2e8f0' : `${presentation.color}35`,
                              }}
                              className="h-10 w-10 rounded-2xl border items-center justify-center"
                            >
                              <IconComponent size={20} color={iconColor} strokeWidth={2.2} />
                            </View>
                          );
                        })()}
                        <View className="flex-1">
                          <Text
                            className={`text-base font-bold capitalize ${
                              item.removed ? 'text-muted-foreground line-through' : 'text-foreground'
                            }`}
                          >
                            {presentation.label}
                          </Text>
                          {item.detection?.confidence === 'uncertain' && !item.confirmed && !item.removed && (
                            <Text className="text-[11px] font-medium text-amber-700">
                              Low confidence · {Math.round(item.detection.score * 100)}% sure
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {/* Right: Dual-function Status / Confirm Pill & Actions */}
                      <View className="flex-row items-center gap-2">
                        <AnimatedPressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            !item.confirmed && !item.removed
                              ? 'Tap to confirm material as recyclable'
                              : statusLabel
                          }
                          disabled={item.confirmed || item.removed}
                          onPress={() => updateItem(item.id, { confirmed: true })}
                        >
                          <View
                            pointerEvents="none"
                            className={`h-7 px-3 rounded-full border flex-row items-center justify-center gap-1 ${
                              !item.confirmed && !item.removed
                                ? 'bg-amber-500/15 border-amber-500/35'
                                : item.removed
                                ? 'bg-slate-100 border-slate-200'
                                : badgeVariant === 'success'
                                ? 'bg-primary/10 border-primary/20'
                                : badgeVariant === 'unsure'
                                ? 'bg-slate-100 border-slate-200'
                                : 'bg-destructive/10 border-destructive/20'
                            }`}
                          >
                            {!item.confirmed && !item.removed ? (
                              <>
                                <Check size={12} color="#d97706" strokeWidth={2.5} />
                                <Text
                                  style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                                  className="text-[11px] font-bold text-amber-800 dark:text-amber-300"
                                >
                                  Confirm
                                </Text>
                              </>
                            ) : (
                              <Text
                                style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                                className={`text-[11px] font-bold ${
                                  item.removed
                                    ? 'text-slate-500'
                                    : badgeVariant === 'success'
                                    ? 'text-primary'
                                    : badgeVariant === 'unsure'
                                    ? 'text-slate-800'
                                    : 'text-destructive'
                                }`}
                              >
                                {statusLabel}
                              </Text>
                            )}
                          </View>
                        </AnimatedPressable>

                        {/* Item Quick Actions */}
                        {!item.removed && (
                          <AnimatedPressable
                            accessibilityRole="button"
                            accessibilityLabel="Change material"
                            onPress={() => changeLabel(item)}
                            className="p-2 rounded-xl bg-secondary/50 active:bg-secondary"
                          >
                            <Edit3 size={15} color="#5b7072" />
                          </AnimatedPressable>
                        )}
                        <AnimatedPressable
                          accessibilityRole="button"
                          accessibilityLabel={item.removed ? 'Undo remove item' : 'Remove item'}
                          onPress={() => updateItem(item.id, { removed: !item.removed })}
                          className="p-2 rounded-xl bg-secondary/50 active:bg-secondary"
                        >
                          {item.removed ? (
                            <Undo2 size={16} color="#19806d" strokeWidth={2.2} />
                          ) : (
                            <Trash2 size={16} color="#b42318" />
                          )}
                        </AnimatedPressable>
                      </View>
                    </View>
                  </Card>
                  </Animated.View>
                );
              })}
            </View>

            {/* Add missing item button */}
            <AnimatedPressable onPress={addItem} className="mt-3.5">
              <View className="w-full min-h-[44px] py-3 px-4 rounded-2xl border border-dashed border-primary/50 bg-primary/5 flex-row items-center justify-center gap-2">
                <Plus size={16} color="#19806d" />
                <Text className="text-xs font-bold text-primary">Add Item</Text>
              </View>
            </AnimatedPressable>

            {/* ACTION SECTION: Confirmation Card directly preceding Continue Action */}
            <View className="mt-8 pt-2">
              {/* Safe for Collection Card - only needed when scheduling recyclable pickup */}
              {eligibleCount > 0 ? (
                <Card
                  style={{
                    borderColor: safetyConfirmed ? '#19806d' : '#e2e8f0',
                    borderWidth: safetyConfirmed ? 1.5 : 1,
                    backgroundColor: safetyConfirmed ? '#f2f9f6' : '#ffffff',
                  }}
                  className="p-3.5 rounded-2xl border shadow-xs"
                >
                  <AnimatedPressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: safetyConfirmed }}
                    accessibilityLabel="Items are safe for collection"
                    onPress={() => setSafetyConfirmed((prev) => !prev)}
                    className="flex-row items-center justify-between gap-3"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <View
                        style={{
                          backgroundColor: safetyConfirmed ? '#e6f5f1' : '#f8fafc',
                          borderColor: safetyConfirmed ? '#b2e3d7' : '#e2e8f0',
                        }}
                        className="h-10 w-10 rounded-2xl border items-center justify-center"
                      >
                        <ShieldCheck
                          size={20}
                          color={safetyConfirmed ? '#19806d' : '#94a3b8'}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-foreground">
                          Safe for collection
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          Items are clean, dry & hazard-free
                        </Text>
                      </View>
                    </View>

                    <View
                      className={`h-6 w-6 rounded-full items-center justify-center transition-colors ${
                        safetyConfirmed ? 'bg-primary' : 'border-2 border-slate-300 bg-white'
                      }`}
                    >
                      {safetyConfirmed && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </View>
                  </AnimatedPressable>
                </Card>
              ) : activeItems.length > 0 ? (
                <Card
                  style={{
                    borderColor: '#e2e8f0',
                    backgroundColor: '#ffffff',
                  }}
                  className="p-3.5 rounded-2xl border shadow-xs"
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        backgroundColor: '#fef3c7',
                        borderColor: '#fde68a',
                      }}
                      className="h-10 w-10 rounded-2xl border items-center justify-center"
                    >
                      <AlertTriangle size={20} color="#d97706" strokeWidth={2.2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">
                        Not Recyclable
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        These items can't be collected. See how to throw them away safely.
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              {/* Continue to Step 2 Button directly coupled with confirmation above */}
              <View className="mt-3.5">
                <Button
                  disabled={activeItems.length === 0 || (eligibleCount > 0 && !safetyConfirmed)}
                  onPress={() => {
                    void persistCurrentScan(items, photo, result);
                    setCurrentGuideIndex(0);
                    setMaxViewedGuideIndex(0);
                    setStep('guidance');
                  }}
                  className={`w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center shadow-sm ${
                    activeItems.length === 0 || (eligibleCount > 0 && !safetyConfirmed) ? 'opacity-60' : ''
                  }`}
                >
                  <Text className="text-base font-bold text-white mr-2">
                    {eligibleCount > 0 ? 'Continue' : 'View Disposal Guide'}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" />
                </Button>

                {activeItems.length === 0 ? (
                  <Text className="mt-2.5 text-center text-xs text-muted-foreground font-medium">
                    Add or keep at least one item to continue
                  </Text>
                ) : eligibleCount > 0 && !safetyConfirmed ? (
                  <Text className="mt-2.5 text-center text-xs text-muted-foreground font-medium">
                    Confirm items are safe to continue
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* STEP 2: PREPARATION & DISPOSAL GUIDANCE */}
      <View style={{ flex: 1, display: step === 'guidance' ? 'flex' : 'none' }} className="flex-1 bg-background">
        {/* Sticky top navigation bar */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) }}
          className="px-6 pb-3 pt-2 flex-row items-center justify-between bg-background border-b border-border/40"
        >
          <View className="flex-row items-center gap-3">
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Back to review items"
              onPress={() => setStep('review')}
              className="h-10 w-10 rounded-2xl bg-secondary/80 border border-border items-center justify-center"
            >
              <ArrowLeft size={18} color="#183e48" />
            </AnimatedPressable>
            <View>
              <Text className="text-2xl font-black tracking-tight text-foreground">Preparation Guide</Text>
            </View>
          </View>

          {/* Paging dot indicators */}
          {uniqueGuideClasses.length > 1 && (
            <View className="flex-row items-center gap-1.5">
              {uniqueGuideClasses.map((cls, idx) => (
                <View
                  key={cls}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentGuideIndex ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        {/* Horizontal Swipable Pages */}
        <ScrollView
          ref={guidanceScrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const page = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
            setCurrentGuideIndex(page);
            setMaxViewedGuideIndex((prev) => Math.max(prev, page));
          }}
          className="flex-1"
        >
          {uniqueGuideClasses.map((itemClass) => {
            const guide = getRecyclingGuide(itemClass);
            const isRecyclable = guide.isRecyclable;
            const headerTitle = isRecyclable
              ? `How to prepare ${guide.shortName}`
              : `How to dispose ${guide.shortName}`;

            return (
              <ScrollView
                key={itemClass}
                style={{ width: windowWidth }}
                nestedScrollEnabled
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 160 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Uniform Header */}
                <View className="mb-4">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Badge
                      variant={isRecyclable ? 'success' : 'destructive'}
                      className="px-2.5 py-0.5 rounded-full"
                    >
                      <Text className="text-[10px] font-bold capitalize">
                        {isRecyclable ? 'Recyclable' : 'Non-Recyclable'}
                      </Text>
                    </Badge>
                  </View>
                  <Text className="text-2xl font-black tracking-tight text-foreground">
                    {headerTitle}
                  </Text>
                </View>

                {/* Seamless Combined Card: Video/Animation + Preparation Steps + Warning Note */}
                <Card className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xs mb-6">
                  {/* Embedded Animation Top Section (Seamless white background with no divider border) */}
                  <View className="pt-6 pb-2 px-4 bg-card items-center justify-center">
                    <RecyclingAnimation recyclingClass={guide.className} size={150} />
                  </View>

                  {/* Vertical Progress Steps */}
                  <View className="p-5 pt-3">
                    {guide.steps.map((stepItem, index) => {
                      const isLastStep = index === guide.steps.length - 1;

                      return (
                        <View key={stepItem.stepNumber} className="flex-row items-start">
                          {/* Indicator Column (Numbered Circle + Connecting Line) */}
                          <View className="items-center mr-3.5" style={{ width: 28 }}>
                            <View className="h-7 w-7 rounded-full bg-primary items-center justify-center">
                              <Text
                                style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                                className="text-xs font-black text-white"
                              >
                                {stepItem.stepNumber}
                              </Text>
                            </View>
                            {!isLastStep && (
                              <View className="w-0.5 bg-primary/25 flex-1 my-1" style={{ minHeight: 28 }} />
                            )}
                          </View>

                          {/* Step Content */}
                          <View className={`flex-1 ${isLastStep ? 'pb-0' : 'pb-5'}`}>
                            <Text className="text-sm font-bold text-foreground mb-0.5">
                              {stepItem.title}
                            </Text>
                            <Text className="text-xs text-muted-foreground leading-relaxed">
                              {stepItem.detail}
                            </Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Standalone Warning Banner under Step 3 */}
                    {Boolean(guide.importantNote) && (
                      <View className="mt-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex-row items-start gap-2.5">
                        <AlertTriangle size={16} color="#d97706" style={{ marginTop: 2 }} />
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            Important Note
                          </Text>
                          <Text className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-snug">
                            {guide.importantNote}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </Card>
              </ScrollView>
            );
          })}
        </ScrollView>

        {/* Bottom Floating Navigation Action (Clean borderless backdrop) */}
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="absolute bottom-0 left-0 right-0 p-5 bg-background shadow-lg"
        >
          {(() => {
            const isLastGuide = currentGuideIndex >= uniqueGuideClasses.length - 1;
            const hasViewedAll = maxViewedGuideIndex >= uniqueGuideClasses.length - 1;

            if (!isLastGuide) {
              return (
                <Button
                  onPress={() => {
                    const nextIdx = currentGuideIndex + 1;
                    guidanceScrollRef.current?.scrollTo({ x: nextIdx * windowWidth, animated: true });
                    setCurrentGuideIndex(nextIdx);
                    setMaxViewedGuideIndex((prev) => Math.max(prev, nextIdx));
                  }}
                  className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-sm"
                >
                  <Text className="text-base font-bold text-white">Next Guide</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </Button>
              );
            }

            if (eligibleCount === 0) {
              return (
                <Button
                  disabled={!hasViewedAll}
                  onPress={resetScan}
                  className={`w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center shadow-sm ${
                    !hasViewedAll ? 'opacity-50' : ''
                  }`}
                >
                  <Text className="text-base font-bold text-white mr-2">Done</Text>
                  <Check size={18} color="#ffffff" />
                </Button>
              );
            }

            return (
              <View className="gap-2.5">
                <Button
                  disabled={!hasViewedAll}
                  onPress={() => setStep('schedule')}
                  className={`w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-sm ${
                    !hasViewedAll ? 'opacity-50' : ''
                  }`}
                >
                  <Text className="text-base font-bold text-white">Choose a Pickup Time</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </Button>
                <Button
                  variant="outline"
                  onPress={resetScan}
                  className="w-full h-12 rounded-2xl border border-border bg-white active:bg-secondary/40 flex-row items-center justify-center gap-2 shadow-xs"
                >
                  <Recycle size={18} color="#183e48" />
                  <Text className="text-base font-bold text-foreground">Recycle Myself</Text>
                </Button>
              </View>
            );
          })()}
        </View>
      </View>

      {/* STEP 3: SCHEDULE PICKUP */}
      <View style={{ flex: 1, display: step === 'schedule' ? 'flex' : 'none' }} className="flex-1 bg-background">
        {/* Sticky top navigation bar */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) }}
          className="px-6 pb-3 pt-2 flex-row items-center justify-between bg-background border-b border-border/40"
        >
          <View className="flex-row items-center gap-3">
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Back to guidance"
              onPress={() => setStep('guidance')}
              className="h-10 w-10 rounded-2xl bg-secondary/80 border border-border items-center justify-center"
            >
              <ArrowLeft size={18} color="#183e48" />
            </AnimatedPressable>
            <View>
              <Text className="text-2xl font-black tracking-tight text-foreground">Schedule Pickup</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} className="flex-1 bg-background">
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
      {/* Material Selection Modal */}
      <Modal
        visible={materialModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMaterialModal({ visible: false, mode: 'add' })}
      >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center p-5"
          onPress={() => setMaterialModal({ visible: false, mode: 'add' })}
        >
          <Pressable
            className="w-full max-w-sm rounded-3xl bg-card border border-border/80 p-5 shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-lg font-black text-foreground">
                  Select Material
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Choose the correct recyclable category.
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => setMaterialModal({ visible: false, mode: 'add' })}
                className="h-8 w-8 items-center justify-center rounded-full bg-secondary/80"
              >
                <X size={16} color="#5b7072" />
              </AnimatedPressable>
            </View>

            <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {LABELS.map((label) => {
                  const rule = activeRuleSet.classes[label];
                  const isRecyclable = rule?.material === 'recyclable';
                  const isNotRecyclable = rule?.material === 'not_recyclable';
                  const Icon = getMaterialIcon(label);
                  const iconColor = isRecyclable ? '#15803d' : isNotRecyclable ? '#b42318' : '#64748b';

                  return (
                    <AnimatedPressable
                      key={label}
                      onPress={() => handleSelectMaterial(label)}
                      className="p-2.5 rounded-2xl border border-border/70 bg-secondary/30 flex-row items-center justify-between active:bg-primary/10"
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          style={{
                            backgroundColor: `${iconColor}15`,
                            borderColor: `${iconColor}35`,
                          }}
                          className="h-9 w-9 rounded-xl border items-center justify-center"
                        >
                          <Icon size={18} color={iconColor} strokeWidth={2.2} />
                        </View>
                        <Text className="text-sm font-bold capitalize text-foreground">
                          {label}
                        </Text>
                      </View>
                      <Badge
                        variant={isRecyclable ? 'success' : isNotRecyclable ? 'destructive' : 'secondary'}
                        className="px-2.5 py-0.5 rounded-full"
                      >
                        <Text className="text-[11px] font-bold capitalize">
                          {isRecyclable ? 'Recyclable' : isNotRecyclable ? 'Non-recyclable' : 'Unsure'}
                        </Text>
                      </Badge>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
});
