# SnapPick Implementation Plan (Revision 6: Malaysian SAS guidelines, SnapBot AI, and continuous learning)

**Project:** SnapPick is an on-device AI recycling assistant and community pickup app for Perak, Malaysia. Residents photograph household waste, receive instant Malaysian Separation at Source (SAS) sorting and preparation guidance, request pickup for accepted recyclable materials within supported service boundaries, consult SnapBot AI for recycling questions, and track privacy-safe impact statistics.

**Scope decision:** This is a Final Year Project pilot, not an official municipal collection service. Sorting guidelines are unified under the standard Malaysian Separation at Source (SAS) framework for all seven detector classes, with instant on-device visual preparation cards and SnapBot conversational AI guidance. Community pickup requests are bounded to supported pilot service areas (Perak districts) using PostGIS geofencing.

---

## Research focus and delivery priorities

**Research area:** machine learning, specifically continuous learning for on-device waste detection. The central claim is that SnapPick's detector improves from consented user images, verified by community collectors and reviewed by an admin, through a reproducible, gated retraining pipeline. The improvement is measured, not asserted.

**Research questions**

- **RQ1:** Does retraining on verified user-contributed images improve detection of household waste in Perak compared with a static baseline model?
- **RQ2:** Which label source gives the most improvement per labelled image: admin annotation, collector-consistent pseudo-labels, or user corrections?
- **RQ3:** Does replaying earlier data prevent forgetting of existing classes?
- **RQ4:** Does uncertainty-based selection of images to annotate beat random selection for the same annotation budget?

**Delivery priorities.** All functions described in this plan remain in the design. Only the implementation depth differs.

| Tier | Contents | Approach |
|---|---|---|
| Core product | Auth, scan, review sheet, pickup request with geofence, claim, navigate, complete, public dashboard | Built fully |
| Research core | Continuous-learning pipeline (Section 10): feedback capture, label tiers, dataset build, training, gate, registry, rollout, monitoring | Built end to end and run for real and simulated cycles |
| Supporting | Proof photo, requester confirmation, cached LLM guidance, model download and rollback, notifications | Built |
| Simplified but retained | Disputes, rule-set administration, retention pruning, staged rollout | States, tables, and logic kept. Disputes start with a simple admin list or Supabase Studio, rules are versioned files first, pruning is a tested function with a schedule, and rollout is tested at 10%, 100%, and 0% |

---

## Phase 0: Spike findings (completed). These override earlier assumptions

A separate `waste-app` smoke app was run on a real Android phone before the SnapPick scanner was built. It proves that the temporary YOLOv8n float32 TFLite model loads and draws multi-object boxes on device. **The real project is built from scratch in this repository and a new Supabase project.** The smoke model and its verified seven-label order are carried forward as the initial model contract and immutable bundled fallback. The temporary dataset/model prove the product and continuous-learning flow; they are not presented as the final research dataset/model.

| Check | Result |
|---|---|
| Build on Expo SDK 57, React Native 0.86, new architecture, Android | Pass |
| On-device inference (CPU, 384 px input, YOLOv8n float32) | Pass in `waste-app`; timing must be measured again in SnapPick |
| Preprocessing (centre crop, resize, JPEG decode, tensor) | Pass; timing must be measured again in SnapPick |
| Output decode and NMS | Pass; timing must be measured again in SnapPick |
| Multi-object boxes | Pass in the smoke app |
| Map pins, tap, remove, Navigate (MapLibre, no API key) | Pass |

**Decisions taken because of the spike**

1. **Detector is YOLO (Ultralytics) exported to TFLite**, replacing EfficientDet-Lite. The spike proved it on-device, and TFLite Model Maker (the old training route) is deprecated.
2. **Export format is not fixed by the library.** The smoke app handles a channels-first or channels-last input and raw YOLO output, then runs NMS itself. The exact shipped artifact metadata remains unverified until inspected with a TFLite interpreter. The model manifest therefore declares input shape/layout, output layout, box units, and whether post-processing is included. An export-contract test checks every model.
3. **The temporary baseline stays at 384 x 384.** It was trained/exported at that size and is already phone-tested. A 640 candidate is an experiment only after enough local data exists; it ships only if accuracy gains justify its measured device cost.
4. **The bundled fallback keeps centre-crop preprocessing.** It must not silently change. Future manifests may declare `centre_crop` or `letterbox`; candidates are trained and evaluated with their declared path. Letterbox is a later controlled experiment because it preserves edge objects, not a prerequisite for continuing development.
5. **Maps use MapLibre with the OpenFreeMap style (no key)**. MapTiler is the fallback. `Marker` has no built-in clustering, so pin counts per grid cell come from the server.
6. **Android only.** iOS items (APNs, TestFlight, CoreML) are dropped. FCM is kept.
7. **Temporary baseline first.** Development begins with the verified temporary Kaggle dataset/model. The owner later collects a local training set and a separate frozen golden evaluation set, then retrains without changing the seven labels. See Section 3 and `docs/MODEL_IMPROVEMENT_GUIDE.md`.
8. **Confident false detections exist.** The generic model called a random object "bicycle" at 0.90 confidence. Training and the golden set therefore include a negatives set, and false positives per image on negatives is a release-gate metric.
9. **Hazards stay manual-only.** Batteries, bulbs, e-waste, and other hazards are safety declarations; the seven-label detector does not claim to detect them.
10. **Licence note.** Ultralytics code and weights are AGPL-3.0. This is acceptable for an academic FYP, must be stated in the report, and should be confirmed with the supervisor because the app is distributed to pilot users.

**Known gotchas (also recorded in `AGENTS.md`)**

- Keep model files outside `src/app`; Expo Router treats that folder as routes.
- Metro needs `tflite` added to `resolver.assetExts`.
- The fast-tflite API changed: models load with a delegates list (`[]` for CPU), and `run` takes and returns `ArrayBuffer`s. Pin the installed versions, and do not guess APIs.
- MapLibre coordinates are `[longitude, latitude]`. It supports only the new architecture and is not available in Expo Go.
- A native library change (including the map) needs a native rebuild, not a reload.

