# ENVIRONMENT

Machine and toolchain facts for SnapPick. Values were recorded from commands run on the development machine. Do not write secrets in this file.

Last checked: 2026-11-06

## Machine

| Item | Value |
|---|---|
| OS | Windows 11 (build 10.0.26300) |
| Shell | PowerShell; Git Bash is also available |
| Repository path | `C:\Projects\snappick` (keep it short: Android native builds fail on long Windows paths) |

## Toolchain

| Tool | Version |
|---|---|
| Node.js | 24.20.0 |
| npm | 11.19.0 |
| Git | 2.56.0 |
| JDK | OpenJDK Temurin 21.0.12.1 |
| Android Debug Bridge (`adb`) | 1.0.41 |
| Android SDK | Platform API 37, Build-Tools 37.0.0, NDK 30.0.16248370, CMake 4.1.2 (`ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`) |
| Supabase CLI | 2.119.0 |

Python and conda are no longer needed: retraining runs on Kaggle.

## Test phone

Redmi Note 10, Android 12 (MIUI), USB debugging on. On Xiaomi phones also enable "Install via USB", and for notification tests set the app's battery mode to "No restrictions" and enable Autostart. The phone has a "Dual apps" copy of SnapPick; when launching from `adb`, choose the first (non-dual) one.

## Project identifiers (do not change)

| Item | Value |
|---|---|
| Android package name | `com.snappick.mobile` |
| Supabase region | `ap-southeast-1` (Singapore) |
| Supabase project | the linked remote project (`supabase link`) |

## Key library versions

Mobile app (`apps/mobile`):

| Package | Version |
|---|---|
| expo / expo-router | ~57.0.27 / ~57.0.25 |
| react-native / react | 0.86.3 / 19.2.3 |
| nativewind / tailwindcss | ^4.2.7 / ^3.4.19 |
| react-native-fast-tflite / react-native-nitro-modules | 3.0.1 / 0.37.1 |
| @maplibre/maplibre-react-native | 11.5.0 |
| @supabase/supabase-js | 2.117.2 |
| expo-camera / expo-image-picker / expo-image-manipulator | 57.0.6 / 57.0.4 / 57.0.21 |
| expo-location / expo-network / expo-notifications | ~57.0.21 / ~57.0.2 / ~57.0.23 |
| @react-native-google-signin/google-signin | 16.1.5 |
| lucide-react-native / react-native-svg | ^1.56.0 / 15.15.4 |

Admin dashboard (`apps/admin`): Next.js 15.1.3, React 19, Tailwind 3, `@supabase/supabase-js` 2.117.2, `@supabase/ssr`.

Use `npx expo install` for Expo packages so versions stay compatible with SDK 57. Run `npm ls` in an app to see the exact installed versions.
