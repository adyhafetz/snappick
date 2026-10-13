# SnapPick Model Improvement Guide

Use this guide after the temporary M0 model is integrated and you have collected local data. It defines how to train a candidate, prove whether it is better, promote it safely, and recover if it fails. It does not authorize changing the label taxonomy.

Related documents:

- `docs/DATASET_COLLECTION_GUIDE.md` — what and how to photograph.
- `docs/SNAPPICK_PLAN.md` — research design and release gate.
- `docs/SNAPPICK_BUILD_GUIDE.md` — implementation phases and shared contracts.
- `docs/ENVIRONMENT.md` — installed/pinned versions.

## 1. Fixed contract

All candidates keep these detector labels in this exact order:

```text
0 metal
1 trash
2 glass
3 paper
4 cardboard
5 plastic
6 biological
```

Do not rename, merge, split, alphabetize, or remap the labels. A future taxonomy change is a separate breaking project requiring data migration, rule updates, new golden annotations, app compatibility work, and explicit approval.

M0 is the working `waste-app` YOLOv8n float32 TFLite model trained at 384 x 384 and run with centre-crop preprocessing. Treat it as all three of the following at project start:

- **baseline:** the result later candidates must be compared against;
- **initial champion:** the approved model in use;
- **bundled fallback:** an immutable APK asset that a download can never overwrite.

The **golden evaluation set** is not a model. It is a frozen, versioned dataset used only to compare models. Never train on it.

## 2. Required baseline freeze

Before training a local candidate, preserve and record M0:

- original `.tflite`, `labels.json`, and training notebook;
- SHA-256 for every artifact;
- source dataset identifier, licence, download date/version if available, and known limitations;
- exact Ultralytics/Python/export package versions where reproducible;
- training parameters: weights, epochs, image size, batch, patience, and random seed;
- actual TFLite input/output tensor shapes, layouts, dtypes, quantization, and units read from the artifact;
- manifest, metrics, model size, phone model, and measured stage timings;
- a small set of licensed/owned reference images and expected output tolerances for smoke tests.

Do not invent missing facts. Mark them `unverified` and reproduce the run if needed. Keep large artifacts outside git; commit scripts, small metadata, manifests, configs, hashes, and reports.

## 3. Model and data states

Use these terms consistently:

| Term | Meaning | May be replaced automatically? |
|---|---|---|
| Bundled fallback | Exact M0 shipped inside the APK | No |
| Champion | Currently approved model used for comparison and rollout | Only after a candidate passes and is approved |
| Candidate | Newly trained model under evaluation | Not active by default |
| Rejected | Candidate that failed one or more gates | No |
| Rolled back | Previously activated model withdrawn from use | No |
| Golden set | Frozen evaluation images/annotations | Never trained on |

Recommended model status flow:

```text
candidate -> approved -> rolling_out -> stable
        \-> rejected
stable/rolling_out -> rolled_back
```

Admin approval remains required even when every automated gate passes.

## 4. Dataset preparation

Build a new immutable dataset version for every run. Its manifest should contain only privacy-safe fields:

- dataset version and manifest hash;
- random sample ID and anonymous capture-session ID;
- split (`train`, `validation`, `golden`, or `negatives`);
- annotation/review tier;
- source and licence/consent basis;
- image hash and perceptual hash;
- image width/height and annotation boxes/classes;
- per-class/per-tier counts and source mix;
- preprocessing/compression version.

Never include user ID, name, address, exact coordinates, pickup notes, account identifiers, or original storage paths that expose identity.

### Leakage controls

- Assign the split at the **session/scene level**, not image by image.
- Keep bursts, near-duplicates, alternate angles of the same arranged scene, and the same physical-item session in one split.
- Use perceptual hashes to find cross-split near-duplicates, followed by human review.
- Exclude the entire golden session family from training and threshold tuning.
- Keep validation separate from golden. Validation is used for early stopping and tuning; golden is used for the final gate.
- If the golden set changes, create a new version and evaluate both champion and candidate on exactly that new version.

### Training-data eligibility

An image is eligible only when consent permits training, privacy review passes, its boxes/classes are verified to the required tier, and it is not assigned to golden. User corrections without reviewed boxes do not automatically become ground truth. Collector counts are consistency evidence, not bounding-box annotations.

## 5. Training a candidate

1. Freeze the dataset manifest and training YAML.
2. Record the code commit, package versions, random seeds, champion hash, and trigger reason.
3. Warm-start from the current champion for normal continuous-learning cycles. Keep a class-balanced replay sample of earlier trusted training data to reduce forgetting.
4. Use phone-relevant augmentation conservatively: brightness/exposure, mild blur, scale, crop/translation consistent with the declared input path, and horizontal flip where semantically safe. Avoid transformations that make waste physically implausible or destroy small boxes.
5. Train with resumable checkpoints and finite settings suitable for the available Kaggle/Colab session.
6. Evaluate the source/PyTorch model before export.
7. Export TFLite with a pinned command and generate the manifest from inspected artifacts, not assumptions.
8. Compare TFLite and PyTorch predictions on at least 10 fixed reference images and run the full golden metrics through TFLite.
9. Generate `metrics.json`, a model card, and the gate report.