**Schema design requirements (built into the Phase 2 schema from the start)**

An earlier schema review showed what the detection tables must contain. The fresh schema includes these from day one:

| Table | Requirement |
|---|---|
| `detections` | One row per detected box, or per user-added item. Columns: model label, app class, score, optional second-best label and score (nullable), `box_x1`, `box_y1`, `box_x2`, `box_y2` (normalised 0 to 1, relative to the EXIF-corrected original photo; null for user-added items), `source` (`detector` or `user_added`, default `detector`), condition, eligibility, and `quantity` (1 for detector rows, above 1 only for user-added rows). |
| `scans` | Model version, rule-set id and version, consent flags, image path, retention date, plus `image_width`, `image_height`, `preprocess_ms`, and `inference_ms` (nullable integers). |
| `label_feedback` | Keeps both the original and the corrected class and condition, the feedback type, and the collector verification time. |
| Class columns | Plain text, never database enums. Valid values come from the model manifest and the rule set, so adding a class such as battery later needs no migration. |

---

---

## 1. Roles and navigation

SnapPick is **unilateral**: every authenticated user is both a requester and a potential community collector. There is no collector-mode switch, application, or separate account type.

| Role | Can do |
|---|---|
| User | Scan waste, view Malaysian SAS guidance & animations, chat with SnapBot AI, create/cancel pickup requests, browse and claim nearby requests, upload proof, and confirm or dispute completed pickups. |
| Admin | Review feedback corrections, approve retrained model releases, and handle reports. |

Bottom navigation is **Home, Activity, Scan, Request, Profile**. The Request tab always shows the map of pending requests. Activity has two sections: **My Requests** and **Pickups I Claimed**. Home features the **SnapBot AI Assistant** and live **Your Recycling Impact** statistics (total scans, verified items, active pickups).

---

## 2. User flow

### Sign-up and sign-in

- Users register or sign in with email/password or Google OAuth.
- The first session asks for image-storage consent and community-pickup safety acknowledgement.
- Home shows total scans, verified recyclable items, active requests, and recent activity.

### Scan

1. The user photographs one or more household-waste items.
2. A YOLO detector (TFLite) detects visible objects on the device.
3. The app draws a labelled box:
   - **Green:** accepted recyclable item.
   - **Amber:** recyclable after cleaning, confirmation, or local-rule check.
   - **Red:** general waste or not accepted for community pickup.
   - **Grey dashed:** uncertain detection, such as “Plastic bottle? (65%)”.
4. The user can tap an uncertain box and choose **Confirm**, **Change label**, or **Remove**. Corrections become training feedback.
5. If at least one accepted recyclable item exists, **Request pickup** appears.
6. Other items show appropriate disposal or preparation guidance.

The Scan result screen includes one editable **Review items** bottom sheet, rather than one modal per item. It uses **one row per detected bounding box**, not one editable aggregate row. Tapping a row highlights its matching box; tapping a box scrolls to its row. Each row shows the detected class, confidence, condition selector, eligibility colour, and remove/change-label controls. This permits three bottles in one photo to have different condition outcomes. A conditional item marked contaminated/wet, broken/unsafe, or unknown turns red immediately and is removed from the pickup list.

The sheet header shows a read-only aggregate, such as “3 plastic bottles detected; 2 eligible.” Users cannot change a detected quantity from 3 to 4 because an extra item has no box or evidence. They may use **Add item not in photo** to declare an additional item; it has no overlay, stays separate from detector feedback, and requires manual condition confirmation.

To keep scanning fast, conditional items default to "clean and dry" with a single **Everything looks clean and dry** confirmation. Users change individual rows only when needed, and the condition check is repeated at request time. Contribution to model improvement is a separate, revocable opt-in in Profile → Privacy ("Help improve SnapPick"). Only when it is on does the app upload compressed scan images, prioritised by the active-learning rules in Section 10.3, with a daily per-user upload cap.

### Pickup request

1. The requester reads the preparation checklist: keep materials clean and dry, consolidate accepted recyclables into one bag, and separate restricted items.
2. They use GPS auto-detect or drag a pin on the map.
3. They enter house/unit number, street, optional landmark, optional access instructions, and a pickup note. This supports apartments, gated areas, and landed homes.
4. The server checks that the location is inside a supported Perak service polygon. Out-of-area requests cannot continue.
5. The app refreshes the local rule set after the pin is chosen. If the selected district has a more specific rule set than the scan used, it recalculates eligibility and regenerates only the affected guidance before submission.
6. If restricted items were detected, the user must explicitly confirm that they have removed every restricted item before submitting. The request may continue with its eligible items only; its checklist states, for example, “Pack 2 plastic bottles. Leave out 1 battery.”
7. The request starts as **pending**.

### Collector map and activity

- Pending requests appear as approximate-area pins only.
- Tapping a pin shows accepted waste types, approximate area, pickup window, and access constraints—not the exact address.
- **Claim pickup** runs an atomic server-side claim. The winning collector then fetches protected address and navigation details.
- A collector can release a claimed job. Unstarted claims automatically return to pending after a configurable window, initially 24 hours.
- The collector uploads a proof-of-pickup photo before completion. The requester can confirm it or raise a dispute.
- Statuses: pending, accepted, in_progress, awaiting_confirmation, completed, not_collected, cancelled, expired, and disputed.

### Public dashboard

- No login is required.
- The dashboard shows aggregate pickup counts, pending/completed trends, material breakdown, and district-level totals/heatmaps.
- It never shows exact homes, notes, photos, or identities.

---

## 3. Household-waste class taxonomy and realistic training scope

