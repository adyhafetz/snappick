# Phase 8 Checklist: Collector Marketplace and Claim

## A. Manual work before testing
- [ ] One-time per Supabase project: enable/confirm `pg_cron` at Supabase Dashboard → Database → Extensions. The migration enables it when available; local verification found pg_cron 1.6.4 and the scheduled job.
- [ ] One-time: prepare two disposable authenticated accounts; for the ten-session race, configure ten collector credential entries in `CLAIM_RACE_USERS_JSON` (the same disposable collector can be repeated for a local concurrency smoke test).
- [ ] Per-run: use two Android devices or the Redmi Note 10 plus an emulator, sign in as requester and collector, and confirm the app is using the intended Supabase project.
- [ ] One-time before deployment: review OpenFreeMap terms and attribution. MapLibre attribution is enabled in both Request map modes.
- [x] Per-run Android: verify map tiles and attribution display. Result: MapLibre tiles, attribution control, and attribution label rendered on the Redmi Note 10. Marketplace rows did not load because the app's configured hosted Supabase project does not yet have the Phase 8 migration.
- [ ] Per-run Android: with Phase 8 migration deployed to the selected test project, verify a public pending request shows only its approximate grid point and one badge represents each cell.

## B. Setup and run commands
- [x] PowerShell, repository root: `cd C:\Projects\snappick`
- [x] Start local Supabase: `npx supabase start` (passed).
- [x] Rebuild database from migrations and seed: `npx supabase db reset` (Phase 8 migration applied successfully).
- [x] Apply the follow-up release-contract migration without resetting local data: `npx supabase migration up --local` (applied `20261018000200_release_accepted_pickups_after_window.sql`).
- [x] Lint the Phase 8/public schema: `npx supabase db lint --local --schema public --fail-on error` (no schema errors). Whole-database lint also reports existing PostGIS `extensions` diagnostics; it is not used as the Phase 8 acceptance result.
- [ ] PowerShell, Supabase test root: `cd C:\Projects\snappick\supabase\tests`; set local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (marketplace expiry fixture and expiry tests only), `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, and `TEST_USER_B_PASSWORD` for disposable local users.
- [x] Race configuration: set `CLAIM_RACE_USERS_JSON` to a JSON array of ten `{ "email": "...", "password": "..." }` entries. The local test used ten independent authenticated clients against the real RPC.
- [x] Start the local private-details function in a second terminal: `cd C:\Projects\snappick` then `npx supabase functions serve get-pickup-private-details --no-verify-jwt` (handler-level authentication was exercised).
- [x] Mobile: `cd C:\Projects\snappick\apps\mobile`; `npm test`, `npm run typecheck`, and `npm run lint` (all passed).
- [x] Native Android rebuild/install: `npx expo run:android` from `apps/mobile` (BUILD SUCCESSFUL; APK installed and opened on Redmi Note 10).
- [ ] For visual/device checks after build, start or keep Metro available with `npx expo start -c` from `apps/mobile`.

## C. Tests
Automated suites and how to run them:
- Mobile unit tests: `npm test` from `apps/mobile`.
- Mobile strict typecheck and lint: `npm run typecheck` and `npm run lint` from `apps/mobile`.
- Request RPC/privacy integration: `npm run test:pickup` from `supabase/tests`.
- Marketplace/claim/Edge integration: `npm run test:marketplace` from `supabase/tests` (requires local Edge Function server, two disposable accounts, and the local service-role key for the expired-status fixture).
- Expiry integration: `node expiry.test.mjs` from `supabase/tests` (requires two accounts and local service-role key).
- Production RPC race: `node ..\..\scripts\test-claim-race.mjs` from `supabase/tests` (requires requester credentials and ten entries in `CLAIM_RACE_USERS_JSON`).
- RLS regression: `npm run test:rls` from `supabase/tests`.
- Guidance Edge regression: `npm run test:edge` from `supabase/tests`.
- Public schema lint and migrations: `npx supabase db lint --local --schema public --fail-on error` and `npx supabase db reset` from repository root.

1. [x] `npx supabase db reset` → expect every migration through Phase 8 to apply and seed successfully. Result: passed.
2. [x] `npx supabase db lint --local --schema public --fail-on error` → expect no public schema errors. Result: passed, no schema errors.
3. [x] `npm test` from `apps/mobile` → expect pickup/map/navigation helpers plus detector and guidance regressions. Result: 30 tests passed across 3 files.
4. [x] `npm run typecheck` and `npm run lint` from `apps/mobile` → expect strict TypeScript and Expo lint to pass. Result: both passed.
5. [x] `npm run test:pickup` from `supabase/tests` → expect Phase 7 creation/geofence/privacy/RPC behavior to remain intact. Result: passed.
6. [x] `npm run test:marketplace` with local Edge Function serving → expect self-claim/anonymous denial, assigned-only private details, claim cap, safe approximate view, claim/start/release state behavior, safe view hiding/restoring claims, and a channel subscription. Result: passed, including release returning an accepted claim to `pending` after its pickup window. Local Realtime broadcast messages were written, but end-to-end delivery timing was not observed reliably in the local Realtime container; verify on the project/device before sign-off.
7. [x] `node expiry.test.mjs` → expect a simulated 25-hour accepted claim to return to pending, an in-progress claim to remain active, and a repeated run to change zero rows. Result: passed (1 then 0 rows changed).
8. [x] `node ..\..\scripts\test-claim-race.mjs` → expect ten authenticated callers against the real `claim_pickup_request` RPC to yield exactly one winner. Result: passed; fixture was released and cancelled. This was not a mocked race.
9. [x] `npm run test:rls` from `supabase/tests` → expect existing cross-user and anonymous isolation regressions to pass. Result: passed.
10. [x] `npm run test:edge` from `supabase/tests` → expect Phase 6 guidance Edge tests to pass. Result: 7 tests passed.
11. [x] `npx supabase db query --local "select jobname, schedule from cron.job where jobname='expire-unstarted-pickup-claims';"` → expect the expiry schedule. Result: `*/15 * * * *`; pg_cron 1.6.4.
12. [x] `npx supabase db query --local "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pickup_requests_public';"` → expect no raw request-table publication, preventing row payloads from containing requester/collector IDs. Result: no rows. The database emits a refresh-only broadcast and the marketplace queries the safe aggregate view; the client never subscribes to `pickup_request_private_details`.
13. [x] `npx expo run:android` from `apps/mobile` → expect a successful Android development build/install after the navigation intent query. Result: BUILD SUCCESSFUL; app opened on the Redmi Note 10, and the Request tab screenshot showed rendered tiles plus visible attribution. The configured hosted backend lacked the Phase 8 marketplace view, so its request query failed; two-account behavior is not claimed.
14. [ ] Android, account A creates a pending request with the Phase 7 flow; account B opens Request → expect one approximate-grid marker with a server count and safe summary only. Result: pending; hosted project migration is not applied.
15. [ ] Android, requester A opens their own marker and taps Claim → expect server rejection and no private details. Result: automated RPC own-claim denial passed; device check pending.
16. [ ] Android, accounts B and C claim the same request as close together as possible → expect one accepted result, one unavailable result, and the pin removed for other clients. Result: real ten-client RPC race passed; device/realtime propagation pending.
17. [ ] Android, winner opens Activity → Pickups I Claimed → expect safe summary first, then the authorized address/access details; account C requests the same details → expect denial without private fields. Result: local Edge integration passed for assigned/requester/anonymous cases; device check pending.
18. [ ] Android, winning collector taps Navigate → expect Android navigation at the authorized destination; disable/uninstall navigation app and retry → expect generic Google Maps fallback. Result: URL/fallback unit tests passed; device handoff pending.
19. [ ] Android, collector taps Start pickup → expect `in_progress` in collector and requester Activity; release a separate accepted job before starting → expect `pending`; try releasing an in-progress job → expect rejection. Result: local RPC tests passed; device/requester Activity check pending.
20. [ ] Simulate a 25-hour-old accepted claim with the deterministic helper and run expiry → expect it returned to `pending`; run again → expect zero additional changes; confirm `in_progress` stayed unchanged. Result: automated expiry integration passed; scheduled production execution/manual account check pending.
21. [ ] Android, keep Request open on another client while creating, claiming, releasing, and expiring requests; reconnect after disconnect → expect safe pins to refresh within seconds and recover. Result: generic broadcast channel subscribed and local trigger rows written; delivery/reconnect timing remains unverified.
22. [ ] Inspect public view/API responses, Realtime payloads, and logs before/after unauthorized access → expect approximate coordinates only in marketplace data and no addresses, exact coordinates, access notes, user IDs, or private details. Result: safe view and refresh-only trigger were tested; hosted/device/log inspection pending.

## D. Regression
- [x] Detector contracts and labels remain unchanged: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological` in that order; detector unit tests passed.
- [x] Phase 7 request creation, geofence, private requester details, cancellation, and RLS regression passed via `npm run test:pickup` and `npm run test:rls`.
- [ ] On Android, submit a reviewed pickup through Request → Request pickup and verify Phase 7 request form behavior and requester Activity status remain unchanged.
- [ ] On Android, confirm requester Activity refreshes from `accepted` to `in_progress` while the collector transitions the job.

