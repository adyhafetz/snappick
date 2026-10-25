# Phase 10 Checklist: Feedback Capture and Home Stats

## A. Manual work before testing
- [x] Configure training opt-in: set `training_opt_in = true` and `image_storage_consent = true` for User A (`test_a@example.com`); set `training_opt_in = false` for User C (`test_c@example.com`).
- [x] Database migrations: verify `20261021000100_phase10_feedback_home_stats.sql` and `20261021000200_phase10_count_match_fix.sql` are applied.
- [x] Test accounts: verify local test users exist (`test_a@example.com`, `test_b@example.com`, `test_c@example.com`) with valid credentials.
- [x] Storage buckets: verify `scans` bucket is private with owner-scoped RLS (`scans_objects_owner`).

## B. Setup and run commands
```powershell
cd C:\Projects\snappick

# 1. Run mobile unit test suite
cd apps\mobile
npm test
npm run typecheck
npx eslint .

# 2. Run backend integration test suite
cd ..\..\supabase\tests
$env:SUPABASE_URL="http://127.0.0.1:54321"
$env:SUPABASE_ANON_KEY="<local anon key>"
$env:SUPABASE_SERVICE_ROLE_KEY="<local service role key>"
$env:TEST_USER_A_EMAIL="test_a@example.com"; $env:TEST_USER_A_PASSWORD="<password>"
$env:TEST_USER_B_EMAIL="test_b@example.com"; $env:TEST_USER_B_PASSWORD="<password>"
$env:TEST_USER_C_EMAIL="test_c@example.com"; $env:TEST_USER_C_PASSWORD="<password>"
npm run test:feedback
```

Automated checks implemented:
- Mobile unit tests cover active-learning classification (uncertain 0.40–0.79, user-changed or removed labels, 5% random sampling with dev flag, Monte Carlo distribution validation), upload gating, image preparation & EXIF stripping, offline upload queue durability, and Home stats caching with offline fallback. Run `npm test` from `apps/mobile` (11 test files, 71 tests passing).
- Mobile strict TypeScript check and ESLint pass cleanly (`npm run typecheck` and `npx eslint .`).
- Backend integration tests in `supabase/tests/feedback.test.mjs` verify scan and detection persistence with normalised coordinates (0..1), 90-day retention date, upload gating (opted-out users create no Storage object; opted-in users upload to private bucket), EXIF/GPS stripping, label tiers (A/B/C/D), daily upload cap enforcement, automated count-match comparison (Tier D → B promotion on match, mismatch flag on count divergence), and Home stats RPC counts.

## C. Tests
1. **Upload gating (opt-in & storage consent)** → Opted-out user (`training_opt_in = false` or `image_storage_consent = false`) does not initiate an image upload and creates no object in Storage; opted-in user with storage consent uploads selected images.
2. **Active learning selection & daily cap** → Low-confidence boxes (0.40–0.79), user corrections/removals, collector count mismatches, and a random 5% sample of confident scans are flagged for upload; the daily cap stops uploads once the per-user UTC quota is reached.
3. **5% random sampling validation** → Tested via deterministic dev flag and Monte Carlo simulation over 2,000 simulated scans confirming uniform distribution within expected confidence intervals.
4. **Offline upload queue & airplane mode** → Scans performed offline or in airplane mode enqueue in persistent `AsyncStorage` (`snappick:scan-upload-queue`); queue automatically drains with retry backoff and error tracking when connection is restored.
5. **Label tiers (A/B/C/D)** → Confident unreviewed scans start in Tier D; user label edits or removals create `label_feedback` rows and promote the sample to Tier C; completed pickups where collector counts match detector class totals promote Tier D to Tier B.
6. **Image minimisation & privacy** → Uploaded images are resized to a maximum of 800 px on the long edge, compressed to JPEG quality ~0.65, and stripped of all EXIF/GPS segments before leaving the device. Unrelated users cannot download scan images.
7. **Home dashboard statistics** → `get_home_stats` RPC returns real user statistics (`total_scans`, `verified_recyclable_items`, `active_requests`, and `recent_scans`). Cached in `AsyncStorage` (`snappick:home-stats-cache`) for offline display with an offline badge and pull-to-refresh.

## D. Regression
- [x] Detector labels and fixed order remain `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`.
- [x] Pickup and marketplace completion flows remain functional (`npm run test:completion` passes).
- [x] Existing mobile unit suites (detector, guidance, pickup, marketplace, completion) remain green (71/71 passing).
- [x] Database schema is purely additive via versioned migrations (`20261021000100_phase10_feedback_home_stats.sql` and `20261021000200_phase10_count_match_fix.sql`).

## E. Known limitations
- [x] 5% random sampling is verified via unit test Monte Carlo simulation and dev flag toggle; production rates accumulate over real pilot scanning sessions.
- [ ] Tier A promotion occurs via admin annotation in CVAT/Label Studio (Phase 11 ML pipeline) from Tier C review queue.
- [ ] Offline queue retry intervals on device use exponential backoff up to 3 attempts before marking an item failed for manual retry.

## F. Troubleshooting
- `AUTHENTICATION_REQUIRED` on `get_home_stats` → Ensure user is signed in with a valid JWT.
- Upload denied in Storage `scans` bucket → Ensure upload path begins with the authenticated user's UUID (`<user_id>/<scan_id>.jpg`) matching the `scans_objects_owner` policy.
- `42P10` syntax error in Postgres → Verify migration `20261021000200_phase10_count_match_fix.sql` is applied.
- Offline queue not flushing → Ensure `flushScanUploadQueue` is triggered on screen focus or network reconnect.

## G. Sign-off
```powershell
git add .
git commit -m "feat: phase 10 feedback capture and home stats"
```

Assumptions made:
- Detector bounding boxes are persisted with normalised coordinates (`0..1`) relative to the original image dimensions.
- Storage consent and training opt-in are two separate flags; image upload occurs only when both are true and active learning selects the scan.
- Retention date is automatically calculated as 90 days from scan creation in `scans` table.
- Home statistics define verified recyclable items as collector-verified collected items (`collector_quantity > 0`) for completed pickups excluding reject labels (`trash`, `biological`).
- In `feedback_samples`, unreviewed scans default to Tier D; user corrections promote to Tier C; matching collector counts promote Tier D to Tier B.

