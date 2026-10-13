import type { Detection, ModelManifest, NormalizedBox } from './types';
import { clampBox, inverseBox, type Transform } from './preprocess';

export type RawDetection = NormalizedBox & { classId: number; score: number };

export function classifyConfidence(score: number, className: string, manifest: ModelManifest): 'confident' | 'uncertain' | 'hidden' {
  const threshold = manifest.thresholds.per_class[className] ?? manifest.thresholds.default;
  if (score < threshold.uncertain) return 'hidden';
  return score >= threshold.confident ? 'confident' : 'uncertain';
}

export function decodeYoloOutput(values: Float32Array, manifest: ModelManifest, transform?: Transform): RawDetection[] {
  const shape = manifest.output.shape;
  const attributes = manifest.output.layout === 'attributes_first' ? shape[1] : shape[2];
  const candidates = manifest.output.layout === 'attributes_first' ? shape[2] : shape[1];
  const expected = attributes * candidates;
  if (values.length < expected) throw new Error(`Model output buffer is too short: expected ${expected} float32 values, received ${values.length}.`);
  const get = (attribute: number, candidate: number) => manifest.output.layout === 'attributes_first' ? values[attribute * candidates + candidate] : values[candidate * attributes + attribute];
  const detections: RawDetection[] = [];
  for (let c = 0; c < candidates; c += 1) {
    const cx = get(0, c); const cy = get(1, c); const w = get(2, c); const h = get(3, c);
    let classId = 0; let score = get(4, c);
    for (let id = 1; id < manifest.labels.length; id += 1) {
      const candidate = get(4 + id, c);
      if (candidate > score) { score = candidate; classId = id; }
    }
    const box: NormalizedBox = manifest.output.box_units === 'normalised'
      ? { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 }
      : { x1: (cx - w / 2) / manifest.input.width, y1: (cy - h / 2) / manifest.input.height, x2: (cx + w / 2) / manifest.input.width, y2: (cy + h / 2) / manifest.input.height };
    const mapped = transform ? inverseBox(box, transform, manifest.input.width, manifest.input.height) : clampBox(box);
    if (Number.isFinite(score) && score > 0 && mapped.x2 > mapped.x1 && mapped.y2 > mapped.y1) detections.push({ ...mapped, classId, score });
  }
  return detections;
}

export function iou(a: NormalizedBox, b: NormalizedBox): number {
  const x1 = Math.max(a.x1, b.x1); const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2); const y2 = Math.min(a.y2, b.y2);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersection;
  return union <= 0 ? 0 : intersection / union;
}

export function classWiseNms(input: RawDetection[], iouThreshold: number, maxBoxes: number): RawDetection[] {
  const result: RawDetection[] = [];
  const classes = [...new Set(input.map((d) => d.classId))];
  for (const classId of classes) {
    let remaining = input.filter((d) => d.classId === classId).sort((a, b) => b.score - a.score);
    while (remaining.length) {
      const best = remaining.shift()!;
      result.push(best);
      remaining = remaining.filter((candidate) => iou(best, candidate) <= iouThreshold);
    }
  }
  return result.sort((a, b) => b.score - a.score).slice(0, maxBoxes);
}

export function toDetections(raw: RawDetection[], manifest: ModelManifest): Detection[] {
  return raw.flatMap((d) => {
    const confidence = classifyConfidence(d.score, manifest.labels[d.classId], manifest);
    return confidence === 'hidden' ? [] : [{ ...d, label: manifest.labels[d.classId], confidence }];
  });
}

