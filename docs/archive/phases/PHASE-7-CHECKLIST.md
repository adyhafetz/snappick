# Phase 7 Checklist: Pickup Request

## A. Manual work before testing
- [x] One-time: Perak district data was sourced from DOSM `administrative_2_district.geojson`, pinned to commit `b057365ccbf26cbe3db1c043668f6a0efe811cb2`; metadata is recorded in `supabase/seed/perak_districts.metadata.json`. CRS is CRS84/WGS84 longitude-latitude. Retain the DOSM attribution and do not imply DOSM endorsement. License: [DOSM Open Data License](https://github.com/dosm-malaysia/data-open/blob/b057365ccbf26cbe3db1c043668f6a0efe811cb2/LICENSE.md).
- [ ] One-time: Review the [OpenFreeMap Terms](https://openfreemap.org/tos/) and [attribution instructions](https://openfreemap.org/). The current OpenFreeMap page says attribution is required and MapLibre adds it automatically. Confirm the current terms before deployment.
- [ ] Per-run: On the Redmi Note 10, open Request and confirm OpenFreeMap tiles and the `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` attribution render. This has not been visually verified yet.
- [ ] One-time/fallback only: If OpenFreeMap is unavailable or unsuitable, obtain a MapTiler style URL and set `EXPO_PUBLIC_MAP_STYLE_URL` in the ignored `apps/mobile/.env`; never commit a MapTiler secret. MapTiler fallback has not been tested.
- [x] One-time: Start Docker Desktop using the Linux engine. Verified running via WSL2/desktop-linux engine.
- [x] One-time: Create two disposable authenticated Supabase users with access to the project. Created `test-a@example.com` and `test-b@example.com` locally with no service-role key.
- [ ] Per-run: Connect the Redmi Note 10 with USB debugging enabled, start the Metro server, sign in, and prepare one reviewed scan with at least one eligible item.

## B. Setup and run commands
- [x] PowerShell, repository root: `cd C:\Projects\snappick`
- [x] Reproduce district data from the pinned DOSM source: `python scripts/import_perak_districts.py`; expected output is 13 Perak districts and deterministic GeoJSON, metadata, and SQL seed files (13 district features were generated).
- [x] Start local Supabase: `npx supabase start`
- [x] Apply migrations and seed to the local database: `npx supabase db reset`
- [x] Lint the local database: `npx supabase db lint --local` (0 lint errors).
- [x] PowerShell, Supabase test root: `cd C:\Projects\snappick\supabase\tests`; install once with `npm install`.
- [x] Set local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, and `TEST_USER_B_PASSWORD`; use two disposable accounts and no service-role key.
- [x] Run RPC/privacy integration tests: `npm run test:pickup` (all RPC/privacy tests passed).
- [x] PowerShell, repository root: `cd C:\Projects\snappick`; run district importer unit tests: `python scripts/test_import_perak_districts.py` or `python -m unittest scripts.test_import_perak_districts` (5 passed).
- [x] PowerShell, mobile root: `cd C:\Projects\snappick\apps\mobile`; run `npm run typecheck`, `npm test`, and `npm run lint` (typecheck/lint passed; 26 tests passed).
- [x] Install native packages with `npx expo install`; MapLibre 11.5.0 and Expo Network 57.0.2 are recorded in `docs/ENVIRONMENT.md`.
- [x] Rebuild the Android development app after native dependency changes: `npx expo run:android` (Gradle build/install completed; visual map validation remains pending).
- [ ] Start the development server with `npx expo start -c` and open the rebuilt Android app.

## C. Tests
Automated tests: mobile Vitest suite (`apps/mobile/src/lib/pickup/pickup.test.ts` and existing detector/guidance tests); importer unit tests (`scripts/test_import_perak_districts.py`); local RPC/privacy integration tests (`supabase/tests/pickup.test.mjs`); Phase 6 Edge regression tests (`supabase/tests/guidance.test.mjs`); Phase 2 RLS regression tests (`supabase/tests/rls.test.mjs`). All automated unit, edge, migration lint, and RPC integration suites have been executed and passed against the local Supabase instance.

1. [x] `python -m unittest scripts.test_import_perak_districts` from repository root -> expect GeoJSON structure/CRS, required district ID/name, coordinates, rings, and self-intersections to be checked. Result: 5 tests passed.
2. [x] `npm test` from `apps/mobile` -> expect pickup validation plus existing detector/guidance unit tests. Result: 26 tests passed across 3 test files.
3. [x] `npm run typecheck` and `npm run lint` from `apps/mobile` -> expect strict TypeScript and Expo lint to pass. Result: both passed with 0 errors.
4. [x] `npm run test:edge` from `supabase/tests` -> expect Phase 6 guidance privacy and validation regressions to pass. Result: 7 tests passed.
5. [x] `npx supabase db lint --local` and `npm run test:pickup` after `npx supabase start` and `npx supabase db reset` -> expect migration/seed validity and direct-RPC tests for authentication, supported-area rejection, invalid coordinates, restricted confirmation, no eligible items, point snapping, private exact details, second-user isolation, own-request reads, direct-write denial, rule-set snapshot, and requester-only cancellation. Result: db lint passed (0 errors); all 13 RPC integration assertions passed.
6. [ ] On Android, submit fixture point Ipoh/Kinta `[101.0901, 4.5975]` with an eligible reviewed paper/cardboard item -> expect the area to resolve and a request to be created as `pending`; database RPC verified, device UI verification pending.
7. [ ] Try Kuala Lumpur `[101.6869, 3.1390]` and Penang `[100.3288, 5.4141]` -> expect the app to block each point and the direct RPC to reject each request without creating rows. Result: direct RPC rejection verified in test:pickup; mobile UI check on device pending.
8. [x] Test geofence boundary using the deterministic fixture reference: in `supabase/seed/perak_districts.geojson`, the RPC test uses the midpoint of the first segment of the first sorted district outer ring; expect `resolve_pickup_area` to use `ST_Covers` for a point on that district boundary. Result: verified in test:pickup.
9. [x] Use an invalid coordinate such as latitude `91` -> expect a safe invalid-coordinate message and no exact coordinate in returned error text. Result: verified in test:pickup.
10. [ ] Move the selected point across two districts with different active rule sets -> expect affected item eligibility and Phase 6 guidance to refresh, the changed result to be shown, and the created request to store the resolved rule-set UUID/version without altering detector boxes or labels. Device/database verification pending; current seeded rule data may not provide two different district-specific rule sets.
11. [ ] Fill unit/street, optional address fields, and pickup window; submit -> expect exact details only in `pickup_request_private_details`, while list/public data expose only safe summaries and the snapped point. Verify as a second account that private details cannot be read. Result: database RPC, snapping, and second-account privacy verified in test:pickup; mobile UI form submission on device pending.
12. [ ] Leave restricted-item confirmation unchecked, then separately attempt a scan containing no eligible items -> expect submission blocked in the UI and rejected by direct RPC. Result: direct RPC rejection verified in test:pickup; mobile UI block on device pending.
13. [ ] Open Activity > My Requests -> expect only the signed-in user's safe district/area, item summary, pickup window, status, and created time; cancel the user's pending request -> expect `cancelled`; attempt cancellation from a second account -> expect rejection. Result: RPC cancellation, second-account rejection, and my_pickup_requests isolation verified in test:pickup; mobile UI screen interaction on device pending.
14. [ ] Enable Airplane mode on Android -> expect local scan/review data remains viewable, pickup submission disabled, and `Connect to submit pickup` displayed without queuing a request.
15. [ ] Deny location permission, then disable device location services and retry GPS -> expect distinct helpful permission-denied/unavailable messages; manually move the map to continue.
16. [x] Inspect the mobile app and public request representation -> expect no batteries, bulbs, e-waste, chemicals, or sharp objects to be inferred as detector labels, and no exact address/note/coordinates in public rows, guidance prompts, cache keys, analytics, or logs. Result: confirmed in RPC schemas, queries, and client code.

## D. Regression
- [x] Preserve detector labels and order exactly: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`; server validation rejects all other classes.
- [x] Keep battery, bulb, e-waste, chemical, sharp-object, and other hazards as manual safety declarations; no detector hazard recognition was added.
- [x] Preserve one pickup checklist row for each reviewed detector box or user-added item, including class, condition, quantity, source, and server-recomputed eligibility.
- [x] Keep exact coordinates and address/access/note fields out of public request summaries, guidance inputs, cache keys, and mobile logging.
- [x] Keep Phase 8 collector browsing/claiming/navigation, Phase 9 proof/notifications, and later dashboard/admin/model workflows out of this implementation.
- [ ] Complete the Phase 5/6 manual regression checklist on the Android device after local backend setup.

## E. Known limitations
- [ ] MapLibre Android rebuild completed, but OpenFreeMap tile rendering, attribution visibility, GPS behavior, map gestures, live request creation/cancellation, second-account privacy, and offline UI have not been device-verified in this run.
- [x] Local migration lint, seed validity, and RPC/RLS integration tests (`test:pickup`, `test:rls`, `test:edge`) passed on the local Docker Supabase instance.
- [ ] Existing Phase 6 PBT guidance is provisional; a deployment owner must review local rule content. Current district data comes from DOSM, not proof of municipal pickup coverage or operational service availability.
- [x] Boundary import validates coordinate ranges, ring closure, and ring self-intersection in Python; PostGIS seed validation was executed via `npx supabase db reset` and succeeded without errors.
- [ ] The map uses a fixed center pin while the map is panned to select a point because the installed MapLibre `Marker` API has no drag prop; the selected coordinate is updated from map camera gestures. This interaction needs manual usability verification.
- [ ] Assumptions: the verified DOSM boundary dataset is acceptable for Perak district resolution; a point on a district boundary is assigned using `ST_Covers`, then the smallest-area matching district and slug are selected; all request item classes use the seven fixed detector labels even for user-added items; only `pending` requests can be cancelled; one restricted-item confirmation is required for every request; pickup windows are future intervals no more than 31 days away.
- [ ] No live OpenFreeMap Android verification is claimed. The official site currently documents the Liberty style URL, required attribution (automatically added for MapLibre), public-service availability without a key, and service “as-is”; terms/availability should be reviewed again before release.

## F. Troubleshooting
- [ ] `npx supabase start` or local DB lint cannot connect to Docker -> start Docker Desktop with the Linux engine, wait for it to report healthy, then rerun `npx supabase start`.
- [ ] Migration fails on seed inclusion -> `scripts/import_perak_districts.py` outputs deterministic SQL into `supabase/seed.sql` and `supabase/seed/perak_districts.sql`, executed cleanly by `npx supabase db reset`.
- [ ] District import fails CRS/geometry validation -> confirm the pinned source is still the DOSM administrative district GeoJSON in CRS84 and do not bypass validation; inspect the source/metadata before updating the pin.
- [ ] District resolution reports service-area data unavailable -> confirm migrations and seed applied, then verify non-placeholder polygons exist in `public.perak_districts`.
- [ ] A point in Perak does not resolve a rule set -> verify an active, effective `pbt_rule_sets` row named for the district slug or `perak_general` exists.
- [ ] Map style fails to load -> verify network access and OpenFreeMap status; use an approved MapTiler style URL via ignored `EXPO_PUBLIC_MAP_STYLE_URL`, then rebuild/restart as needed without committing credentials.
- [ ] Location permission or GPS fails -> use Android Settings > Apps > SnapPick > Permissions > Location, enable device location, or select the point by moving the map.
- [ ] App shows stale native modules after package changes -> rebuild with `npx expo run:android`; Metro reload alone cannot install native dependencies.

## G. Sign-off
- [ ] After automated, database, and manual checks pass: `git add apps/mobile docs/ENVIRONMENT.md docs/phases/PHASE-7-CHECKLIST.md scripts supabase`
- [ ] Commit: `git commit -m "feat: phase 7 pickup request"`
- [ ] Merge the reviewed Phase 7 branch into `main`.
- [ ] Tag: `git tag phase-7-done`
- [ ] Update `docs/PROGRESS.md` Phase 7 status only after the pending database and Android checks above pass.
