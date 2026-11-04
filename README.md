# SnapPick

SnapPick is an on-device AI recycling assistant and community pickup platform for Perak, Malaysia. Residents photograph household waste, receive instant Community Recycling Guidelines sorting and preparation guidance, request pickup for accepted recyclable materials within supported service boundaries, consult SnapBot AI for recycling questions, and track privacy-safe impact statistics.

## Project Status

- ✅ **Mobile App (apps/mobile):** Complete (95%+ feature and UI/UX polish). 5 tabs (`Home`, `Activity`, `Scan`, `Collect`, `Profile`), on-device TFLite inference, MapLibre geofenced pickup scheduling, real-time collector marketplace, driving navigation, streamlined proof submission, dispute handling, mutual user ratings, and OTA model update manager.
- ✅ **Database & Backend (supabase):** 28 migrations applied. Complete PostGIS boundary geofencing, RLS policies, atomic RPCs (`submit_collection`, `rate_user`, `delete_my_account`, etc.), Realtime broadcast channels, and pg_cron maintenance jobs.
- 🔄 **Admin Panel (apps/admin):** Next focus. Next.js 15 application scaffolded with Supabase auth context, admin role verification, and initial management pages (detector versions, feedback queue, disputes).
- ⏸️ **Public Dashboard (apps/dashboard):** Community-facing Next.js dashboard backed by public database views (`dashboard_*`).
- ⏸️ **ML Automation Pipeline (ml):** Baseline YOLOv8n TFLite model bundled; automated retraining triggers and golden evaluation gate defined.

## Key Features

- **On-Device Waste Detection:** Real-time YOLOv8n TFLite model running locally on CPU (~1-2s inference) with 7 material classes: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`.
- **Intelligent Guidance:** Contextual preparation tips, animated recycling guides, and SnapBot AI assistant (OpenAI GPT-4o-mini proxy with cached responses).
- **Geofenced Pickups:** Reverse geocoded to 13 Perak DOSM districts; privacy masking to 0.01° grid cells (~1km) for public views.
- **Collector Marketplace:** Real-time MapLibre marketplace with broadcast push updates, driving route preview with native navigation (Google Maps / Waze) handoff.
- **Streamlined Proof & Verification:** 1-tap photo proof capture (EXIF-stripped client-side), non-collection issue reporting, 48-hour requester confirmation window with dispute support.
- **Mutual Reputation:** Requesters rate collectors and collectors rate requesters (1–5 stars with attribute tags).
- **Privacy by Design:** Strict separation between public metadata and private details (`pickup_request_private_details`), opt-in consent for image storage and training data.
- **OTA Model Lifecycle:** Staged rollouts with hash-based bucket assignment; mobile update checker and local activation in Profile screen.

## Repository Layout

```text
snappick/
  AGENTS.md                  # Development rules & project invariants
  BRAND_IDENTITY.md          # Design system, color tokens, typography & microcopy
  PRODUCT.md                 # Product specifications & principles
  README.md                  # Project overview & quick start
  docs/
    ARCHITECTURE.md          # System architecture, schemas, and flows
    DEVELOPMENT_GUIDE.md     # Setup, testing, and troubleshooting guide
    ENVIRONMENT.md           # Machine setup & toolchain versions
    DATASET_COLLECTION_GUIDE.md
    MODEL_IMPROVEMENT_GUIDE.md
    SPIKE_RESULTS.md         # Historical Phase 0 spike results
  apps/
    mobile/                  # React Native / Expo SDK 57 mobile app ✅
    admin/                   # Next.js 15 Admin Panel (Current focus) 🔄
    dashboard/               # Next.js 15 Public Community Dashboard ⏸️
  ml/                        # Python ML scripts & model validation
  scripts/                   # DB seed/clean scripts & district importers
  supabase/                  # Database migrations, Edge Functions, tests
```

## Quick Start: Mobile App

Requirements: Node.js 24+, OpenJDK 21, Android SDK (API 35–37), connected Android device with USB debugging enabled.

1. **Environment configuration:**
   Copy `apps/mobile/.env.example` to `apps/mobile/.env` and supply your Supabase URL and anon key:
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```

2. **Install dependencies:**
   ```bash
   cd apps/mobile
   npm install
   ```

3. **Run checks and tests:**
   ```bash
   npm run typecheck
   npm test
   ```

4. **Start development build:**
   ```bash
   npx expo run:android
   ```

## Database Utilities

From `apps/mobile` or root:
- Clean transactional database: `npm --prefix apps/mobile run db:clean`
- Seed comprehensive test data: `npm --prefix apps/mobile run db:seed`
- Full database reset: `npm --prefix apps/mobile run db:reset`

## Running Automated Tests

- **Mobile unit tests (75 tests across 13 test files):**
  ```bash
  cd apps/mobile
  npm test
  ```

- **ML contracts & scripts tests:**
  ```bash
  & C:\Users\adyha\miniconda3\envs\snappick\python.exe -m unittest discover -s ml/tests
  & C:\Users\adyha\miniconda3\envs\snappick\python.exe -m unittest discover -s scripts
  ```

- **Supabase backend integration tests:**
  ```bash
  cd supabase/tests
  npm install
  npm run test:rls
  npm run test:pickup
  npm run test:marketplace
  npm run test:expiry
  npm run test:completion
  npm run test:feedback
  ```
