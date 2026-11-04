# SnapPick Model Improvement Guide

Use this guide when you are ready to train a new detector version using local collected data. It defines how to train a candidate, prove whether it is better, promote it safely via the admin panel, and recover if it fails.

Related documents:
- `docs/DATASET_COLLECTION_GUIDE.md` — what and how to photograph.
- `docs/ENVIRONMENT.md` — installed/pinned versions.
- `docs/ARCHITECTURE.md` — system overview and version lifecycle.

---

## 1. Fixed contract

All detector versions use these exact labels in this exact order:

```text
0  metal
1  trash
2  glass
3  paper
4  cardboard
5  plastic
6  biological
```

Do not rename, merge, split, alphabetize, or remap the labels. A taxonomy change is a separate breaking project requiring data migration, rule updates, new golden annotations, and explicit approval.

---

## 2. Version roles

| Role (internal DB value) | What it means | Shown in Admin Panel as |
|--------------------------|---------------|------------------------|
| `bundled_fallback` | Exact copy of v0 shipped inside every APK. Immutable — never overwritten by downloads. | "v0 (bundled)" |
| `champion` | Currently active version deployed to users | "vN (active)" |
| `candidate` | Newly trained version under evaluation, not yet active | "vN (pending review)" |
| `archived` | A previous active version, kept for reference | "vN (archived)" |

> Internal role names are implementation detail. The Admin Panel displays only the version number and a plain status label.

---

## 3. Required steps before training

Before training version v1 (or any vN), record and preserve:

- The current active version's `.tflite` file, `model_manifest.json`, and SHA-256
- Source dataset identifier, licence, download date/version, and known limitations
- Ultralytics version, Python version, export command (pinned)
- Actual TFLite tensor shapes read from the artifact (not assumed from manifest)
- Training parameters: base weights, epochs, image size, batch, patience, random seed
- A small set of owned reference images and expected output tolerances for smoke tests

Do not invent missing facts. Mark them `unverified` and reproduce the run if needed. Keep large artifacts outside git; commit scripts, manifests, configs, hashes, and reports.

---

## 4. Data sets

| Set | Purpose | May train on? | Changes over time? |
|-----|---------|:---:|---|
| Development pool | Training and validation | Yes (except validation split) | Yes — new version per build |
| Golden evaluation set | Fair version comparison | **Never** | Frozen once versioned |
| Negatives | Measure/teach when detector should stay quiet | Training subset + frozen evaluation subset | Versioned |

The golden evaluation set must use different physical items, days, and places from the development pool. Never move images between sets.

---

## 5. Training recipe

1. **Warm-start** from the current active version's weights, not from COCO each time.
2. **Replay buffer:** combine all Tier A data with a class-balanced sample of earlier training data.
3. **Negatives** included in every build.
4. **Augmentation** matched to phone photos: brightness, blur, flip, scale.
5. **Fixed seeds** and a frozen YAML config committed to the repository.
6. **Export:** TFLite export with a pinned command and fixed input size.
7. **Export-contract test:** assert tensor shapes and layout against the manifest, then compare TFLite vs PyTorch outputs on 10 reference images.

---

## 6. Release gate (every candidate must pass)

Run the gate on the frozen golden set. Compare each metric against the current active version:

| Check | Rule |
|-------|------|
| Overall accuracy | mAP@0.5 at least 0.5 points above active version, or clearly better on the targeted weak class |
| No regression | No class AP falls more than 3 points below the active version |
| Pickup-relevant recall | Recall for `metal`, `glass`, `paper`, `cardboard`, `plastic` ≥ 0.60 |
| False positives | FP per image on negatives no worse than active version + 0.05 |
| False negatives | No class recall drops below 0.40 |
| Size / latency | Model size ≤ 1.2× active version; inference on reference phone ≤ 3s end-to-end |
| Contract | Export-contract test passes (tensor shapes match manifest) |

A candidate that fails any check is rejected. Update `training_runs.gate_result` with the reason.

---

## 7. Promoting a version (via Admin Panel)

1. After the gate passes, the training pipeline registers the new version in `model_versions` with status `candidate`.
2. Sign in to the Admin Panel → **Detector Versions**.
3. Find the new version by its version number (e.g. `v1`). Review its metrics.
4. Set rollout percentage (e.g. 10%) and click **Approve**.
5. After a monitoring period with no spike in correction rate or error reports, increase rollout to 100%.
6. The version is now active for all users.

Approval calls `admin_approve_model_version(version, rollout_percent)` and writes to `audit_log`.

---

## 8. Rolling back

If a promoted version causes problems:

1. Admin Panel → **Detector Versions** → find the problematic version → **Roll Back**.
2. This calls `admin_rollback_model_version(version, reason)`, sets rollout to 0%, and restores v0 (the bundled version) as the active fallback.
3. Users who downloaded the problematic version will fall back to their last known good version or v0 after the next eligibility check.

---

## 9. Measuring performance

Use `drift_daily` to monitor the active version after each rollout. Watch for:
- Rising `correction_rate_by_class` for any class → may indicate model drift
- Rising `uncertain_share` → model is becoming less confident
- Rising `collector_mismatch_rate` → collector counts disagree with detector counts

The Admin Panel **Drift Monitor** page displays these metrics as charts.

---

## 10. Version v0 notes

Version v0 is the temporary Kaggle baseline (YOLOv8n, 384×384, centre-crop, float32 TFLite). Its mAP metrics are `null` because it has not been evaluated on a local golden set. This is intentional — evaluation on a local golden set happens when one is collected. Until then, v0 serves as the reference that all new versions must beat.

The v0 file is bundled inside every APK and is never overwritten. It is the ultimate fallback regardless of what is downloaded over-the-air.
