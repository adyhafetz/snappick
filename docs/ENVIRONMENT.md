# ENVIRONMENT.md

Machine and toolchain facts for SnapPick. The AI assistant reads this file in every session (see `AGENTS.md`). **Only the values marked Recorded come from commands run on this machine.** Anything marked To verify has not been checked yet; do not treat it as confirmed.

Last updated: 2026-10-29 (Pre-Phase 11 codebase hygiene and documentation alignment)

---

## 1. Machine

| Item | Value | Status |
|---|---|---|
| OS | Windows, build 10.0.26300 (as reported by `adb`) | Recorded |
| Shell | PowerShell with conda `(base)` auto-activated | Recorded |
| Repository path | `C:\Projects\snappick` (short path, required on Windows) | Recorded |
| RAM and free disk | 16+ GB RAM, >40 GB free | Recorded |
| Long paths enabled (registry and `git config --system core.longpaths true`) | Enabled | Recorded |

---

## 2. Core toolchain

| Tool | Version | Status | Notes |
|---|---|---|---|
| Node.js | v24.20.0 | Recorded, accepted | The Phase 0 spike and mobile builds ran on it without issues. |
| npm | 11.19.0 | Recorded | Package manager for all JavaScript apps. |
| Git | 2.56.0.windows.1 | Recorded | |
| JDK | OpenJDK Temurin 21.0.12.1 (LTS) | Recorded, accepted | Verified compatible with Expo SDK 57 Android Gradle builds. |
| adb | 1.0.41, version 37.0.1-15733141 | Recorded | Platform-tools in `%LOCALAPPDATA%\Android\Sdk\platform-tools` |
| conda | 26.7.1 | Recorded | |
| Python (env `snappick`) | 3.11.17 | Recorded | ML pipeline environment (`C:\Users\adyha\miniconda3\envs\snappick\python.exe`) |
| Python (env `snappick-label`) | exists | Recorded | Separate env for Label Studio only. |
| Android Studio version | Android Studio Ladybug / Koala Feature Drop | Recorded | |
| Code editor and AI assistant | Antigravity IDE (Gemini 3.8 Flash) | Recorded | |

---

## 3. Android SDK

`ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk` (Recorded, set and non-empty)

| Component | Installed | Status |
|---|---|---|
| SDK Platform | Android 17, API level 37 | Recorded |
| Build-Tools | 37.0.0 | Recorded |
| NDK (Side by side) | 30.0.16248370 | Recorded |
| Command-line Tools | 23.0 | Recorded |
| CMake | 4.1.2 | Recorded |
| Platform-Tools (adb) | 37.0.1 | Recorded |
| SDK package and licence management | Android CLI (`android sdk install/update/remove`), licences accepted | Recorded |

**Expo SDK 57 requirements**:
- `compileSdkVersion`: 35 (configured via Expo Gradle plugin)
- `targetSdkVersion`: 35
- React Native / React: 0.86.3 / 19.2.3

---

## 4. Test device

| Item | Value | Status |
|---|---|---|
| Phone | Redmi Note 10 | Recorded |
| Android version | 12 (Xiaomi MIUI) | Recorded |
| Role | Reference phone for latency measurements & native development builds | Recorded |
| USB debugging | Working: `adb devices` lists the phone as `device` | Recorded |
| Second test device | Android emulator / secondary test device | Available for marketplace testing |

**Xiaomi-specific notes:**
- Enable **USB debugging** and **Install via USB** in Developer options.
- When testing notifications, set app battery to **No restrictions** and enable **Autostart**.

---

## 5. Project identifiers (do not change)

| Item | Value |
|---|---|
| Android package name | `com.snappick.mobile` |
| Used by | Expo `app.json`, Google sign-in (Phase 3), Firebase (Phase 9) |
| Supabase project ref | Local (`127.0.0.1:54321`) & linked remote |
| Supabase region | `ap-southeast-1` (Singapore) |
| GitHub repository | `snappick` |

The Supabase URL and anon key go in `apps/mobile/.env` (git-ignored). **Never write secret keys in this file.**

---

## 6. Project library versions

Exact installed versions verified via `npm ls` / `pip list`:

