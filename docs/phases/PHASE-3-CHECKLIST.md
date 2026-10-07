# Phase 3 Checklist

## A. Manual work before testing

- [ ] One-time: Google Cloud Console -> create or select a project -> APIs & Services -> OAuth consent screen -> choose **External**, complete the app information, set publishing status to **Testing**, and add the test Gmail account under **Test users**.
- [ ] One-time: Google Cloud Console -> APIs & Services -> Credentials -> Create credentials -> OAuth client ID -> **Web application**. Copy the Web client ID and client secret.
- [ ] One-time: generate the Android debug SHA-1 from `apps/mobile/android` with `./gradlew signingReport` (PowerShell: `.\gradlew signingReport`) and record the `debug` SHA-1.
- [ ] One-time: Google Cloud Console -> APIs & Services -> Credentials -> Create credentials -> OAuth client ID -> **Android** -> package name `com.snappick.mobile` -> paste the debug SHA-1.
- [ ] One-time: Supabase Dashboard -> Authentication -> Providers -> Google -> enable Google -> paste the Web client ID and Web client secret -> Save.
- [ ] One-time: copy `apps/mobile/.env.example` to `apps/mobile/.env`, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the Web client ID, and keep the file ignored. Never put the client secret in the app.
- [ ] Per-build: repeat the Android OAuth client setup for every release signing certificate before testing a release build; the debug SHA-1 only covers local debug APKs.

## B. Setup and run commands

From `C:\Projects\snappick`:

```powershell
npx supabase db push
Copy-Item apps/mobile/.env.example apps/mobile/.env -ErrorAction SilentlyContinue
cd apps/mobile
npm install
npx expo prebuild --no-install
npx expo run:android
```

If `.env` already exists, edit it instead of overwriting it. After changing the Google client ID or the config plugin, run `npx expo prebuild --no-install` and rebuild the Android app; a Metro reload is not enough.

## C. Tests

1. Run `npx supabase db push` -> expect `20261007000400_phase3_consent_versions.sql` to apply without SQL errors and `profiles` to contain both consent version columns.
2. Open the debug build while signed out -> expect the Phase 1 email sign-in screen to remain available and a **Continue with Google** button to be visible.
3. Sign in with a new email/password user -> expect Step 1, **Keep your photos private by default**, before Home or any tab is accessible.
4. Tap **Decline for now** on Step 1 -> expect an explanatory message and the app to remain on Step 1; no tab is accessible.
5. Tap **I understand and agree**, then tap **Decline for now** on Step 2 -> expect an explanatory message and the app to remain on Step 2; no tab is accessible.
6. Accept both consent screens -> expect Home to open. Force-stop and reopen the app -> expect Home to open without showing consent again.
7. Sign out, tap **Continue with Google**, select the configured test Gmail account -> expect Supabase to create or link one user and open Step 1 if that account has no consent record.
8. On Profile, enter a display name and optional phone, tap **Save details**, force-stop, and reopen -> expect both values to remain in Profile and in the matching `profiles` row.
9. Toggle **Help improve SnapPick** on, force-stop, and reopen -> expect it to remain on and `training_opt_in_at` to be populated. Toggle it off -> expect it to remain off after reopening and its timestamp to be null.
10. Tap **Delete account (coming later)** -> expect no action; it is intentionally disabled in this phase. Tap **Sign out** -> expect the email sign-in screen.
11. Run `cd apps/mobile; npm run typecheck; npm run lint` -> expect both commands to exit with code 0.

## D. Regression

- Email sign-up and sign-in from Phase 1 still create and restore a Supabase session.
- Bottom navigation still contains Home, Activity, Scan, Request, and Profile after consent.
- `apps/mobile/.env` remains ignored and no Google client secret or Supabase service-role key is present in source.
- Phase 2 RLS remains enabled; a user can update only their own profile through the mobile app.

## E. Known limitations

- Only Android is supported; Google Sign-In requires the native development build and is not available in Expo Go.
- Google Cloud and Supabase provider configuration cannot be verified from this repository. A mismatched package name or SHA-1 produces a Google `DEVELOPER_ERROR` on the phone.
- Image-storage consent can be revoked only by the later consent route; the disabled switch in Profile displays the current required state.
- Training opt-in is persisted but no images are uploaded or used for training in this phase.
- Account deletion is intentionally a disabled placeholder and is implemented in a later phase.

## F. Troubleshooting

- **Google sign-in is not configured**: set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env`, restart Expo, run `npx expo prebuild --no-install`, and rebuild.
- **`DEVELOPER_ERROR`**: confirm the Android OAuth client uses package `com.snappick.mobile` and the SHA-1 of the exact APK signing key. Confirm that the Web client ID (not the Android ID) is in the app and Supabase.
- **No ID token returned**: use a Web OAuth client ID in `GoogleSignin.configure`, not the Android client ID.
- **Native module not found**: do not use Expo Go; run `npx expo run:android` after the config plugin is applied.
- **Profile or consent query fails**: apply the Supabase migrations with `npx supabase db push` and check that the signed-in user has a `profiles` row created by the Phase 2 trigger.
- **Email auth regression**: check `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; never substitute a service-role key.

## G. Sign-off

```powershell
git add apps/mobile supabase/migrations/20261007000400_phase3_consent_versions.sql docs/phases/PHASE-3-CHECKLIST.md docs/ENVIRONMENT.md
git commit -m "feat: phase 3 google sign-in consent and profile"
git checkout main
git merge phase-3
git tag phase-3-done
```

After the checklist is verified, update `docs/PROGRESS.md` to mark Phase 3 complete.

## Automated tests

- `cd apps/mobile; npm run typecheck` checks the strict TypeScript build, including Expo Router typed routes and Google Sign-In types.
- `cd apps/mobile; npm run lint` runs Expo ESLint checks.
- `cd supabase/tests; npm run test:rls` remains the Phase 2 RLS regression test and requires the two test-user environment variables from the Phase 2 checklist.

## Assumptions

- The Phase 2 `profiles` trigger exists on the linked Supabase project and creates a profile row for every email or Google auth user.
- Consent version `1` represents the wording shipped in this phase; changing consent wording requires a later migration or a new app consent version.
- The local Android debug keystore is the signing key used by `npx expo run:android`.
- The Google Web client ID is public OAuth configuration; the Web client secret remains only in Supabase Authentication provider settings.
- Manual Google Cloud, Supabase Dashboard, phone, and migration checks were not run by the coding agent; the checklist records the required verification.