## E. Known limitations
- [ ] Two-account, two-device claim/privacy/navigation test is pending; no manual device workflow is claimed as passed.
- [x] The configured mobile `.env` targets a hosted Supabase project where this Phase 8 migration has not been applied. The Request tab therefore displays the safe-view load error until the migration is deployed to that project. No remote migration was applied in this implementation session.
- [ ] Local Realtime writes to `realtime.messages` were observed, but broadcast delivery to the local client was not verified. Reconnect recovery is implemented through Supabase channel rejoin plus a fresh safe-view query; cloud/device recovery still needs verification.
- [ ] Generic-map fallback and Android `google.navigation` intent selection are covered by pure unit tests only; actual Android app handoff is unverified.
- [ ] Expiry is scheduled every 15 minutes, so an eligible unstarted claim may remain accepted until the next job run after its 24-hour threshold.
- [x] Phase 9 proof/checklist/completion, notifications, disputes, and all later phases are intentionally out of scope.

Assumptions made:
- [x] All authenticated users may also collect; no collector mode or separate role is required.
- [x] The existing server-generated 0.01-degree snapped point is the marketplace grid contract; exact coordinates remain in private details and only enter the authorized Edge response.
- [x] A simultaneous active claim means a request in `accepted` or `in_progress`; the three-job cap is enforced under a per-user transaction advisory lock.
- [x] The 24-hour timeout is based on `claimed_at`, and `in_progress` is never auto-released. No existing timeout setting existed to make configurable.
- [x] Expired pickup windows are excluded from the pending marketplace view and rejected by the claim RPC; expiry does not rewrite other lifecycle statuses.
- [x] The initial marketplace camera remains centered on the existing Ipoh/Kinta fixture point; location permission is not required to browse.
- [x] Generic Realtime events contain only a refresh flag and no request IDs, coordinates, or user/private fields. The client re-queries the safe aggregate view.

