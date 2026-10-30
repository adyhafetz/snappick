# SNAPPICK_BUILD_GUIDE

> **Status (Revision 6: Community Recycling Guidelines, SnapBot AI, Phases 1–10 Complete):** new repository and Supabase project. The working `waste-app` smoke model is the initial champion and immutable bundled fallback. Detector: YOLOv8n (Ultralytics) exported to float32 TFLite, Android only, seven verified labels, 384 x 384 centre-crop baseline. Phases 1 through 10 have been implemented and manually verified; Phase 11 (ML pipeline automation) is next.

Phase-by-phase instructions for building SnapPick with an AI coding assistant. Each phase produces working code **and** a verification checklist you run yourself. Design details live in `SNAPPICK_PLAN.md`. Machine setup lives in `SNAPPICK_PREREQUISITE.md` (finish it first).

---

## 1. How to run a phase

1. **Do the "Manual work before" items** for the phase (accounts, keys, downloads, dashboards). The AI cannot do these.
2. **Create a branch:** `git checkout -b phase-N`.
3. **Start a fresh AI session** in `C:\Projects\snappick` and paste the phase prompt (each phase below has one).
4. The AI generates the code, migrations, and `docs/phases/PHASE-N-CHECKLIST.md`.
5. **Run the checklist yourself**, top to bottom. Tick each box.
6. If an item fails, paste the checklist item number, the exact error, and what you saw into the AI session. Fix, then rerun the whole checklist section that was affected.
7. When everything is ticked: `git add . && git commit -m "feat: phase N"`, merge into `main`, run `git tag phase-N-done`, push, and tick the phase in `docs/PROGRESS.md`.
8. Only then start the next phase.

**Standard prompt wrapper.** Every phase prompt below is used inside this wrapper:

```
Read AGENTS.md, docs/SNAPPICK_BUILD_GUIDE.md (Phase N plus section 5 shared contracts)
and the plan sections named in that phase in docs/SNAPPICK_PLAN.md.
Implement Phase N only. Do not start later phases.
When finished, create docs/phases/PHASE-N-CHECKLIST.md following section 3 of the guide
and list every assumption you made.
```

**Critical path note.** Phase 4 formalizes the already working temporary M0 rather than inventing a new taxonomy. Start the separate local golden evaluation set and local training set early, using different capture sessions. See `docs/DATASET_COLLECTION_GUIDE.md`. Later candidates keep the seven labels and are promoted only through `docs/MODEL_IMPROVEMENT_GUIDE.md`.

---

## 2. Phase map

| # | Phase | You get | Status | Manual effort |
|---|---|---|---|---|
| 0 | Spike (done, separate project) | Proof that on-device detection, maps, and Navigate work | ✅ Done | Done |
| 1 | Repository foundation and email auth | Monorepo skeleton, app on your phone with 5 tabs, email sign-in | ✅ Complete | Low |
| 2 | Database and security foundation | All core tables (with detection boxes), RLS, seeds, tests | ✅ Complete | Low |
| 3 | Google sign-in, consent, profile | Google login, consent screens, profile edit | ✅ Complete | Medium (Google Cloud) |
| 4 | ML baseline M0 (temporary verified model) | Existing YOLO `.tflite` formalized, manifest/contract tested, measured baseline | ✅ Complete | **Medium** (artifact audit, local golden set) |
| 5 | On-device scan and review sheet | Working offline scanner with coloured boxes, timings recorded | ✅ Complete | Low |
| 6 | Guidance engine | Community Recycling Guidelines plus SnapBot AI assistant | ✅ Complete | Medium (OpenAI) |
| 7 | Pickup request | Map pin, geofence, masked location | ✅ Complete | Medium (map key, boundaries) |
| 8 | Collector marketplace and claim | Request map, atomic claim, navigation | ✅ Complete | Medium (two devices) |
| 9 | Completion, proof, notifications | Full pickup lifecycle, signed proof URLs, FCM v1 | ✅ Complete | Medium (Firebase) |
| 10 | Feedback capture and Home stats | Corrections and opt-in uploads feed dataset, home stats RPC | ✅ Complete | Low |
| 11 | ML pipeline automation | Gated retraining pipeline on free infrastructure | ⏳ Up Next | **High** |
| 12 | Model delivery, rollout, monitoring | App updates its own model safely | ⏸️ Pending | Low |
| 13 | Public dashboard | Read-only web dashboard | ⏸️ Pending | Low (Vercel) |
| 14 | Admin, disputes, retention, deletion | Governance features | ⏸️ Pending | Low |
| 15 | Experiments, testing, pilot, release | Research evidence and release APK | ⏸️ Pending | **High** |

---

## 3. Checklist rules (what every `PHASE-N-CHECKLIST.md` must contain)

The AI must generate the checklist with **exactly these sections**, using `- [ ]` boxes:

- **A. Manual work before testing.** Every account, key, download, dashboard setting, or hardware step you must do, with exact click paths and commands. Mark each as one-time or per-run.
- **B. Setup and run commands.** Copy-paste commands for PowerShell, in order (install, migrate, build, start).
- **C. Tests.** Numbered items in the form **"Do X → expect Y"**. Each states the exact screen, input, and expected result. No vague items like "check it works".
- **D. Regression.** A short list re-checking key behaviour from earlier phases.
- **E. Known limitations.** What is intentionally unfinished or simplified.
- **F. Troubleshooting.** Likely errors for this phase and their fixes.
- **G. Sign-off.** The commit, merge, and tag commands, and the `PROGRESS.md` update.

The AI must also state which automated tests exist (unit tests, scripts) and the command to run them.

---

## 4. Working rules

The rules for the AI are in `AGENTS.md`. The most important: one phase at a time, pinned versions, `npx expo install` for Expo packages, migrations only, no secrets in code, and no guessed APIs.

