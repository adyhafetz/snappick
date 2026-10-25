import { describe, expect, it } from 'vitest';
import manifestJson from '../../../assets/models/model_manifest.json';
import { parseManifest, validateManifestAgainstTensors } from './manifest';
import { createInputTensor, createTransform, inputLayoutFromShape, inverseBox, type RgbaImage } from './preprocess';
import { classWiseNms, classifyConfidence, decodeYoloOutput } from './postprocess';
import { evaluateEligibility } from './rules';
import { materialPresentation, pickupDecision } from './presentation';
import { createReviewRows } from './review';

const manifest = parseManifest(manifestJson);
describe('preprocessing transforms', () => {
  it('centre-crops and maps a box back into original image coordinates', () => {
    const transform = createTransform(4, 2, 'centre_crop', 2, 2);
    expect(transform.cropX).toBe(1);
    expect(inverseBox({ x1: 0, y1: 0, x2: 1, y2: 1 }, transform, 2, 2)).toEqual({ x1: 0.25, y1: 0, x2: 0.75, y2: 1 });
    const wide: RgbaImage = { width: 4, height: 2, data: new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255, 0,255,255,255, 255,0,255,255, 0,0,0,255, 255,255,255,255]) };
    const cropped = createInputTensor(wide, { ...manifest, input: { ...manifest.input, width: 2, height: 2 } });
    expect([...new Float32Array(cropped.buffer).slice(4, 8)]).toEqual([1, 0, 0, 0]);
  });
  it('letterboxes and maps a box back into original image coordinates', () => {
    const transform = createTransform(4, 2, 'letterbox', 4, 4);
    expect(transform.padY).toBe(1);
    expect(inverseBox({ x1: 0, y1: 0.25, x2: 1, y2: 0.75 }, transform, 4, 4)).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
    const letterboxed = createInputTensor(imageWide(), { ...manifest, input: { ...manifest.input, width: 4, height: 4, resize: 'letterbox' } });
    const values = new Float32Array(letterboxed.buffer);
    expect(values[0]).toBeCloseTo(0.5);
    expect(values[4]).not.toBeCloseTo(0.5);
  });
  it('lays out RGB channels as NCHW and NHWC', () => {
    const square: RgbaImage = { width: 2, height: 2, data: new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]) };
    const base = { ...manifest, input: { ...manifest.input, width: 2, height: 2 } };
    const nchw = createInputTensor(square, { ...base, input: { ...base.input, layout: 'NCHW', resize: 'centre_crop' } });
    const nhwc = createInputTensor(square, { ...base, input: { ...base.input, layout: 'NHWC', resize: 'centre_crop' } });
    expect([...new Float32Array(nchw.buffer).slice(0, 4)]).toHaveLength(4);
    expect([...new Float32Array(nhwc.buffer).slice(0, 3)]).toEqual([1, 0, 0]);
    expect(new Float32Array(nchw.buffer)[0]).toBe(1);
    expect(new Float32Array(nchw.buffer)[4]).toBe(0);
    expect(new Float32Array(nchw.buffer)[8]).toBe(0);
    expect(inputLayoutFromShape([1, 3, 384, 384])).toBe('NCHW');
    expect(inputLayoutFromShape([1, 384, 384, 3])).toBe('NHWC');
  });
});

function imageWide(): RgbaImage {
  return { width: 4, height: 2, data: new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255, 0,255,255,255, 255,0,255,255, 0,0,0,255, 255,255,255,255]) };
}

describe('YOLO manifest contract', () => {
  it('decodes attributes-first raw output from manifest shape/layout', () => {
    const compact = { ...manifest, input: { ...manifest.input, width: 10, height: 10 }, output: { ...manifest.output, shape: [1, 11, 1] } };
    const values = new Float32Array([0.5, 0.5, 0.4, 0.4, 0.05, 0.1, 0.8, 0.02, 0.01, 0.01, 0.01]);
    const [decoded] = decodeYoloOutput(values, compact);
    expect(decoded?.classId).toBe(2);
    expect(decoded?.score).toBeCloseTo(0.8);
    expect(decoded?.x1).toBeCloseTo(0.3);
    expect(decoded?.y1).toBeCloseTo(0.3);
    expect(decoded?.x2).toBeCloseTo(0.7);
    expect(decoded?.y2).toBeCloseTo(0.7);
  });
  it('suppresses overlaps per class but preserves another class', () => {
    const boxes = [
      { x1: 0, y1: 0, x2: 0.5, y2: 0.5, classId: 0, score: 0.9 },
      { x1: 0.05, y1: 0.05, x2: 0.45, y2: 0.45, classId: 0, score: 0.8 },
      { x1: 0, y1: 0, x2: 0.5, y2: 0.5, classId: 1, score: 0.7 },
    ];
    expect(classWiseNms(boxes, 0.5, 30)).toHaveLength(2);
  });
  it('classifies confidence with thresholds from the manifest', () => {
    expect(classifyConfidence(0.2, 'metal', manifest)).toBe('hidden');
    expect(classifyConfidence(0.6, 'metal', manifest)).toBe('uncertain');
    expect(classifyConfidence(0.9, 'metal', manifest)).toBe('confident');
    const overridden = { ...manifest, thresholds: { ...manifest.thresholds, per_class: { metal: { confident: 0.95, uncertain: 0.3 } } } };
    expect(classifyConfidence(0.9, 'metal', overridden)).toBe('uncertain');
  });
  it('reports readable manifest/tensor mismatch details', () => {
    expect(() => validateManifestAgainstTensors(manifest, { shape: [1, 384, 384, 3], dataType: 'float32' }, { shape: [1, 11, 3024], dataType: 'float32' })).toThrow(/input shape mismatch.*\[1, 3, 384, 384\].*\[1, 384, 384, 3\]/i);
  });
});

describe('rules and review rows', () => {
  it('removes wet and broken conditional materials from eligibility', () => {
    expect(evaluateEligibility('plastic', 'clean_dry').eligibility).toBe('eligible');
    expect(evaluateEligibility('plastic', 'contaminated_wet').eligibility).toBe('not_eligible');
    expect(evaluateEligibility('glass', 'broken_unsafe').eligibility).toBe('restricted');
    expect(evaluateEligibility('paper', 'unknown').eligibility).toBe('needs_confirmation');
  });
  it('creates exactly one review row for each detected box', () => {
    const rowDetections = [0, 1, 2].map((n) => ({ x1: 0, y1: 0, x2: 1, y2: 1, label: `label${n}`, classId: n, score: 0.9, confidence: 'confident' as const }));
    const rows = createReviewRows(rowDetections);
    expect(rows).toHaveLength(rowDetections.length);
    expect(rows.every((row) => row.detection)).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
  });
  it('keeps material color separate from condition eligibility', () => {
    const wetPlastic = materialPresentation('plastic', false, false);
    expect(wetPlastic.classification).toBe('recyclable');
    expect(wetPlastic.color).toBe('#15803d');
    expect(pickupDecision('plastic', 'contaminated_wet', false, false)).toMatchObject({ eligibility: 'not_eligible' });
    expect(materialPresentation('trash', false, false)).toMatchObject({ classification: 'not_recyclable', color: '#b42318' });
    expect(materialPresentation('plastic', true, false)).toMatchObject({ classification: 'unsure', color: '#64748b' });
    expect(pickupDecision('plastic', 'clean_dry', true, false).eligibility).toBe('needs_confirmation');
    expect(pickupDecision('plastic', 'clean_dry', true, true).eligibility).toBe('eligible');
  });
});

