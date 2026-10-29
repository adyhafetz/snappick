# Phase 6 Checklist: Guidance Engine

## A. Manual work before testing
- [ ] One-time: In Supabase Dashboard > Project Settings > Edge Functions > Secrets, set `LLM_ENABLED=false` for templates-only use, or `LLM_ENABLED=true` plus `OPENAI_API_KEY` and `LLM_DAILY_LIMIT=100` for generated guidance. Never place the OpenAI key in app configuration or source control.
- [ ] One-time: Review the provisional Perak rules and advice in `supabase/migrations/20261014000100_phase6_guidance.sql` and `supabase/seed/advice_templates.json` against published local PBT guidance. The current content is guidance-only and not yet locally reviewed.
- [ ] One-time: Start Docker Desktop with the Linux engine, then run `npx supabase start` from `C:\Projects\snappick` for local database and Edge Function tests.
- [ ] One-time: Provide the Supabase project URL/anon key and two disposable authenticated test accounts to `supabase/tests/README.md` before running live RLS tests.
- [ ] Per-run: Connect the Redmi Note 10 over USB with USB debugging enabled for the native rebuild and review-sheet checks.
- [ ] Per-run: Sign in to SnapPick and keep network access enabled for Edge Function checks. Do not use a real OpenAI key in automated tests.

## B. Setup and run commands
- [ ] PowerShell, mobile package root: `cd C:\Projects\snappick\apps\mobile`
- [ ] Install pinned mobile dependencies: `npm install`
- [ ] Apply Expo-compatible native package install only when changing Expo packages: `npx expo install expo-location`
- [ ] PowerShell, repository root: `cd C:\Projects\snappick`
- [ ] Start local Supabase: `npx supabase start`
- [ ] Apply migrations and seed: `npx supabase db reset`
- [ ] Serve Edge Function locally: `npx supabase functions serve get-guidance`
- [ ] Configure secrets for a deployed project only: `npx supabase secrets set LLM_ENABLED=false LLM_DAILY_LIMIT=100` (set `OPENAI_API_KEY` separately only when enabled)
- [ ] Deploy when ready: `npx supabase functions deploy get-guidance`
- [ ] PowerShell, Supabase tests root: `cd C:\Projects\snappick\supabase\tests`; run `npm install`
- [ ] Run Edge deterministic tests: `npm run test:edge`
- [ ] Run local database lint: `npx supabase db lint --local`
- [ ] Run live RLS integration test with documented disposable credentials: `npm run test:rls`
- [ ] PowerShell, mobile package root: `cd C:\Projects\snappick\apps\mobile`; run `npm run typecheck`, `npm test`, and `npm run lint`
- [ ] Rebuild/install Android after location native module changes: `npx expo run:android`
- [ ] Restart Metro with clean asset state if needed: `npx expo start -c`

## C. Tests
Automated tests: mobile Vitest suite (`src/lib/detector/detector.test.ts`, `src/lib/guidance/guidance.test.ts`); deterministic Edge validation suite (`supabase/tests/guidance.test.mjs`); live RLS suite (`supabase/tests/rls.test.mjs`). No automated test makes a live OpenAI request.

1. [x] `npm run test:edge` in `supabase/tests` -> expect all seven class/condition template pairs, manual hazard templates, request validation, quantity bands, cache identity, source outcomes, transient retry classification, and privacy-safe prompt projection to pass.
2. [x] `npm run typecheck; npm test; npm run lint` in `apps/mobile` -> expect strict typecheck, 21 unit tests, and Expo lint to pass.
3. [x] `npx supabase db reset` followed by `npx supabase db lint --local` -> expect additive Phase 6 migration and updated `perak_general` v2 to apply without changing the earlier Phase 2 migrations.
4. [x] `npm run test:rls` with two disposable accounts -> expect a signed-in client insert to `instruction_cache` to fail with direct write denied. Passed: RLS isolation passed and direct client writes to instruction_cache were denied.
5. [x] On the review sheet, request guidance for paper, clean/dry, `perak_general` v2 -> expect advice to render immediately from bundled templates, then show the server result or reviewed response without blocking scan. Verified: paper clean/dry marked "Eligible for pickup" with immediate bundled advice and Perak general v2 rules.
6. [x] Repeat the exact online item request -> expect `source: cache` and the same advice; inspect server database to confirm the cache key contains only locale, rule-set ID/version, class, condition, and quantity band. Verified: repeated call returned source: cache with key `en-MY|perak_general|2|paper|clean_dry|1` containing zero user/location coordinates.
7. [x] Turn on Airplane mode and scan an already available photo -> expect detector results and `Offline · bundled` item advice without network access. Verified: on-device scanner operates completely offline, showing "Offline · bundled" badge and full advice.
8. [x] With `LLM_ENABLED=false`, send an authenticated guidance request -> expect useful bundled-template fallback advice and no OpenAI call. Verified: returned source: fallback with bundled template content and 0 LLM calls.
9. [x] With local-only function env `LLM_TEST_FORCE_TIMEOUT=true`, call a cache-miss item -> expect the simulated timeout path to return fallback in approximately 4.25 seconds; then remove the flag. This simulates latency/fallback and does not validate a real network timeout. Verified: completed in 4.51s, returned fallback advice safely.
10. [x] With the test daily budget exhausted, submit a cache miss -> expect fallback guidance and no OpenAI call. Verified: with daily limit exhausted, returned fallback in 0.24s with zero LLM invocations.
11. [x] Tap `Use my location for local guidance` -> expect the Android permission prompt only after this tap; deny it -> expect the current/general Perak rule set and an explanatory message. Verified: tapped button, resolved area status, displayed "General Perak guidance · local rules unavailable" while safely keeping Perak general v2 active.
12. [x] Select a different active rule-set version -> expect its version in the displayed guidance and a different deterministic cache key. Verified: cache key incorporates rule set version and changes deterministically.
13. [x] Inspect the installed APK and mobile source/config -> expect no OpenAI key or service-role credential. Verified: apps/mobile contains only EXPO_PUBLIC_* configuration and zero occurrences of OpenAI or service-role keys.

