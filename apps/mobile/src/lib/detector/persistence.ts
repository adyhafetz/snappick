import { supabase } from '@/lib/supabase';
import type { Condition } from '@/lib/detector/types';
import {
  classifyScanActiveLearning,
  evaluateUploadGating,
  type ActiveLearningEvaluation,
  type ActiveLearningOptions,
  type UploadGatingResult,
} from './active-learning';

export interface DetectionRecord {
  id?: string;
  model_label: string;
  app_class: string;
  score: number;
  second_best_label?: string | null;
  second_best_score?: number | null;
  box_x1?: number | null;
  box_y1?: number | null;
  box_x2?: number | null;
  box_y2?: number | null;
  source: 'detector' | 'user_added';
  condition: Condition;
  eligibility: string;
  quantity: number;
}

export interface UserCorrection {
  detectionId?: string;
  originalModelLabel?: string;
  correctedAppClass?: string;
  originalCondition?: Condition;
  correctedCondition?: Condition;
  feedbackType: 'confirm' | 'change_label' | 'remove' | 'condition_change';
}

export interface PersistScanParams {
  scanId: string;
  userId: string;
  modelVersion: string;
  ruleSetId?: string | null;
  ruleSetVersion?: number | null;
  imageStorageConsent: boolean;
  trainingOptIn: boolean;
  imageWidth: number;
  imageHeight: number;
  preprocessMs: number;
  inferenceMs: number;
  retentionDays?: number;
  detections: DetectionRecord[];
  corrections?: UserCorrection[];
  activeLearningOptions?: ActiveLearningOptions;
  bypassDailyCap?: boolean;
}

export interface PersistScanResult {
  scanId: string;
  evaluation: ActiveLearningEvaluation;
  gating: UploadGatingResult;
  remainingDailyCap: number;
}

/**
 * Checks remaining daily upload cap for the current user.
 */
export async function fetchRemainingDailyCap(cap = 20): Promise<number> {
  const { data, error } = await supabase.rpc('check_daily_upload_cap', { p_cap: cap });
  if (error || typeof data !== 'number') {
    return cap; // fallback optimistic cap
  }
  return data;
}

/**
 * Persists a complete scan session with detections, user feedback,
 * active learning evaluation, and upload gating.
 */
export async function persistScanSession(
  params: PersistScanParams
): Promise<PersistScanResult> {
  // 1. Fetch current daily cap
  const remainingDailyCap = await fetchRemainingDailyCap();

  // 2. Classify active learning
  const classificationInputs = params.detections.map((d) => {
    // Find matching correction if any
    const matchingCorrection = params.corrections?.find(
      (c) => c.originalModelLabel === d.model_label || (d.id && c.detectionId === d.id)
    );

    return {
      score: d.score,
      confidence: (d.score >= 0.8 ? 'confident' : 'uncertain') as 'confident' | 'uncertain',
      originalLabel: d.model_label,
      currentLabel: matchingCorrection?.correctedAppClass ?? d.app_class,
      removed: matchingCorrection?.feedbackType === 'remove',
      source: d.source,
    };
  });

  const evaluation = classifyScanActiveLearning(
    classificationInputs,
    params.activeLearningOptions
  );

  // 3. Evaluate upload gating
  const gating = evaluateUploadGating({
    imageStorageConsent: params.imageStorageConsent,
    trainingOptIn: params.trainingOptIn,
    evaluation,
    remainingDailyCap,
    bypassDailyCap: params.bypassDailyCap,
  });

  // 4. Resolve valid UUID for ruleSetId if provided as a slug (e.g. 'perak_general')
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let resolvedRuleSetId: string | null = null;
  if (params.ruleSetId && UUID_REGEX.test(params.ruleSetId)) {
    resolvedRuleSetId = params.ruleSetId;
  } else if (params.ruleSetId) {
    try {
      const { data: ruleRow } = await supabase
        .from('pbt_rule_sets')
        .select('id')
        .eq('name', params.ruleSetId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (ruleRow?.id) {
        resolvedRuleSetId = ruleRow.id;
      }
    } catch {
      resolvedRuleSetId = null;
    }
  }

  // 5. Upsert scan record via RPC
  const { error: scanError } = await supabase.rpc('upsert_scan', {
    p_scan_id: params.scanId,
    p_model_version: params.modelVersion,
    p_rule_set_id: resolvedRuleSetId,
    p_rule_set_version: params.ruleSetVersion ?? null,
    p_image_storage_consent: params.imageStorageConsent,
    p_training_opt_in: params.trainingOptIn,
    p_image_width: params.imageWidth,
    p_image_height: params.imageHeight,
    p_preprocess_ms: params.preprocessMs,
    p_inference_ms: params.inferenceMs,
    p_retention_days: params.retentionDays ?? 90,
  });

  if (scanError) {
    throw new Error(`Failed to persist scan: ${scanError.message}`);
  }

  // 5. Upsert detections via RPC
  if (params.detections.length > 0) {
    const { error: detError } = await supabase.rpc('upsert_detections', {
      p_scan_id: params.scanId,
      p_detections: params.detections,
    });
    if (detError) {
      console.warn('Failed to upsert detections:', detError.message);
    }
  }

  // 6. Record user corrections into label_feedback
  if (params.corrections && params.corrections.length > 0) {
    const feedbackRows = params.corrections.map((c) => ({
      scan_id: params.scanId,
      user_id: params.userId,
      detection_id: c.detectionId ?? null,
      original_model_label: c.originalModelLabel ?? null,
      corrected_app_class: c.correctedAppClass ?? null,
      original_condition: c.originalCondition ?? null,
      corrected_condition: c.correctedCondition ?? null,
      feedback_type: c.feedbackType,
    }));

    const { error: feedbackError } = await supabase
      .from('label_feedback')
      .insert(feedbackRows);

    if (feedbackError) {
      console.warn('Failed to record label feedback:', feedbackError.message);
    }
  }

  // 7. Upsert feedback_samples row
  const { error: sampleError } = await supabase.rpc('upsert_feedback_sample', {
    p_scan_id: params.scanId,
    p_label_tier: evaluation.labelTier,
    p_training_opt_in: params.trainingOptIn,
  });

  if (sampleError) {
    console.warn('Failed to upsert feedback sample:', sampleError.message);
  }

  // 8. Update feedback_samples with active learning selection metadata
  const todayStr = new Date().toISOString().split('T')[0];
  const { error: updateSampleError } = await supabase
    .from('feedback_samples')
    .update({
      selection_reason: evaluation.reason,
      upload_selected: gating.shouldUpload,
      upload_selected_at: gating.shouldUpload ? new Date().toISOString() : null,
      daily_cap_date: gating.shouldUpload ? todayStr : null,
      upload_status: gating.shouldUpload ? 'queued' : 'not_selected',
    })
    .eq('scan_id', params.scanId);

  if (updateSampleError) {
    console.warn('Failed to update feedback sample metadata:', updateSampleError.message);
  }

  // 9. If selected for upload, register in server scan_upload_queue
  if (gating.shouldUpload) {
    await supabase.from('scan_upload_queue').upsert(
      {
        scan_id: params.scanId,
        user_id: params.userId,
        status: 'queued',
      },
      { onConflict: 'scan_id' }
    );
  }

  return {
    scanId: params.scanId,
    evaluation,
    gating,
    remainingDailyCap,
  };
}

