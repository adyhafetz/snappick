# SnapPick

SnapPick is an on-device AI recycling assistant and community pickup platform for Perak, Malaysia. Residents photograph household waste, receive instant Community Recycling Guidelines sorting and preparation guidance, request pickup for accepted recyclable materials within supported service boundaries, consult SnapBot AI for recycling questions, and track privacy-safe impact statistics.

## What's Built (Mobile App Production-Ready ✅)

The mobile app is fully functional with end-to-end features:

- ✅ **Authentication:** Email + Google OAuth sign-in
- ✅ **Waste Detection:** On-device YOLOv8n TFLite model (~1-2s inference)
- ✅ **Guidance:** Recycling preparation guides + SnapBot AI assistant (OpenAI GPT-4o-mini)
- ✅ **Pickup Requests:** Create requests with map pin, geofencing (13 Perak districts), privacy masking
- ✅ **Marketplace:** Browse/claim pickups, navigate, complete with proof photo
- ✅ **Activity Tracking:** My requests, claimed pickups, statistics
- ✅ **Privacy & Feedback:** Consent management, training opt-in, offline upload queue

**What's Not Built:**
- ⏸️ ML pipeline automation (manual workflow only)
- ⏸️ Model delivery system (manual bundle updates)
- ❌ Admin dashboard (empty folder)

**Up Next:** Build ML automation (GitHub Actions + Kaggle) & admin dashboard (Next.js).

## Repository Layout

```text
snappick/
  AGENTS.md                  # Development rules & project invariants
  README.md                  # This file (project overview)
  docs/
    ARCHITECTURE.md          # System architecture & database schema
    DEVELOPMENT_GUIDE.md     # Setup, testing, troubleshooting
    DATASET_COLLECTION_GUIDE.md
    MODEL_IMPROVEMENT_GUIDE.md
    ENVIRONMENT.md           # Machine setup & installed versions
  apps/
    mobile/                  # React Native / Expo SDK 57 app ✅
    dashboard/               # Admin dashboard (not built yet)
  ml/                        # Python ML scripts & model validation
  scripts/                   # Boundary import & concurrency tests
  supabase/                  # Database, Edge Functions, integration tests
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
