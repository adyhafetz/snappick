# SNAPPICK_BUILD_GUIDE

> **Status (Revision 4, fresh start):** new repository, new Supabase project. The Phase 0 spike was done in a separate throwaway project and is archived under `scripts/spike/`. Phases 1 to 15 are all still to be built. Detector: YOLO (Ultralytics) exported to TFLite. Android only. Public data first.

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

**Critical path note.** Phase 4 (ML baseline) is built on **public datasets first**, so it no longer waits on photo collection. The one thing to start on day 1 is the **local golden test set** (a few photo sessions, protocol in Prerequisite Part M), because every research result is measured on it. The rest of the local dataset can be collected later and swapped in by retraining.

---

## 2. Phase map

| # | Phase | You get | Manual effort |
|---|---|---|---|
| 0 | Spike (done, separate project) | Proof that on-device detection, maps, and Navigate work | Done |
| 1 | Repository foundation and email auth | Monorepo skeleton, app on your phone with 5 tabs, email sign-in | Low |
| 2 | Database and security foundation | All core tables (with detection boxes), RLS, seeds, tests | Low |
| 3 | Google sign-in, consent, profile | Google login, consent screens, profile edit | Medium (Google Cloud) |
| 4 | ML baseline M0 (public data) | First YOLO `.tflite` model, export-contract tested, measured accuracy | **Medium** (dataset approval, local golden set) |
| 5 | On-device scan and review sheet | Working offline scanner with coloured boxes, timings recorded | Low |
| 6 | Guidance engine | Local rules plus cached LLM advice | Medium (OpenAI) |
| 7 | Pickup request | Map pin, geofence, masked location | Medium (map key, boundaries) |
| 8 | Collector marketplace and claim | Request map, atomic claim, navigation | Medium (two devices) |
| 9 | Completion, proof, notifications | Full pickup lifecycle | Medium (Firebase) |
| 10 | Feedback capture and Home stats | Corrections and opt-in uploads feed the dataset | Low |
| 11 | ML pipeline automation | Gated retraining pipeline on free infrastructure | **High** |
| 12 | Model delivery, rollout, monitoring | App updates its own model safely | Low |
| 13 | Public dashboard | Read-only web dashboard | Low (Vercel) |
| 14 | Admin, disputes, retention, deletion | Governance features | Low |
| 15 | Experiments, testing, pilot, release | Research evidence and release APK | **High** |

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
| 0 | plastic_bottle | Accepted |
| 1 | glass_bottle | Conditional |
| 2 | can | Accepted |
| 3 | cardboard | Accepted |
| 4 | paper | Accepted |
| 5 | plastic_container | Conditional |
| 6 | plastic_bag_wrapper | Not accepted |
| 7 | beverage_carton | Conditional |

Manual-only labels (never detected by the model): `food_waste` (not accepted), `textile` (conditional), `e_waste` (restricted), `battery_bulb` (restricted), `general_waste` (not accepted).

Condition states: `clean_dry`, `contaminated_wet`, `broken_unsafe`, `unknown`.

Eligibility = f(class, condition, active rule set). Colours: green = accepted, amber = conditional or needs confirmation, red = not accepted or restricted, grey dashed = uncertain.

Confidence policy (defaults, overridable per class in the model manifest): score at least 0.80 confident; 0.40 to 0.79 uncertain; below 0.40 hidden. A high score is not proof of correctness (the spike saw 0.90 on a wrong object), so the negatives set and the review sheet remain safeguards.

### 5.3 Request statuses

`pending`, `accepted`, `in_progress`, `awaiting_confirmation`, `completed`, `not_collected`, `cancelled`, `expired`, `disputed`. Dispute outcomes: `upheld` (becomes `not_collected`), `rejected` (becomes `completed`), `inconclusive` (becomes `completed` with `dispute_outcome = inconclusive`). A request never returns to `pending` after a dispute.

### 5.4 Database objects, RPCs, and Edge Functions