## F. Troubleshooting
- [ ] Migration cannot create/schedule pg_cron → enable it from Supabase Dashboard → Database → Extensions, then rerun migrations; confirm `cron.job` contains `expire-unstarted-pickup-claims`.
- [ ] Claim returns `ACTIVE_CLAIM_LIMIT_REACHED` → inspect Activity → Pickups I Claimed; accepted and in-progress jobs both count. Release only an accepted job that has not started.
- [ ] Details function returns 401/403 → confirm the Edge Function is deployed/served, the app has a current signed-in session, and the request is assigned to that account; do not grant direct client access to private details.
- [ ] Realtime is degraded → confirm Realtime service and the `pickup-marketplace` broadcast trigger, then retry/reopen Request. The safe view is refetched on channel reconnect; the base request table is intentionally not published.
- [ ] Android navigation falls back or reports no map app → confirm a navigation-capable app is installed; the generic HTTPS Google Maps destination is the fallback. Rebuild after Android manifest/config changes.
- [ ] Map style fails → check connectivity and `EXPO_PUBLIC_MAP_STYLE_URL`; keep attribution enabled and use the approved MapTiler fallback only through ignored `apps/mobile/.env` configuration.

## G. Sign-off
- [ ] Review the pending Android two-account, Realtime delivery, tile/attribution, and navigation checks before phase sign-off.
- [ ] Stage Phase 8 files and commit: `git add apps/mobile/android/app/src/main/AndroidManifest.xml apps/mobile/src/app apps/mobile/src/components/pickup apps/mobile/src/lib/pickup docs/ENVIRONMENT.md docs/phases/PHASE-8-CHECKLIST.md scripts/test-claim-race.mjs supabase/functions/get-pickup-private-details supabase/migrations/20261018000100_phase8_collector_marketplace.sql supabase/tests && git commit -m "feat: phase 8 collector marketplace and claim"`
- [ ] Merge the reviewed Phase 8 branch into `main`.
- [ ] Tag after verification: `git tag phase-8-done`.
- [ ] Update `docs/PROGRESS.md` Phase 8 status only after manual checks pass.
