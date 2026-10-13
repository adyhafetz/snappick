import type { ModelManifest, TensorInfo } from './types';

export const DETECTOR_LABELS = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];

export function parseManifest(value: unknown): ModelManifest {
  if (!value || typeof value !== 'object') throw new Error('Model manifest is not a JSON object.');
  const m = value as Partial<ModelManifest>;
  const errors: string[] = [];
  if (typeof m.version !== 'string') errors.push('version is missing');
  if (!m.input || ![m.input.width, m.input.height].every((n) => Number.isInteger(n) && n > 0)) errors.push('input width/height must be positive integers');
  if (!m.input || !['NCHW', 'NHWC'].includes(m.input.layout ?? '')) errors.push('input.layout must be NCHW or NHWC');
  if (!m.input || !['centre_crop', 'letterbox'].includes(m.input.resize ?? '')) errors.push('input.resize must be centre_crop or letterbox');
  if (!m.input || m.input.dtype !== 'float32' || m.input.normalize !== '0-1') errors.push('input dtype/normalization must be float32 and 0-1');
  if (!m.output || m.output.format !== 'yolo_raw') errors.push('output.format must be yolo_raw');
  if (!m.output || !Array.isArray(m.output.shape) || m.output.shape.some((n) => !Number.isInteger(n) || n <= 0)) errors.push('output.shape must contain positive integers');
  if (!m.output || !['attributes_first', 'candidates_first'].includes(m.output.layout ?? '')) errors.push('output.layout is invalid');
  if (!m.output || m.output.box_format !== 'cx,cy,w,h') errors.push('output.box_format must be cx,cy,w,h');
  if (!m.output || !['normalised', 'pixels'].includes(m.output.box_units ?? '')) errors.push('output.box_units is invalid');
  if (!m.output || typeof m.output.postprocess_in_model !== 'boolean') errors.push('output.postprocess_in_model must be boolean');
  if (!m.labels || m.labels.length === 0 || m.labels.some((x) => typeof x !== 'string')) errors.push('labels must be a non-empty string array');
  if (!m.labels || m.labels.join('|') !== DETECTOR_LABELS.join('|')) errors.push(`labels must be exactly ${DETECTOR_LABELS.join(', ')}`);
  const validThreshold = (value?: { confident: number; uncertain: number }) => !!value && Number.isFinite(value.confident) && Number.isFinite(value.uncertain) && value.confident <= 1 && value.uncertain >= 0 && value.confident > value.uncertain;
  if (!validThreshold(m.thresholds?.default)) errors.push('thresholds.default must have 0 <= uncertain < confident <= 1');
  if (m.thresholds?.per_class && Object.entries(m.thresholds.per_class).some(([label, value]) => !m.labels?.includes(label) || !validThreshold(value))) errors.push('thresholds.per_class entries must use manifest labels and satisfy 0 <= uncertain < confident <= 1');
  if (!m.nms || !(m.nms.iou > 0 && m.nms.iou <= 1) || !Number.isInteger(m.nms.max_boxes) || m.nms.max_boxes <= 0) errors.push('nms must have iou in (0, 1] and a positive max_boxes');
  if (m.output?.shape?.length === 3 && m.labels?.length) {
    const attributeCount = m.output.layout === 'attributes_first' ? m.output.shape[1] : m.output.shape[2];
    if (attributeCount !== m.labels.length + 4) errors.push(`output attributes must equal 4 box values plus ${m.labels.length} label scores`);
  }
  if (errors.length) throw new Error(`Invalid model manifest: ${errors.join('; ')}.`);
  return value as ModelManifest;
}

export function validateManifestAgainstTensors(manifest: ModelManifest, input: TensorInfo, output: TensorInfo): void {
  const expectedInput = manifest.input.layout === 'NCHW'
    ? [1, 3, manifest.input.height, manifest.input.width]
    : [1, manifest.input.height, manifest.input.width, 3];
  const shape = (v: number[]) => `[${v.join(', ')}]`;
  if (input.dataType !== manifest.input.dtype) throw new Error(`Model input dtype mismatch: manifest expects ${manifest.input.dtype}, loaded tensor is ${input.dataType}.`);
  if (shape(input.shape) !== shape(expectedInput)) throw new Error(`Model input shape mismatch: manifest expects ${shape(expectedInput)} for ${manifest.input.layout}, loaded tensor is ${shape(input.shape)}.`);
  if (shape(output.shape) !== shape(manifest.output.shape)) throw new Error(`Model output shape mismatch: manifest expects ${shape(manifest.output.shape)}, loaded tensor is ${shape(output.shape)}.`);
  if (output.dataType !== manifest.input.dtype) throw new Error(`Model output dtype mismatch: manifest expects float32 output, loaded tensor is ${output.dataType}.`);
}

