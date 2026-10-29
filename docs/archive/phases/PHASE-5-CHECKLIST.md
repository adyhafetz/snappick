# Phase 5 Checklist: On-device Scan and Review Sheet

## A. Manual work before testing
- [x] One-time: M0 Phase 4 artifact was available in `ml/artifacts/m0/`; copied unchanged to `apps/mobile/assets/models/snappick_det_v0.tflite`.
- [x] One-time: Verified the copied SHA-256 equals the Phase 4 manifest (`ffb5240658fdffabbf27ee5de6a9cc33c27a20882467723a0f4771a41468dd7d`).
- [x] Per-run: Connected Redmi Note 10 with USB debugging enabled; ADB reports the device as `device`.
- [x] Per-run: Camera preview opened, confirming camera permission is granted. Denial fallback remains to be tested separately.
- [ ] Per-run: Deny camera permission once to verify the helpful permission fallback and gallery path.
- [ ] Per-run: For offline test, load the development app once, enable Airplane mode, leave Wi-Fi disabled, and scan a locally stored photo.

## B. Setup and run commands
- [x] PowerShell, mobile package root: `npm install`
- [x] PowerShell: `npm run typecheck`
- [x] PowerShell: `npm test`
- [x] Per-run after Metro asset config changes: `npx expo start -c`
- [x] Development build/install: `npx expo run:android` (rebuilds after permission config adjustment also succeeded).
- [ ] Rebuild native app after changes to camera/TFLite native dependencies; reload alone is insufficient.

## C. Tests
Automated tests: Vitest pure TypeScript suite in `src/lib/detector/detector.test.ts`.

- [x] `npm run typecheck` -> expect strict TypeScript check to complete with no errors.
- [x] `npm test` -> expect all 10 preprocessing, tensor, output, NMS, threshold, mismatch, rules, review-row, and status-presentation tests to pass.
- [ ] Scan tab, tap camera shutter on a bottle photo -> expect one or more boxes aligned to the visible bottle and a review row for each returned box.
- [ ] Scan a can, mixed objects, then a no-detection scene -> expect boxes on visible items and an explicit empty-detection state for the last scene.
- [ ] With device Airplane mode enabled, scan a locally stored photo -> expect on-device detection without a network dependency.
- [ ] Tap a review row, then its box -> expect the selected row/box to highlight and a box tap to scroll to its corresponding row.
- [ ] Scan a low-score item between manifest thresholds -> expect a grey dashed box and an uncertain review row; change label or remove it.
- [ ] On a recyclable item, choose Wet and then Broken -> expect its box to stay green while its row says "Not eligible for pickup" with a reason; it must not count toward pickup eligibility.
- [ ] On an uncertain item, verify it is grey dashed and says "Confirm label to check pickup"; confirm it -> expect class color and rule-based eligibility to apply.
- [ ] Press “Everything looks clean and dry” -> expect all remaining rows to move to clean/dry condition.
- [ ] Use Change label, Remove, and Add item not in photo -> expect the row to update, disappear/restore, or appear without an overlay box respectively.
- [ ] Leave hazard confirmation unchecked, then check “I have removed or declared all restricted items.” -> expect Request pickup disabled before confirmation and enabled only when an eligible row exists afterward.
- [ ] Change a test copy of the manifest input layout to NHWC while loaded M0 is NCHW -> expect a readable manifest/tensor shape mismatch, not malformed boxes.
- [ ] Tap camera action with permission denied -> expect the camera permission explanation and working gallery option without a crash.
- [ ] Record displayed preprocessing, inference, and decode/NMS times from at least 10 scans on Redmi Note 10 in `docs/results/phase-5-m0.md`.

## D. Regression
- [ ] Sign-in, required consent redirects, and the existing tab navigation still load.
- [ ] Scanner remains Android development-build-only and the M0 model remains bundled, unchanged, and offline-capable.
- [ ] Seven labels and their exact order remain unchanged; hazards are manual declarations, never detector results.
- [ ] No pickup request is submitted in this phase; the Request button opens a Phase 7 placeholder only.

## E. Known limitations
- [ ] Runtime visual checks listed in C are not verified by this implementation session. Android build status is recorded below after the command completes.
- [ ] Timing numbers are not copied from the smoke app. Device measurements remain blank until measured on the reference phone.
- [ ] The Phase 2 seed uses an older material taxonomy; Phase 5 applies a small bundled seven-label eligibility policy and does not change database seeds or migrations.
- [ ] The Request pickup action is a placeholder; map, geofence, submission, persistence, and server rule resolution remain later phases.
- [ ] Assumption: M0's raw YOLO output has four normalized `cx,cy,w,h` attributes followed by seven class scores; this follows the inspected Phase 4 `[1,11,3024]` shape plus the Phase 0 raw-output implementation, but source-export parity remains unverified.
- [ ] Assumption: Expo image manipulation applies the photo's orientation before crop/resize, and its reported dimensions stay aligned with the displayed original photo; rotated gallery photos need device verification.
- [ ] Assumption: Expo JPEG output and `jpeg-js` decoding produce RGBA bytes in standard RGB order; preprocessing timing includes image manipulation, JPEG decoding, and tensor creation.
- [ ] Assumption: letterbox padding uses normalized grey value `0.5`; the current shared manifest contract does not define a separate padding value.
- [ ] Assumption: nearest-neighbor sampling in the pure tensor builder is acceptable for the smoke baseline; production box alignment and accuracy still require phone image verification.
- [ ] Assumption: a clean/dry user-selected condition is sufficient for the bundled local rule policy to mark supported recyclable material eligible; local council acceptance confirmation remains outside this phase.
- [ ] Assumption: removed items stay in the immutable detected aggregate count but are omitted from eligibility and overlays.
- [ ] Assumption: the six manual safety categories are explicit user-selected declarations followed by one confirmation that they will be left out of pickup; none are inferred by the model.

## F. Troubleshooting
- [ ] `Cannot find module ... .tflite` -> confirm `metro.config.js` includes `tflite` in default asset extensions, then run `npx expo start -c`.
- [ ] TFLite load/native module error -> use the installed development build (`npx expo run:android`); Expo Go does not include Nitro/TFLite native code.
- [ ] Readable tensor mismatch -> compare the loaded model tensor details with `assets/models/model_manifest.json`; do not edit labels/order or infer a new contract silently.
- [ ] Camera permission denied -> grant Android Settings > Apps > SnapPick > Permissions > Camera, or use Gallery.
- [ ] No boxes -> confirm the photo is clear, centered, and supported by M0; no-detection is valid and does not indicate a model lifecycle rollback.
- [ ] Metro starts with stale assets -> stop it and restart with `npx expo start -c`.

## G. Sign-off
- [ ] After all manual checks pass: `git add .`
- [ ] Commit: `git commit -m "feat: phase 5 on-device scan and review sheet"`
- [ ] Merge `phase-5` into `main` after review.
- [ ] Tag: `git tag phase-5-done`
- [ ] Update `docs/PROGRESS.md` Phase 5 status.

### Verification record
- `npm run typecheck`: passed (2026-10-13).
- `npm test`: passed, 10 tests (2026-10-13), including the material-color versus pickup-eligibility presentation test.
- Android build/device run: passed; three native builds completed and installed/launched on Redmi Note 10, Android 12. Scan tab camera preview was visibly confirmed. The final merged manifest requests CAMERA only (no RECORD_AUDIO). SDK XML, manifest-merger, and upstream TFLite C++ warnings remain non-fatal.
- Manual camera, airplane-mode, alignment, uncertainty overlay, safety, and timing checks: not yet performed.
