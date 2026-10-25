export type ActiveLearningReason = 'uncertain' | 'corrected' | 'random_5pct' | 'mismatch' | null;
export type LabelTier = 'A' | 'B' | 'C' | 'D';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type UploadStatus = 'not_selected' | 'queued' | 'uploading' | 'done' | 'failed' | 'skipped';

export interface DetectionInput {
  score: number;
  confidence?: 'confident' | 'uncertain';
  originalLabel?: string;
  currentLabel?: string;
  removed?: boolean;
  source?: 'detector' | 'user_added';
}

export interface ActiveLearningEvaluation {
  selected: boolean;
  reason: ActiveLearningReason;
  labelTier: LabelTier;
  reviewStatus: ReviewStatus;
}

export interface ActiveLearningOptions {
  /**
   * Probability threshold for sampling confident, uncorrected scans.
   * Defaults to 0.05 (5%).
   */
  sampleRate?: number;
  /**
   * Deterministic override to force random sampling selection (for unit tests / dev flags).
   */
  forceRandomSample?: boolean;
  /**
   * Lower bound for uncertain detection scores.
   * Default: 0.40.
   */
  uncertainScoreMin?: number;
  /**
   * Upper bound for uncertain detection scores.
   * Default: 0.79.
   */
  uncertainScoreMax?: number;
}

export interface UploadGatingInput {
  imageStorageConsent: boolean;
  trainingOptIn: boolean;
  evaluation: ActiveLearningEvaluation;
  remainingDailyCap: number;
  /**
   * Dev flag to bypass daily cap during testing.
   */
  bypassDailyCap?: boolean;
}

export interface UploadGatingResult {
  shouldUpload: boolean;
  reasonNotUploading?: 'no_storage_consent' | 'no_training_opt_in' | 'not_selected' | 'daily_cap_reached';
}

/**
 * Classifies a scan session against active-learning selection criteria:
 * 1. Uncertain detections (score between 0.40 and 0.79).
 * 2. User corrections (user changed a label or removed a detector box).
 * 3. Random 5% sample of confident scans.
 */
export function classifyScanActiveLearning(
  detections: DetectionInput[],
  options: ActiveLearningOptions = {}
): ActiveLearningEvaluation {
  const minUncertain = options.uncertainScoreMin ?? 0.4;
  const maxUncertain = options.uncertainScoreMax ?? 0.79;
  const sampleRate = options.sampleRate ?? 0.05;

  const detectorDetections = detections.filter((d) => d.source !== 'user_added');

  // Check 1: User corrections (changed label or removed box) -> Tier C
  const hasUserCorrection = detectorDetections.some(
    (d) =>
      d.removed === true ||
      (d.originalLabel && d.currentLabel && d.originalLabel !== d.currentLabel)
  );

  if (hasUserCorrection) {
    return {
      selected: true,
      reason: 'corrected',
      labelTier: 'C',
      reviewStatus: 'pending',
    };
  }

  // Check 2: Uncertain bounding box (score in [0.40, 0.79] or marked uncertain)
  const hasUncertainBox = detectorDetections.some((d) => {
    if (d.confidence === 'uncertain') return true;
    return d.score >= minUncertain && d.score <= maxUncertain;
  });

  if (hasUncertainBox) {
    return {
      selected: true,
      reason: 'uncertain',
      labelTier: 'D',
      reviewStatus: 'pending',
    };
  }

  // Check 3: Random 5% sample of confident scans
  const isSampled = options.forceRandomSample ?? Math.random() < sampleRate;
  if (isSampled) {
    return {
      selected: true,
      reason: 'random_5pct',
      labelTier: 'D',
      reviewStatus: 'pending',
    };
  }

  // Confident unselected scan
  return {
    selected: false,
    reason: null,
    labelTier: 'D',
    reviewStatus: 'pending',
  };
}

/**
 * Evaluates upload gating:
 * - Image uploaded ONLY with image storage consent AND training opt-in.
 * - Must be selected by active learning.
 * - Must be under daily cap (unless bypassed by dev flag).
 */
export function evaluateUploadGating(input: UploadGatingInput): UploadGatingResult {
  if (!input.imageStorageConsent) {
    return { shouldUpload: false, reasonNotUploading: 'no_storage_consent' };
  }

  if (!input.trainingOptIn) {
    return { shouldUpload: false, reasonNotUploading: 'no_training_opt_in' };
  }

  if (!input.evaluation.selected) {
    return { shouldUpload: false, reasonNotUploading: 'not_selected' };
  }

  if (!input.bypassDailyCap && input.remainingDailyCap <= 0) {
    return { shouldUpload: false, reasonNotUploading: 'daily_cap_reached' };
  }

  return { shouldUpload: true };
}