The temporary dataset's class IDs were visually verified by the owner in the working smoke app. SnapPick preserves these seven labels and their exact order. **Do not rename, merge, or remap them during import, training, export, feedback capture, or display.**

| ID | Detector/app class | Dataset meaning used by the verified baseline | Default pickup decision |
|---|---|---|---|
| 0 | `metal` | Metal items, including cans | Conditional: confirm locally accepted, clean, and safe |
| 1 | `trash` | Masks, diapers, wrappers, and mixed trash represented by the source dataset | Not accepted |
| 2 | `glass` | Jars, glasses, and other glass represented by the source dataset | Conditional: confirm locally accepted and not broken/unsafe |
| 3 | `paper` | Magazines, newspapers, and paper | Conditional: clean and dry |
| 4 | `cardboard` | Cardboard, cartons, and boxes represented by the source dataset | Conditional: clean, dry, and locally accepted |
| 5 | `plastic` | Plastic items represented by the source dataset | Conditional: user/local-rule confirmation is required because the class is broad |
| 6 | `biological` | Food and biological waste represented by the source dataset | Not accepted |

Broad visual labels do not by themselves prove pickup eligibility. The guidelines combine class and condition state. Safety declarations for batteries, bulbs, e-waste, chemicals, sharp objects, and other hazards stay manual; the detector does not claim to recognize them. The review checklist always asks whether restricted or hazardous items are present.

### Baseline dataset and FYP training plan (temporary model first)

**Strategy.** The existing `waste-app` model is **M0**, the initial champion, and the immutable model bundled with the APK. It was trained from `sumn2u/garbage-classification-v2-bbox-384` with the seven verified labels, YOLOv8n, 384 x 384 input, float32 TFLite export, and centre-crop inference. It proves the scanner and model-lifecycle flow while the owner collects local data. It is temporary and is not claimed to be the final research model.

- Preserve the label strings and order for every future model unless a separately approved breaking taxonomy revision is performed.
- Audit and record the temporary dataset's source, licence, version/download identifier, class counts, split seed, and known limitations. Verification by the owner resolves the class-order question but not licence or representativeness.
- Copy the exact working model as a versioned, checksum-verified bundled fallback. Never overwrite it with a downloaded model.
- Build a **local training set** from owner and consented-user photos. It may grow and be retrained on.
- Build a separate **local golden evaluation set** from different capture sessions. Freeze and hash it; never train on it or tune against individual images. Start with 20 to 30 instances per class and grow to at least 50 per class before final experiments.
- Collect a frozen negatives set of non-waste scenes and confusing household objects to measure false positives.
- Minimum training milestone: at least 150 verified instances per class, aiming for 300 or more and expanding the weakest/most varied classes first. These are instance counts, not photo counts.
- Record provenance and consent for every source in `dataset_versions`; manifests contain random sample/session IDs, never user IDs or private pickup data.
- Use Google Colab or Kaggle for finite, checkpointed runs. Warm-start later candidates from the current champion while retaining replay data.
- Follow `docs/DATASET_COLLECTION_GUIDE.md` when taking photos and `docs/MODEL_IMPROVEMENT_GUIDE.md` when building, evaluating, and promoting a candidate.