Never overwrite M0 or the current champion during training/export. Use versioned output directories.

## 6. Fair comparison rules

Compare champion and candidate using:

- the same frozen golden-set version;
- the same frozen negatives set;
- the same image orientation and manifest-declared preprocessing implementation;
- the same evaluator, IoU rules, metric code, and reporting format;
- the same reference phone and measurement procedure for latency;
- sufficient warm-up runs, followed by repeated timed runs reporting at least median and a high percentile.

Do not compare a candidate's training/validation metric with the champion's golden metric. Do not choose individual golden images to fix, augment, or add to training. If golden results reveal a weakness, collect new training data in new sessions that represent the weakness without copying the golden scenes.

## 7. Promotion gate

A candidate must pass every required check. Initial thresholds are defined in `SNAPPICK_PLAN.md` and may be revised only with a documented reason before evaluating the candidate. At minimum check:

- mAP@0.5 and mAP@[0.5:0.95] on the golden set;
- per-class AP and recall, especially pickup-relevant classes;
- no unacceptable class regression;
- false positives per image on the frozen negatives set;
- PyTorch-to-TFLite parity;
- manifest schema, SHA-256, exact label order, tensor contract, and reference-image smoke test;
- model size, preprocessing/inference/decode time, memory behavior, and successful repeated scans on the reference Android phone;
- manual review of representative successes and failures.

The gate may reject a model that improves overall mAP if it seriously harms a class or produces more false positives. Record the full result, not just pass/fail.

## 8. What happens after the gate

### Candidate rejected

- Keep the champion active.
- Store the run ID, dataset/config/code/model hashes, metrics, and rejection reasons.
- Archive or remove the rejected binary according to storage policy.
- Keep eligible verified samples for future training unless consent/retention rules require deletion.
- Do not call a rejected run wasted; it is valid experimental evidence.

### Candidate accepted

- Register it as `candidate`, then require admin approval.
- Start with a small staged rollout where practical.
- Monitor corrections, confidence distribution, per-class counts, latency, and repeated inference errors.
- Move to 100% only after rollout checks pass.
- Keep the previous champion available and keep M0 bundled.

## 9. Runtime validation and fallback

Download each model to a separate versioned path. Before activation verify:

1. download completed and free space is adequate;
2. SHA-256 matches;
3. manifest schema and minimum app version are valid;
4. labels exactly match the seven fixed strings and order;
5. actual input/output tensors match the manifest;
6. bundled-reference smoke inference returns finite, structurally valid output;
7. activation can occur atomically without deleting the currently working model.

Fall back for model-level problems: corrupt download, wrong hash, manifest/tensor mismatch, load failure, failed smoke test, non-finite/structurally invalid output, or repeated inference failures indicating the model is unusable. Disable that version locally for the session to avoid a retry loop and record a privacy-safe technical event.

Do not permanently roll back for a single corrupt/unsupported photograph, a one-off preprocessing exception, or a legitimate no-detection result. Show a clear scan-level error and allow another photo. Logs must not contain images, user IDs, addresses, notes, or exact coordinates.

## 10. 384 versus 640 and centre crop versus letterbox

Keep M0 unchanged at 384 centre crop. When the local dataset is large enough, run a controlled experiment rather than assuming that larger is better.

Recommended variants:

| Variant | Purpose |
|---|---|
| 384 centre crop | Baseline and compatibility control |
| 384 letterbox | Tests retaining edge objects without increasing input pixels |
| 640 letterbox | Tests additional detail for small/distant items at higher mobile cost |

Train/evaluate every variant consistently with its declared preprocessing. Compare golden accuracy, edge-object errors, small-object recall, false positives, model size, peak memory, preprocessing time, inference time, and end-to-end time. A 640 image has about 2.78 times as many pixels as 384, but actual latency must be measured on the phone.

Promote a larger or letterboxed variant only if its practical gain is meaningful and it passes the same release gate. The app must support both transform types through the manifest and correct inverse box mapping.

## 11. Run checklist

- [ ] Seven labels/order unchanged.
- [ ] Consent/privacy review complete.
- [ ] Golden and training sessions isolated.
- [ ] Cross-split duplicate check passed.
- [ ] Dataset manifest frozen and hashed.
- [ ] Config, seed, code commit, package versions, and champion hash recorded.
- [ ] Training completed or resumed from a recorded checkpoint.
- [ ] PyTorch evaluation complete.
- [ ] TFLite export inspected; manifest and SHA-256 generated.
- [ ] TFLite parity, contract, and smoke tests passed.
- [ ] Champion and candidate evaluated on identical golden/negative sets.
- [ ] Per-class regression, false-positive, size, and phone-latency gates passed.
- [ ] Model card and gate report generated.
- [ ] Admin approved or rejection reason recorded.
- [ ] Staged rollout/rollback test completed before stable status.

## 12. Assumptions

- The owner-approved seven-label meanings and order remain the project taxonomy.
- M0's exact tensor metadata and timing are not considered verified until Phase 4 inspects and measures the artifact.
- Numeric promotion thresholds remain provisional until enough golden samples exist for stable estimates.
- The temporary dataset/model may remain useful as fallback even after a superior local champion is released.
