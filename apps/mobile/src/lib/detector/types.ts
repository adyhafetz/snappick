export type InputLayout = 'NCHW' | 'NHWC';
export type ResizeMode = 'centre_crop' | 'letterbox';
export type OutputLayout = 'attributes_first' | 'candidates_first';
export type BoxUnits = 'normalised' | 'pixels';

export type ModelManifest = {
  version: string;
  file: string;
  sha256: string;
  framework: { name: string; version: string };
  role: 'bundled_fallback' | string;
  input: {
    width: number;
    height: number;
    layout: InputLayout;
    dtype: 'float32';
    normalize: '0-1';
    resize: ResizeMode;
  };
  output: {
    format: 'yolo_raw';
    shape: number[];
    layout: OutputLayout;
    box_format: 'cx,cy,w,h';
    box_units: BoxUnits;
    postprocess_in_model: boolean;
  };
  nms: { iou: number; max_boxes: number };
  labels: string[];
  thresholds: {
    default: { confident: number; uncertain: number };
    per_class: Record<string, { confident: number; uncertain: number }>;
  };
  min_app_version: string;
  dataset_version: string;
  metrics: Record<string, unknown>;
};

export type TensorInfo = { shape: number[]; dataType: string; name?: string };

export type NormalizedBox = { x1: number; y1: number; x2: number; y2: number };
export type Detection = NormalizedBox & {
  label: string;
  classId: number;
  score: number;
  confidence: 'confident' | 'uncertain';
};

export type Condition = 'clean_dry' | 'contaminated_wet' | 'broken_unsafe' | 'unknown';
export type Eligibility = 'eligible' | 'needs_confirmation' | 'not_eligible' | 'restricted';
export type RuleDecision = { eligibility: Eligibility; reason: string };

