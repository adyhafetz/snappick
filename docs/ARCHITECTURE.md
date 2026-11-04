# SnapPick Architecture

**Last Updated:** 2026-10-30  
**Status:** Phases 1–10 Complete | ML Pipeline DB Ready | Dashboard & Admin Not Built

---

## Overview

SnapPick is a community-driven recycling platform for Perak, Malaysia combining:
- **On-device ML waste detection** (YOLOv8n TFLite, 7 material classes)
- **Community pickup marketplace** (residents request, collectors claim & complete)
- **Continuous learning pipeline** (user feedback → model retraining → improvement)

**Core Innovation:** The ML detector improves over time from consented, verified user images through a gated retraining pipeline.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Mobile App (React Native)                    │
│  Tabs: Home | Activity | Scan | Request | Profile                    │
│  • Camera + On-Device TFLite Inference (CPU, ~1-2s)                 │
│  • MapLibre (pickup locations, no API key)                           │
│  • SnapBot AI Assistant (OpenAI GPT-4o-mini)                         │
│  • Offline queue for scan uploads                                    │
└─────────────────────────────────────────────────────────────────────┘
                               ↓ (Supabase Client SDK)
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase Backend (PostgreSQL + PostGIS)           │
│  Auth: Email + Google OAuth                                          │
│  Database: 21 tables with RLS, PostGIS geofencing                   │
│  Storage: Scan images + proof photos (signed URLs)                   │
│  Edge Functions: SnapBot, Private Details, Proof URLs, FCM          │
│  pg_cron: Auto-expire claims, auto-complete pickups, daily drift     │
└─────────────────────────────────────────────────────────────────────┘
          ↓ (public anon)                    ↓ (admin JWT)
┌──────────────────────┐         ┌───────────────────────────────────┐
│   Public Dashboard   │         │         Admin Panel                │
│   apps/dashboard     │         │         apps/admin                 │
│   Next.js 15         │         │         Next.js 15                 │
│   No login required  │         │         Requires is_admin()        │
│   Community stats    │         │         Model management           │
│   Pickup trends      │         │         Feedback review            │
│   Material breakdown │         │         Dispute resolution         │
│   District map       │         │         Drift monitoring           │
└──────────────────────┘         └───────────────────────────────────┘
                               ↓ (Manual / GitHub Actions)
┌─────────────────────────────────────────────────────────────────────┐
│                    ML Pipeline (Python + Kaggle)                     │
│  1. Export feedback samples from database                            │
│  2. Label with Label Studio (admin manual review)                    │
│  3. Train YOLOv8n on Kaggle GPU (Ultralytics)                       │
│  4. Export to TFLite, validate contract                              │
│  5. Admin approves version in admin panel → staged rollout           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Mobile App (Expo SDK 57 / React Native 0.86)

### Tech Stack
- **Framework:** Expo 57, React Native 0.86.3, React 19.2.3
- **Navigation:** Expo Router (file-based routing)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Storage:** AsyncStorage (offline caching)
- **Camera:** expo-camera
- **Map:** @maplibre/maplibre-react-native (OpenFreeMap tiles, no API key)
- **ML:** react-native-fast-tflite (TensorFlow Lite with CPU delegate)
- **Auth:** Supabase Auth (@supabase/supabase-js)

### App Structure
```
apps/mobile/src/
  app/(tabs)/              # 5 tabs (Home, Activity, Scan, Request, Profile)
  app/(auth)/              # Sign in / sign up
  app/(consent)/           # Image storage + safety consent screens
  app/pickup/[id].tsx      # Pickup detail
  components/
    guidance/              # SnapBot AI modal, recycling preparation guides
    pickup/                # Pickup request form, marketplace, proof modal
    ui/                    # Button, Card, Input, Badge, Switch, Text, etc.
  lib/
    detector/              # ML model loading, preprocessing, inference, NMS
    guidance/              # SnapBot API client, LLM prompt templates
    home/                  # Home stats RPC calls
    pickup/                # Marketplace, draft storage, validation
    consent.ts             # User consent flow management
    supabase.ts            # Supabase client setup
  providers/
    AuthProvider.tsx       # Global auth state management
  assets/
    models/                # Bundled TFLite model + manifest
      waste_detector_v0.tflite
      model_manifest.json
```

### 5 Core Tabs

