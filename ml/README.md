# SnapPick ML

Detector training for SnapPick. The only training code is the Kaggle notebook [`notebooks/kaggle_waste_detector_retraining.ipynb`](notebooks/kaggle_waste_detector_retraining.ipynb). The admin dashboard's **Retrain** button pushes it to Kaggle and starts a GPU run.

- Collecting and labelling your own photos: [../docs/DATASET_COLLECTION.md](../docs/DATASET_COLLECTION.md)
- How the whole flow works: [../docs/MODEL_LIFECYCLE.md](../docs/MODEL_LIFECYCLE.md)
- One-time Kaggle setup (credentials and secrets): [../docs/KAGGLE_SETUP.md](../docs/KAGGLE_SETUP.md)

## Folder layout

```text
ml/
  README.md
  notebooks/
    kaggle_waste_detector_retraining.ipynb   tracked in Git; the admin app reads this exact path
  baseline-v0/                               local only, ignored by Git
  data/                                      local only, ignored by Git (your own datasets and photos)
```

`baseline-v0/` holds the original source files of the bundled baseline model (the first, verified "milestone 0" model, version `v0`): its `.tflite` file, `labels.json`, `tensor_inspection.json` (the recorded tensor shapes) and the notebook it was trained with. The `.tflite` file is byte-identical to `apps/mobile/assets/models/waste_detector_v0.tflite`, which is the copy the app actually uses and which is never overwritten. The folder is ignored by Git because the training notebook is large and its licence has not been verified.

Keep anything under `data/` free of user IDs, addresses and exact coordinates.

## Model contract

YOLOv8n exported to float32 TFLite, 384 × 384 centre-crop input (`[1, 3, 384, 384]`), raw output `[1, 11, 3024]`. Labels in fixed order: `metal, trash, glass, paper, cardboard, plastic, biological`. The phone reads all of this from `apps/mobile/assets/models/model_manifest.json` and checks it against the loaded model, so a new model must keep the same contract.