| Package | Version | Recorded in phase |
|---|---|---|
| expo | 57.0.27 | Phase 1 (SDK 57) |
| expo-router | 57.0.25 | Phase 1 |
| expo-dev-client | 57.0.19 | Phase 1 |
| @react-native-async-storage/async-storage | 2.2.0 | Phase 1 |
| react-native | 0.86.3 | Phase 1 |
| react | 19.2.3 | Phase 1 |
| @supabase/supabase-js | 2.117.2 | Phase 1 |
| @react-native-google-signin/google-signin | 16.1.5 | Phase 3 |
| Supabase CLI | 2.119.0 | Phase 2 |
| pg_cron (local Supabase extension) | 1.6.4 | Phase 8 expiry & Phase 9 auto-completion schedules |
| react-native-fast-tflite | 3.0.1 | Phase 5 (exact installed; CPU delegate `[]`) |
| react-native-nitro-modules | 0.37.1 | Phase 5 |
| expo-location | 57.0.21 | Phase 6 (`npx expo install`) |
| expo-network | 57.0.2 | Phase 7 (`npx expo install`) |
| expo-camera | 57.0.6 | Phase 5 |
| expo-image-manipulator | 57.0.21 | Phase 5 |
| expo-image-picker | 57.0.4 | Phase 5 |
| expo-notifications | 57.0.23 | Phase 9 (`npx expo install`) |
| patch-package | 8.0.1 | UI Redesign (`react-native-css-interop` fix) |
| jpeg-js | 0.4.4 | Phase 5 |
| base64-js | 1.5.1 | Phase 5 |
| vitest | 3.2.4 | Phase 5 pure TypeScript unit tests (63 tests) |
| nativewind | 4.2.7 | UI Redesign |
| tailwindcss | 3.4.19 | UI Redesign |
| tailwind-merge | 3.7.0 | UI Redesign |
| class-variance-authority | 0.7.1 | UI Redesign |
| clsx | 2.1.1 | UI Redesign |
| lucide-react-native | 1.56.0 | UI Redesign (vector iconography) |
| @rn-primitives (core components) | 1.5.2 | UI Redesign (accessible primitives) |
| @maplibre/maplibre-react-native | 11.5.0 | Phase 7 (`npx expo install`) |
| ultralytics (Python) | 8.4.173 | Phase 4 audit environment |
| tflite (Python FlatBuffer inspector) | 2.10.0 | Phase 4 |
| next | (Pending Phase 13) | Phase 13 |

---

## 7. Deviations and risks to watch

1. **JDK 21 instead of 17.** Expo and React Native 0.86 Android builds compile cleanly with Temurin JDK 21.0.12.1.
2. **Android SDK API 37 and NDK 30.** Android CLI and Gradle automatically resolve compatible build tools.
3. **Node v24.** Accepted and verified across all build steps and integration tests.
4. **Android package name** `com.snappick.mobile` remains uniform across Expo, Google Cloud OAuth, and Firebase FCM v1.

---

## 8. Still to verify before Phase 11

- [x] Node, JDK: accepted because builds run cleanly
- [x] `conda env list` shows both `snappick` and `snappick-label`
- [x] `adb devices` lists the phone as `device`
- [x] SDK licences: handled by Android CLI
- [x] Mobile test suite passes (11 test files, 63 tests passing)
- [x] ML contracts & scripts unit tests pass (10 tests passing across `ml/tests` and `scripts`)
- [x] Supabase integration tests configured for RLS, pickup, marketplace, expiry, completion, feedback
- [x] Legacy stub code and default Expo template assets purged
- [x] ESLint react-hooks pure function errors resolved

---

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | Initial record from Prerequisite Part F command output |
| 2026-10-06 | Confirmed `snappick-label` env and `adb devices`; accepted JDK 21 and Node 24; licences handled by Android CLI |
| 2026-10-06 | Phase 1 installed Expo 57.0.27, React Native 0.86.3, React 19.2.3, Expo Router 57.0.25, Expo Dev Client 57.0.19, AsyncStorage 2.2.0, and Supabase JS 2.117.2; native Android build passed on connected phone |
| 2026-10-07 | Phase 2 added database/security migrations, seed, RLS test package; applied migrations to linked Supabase project |
| 2026-10-07 | Phase 3 installed `@react-native-google-signin/google-signin` 16.1.5; native Android build passed |
| 2026-10-13 | Phase 4 inspected M0 FlatBuffer with `tflite` 2.10.0; audit environment records Ultralytics 8.4.173 |
| 2026-10-13 | Phase 5 pinned fast-tflite 3.0.1 / Nitro 0.37.1; added camera, image manipulator, picker, JPEG decode, and Vitest |
| 2026-10-14 | Phase 6 added expo-location 57.0.21; integrated local guidance and cached advice |
| 2026-10-14 | UI Redesign: integrated NativeWind 4.2.7, Tailwind CSS 3.4.19, Lucide React Native 1.56.0, and @rn-primitives 1.5.2 |
| 2026-10-16 | Phase 7 installed `@maplibre/maplibre-react-native` 11.5.0 and `expo-network` 57.0.2; imported DOSM Perak district boundaries |
| 2026-10-18 | Phase 8 added collector marketplace with grid aggregation, atomic `claim_pickup_request` RPC, pg_cron unstarted expiry, and navigation launcher |
| 2026-10-19 | Phase 9 added completion checklist (`submit_collected_items`), proof photo downsampling/stripping, `get-pickup-proof` Edge Function, auto-completion cron, OSRM routing preview, and `expo-notifications` 57.0.23 with RS256 FCM v1 signing |
| 2026-10-21 | Phase 10 added active learning selection (confidence 0.40–0.79, user corrections, 5% random sampling), opt-in upload gating, count-match verification, label tiers A/B/C/D, persistent offline upload queue, and real `get_home_stats` RPC with offline cache |
| 2026-10-25 | UI & Guidance Polish: Community Recycling Guidelines visual preparation steps with 720p animated WebP for 7 classes; SnapBot AI chat assistant via OpenAI `gpt-4o-mini` with token-conserving response caching |
| 2026-10-29 | Pre-Phase 11 Codebase Hygiene: Removed legacy stub components (`PlaceholderScreen.tsx`, `AppIcon.tsx`), unused UI primitives, and default template png assets; resolved ESLint react-hooks pure function errors in `scan.tsx`; updated test configurations and aligned all documentation with codebase |
