# SnapPick

SnapPick is an on-device AI recycling assistant and community pickup platform for Perak, Malaysia. Residents photograph household waste, receive instant Community Recycling Guidelines sorting and preparation guidance, request pickup for accepted recyclable materials within supported service boundaries, consult SnapBot AI for recycling questions, and track privacy-safe impact statistics.

## Current Project Status: Phases 1–10 Complete

The codebase implements Phases 1 through 10:
- **Phase 1:** Repository foundation, Expo SDK 57 app with 5 core tabs, Supabase email authentication.
- **Phase 2:** PostgreSQL schema, PostGIS geometry, Row-Level Security (RLS) isolation, audit logs.
- **Phase 3:** Google Sign-in OAuth, consent management (image storage & pickup safety), profile settings.
- **Phase 4:** ML baseline M0 formalized, model manifest contract, FlatBuffer inspection, golden test fixtures.
- **Phase 5:** On-device waste detection with `react-native-fast-tflite` (CPU delegate), centre-crop preprocessing, NMS postprocessing, and interactive review sheet.
- **Phase 6:** Guidance engine with Community Recycling Guidelines, 720p animated WebP preparation visuals, and token-cached SnapBot AI assistant (`gpt-4o-mini`).
- **Phase 7:** Community pickup requests with MapLibre interactive pin placement, 13 DOSM Perak administrative district boundary geofencing, and strict privacy masking (`ST_SnapToGrid`).
- **Phase 8:** Collector marketplace with 0.01° grid aggregation, atomic claims (`claim_pickup_request` with concurrency lock & 3-job cap), automated pg_cron claim expiry, and native turn-by-turn navigation launcher.
- **Phase 9:** Collection completion checklist (`submit_collected_items`), client-side 800px downsampling with EXIF/metadata stripping, short-lived signed proof URLs (`get-pickup-proof`), 48-hour auto-completion cron, dispute/relist flows, OSRM route preview polyline, and privacy-safe FCM push notifications with Web Crypto RS256 signing.
- **Phase 10:** Continuous-learning feedback capture (active learning selection on confidence 0.40–0.79, user corrections, 5% random sampling), opt-in upload gating, count-match verification, label tiers (A/B/C/D), persistent offline upload queue, and real `get_home_stats` RPC with offline cache.

**Up Next:** Phase 11 — Gated retraining ML pipeline automation on GitHub Actions & Kaggle GPU runner.

## Repository Layout

```text
snappick/
  AGENTS.md                  # Development rules and invariant project facts
  README.md                  # Project overview and quickstart
  docs/                      # Architecture plans, build guides, and phase checklists
  apps/
    mobile/                  # React Native / Expo SDK 57 mobile application
    dashboard/               # Web dashboard (Phase 13)
  ml/                        # Python ML contracts, model manifests, audit tools, pipeline
  scripts/                   # Geospatial boundary import and concurrency test scripts
  supabase/                  # Database migrations, seed data, Edge Functions, test suites
```

## Quick Start: Mobile App

Requirements: Node.js 24+, OpenJDK 21, Android SDK (API 35–37), connected Android device with USB debugging enabled.

1. **Environment configuration:**
   Copy `apps/mobile/.env.example` to `apps/mobile/.env` and supply your Supabase URL and anon key:
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```

2. **Install and run:**
   ```bash
   cd apps/mobile
   npm install
   npm run typecheck
   npm test
   npx expo start
   ```

3. **Android native development build:**
   ```bash
   npx expo run:android
   ```

## Running Automated Tests

- **Mobile unit tests (63 tests):**
  ```bash
  cd apps/mobile
  npm test
  ```

- **ML contracts & scripts tests (10 tests):**
  ```bash
  & C:\Users\adyha\miniconda3\envs\snappick\python.exe -m unittest discover -s ml/tests
  & C:\Users\adyha\miniconda3\envs\snappick\python.exe -m unittest discover -s scripts
  ```

- **Supabase backend integration tests:**
  ```bash
  cd supabase/tests
  npm install
  # Run RLS, pickup, marketplace, expiry, completion, or feedback suites:
  npm run test:rls
  npm run test:pickup
  npm run test:marketplace
  npm run test:expiry
  npm run test:completion
  npm run test:feedback
  ```
