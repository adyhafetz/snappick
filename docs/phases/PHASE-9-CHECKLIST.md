# Phase 9 Checklist: Completion, Proof, and Notifications

## A. Manual work before testing
- [x] One-time Firebase: create a Firebase project and Android app with package `com.snappick.mobile`.
- [x] One-time Firebase: download `google-services.json` into `apps/mobile/google-services.json`; it is ignored by git. Confirm Firebase Installations and Cloud Messaging APIs are enabled.
- [x] One-time Supabase: store `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, and a high-entropy `NOTIFY_SECRET` as Supabase secrets. Configure `app.supabase_url`, `app.supabase_anon_key`, and `app.notify_secret` through protected project settings/Vault for the database status trigger.
- [x] One-time Android: rebuild the development build after adding `google-services.json` with `npx expo run:android`; notification APIs require a development/native build, not Expo Go.
- [x] One-time: create three disposable authenticated accounts (requester, collector, unrelated third user) and set `TEST_USER_A_*`, `TEST_USER_B_*`, and `TEST_USER_C_*` for local integration tests.
- [x] Per-run: use two Android accounts/devices and keep the app battery setting at “No restrictions” while testing background notifications.

## B. Setup and run commands
```powershell
cd C:\Projects\snappick
npx supabase start
npx supabase db reset
npx supabase db lint --local --schema public --fail-on error

cd apps\mobile
npm install
npm test
npm run typecheck
npm run lint
npx expo run:android

