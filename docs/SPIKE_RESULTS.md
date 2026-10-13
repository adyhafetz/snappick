# SnapPick Smoke/Spike Results

This file records only evidence currently available from the working `C:\Projects\waste-app` smoke app and its notebook/artifacts. Do not copy tensor shapes or performance numbers from a different COCO/640 spike into the SnapPick model contract. Phase 4 must replace every `unverified` entry with inspected or measured evidence.

## Verified behavior

| Check | Result | Evidence/limit |
|---|---|---|
| Android development app | Pass | Owner reports the smoke app works on the target phone |
| TFLite model load | Pass | `react-native-fast-tflite` loads `assets/waste_model.tflite` |
| On-device detection and boxes | Pass | Smoke app captures a photo and displays detections/boxes |
| Multi-object output | Pass | Owner visually verified model labels/results in the smoke app |
| Detector labels/order | Pass | `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological` |
| Input/export size | Verified from notebook/app code | 384 x 384 |
| Input dtype/normalization | Verified from notebook/app code | float32, RGB scaled to 0..1 |
| Inference image transform | Verified from notebook/app code | Centre square crop, then resize to 384 x 384 |
| Post-processing | Verified from app code | Raw YOLO decode plus class-wise NMS in TypeScript |
| Native development build required | Verified from dependencies/README | Not Expo Go |

## Temporary training recipe found in the notebook

- Source: Kaggle dataset `sumn2u/garbage-classification-v2-bbox-384`.
- Class order: the seven labels above, visually verified by the owner.
- Base weights: `yolov8n.pt`.
- Training: 50 epochs, `imgsz=384`, batch 16, patience 10.
- Split: notebook-created random 80/20 train/validation split with seed 42.
- Export: Ultralytics float32 TFLite at 384 x 384.
- Output artifacts: `waste_model.tflite` and `labels.json`.

This dataset/model is temporary. It proves the SnapPick scan and learning lifecycle while local development and golden data are collected. It is not presented as the final local research model.

## Unverified facts to capture in Phase 4

- exact SHA-256 of the frozen bundled fallback copied into SnapPick;
- exact Ultralytics, TensorFlow/TFLite, Python, and export dependency versions used for the shipped artifact;
- exact input tensor shape/layout reported by a TFLite interpreter;
- exact output tensor shape/layout, units, and quantization metadata;
- reproducible training/validation metrics and per-class results;
- source dataset licence and immutable download/version identifier;
- model size as registered by SnapPick;
- preprocessing, inference, decode/NMS, memory, and end-to-end timings on the reference phone;
- expected detections/tolerances for the bundled smoke-test images.

The notebook/app code expects normalized raw YOLO output and handles channel layout dynamically, but code expectations are not a substitute for inspecting the actual `.tflite` artifact.

## Current package evidence from `waste-app/package.json`

| Package | Recorded smoke-app declaration |
|---|---|
| Expo | `~57.0.27` |
| React Native | `0.86.3` |
| React | `19.2.3` |
| react-native-fast-tflite | `^3.0.1` (record the exact installed version before reuse) |
| react-native-nitro-modules | `^0.37.1` (record the exact installed version before reuse) |
| expo-image-manipulator | `~57.0.21` |
| jpeg-js | `^0.4.4` |
| base64-js | `^1.5.1` |

Caret/tilde declarations are not exact installed versions. Phase 5 must record `npm ls` output in `docs/ENVIRONMENT.md` after installation.

## Decisions carried into SnapPick

1. Preserve the seven labels and exact order; do not remap.
2. Keep the working 384 x 384 centre-crop M0 unchanged as the immutable bundled fallback.
3. Put input size, transform, tensor contract, NMS, thresholds, labels, and hash in `model_manifest.json`; validate them against the loaded artifact.
4. Treat 384 letterbox and 640 letterbox only as later candidates/experiments.
5. Compare candidates with M0 on the same frozen local golden and negatives sets.
6. Never claim an unmeasured timing or tensor detail as passed.

## Assumptions

- The owner's report that the smoke app works and that the seven class meanings were visually verified is accepted as manual verification.
- No local interpreter inspection or timing benchmark was run during the documentation revision.
- Dataset licensing remains an open Phase 4 verification item.