Each class maps to a recyclable state and step-by-step preparation instructions through the on-device Malaysian Separation at Source (SAS) guideline dictionary. National guidance includes paper/cardboard, glass, plastic, and metal as recyclable material families. [SWCorp material categories](https://www.swcorp.gov.my/sisa-domestik-dan-pembersihan-awam/)

### Condition confirmation

Some properties cannot be trusted from a photo alone. For conditional classes, the app asks whether the item is clean and dry, contaminated/wet, broken/unsafe, or unknown. Final eligibility is calculated from **class + condition state + community recycling guidelines**.

### Training scope

Start with the broad classes above. Only split a class into more detailed labels later if verified feedback shows that the broader label is causing a recurring decision or accuracy problem.

---

## 4. Technology stack

| Layer | Technology |
|---|---|
| Mobile app (Android only) | Expo-based React Native + TypeScript: Expo SDK **57.0.25** (at least 57.0.9, which fixes a Hermes memory issue), React Native **0.86**, React **19.2.3**, new architecture only, Node.js **22.13+**. Use a development/production build, not Expo Go. |
| Repository | One Git monorepo with independent package roots: `apps/mobile`, `apps/dashboard`, `ml` (Python), `supabase`, `docs`, `scripts`. There is no shared JavaScript workspace, so Expo's exact React Native and React versions never conflict with the dashboard. Expo supports npm workspaces if code sharing is ever needed. |
| Navigation | Expo Router. Keep non-route files (models, assets) outside `src/app`. |
| Camera and image | expo-camera, expo-image-manipulator, plus jpeg-js and base64-js for pixel decoding (spike-proven). Revisit a faster decode path if preprocessing stays above 1 s. |
| On-device detection | react-native-fast-tflite with react-native-nitro-modules. **Pin the versions installed in the smoke app.** YOLOv8n exported to TFLite (float32, 384 px bundled baseline). CPU first; 640 px and GPU are later measured experiments. NNAPI is deprecated on Android 15 and is not used. |
| Detection overlay | React Native Views positioned over the photo (spike-proven). SVG only if dashed borders misbehave. |
| Maps and location | MapLibre React Native (Expo config plugin, new architecture, not Expo Go) with the **OpenFreeMap** style (no key; confirm its terms and attribution for the pilot). MapTiler is the fallback. expo-location for GPS. Navigate uses the Android navigation link with a generic map link as fallback. |
| Backend | Supabase Auth, Postgres, PostGIS, Storage, Realtime, Row Level Security, Edge Functions, and database RPC. Supabase JS **2.117.2**. |
| LLM | OpenAI API through Supabase Edge Functions only (`snapbot-chat`), using server-side schema validation and response caching in `instruction_cache` to minimize token consumption. |
| Notifications | expo-notifications with FCM (Android only). |
| Public dashboard | Next.js **16.3.6**, TypeScript, Recharts, MapLibre GL JS. |
| Dashboard hosting/cache | Vercel with Next.js revalidate/Data Cache. Cache aggregate views for 5 to 15 minutes. |
| Pipeline orchestration | GitHub Actions (scheduled and manual dispatch) running the `snappick-ml` repository. |
| GPU training | Ultralytics YOLO (PyTorch) on a Kaggle notebook driven by CLI/API, or Colab as the manual fallback. TFLite export with a pinned command and an export-contract test. |
| Experiment tracking | `training_runs` table plus TensorBoard or Weights & Biases. |
| Annotation | Label Studio or CVAT. Confirm its YOLO-format export in Phase 4. |
| Model registry | model_versions table and versioned TFLite files in Supabase Storage. |

Install Expo packages through its compatibility installer, rather than manually selecting incompatible versions.

The version numbers above are targets. Re-verify current versions and compatibility at project start and pin what the spike installed (`npm ls` output). The app is Android-only, so no Apple developer account is needed.

---

## 5. Community guidelines and service area boundary

The app provides instant guidance without requiring location permission:

1. Scanning and sorting advice work 100% offline using the bundled **Community Recycling Guidelines** (Malaysian SAS standard for all 7 detector classes).
2. Preparation instructions and 720p animated visuals render directly on the device with zero network delay.
3. Location permission is never required for scanning; it is requested only when pinning a pickup location on the map.
4. When a requester sets a pickup pin, the server validates through PostGIS that the location falls within a supported community service district (Perak DOSM boundaries). Out-of-area pins are blocked.
5. The guideline identifier and version are saved with the scan and pickup request for data integrity and auditability.

---

## 6. Computer vision pipeline

### Image preparation

Preprocessing is **model-contract driven**, done in code on decoded pixels:

1. Read input width, height, resize mode, normalization, dtype, and expected layout from `model_manifest.json`.
2. For the immutable M0 fallback, centre-crop the largest square from the EXIF-corrected photo and resize it to 384 x 384. The UI shows the analysed square. Do not silently change this model to letterbox.
3. A future candidate may declare `letterbox`: resize the whole photo proportionally and pad the unused area. Train and evaluate that candidate with the same declared path.
4. Arrange channels as the model expects. Read the actual input tensor shape (channels-first `[1, 3, H, W]` or channels-last `[1, H, W, 3]`) and check it against the manifest. A mismatch is a readable model-level error.
5. Decode according to the declared output contract, apply class-wise NMS only when post-processing is not embedded, then invert the declared image transform when drawing boxes. Store boxes normalized to the full EXIF-corrected original photo.

Centre crop has the strongest evidence for M0 because it works in the smoke app, but it excludes edge content. Letterbox preserves the whole scene and is the preferred later experiment for mixed/multi-object photos. Compare 384 centre crop, 384 letterbox, and optionally 640 letterbox on the same frozen golden set and reference phone; promote only through the normal gate.

### Performance budget

| Stage | Current M0 evidence | Target |
|---|---|---|
| Preprocess | Works in smoke app; not timed in current audit | Establish baseline, then target under 1 s |
| Inference (CPU) | Works in smoke app; not timed in current audit | 500 ms or less |
| Decode + NMS | Works in smoke app; not timed in current audit | 150 ms or less |
| End to end | Works in smoke app; not timed in current audit | 3 s or less |

Every scan records `preprocess_ms` and `inference_ms`, which also feed the drift statistics.

### Confidence policy

- Score **0.80 or higher:** label the predicted class and evaluate eligibility through rules.
- Score **0.40 to 0.79:** show grey dashed "Class? (score)" and ask the user to confirm, change, or remove it.
- Score **below 0.40:** show nothing.
- These are initial defaults. Detector scores are not calibrated probabilities, so per-class thresholds are tuned on the validation set and shipped in the model manifest.
- A high score does not guarantee correctness (the spike saw 0.90 on a wrong object). The negatives set in training and the always-available review sheet are the safeguards.

### Model availability, update, and rollback

- Bundle the first model in the app assets, so scanning works offline on first launch.
- Download an update only after checking its manifest, SHA-256 hash, app compatibility, and free storage. Downloaded models are stored on the device and loaded from a `file://` URL.
- Before switching, check that the new model's input and output tensor shapes match its manifest, then run a smoke test on a bundled reference image.
- Keep the prior model until the candidate loads and passes the smoke test.
- If a new model fails any check, delete it and fall back to the bundled or prior known-good model.
- Use deterministic staged rollout: stable hash of user ID modulo 100 is lower than the rollout percentage.

---

## 7. Guidance engine and SnapBot AI assistant

SnapPick separates routine sorting guidance from conversational AI to ensure zero-latency scanning while providing helpful assistance:

### 1. On-Device Malaysian SAS Guidance (Scan Screen)
- For all 7 classes, the app bundles the official **Malaysian Separation at Source (SAS)** dictionary (`malaysianSas.ts`) with clear step-by-step preparation cards (e.g. "Empty & Rinse", "Squash Flat", "Remove Cap").
- High-quality 720p animated WebP illustrations render inside collapsible review cards to demonstrate preparation steps visually.
- Fully offline: zero network roundtrips, no API keys, and instant UI responsiveness.

### 2. SnapBot Conversational AI (Home Screen)
- Residents can tap **Ask SnapBot** on the Home screen to ask free-form sorting, recycling, and hazard questions.
- Powered by Supabase Edge Function `snapbot-chat` with strict recycling system instructions and safety declarations for hazardous materials (batteries, e-waste, chemicals, bulbs, sharp objects).
- **Caching & Privacy:** Deterministic SHA-256 question hashing in `instruction_cache` avoids redundant LLM invocations and saves tokens.
- Never sends user IDs, exact coordinates, images, or personal notes to the LLM.
- **Offline & Rate Limiting:** Daily usage rate limiting per user, with automatic fallback to bundled guidance if offline or if the API is unreachable.

### Fully offline behaviour

Offline scanning always returns bounding boxes, eligibility based on community guidelines, and Malaysian SAS preparation cards without contacting Supabase or OpenAI. Creating or claiming a pickup requires connectivity and is disabled with a clear "Connect to submit pickup" message while offline.

---

## 8. Pickup, privacy, and realtime design

### State handling

- Claim is one conditional server-side update from pending to accepted; only one collector wins. The update also requires that the requester is not the collector, and the server limits each user to a small number of simultaneous active claims (initially 3) with rate limits.
- The assigned collector taps **Start pickup** when travelling or beginning collection, moving accepted to in_progress. This makes the state meaningful in the requester’s Activity view.
- The collector may release an assignment back to pending before uploading proof.
- A scheduled job releases accepted requests that have not started within 24 hours.
- Before proof upload, the collector sees the requester’s accepted-item checklist, for example “2 × plastic bottle; 1 × cardboard”. For every line they enter collected quantity, verified condition, and—if not collected—a reason such as contaminated, missing, or unsafe.
- Completing the checklist writes collector verification into pickup_waste_items and label_feedback. This is the high-confidence feedback used by the continuous-learning pipeline; a proof photo alone is not treated as verification.
- If collected quantity is zero for every checklist row, the collector must choose a non-collection reason and upload a mandatory evidence photo of the bag/location. The request moves from in_progress to not_collected, not awaiting_confirmation. The requester may create a new request from the eligible checklist after fixing the problem; the original request is never silently returned to pending.
- If one or more eligible items were collected, the assigned collector uploads proof and moves in_progress to awaiting_confirmation.
- The requester can confirm, which moves awaiting_confirmation to completed, or dispute it within 48 hours. If there is no dispute after 48 hours, a scheduled job auto-completes the request.
- A dispute creates a case for the admin screen with the original checklist, collector verification, proof photo, and timestamps. It is a recorded FYP workflow, not a trust-score or penalty system. Implementation note: the states and tables are kept. Admin review can start as a simple list or Supabase Studio, and a lightweight "Report a problem" entry point may precede the full dispute screen.
- Dispute terminal states are explicit: an **upheld** dispute changes the request to not_collected; a **rejected** dispute changes it to completed; an **inconclusive** dispute changes it to completed with dispute_outcome=inconclusive. A request is never reverted to pending after dispute resolution because the bag may no longer exist; the requester can explicitly relist eligible items.

### Atomic request creation and map masking

The app calls one authenticated create_pickup_request RPC/Edge Function, rather than inserting public and private records from the client separately. Inside one database transaction it:

1. validates the signed-in requester, selected items, restricted-item separation confirmation, and Perak geofence;
2. resolves the district and assigns the active community guideline;
3. creates the public request row and its private-details row;
4. writes the accepted item checklist; and
5. returns the new request ID.

The server produces the public point with PostGIS ST_SnapToGrid using a 0.01-degree grid (roughly one kilometre, varying by latitude). This is applied to the stored public geometry, not calculated in the client. The exact geometry remains only in the private table. Requests that snap to the same grid cell are shown as one marker with a count, rather than stacked on one point. The counts per cell are computed on the server (a view grouping pending requests by snapped point), because MapLibre's `Marker` has no built-in clustering.

### Precise-location protection

Never place exact coordinates or full address in a Realtime-visible pickup table.

- pickup_requests_public contains status, material summary, district, pickup window, and a deliberately rounded/grid-snapped map point.
- pickup_request_private_details contains exact point, unit, street, landmark, and access note.
- An authenticated Edge Function releases private details only when collector ID matches the signed-in user and request status is accepted or in progress.
- The collector map subscribes only to the safe table/view/channel.

### Image minimisation

- Downsample consented scans and proof images on device to a maximum width of 800 pixels and JPEG quality around 0.65.
- Strip EXIF/GPS before upload.
- Do not upload raw camera images by default.
- Warn users not to include faces, identity documents, vehicle plates, or children.
- Retain ordinary scan images for a short configurable period (for example 90 days), then delete them unless separately approved for training.
- Account deletion removes the profile, scans, and proofs and is available in the app. Images already used in a released training dataset are de-linked from the user (dataset manifests carry no user IDs), and users are told this at training opt-in.

### Automated 90-day pruning

A daily Supabase Cron job uses pg_cron to invoke a protected prune-expired-scans Edge Function. The job selects scan/proof records whose retention date has passed and are not training-approved, then the Edge Function deletes their Storage objects with the service-role server credential and deletes/updates the corresponding database records in batches. Each run logs object path, record ID, result, and error for audit/retry. Supabase Cron can run SQL/database functions or invoke Edge Functions; the function secret is stored in Supabase Vault. [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions)

---

## 9. Main data tables

- profiles — user details and community-pickup safety acknowledgement.
- pbt_rule_sets — community guideline metadata, version, label, and class rules.
- scans — model version, active rule-set ID/version, consent, compressed image path, image size, preprocess and inference timings, retention date.
- detections — one row per detected box (or per user-added item): model label, app class, score, normalised box, source (`detector` or `user_added`), condition state, eligibility result.
- label_feedback — user changes and collector verification.
- pickup_requests_public — safe summary, status, district, approximate location.
- pickup_request_private_details — exact location and access information.
- pickup_waste_items — requester quantity, accepted material list, preparation state, collector-collected quantity, collector-verified condition, and not-collected reason.
- pickup_proofs — proof or non-collection evidence image, time, requester confirmation/dispute state, and auto-completion time.
- disputes — requester reason, supporting context, admin resolution, and resolution note.
- instruction_cache — deterministic cache key, JSON advice, rule version, source, expiry.
- model_versions — version, dataset version, training run, SHA-256, size, metrics JSON, per-class thresholds, minimum app version, status, rollout percentage, and rollback state.
- feedback_samples — scan reference, label tier (A/B/C/D), review status, collector-count match flag, and training opt-in flag.
- dataset_versions — manifest hash, per-class and per-tier counts, source mix, licence notes, and golden-set flag.
- training_runs — trigger reason, dataset version, config hash, git commit, metrics, gate result, and rejection reason.
- drift_daily — per model version: mean score, uncertain share, correction rate per class, collector mismatch rate, and latency.
- perak_districts — PostGIS district polygons.
- push_tokens — device tokens for notifications.
- reports — user reports and blocks.
- audit_log — admin actions such as model approval and rule-set changes.

Assign district at request creation through PostGIS containment using verified district boundaries. This avoids paid reverse-geocoding and supports fast dashboard aggregation.

---

## 10. Continuous learning pipeline (research core)

### 10.1 Goal and principles

SnapPick's detector improves from consented user images through a reproducible, gated retraining pipeline, and every improvement is **measured, not asserted**. Five principles:

1. **Labels earn trust.** Raw user photos have no labels, so each sample carries a trust tier and only trusted tiers train the model.
2. **Nothing ships without passing a gate** against a frozen golden test set.
3. **Humans stay in the loop** for annotation of hard samples and for release approval.
4. **Everything is versioned and reproducible:** dataset, config, code commit, and model hash.
5. **The pipeline is code, not a server.** It runs on free CI plus a free GPU notebook, and the same scripts can move to a paid server later without redesign.
6. **The fallback is immutable.** The exact bundled M0 model remains inside every compatible APK and is never replaced on disk.

### 10.2 Pipeline architecture

```
App scan ──(opt-in, compressed image + detections + user edits)──▶ Supabase Storage + Postgres
                                                                        │
Pickup flow ──(collector checklist: class, count, condition)──▶ label_feedback ──▶ feedback_samples (tiered)
                                                                        │
                    Trigger check (scheduled daily, or manual) ─────────┤
                                                                        ▼
GitHub Actions (CPU):  1 export → 2 quality filter → 3 label resolution → 4 dataset build (versioned)
                                                                        ▼
GPU notebook (Kaggle or Colab):  5 train → 6 evaluate → 7 release gate → 8 export TFLite → 9 contract + smoke test
                                                                        ▼
GitHub Actions:  10 register (model_versions = candidate) → admin approval → 11 staged rollout → app downloads
                                                                        ▲                              │
                                        12 monitor (correction rate, confidence drift) ◀───────────────┘
```

- **Orchestrator:** a GitHub Actions workflow (scheduled and manually dispatchable) runs the CPU stages and calls the GPU stage.
- **GPU stage:** a Kaggle notebook driven through its CLI/API (free GPU quota), or a Colab notebook run manually as the fallback. Both run the same `train.py` and `evaluate.py` from the repository, with the notebook as a thin wrapper.
- **State:** all stage outputs and statuses are written to Supabase (`training_runs`, `dataset_versions`, `model_versions`), so the admin screen and dashboard can show pipeline progress.

### 10.3 Active learning at capture (which images to upload)

The app does not upload everything. For users who opted in to training, it prioritises the most informative scans:

- any box with score 0.40–0.79 (uncertain);
- any box the user changed or removed;
- scans where the detector's class counts differ from the collector's verified counts;
- a random 5% sample of confident scans, to estimate true error and calibration without selection bias.

A daily per-user upload cap applies. All images are compressed and EXIF-stripped on device (Section 8).

### 10.4 Label tiers

A pickup checklist gives class, count, and condition, **not bounding boxes**, so it cannot train a detector directly. It is used as a consistency check instead.

| Tier | Source | Boxes come from | Used for |
|---|---|---|---|
| A (gold) | Admin annotation in CVAT/Label Studio | Human | Training, validation, golden test set |
| B | Collector counts match the detector's counts (after user edits) | Detector, accepted as pseudo-labels | Training |
| C | User corrected a label | Detector box, class from user | Sent to the admin review queue; promoted to A after review |
| D | Confident, unreviewed predictions | Detector | Never trained on; used only for drift and calibration statistics |

The admin annotates a fixed budget per cycle (initially 100–200 images). Active-learning selection (10.3) spends that budget on the most informative images.

### 10.5 Dataset build and leakage control

- **Golden test set:** local Perak photos, at least 50 instances per trained class, annotated by the admin, frozen, hashed, and never used for training. A new golden set is created only as a new version, and all models are re-evaluated on both.
- **Validation set:** separate from the golden set, used for threshold tuning and early stopping.
- **Temporary-source held-out set:** the original temporary dataset validation/held-out slice, never trained on in that run. It documents M0 but does not replace the local golden set used for champion/candidate decisions.
- **Negatives set:** non-waste and clutter images used to measure false positives per image. It is part of both the validation and golden evaluation.
- **Compression path:** training images are stored at 800 px JPEG quality about 0.65, while the app resizes full photos at inference. Evaluate the golden set through the same compression path to expose any train/serve gap.
- **Split rules:** split by user or scan session, and remove near-duplicates across splits using perceptual hashing, so similar images never sit in both train and test.
- **Replay buffer:** each build combines all Tier A data with a class-balanced sample of earlier training data, so old classes are not forgotten.
- **Versioning:** every build writes a `dataset_versions` row with manifest hash, per-class and per-tier counts, source mix, and dataset licence notes.

### 10.6 Trigger policy

A retraining cycle starts when any of these is true:

- at least N new Tier A/B images have accumulated (initial N = 200), or at least 30 new instances exist for the weakest class;
- the 7-day user correction rate exceeds its baseline by a set margin;
- the admin triggers a run manually (used for demonstrations).

Guards: a minimum of 7 days between automatic runs, and the golden test set must be unchanged. A scheduled daily job checks the conditions and creates a `training_runs` row with status `queued`.

### 10.7 Training recipe

- **Framework:** Ultralytics YOLO (PyTorch). Record the Ultralytics version in every run.
- **Warm start** from the current champion model, not from COCO each time. M0 was trained from COCO-pretrained YOLOv8n weights.
- **Rehearsal** with the replay buffer, and a class-balanced sampler. Include the negatives set in every build.
- **Augmentation** matched to phone photos: brightness, blur, flip, and scale (tuned on top of the framework defaults).
- **Reproducibility:** fixed seeds and a frozen YAML config committed to the repository.
- **Free-GPU friendly:** finite runs with resumable checkpoints, sized to fit one session.
- **Export:** TFLite export with a pinned command and a fixed input size. After export, the **export-contract test** asserts the input and output tensor shapes and layout against the manifest, then compares TFLite outputs with the PyTorch model on 10 reference images.
- **Variants:** fp16 or int8 exports are optional experiments (E6). A variant ships only if it passes the same parity rule.
- **Tracking:** metrics and config logged to the `training_runs` table (and TensorBoard or Weights & Biases if used).

### 10.8 Evaluation and release gate

Every candidate is evaluated on the golden set and compared with the current champion on the same data. Metrics: mAP@0.5, mAP@[0.5:0.95], per-class AP and recall, false positives per image, calibration (expected calibration error), model size, and latency on a reference phone.

| Check | Initial rule |
|---|---|
| Overall accuracy | mAP@0.5 at least 0.5 points above the champion, or within the bootstrap 95% CI and clearly better on the targeted weak class |
| No regression | No class AP falls more than 3 points below the champion |
| Pickup-relevant recall | Recall for `metal`, `glass`, `paper`, `cardboard`, and `plastic` does not drop beyond the approved tolerance |
| Export parity | The TFLite model is within 1 mAP@0.5 point of the PyTorch model on the golden set (applies to any fp16 or int8 variant too) |
| Export contract | Input and output tensor shapes and layout match the manifest, and TFLite outputs match PyTorch on 10 reference images |
| Negatives | False positives per image on the negatives set do not increase |
| Size and latency | Size within budget. Median on-device model inference at most 500 ms and end-to-end scan at most 3 s on the reference phone; establish the SnapPick M0 baseline before comparing candidates |
| Smoke test | Model loads in the app harness and reproduces expected boxes on 10 reference images within tolerance |

These thresholds are starting values to be justified and adjusted in the report. A candidate that fails is marked `rejected`, the champion stays, and the metrics, configuration, hashes, and failure reason are stored. The rejected model artifact may be archived or removed according to storage policy, but the audit record remains. Verified consented samples return to the eligible data pool for later cycles; they are not deleted merely because one candidate failed. Failed cycles are also research data.

### 10.9 Registration, approval, and rollout

- Each `model_versions` row stores version, dataset version, training run ID, SHA-256, size, metrics JSON, per-class thresholds, minimum app version, status, and rollout percentage.
- Status path: `candidate` → `approved` (admin) → `rolling_out` → `stable`, or `rolled_back`.
- The model manifest also carries labels, input size, output tensor specification, and thresholds, so the app never hard-codes them.
- Rollout uses the deterministic rule from Section 6: stable hash of user ID modulo 100 is below the rollout percentage.
- The demonstration shows 10% → 100% and a rollback (percentage set to 0), with the app falling back first to a validated previous champion and always retaining the bundled M0 as the final fallback.
- Admin approval can start as an edit in Supabase Studio and later become a simple admin screen.

At activation, verify the manifest schema, SHA-256, exact seven labels and order, minimum app version, input/output tensor contract, and bundled-reference smoke test before switching atomically. A download, checksum, contract, load, smoke-test, or repeated inference failure disables that downloaded version locally and returns to the bundled fallback. A single unreadable photograph, no-detection result, or ordinary preprocessing error does not permanently roll back a model.

### 10.10 Monitoring and drift

A daily job computes per-model-version statistics into `drift_daily`: mean top score, share of uncertain boxes, user correction rate per class, collector mismatch rate, and latency or crash reports from the app. A rising correction rate can trigger a retraining cycle (10.6), and a sharp regression after a rollout triggers an automatic rollback proposal for the admin.

### 10.11 Repository and reproducibility

```
snappick-ml/
  configs/            frozen YAML (dataset, training, gate thresholds)
  src/                export, filter, labels, build, train, evaluate, convert, register
  notebooks/          thin GPU wrapper that calls src/
  .github/workflows/  ml-pipeline.yml (schedule + manual dispatch)
  tests/              unit tests for filters, label logic, gate logic
```

Every run is identified by a run ID that links the dataset hash, config hash, git commit, and model hash. A model card (data, metrics, known weaknesses) is generated for each version.

### 10.12 Experiments for the report

The pilot will have few users, so the evidence combines real and simulated cycles, and the report states clearly which is which.

- **M0 (baseline):** the verified temporary seven-class `waste-app` model and dataset. It is also the immutable bundled fallback.
- **Simulated stream:** split the local and collected images into four chronological batches that arrive as cycles, producing M1 to M4. This shows pipeline behaviour under controlled data arrival.
- **Real pilot cycles:** at least one or two cycles from actual pilot users, reporting correction rate before and after.

| ID | Experiment | Answers |
|---|---|---|
| E1 | Learning curve: golden-set mAP for M0 to M4 | RQ1 |
| E2 | Label strategy: Tier A only vs A+B vs A+B+C unreviewed | RQ2 |
| E3 | Sample selection: uncertainty-based vs random, same annotation budget | RQ2, RQ4 |
| E4 | Forgetting: with vs without replay | RQ3 |
| E5 | Real pilot: correction rate and per-class change across model versions | RQ1 |
| E6 | On-device: stage timings, model size, 384 centre crop vs 384 letterbox vs optional 640 letterbox, fp32 vs fp16 (int8 optional), CPU vs GPU delegate, across versions | Feasibility |

The expected direction (M4 better than M0 on the golden set and on a temporal hold-out of later images) is stated before running the experiments.

### 10.13 Ethics and privacy for training data

- Training use is a separate, revocable opt-in from image storage.
- Images are compressed and EXIF/GPS-stripped, and users are warned not to capture faces, documents, plates, or children.
- The admin can exclude any image from a dataset.
- Released dataset manifests carry no user IDs.
- Users are told at opt-in that withdrawing stops future use, but images already used to train a released model cannot be un-trained.

---

## 11. Dashboard and low-cost rollout

- Build aggregate Postgres views/materialized views by district, material family, date, and request status.
- Give the Next.js app a read-only role that can query aggregate views only.
- Suppress or merge counts below a minimum threshold (for example fewer than 5) so small districts cannot identify individuals.
- Add a public **Model transparency** panel showing model version history, golden-set mAP per version, and the date of each release. It is aggregate data only and doubles as research evidence.
- Cache dashboard aggregates in Vercel for 5–15 minutes.

| Stage | Approach |
|---|---|
| Prototype | Supabase Free, Vercel Hobby where its terms fit, FCM, Expo development builds, GitHub Actions (free tier), and a free GPU notebook (Kaggle or Colab). |
| Cost control | Upload compressed images only; short retention; OpenAI cache, one retry, 4.5-second timeout, budget alert, and local fallback. |
| Public pilot | Move to an always-on Supabase plan and an appropriate Vercel production plan before depending on the service publicly. |

Supabase Free currently lists 500 MB database, 1 GB file storage, and 5 GB egress, and projects can pause after inactivity. It is suitable for development, not an always-on public service. Check that the project is active before any demonstration. [Supabase pricing](https://supabase.com/pricing)

---

## 12. Explicitly out of scope for the MVP

- Official PBT/concessionaire workflow or a guarantee of regulatory compliance.
- Cash rewards, payouts, and trust-score penalties.
- Collection of e-waste, hazardous waste, medical waste, bulky waste, or broken glass.
- Continuous live camera detection.
- An iOS build (the app is Android-only).
- Automatic visual assessment of all contamination conditions.
- An always-on training server (VPS or GPU instance). The pipeline runs on free CI plus a free GPU notebook, and the same scripts can move to a paid server later without redesign.

These can be considered only after partner agreements, verified local rules, user-safety design, and sufficient labelled data.

---

## 13. Evaluation and testing plan

**Machine learning:** Section 10.8 metrics and Section 10.12 experiments.

**System tests**

- Row Level Security: a user cannot read another user's scans, private pickup details, or proofs.
- Claim race: concurrent claims on one request produce exactly one winner; a user cannot claim their own request.
- Geofence: points inside, outside, and on the Perak boundary behave correctly on both client and server.
- Offline: scanning works with no connection; request and claim are disabled with the correct message.
- Model update: bad hash, failed load, tensor-shape mismatch, and failed smoke test fall back to the previous validated model, with the bundled M0 as the final fallback.
- Detector contract: centre-crop and letterbox inverse mapping round-trip correctly, decode handles both output layouts, and NMS is not applied twice.
- Negatives: false positives per image on the negatives set are reported for every model version.
- Retention: a scan with a past retention date is pruned, and a training-approved scan is not.

**Usability:** a task-based test with 10–15 participants (scan, request pickup, claim and complete), measured by task completion, time on task, and a System Usability Scale (SUS) questionnaire.

**Pilot:** a small pilot in one Perak neighbourhood, recording scans, requests, completion rate, and correction rate per model version.

## 14. Indicative timeline (about 14 weeks; scale as needed)

| Weeks | Focus |
|---|---|
| 1–2 | Repository foundation, auth, schema, and consent (Phases 1 to 3), formalize the temporary M0, and start separate local training and golden collection sessions |
| 3–4 | Scan UI by porting the spike code, preprocessing optimisation, and pipeline skeleton with dummy data |
| 5–6 | Guidance engine, pickup request with geofence and masked locations |
| 7–8 | Collector map, claim, activity, proof, and checklist verification |
| 9–10 | Full ML pipeline automation, label tiers, gate, registry, and first real cycle |
| 11 | Public dashboard, model transparency page, notifications |
| 12 | Pilot, second cycle, and experiments E1–E6 |
| 13 | Testing, usability study, fixes |
| 14 | Report and demonstration preparation |

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Too few real user images for retraining | Simulated stream (10.12), active-learning selection, and team-collected local images |
| Noisy or wrong labels | Label tiers, count-match filter, admin review, and the E2 ablation |
| Free GPU limits or session timeouts | Resumable checkpoints, small warm-start runs, and a Colab fallback |
| TFLite export shapes vary between export routes | Pin the export command and Ultralytics version, read the layout from the tensor shape, and run the export-contract test on every model |
| Slow preprocessing on device | Measure the 384 centre-crop M0 path in Phase 5, optimize redundant image conversions, and target under 1 s where the reference phone permits |
| Confident false detections on non-waste objects | Negatives set in training and the golden set, per-class thresholds, and the review sheet |
| AGPL licence of the detector | State it in the report, confirm with the supervisor, and keep source available |
| Temporary-model domain gap | Relative gate rules, and an early local golden set to measure the gap honestly |
| Low accuracy on glass vs plastic and small items | Per-class reporting, per-class thresholds, and more local data for weak classes |
| Scope creep | Delivery tiers (Research focus and delivery priorities), with simplified implementations of retained features |
| Supabase Free pausing before a demo | Keep the project active, and check it before demonstrations |
| Stranger-pickup safety | Safety acknowledgement, approximate pins until claimed, claim caps, and reporting |
| Rule-set accuracy | Treat rules as configurable and guidance-only, and verify before public launch |
