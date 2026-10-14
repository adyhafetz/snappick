import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppIcon } from '@/components/AppIcon';
import { scanPhoto, type ScanResult } from '@/lib/detector/scanner';
import { BUNDLED_RULE_SET, evaluateEligibility, MANUAL_SAFETY_LABELS, type ManualSafetyKey, type RuleSet } from '@/lib/detector/rules';
import { materialPresentation, pickupDecision } from '@/lib/detector/presentation';
import type { Condition, Detection } from '@/lib/detector/types';
import { hazardGuidanceKey, parseRuleSet, requestGuidance, type GuidanceCard } from '@/lib/guidance/service';
import { bundledAdvice, resolveLocationRuleSet, resolvePreferredRuleSet, sourceBadge } from '@/lib/guidance/presentation';
import bundledAdviceData from '@/assets/bundled_advice.json';
import { supabase } from '@/lib/supabase';
import modelManifest from '@/assets/models/model_manifest.json';
import { colors, shape, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };
type ReviewItem = { id: string; detection?: Detection; label: string; condition: Condition; removed: boolean; userAdded: boolean; confirmed: boolean; guidance: GuidanceCard };
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
        if (preferred.id !== BUNDLED_ACTIVE_RULE_SET.id || preferred.version !== BUNDLED_ACTIVE_RULE_SET.version) {
          setActiveRuleSet(preferred);
          setRuleSetMessage(`${preferred.label} · v${preferred.version}`);
        }
      } catch { /* Invalid local cache falls back to the bundled rule set. */ }
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
        guidance: { ...bundledAdvice(detection.label, 'clean_dry'), source: 'fallback' as const, ruleSetId: activeRuleSet.id, ruleSetLabel: activeRuleSet.label, ruleSetVersion: activeRuleSet.version, offline: true },
      }));
      setResult(nextResult);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id);
      void Promise.all(nextItems.map(async (item) => ({
        id: item.id,
        label: item.label,
        condition: item.condition,
        guidance: await requestGuidance(item.label, item.condition, activeRuleSet),
      }))).then((guidance) => setItems((current) => current.map((item) => {
        const result = guidance.find((entry) => entry.id === item.id);
        return result && item.label === result.label && item.condition === result.condition
          && item.guidance.ruleSetId === activeRuleSet.id && item.guidance.ruleSetVersion === activeRuleSet.version
          ? { ...item, guidance: result.guidance }
          : item;
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The photo could not be scanned.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camera.current) return;
    try {
      const picture: CameraCapturedPicture = await camera.current.takePictureAsync({ quality: 0.9 });
      await runScan({ uri: picture.uri, width: picture.width, height: picture.height });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Camera capture failed.');
    }
  };

  const pick = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
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
    if (typeof y === 'number') reviewScroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const updateItem = (id: string, patch: Partial<ReviewItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const refreshGuidance = (id: string, label: string, condition: Condition, ruleSet = activeRuleSet) => {
    void requestGuidance(label, condition, ruleSet).then((guidance) => {
      setItems((current) => current.map((item) => item.id === id && item.label === label && item.condition === condition
        && item.guidance.ruleSetId === ruleSet.id && item.guidance.ruleSetVersion === ruleSet.version
        ? { ...item, guidance }
        : item));
    });
  };

  const updateCondition = (item: ReviewItem, condition: Condition) => {
    updateItem(item.id, { condition, guidance: { ...bundledAdvice(item.label, condition), source: 'fallback', ruleSetId: activeRuleSet.id, ruleSetLabel: activeRuleSet.label, ruleSetVersion: activeRuleSet.version, offline: true } });
    refreshGuidance(item.id, item.label, condition);
  };

  const resolveLocationGuidance = async () => {
    setRuleSetMessage('Checking local guidance…');
    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        setRuleSetMessage(`${activeRuleSet.label} · location unavailable`);
        Alert.alert(activeRuleSet.label, `Location was not shared. ${activeRuleSet.label} will be used.`);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { data, error: resolutionError } = await supabase.rpc('resolve_rule_set', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      const row = Array.isArray(data) ? data[0] : data;
      const resolvedCandidate = row && typeof row === 'object'
        ? parseRuleSet({ id: (row as { name?: string }).name, version: (row as { version?: number }).version, label: ((row as { rules?: { label?: string } }).rules?.label) ?? 'Local guidance', classes: (row as { rules?: { classes?: unknown } }).rules?.classes })
        : null;
      const resolved = resolutionError ? null : resolveLocationRuleSet(resolvedCandidate, activeRuleSet);
      if (!resolvedCandidate || !resolved) {
        setRuleSetMessage(`${activeRuleSet.label} · local rules unavailable`);
        Alert.alert(activeRuleSet.label, `Local rules are unavailable for this area. ${activeRuleSet.label} will be used.`);
        return;
      }
      setActiveRuleSet(resolved);
      setRuleSetMessage(`${resolved.label} · v${resolved.version}`);
      await AsyncStorage.setItem(RULE_SET_STORAGE_KEY, JSON.stringify(resolved));
      setItems((current) => current.map((item) => ({ ...item, guidance: { ...bundledAdvice(item.label, item.condition), source: 'fallback', ruleSetId: resolved.id, ruleSetLabel: resolved.label, ruleSetVersion: resolved.version, offline: true } })));
      items.filter((item) => !item.removed).forEach((item) => refreshGuidance(item.id, item.label, item.condition, resolved));
    } catch {
      setRuleSetMessage(`${activeRuleSet.label} · location unavailable`);
      Alert.alert(activeRuleSet.label, `Location or local rule lookup is unavailable. ${activeRuleSet.label} will be used.`);
    }
  };

  const changeLabel = (item: ReviewItem) => Alert.alert(
    'Change label',
    'Choose the visual label for this item.',
    LABELS.map((label) => ({ text: label, onPress: () => {
      updateItem(item.id, { label, guidance: { ...bundledAdvice(label, item.condition), source: 'fallback', ruleSetId: activeRuleSet.id, ruleSetLabel: activeRuleSet.label, ruleSetVersion: activeRuleSet.version, offline: true } });
      refreshGuidance(item.id, label, item.condition);
    } })),
  );

  const addItem = () => Alert.alert(
    'Add item not in photo',
    'Choose a label. This item has no detector box.',
      LABELS.filter((label) => evaluateEligibility(label, 'clean_dry', activeRuleSet).eligibility !== 'not_eligible')
      .map((label) => ({
        text: label,
        onPress: () => {
          const id = `manual-${Date.now()}`;
          const guidance = { ...bundledAdvice(label, 'unknown'), source: 'fallback' as const, ruleSetId: activeRuleSet.id, ruleSetLabel: activeRuleSet.label, ruleSetVersion: activeRuleSet.version, offline: true };
          setItems((current) => [...current, { id, label, condition: 'unknown', removed: false, userAdded: true, confirmed: true, guidance }]);
          setSelectedId(id);
          void requestGuidance(label, 'unknown', activeRuleSet).then((nextGuidance) => updateItem(id, { guidance: nextGuidance }));
        },
      })),
  );

  const confirmEverythingClean = () => {
    setItems((current) => current.map((item) => ({
      ...item,
      condition: 'clean_dry',
      guidance: { ...bundledAdvice(item.label, 'clean_dry'), source: 'fallback', ruleSetId: activeRuleSet.id, ruleSetLabel: activeRuleSet.label, ruleSetVersion: activeRuleSet.version, offline: true },
    })));
    items.filter((item) => !item.removed).forEach((item) => refreshGuidance(item.id, item.label, 'clean_dry'));
  };
  const aggregate = Object.entries((result?.detections ?? []).reduce<Record<string, number>>((counts, detection) => {
    counts[detection.label] = (counts[detection.label] ?? 0) + 1;
    return counts;
  }, {})).map(([label, count]) => `${count} ${label}`).join(', ') || 'No detected items';

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Preparing camera</Text></View>;
  }

  if (!permission.granted && !photo) {
    return <View style={styles.center}>
      <View style={styles.permissionMark}><AppIcon name="photo_camera" color={colors.primary} size={24} /></View>
      <Text style={styles.title}>Camera access needed</Text>
      <Text style={styles.body}>Scanning runs on this device and does not need a network connection.</Text>
      <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>Allow camera</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void pick()} style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}>
        <Text style={styles.secondaryText}>Choose a photo</Text>
      </Pressable>
    </View>;
  }

  const imageWidth = Math.min(600, windowWidth - spacing.md * 2);
  const imageHeight = photo ? imageWidth * (photo.height / photo.width) : 480;
  const eligibleCount = items.filter((item) => !item.removed && itemDecision(item, activeRuleSet).eligibility === 'eligible').length;

  return <View style={styles.screen}>
    {!photo ? <View style={styles.cameraWrap}>
      <CameraView ref={camera} style={styles.camera} facing="back" onMountError={(event) => setError(event.message)} />
      <View style={styles.cameraCopy}>
        <Text style={styles.cameraTitle}>Scan your items</Text>
        <Text style={styles.cameraHint}>Keep the whole item visible in the frame.</Text>
      </View>
      {error && <Text accessibilityRole="alert" style={styles.cameraError}>{error}</Text>}
      <View style={styles.captureBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a photo" onPress={() => void pick()} style={({ pressed }) => [styles.secondaryDark, pressed && styles.secondaryDarkPressed]}>
          <AppIcon name="photo_library" color={colors.surface} size={21} />
          <Text style={styles.secondaryDarkText}>Gallery</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={() => void capture()} style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={styles.shutterSpacer} />
      </View>
    </View> : <ScrollView ref={reviewScroll} contentContainerStyle={styles.content}>
      <View style={[styles.photo, { width: imageWidth, height: imageHeight }]}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        {items.map((item) => item.detection && !item.removed && <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.label}, ${Math.round(item.detection.score * 100)} percent`}
          key={item.id}
          onPress={() => selectItem(item.id)}
          style={[styles.box, {
            left: item.detection.x1 * imageWidth,
            top: item.detection.y1 * imageHeight,
            width: Math.max(2, (item.detection.x2 - item.detection.x1) * imageWidth),
            height: Math.max(2, (item.detection.y2 - item.detection.y1) * imageHeight),
            borderColor: itemPresentation(item, activeRuleSet).color,
            borderStyle: item.detection.confidence === 'uncertain' && !item.confirmed ? 'dashed' : 'solid',
            borderWidth: item.id === selectedId ? 3 : 2,
          }]}
        >
          <Text style={[styles.boxLabel, { backgroundColor: itemPresentation(item, activeRuleSet).color }]}>
            {itemPresentation(item, activeRuleSet).label} · {classificationText(itemPresentation(item, activeRuleSet).classification)} · {Math.round(item.detection.score * 100)}%
          </Text>
        </Pressable>)}
      </View>

      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={() => { setPhoto(undefined); setResult(undefined); setItems([]); }} style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}>
          <Text style={styles.secondaryText}>Scan another</Text>
        </Pressable>
        <View style={styles.offlineState}><View style={styles.offlineDot} /><Text style={styles.offline}>Offline scan</Text></View>
      </View>
      {error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
      {busy ? <View style={styles.loadingRow}><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Scanning on device...</Text></View> : result && <Text style={styles.timings}>Preprocess {result.timings.preprocessMs.toFixed(0)} ms · Inference {result.timings.inferenceMs.toFixed(0)} ms · Decode/NMS {result.timings.decodeNmsMs.toFixed(0)} ms</Text>}

      <View onLayout={(event) => { sheetTop.current = event.nativeEvent.layout.y; }} style={styles.sheet}>
        <Text style={styles.sheetTitle}>Review items</Text>
        <Text style={styles.summary}>{aggregate}</Text>
        <Text style={styles.readOnly}>{result?.detections.length ?? 0} detected · {eligibleCount} eligible. Add a row if an item was missed.</Text>
        <Text style={styles.ruleSetLabel}>{activeRuleSet.label} · v{activeRuleSet.version}</Text>
        <Pressable accessibilityRole="button" onPress={() => void resolveLocationGuidance()} style={({ pressed }) => [styles.localGuidance, pressed && styles.localGuidancePressed]}>
          <AppIcon name="my_location" color={colors.primaryDark} size={17} /><Text style={styles.localGuidanceText}>Use my location for local guidance</Text>
        </Pressable>
        {ruleSetMessage !== 'General Perak guidance' && <Text style={styles.rowReason}>{ruleSetMessage}</Text>}
        <Pressable accessibilityRole="button" onPress={confirmEverythingClean} style={({ pressed }) => [styles.confirm, pressed && styles.confirmPressed]}>
          <Text style={styles.confirmText}>Everything looks clean and dry</Text>
          <AppIcon name="check" color={colors.success} size={18} />
        </Pressable>
        {result?.detections.length === 0 && <Text style={styles.emptyResult}>No items were detected. You can add an eligible item manually.</Text>}

        {items.map((item) => {
          const decision = itemDecision(item, activeRuleSet);
          const presentation = itemPresentation(item, activeRuleSet);
          const statusStyle = decision.eligibility === 'eligible'
            ? styles.rowEligible
            : decision.eligibility === 'needs_confirmation' ? styles.rowNeedsReview : styles.rowIneligible;
          const statusText = item.removed ? 'Removed'
            : decision.eligibility === 'eligible' ? 'Eligible for pickup'
              : decision.eligibility === 'needs_confirmation' ? 'Confirm label to check pickup' : 'Not eligible for pickup';

          return <View
            key={item.id}
            onLayout={(event) => { rows.current[item.id] = sheetTop.current + event.nativeEvent.layout.y; }}
            style={[styles.row, item.id === selectedId && styles.rowSelected]}
          >
            <Pressable accessibilityRole="button" onPress={() => setSelectedId(item.id)} style={styles.rowHeader}>
              <View style={[styles.dot, { backgroundColor: item.removed ? colors.muted : presentation.color }]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.label}{item.userAdded ? ' · added' : ''}</Text>
                <Text style={styles.rowMeta}>{item.detection ? `${Math.round(item.detection.score * 100)}% ${item.detection.confidence}` : 'No detector box'}</Text>
                <Text style={[styles.rowStatus, statusStyle]}>{statusText}</Text>
                {!item.removed && decision.eligibility !== 'eligible' && <Text style={styles.rowReason}>{decision.reason}</Text>}
              </View>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conditionRow}>
              {CONDITIONS.map((condition) => <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.condition === condition.value }}
                key={condition.value}
                onPress={() => updateCondition(item, condition.value)}
                style={[styles.condition, item.condition === condition.value && styles.conditionSelected]}
              ><Text style={[styles.conditionText, item.condition === condition.value && styles.conditionTextSelected]}>{condition.label}</Text></Pressable>)}
            </ScrollView>
            <View style={styles.guidanceBlock}>
              <View style={styles.guidanceHeading}><Text style={styles.guidanceTitle}>Preparation</Text><Text style={[styles.sourceBadge, item.guidance.offline && styles.sourceBadgeOffline]}>{sourceBadge(item.guidance.source, item.guidance.offline)}</Text></View>
              <Text style={styles.guidanceText}>{item.guidance.preparation}</Text>
              <Text style={styles.guidanceTitle}>Acceptance / disposal</Text>
              <Text style={styles.guidanceText}>{item.guidance.disposal}</Text>
              {item.guidance.safety_warning && <Text style={styles.guidanceWarning}>{item.guidance.safety_warning}</Text>}
              {item.guidance.confirmation_required && <Text style={styles.guidanceMeta}>Confirm with your local provider. Guidance only; not binding municipal advice.</Text>}
              <Text style={styles.guidanceMeta}>{item.guidance.ruleSetLabel} · v{item.guidance.ruleSetVersion}</Text>
            </View>
            <View style={styles.actions}>
              {item.detection?.confidence === 'uncertain' && !item.confirmed && <Pressable accessibilityRole="button" onPress={() => updateItem(item.id, { confirmed: true })} style={styles.rowAction}><Text style={styles.actionText}>Confirm label</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => changeLabel(item)} style={styles.rowAction}><Text style={styles.actionText}>Change label</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => updateItem(item.id, { removed: !item.removed })} style={styles.rowAction}><Text style={styles.removeText}>{item.removed ? 'Restore' : 'Remove'}</Text></Pressable>
            </View>
          </View>;
        })}

        <Pressable accessibilityRole="button" onPress={addItem} style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Text style={styles.addText}>Add item not in photo</Text><AppIcon name="add" color={colors.primaryDark} size={20} />
        </Pressable>
        <Text style={styles.hazardQuestion}>Declare restricted or hazardous items</Text>
        <View style={styles.hazardChoices}>
          {(Object.entries(MANUAL_SAFETY_LABELS) as [ManualSafetyKey, string][]).map(([key, label]) => <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hazards[key] }}
            key={key}
            onPress={() => { setHazards((current) => ({ ...current, [key]: !current[key] })); setSafetyConfirmed(false); }}
            style={styles.hazardChoice}
          >
            <View style={[styles.checkbox, hazards[key] && styles.checkboxHazard]} />
            <Text style={styles.safetyText}>{label}</Text>
          </Pressable>)}
        </View>
        {Object.entries(hazards).filter(([, declared]) => declared).map(([key]) => {
          const advice = bundledAdvice(hazardGuidanceKey(key as ManualSafetyKey), 'unknown');
          return <View key={key} style={styles.hazardAdvice}>
            <Text style={styles.guidanceTitle}>{MANUAL_SAFETY_LABELS[key as ManualSafetyKey]} · local guidance</Text>
            <Text style={styles.guidanceText}>{advice.disposal}</Text>
            {advice.safety_warning && <Text style={styles.guidanceWarning}>{advice.safety_warning}</Text>}
          </View>;
        })}
        {Object.values(hazards).some(Boolean) && <Text style={styles.guidanceMeta}>{(bundledAdviceData.items as unknown as Record<string, { preparation: string }>)['hazard_confirmation'].preparation}</Text>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: safetyConfirmed }} onPress={() => setSafetyConfirmed((value) => !value)} style={styles.safetyRow}>
          <View style={[styles.checkbox, safetyConfirmed && styles.checkboxOn]}>{safetyConfirmed && <AppIcon name="check" color={colors.surface} size={16} />}</View>
          <Text style={styles.safetyText}>I will leave declared restricted items out of pickup.</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={eligibleCount === 0 || !safetyConfirmed}
          onPress={() => Alert.alert('Pickup request', 'Pickup request details will be collected in the pickup phase.')}
          style={({ pressed }) => [styles.request, (eligibleCount === 0 || !safetyConfirmed) && styles.requestDisabled, pressed && styles.requestPressed]}
        ><Text style={[styles.requestText, (eligibleCount === 0 || !safetyConfirmed) && styles.requestTextDisabled]}>Request pickup</Text></Pressable>
        <Text style={styles.safetyNote}>Detector labels never identify hazards. Safety declarations are manual.</Text>
      </View>
    </ScrollView>}
  </View>;
}

function itemPresentation(item: ReviewItem, ruleSet: RuleSet) {
  return materialPresentation(item.label, item.detection?.confidence === 'uncertain', item.confirmed, ruleSet);
}

function itemDecision(item: ReviewItem, ruleSet: RuleSet) {
  return pickupDecision(item.label, item.condition, item.detection?.confidence === 'uncertain', item.confirmed, ruleSet);
}

function classificationText(classification: ReturnType<typeof itemPresentation>['classification']): string {
  return classification === 'recyclable' ? 'Recyclable' : classification === 'not_recyclable' ? 'Not recyclable' : 'Unsure';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { paddingBottom: spacing.lg },
  center: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: spacing.lg },
  permissionMark: { alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', lineHeight: 32, marginTop: spacing.md, textAlign: 'center' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs, textAlign: 'center' },
  primary: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: shape.control, justifyContent: 'center', marginTop: spacing.lg, minHeight: 50, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  secondary: { alignItems: 'center', borderColor: colors.border, borderRadius: shape.control, borderWidth: 1, justifyContent: 'center', marginTop: spacing.sm, minHeight: 50, paddingHorizontal: spacing.lg },
  secondaryPressed: { backgroundColor: colors.surfaceAlt },
  secondaryText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.84 },
  cameraWrap: { backgroundColor: '#102b35', flex: 1 },
  camera: { flex: 1 },
  cameraCopy: { backgroundColor: 'rgba(16,43,53,0.82)', borderRadius: shape.control, left: spacing.md, padding: spacing.md, position: 'absolute', right: spacing.md, top: spacing.md },
  cameraTitle: { color: colors.surface, fontSize: 22, fontWeight: '700' },
  cameraHint: { color: '#e0e9e7', fontSize: 13, lineHeight: 19, marginTop: 4 },
  cameraError: { backgroundColor: colors.dangerSurface, borderRadius: shape.control, color: colors.danger, left: spacing.md, padding: spacing.sm, position: 'absolute', right: spacing.md, top: 114 },
  captureBar: { alignItems: 'center', bottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', left: spacing.md, position: 'absolute', right: spacing.md },
  secondaryDark: { alignItems: 'center', backgroundColor: 'rgba(16,43,53,0.82)', borderColor: '#dbe7e3', borderRadius: shape.control, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.sm },
  secondaryDarkPressed: { backgroundColor: '#31565d' },
  secondaryDarkText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  shutter: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.surface, borderRadius: 36, borderWidth: 3, height: 70, justifyContent: 'center', width: 70 },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterInner: { backgroundColor: colors.primary, borderRadius: 28, height: 54, width: 54 },
  shutterSpacer: { width: 83 },
  photo: { backgroundColor: '#e4e9e5', borderRadius: shape.control, marginHorizontal: spacing.md, marginTop: spacing.md, overflow: 'hidden', position: 'relative' },
  box: { position: 'absolute' },
  boxLabel: { color: colors.surface, fontSize: 11, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 3 },
  toolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  offlineState: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  offlineDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  offline: { color: colors.success, fontSize: 12, fontWeight: '700' },
  error: { backgroundColor: colors.dangerSurface, borderRadius: shape.control, marginHorizontal: spacing.md, padding: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  timings: { color: colors.muted, fontSize: 11, paddingBottom: spacing.xs, paddingHorizontal: spacing.md },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.md },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  summary: { color: colors.ink, fontSize: 17, fontWeight: '700', lineHeight: 23, marginTop: spacing.xxs },
  readOnly: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  ruleSetLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: spacing.sm },
  localGuidance: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.primary, borderRadius: shape.control, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, minHeight: 42, paddingHorizontal: spacing.sm },
  localGuidancePressed: { backgroundColor: colors.surfaceAlt },
  localGuidanceText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  confirm: { alignItems: 'center', backgroundColor: colors.successSurface, borderRadius: shape.control, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.sm },
  confirmPressed: { backgroundColor: '#dcebe1' },
  confirmText: { color: colors.success, fontSize: 13, fontWeight: '700' },
  emptyResult: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  row: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: spacing.sm },
  rowSelected: { backgroundColor: '#eff5f0', borderRadius: shape.control, marginHorizontal: -spacing.xs, paddingHorizontal: spacing.xs },
  rowHeader: { alignItems: 'flex-start', flexDirection: 'row', minHeight: 48, paddingTop: spacing.xxs },
  dot: { borderRadius: 6, height: 12, marginRight: spacing.sm, marginTop: 3, width: 12 },
  rowText: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  rowEligible: { color: colors.success },
  rowIneligible: { color: colors.danger },
  rowNeedsReview: { color: colors.unsure },
  rowReason: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  guidanceBlock: { backgroundColor: colors.surfaceAlt, borderRadius: shape.surface, marginTop: spacing.sm, padding: spacing.sm },
  guidanceHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  guidanceTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: spacing.xxs },
  guidanceText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 2 },
  guidanceWarning: { color: colors.danger, fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: spacing.xs },
  guidanceMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  sourceBadge: { backgroundColor: colors.successSurface, borderRadius: 4, color: colors.success, fontSize: 10, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  sourceBadgeOffline: { backgroundColor: colors.warningSurface, color: colors.warning },
  hazardAdvice: { backgroundColor: colors.warningSurface, borderRadius: shape.surface, marginTop: spacing.xs, padding: spacing.sm },
  conditionRow: { gap: spacing.xs, paddingTop: spacing.sm },
  condition: { alignItems: 'center', borderColor: colors.border, borderRadius: shape.round, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  conditionSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  conditionText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  conditionTextSelected: { color: colors.surface },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
  rowAction: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.xs },
  actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  add: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.primary, borderRadius: shape.control, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.sm },
  addPressed: { backgroundColor: colors.surfaceAlt },
  addText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  hazardQuestion: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21, marginTop: spacing.lg },
  hazardChoices: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  hazardChoice: { alignItems: 'center', flexDirection: 'row', minHeight: 48, minWidth: '50%', paddingRight: spacing.xs },
  checkbox: { alignItems: 'center', borderColor: colors.muted, borderRadius: 5, borderWidth: 1.5, height: 22, justifyContent: 'center', marginRight: spacing.xs, width: 22 },
  checkboxOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  checkboxHazard: { backgroundColor: colors.warning, borderColor: colors.warning },
  safetyRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', marginTop: spacing.xs, minHeight: 52, paddingVertical: spacing.xs },
  safetyText: { color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19 },
  request: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: shape.control, justifyContent: 'center', marginTop: spacing.md, minHeight: 52 },
  requestPressed: { opacity: 0.9 },
  requestDisabled: { backgroundColor: '#e4e9e5' },
  requestText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  requestTextDisabled: { color: colors.muted },
  safetyNote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.sm, textAlign: 'center' },
});