**Known gotchas from the spike (also copied into `AGENTS.md`)**

- Keep model files outside `src/app`; Expo Router treats that folder as routes.
- Metro needs `tflite` added to `resolver.assetExts`, and the Metro cache may need clearing (`npx expo start -c`).
- The fast-tflite API takes a delegates list when loading (`[]` for CPU) and `ArrayBuffer`s in and out. Pin installed versions and read the current docs before using any library API.
- Exported models differ in input layout and output format. Read them from the tensor shapes and the manifest.
- MapLibre coordinates are `[longitude, latitude]`; it needs the new architecture and a development build, not Expo Go.
- A native library change (including the map) needs a native rebuild, not a reload.
- Keep the repository path short on Windows (Android native builds can hit path-length limits).

---

## 5. Shared contracts

These names and values must stay identical across all phases so the pieces fit together.

### 5.1 Repository layout

One Git repository, **independent package roots** (no root JavaScript workspaces). Each app has its own `package.json`, lockfile, and `node_modules`. This keeps Expo's exact React Native and React versions isolated from the dashboard, and matches the standalone project the spike was proven in.

```
snappick/
  AGENTS.md
  README.md
  .gitignore
  apps/
    mobile/            Expo app (TypeScript, Expo Router, development build)
    dashboard/         Next.js public dashboard (created in Phase 13)
  supabase/
    migrations/        SQL migrations (only way to change the schema)
    functions/         Edge Functions
    seed/              rule sets, advice templates, district polygons
    tests/             RLS and function tests (own package.json, Node scripts)
  ml/
    configs/           YAML (classes, training, gate thresholds)
    src/               pipeline code (Python)
    notebooks/         thin GPU wrappers
    experiments/       E1-E6
    tests/
    data/              git-ignored datasets and local photos
  scripts/
    spike/             archived Phase 0 spike code
  docs/                plan, guides, phases/, results/, ENVIRONMENT.md, SPIKE_RESULTS.md
  .github/workflows/
```

### 5.2 Detector classes and default pickup decisions

