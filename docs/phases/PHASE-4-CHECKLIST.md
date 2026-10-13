# Phase 4 Checklist: ML baseline M0

## A. Manual work before testing

- [ ] One-time: confirm the source project is available at `C:\Projects\waste-app` and contains `assets\waste_model.tflite`, `assets\labels.json`, and `waste_detection_training.ipynb`.
- [ ] One-time: confirm permission/licence for `sumn2u/garbage-classification-v2-bbox-384`; record the immutable dataset version and licence in `ml/reports/m0/artifact_audit.json`.
- [ ] One-time: create separate Kaggle/Colab and Label Studio environments if reproducing training/annotation. Do not put credentials in the repository.
- [ ] Per-run: collect local golden and negatives sessions using `docs/DATASET_COLLECTION_GUIDE.md`; keep them out of `ml/data/` until consent/privacy review is complete.
- [ ] Per-run: use a reference Android phone for timing only after a runtime interpreter/build is available; do not substitute spike timings.

## B. Setup and run commands

Run from `C:\Projects\snappick` in PowerShell:

```powershell
conda run -n snappick python -m pip install -r ml/requirements-phase4.txt
New-Item -ItemType Directory -Force ml/artifacts/m0 | Out-Null
Copy-Item C:\Projects\waste-app\assets\waste_model.tflite ml/artifacts/m0/snappick_det_v0.tflite -Force
Copy-Item C:\Projects\waste-app\assets\labels.json ml/artifacts/m0/labels.json -Force
Copy-Item C:\Projects\waste-app\waste_detection_training.ipynb ml/artifacts/m0/waste_detection_training.ipynb -Force
conda run -n snappick python -m ml.src.inspect_tflite ml/artifacts/m0/snappick_det_v0.tflite --json ml/artifacts/m0/tensor_inspection.json
conda run -n snappick python -m unittest discover -s ml/tests -p "test_*.py"
conda run -n snappick python -m ml.src.smoke_test ml/artifacts/m0/snappick_det_v0.tflite ml/model_manifest.json --labels ml/artifacts/m0/labels.json
```

Automated tests present:

- `ml/tests/test_phase4_contract.py`: exact labels, manifest rules, tensor contract, parity tolerance, and session-level split isolation.
- `ml/src/inspect_tflite.py`: FlatBuffer tensor metadata inspection without TensorFlow.
- `ml/src/smoke_test.py`: SHA-256, manifest, input/output tensor, and label checks.
- `ml/src/parity.py`: numerical output comparison helper for the ten-image PyTorch/TFLite gate.

## C. Tests

1. Do run `conda run -n snappick python -m unittest discover -s ml/tests -p "test_*.py"` -> expect all contract/parity/split unit tests to pass.
2. Do run `conda run -n snappick python -m ml.src.inspect_tflite ml/artifacts/m0/snappick_det_v0.tflite` -> expect one float32 input `[1, 3, 384, 384]`, one float32 output `[1, 11, 3024]`, no quantization, and SHA-256 `ffb5240658fdffabbf27ee5de6a9cc33c27a20882467723a0f4771a41468dd7d`.
3. Do run the smoke command above -> expect `status: passed` for manifest, hash, input tensor, output tensor, and label order; runtime inference is reported separately until an interpreter is installed.
4. Do compare `ml/model_manifest.json` with `ml/reports/m0/tensor_inspection.json` -> expect matching shapes, dtypes, NCHW/attributes-first layout, and 384 centre-crop contract.
5. Do inspect `ml/reports/m0/artifact_audit.json` and `ml/reports/m0/dataset_audit.json` -> expect the seven labels in the exact fixed order and notebook recipe of YOLOv8n, 50 epochs, 384 image size, batch 16, patience 10, seed 42, with dataset licence/version and source counts explicitly marked unverified.
6. Do run the source notebook on Kaggle/Colab with a recorded dataset version -> expect temporary-source held-out metrics, per-class AP/recall, model hash, and exact package versions written into a new report; do not overwrite M0.
7. Do run PyTorch and TFLite on ten fixed licensed/owned reference images through the same centre-crop path -> expect the parity report to state the numeric tolerance and mAP gap; a missing checkpoint/interpreter is a failed-to-run item, not a pass.
8. Do evaluate a frozen local golden set and negatives set after collection -> expect separate golden metrics and false-positive rate; expect no golden image/session in training or threshold tuning.

## D. Regression

- [ ] Seven labels remain exactly `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological` in every manifest/config/report.
- [ ] M0 remains the initial champion and immutable bundled fallback; no candidate or downloaded model replaces it.
- [ ] M0 remains 384 x 384 float32 NCHW with centre-crop preprocessing and app-side raw YOLO decode/NMS.
- [ ] No Phase 5 scanner or review-sheet implementation is included in this phase.

## E. Known limitations

- Temporary dataset files, licence/version, original checkpoint, reference images, and local golden/negative sets are not present in this checkout.
- No TensorFlow/TFLite runtime is installed in the recorded environment, so structural FlatBuffer checks pass but invocation and expected detections remain unverified.
- Training metrics, PyTorch/TFLite parity, phone timings, memory, and end-to-end scan latency are intentionally `null`/unverified in `ml/reports/m0/metrics.json`.
- The preserved binary is ignored by Git and must be copied from the source project for a clean-machine run.

## F. Troubleshooting

- `FileNotFoundError` for the model -> copy the three source artifacts using section B and rerun inspection.
- `ModuleNotFoundError: tflite` -> run `conda run -n snappick python -m pip install -r ml/requirements-phase4.txt`.
- SHA-256 mismatch -> stop; recopy the original binary and do not edit the manifest to fit a different file.
- Tensor shape/dtype mismatch -> stop model activation, inspect the artifact, and create a new versioned candidate; never silently adjust the M0 manifest.
- No runtime interpreter/checkpoint/reference set -> record the item as unverified and do not claim parity or inference passed.

## G. Sign-off

```powershell
git add .
git commit -m "feat: phase 4 formalize M0 baseline"
git checkout main
git merge phase-4
git tag phase-4-done
git push --follow-tags
```

Update `docs/PROGRESS.md` only after the checklist is complete and the branch is merged.

### Assumptions and unverified items

- The owner-approved class meanings and exact label order are authoritative.
- The source notebook's owner-verified class order is accepted; its loader does not independently prove the upstream dataset's numeric class mapping.
- `tflite==2.10.0` FlatBuffer metadata is sufficient for structural inspection; runtime inference still needs TensorFlow Lite or `tflite-runtime`.
- The source dataset licence, immutable dataset revision, exact export dependency versions, reproducible metrics, parity, reference detections, and phone timings remain unverified.
