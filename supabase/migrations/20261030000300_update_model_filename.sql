-- Migration 20261030000300: Update bundled fallback model filename in model_versions

update public.model_versions
set
  storage_path = 'models/v0/waste_detector_v0.tflite',
  manifest = jsonb_set(manifest, '{file}', '"waste_detector_v0.tflite"')
where version = 'v0';

