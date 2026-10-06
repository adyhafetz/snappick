# SnapPick Implementation Plan (Revision 4: fresh start, continuous-learning focus, spike-validated)

**Project:** SnapPick is a Perak community recycling app. Residents photograph household waste, receive sorting guidance, request pickup for accepted recyclable materials, and see privacy-safe recycling statistics.

**Scope decision:** This is a Final Year Project pilot, not an official municipal collection service. It provides guidance and community pickups. Local rules and service areas are configurable per local authority/district and must be verified before public launch. KPKT lists Perak among the states where Act 672 is not enforced, so the app must not present SWCorp guidance as binding Perak law. [KPKT reference](https://www.kpkt.gov.my/index.php/pages/view/272)

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

A throwaway spike was run on a real Android phone before the real project started. It tested the riskiest technical pieces. **The real project is built from scratch in a new monorepo and a new Supabase project.** Nothing from earlier attempts is carried over except the spike code and these findings. The spike code is archived under `scripts/spike/` and is reused in Phase 5.

| Check | Result |
|---|---|
| Build on Expo SDK 57, React Native 0.86, new architecture, Android | Pass |
| On-device inference (CPU, 640 px input, YOLO nano float32) | about 350 ms |
| Preprocessing (resize, JPEG decode, tensor) | about 1.5 s. This is the slowest step. |
| Output decode and NMS | about 110 ms |
| Multi-object boxes | Pass |
| Map pins, tap, remove, Navigate (MapLibre, no API key) | Pass |

**Decisions taken because of the spike**

1. **Detector is YOLO (Ultralytics) exported to TFLite**, replacing EfficientDet-Lite. The spike proved it on-device, and TFLite Model Maker (the old training route) is deprecated.
2. **Export format is not fixed by the library.** The spike model took input `[1, 3, 640, 640]` (channels-first) and returned raw `[1, 84, 8400]` output, so the app must decode and run NMS itself. The model manifest therefore declares input layout, output layout, and whether post-processing is included. An export-contract test in the pipeline checks this on every model.
3. **Preprocessing is the performance bottleneck, not the model.** Phase 5 includes an optimisation task (single resize, no double JPEG encode) and records stage timings.
4. **Letterbox is kept**, but done in code on decoded pixels. The spike used stretch resizing, and YOLO trains on letterboxed images. Letterbox vs stretch is measured in experiment E6.
5. **Maps use MapLibre with the OpenFreeMap style (no key)**. MapTiler is the fallback. `Marker` has no built-in clustering, so pin counts per grid cell come from the server.
6. **Android only.** iOS items (APNs, TestFlight, CoreML) are dropped. FCM is kept.
7. **Public data first.** Development runs on public datasets. The local Perak dataset is swapped in later by retraining. See Section 3.
8. **Confident false detections exist.** The generic model called a random object "bicycle" at 0.90 confidence. Training and the golden set therefore include a negatives set, and false positives per image on negatives is a release-gate metric.
9. **Battery stays manual-only**, confirmed by the spike: a generic model never detected a battery.
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
| User | Scan waste, view guidance, create/cancel their own pickup requests, browse and claim other users' nearby pending requests, upload pickup proof, and confirm or dispute completed pickups. |
| Admin | Manage PBT/district rule sets, review corrections, approve model releases, and handle reports. |

Bottom navigation is **Home, Activity, Scan, Request, Profile**. The Request tab always shows the map of pending requests. Activity has two sections: **My Requests** and **Pickups I Claimed**.

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

The model uses broad, easy-to-understand household-waste labels. The purpose is to cover the common things found in a home—not to distinguish PET from HDPE, aluminium from steel, or every package subtype.

| App class | Examples | How it enters the app | Default pickup decision |
|---|---|---:|---|
| plastic_bottle | Water, soft-drink, shampoo, detergent bottles | Detector | Accepted |
| glass_bottle | Glass drink bottles and jars | Detector | Conditional |
| can | Drink cans and food cans | Detector | Accepted |
| cardboard | Shipping boxes, cereal boxes, clean cartons | Detector | Accepted |
| paper | Newspaper, office paper, flyers, paper bags | Detector | Accepted |
| plastic_container | Food tubs, takeaway containers, cups, rigid packaging | Detector | Conditional |
| plastic_bag_wrapper | Shopping bags, snack wrappers, cling film | Detector | Not accepted in MVP |
| beverage_carton | Milk, juice, and drink cartons | Detector | Conditional |
| food_waste | Leftovers, fruit/vegetable scraps | User-added only | Not accepted in pickup |
| textile | Clothes, fabric, shoes | User-added only | Conditional |
| e_waste | Small electronics, chargers, cables | User-added safety declaration | Restricted |
| battery_bulb | Batteries, bulbs, fluorescent tubes | User-added safety declaration | Restricted |
| general_waste | Mixed or non-recyclable household waste | User-added only | Not accepted in pickup |

The MVP vision model therefore has **eight**, not thirteen, trained object-detection classes. Food waste, textile, e-waste, battery/bulb, and general waste remain in the app as manual labels, safety declarations, and static guidance; the model does not claim to detect them. The pickup-review checklist always asks “Any batteries, bulbs, e-waste, or hazardous items not shown?” before submission.

### Baseline dataset and FYP training plan (public data first)

**Strategy.** The whole app is built and tested with public data first. The first model, **M0, is trained on public data only**. The local Perak dataset is added later by creating a new dataset version and retraining from the M0 champion. No app change is needed, because labels, input size, and thresholds are read from the model manifest. This also gives the research a clean before and after: M0 (public only) against later models that add local data.

- Start from Ultralytics YOLO nano weights pretrained on COCO (the family tested in the spike).
- Merge the relevant TACO labels into the eight broad classes. TACO contains 1,500 images and 9,823 labelled objects, but its maintainers note that many original classes have too few annotations and should be merged, which is why SnapPick uses broad labels. [TACO dataset](https://github.com/pedropro/TACO)
- Phase 4 proposes additional public datasets (bottles, cans, cartons, household waste) **with their licences, for approval before use**. Public mirrors can carry different licences from the original, so check each one.
- Add **negatives**: public images of non-waste objects and clutter, so the model learns to stay quiet. The spike showed confident false detections on random objects.
- **Two evaluation sets.** A held-out slice of the public data serves as the development gate. The **local golden test set** is the one reported in the research.
- **Collect the local golden set early, not at the end.** Public data cannot show whether the model works on household scenes. Start with at least 20 to 30 instances per class over several sessions and different days, then grow to at least 50 per class before the experiments. Annotate it in Label Studio or CVAT, freeze it, and hash it.
- Expect a domain gap: TACO is mostly outdoor litter. Gate rules are relative to the current champion, so a weak M0 does not block development.
- Minimum milestone: at least 150 verified training instances per trained class (public plus local), aiming for 300 or more on the weakest classes.
- Record the licence and source of every dataset in `dataset_versions`. Keep download scripts in the repository, not the images.
- Report per-class results honestly and expand the weakest classes rather than promising a high mAP for every label.
- Google Colab or Kaggle free GPU is used for finite, checkpointed runs. Resume a run if a session ends.

Each class maps to a recyclable state and instruction through the local rule set. National guidance includes paper/cardboard, glass, plastic, and metal as recyclable material families, but the active PBT rule set remains the operational source of truth. [SWCorp material categories](https://www.swcorp.gov.my/sisa-domestik-dan-pembersihan-awam/)

### Condition confirmation

Some properties cannot be trusted from a photo alone. For conditional classes, the app asks whether the item is clean and dry, contaminated/wet, broken/unsafe, or unknown. Final eligibility is calculated from **class + condition state + active local rule set**.

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
| On-device detection | react-native-fast-tflite with react-native-nitro-modules. **Pin the versions installed in the spike.** YOLO nano exported to TFLite (float32, 640 px baseline). CPU first; the GPU delegate is evaluated in E6. NNAPI is deprecated on Android 15 and is not used. |
| Detection overlay | React Native Views positioned over the photo (spike-proven). SVG only if dashed borders misbehave. |
| Maps and location | MapLibre React Native (Expo config plugin, new architecture, not Expo Go) with the **OpenFreeMap** style (no key; confirm its terms and attribution for the pilot). MapTiler is the fallback. expo-location for GPS. Navigate uses the Android navigation link with a generic map link as fallback. |
| Backend | Supabase Auth, Postgres, PostGIS, Storage, Realtime, Row Level Security, Edge Functions, and database RPC. Supabase JS **2.117.2**. |
| LLM | OpenAI API through a Supabase Edge Function only, using Structured Outputs and server-side schema validation. Check the current OpenAI Structured Outputs documentation when implementing. |
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

## 5. Rule-set resolution and scan timing

The app must be useful before a user shares location. It resolves rules in this order:

1. On the Scan screen, use the last confirmed pickup district, if one is stored for the user.
2. Otherwise, request location permission only when the user chooses **Use my location for local guidance**. Location permission is not required to scan.
3. If permission is denied, unavailable, or the user has not selected a pickup point, use the versioned **perak_general** rule set and label the advice “General Perak guidance—confirm your pickup area for final acceptance.”
4. When the requester sets a pickup pin, the server resolves the district through PostGIS and selects that district/PBT rule set.
5. If the newly selected rule set differs from the scan rule set, update the review sheet and LLM guidance using the new rule-set version. The scan image and detected classes do not change; only eligibility and preparation instructions may change.

This means location is optional for scanning but mandatory for creating a pickup request. The active rule-set ID and version are saved with the scan and with the request for auditability.

---

## 6. Computer vision pipeline

### Image preparation

Use **aspect-ratio-preserving letterboxing**, done in code on decoded pixels:

1. Resize the photo proportionally so its largest side fits the model input (640 px baseline; the size comes from the manifest).
2. Decode to RGB and write the pixels into a square buffer, filling the remaining area with neutral grey padding.
3. Arrange the channels as the model expects. **Read the layout from the model's input tensor shape** (channels-first `[1, 3, H, W]` or channels-last `[1, H, W, 3]`), and check it against the manifest. A mismatch shows a readable error instead of silent garbage.
4. Run inference, then decode. The spike model returns raw `[1, 4 + classes, anchors]` values (box centre, width, height, then one score per class). The app decodes them, applies class-wise NMS (IoU 0.5, at most 30 boxes), and skips NMS only when the manifest says post-processing is already inside the model. Never apply NMS twice.
5. Remove the padding offset and apply the inverse scale when drawing boxes on the displayed image. Store normalised boxes relative to the EXIF-corrected original photo.

Letterboxing avoids distorted bottles and cans and avoids cropping items at the photo edge. The spike used stretch resizing, so letterbox vs stretch is compared in experiment E6.

### Performance budget

| Stage | Spike baseline | Target |
|---|---|---|
| Preprocess | about 1.5 s | under 1 s (single resize, no double JPEG encode) |
| Inference (CPU) | about 350 ms | 500 ms or less |
| Decode + NMS | about 110 ms | 150 ms or less |
| End to end | about 2 s | 3 s or less |

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

## 7. OpenAI instructions, cache, and fallback

OpenAI produces concise local **disposal instructions**, not the detection result or recyclable classification.

1. The app sends normalised classes, condition states, quantity bands (1, 2–5, 6+), district/PBT rule-set ID, locale, and rule-set version to an Edge Function.
2. The function checks instruction_cache first.
3. A reviewed cache hit is returned immediately.
4. On a miss, the function calls OpenAI with the active local rules and strict JSON schema.
5. It validates the output, saves it under the current rule version, and returns it.
6. On failure, the function returns a reviewed local rule template.

Suggested per-item cache key. Advice is cached per item and composed into the scan's guidance in code, so hit rates stay high:

locale + pbt_rule_set_id + rule_set_version + class + condition_state + quantity_band

Advice for every class and condition pair is pre-generated and admin-reviewed before launch, so most runtime requests are cache hits and the LLM mainly serves rare cases.

Never include user ID, image, free-text note, address, exact coordinate, face, or licence plate in the prompt or cache key.

Safeguards:

- Abort the OpenAI request after **4.5 seconds**.
- Retry once only for transient failures.
- Apply a daily budget/alert and output-size cap.
- Increment rule_set_version when a PBT rule changes; old cached guidance no longer matches.
- Mark cached responses as generated, reviewed, or fallback.

### Fully offline behaviour

The React Native app bundles a small versioned bundled_advice.json file for every MVP class and condition state. It contains essential instructions such as “empty, rinse, and dry” and “do not place batteries in community pickup.” Therefore, offline scanning always returns boxes, eligibility based on the last available rule set/perak_general, and basic guidance without contacting Supabase or OpenAI.

When the device is online, the Edge Function may replace this with the current cached or OpenAI-generated local guidance. Creating/claiming a pickup requires connectivity and is disabled with a clear “Connect to submit pickup” message while offline.

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
2. resolves the district and active PBT rule set;
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
- pbt_rule_sets — local rules, version, effective dates, and source/review record.
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
- **Public held-out set:** a slice of the public data, never trained on, used as the development gate while local data is still small. The local golden set remains the reported result.
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
- **Warm start** from the current champion model, not from COCO each time. M0 starts from COCO-pretrained nano weights.
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
| Eligible-class recall | Recall for accepted recyclable classes does not drop |
| Export parity | The TFLite model is within 1 mAP@0.5 point of the PyTorch model on the golden set (applies to any fp16 or int8 variant too) |
| Export contract | Input and output tensor shapes and layout match the manifest, and TFLite outputs match PyTorch on 10 reference images |
| Negatives | False positives per image on the negatives set do not increase |
| Size and latency | Size within budget. Median on-device model inference at most 500 ms and end-to-end scan at most 3 s on the reference phone (spike baseline: 350 ms and about 2 s) |
| Smoke test | Model loads in the app harness and reproduces expected boxes on 10 reference images within tolerance |

These thresholds are starting values to be justified and adjusted in the report. A candidate that fails is marked `rejected`, the champion stays, and the failure reason is stored. Failed cycles are also research data.

### 10.9 Registration, approval, and rollout

- Each `model_versions` row stores version, dataset version, training run ID, SHA-256, size, metrics JSON, per-class thresholds, minimum app version, status, and rollout percentage.
- Status path: `candidate` → `approved` (admin) → `rolling_out` → `stable`, or `rolled_back`.
- The model manifest also carries labels, input size, output tensor specification, and thresholds, so the app never hard-codes them.
- Rollout uses the deterministic rule from Section 6: stable hash of user ID modulo 100 is below the rollout percentage.
- The demonstration shows 10% → 100% and a rollback (percentage set to 0), with the app falling back to the previous known-good model.
- Admin approval can start as an edit in Supabase Studio and later become a simple admin screen.

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

- **M0 (baseline):** TACO-merged classes plus the local seed set.
- **Simulated stream:** split the local and collected images into four chronological batches that arrive as cycles, producing M1 to M4. This shows pipeline behaviour under controlled data arrival.
- **Real pilot cycles:** at least one or two cycles from actual pilot users, reporting correction rate before and after.

| ID | Experiment | Answers |
|---|---|---|
| E1 | Learning curve: golden-set mAP for M0 to M4 | RQ1 |
| E2 | Label strategy: Tier A only vs A+B vs A+B+C unreviewed | RQ2 |
| E3 | Sample selection: uncertainty-based vs random, same annotation budget | RQ2, RQ4 |
| E4 | Forgetting: with vs without replay | RQ3 |
| E5 | Real pilot: correction rate and per-class change across model versions | RQ1 |
| E6 | On-device: stage timings (preprocess, inference, decode), model size, letterbox vs stretch, fp32 vs fp16 (int8 optional), CPU vs GPU delegate, across versions | Feasibility |

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
- Model update: bad hash, failed load, tensor-shape mismatch, and failed smoke test all fall back to the previous model.
- Detector contract: letterbox and inverse box mapping round-trip correctly, decode handles both output layouts, and NMS is not applied twice.
- Negatives: false positives per image on the negatives set are reported for every model version.
- Retention: a scan with a past retention date is pruned, and a training-approved scan is not.

**Usability:** a task-based test with 10–15 participants (scan, request pickup, claim and complete), measured by task completion, time on task, and a System Usability Scale (SUS) questionnaire.

**Pilot:** a small pilot in one Perak neighbourhood, recording scans, requests, completion rate, and correction rate per model version.

## 14. Indicative timeline (about 14 weeks; scale as needed)

| Weeks | Focus |
|---|---|
| 1–2 | Repository foundation, auth, schema, and consent (Phases 1 to 3) alongside public dataset assembly, baseline model M0 (public only), and the start of the local golden set (the spike is already done) |
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
| Slow preprocessing on device | Measured baseline (about 1.5 s), optimisation task in Phase 5, and a target of under 1 s |
| Confident false detections on non-waste objects | Negatives set in training and the golden set, per-class thresholds, and the review sheet |
| AGPL licence of the detector | State it in the report, confirm with the supervisor, and keep source available |
| Weak public-only baseline due to domain gap | Relative gate rules, and an early local golden set to measure the gap honestly |
| Low accuracy on glass vs plastic and small items | Per-class reporting, per-class thresholds, and more local data for weak classes |
| Scope creep | Delivery tiers (Research focus and delivery priorities), with simplified implementations of retained features |
| Supabase Free pausing before a demo | Keep the project active, and check it before demonstrations |
| Stranger-pickup safety | Safety acknowledgement, approximate pins until claimed, claim caps, and reporting |
| Rule-set accuracy | Treat rules as configurable and guidance-only, and verify before public launch |