| Tab | Purpose | Key Features |
|-----|---------|-------------|
| **Home** | Dashboard & stats | Total scans, verified items, active pickups, recent activity, SnapBot AI button |
| **Activity** | Track requests & claims | "My Requests" (pending/completed) + "Claimed Pickups" (in-progress/completed) |
| **Scan** | Capture + classify waste | Camera → ML detection → Review sheet → Recycling guide → Schedule pickup |
| **Request** | Pickup marketplace map | Browse nearby pickup requests, claim, navigate, complete with proof photo |
| **Profile** | Account settings | Edit name/phone, toggle privacy (image storage, training opt-in), sign out |

### Key Flows

#### 1. Scan Flow
```
Camera Capture → Preprocess (centre crop 384×384)
  → TFLite Inference (~1-2s on CPU)
  → Decode + NMS → Draw bounding boxes
  → User review (confirm/remove/change class/set condition)
  → Recycling preparation guide (collapsible per item)
  → Safety checklist (no batteries/bulbs/e-waste)
  → Schedule pickup OR discard
```

#### 2. Pickup Request Flow
```
Eligible items from scan → Pickup form
  → Map: drag pin to select location
  → PostGIS geofence check (must be in Perak district)
  → Privacy: grid snap to 0.01° (~1km)
  → Enter address: unit/street/landmark/access instructions
  → Pick day (1-3 days ahead) + time window (morning/afternoon)
  → Submit → Creates pending request on marketplace
```

#### 3. Claim & Complete Flow
```
Marketplace map → Tap cluster/marker → View request details
  → Claim (atomic lock, max 3 active claims per user)
  → Navigate (opens Google Maps/Waze with coordinates)
  → Collect items → Take proof photo (800px, EXIF stripped)
  → Upload proof → Requester confirms/disputes
  → Auto-complete after 48h if no dispute
```

---

## Database Schema (PostgreSQL + PostGIS)

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts with consent and privacy flags |
| `scans` | Scan sessions with model version, timings, retention date |
| `detections` | One row per detected box with class, score, condition, eligibility |
| `label_feedback` | User corrections and collector verification |
| `feedback_samples` | Active-learning upload queue with label tiers A/B/C/D |
| `pickup_requests_public` | Pickup metadata with grid-snapped location |
| `pickup_request_private_details` | Exact address (requester + collector only) |
| `pickup_waste_items` | Items per request with quantities and conditions |
| `pickup_proofs` | Proof photos with confirmation/dispute state |
| `disputes` | Pickup disputes for admin resolution |
| `instruction_cache` | SnapBot LLM response cache (SHA-256 keyed) |
| `llm_usage` | Token and cost tracking |
| `push_tokens` | FCM device tokens |
| `perak_districts` | 13 DOSM district PostGIS boundaries |
| `pbt_rule_sets` | Recycling guidelines by district |
| `audit_log` | Admin actions with timestamps |
| `reports` | User reports and blocks |
| `model_versions` | Detector version registry with rollout percentage |
| `training_runs` | ML pipeline run history with metrics and gate results |
| `dataset_versions` | Training dataset manifests |
| `drift_daily` | Daily per-version model performance metrics |

### Key Database Functions (RPCs)

| Function | Purpose |
|----------|---------| 
| `resolve_pickup_area(lat, lng)` | PostGIS district containment check |
| `create_pickup_request(...)` | Atomic request + privacy + items with grid snap |
| `claim_pickup_request(id)` | Atomic claim with 3-job cap |
| `submit_collected_items(...)` | Proof upload + status transition |
| `confirm_pickup(id)` | Requester confirms completion |
| `raise_dispute(id, reason)` | Requester opens dispute |
| `cancel_pickup_request(id)` | Cancel pending request |
| `relist_pickup(id)` | Relist not_collected request |
| `get_home_stats()` | User's personal stats |
| `set_scan_image_path(scan_id, path)` | Links uploaded scan image to scan record |
| `get_ml_retraining_trigger_stats()` | Checks retraining conditions |
| `compute_drift_daily(date)` | Aggregates daily model metrics |
| `admin_approve_model_version(version, rollout_percent)` | Admin approves a detector version |
| `admin_rollback_model_version(version, reason)` | Admin rolls back a detector version |
| `get_eligible_model_for_user(user_id)` | Staged rollout: returns which version a user should download |
| `compute_user_rollout_bucket(user_id)` | Deterministic 0–99 hash bucket for staged rollout |

### Views

