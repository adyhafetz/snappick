import { describe, expect, it } from 'vitest';
import {
  classifyScanActiveLearning,
  evaluateUploadGating,
  type DetectionInput,
} from './active-learning';

describe('Active Learning Classifier', () => {
  it('selects scans with uncertain detections in [0.40, 0.79] as Tier D', () => {
    const detections: DetectionInput[] = [
      { score: 0.65, originalLabel: 'plastic', currentLabel: 'plastic' },
    ];
    const result = classifyScanActiveLearning(detections);
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('uncertain');
    expect(result.labelTier).toBe('D');
    expect(result.reviewStatus).toBe('pending');
  });

  it('selects scans with boundary uncertain score 0.40', () => {
    const detections: DetectionInput[] = [
      { score: 0.4, originalLabel: 'metal', currentLabel: 'metal' },
    ];
    const result = classifyScanActiveLearning(detections);
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('uncertain');
  });

  it('selects scans with boundary uncertain score 0.79', () => {
    const detections: DetectionInput[] = [
      { score: 0.79, originalLabel: 'glass', currentLabel: 'glass' },
    ];
    const result = classifyScanActiveLearning(detections);
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('uncertain');
  });

  it('selects scans with user-changed labels as Tier C (corrected)', () => {
    const detections: DetectionInput[] = [
      {
        score: 0.92,
        originalLabel: 'plastic',
        currentLabel: 'glass', // corrected
      },
    ];
    const result = classifyScanActiveLearning(detections);
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('corrected');
    expect(result.labelTier).toBe('C');
  });

  it('selects scans with user-removed detector boxes as Tier C (corrected)', () => {
    const detections: DetectionInput[] = [
      {
        score: 0.88,
        originalLabel: 'cardboard',
        currentLabel: 'cardboard',
        removed: true,
      },
    ];
    const result = classifyScanActiveLearning(detections);
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('corrected');
    expect(result.labelTier).toBe('C');
  });

  it('does not treat user_added items as corrections', () => {
    const detections: DetectionInput[] = [
      {
        score: 0.95,
        originalLabel: 'metal',
        currentLabel: 'metal',
        source: 'user_added',
      },
    ];
    // With forceRandomSample: false
    const result = classifyScanActiveLearning(detections, { forceRandomSample: false });
    expect(result.selected).toBe(false);
    expect(result.labelTier).toBe('D');
  });

  it('selects confident scans when forceRandomSample dev flag is enabled', () => {
    const detections: DetectionInput[] = [
      { score: 0.95, originalLabel: 'paper', currentLabel: 'paper' },
    ];
    const result = classifyScanActiveLearning(detections, { forceRandomSample: true });
    expect(result.selected).toBe(true);
    expect(result.reason).toBe('random_5pct');
    expect(result.labelTier).toBe('D');
  });

  it('does not select confident scans when forceRandomSample dev flag is disabled', () => {
    const detections: DetectionInput[] = [
      { score: 0.95, originalLabel: 'paper', currentLabel: 'paper' },
    ];
    const result = classifyScanActiveLearning(detections, { forceRandomSample: false });
    expect(result.selected).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.labelTier).toBe('D');
  });

  it('samples approximately 5% of confident scans over 2,000 simulated scans', () => {
    const runs = 2000;
    let selectedCount = 0;
    const confidentDetections: DetectionInput[] = [
      { score: 0.92, originalLabel: 'cardboard', currentLabel: 'cardboard' },
    ];

    for (let i = 0; i < runs; i++) {
      const evaluation = classifyScanActiveLearning(confidentDetections);
      if (evaluation.selected) {
        selectedCount++;
        expect(evaluation.reason).toBe('random_5pct');
        expect(evaluation.labelTier).toBe('D');
      }
    }

    const rate = selectedCount / runs;
    // 5% rate with reasonable binomial distribution tolerance [3%, 7.5%]
    expect(rate).toBeGreaterThanOrEqual(0.03);
    expect(rate).toBeLessThanOrEqual(0.075);
  });
});

describe('Upload Gating Evaluation', () => {
  const selectedEval = {
    selected: true,
    reason: 'uncertain' as const,
    labelTier: 'D' as const,
    reviewStatus: 'pending' as const,
  };

  const unselectedEval = {
    selected: false,
    reason: null,
    labelTier: 'D' as const,
    reviewStatus: 'pending' as const,
  };

  it('blocks upload if image_storage_consent is false', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: false,
      trainingOptIn: true,
      evaluation: selectedEval,
      remainingDailyCap: 10,
    });
    expect(result.shouldUpload).toBe(false);
    expect(result.reasonNotUploading).toBe('no_storage_consent');
  });

  it('blocks upload if training_opt_in is false (opted-out user)', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: true,
      trainingOptIn: false,
      evaluation: selectedEval,
      remainingDailyCap: 10,
    });
    expect(result.shouldUpload).toBe(false);
    expect(result.reasonNotUploading).toBe('no_training_opt_in');
  });

  it('blocks upload if scan was not selected by active learning', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: true,
      trainingOptIn: true,
      evaluation: unselectedEval,
      remainingDailyCap: 10,
    });
    expect(result.shouldUpload).toBe(false);
    expect(result.reasonNotUploading).toBe('not_selected');
  });

  it('blocks upload if daily cap is reached (0 remaining)', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: true,
      trainingOptIn: true,
      evaluation: selectedEval,
      remainingDailyCap: 0,
    });
    expect(result.shouldUpload).toBe(false);
    expect(result.reasonNotUploading).toBe('daily_cap_reached');
  });

  it('allows upload when daily cap is bypassed via dev flag', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: true,
      trainingOptIn: true,
      evaluation: selectedEval,
      remainingDailyCap: 0,
      bypassDailyCap: true,
    });
    expect(result.shouldUpload).toBe(true);
  });

  it('allows upload when consented, opted-in, selected, and under cap', () => {
    const result = evaluateUploadGating({
      imageStorageConsent: true,
      trainingOptIn: true,
      evaluation: selectedEval,
      remainingDailyCap: 5,
    });
    expect(result.shouldUpload).toBe(true);
  });
});

