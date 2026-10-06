# AGENTS.md: rules for the AI assistant working on SnapPick

Read this file first in every session. Design lives in `docs/SNAPPICK_PLAN.md`. Phase instructions live in `docs/SNAPPICK_BUILD_GUIDE.md`. Machine facts live in `docs/ENVIRONMENT.md`. Spike results live in `docs/SPIKE_RESULTS.md`.

## Working rules

1. **One phase at a time.** Implement only the phase named in the prompt. Do not start later phases or refactor earlier ones unless a fix requires it, and say so if it does.
2. **Diagnose before changing code** when something fails. Ask for the exact error and the checklist item number first.
3. **Pinned versions.** Record installed versions in `docs/ENVIRONMENT.md`. Use `npx expo install` for Expo packages. Never guess a library API: read the current official docs (or the installed package's types) first. If you cannot verify an API, say so and ask.
4. **Migrations only.** The database schema changes only through files in `supabase/migrations/`. Never edit the schema in the dashboard and never rewrite an applied migration; add a new one.
5. **No secrets in code.** Public values only in `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*`. The service-role key, OpenAI key, and Kaggle credentials never enter the mobile app, the dashboard, or git. Keep `.env.example` files up to date and `.env` files ignored.
6. **Privacy by design.** Exact coordinates exist only in `pickup_request_private_details`. Never put user IDs, images, notes, addresses, or exact coordinates in LLM prompts, cache keys, logs, or dataset manifests.
7. **Every phase ends with** `docs/phases/PHASE-N-CHECKLIST.md` (format in guide section 3), the list of automated tests and how to run them, and a list of every assumption made.
8. **Be honest about limits.** Mark anything unverified, simulated, or simplified. Never claim a test passed that was not run.

## Repository layout

Single Git repository, **independent package roots** (no root JavaScript workspaces): `apps/mobile` (Expo), `apps/dashboard` (Next.js, Phase 13), `ml` (Python), `supabase` (migrations, functions, seed, tests), `scripts`, `docs`. Each JavaScript app has its own `package.json` and lockfile. Layout details: guide section 5.1.

## Project facts that must not drift

- **Android only.** No iOS code, CoreML, or APNs.
- **Detector:** YOLO (Ultralytics) exported to TFLite, run on device with `react-native-fast-tflite`. Eight trained classes; five manual-only labels. Class names are **plain text, never database enums**.
- **Everything about the model comes from `model_manifest.json`** (labels, input size and layout, output format, NMS, thresholds) and is checked against the loaded model's tensor shapes. Never hard-code them.
- **Public data first.** The local dataset is swapped in later by retraining. The local golden test set is never trained on.
- **Statuses, RPCs, Edge Functions, tables, buckets, env var names:** guide section 5. Keep them identical across phases.

## Known gotchas (from the spike)

- Keep model files outside `src/app` (Expo Router treats that folder as routes).
- Metro needs `tflite` in `resolver.assetExts`. After Metro config changes run `npx expo start -c`.
- fast-tflite: load with a delegates list (`[]` for CPU); pass and receive `ArrayBuffer`s. Exported models differ in input layout (channels-first vs channels-last) and output format; read them from the tensor shapes.
- MapLibre: coordinates are `[longitude, latitude]`; new architecture only; development build, not Expo Go. `Marker` has no clustering.
- A native library change needs a native rebuild (`npx expo run:android`), not a reload.
- Keep the repository path short on Windows (path-length limits in Android native builds).
- Preprocessing (not inference) was the slowest step in the spike (about 1.5 s vs 350 ms). Measure stages separately.

## Style

TypeScript strict. Small pure modules with unit tests for anything with logic (letterbox, decode, NMS, rules, gate). Clear error messages shown to users. Commit messages: `feat: phase N ...`, `fix: ...`, `docs: ...`.