| View | Purpose |
|------|---------|
| `pending_pickup_marketplace` | Public pickups with grid clustering, no private details |
| `my_pickup_requests` | User's own requests |
| `my_claimed_pickups` | User's claimed pickups |
| `dashboard_overview_kpis` | Public dashboard aggregate KPIs |
| `dashboard_material_breakdown` | Material family counts and estimated weight |
| `dashboard_pickup_trends` | Daily request/completion counts (90 days) |
| `dashboard_district_aggregates` | Per-district totals with small-count suppression (<5 masked) |
| `dashboard_model_transparency` | Public model version info (version number, size, status) |

### Automated Jobs (pg_cron)

| Job | Schedule | Action |
|-----|----------|--------|
| `release_expired_claims` | Every 30 min | Release `accepted` claims older than 24h back to `pending` |
| `auto_complete_confirmed` | Every 30 min | Auto-complete `awaiting_confirmation` after 48h |
| `compute-daily-drift-job` | Daily 00:15 | Compute yesterday's drift_daily metrics |

---

## ML Pipeline (Python)

### Current Model: Version v0
- **Framework:** Ultralytics YOLOv8n
- **Input:** 384×384×3, centre-crop, float32, normalized [0-1], NCHW layout
- **Output:** Raw YOLO format `[1, 11, 3024]` (cx, cy, w, h, 7 class scores)
- **NMS:** IoU 0.5, max 30 boxes
- **Classes:** `["metal", "trash", "glass", "paper", "cardboard", "plastic", "biological"]`
- **Thresholds:** Confident ≥ 0.8, Uncertain 0.40–0.79
- **Dataset:** Temporary Kaggle baseline (sumn2u/garbage-classification-v2-bbox-384)
- **Size:** 12.7 MB

> [!NOTE]
> Version v0 is the immutable bundled fallback. Its metrics (mAP) are not yet measured on a local golden set — this happens when local data collection begins.

### Version Lifecycle

```
v0 (bundled, active)
  ↓ local dataset collected + training run
v1 (candidate) → gate check on frozen golden set
  ↓ admin approves in Admin Panel
v1 (rolling out: 10%) → v1 (rolling out: 100%) → v1 (active)
  ↓ future training
v2 (candidate) ...
```

Each new version:
1. Is registered in `model_versions` with its SHA-256 and metrics
2. Requires admin approval in the Admin Panel before any rollout
3. Is delivered to eligible users via `get_eligible_model_for_user()` (deterministic hash bucket)
4. Falls back to v0 on any download or verification failure

### ML Scripts (`ml/src/`)

| Script | Purpose |
|--------|---------|
| `inspect_tflite.py` | Inspect model tensor shapes and dtypes |
| `contract.py` | Validate manifest against TFLite binary |
| `dataset_audit.py` | Verify training dataset integrity |
| `parity.py` | Compare Python vs mobile inference outputs |
| `smoke_test.py` | End-to-end model load + inference test |

### Feedback Loop

```
1. User scans → detections saved to DB with consent flags
2. Active learning gating selects samples:
   - Confidence 0.40–0.79 (uncertain) → 100% upload
   - User corrections (remove/change class) → 100% upload
   - Random 5% of clean detections → baseline sampling
3. Samples queued in feedback_samples (Tier A/B/C/D)
4. Admin exports → Label Studio → manual annotation (Tier A gold labels)
5. Retrain YOLOv8n → Export TFLite → Validate contract
6. Admin approves new version in Admin Panel → staged rollout
```

---

## Edge Functions (Deno on Supabase)

| Function | Purpose | Auth |
|----------|---------|------|
| `snapbot-chat` | OpenAI GPT-4o-mini proxy with caching and rate limiting | User JWT |
| `get-pickup-private-details` | Return exact address for claimed pickup | User JWT + collector check |
| `get-pickup-proof` | Short-lived (5 min) signed URL for proof photo | User JWT + participant check |
| `notify` | FCM push notifications with RS256 signing | Internal |

---

## Web Apps (Next.js 15)

### Public Dashboard (`apps/dashboard`) — Community Facing

- **No login required** — reads from `dashboard_*` views (anon SELECT grant)
- **Port:** 3000
- **Shows:** Pickup KPIs, material breakdown chart, pickup trends, district map, model transparency tab
- **Privacy:** Small-count suppression (<5 per district masked), no PII, no exact addresses
- **Hosting:** Vercel

### Admin Panel (`apps/admin`) — Admin Only

