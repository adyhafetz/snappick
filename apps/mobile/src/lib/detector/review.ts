import type { Detection, Condition } from './types';

export type ReviewRecord = { id: string; detection?: Detection; label: string; condition: Condition; removed: boolean; source: 'detector' | 'user_added' };

export function createReviewRows(detections: Detection[]): ReviewRecord[] {
  return detections.map((detection, index) => ({ id: `detection-${index}`, detection, label: detection.label, condition: 'clean_dry', removed: false, source: 'detector' }));
}