cd ..\..\supabase\tests
$env:SUPABASE_URL="http://127.0.0.1:54321"
$env:SUPABASE_ANON_KEY="<local anon key>"
$env:SUPABASE_SERVICE_ROLE_KEY="<local service role key>"
$env:TEST_USER_A_EMAIL="<requester>"; $env:TEST_USER_A_PASSWORD="<password>"
$env:TEST_USER_B_EMAIL="<collector>"; $env:TEST_USER_B_PASSWORD="<password>"
$env:TEST_USER_C_EMAIL="<unrelated>"; $env:TEST_USER_C_PASSWORD="<password>"
npm run test:completion
```

Automated checks implemented:
- Mobile unit tests cover checklist quantities/reasons and proof resizing/metadata stripping. Run `npm test` from `apps/mobile`.
- Mobile strict typing and lint run with `npm run typecheck` and `npm run lint`.
- `npm run test:completion` exercises collection submission, zero collection, confirmation, disputes, relisting authorization, idempotent auto-completion, upload paths, and unrelated proof denial. Ran to completion and passed with local test credentials.

## C. Tests
1. **Create → claim → start → checklist → proof → requester confirmation → completed** → requester creates a recyclable request; collector claims and starts it; every checklist row has a bounded collected quantity, condition, and reason when partial; collector uploads a JPEG under `<collector-id>/<request-id>/<name>.jpg`; submit changes status to `awaiting_confirmation`; requester confirms within 48 hours and status becomes `completed`.
2. **Zero collection** → collector sets every quantity to zero, selects a request-level reason, and uploads evidence → status becomes `not_collected`; it never silently returns to `pending`.
3. **Checklist validation** → invalid quantity, condition, incomplete row, or missing partial reason → submission is rejected with a readable error.
4. **Proof privacy** → requester or assigned collector calls `get-pickup-proof` → receives a five-minute signed URL; unrelated third user calls it → receives denial and no URL.
5. **Proof minimisation** → upload a photo larger than 800 px or containing EXIF → stored JPEG is resized to the 800 px maximum and EXIF/GPS segments are stripped before upload.
6. **Requester dispute** → requester raises a reason while status is `awaiting_confirmation` and before the deadline → one `disputes` row is created and status becomes `disputed`; repeated or late raises are rejected.
7. **Dispute outcomes** → admin-only `resolve_dispute` with `upheld` produces `not_collected`; `rejected` produces `completed`; `inconclusive` produces `completed` with `dispute_outcome = inconclusive`; non-admin callers are rejected.
8. **Relist** → requester relists an original `not_collected` request → status becomes `pending` with no collector; relisting any other status is rejected.
9. **Automatic completion** → set an eligible `awaiting_confirmation` deadline in the past and call `auto_complete_pickups(now())` → one row becomes `completed`; repeat → zero rows change; a disputed request is not auto-completed.
10. **Notification authorization/privacy** → token registration writes only the signed-in user’s Android token; notification payload contains only `request_id`, `status`, title, and status text; requests without the server secret are rejected; FCM delivery is only claimed after a real Firebase device test.
11. **Android foreground/background** → with Firebase credentials and a rebuilt app, transition a request while the app is foregrounded and backgrounded → status notification appears with no address, note, image, exact coordinate, token, or user ID.

## D. Regression
- [x] Detector labels and order remain `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`.
- [x] Phase 8 migration and marketplace schema still apply during `npx supabase db reset`.
- [x] Existing mobile detector, guidance, pickup, and marketplace unit suites remain green.
- [ ] Repeat the Phase 8 two-account claim/start/navigation device checks after the Phase 9 native rebuild.
- [ ] Confirm the hosted Supabase project has both Phase 8 and Phase 9 migrations before remote/device verification.

## E. Known limitations
- [x] Firebase project, service-account secrets, `google-services.json`, native rebuild, and real FCM foreground/background delivery were verified on physical device (Xiaomi Redmi Note 10S).
- [ ] Supabase hosted cron/pg_net invocation of the `notify` Edge Function is unverified; local `pg_cron` schedules `auto-complete-pickups` every 15 minutes, and the deterministic RPC is covered by the integration test when credentials are supplied.
- [ ] The current requester dispute control uses a concise fixed reason on Android; the recorded reason remains editable through the documented RPC/admin workflow.
- [ ] No Phase 14 admin screen, trust score, penalty, or dispute dashboard is included.
- [x] The Phase 9 integration suite (`completion.test.mjs`) was verified and executed locally with 3 disposable users.

## F. Troubleshooting
- `google-services.json` missing during `npx expo run:android` → complete Firebase setup and place the file at `apps/mobile/google-services.json`; do not commit it.
- `getDevicePushTokenAsync` returns no FCM token → use a physical Android development build with Google Play services and verify Firebase package/SHA-1 configuration.
- Proof upload is denied → verify the path starts with the signed-in collector UUID and includes the request UUID; do not broaden the storage policy.
- `REQUEST_NOT_SUBMITTABLE` → confirm the caller is the assigned collector and the request is still `in_progress`.
- `REQUEST_NOT_CONFIRMABLE` or `REQUEST_NOT_DISPUTABLE` → confirm the requester owns the request and the 48-hour confirmation deadline has not passed.
- Scheduled completion does not run locally → call `select public.auto_complete_pickups(now());` deterministically and inspect `cron.job`; hosted invocation requires the documented Supabase Cron/Vault setup.

## G. Sign-off
```powershell
git add .
git commit -m "feat: phase 9 completion proof notifications"
git checkout main
git merge phase-9
git tag phase-9-done
git push --follow-tags
# Tick Phase 9 in docs/PROGRESS.md after the manual checklist is complete.
```

Assumptions made:
- The existing Phase 2 table contracts and Phase 7/8 migrations are applied in order; Phase 9 adds only `20261018000300_phase9_completion_proofs_notifications.sql`.
- A proof path is owner-scoped as `<collector UUID>/<request UUID>/<filename>.jpg`; the service function, upload policy, and RPC validate that shape.
- `expo-notifications` 57.0.23 direct FCM device tokens are used because the repository contract names FCM rather than Expo relay tokens.
- FCM service-account signing is performed in the Edge Function with Web Crypto RS256; credentials never enter the mobile app or git.
- The scheduled job runs every 15 minutes, so the documented 48-hour completion threshold may be processed on the next run.