Model label order (verify against the trained model's manifest):

| ID | Class | Default decision |
|---|---|---|
| 0 | `metal` | Conditional: local acceptance, cleanliness, and safety confirmation |
| 1 | `trash` | Not accepted |
| 2 | `glass` | Conditional: local acceptance and not broken/unsafe |
| 3 | `paper` | Conditional: clean and dry |
| 4 | `cardboard` | Conditional: clean, dry, and locally accepted |
| 5 | `plastic` | Conditional: user/local-rule confirmation because the label is broad |
| 6 | `biological` | Not accepted |

The order above was visually verified by the owner in `waste-app`. Do not remap it. Manual safety declarations (never claimed as detector output) cover batteries, bulbs, e-waste, chemicals, sharp objects, and other hazards. The existing Phase 2 seed contains the former taxonomy; update it only through a new migration/seed change in the appropriate implementation phase, never by rewriting an applied migration.

Condition states: `clean_dry`, `contaminated_wet`, `broken_unsafe`, `unknown`.

Eligibility = f(class, condition, active rule set) and is displayed separately from material classification. Overlay colours: green = recyclable material, red = not recyclable, grey dashed = uncertain until confirmed. A conditional recyclable item stays green when wet or broken; its review row states that it is not eligible and gives the rule reason. Colour is never the sole status signal.

Confidence policy (defaults, overridable per class in the model manifest): score at least 0.80 confident; 0.40 to 0.79 uncertain; below 0.40 hidden. A high score is not proof of correctness (the spike saw 0.90 on a wrong object), so the negatives set and the review sheet remain safeguards.

### 5.3 Request statuses

`pending`, `accepted`, `in_progress`, `awaiting_confirmation`, `completed`, `not_collected`, `cancelled`, `expired`, `disputed`. Dispute outcomes: `upheld` (becomes `not_collected`), `rejected` (becomes `completed`), `inconclusive` (becomes `completed` with `dispute_outcome = inconclusive`). A request never returns to `pending` after a dispute.

### 5.4 Database objects, RPCs, and Edge Functions

- **Tables:** `profiles`, `pbt_rule_sets`, `scans`, `detections`, `label_feedback`, `feedback_samples`, `pickup_requests_public`, `pickup_request_private_details`, `pickup_waste_items`, `pickup_proofs`, `disputes`, `instruction_cache`, `llm_usage`, `perak_districts`, `push_tokens`, `reports`, `audit_log`, `model_versions`, `dataset_versions`, `training_runs`, `drift_daily`.
- **RPCs:** `create_pickup_request(...)`, `cancel_pickup_request(id)`, `resolve_pickup_area(lat, lng)`, `my_pickup_requests()`, `claim_pickup_request(id)`, `release_pickup_request(id)`, `start_pickup_request(id)`, `my_claimed_pickups()`, `submit_collected_items(...)`, `confirm_pickup(id)`, `raise_dispute(id, reason)`, `resolve_dispute(id, outcome, note)`, `relist_pickup(id)`, `get_home_stats()`. (Note: early `resolve_rule_set` was dropped in favour of local Community Recycling Guidelines).
- **Edge Functions:** `snapbot-chat`, `get-pickup-private-details`, `get-pickup-proof`, `notify`, `prune-expired-scans`, `delete-account`.
- **Storage buckets (private):** `scans`, `proofs`, `models`.
- **Geo rule:** the public location is `ST_SnapToGrid(exact_point, 0.01)`, computed on the server. Exact coordinates exist only in `pickup_request_private_details`.
- **Column contracts (Phase 2 must follow these exactly):**
  - `detections`: one row per detected box or user-added item. Columns for model label, app class, score, optional second-best label and score (nullable), `box_x1`, `box_y1`, `box_x2`, `box_y2` (normalised 0 to 1 relative to the EXIF-corrected original photo, null for user-added), `source` (`detector` or `user_added`), condition, eligibility, and `quantity` (1 for detector rows).
  - `scans`: model version, rule-set id and version, consent flags, image path, retention date, `image_width`, `image_height`, `preprocess_ms`, `inference_ms`.
  - Class names (`model_label`, `app_class`) are plain text, never enums.

### 5.5 Environment variables

| Where | Variable | Public? |
|---|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_MAP_STYLE_URL` | Yes (never put secrets here) |
| Supabase secrets | `OPENAI_API_KEY`, FCM credentials | No |
| `apps/dashboard/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| GitHub Actions secrets | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAGGLE_USERNAME`, `KAGGLE_KEY` | No |

Every app has a committed `.env.example` listing the names without values. `EXPO_PUBLIC_MAP_STYLE_URL` defaults to the OpenFreeMap style (no key); MapTiler is the fallback.

### 5.6 Model manifest (`model_manifest.json`)

```
{
  "version": "v0",
  "file": "snappick_det_v0.tflite",
  "sha256": "...",
  "framework": { "name": "ultralytics", "version": "..." },
  "role": "bundled_fallback",
  "input": { "width": 384, "height": 384, "layout": "NCHW", "dtype": "float32", "normalize": "0-1", "resize": "centre_crop" },
  "output": { "format": "yolo_raw", "shape": [1, 11, 3024], "layout": "attributes_first", "box_format": "cx,cy,w,h", "box_units": "normalised", "postprocess_in_model": false },
  "nms": { "iou": 0.5, "max_boxes": 30 },
  "labels": ["metal", "trash", "glass", "paper", "cardboard", "plastic", "biological"],
  "thresholds": { "default": { "confident": 0.80, "uncertain": 0.40 }, "per_class": {} },
  "min_app_version": "1.0.0",
  "dataset_version": "...",
  "metrics": { "map50": 0.0, "per_class_ap": {}, "fp_per_image_negatives": 0.0 }
}
```

Notes:
- The label order, 384 input size, float32 dtype, normalized input, and centre-crop path reflect the working smoke app. Tensor layout, output shape/layout, box units, framework version, metrics, and hash shown above are expected/example values until the exact shipped `.tflite` is inspected. Replace placeholders only with measured artifact metadata. Seven raw-output classes normally imply `4 + 7 = 11` attributes, but never infer the whole contract from that alone.
- The app reads labels, input size, layout, output format, NMS settings, and thresholds from this file and **also checks them against the loaded model's tensor shapes**. A mismatch is a readable error, never silent garbage.
- The app never hard-codes any of these values.
- Supported resize modes begin with `centre_crop` and `letterbox`. The immutable bundled fallback declares `centre_crop`; a candidate may declare `letterbox` only when training, evaluation, inverse box mapping, and the manifest all agree.

---

## Phase 0: Spike (done, in a separate throwaway project)

**Goal.** Prove the riskiest technical pieces on your real phone before committing to the stack.
**Status.** Complete. The code is archived under `scripts/spike/` (copy it in during Phase 1) and the numbers are recorded in `docs/SPIKE_RESULTS.md`.

| Check | Result |
|---|---|
| Expo SDK 57 / RN 0.86 / new architecture build on Android | Pass |
| On-device inference (CPU, 384 px, YOLOv8n float32) | Pass in `waste-app`; re-measure in SnapPick |
| Preprocess (centre crop, resize, JPEG decode, tensor) | Pass in `waste-app`; re-measure in SnapPick |
| Decode + NMS | Pass in `waste-app`; re-measure in SnapPick |
| Multi-object boxes | Pass |
| MapLibre pins, tap, remove, Navigate (no API key) | Pass |

What it taught: the seven-label 384 x 384 float32 model works on the target phone with centre-crop preprocessing and app-side raw-output decoding/NMS; exact tensor metadata and stage timings must be captured again rather than copied from an older unrelated spike; the fast-tflite API takes a delegates list and `ArrayBuffer`s; MapLibre uses `[lng, lat]`.

---

## Phase 1: Repository foundation and email auth

**Goal.** A monorepo skeleton and a development build running on your phone with five tabs and working email sign-up/sign-in.
**Plan sections.** 1, 2 (sign-up), 4.
**Depends on.** Prerequisite complete (including Part E, the repository, and Part G, the Supabase project).

**Manual work before**
- Supabase URL and anon key ready (Prerequisite Part G).
- Phone connected: `adb devices` shows `device`.
- Copy the spike's `App.tsx` and notes into `scripts/spike/` and `docs/SPIKE_RESULTS.md` (Prerequisite Part N).
- Copy the URL and key into `apps/mobile/.env` (the AI creates `.env.example`).

**Prompt**
```
Implement Phase 1 (Repository foundation and email auth) as described in the guide.
```

**The AI builds**
- Folder skeleton exactly as section 5.1: `apps/dashboard/` (README only for now), `ml/` (folders and README), `supabase/` (already initialised and linked in Prerequisite Part G; add the `migrations`, `functions`, `seed`, and `tests` folders, no schema yet), `scripts/`, `docs/` (including `PROGRESS.md`), and a root `README.md` and `.gitignore` (node_modules, `.env` files, `ml/data`, build outputs, keystores).
- Expo SDK 57 app at `apps/mobile`, created from the Expo SDK 57 template (`npx create-expo-app@latest --template default@sdk-57 apps/mobile` or equivalent), demo content removed, TypeScript strict, Expo Router, `expo-dev-client`, built and installed with `npx expo run:android` from `apps/mobile`.
- Supabase client using `@supabase/supabase-js` with session storage suitable for React Native.
- Auth screens: sign up, sign in, sign out; route guard; session persistence; form validation and clear error messages.
- Bottom tab bar: Home, Activity, **Scan** (larger, highlighted centre button), Request, Profile. All are placeholder screens.
- `.env.example`, basic theme, ESLint, and scripts for type-check.

**Verify (the checklist must cover)**
- App builds and installs on the phone; editing a screen hot-reloads.
- New user signs up and appears in Supabase → Authentication → Users.
- Wrong password shows a readable error; sign out returns to the sign-in screen.
- Force-close and reopen: the user stays signed in.
- Scan tab is visually larger or highlighted.
- `npx tsc --noEmit` and `npx expo-doctor` pass in `apps/mobile`.
- `git status` shows `.env` is **not** tracked, and a fresh clone plus `npm install` in `apps/mobile` builds again.
- The repo tree matches section 5.1.

---

## Phase 2: Database and security foundation

**Goal.** The full core schema with Row Level Security, seed data, and an automated isolation test.
**Plan sections.** 8 (precise-location protection), 9.
**Depends on.** Phase 1.

**Manual work before**
- `npx supabase link` already done (Prerequisite Part G).
- Create two throwaway test users (in the app or dashboard) and note their emails and passwords for the RLS test.

**Prompt**
```
Implement Phase 2 (Database and security foundation) as described in the guide.
```

**The AI builds**
- Migrations for the core tables in section 5.4 (except the ML tables added in Phase 11), enums for statuses and conditions only (never for class names), PostGIS geometry columns, and indexes. Follow the **column contracts in section 5.4 exactly**, notably the `detections` box columns and the `scans` size and timing columns.
- A trigger creating a `profiles` row for every new auth user.
- RLS on **every** table. Helper `is_admin()`. Only `pickup_requests_public` is added to the Realtime publication.
- Seed: `perak_general` v1 rule set covering all 13 classes and condition states; a placeholder `perak_districts` entry.
- `supabase/tests/rls.test.mjs`: a Node script that signs in as two users and checks isolation.

**Verify**
- `npx supabase db push` succeeds with no errors.
- A provided SQL query lists every table in `public` with RLS enabled (none disabled).
- Signing up creates a `profiles` row automatically.
- The RLS test script passes: user A cannot read user B's profile or scans, and anonymous users cannot read private pickup details.
- `perak_general` rule set exists with the current version number.

---

## Phase 3: Google sign-in, consent, and profile

**Goal.** Google login, first-run consent screens, and an editable profile with privacy toggles.
**Plan sections.** 2 (sign-up, profile), 8 (image minimisation).
**Depends on.** Phases 1–2.

**Manual work before** (the AI's checklist will give exact clicks)
- Google Cloud Console: create a project, configure the OAuth consent screen (External, Testing), and add your Gmail as a test user.
- Create a **Web** OAuth client and an **Android** OAuth client (package name from `app.json` and the SHA-1 of your debug keystore).
- Supabase → Authentication → Providers → Google: enable it and paste the Web client ID and secret.
- Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to `apps/mobile/.env`.

**Prompt**
```
Implement Phase 3 (Google sign-in, consent and profile) as described in the guide.
```

**The AI builds**
- Google sign-in via a native Google Sign-In library and `signInWithIdToken`, including its Expo config plugin.
- First-launch consent flow: image-storage consent and community-pickup safety acknowledgement, stored with timestamp and version. Declining blocks the app.
- Profile screen: view and edit display name and phone (optional), privacy section with the **"Help improve SnapPick"** training opt-in (stored only for now), sign out, and a disabled "Delete account" placeholder.

**Verify**
- Google sign-in works on the phone and creates or links a user.
- Consent screens appear once; declining stays on the consent screen.
- Profile edits persist in the database and survive an app restart.
- The training opt-in toggle persists.
- Email sign-in from Phase 1 still works.

---

## Phase 4: ML baseline M0 (formalize the temporary verified model)

**Goal.** Preserve the working seven-class `waste-app` YOLOv8n model as M0 and the immutable bundled fallback, reproduce/audit its temporary dataset recipe, generate its manifest and measured baseline, and pass the export-contract test.
**Plan sections.** 3, 6, 10.5, 10.7, 10.8.
**Depends on.** Phase 0 (done). Can run in parallel with Phases 1 to 3.

**Manual work before**
- Kaggle account with phone verification (needed for GPU). Colab is the fallback.
- Label Studio installed in a **separate** conda environment (Prerequisite Part K).
- Make the working `waste-app/assets/waste_model.tflite`, `labels.json`, and training notebook available locally; do not commit large or unlicensed artifacts. Record SHA-256 before copying anything.
- Record the notebook's exact package versions, training/export command, source dataset identifier and licence, split seed, metrics that can be reproduced, and the exact TFLite tensor details read by an interpreter. Mark anything unavailable as unverified.
- **Local golden set (start now, grow later).** Follow `docs/DATASET_COLLECTION_GUIDE.md`: at least 20 to 30 instances per detector class to start, growing to at least 50 per class before final experiments, from sessions excluded from training. It is **never** trained on.
- **Negatives.** Collect 30 to 50 photos of clutter and non-waste objects, plus public non-waste images the AI proposes.
- Ask your supervisor about the AGPL licence of the detector (plan Phase 0, decision 10).

**Prompt**
```
Implement Phase 4 (formalize the temporary M0 baseline) as described in the guide.
Preserve the verified labels metal, trash, glass, paper, cardboard, plastic, biological
in that exact order; do not remap them. Inspect the actual TFLite tensor contract,
reproduce/audit the notebook, and follow docs/DATASET_COLLECTION_GUIDE.md and
docs/MODEL_IMPROVEMENT_GUIDE.md. Verify current Ultralytics, TFLite export, and Label
Studio YOLO-export APIs before coding.
```

**The AI builds** (in `ml/`)
- `configs/classes.yaml` with the exact seven-label order, a non-remapping adapter/audit for the temporary Kaggle dataset, a negatives set, and deterministic split scripts that produce train, validation, and a temporary-source held-out set without session/near-duplicate leakage.
- Label Studio import and export helpers for the local golden set.
- A Kaggle notebook (thin wrapper over `src/`) that reproduces M0 from COCO-pretrained YOLOv8n weights with resumable checkpoints, evaluates the temporary held-out set (and local golden set separately when present), exports float32 384 x 384 TFLite, runs the **export-contract test** and PyTorch/TFLite parity check on 10 reference images, and runs a smoke test.
- Outputs: `snappick_det_v0.tflite`, `model_manifest.json` (section 5.6), `metrics.json` (mAP@0.5, mAP@[.5:.95], per-class AP and recall, false positives per image on the negatives set, model size), and a README with the exact Kaggle steps.
- A script that evaluates the golden set through the same compression path as uploaded images (800 px, JPEG quality about 0.65).

**Verify**
- The notebook runs end to end on Kaggle with GPU.
- `metrics.json` shows per-class AP on the temporary-source held-out set. Low values are acceptable: M0 is a temporary baseline and domain gap is expected.
- If a local golden set exists, its results are reported separately and labelled as such.
- TFLite export is within 1 mAP@0.5 point of the PyTorch model, or the gap is documented.
- The export-contract test passes, and the `.tflite` loads in a Python interpreter and detects objects on a sample image.
- `model_manifest.json` matches section 5.6, and the SHA-256 matches the file.
- Every dataset's licence and source is recorded.

---

## Phase 5: On-device scan and review sheet

**Goal.** Take a photo, see coloured boxes, edit items in the review sheet, and reach the Request button, all offline, with stage timings recorded.
**Plan sections.** 2 (scan), 3, 6.
**Depends on.** Phases 1 and 2 (formalized M0 from Phase 4, or the exact working smoke model with an explicitly provisional manifest).

**Manual work before**
- Copy `snappick_det_v0.tflite` and `model_manifest.json` into `apps/mobile/assets/models/` (outside `src/app`).
- If Phase 4 is not ready, copy the exact working `waste-app` `.tflite` and labels into the same folder and use an explicitly provisional manifest. Do not remap labels. Keep this artifact as the immutable bundled fallback.
- Record `npm ls react-native-fast-tflite react-native-nitro-modules` in `docs/ENVIRONMENT.md` after install.

**Prompt**
```
Implement Phase 5 (On-device scan and review sheet) as described in the guide.
```

**The AI builds**
- `react-native-fast-tflite` with `react-native-nitro-modules` (pin the installed versions), Metro config for `.tflite`, `expo-camera`, gallery picker (for testing), `expo-image-manipulator`, `jpeg-js`, and `base64-js`. Load models with the delegates list (`[]`) and pass and receive `ArrayBuffer`s. Read `scripts/spike/App.tsx` as the working reference.
- Pure TypeScript modules with unit tests: **centre-crop and letterbox preprocessing plus inverse box mapping**, channel layout from the model input tensor shape, output decoding for both declared layouts and units, class-wise NMS, confidence policy with per-class thresholds, and manifest-versus-tensor checks with readable errors. NMS is skipped only when the manifest says post-processing is in the model.
- A manifest-selected `centre_crop` or `letterbox` path. M0 uses centre crop at 384; no debug flag may silently override an approved model's manifest.
- **Preprocessing optimisation:** resize once, avoid unnecessary JPEG re-encoding, measure the M0 baseline, and target under 1 s where the device permits.
- Rules engine (class + condition + rule set → decision) using bundled `perak_general` rules, with unit tests.
- Detection overlay using positioned Views (dashed border for uncertain boxes), with labels and scores.
- **Review items** bottom sheet: one row per detected box, tap-to-highlight in both directions, condition selector defaulting to clean and dry with a single **Everything looks clean and dry** confirmation, change label, remove, **Add item not in photo**, a read-only aggregate header, and the "any batteries, bulbs, e-waste not shown?" question.
- **Request pickup** button, enabled when at least one item is eligible (opens a placeholder until Phase 7).
- Debug overlay showing preprocess, inference, and decode times in milliseconds.

**Verify**
- Airplane mode: scanning still works.
- Boxes line up with real objects (test with a bottle and a can on a table, and a mixed pile).
- Recyclable materials are green and non-recyclable materials red; a low-score detection appears grey dashed and can be confirmed, changed, or removed.
- Set a recyclable item to wet or broken -> expect its box to remain green, its row to say "Not eligible for pickup" with the reason, and its count to be excluded from pickup eligibility.
- Tapping a row highlights its box and tapping a box scrolls to its row.
- Stage timings are shown. Record preprocess, inference, and decode in `docs/results/`; compare candidates with the measured SnapPick M0 baseline and label any historical smoke-app timings separately.
- A deliberately mismatched manifest shows a readable error instead of wrong boxes.
- Denying camera permission shows a helpful message rather than crashing.
- Unit tests pass (centre-crop and letterbox round trips, decode, NMS, rules).

---

## Phase 6: Guidance engine (recycling guides and SnapBot AI)

**Goal.** Instant recycling preparation cards for all 7 classes, and SnapBot conversational AI recycling assistant.
**Plan sections.** 5, 7.
**Depends on.** Phases 2 and 5.

**Manual work before**
- OpenAI account and API key stored as Supabase secret (`npx supabase secrets set OPENAI_API_KEY=...`) for the SnapBot AI function.
- If running without an OpenAI key, SnapBot safely displays bundled recycling guidance and the phase still passes.

**Prompt**
```
Implement Phase 6 (Guidance engine) as described in the guide: recycling preparation
dictionary for all 7 classes, 720p animated visuals, and Home screen SnapBot AI assistant.
```

**The AI builds**
- Recycling preparation dictionary (`recyclingGuides.ts`) for all seven detector classes with step-by-step preparation cards and 720p animated WebPs (`RecyclingAnimation.tsx`) integrated into the detection review sheet.
- Home screen **SnapBot AI Recycling Assistant** (`SnapBotModal.tsx`) backed by Edge Function `snapbot-chat`.
- Deterministic response caching (`instruction_cache` with SHA-256 question hash) to minimize OpenAI API usage and latency.
- Rate limiting, token caps, and local offline fallback for SnapBot.
- 100% offline scanning: preparation steps and eligibility render immediately on-device without network calls.

**Verify**
- Scanning any item renders instant recycling preparation cards and animations.
- Airplane mode displays full guidance offline.
- Tapping "Ask SnapBot" opens the AI chat assistant. Repeated questions return cached responses instantly.
- Logs and prompts contain no user IDs, coordinates, images, or personal notes.
- Users cannot write to `instruction_cache` directly (RLS test).

---

## Phase 7: Pickup request

**Goal.** From a scan result, pin a location, pass the service area geofence, and create a pending request with a masked public point.
**Plan sections.** 2 (pickup request), 5, 8.
**Depends on.** Phases 2, 5, and 6.

**Manual work before**
- Map style: the default is the OpenFreeMap style (no key). Confirm it shows tiles on your phone and check its terms and attribution requirements. If it fails, create a MapTiler key. Put the style URL in `EXPO_PUBLIC_MAP_STYLE_URL`. Install `@maplibre/maplibre-react-native` with `npx expo install` and add its config plugin; this needs a native rebuild.
- Download Perak district boundaries (GeoJSON) from a source you can cite (OpenStreetMap, DOSM, or GADM) into `supabase/seed/perak_districts.geojson`. Check the licence and attribution requirements.

**Prompt**
```
Implement Phase 7 (Pickup request) as described in the guide.
```

**The AI builds**
- MapLibre React Native map, GPS auto-detect, draggable pin, and address form (unit, street, landmark, access instructions, note, pickup window).
- District import script and seed (`scripts/import_perak_districts.py`).
- RPC `create_pickup_request`: one transaction that validates the user, items, restricted-item confirmation, and geofence (`ST_Contains`), assigns the district, writes the public row (grid-snapped), the private row, and the item checklist.
- Out-of-area notification when a pin is outside supported service boundaries, and Activity → **My Requests** (list and cancel).

**Verify**
- A pin in Ipoh succeeds; a pin in Kuala Lumpur or Penang is blocked in the app **and** when calling the RPC directly with those coordinates.
- The public row has snapped coordinates; the private row has exact ones.
- A second user cannot read the private row.
- Submitting without the restricted-item confirmation is rejected.
- Offline shows "Connect to submit pickup" and disables submit.
- Guideline ID and version are stored on the request.
- Cancel changes the status to `cancelled`.

---

## Phase 8: Collector marketplace and claim

**Goal.** Browse pending requests on a map, claim one atomically, and navigate to it.
**Plan sections.** 2 (collector map), 8 (state handling).
**Depends on.** Phase 7.

**Manual work before**
- Two accounts on two devices (a second phone or an emulator) for the real-time test.
- Supabase → Database → Extensions: enable **pg_cron**.

**Prompt**
```
Implement Phase 8 (Collector marketplace and claim) as described in the guide.
```

**The AI builds**
- Request tab map with pending public pins, one marker per grid cell with a count badge (counts come from a server-side view, because MapLibre's `Marker` has no built-in clustering), and a Realtime subscription to the public table only. MapLibre coordinates are `[longitude, latitude]`.
- Pin sheet (waste types, approximate area, window, access constraints).
- RPCs `claim_pickup_request` (atomic, only `pending`, blocks self-claims, caps active claims at 3), `release_pickup_request`, `start_pickup`.
- Edge Function `get-pickup-private-details` (only the assigned collector, only while `accepted` or `in_progress`).
- **Navigate** button using the Android navigation link (with a generic map link as fallback), Activity → **Pickups I Claimed**, and a pg_cron job returning unstarted claims to `pending` after 24 hours.
- Test script `scripts/test-claim-race.mjs`.

**Verify**
- Race test: 10 parallel claims produce exactly one winner.
- Claiming your own request and a 4th active claim are both rejected.
- Another user gets a denial from the private-details function.
- The pin disappears on the second device within seconds of a claim.
- Navigate opens the maps app at the right place.
- Release returns the request to `pending`; a simulated old claim (test helper) is auto-released.
- The requester sees `accepted` and then `in_progress` in Activity.

---

## Phase 9: Completion, proof, and notifications

**Goal.** The full lifecycle: checklist verification, proof photo, confirmation, non-collection, dispute, and push notifications.
**Plan sections.** 2, 8.
**Depends on.** Phase 8.

**Manual work before**
- Firebase project, add an Android app with your package name, download `google-services.json` into `apps/mobile/` (git-ignored), and create FCM v1 service-account credentials. Store them as Supabase secrets exactly as the checklist instructs.

**Prompt**
```
Implement Phase 9 (Completion, proof and notifications) as described in the guide.
```

**The AI builds**
- Collector checklist screen per line item (collected quantity, verified condition, non-collection reason), writing `pickup_waste_items` and `label_feedback`.
- Proof capture with on-device compression (max 800 px, JPEG quality about 0.65, EXIF stripped) to the private `proofs` bucket, viewed via signed URLs.
- RPCs `submit_collection` (to `awaiting_confirmation`, or `not_collected` with mandatory evidence), `confirm_pickup`, `raise_dispute`, `relist_pickup`; a 48-hour auto-complete job.
- Push notifications: token registration and the `notify` function on status changes.

**Verify**
- Happy path with two accounts: create → claim → start → checklist → proof → confirm → `completed`.
- Zero-collection path ends in `not_collected` and requires evidence.
- Raising a dispute creates a `disputes` row and sets `disputed`.
- A third user cannot open the proof URL.
- Exiftool (or a provided check) shows no GPS in uploaded images.
- Notifications arrive with the app in foreground and background.
- Simulated 48-hour auto-complete works.

---

## Phase 10: Feedback capture and Home stats

**Goal.** Scans and corrections are stored; opted-in users contribute selected images; Home shows real statistics.
**Plan sections.** 2 (Home), 8, 10.3, 10.4.
**Depends on.** Phases 5 and 9.

**Manual work before**
- Turn on the training opt-in for one test account and leave it off for another.
- Do at least 20 real scans for meaningful numbers.

**Prompt**
```
Implement Phase 10 (Feedback capture and Home stats) as described in the guide.
```

**The AI builds**
- Persist scans and detections (one row per box, with normalised box coordinates and `source`) with model version, rule-set version, image size, `preprocess_ms`, `inference_ms`, and `retention_date`.
- Upload gating: image uploaded only with storage consent **and** training opt-in.
- Active-learning selector: uncertain (0.40–0.79) boxes, user-changed or removed labels, a random 5% of confident scans, and a daily per-user cap.
- User corrections into `label_feedback`; `feedback_samples` table (label tier A/B/C/D, review status, collector-count-match flag) and a server function comparing detector counts with collector counts after completion.
- Offline upload queue with retry, and the Home dashboard (total scans, verified recyclable items, active requests, recent activity).

**Verify**
- The opted-out user's scans create no image in Storage; the opted-in user's selected scans do.
- The daily cap stops uploads at the limit; a dev flag lets you test the 5% random sampling on many simulated scans.
- Airplane-mode scans upload after reconnecting.
- Correction rows and `feedback_samples` rows carry the right tiers.
- Uploaded images are 800 px or smaller with no EXIF.
- Home numbers match the database.

---

## Phase 11: ML pipeline automation

**Goal.** A reproducible, gated retraining pipeline running on GitHub Actions plus a free GPU notebook.
**Plan sections.** 10 (all).
**Depends on.** Phases 4 and 10.

**Manual work before**
- GitHub repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAGGLE_USERNAME`, `KAGGLE_KEY`.
- Kaggle: create a private dataset for pipeline datasets and a notebook with GPU enabled, as the checklist specifies. Install the Kaggle CLI in the `snappick` env (`pip install kaggle`) and place your API token where the Kaggle CLI expects it (never in the repo).
- Annotate any hard images in the Label Studio queue (Tier C) so the pipeline has Tier A data.

**Prompt**
```
Implement Phase 11 (ML pipeline automation) as described in the guide. Verify current
Kaggle CLI and API behaviour for pushing and polling kernels before coding, and
provide a manual Colab fallback path. Reuse the Phase 4 training, export, and
export-contract code rather than rewriting it.
```

**The AI builds** (in `ml/`)
- Migration for `dataset_versions`, `training_runs`, `model_versions`, `drift_daily`.
- Stages: export (opted-in only), quality filter (blur, perceptual-hash duplicates, consent), label-tier resolution with Label Studio import and export, dataset build (splits by user or session, golden set excluded, negatives included, replay buffer, versioning), trigger checker, Ultralytics training with warm start from the champion and replay, evaluate-and-gate (rules from plan section 10.8, including export parity, the export contract, and false positives on negatives), TFLite export with the contract test and smoke test, registration (upload to the `models` bucket and a `candidate` row with SHA-256), and a model card generator.
- A rejected candidate never replaces the champion. Preserve its metrics, config and data/model/code hashes, and rejection reason; the rejected binary may be archived or removed by retention policy. Verified consented samples remain eligible for later cycles rather than being deleted because one run failed.
- GitHub Actions workflow `ml-pipeline.yml` (scheduled and manual dispatch) and a Kaggle runner that pushes, polls, and pulls outputs.
- A **dry-run mode** with a tiny synthetic dataset that exercises every stage in under 10 minutes.
- Unit tests for filters, label logic, and gate logic.

**Verify**
- `pytest` in `ml/` passes.
- The dry-run workflow finishes green in GitHub Actions and creates a `candidate` model row whose hash matches the file.
- The trigger fires once the configured number of new trusted images exists, and does not fire inside the minimum interval.
- The gate **rejects** a deliberately degraded test model and **accepts** an improved one, and rejected runs store their reason.
- A model with the wrong tensor layout is rejected by the export-contract stage.
- Each run ID links dataset hash, config hash, git commit, Ultralytics version, and model hash.

---

## Phase 12: Model delivery, rollout, and monitoring

**Goal.** The app downloads, verifies, and switches models safely; rollout and rollback work; drift statistics are recorded.
**Plan sections.** 6 (model availability), 10.9, 10.10.
**Depends on.** Phase 11.

**Manual work before**
- Approve a candidate model in Supabase Studio (`status = approved`) and set `rollout_percent`.
- Keep the previous model registered so you can test rollback.
- Have a second account or device for rollout checks.

**Prompt**
```
Implement Phase 12 (Model delivery, rollout and monitoring) as described in the guide.
```

**The AI builds**
- App model manager: check for an eligible version (approved and `hash(user_id) mod 100 < rollout_percent`), verify `min_app_version` and free space, download to a separate versioned path, verify SHA-256, enforce the exact seven-label order, check input/output tensors against the manifest, and run a bundled-reference smoke test before an atomic switch. Downloaded models never overwrite the bundled M0 asset. It may keep a validated previous champion, but the immutable bundled M0 is the final fallback.
- Roll back for model-level failures: download/checksum/manifest/contract/load/smoke-test failures or repeated inference failures. A single corrupt photo, preprocessing error, or no-detection result does not permanently blacklist or roll back a model.
- Active model version recorded on every scan, and an About or debug screen showing it.
- SQL function and daily job filling `drift_daily` (mean top score, uncertain share, correction rate per class, collector mismatch rate).
- Admin helpers (approve, rollback) that write to `audit_log`, with a minimal admin-only screen if practical.

**Verify**
- Approve at 100%: the app downloads and reports the new version.
- A tampered file (wrong hash) is rejected and the old model stays.
- A model that fails the smoke test falls back automatically.
- A deliberately corrupt photo produces a scan-level error without permanently rolling back a valid model.
- Setting rollout to 0 returns the app to the previous known-good model.
- A unit test proves the rollout bucket is deterministic for a given user.
- `drift_daily` fills for the active version.

---

## Phase 13: Public dashboard

**Goal.** A read-only, no-login web dashboard with aggregate statistics only.
**Plan sections.** 2 (public dashboard), 11.
**Depends on.** Phases 2 and 9 (data), 12 (model panel).

**Manual work before**
- Vercel account; create a project connected to your GitHub repo with root directory `apps/dashboard`; add the environment variables from section 5.5.

**Prompt**
```
Implement Phase 13 (Public dashboard) as described in the guide. Confirm the current
Next.js version and App Router caching APIs from the official docs.
```

**The AI builds**
- Next.js app (TypeScript, Recharts, MapLibre GL JS) in `apps/dashboard`.
- Aggregate views by district, material family, date, and status, with small-count suppression (counts under 5 hidden or merged). The public role can select **only** from these views.
- Pages: overview KPIs, trends, material breakdown, district map or heatmap, and **Model transparency** (versions and golden-set mAP).
- Cache revalidation every 5–15 minutes; responsive layout; map attribution.
- A seed script that generates realistic test data.

**Verify**
- The site opens without login on the Vercel URL.
- The browser network tab shows only aggregate fields (no notes, addresses, photos, or user IDs).
- A direct anonymous query to base tables fails.
- Districts under the threshold are hidden or merged.
- KPI numbers match a manual SQL count on the seed data.

---

## Phase 14: Admin, disputes, retention, and account deletion

**Goal.** Governance features: dispute resolution, reports, review queue, retention pruning, and account deletion.
**Plan sections.** 1, 8 (disputes, retention), 9.
**Depends on.** Phases 9 and 10.

**Manual work before**
- Enable **pg_net** (and confirm **pg_cron**) in Supabase → Database → Extensions.
- Create an admin user: set `profiles.is_admin = true` for your account (SQL provided in the checklist).
- Store the function secret in Supabase Vault as the checklist instructs.

**Prompt**
```
Implement Phase 14 (Admin, disputes, retention and account deletion) as described in the guide.
```

**The AI builds**
- Admin-only screens: disputes list and `resolve_dispute` (upheld, rejected, inconclusive with the correct statuses), reports list, correction review queue (mark reviewed), and a rule-set viewer with a version-bump helper.
- `prune-expired-scans` Edge Function plus a daily pg_cron job, with an audit log of every deletion (path, record, result, error).
- `delete-account` Edge Function and in-app flow (cascade delete, storage cleanup, de-linking from dataset records), plus report and block for users.

**Verify**
- Each dispute outcome produces the correct final status and never returns to `pending`.
- A non-admin cannot call admin RPCs.
- A back-dated scan is deleted (row and image); a training-approved scan is kept; log rows exist.
- Deleting an account removes its data and the user can no longer sign in.
- Dataset manifests contain no user IDs.

---

## Phase 15: Experiments, testing, pilot, and release

**Goal.** Research evidence, a full test run, a usability study, and a release build.
**Plan sections.** 10.12, 13, 14, 15.
**Depends on.** All previous phases.

**Manual work before**
- Recruit 10–15 pilot users and schedule usability sessions.
- Collect enough real scans for at least one or two real retraining cycles.
- Have free Kaggle GPU quota available for the experiment runs.

**Prompt**
```
Implement Phase 15 (Experiments, testing, pilot and release) as described in the guide.
```

**The AI builds**
- Experiment scripts E1–E6 in `ml/experiments/` (learning curve, label strategy, sampling strategy, forgetting with and without replay, real pilot comparison, on-device stage timings with centre crop vs letterbox, optional 640 comparison, fp32 vs fp16, and CPU vs GPU delegate), writing tables and plots to `docs/results/`, with the simulated stream clearly labelled as simulated.
- `scripts/run-all-tests` combining RLS, claim race, geofence, offline, model update, and retention tests.
- Usability materials: task list and a System Usability Scale form.
- Signed release APK build steps, a seeded demo dataset, a demo script, and final README and architecture documentation.

**Verify**
- Experiments reproduce from a fresh clone using the documented commands, and the result tables regenerate.
- The full test script is green.
- The release APK installs on a clean phone and completes the core flow.
- A demo dry-run passes end to end, including one model update.

---

## 6. When something goes wrong

Paste to the AI, in this order: (1) the checklist item number, (2) the exact error text, (3) what you expected versus saw, (4) the output of `git status`. Ask it to **diagnose before changing code** and to fix only what is needed for that item. If a fix would touch earlier phases, the AI must say so and explain why.

## 7. Definition of done (whole project)

- All 15 phases tagged `phase-N-done` and ticked in `docs/PROGRESS.md`.
- At least one real retraining cycle passed the release gate and reached users through staged rollout.
- Results for E1–E6 are in `docs/results/`, with real and simulated data clearly separated.
- The public dashboard is live and shows aggregate data only.
- The demo runs end to end on a clean phone.