- **Tables:** `profiles`, `pbt_rule_sets`, `scans`, `detections`, `label_feedback`, `feedback_samples`, `pickup_requests_public`, `pickup_request_private_details`, `pickup_waste_items`, `pickup_proofs`, `disputes`, `instruction_cache`, `llm_usage`, `perak_districts`, `push_tokens`, `reports`, `audit_log`, `model_versions`, `dataset_versions`, `training_runs`, `drift_daily`.
- **RPCs:** `resolve_rule_set(lat, lng)`, `create_pickup_request(...)`, `cancel_pickup_request(id)`, `claim_pickup_request(id)`, `release_pickup_request(id)`, `start_pickup(id)`, `submit_collection(id, ...)`, `confirm_pickup(id)`, `raise_dispute(id, reason)`, `resolve_dispute(id, outcome, note)`, `relist_pickup(id)`.
- **Edge Functions:** `get-guidance`, `get-pickup-private-details`, `notify`, `prune-expired-scans`, `delete-account`.
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
  "input": { "width": 640, "height": 640, "layout": "NCHW", "dtype": "float32", "normalize": "0-1", "resize": "letterbox", "pad_value": 114 },
  "output": { "format": "yolo_raw", "shape": [1, 12, 8400], "layout": "attributes_first", "box_format": "cx,cy,w,h", "box_units": "normalised", "postprocess_in_model": false },
  "nms": { "iou": 0.5, "max_boxes": 30 },
  "labels": ["plastic_bottle", "glass_bottle", "can", "cardboard", "paper", "plastic_container", "plastic_bag_wrapper", "beverage_carton"],
  "thresholds": { "default": { "confident": 0.80, "uncertain": 0.40 }, "per_class": {} },
  "min_app_version": "1.0.0",
  "dataset_version": "...",
  "metrics": { "map50": 0.0, "per_class_ap": {}, "fp_per_image_negatives": 0.0 }
}
```

Notes:
- The values above are placeholders. The real values come from the export of the actual model. The spike model had input `[1, 3, 640, 640]` and output `[1, 84, 8400]`; an 8-class model gives `[1, 12, 8400]`.
- The app reads labels, input size, layout, output format, NMS settings, and thresholds from this file and **also checks them against the loaded model's tensor shapes**. A mismatch is a readable error, never silent garbage.
- The app never hard-codes any of these values.

---

## Phase 0: Spike (done, in a separate throwaway project)

**Goal.** Prove the riskiest technical pieces on your real phone before committing to the stack.
**Status.** Complete. The code is archived under `scripts/spike/` (copy it in during Phase 1) and the numbers are recorded in `docs/SPIKE_RESULTS.md`.

| Check | Result |
|---|---|
| Expo SDK 57 / RN 0.86 / new architecture build on Android | Pass |
| On-device inference (CPU, 640 px, YOLO nano float32) | about 350 ms |
| Preprocess (resize, JPEG decode, tensor) | about 1.5 s |
| Decode + NMS | about 110 ms |
| Multi-object boxes | Pass |
| MapLibre pins, tap, remove, Navigate (no API key) | Pass |

What it taught: the exported model had channels-first input and raw `[1, 84, 8400]` output (so the app decodes and runs NMS); preprocessing, not the model, is the bottleneck; generic models give confident wrong answers on non-waste objects; battery is not detected by a generic model; the fast-tflite API takes a delegates list and `ArrayBuffer`s; MapLibre uses `[lng, lat]`.

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

## Phase 4: ML baseline M0 (research track, public data first)

**Goal.** A trained YOLO model (M0, eight classes) built from public datasets, exported to TFLite, passing the export-contract test, with measured per-class accuracy.
**Plan sections.** 3, 6, 10.5, 10.7, 10.8.
**Depends on.** Phase 0 (done). Can run in parallel with Phases 1 to 3.

**Manual work before**
- Kaggle account with phone verification (needed for GPU). Colab is the fallback.
- Label Studio installed in a **separate** conda environment (Prerequisite Part K).
- Record the spike's export details in `docs/SPIKE_RESULTS.md`: `pip show ultralytics` output, the exact export command, and the tensor shapes the app printed. The AI needs these.
- **Approve datasets.** The AI proposes public datasets with their licences. You approve, then download them into `ml/data/` (git-ignored). Note every licence for your report.
- **Local golden set (start now, grow later).** Photograph local household waste on different days and places than any future training photos: at least 20 to 30 instances per class to start, growing to at least 50 per class before Phase 15. Annotate in Label Studio (bounding boxes, eight classes). It is **never** used for training. Protocol in Prerequisite Part M.
- **Negatives.** Collect 30 to 50 photos of clutter and non-waste objects, plus public non-waste images the AI proposes.
- Ask your supervisor about the AGPL licence of the detector (plan Phase 0, decision 10).

**Prompt**
```
Implement Phase 4 (ML baseline M0) as described in the guide. Before coding, check the
current Ultralytics training and TFLite export tooling, find the export route that
produces the tensor layout recorded in docs/SPIKE_RESULTS.md, check Label Studio's
YOLO-format export, and propose the route, a fallback, and a list of public datasets
with licences for me to approve.
```

**The AI builds** (in `ml/`)
- `configs/classes.yaml`, a TACO-to-eight-class mapping script writing YOLO-format labels, adapters for the approved public datasets, a negatives set, and split scripts that produce train, validation, and a **public held-out** set.
- Label Studio import and export helpers for the local golden set.
- A Kaggle notebook (thin wrapper over `src/`) that trains from COCO-pretrained nano weights with resumable checkpoints, evaluates on the public held-out set (and on the local golden set when present, reported separately), exports TFLite with a pinned command and fixed input size, runs the **export-contract test** (tensor shapes and layout match the manifest; TFLite outputs match the PyTorch model on 10 reference images), and runs a smoke test.
- Outputs: `snappick_det_v0.tflite`, `model_manifest.json` (section 5.6), `metrics.json` (mAP@0.5, mAP@[.5:.95], per-class AP and recall, false positives per image on the negatives set, model size), and a README with the exact Kaggle steps.
- A script that evaluates the golden set through the same compression path as uploaded images (800 px, JPEG quality about 0.65).

**Verify**
- The notebook runs end to end on Kaggle with GPU.
- `metrics.json` shows per-class AP on the public held-out set. Low values are acceptable: this is the M0 baseline and domain gap is expected.
- If a local golden set exists, its results are reported separately and labelled as such.
- TFLite export is within 1 mAP@0.5 point of the PyTorch model, or the gap is documented.
- The export-contract test passes, and the `.tflite` loads in a Python interpreter and detects objects on a sample image.
- `model_manifest.json` matches section 5.6, and the SHA-256 matches the file.
- Every dataset's licence and source is recorded.

---

## Phase 5: On-device scan and review sheet

**Goal.** Take a photo, see coloured boxes, edit items in the review sheet, and reach the Request button, all offline, with stage timings recorded.
**Plan sections.** 2 (scan), 3, 6.
**Depends on.** Phases 1 and 2 (model from Phase 4, or the spike's COCO model as a placeholder).

**Manual work before**
- Copy `snappick_det_v0.tflite` and `model_manifest.json` into `apps/mobile/assets/models/` (outside `src/app`).
- If Phase 4 is not ready, copy the spike's COCO YOLO `.tflite` into the same folder and tell the AI. It will use a temporary manifest that maps COCO classes such as bottle and cup to app classes, so you can test the plumbing.
- Record `npm ls react-native-fast-tflite react-native-nitro-modules` in `docs/ENVIRONMENT.md` after install.

**Prompt**
```
Implement Phase 5 (On-device scan and review sheet) as described in the guide.
```

**The AI builds**
- `react-native-fast-tflite` with `react-native-nitro-modules` (pin the installed versions), Metro config for `.tflite`, `expo-camera`, gallery picker (for testing), `expo-image-manipulator`, `jpeg-js`, and `base64-js`. Load models with the delegates list (`[]`) and pass and receive `ArrayBuffer`s. Read `scripts/spike/App.tsx` as the working reference.
- Pure TypeScript modules with unit tests: **letterbox preprocessing and inverse box mapping**, channel layout from the model's input tensor shape, output decoding for the manifest's format (both attributes-first and transposed layouts, normalised or pixel units), class-wise NMS, the confidence policy with per-class thresholds, and a manifest-versus-tensor-shape check with a readable error. NMS is skipped only when the manifest says post-processing is in the model.
- A letterbox-or-stretch switch (from the manifest or a debug flag) so experiment E6 can compare them.
- **Preprocessing optimisation:** resize once, avoid the double JPEG encode the spike used, and target under 1 s (spike baseline about 1.5 s).
- Rules engine (class + condition + rule set → decision) using bundled `perak_general` rules, with unit tests.
- Detection overlay using positioned Views (dashed border for uncertain boxes), with labels and scores.
- **Review items** bottom sheet: one row per detected box, tap-to-highlight in both directions, condition selector defaulting to clean and dry with a single **Everything looks clean and dry** confirmation, change label, remove, **Add item not in photo**, a read-only aggregate header, and the "any batteries, bulbs, e-waste not shown?" question.
- **Request pickup** button, enabled when at least one item is eligible (opens a placeholder until Phase 7).
- Debug overlay showing preprocess, inference, and decode times in milliseconds.

**Verify**
- Airplane mode: scanning still works.
- Boxes line up with real objects (test with a bottle and a can on a table, and a mixed pile).
- Colours follow the rules; a low-score detection appears grey dashed and can be confirmed, changed, or removed.
- Setting an item to wet or broken turns it red and removes it from the pickup list.
- Tapping a row highlights its box and tapping a box scrolls to its row.
- Stage timings are shown. Record preprocess, inference, and decode in `docs/results/` and compare with the spike baseline (1.5 s, 350 ms, 110 ms).
- A deliberately mismatched manifest shows a readable error instead of wrong boxes.
- Denying camera permission shows a helpful message rather than crashing.
- Unit tests pass (letterbox round trip, decode, NMS, rules).

---

## Phase 6: Guidance engine (local rules and cached LLM advice)

**Goal.** Item-level advice from a reviewed cache, the LLM, or offline fallback, and rule-set resolution.
**Plan sections.** 5, 7.
**Depends on.** Phases 2 and 5.

**Manual work before**
- OpenAI account and API key, with a **monthly usage limit** set in the billing settings. If you cannot add a payment method, skip the key: the function runs in templates-only mode (reviewed templates and bundled advice) and the phase still passes, with the LLM checks marked skipped.
- Store the key: `npx supabase secrets set OPENAI_API_KEY=...`.
- Confirm with the AI the current recommended small model name and Structured Outputs usage from the official docs.

**Prompt**
```
Implement Phase 6 (Guidance engine) as described in the guide. Check current OpenAI
Structured Outputs documentation before writing the function.
```

**The AI builds**
- Edge Function `get-guidance`: input validation, per-item cache lookup (key: locale + rule set id + rule set version + class + condition + quantity band), OpenAI call with a strict JSON schema, 4.5-second timeout, one retry on transient errors, output validation, cache write, and reviewed-template fallback. A daily budget counter in `llm_usage` triggers fallback when the cap is reached.
- An `LLM_ENABLED` setting so the function can run in templates-only mode.
- Reviewed templates for every class and condition (`supabase/seed/advice_templates.json`) and a script that pre-generates advice for admin review.
- `bundled_advice.json` in the app, and guidance UI per item with a source badge (reviewed, generated, or fallback).
- Rule-set resolution: last confirmed district, else `perak_general`; optional "Use my location for local guidance" (permission requested only on tap) via `resolve_rule_set`.

**Verify**
- First request generates advice and stores it; the second identical request returns `source: cache`.
- Airplane mode shows bundled advice.
- Forcing a timeout (documented flag) returns fallback advice within about 5 seconds.
- Function logs contain no user ID, image, note, or coordinates.
- Reaching the daily cap returns fallback advice.
- Users cannot write to `instruction_cache` directly (RLS test).

---

## Phase 7: Pickup request

**Goal.** From a scan result, pin a location, pass the Perak geofence, and create a pending request with a masked public point.
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
- District import script and seed.
- RPC `create_pickup_request`: one transaction that validates the user, items, restricted-item confirmation, and geofence (`ST_Contains`), resolves district and rule set, writes the public row (grid-snapped), the private row, and the item checklist.
- Rule re-evaluation when the pin's district has a more specific rule set, the out-of-area message, and Activity → **My Requests** (list and cancel).

**Verify**
- A pin in Ipoh succeeds; a pin in Kuala Lumpur or Penang is blocked in the app **and** when calling the RPC directly with those coordinates.
- The public row has snapped coordinates; the private row has exact ones.
- A second user cannot read the private row.
- Submitting without the restricted-item confirmation is rejected.
- Offline shows "Connect to submit pickup" and disables submit.
- Rule set id and version are stored on the request.
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
- App model manager: check for an eligible version (approved and `hash(user_id) mod 100 < rollout_percent`), verify `min_app_version` and free space, download, verify SHA-256, check the model's input and output tensor shapes against its manifest, run a smoke test on a bundled reference image, then switch atomically. Downloaded models are loaded from a `file://` URL. It keeps the previous model and falls back to the bundled model on any failure.
- Active model version recorded on every scan, and an About or debug screen showing it.
- SQL function and daily job filling `drift_daily` (mean top score, uncertain share, correction rate per class, collector mismatch rate).
- Admin helpers (approve, rollback) that write to `audit_log`, with a minimal admin-only screen if practical.

**Verify**
- Approve at 100%: the app downloads and reports the new version.
- A tampered file (wrong hash) is rejected and the old model stays.
- A model that fails the smoke test falls back automatically.
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
- Experiment scripts E1–E6 in `ml/experiments/` (learning curve, label strategy, sampling strategy, forgetting with and without replay, real pilot comparison, on-device stage timings with letterbox vs stretch, fp32 vs fp16, and CPU vs GPU delegate), writing tables and plots to `docs/results/`, with the simulated stream clearly labelled as simulated.
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
