# ENVIRONMENT.md

Machine and toolchain facts for SnapPick. The AI assistant reads this file in every session (see `AGENTS.md`). **Only the values marked Recorded come from commands run on this machine.** Anything marked To verify has not been checked yet; do not treat it as confirmed.

Last updated: 2026-10-06 (Prerequisite Part F, second pass)

---

## 1. Machine

| Item | Value | Status |
|---|---|---|
| OS | Windows, build 10.0.26300 (as reported by `adb`) | Recorded |
| Shell | PowerShell with conda `(base)` auto-activated | Recorded |
| Repository path | `C:\Projects\snappick` (short path, required on Windows) | Recorded |
| RAM and free disk | | To verify (guide asks for 16 GB RAM, 40 GB free) |
| Long paths enabled (registry and `git config --system core.longpaths true`) | | To verify |

---

## 2. Core toolchain

| Tool | Version | Status | Notes |
|---|---|---|---|
| Node.js | v24.20.0 | Recorded, accepted | The Phase 0 spike ran on it without problems (reported). Comparing with the Expo SDK 57 minimum is now optional. |
| npm | 11.19.0 | Recorded | Package manager for all JavaScript apps. |
| Git | 2.56.0.windows.1 | Recorded | |
| JDK | OpenJDK Temurin 21.0.12.1 (LTS) | Recorded, accepted | Differs from the JDK 17 the prerequisite suggested, but the Phase 0 spike built and ran with it (reported). See section 7. |
| adb | 1.0.41, version 37.0.1-15733141 | Recorded | Platform-tools in `%LOCALAPPDATA%\Android\Sdk\platform-tools` |
| conda | 26.7.1 | Recorded | |
| Python (env `snappick`) | 3.11.17 | Recorded | ML pipeline environment |
| Python (env `snappick-label`) | exists | Recorded | Separate env for Label Studio only. |
| Android Studio version | | To verify | Record from Help → About. |
| Code editor and AI assistant | | To fill in | |

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
| SDK package and licence management | New Android CLI (`android sdk install/update/remove`), which saves licences in a format Gradle accepts (per Google's Android CLI release notes) | Recorded. No separate `sdkmanager --licenses` step needed. If a build reports unaccepted licences, accept them in Android Studio or with the CLI. |
| Other SDK Platforms installed (for example the one Expo SDK 57 compiles against) | | To verify |

**Expo SDK 57 requirements** (from https://docs.expo.dev/versions/latest/, confirm the page is for SDK 57):

| Requirement | Value from the Expo table (optional now: the spike already built on this setup) |
|---|---|
| Minimum Node.js | To fill in |
| `compileSdkVersion` | To fill in |
| `targetSdkVersion` | To fill in |
| React Native / React | 0.86 / 19.2 (from the SDK 57 announcement) |

If `compileSdkVersion` differs from the installed platform (API 37), Gradle may download the matching platform or NDK on the first build. That is normal when licences are accepted. If a build fails complaining about a missing SDK component, install it in SDK Manager and add it to the table above.

---

## 4. Test device

| Item | Value | Status |
|---|---|---|
| Phone | Redmi Note 10 | Recorded |
| Android version | 12 (Xiaomi MIUI, a vendor skin) | Recorded |
| Role | Reference phone for latency measurements | Assumed to be the spike phone |
| USB debugging | Working: `adb devices` lists the phone as `device` | Recorded |
| Second test device or emulator (Phase 8 marketplace) | | To fill in |

**Xiaomi-specific notes** (known behaviour of this vendor skin, to check when relevant):
- Enable **USB debugging** and, on many Xiaomi phones, the separate **Install via USB** toggle in Developer options; otherwise `adb` or Expo installs can be blocked.
- Aggressive battery management can delay or drop push notifications. When testing Phase 9, set the app to **No restrictions** for battery and enable **Autostart**.

---

## 5. Project identifiers (do not change later)

| Item | Value |
|---|---|
| Android package name | `com.snappick.mobile` |
| Used by | Expo `app.json`, Google sign-in (Phase 3), Firebase (Phase 9) |
| Supabase project ref | To fill in (Part G) |
| Supabase region | To fill in |
| GitHub repository | To fill in (private) |

The Supabase URL and anon key go in `apps/mobile/.env` (git-ignored). **Never write secret keys in this file.**

---

## 6. Project library versions (fill in as phases are built)

Record the exact installed versions here after each install (`npm ls <package>`). The AI pins what is recorded.

| Package | Version | Recorded in phase |
|---|---|---|
| expo | 57.0.27 | Phase 1 (installed with SDK 57 template; at least 57.0.9) |
| expo-router | 57.0.25 | Phase 1 |
| expo-dev-client | 57.0.19 | Phase 1 |
| @react-native-async-storage/async-storage | 2.2.0 | Phase 1 |
| react-native | 0.86.3 | Phase 1 |
| react | 19.2.3 | Phase 1 |
| @supabase/supabase-js | 2.117.2 | Phase 1 |
| @react-native-google-signin/google-signin | 16.1.5 | Phase 3 |
| Supabase CLI | 2.119.0 | Phase 2 |
| react-native-fast-tflite | | Phase 5 (see `docs/SPIKE_RESULTS.md` for the version that worked) |
| react-native-nitro-modules | | Phase 5 |
| @maplibre/maplibre-react-native | | Phase 7 |
| ultralytics (Python) | | Phase 4 (use the version from the spike export) |
| next | | Phase 13 |

---

## 7. Deviations and risks to watch

1. **JDK 21 instead of 17.** React Native and Expo Android builds are normally set up around JDK 17. The spike worked with this JDK (reported), so it is accepted. If a future build fails with a Java or Gradle compatibility error, install JDK 17 (`winget install Microsoft.OpenJDK.17`), point `JAVA_HOME` at it, and record the change here.
2. **Very recent Android SDK and NDK** (API 37, NDK 30). Expo and React Native pin the versions they need, and Gradle can download them. A first build that downloads extra components is expected. If native compilation of `react-native-fast-tflite` fails around CMake or NDK, try the NDK version Gradle reports it wants.
3. **Node v24.** Newer than the Node 22 that several Expo-ecosystem tools mention, but the spike ran on it, so it is accepted.
4. **Windows build 26300** may be a pre-release build. If you hit odd tooling failures not seen on a standard Windows release, mention it when asking for help.
5. **Android package name** `com.snappick.mobile` is generic. That is fine for an FYP. It only needs to be consistent across Expo, Google Cloud, and Firebase.

---

## 8. Still to verify before Phase 1

- [x] Node, JDK: accepted because the spike ran
- [x] `conda env list` shows both `snappick` and `snappick-label`
- [x] `adb devices` lists the phone as `device`
- [x] SDK licences: handled by the new Android CLI
- [ ] Optional: fill in `compileSdkVersion` and `targetSdkVersion` from the Expo table
- [ ] Optional: long paths enabled (the repo path is already short)
- [ ] Optional: Android Studio version recorded
- [ ] Supabase project ref and region recorded (Part G)
- [ ] `docs/SPIKE_RESULTS.md` created with `npm ls` output and export details (Part N)
- [ ] Supervisor answers recorded: AGPL acceptable for the detector, and whether a self-collected dataset is a marking requirement

---

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | Initial record from Prerequisite Part F command output |
| 2026-10-06 | Confirmed `snappick-label` env and `adb devices`; accepted JDK 21 and Node 24 (spike ran); licences handled by the new Android CLI |
| 2026-10-06 | Phase 1 installed Expo 57.0.27, React Native 0.86.3, React 19.2.3, Expo Router 57.0.25, Expo Dev Client 57.0.19, AsyncStorage 2.2.0, and Supabase JS 2.117.2; native Android build/install passed on the connected phone |
| 2026-10-07 | Phase 2 added the database/security migrations, seed, RLS isolation test package, and phase checklist; the first migration was applied to the linked project and all public tables report RLS enabled |
| 2026-10-07 | Phase 3 installed `@react-native-google-signin/google-signin` 16.1.5 and the native Android build passed |