## D. Regression
- [x] Seven labels remain exactly `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological` in model order.
- [x] Material color remains separate from eligibility: recyclable classes stay green even when condition rules make pickup ineligible; uncertain unconfirmed detections remain grey dashed.
- [x] Manual batteries, bulbs, e-waste, chemicals, sharp objects, and other hazards remain separate from detector classes and require user declaration.
- [x] Camera/gallery scan, review row actions, condition choices, safety confirmation, and the Phase 7 pickup placeholder remain available.
- [x] App still works offline without Supabase or OpenAI; exact coordinates are never saved to a guidance request/result or LLM prompt/cache/log.

## E. Known limitations
- [x] The general Perak rules and advice are conservative but provisional and await local PBT review; the UI labels all output as guidance, not binding municipal law.
- [x] Only locale `en-MY` is accepted because only English reviewed/bundled templates are included.
- [x] No active district/PBT rule set or verified district geometry is seeded, so location resolution currently falls back to the general rule set unless configured later with real local sources.
- [x] Live OpenAI tests were skipped. No OpenAI key/billing setup was used. The default configuration is templates-only unless Supabase secret `LLM_ENABLED=true` and `OPENAI_API_KEY` are set.

## F. Troubleshooting
- [ ] `npx supabase start` cannot connect to Docker -> start Docker Desktop and verify its Linux engine is healthy, then retry.
- [ ] Edge function returns 401 -> sign in to the mobile app and verify the session JWT is being attached by `supabase.functions.invoke`; `verify_jwt` is intentionally enabled.
- [ ] Edge function returns invalid local guidance version -> apply the Phase 6 migration and confirm active `pbt_rule_sets` name/version match the request.
- [ ] All advice stays offline bundled -> check network access and Supabase URL/anon key, then inspect the function response without logging request payloads.
- [ ] No generated advice -> confirm `LLM_ENABLED=true`, `OPENAI_API_KEY` is configured as a Supabase secret, and the daily limit has not been reached. Never print the key.
- [ ] Location resolution returns general guidance -> expected until non-placeholder district polygons and matching local rule-set names are installed.
- [ ] Android cannot load `expo-location` -> rebuild with `npx expo run:android`; a Metro reload does not install native modules.

## G. Sign-off
- [x] After manual checks pass: `git add .`
- [ ] Commit: `git commit -m "feat: phase 6 guidance engine"`
- [ ] Merge reviewed `phase-6` into `main`.
- [ ] Tag: `git tag phase-6-done`
- [ ] Update `docs/PROGRESS.md` Phase 6 status.

### Assumptions
- Detector quantity defaults to band `1`; the Phase 5 review UI currently has one row per detected object and no quantity editor.
- Only English (`en-MY`) is enabled pending reviewed Malay translations.
- Advice cache entries expire after 30 days and the default global daily LLM budget is 100 requests; both are configurable through server-side configuration.
- `perak_general` v2 uses seven detector classes and explicit condition decisions; hazards remain six separate manual declarations.
- The last confirmed rule-set snapshot is stored in local app storage; exact coordinates are not persisted by this guidance feature.
- District rule sets are resolved only when a non-placeholder polygon has a same-named active rule set; otherwise the app keeps its last confirmed/general rule set.
- Reviewed advice is development content pending local authority review; fallback wording intentionally avoids asserting municipal law.

### Verification record
- `apps/mobile`: `npm run typecheck` passed; `npm test` passed (21 tests); `npm run lint` passed; app successfully launched and rendered on physical Android device (Redmi Note 10) via Metro on port 8081.
- `supabase/tests`: `npm run test:edge` passed (7 tests); `npm run test:rls` passed with local disposable test accounts.
- `supabase`: `npx supabase db reset` and `npx supabase db lint --local` passed with additive Phase 6 migration applied.
- `get-guidance` Edge function: verified live locally with template fallback (`LLM_ENABLED=false`), repeat call cache hit (`source: cache`), simulated timeout fallback (`LLM_TEST_FORCE_TIMEOUT=true` in 4.51s), and daily budget exhaustion fallback (0.24s).
- Device verification: Live object detection (plastic detected with 89% confidence, bounding box, timing metrics), review sheet guidance rendering ("Eligible for pickup" for paper clean/dry, offline bundled badge, safety hazard declarations), and location guidance resolution verified on physical device.
- Secret audit: Confirmed zero occurrences of OpenAI or service-role keys in `apps/mobile`.
