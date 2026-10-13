# SnapPick ML

The current detector contract is the verified temporary smoke model: YOLOv8n float32 TFLite, 384 x 384 centre-crop preprocessing, and these labels in fixed order: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`. Do not remap or silently rename them.

Use [`docs/DATASET_COLLECTION_GUIDE.md`](../docs/DATASET_COLLECTION_GUIDE.md) for local photo collection and split/leakage rules. Use [`docs/MODEL_IMPROVEMENT_GUIDE.md`](../docs/MODEL_IMPROVEMENT_GUIDE.md) for candidate training, golden-set evaluation, promotion gates, and fallback behavior. The exact bundled M0 model remains immutable; a candidate never overwrites it.

The training and evaluation pipeline is implemented in later phases. Local datasets and photos belong under `ml/data/`, which is ignored by Git. Keep dataset manifests privacy-safe: no user IDs, addresses, exact coordinates, pickup notes, or other identifying metadata.
