# SnapPick Development Guide

Day-to-day workflow. SnapPick is developed and tested **directly against the remote Supabase project** (linked with the Supabase CLI). There is no local Supabase workflow, and all code is Android only.

## 1. Prerequisites

Versions that work on the development machine are in [ENVIRONMENT.md](./ENVIRONMENT.md). In short: Node 24, npm, JDK 21, Android SDK (API 37, NDK 30) with `adb`, the Supabase CLI, Git, and an Android phone with USB debugging. Keep the repository at a short path such as `C:\Projects\snappick`; long Windows paths break Android native builds.

## 2. One-time setup

```powershell
git clone <repo> C:\Projects\snappick
cd C:\Projects\snappick
supabase login
supabase link --project-ref <your-project-ref>
```

Environment files (never commit real values):

| File | Variables |
|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, optional `EXPO_PUBLIC_MAP_STYLE_URL` |
| `apps/admin/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `KAGGLE_USERNAME`, `KAGGLE_KEY`, `KAGGLE_KERNEL_SLUG` |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`; optional server-only `DASHBOARD_AI_SECRET` (AI via the `dashboard-ai` function, see below), or `OPENAI_API_KEY` and `OPENAI_MODEL` for local use only; optional APK values `NEXT_PUBLIC_APK_*` |
| Supabase function secrets | `DASHBOARD_AI_SECRET` (the same value as in `apps/web/.env.local`; lets the website call `dashboard-ai`), `OPENAI_API_KEY`, `LLM_ENABLED`, `LLM_DAILY_LIMIT` (set with `supabase secrets set`), plus the Firebase and notify secrets used by the `notify` function |

Copy `.env.example` in each folder and fill it in. The service-role key and the OpenAI key never go into the mobile app, the admin app or git. The service-role key lives only in the Kaggle notebook's secrets.

Google sign-in and Firebase push notifications are configured in Google Cloud and Firebase. The Android package name is `com.snappick.mobile`.

## 3. Run the mobile app

```powershell
cd apps\mobile
npm install
npx expo run:android      # first time, and after any native change
npx expo start            # day-to-day; reloads JavaScript changes
```

- Use the **development build**, not Expo Go (MapLibre, TFLite and Google sign-in are native).
- A new native library or config plugin needs `npx expo run:android` again, not a reload.
- After changing `metro.config.js`, run `npx expo start -c`.
- In a development build, the bundled model file is fetched from your laptop's Metro server. If you restart the app while the phone cannot reach the laptop (for example Wi-Fi off), scanning fails until it can. A release build bundles the model.

## 4. Run the admin dashboard

```powershell
cd apps\admin
npm install
npm run dev               # http://localhost:3001
```

Sign in with an account that has `profiles.is_admin = true`. See [KAGGLE_SETUP.md](./KAGGLE_SETUP.md) before using Retrain.

## 5. Tests and checks

```powershell
cd apps\mobile
npm test                  # Vitest unit tests (pure TypeScript)
npm run typecheck
cd ..\admin
npx tsc --noEmit
```

**Backend checks against the remote project** (`supabase/tests/remote-e2e.mjs`) sign in as the two test accounts and check permissions, privacy, proof rules, disputes, ratings and limits. They create and cancel pickup requests, so they only run when you opt in:

```powershell
cd supabase\tests
npm install
$env:E2E_CONFIRM_REMOTE = "yes"
$env:SUPABASE_URL = "..."; $env:SUPABASE_ANON_KEY = "..."
$env:TEST_USER_A_EMAIL = "test_a@gmail.com"; $env:TEST_USER_A_PASSWORD = "..."
$env:TEST_USER_B_EMAIL = "test_b@gmail.com"; $env:TEST_USER_B_PASSWORD = "..."
npm run test:remote
```

Behaviour that depends on time (claim expiry after 24 hours, auto-complete after 48 hours) cannot be waited for. To test it, backdate a test request with SQL and call `expire_unstarted_pickup_claims(now())` or `auto_complete_pickups(now())`.

## 6. Database

```powershell
supabase migration new <name>     # create supabase/migrations/<timestamp>_<name>.sql
supabase db push --linked --dry-run
supabase db push --linked         # apply to the remote project
supabase db query --linked "select ..."   # run SQL against the remote project
```

Rules: schema changes only through migration files; never edit an applied migration (add a new one); keep migrations small and reversible where possible. Edge functions are deployed with `supabase functions deploy <name>`.

Test data helpers (run from `apps/mobile`):

| Command | Effect |
|---|---|
| `npm run db:clean` | Deletes scans, pickups, proofs, ratings and disputes. **Keeps users and profiles.** |
| `npm run db:seed` | Adds sample data for the two test accounts. |
| `npm run db:seed-pilot` | Adds about six months of anonymous sample activity (136 fake accounts at `@pilot.snappick.test`) for the public dashboard. Re-running replaces it. |
| `npm run db:clean-pilot` | Removes only that sample data. |
| `scripts/seed_demo_account.sql` then `supabase/tests/seed-demo.mjs` | Makes the Google demo account (adyhafetz@gmail.com) look lived-in for recordings: scans, completed and pending pickups, 8 open pins on the Collect map from the test accounts, and one pickup awaiting confirmation with a proof photo. Clean with `scripts/clean_demo_account.sql` and `seed-demo.mjs clean`. |
| `npm run db:reset` | Clean, then seed. |
| `npx supabase db query --linked -f scripts/clean_all_data.sql` | Resets the remote project to **accounts only**: keeps the four real accounts (`adyhafetz@gmail.com`, `test_a`, `test_b`, `test_admin`), the districts, rule sets and model v0; deletes every sample user and all activity, the AI caches and the dashboard figures. Does not delete files in storage. A single transaction that stops if one of the four accounts is missing. |

These act on the **linked remote project**, so only use them while it holds test data.

## 7. Common problems

| Symptom | Fix |
|---|---|
| Model file not found / Metro errors about `.tflite` | `tflite` must be in `resolver.assetExts`; then `npx expo start -c`. Keep model files outside `src/app` (Expo Router treats that folder as routes). |
| `react-native-fast-tflite` errors | Load with a delegates list (`[]` for CPU) and pass and receive `ArrayBuffer`s. Read the input layout (channels-first or last) from the tensor shapes. |
| Map does not render | MapLibre needs the new architecture and a development build. Coordinates are `[longitude, latitude]`. |
| Android build fails with a path-too-long error | Move the repository to a shorter path. |
| Admin shows "Access denied: account is not an admin" | Set `is_admin = true` on that profile. |
| Retrain stops with "Supabase secrets are missing" | Attach the two secrets to the Kaggle notebook (see KAGGLE_SETUP.md). |
