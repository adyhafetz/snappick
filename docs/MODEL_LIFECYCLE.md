# Model lifecycle

How the waste detector improves over time. The flow is deliberately simple: **gather images → review them → retrain → the admin decides whether to use the new model → phones update.**

```
Users scan waste ──► consented, verified images ──► admin reviews label edits
                                                          │
                                           Retrain button (Dataset page)
                                                          ▼
                                     Kaggle GPU notebook trains a new model
                                                          ▼
                              new version appears on the Models page (not live)
                                                          ▼
                       admin compares it and presses Use (or deletes it)
                                                          ▼
                            phones are offered the update and switch
```

## 1. Gathering images

A scan image reaches the training pool only when all of these are true:

- the user turned on **Photo Backup** (`image_storage_consent`) **and** **AI Model Training** (`training_opt_in`) in Profile;
- the scan was selected for upload (low-confidence detections, user corrections and a small random sample are preferred, with a daily cap per user);
- the photo reached storage (offline scans are saved and uploaded when the phone is back online).

Photos are downsized to 800 px and stripped of EXIF/GPS before upload. Exact locations, names and addresses are never part of training data.

## 2. Reviewing

On the admin **Dataset** page, the **Review** tab lists scans where a user removed a detection or changed its label. The admin chooses:

| Edit | Actions |
|---|---|
| Label changed by the user | **Confirm** (optionally pick a different material first) or **Discard** (the user was wrong). |
| Item removed by the user | **Keep removed** (the box is dropped from training) or pick a material and **Restore as…**. **Discard** ignores the removal. |

Scans stay out of training until their edits are reviewed. The progress card shows how many verified images exist and how many are **new since the latest model**, which tells the admin when retraining is worthwhile. Retrain is allowed at any time, even with few community images.

## 3. Retraining

Press **Retrain** on the Dataset page. The admin app pushes `ml/notebooks/kaggle_waste_detector_retraining.ipynb` to one fixed Kaggle notebook and starts a GPU run (one-time setup: [KAGGLE_SETUP.md](./KAGGLE_SETUP.md)). The dialog shows a timer and the run state: queued, training, done or failed. Training usually takes 30 to 60 minutes.

The notebook:

1. reads the verified community scans and detections from Supabase (service-role secret kept in Kaggle);
2. applies the review: removed items are dropped, corrected labels replace the model's label;
3. combines them with the public base dataset `sumn2u/garbage-classification-v2-bbox-384` (community images go to training; once there are 25 or more, one in five is held out for validation);
4. fine-tunes YOLOv8n for 25 epochs at 384 × 384;
5. exports float32 TFLite (`[1, 3, 384, 384]` input, `[1, 11, 3024]` output, labels in the fixed order);
6. uploads it to the `models` bucket and registers the next version (`v1`, `v2`, …) as a **candidate at 0% rollout**, recording its accuracy (mAP50), the number of community and base images, the epochs and the training time.

## 4. Deciding

On the **Models** page every version shows its exact accuracy, the difference from the live model ("+0.00 pts vs live"), the number of community images, size and date.

- **Use** makes a version live for everyone (the current live model becomes archived). A model below 65% mAP shows a warning and the button reads "Go live anyway".
- **Delete** (trash icon) removes a rejected version and its file. The live model and the built-in `v0` cannot be deleted.
- **Reset to base model** (round arrow on the live card) makes the built-in `v0` live again.
- **Upload** registers a `.tflite` file trained elsewhere (it must be a real TensorFlow Lite file and a new `vN` version).

Any earlier version can be made live again with **Use**, which is the rollback path. All of these actions are written to `audit_log`.

## 5. Phones update

The bundled `v0` model is never overwritten. When a phone opens Home it checks (at most every 6 hours) whether a newer model is live and asks "Better detector available. Update now?". "Later" is remembered for 24 hours. Users can also go to **Profile → Check for Detector Update**. The phone downloads the model once into its own storage, checks it against the SHA-256 registered for that version (a mismatch is deleted and the current detector stays), then stores which version is active, so it works offline and never depends on a link that expires. Switching versions takes effect on the next scan. If a downloaded model cannot be loaded, or fails while scanning, the app falls back to the bundled `v0` (and retries that scan with it).

## Model contract

Everything about the model comes from `apps/mobile/assets/models/model_manifest.json` (labels, input size and layout, output format, NMS and thresholds) and is checked against the loaded model's tensor shapes. Do not hard-code these values. The labels, in fixed order, are `metal, trash, glass, paper, cardboard, plastic, biological`; they are plain text, not database enums.

## Known limits

- There is no automatic quality gate or held-out community test set. The accuracy shown comes from the notebook's validation split of the base dataset, so judge a new model with real photos before pressing Use.
- A newly trained model is not necessarily better. Check the difference from the live model and the number of community images.