- **Requires** Supabase session with `is_admin()` privilege
- **Port:** 3001 (dev)
- **Sections:**
  | Section | What it does |
  |---------|-------------|
  | Detector Versions | View all versions by number (v0, v1…), see rollout%, approve/reject/roll back |
  | Training Runs | Monitor pipeline runs, check trigger stats, view gate results |
  | Feedback Queue | Review label corrections, manage Tier A annotation queue |
  | Disputes | Resolve requester–collector disputes (uphold / reject / inconclusive) |
  | Drift Monitor | Daily correction rate, uncertain share, inference latency charts per version |
  | Audit Log | All admin actions with timestamps |

> [!IMPORTANT]
> The Admin Panel uses plain version numbers (v0, v1, v2…) in its UI. Internal DB role names (`bundled_fallback`, `champion`, `candidate`) are only used in queries, never in user-facing labels.

---

## Third-Party Services

| Service | Purpose | Key Location |
|---------|---------|-------------|
| **Supabase** | Auth, database, storage, edge functions | `apps/mobile/.env`, `apps/dashboard/.env.local`, `apps/admin/.env.local` |
| **OpenAI** | SnapBot AI (gpt-4o-mini) | Supabase Edge Function env only |
| **Firebase Cloud Messaging** | Push notifications (Android) | Supabase Edge Function env only |
| **Google OAuth** | Sign-in with Google | Firebase Console + Google Cloud Console |
| **MapLibre** | Map rendering | No API key (OpenFreeMap tiles) |
| **Kaggle** | GPU training for ML models | Manual upload/download |

---

## Privacy & Security

### Privacy-by-Design Features
- **Grid Snapping:** Exact coordinates masked to 0.01° (~1km) in public marketplace
- **Private Details Table:** Exact location + address only accessible to requester & collector via authorized Edge Function
- **No User IDs in LLM Prompts:** SnapBot receives only waste class names
- **Signed URLs:** Proof photos accessible via short-lived (5 min) signed URLs
- **Consent Gating:** Images uploaded only with `image_storage_consent` + `training_opt_in`
- **EXIF Stripping:** All uploaded images downsampled to 800px, EXIF/GPS stripped client-side
- **Dashboard Suppression:** District counts < 5 masked in public views

### Row-Level Security
Every table has RLS enabled. Key policies:
- `profiles` — users read/write own profile only
- `scans`, `detections` — users read/write own data only
- `pickup_requests_public` — all can read marketplace, users write own requests
- `pickup_request_private_details` — requester + collector only
- Admin tables (`model_versions`, `training_runs`, etc.) — `is_admin()` required for write

---

## Testing

### Mobile App Tests (63 tests)
```bash
cd apps/mobile
npm test
```
- Detector preprocessing, NMS, rules engine, presentation logic
- Pickup form validation, grid snapping, window calculation
- Guidance prompt templates, cache key generation

### ML Tests (10 tests)
```bash
cd ml
python -m unittest discover -s tests
python -m pytest ../../scripts/test_import_perak_districts.py
```

### Supabase Integration Tests
```bash
cd supabase/tests
npm run test:rls
npm run test:pickup
npm run test:marketplace
npm run test:expiry
npm run test:completion
npm run test:feedback
```

---

## Build Status

```
Phase 1  Auth & Routing               ✅ Complete
Phase 2  DB Security & RLS            ✅ Complete
Phase 3  Google OAuth                  ✅ Complete
Phase 4  Model Audit (v0 baseline)    ✅ Complete (mAP metrics pending local data)
Phase 5  On-Device Scanner            ✅ Complete
Phase 6  Guidance & SnapBot           ✅ Complete
Phase 7  Pickup Requests + Map        ✅ Complete
Phase 8  Collector Marketplace        ✅ Complete
Phase 9  Completion & Proofs          ✅ Complete
Phase 10 Feedback & Home Stats        ✅ Complete

Phase 11 ML Automation                ⚠️  DB done; train.py / GitHub Actions to build
Phase 12 Model Delivery (app side)    ⚠️  DB/RPCs done; app download logic to build
Phase 13 Public Dashboard             ⚠️  DB views done; Next.js pages to write
Phase 14 Admin Panel                  ⚠️  DB done; Next.js scaffold created; pages to wire up

Phase 15 Research & Pilot             ❌  Needs local dataset + training cycles
```

---

## References

- **Development Guide:** [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- **Dataset Collection:** [DATASET_COLLECTION_GUIDE.md](./DATASET_COLLECTION_GUIDE.md)
- **Model Improvement:** [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md)
- **Environment Setup:** [ENVIRONMENT.md](./ENVIRONMENT.md)
- **Development Rules:** [../AGENTS.md](../AGENTS.md)
