# AGENTS.md: rules for the AI assistant working on SnapPick

Read this file first in every session. Architecture is in `docs/ARCHITECTURE.md`, the development workflow in `docs/DEVELOPMENT_GUIDE.md`, the model flow in `docs/MODEL_LIFECYCLE.md`, and machine facts in `docs/ENVIRONMENT.md`.

## Working rules

1. **Do what was asked.** Keep changes focused. Do not refactor unrelated code; if a fix requires touching something else, say so.
2. **Diagnose before changing code** when something fails. Read the exact error, find the cause, then fix it.
3. **Pinned versions.** Use `npx expo install` for Expo packages. Never guess a library API: read the installed package's types or the official docs first. If you cannot verify an API, say so.
4. **Migrations only.** The database schema changes only through files in `supabase/migrations/`. Never edit the schema in the dashboard and never rewrite an applied migration; add a new one.
5. **No secrets in code.** Only public values go in `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*`. The service-role key, OpenAI key and Kaggle credentials never enter the mobile app, the admin app or git. Keep `.env.example` files current and `.env` files ignored.
6. **Privacy by design.** Exact coordinates exist only in `pickup_request_private_details`. Never put user IDs, images, notes, addresses or exact coordinates in LLM prompts, cache keys or logs.
7. **Test against the remote project.** Development and testing use the linked remote Supabase project. Before running anything destructive on it (deleting data, dropping tables, `db:clean`), confirm with the user. Prefer a transaction that rolls back when you only need to check behaviour.
8. **Be honest about limits.** Mark anything unverified, simulated or simplified. Never claim a test passed that was not run. End a piece of work by listing the checks that were run and what was not tested.
9. **Keep docs current.** When behaviour changes, update the matching file in `docs/` in the same change.

## Repository layout

Single Git repository with **independent package roots** (no root JavaScript workspace): `apps/mobile` (Expo), `apps/admin` (Next.js admin dashboard), `apps/dashboard` (public dashboard, **not built yet**), `ml` (Kaggle retraining notebook), `supabase` (migrations, functions, seed, remote test script), `scripts`, `docs`. Each JavaScript app has its own `package.json` and lockfile.

## Project facts that must not drift

- **Android only.** No iOS code, CoreML or APNs.
- **Detector:** YOLO (Ultralytics) exported to TFLite, run on device with `react-native-fast-tflite`. The labels, in fixed order, are `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`. Do not remap them. Batteries, bulbs, e-waste and other hazards remain manual safety declarations. Class names are plain text, never database enums.
- **Everything about the model comes from `apps/mobile/assets/models/model_manifest.json`** (labels, input size and layout, output format, NMS, thresholds) and is checked against the loaded model's tensor shapes. Never hard-code them.
- **Model flow:** gather verified images, retrain on Kaggle from the admin Dataset page, and the admin decides on the Models page whether the new model goes live. The bundled `v0` model is never overwritten, and any model load or inference failure falls back to it. See `docs/MODEL_LIFECYCLE.md`.
- **Statuses, RPCs, edge functions, tables, buckets, environment variable names** are defined by the migrations and `docs/ARCHITECTURE.md`. Keep them identical across the app, admin and database.

## Known gotchas

- Keep model files outside `src/app` (Expo Router treats that folder as routes).
- Metro needs `tflite` in `resolver.assetExts`. After Metro config changes run `npx expo start -c`.
- fast-tflite: load with a delegates list (`[]` for CPU); pass and receive `ArrayBuffer`s. Exported models differ in input layout (channels-first vs channels-last) and output format; read them from the tensor shapes.
- MapLibre: coordinates are `[longitude, latitude]`; new architecture only; development build, not Expo Go. `Marker` has no clustering.
- A native library change needs a native rebuild (`npx expo run:android`), not a reload.
- Keep the repository path short on Windows (path-length limits in Android native builds).
- Measure every pipeline stage (centre crop, resize, JPEG decode, tensor creation, inference, decode, NMS) separately; do not copy timings from another model.

## Style

TypeScript strict. Small pure modules with unit tests for anything with logic (transforms, decode, NMS, rules, queues). Clear error messages shown to users. Commit messages: `feat: ...`, `fix: ...`, `docs: ...`.
