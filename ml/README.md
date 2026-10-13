# SnapPick ML

The current detector contract is the verified temporary smoke model: YOLOv8n float32 TFLite, 384 x 384 centre-crop preprocessing, and these labels in fixed order: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`. Do not remap or silently rename them.

Use [`docs/DATASET_COLLECTION_GUIDE.md`](../docs/DATASET_COLLECTION_GUIDE.md) for local photo collection and split/leakage rules. Use [`docs/MODEL_IMPROVEMENT_GUIDE.md`](../docs/MODEL_IMPROVEMENT_GUIDE.md) for candidate training, golden-set evaluation, promotion gates, and fallback behavior. The exact bundled M0 model remains immutable; a candidate never overwrites it.

Phase 4 freezes the source artifact audit in [`model_manifest.json`](model_manifest.json) and
[`reports/m0/`](reports/m0/). The exact binary, labels file, and source notebook are preserved
locally under `ml/artifacts/m0/` (ignored by Git because the binary is large and its licence has
not been verified). Copy them from `C:\Projects\waste-app` before rerunning the audit.

From the repository root, run the audit and tests with:

```powershell
conda run -n snappick python -m unittest discover -s ml/tests -p "test_*.py"
conda run -n snappick python -m ml.src.inspect_tflite ml/artifacts/m0/snappick_det_v0.tflite --json ml/artifacts/m0/tensor_inspection.json
conda run -n snappick python -m ml.src.smoke_test ml/artifacts/m0/snappick_det_v0.tflite ml/model_manifest.json --labels ml/artifacts/m0/labels.json
```

The smoke command verifies the manifest, SHA-256, tensor shapes/dtypes, and label contract. It
does not claim runtime inference, PyTorch/TFLite parity, or metrics unless a TFLite interpreter,
checkpoint, reference images, and held-out datasets are supplied.

Local datasets and photos belong under `ml/data/`, which is ignored by Git. Keep dataset manifests
privacy-safe: no user IDs, addresses, exact coordinates, pickup notes, or other identifying metadata.
