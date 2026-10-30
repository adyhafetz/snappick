# SnapPick Architecture

**Last Updated:** 2026-10-30  
**Status:** Phases 1–10 Complete | Mobile App Production-Ready | ML Pipeline Manual | Dashboard Not Built

---

## Overview

SnapPick is a community-driven recycling platform for Perak, Malaysia combining:
- **On-device ML waste detection** (YOLOv8n TFLite, 7 material classes)
- **Community pickup marketplace** (residents request, collectors claim & complete)
- **Continuous learning pipeline** (user feedback → model retraining → improvement)

**Core Innovation:** The ML model improves over time from consented user images verified by community collectors and reviewed by admins.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Mobile App (React Native)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Tabs: Home | Activity | Scan | Request | Profile              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ • Camera + On-Device TFLite Inference (CPU, ~1-2s)           │  │
│  │ • MapLibre (pickup locations, no API key)                    │  │
│  │ • SnapBot AI Assistant (OpenAI GPT-4o-mini)                  │  │
│  │ • Offline queue for scan uploads                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               ▼ (Supabase Client SDK)
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase Backend (PostgreSQL + PostGIS)           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Auth: Email + Google OAuth                                    │  │
│  │ Database: 18 tables with RLS, PostGIS geofencing             │  │
│  │ Storage: Scan images + proof photos (signed URLs)            │  │
│  │ Edge Functions: SnapBot, Private Details, Proof URLs, FCM    │  │
│  │ pg_cron: Auto-expire claims, auto-complete pickups           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               ▼ (Manual Admin Workflow)
┌─────────────────────────────────────────────────────────────────────┐
│                    ML Pipeline (Python + Kaggle)                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Export feedback samples from database                      │  │
│  │ 2. Label with Label Studio (admin manual review)             │  │
│  │ 3. Train YOLOv8n on Kaggle GPU (Ultralytics)                │  │
│  │ 4. Export to TFLite, validate contracts                      │  │
│  │ 5. Manual bundle update in mobile app (future: auto-deliver) │  │
│  └──────────────────────────────────────────────────────────────┘  │
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
- **Map:** @maplibre/maplibre-react-native (OpenFreeMap tiles)
- **ML:** react-native-fast-tflite (TensorFlow Lite with CPU delegate)
- **Auth:** Supabase Auth (@supabase/supabase-js)

### App Structure
```
apps/mobile/src/
  app/(tabs)/              # Main 5 tabs (Home, Activity, Scan, Request, Profile)
  components/
    guidance/              # SnapBot AI modal, recycling preparation guides
    pickup/                # Pickup request form, marketplace, proof modal
    ui/                    # Reusable UI components (Button, Card, Input, etc.)
  lib/
    detector/              # ML model loading, preprocessing, inference, NMS
    guidance/              # SnapBot API client, LLM prompt templates
    home/                  # Home stats RPC calls
    pickup/                # Pickup marketplace, draft storage, validation
    consent.ts             # User consent flow management
    supabase.ts            # Supabase client setup
  providers/
    AuthProvider.tsx       # Global auth state management
  assets/
    models/                # Bundled TFLite model + manifest
      snappick_det_v0.tflite
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

## Database Schema (PostgreSQL 18 + PostGIS)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User accounts | `user_id`, `display_name`, `phone`, `image_storage_consent`, `training_opt_in` |
| `scans` | Scan sessions | `id`, `user_id`, `model_version`, `rule_set_id`, `image_path`, `retention_date` |
| `detections` | Detected items | `scan_id`, `model_label`, `app_class`, `score`, `box_*`, `source`, `condition`, `eligibility` |
| `label_feedback` | User corrections | `scan_id`, `detection_id`, `feedback_type`, `original_model_label`, `corrected_app_class` |
| `feedback_samples` | Upload queue | `scan_id`, `label_tier`, `gating_reason`, `uploaded_at` |
| `pickup_requests_public` | Pickup metadata | `id`, `requester_id`, `collector_id`, `status`, `district_id`, `masked_location`, `material_summary` |
| `pickup_request_private_details` | Exact addresses | `request_id`, `exact_location` (PostGIS geography), `unit_number`, `street`, `access_instructions` |
| `pickup_waste_items` | Items per request | `request_id`, `class_name`, `condition`, `quantity` |
| `pickup_proofs` | Proof photos | `request_id`, `storage_path`, `uploaded_by` |
| `disputes` | Collection disputes | `request_id`, `raised_by`, `reason`, `status` |
| `instruction_cache` | SnapBot LLM cache | `cache_key`, `instructions`, `token_count` |
| `llm_usage` | LLM cost tracking | `model_name`, `prompt_tokens`, `completion_tokens`, `cost_usd` |
| `push_tokens` | FCM device tokens | `user_id`, `token`, `platform` |
| `perak_districts` | 13 DOSM districts | `id`, `name`, `boundary` (PostGIS multipolygon) |
| `pbt_rule_sets` | Recycling rules | `id`, `label`, `version`, `rules` (JSONB) |

### Key Database Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `resolve_pickup_area(lat, lng)` | Check if coordinates are in Perak district (PostGIS `ST_Contains`) |
| `create_pickup_request(...)` | Atomically create request + private details + items with grid snap |
| `claim_pickup_request(request_id)` | Atomic claim with 3-job cap, race condition handling |
| `submit_collected_items(...)` | Upload proof photo, transition to `awaiting_confirmation` |
| `confirm_pickup(request_id)` | Requester confirms completion |
| `raise_dispute(request_id, reason)` | Requester disputes proof |
| `cancel_pickup_request(request_id)` | Cancel pending request |
| `relist_pickup(request_id)` | Relist `not_collected` request as `pending` |
| `get_home_stats()` | Fetch user's total scans, verified items, active requests |

### Views for RLS Isolation

| View | Purpose |
|------|---------|
| `pending_pickup_marketplace` | Public pickups with 0.01° grid clustering, excludes private details |
| `my_pickup_requests` | User's own requests with full status history |
| `my_claimed_pickups` | User's claimed pickups with details |

### Automated Jobs (pg_cron)

| Job | Schedule | Action |
|-----|----------|--------|
| `release_expired_claims` | Every 30 min | Release `accepted` claims older than 24h back to `pending` |
| `auto_complete_confirmed` | Every 30 min | Auto-complete `awaiting_confirmation` after 48h if no dispute |

---

## ML Pipeline (Python)

### Current Model: `snappick_det_v0`
- **Framework:** Ultralytics YOLOv8n
- **Input:** 384×384×3, centre-crop, float32, normalized [0-1], NCHW layout
- **Output:** Raw YOLO format `[1, 11, 3024]` (cx, cy, w, h, obj_score, 7 class scores)
- **NMS:** IoU 0.5, max 30 boxes
- **Classes:** `["metal", "trash", "glass", "paper", "cardboard", "plastic", "biological"]`
- **Thresholds:** Confident: 0.8, Uncertain: 0.4
- **Dataset:** Temporary Kaggle [sumn2u/garbage-classification-v2-bbox-384](https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2-bbox-384)
- **Size:** 12.7 MB
- **Performance:** ~1-2s inference on Redmi Note 10 (CPU delegate)

### ML Scripts (`ml/src/`)

| Script | Purpose |
|--------|---------|
| `inspect_tflite.py` | Inspect model tensors, shapes, dtypes |
| `contract.py` | Validate manifest against TFLite binary |
| `dataset_audit.py` | Verify training dataset integrity |
| `parity.py` | Compare Python vs mobile inference outputs |
| `smoke_test.py` | End-to-end model load + inference test |

### Feedback Loop (Manual)

```
1. User scans → detections saved to database with consent flags
2. Active learning gating selects samples:
   - Confidence 0.40–0.79 (uncertain) → 100% upload
   - User corrections (remove/change class) → 100% upload
   - Random 5% of clean detections → baseline sampling
3. Samples queued in `feedback_samples` table with label tier:
   - Tier A: User confirmed (highest quality)
   - Tier B: User corrected (medium quality)
   - Tier C: Collector verified (external validation)
   - Tier D: Uncertain detections (needs review)
4. Admin exports samples → Label Studio → manual review
5. Retrain YOLOv8n on Kaggle GPU with merged dataset
6. Export to TFLite → validate contract → bundle in mobile app
```

**Future (Phase 11):** Automate with GitHub Actions + Kaggle API

---

## Edge Functions (Deno on Supabase)

| Function | Purpose | Auth |
|----------|---------|------|
| `snapbot-chat` | OpenAI GPT-4o-mini proxy with prompt engineering, LLM usage tracking, token cache | User JWT |
| `get-pickup-private-details` | Return exact coordinates + address for claimed pickup | User JWT + collector verification |
| `get-pickup-proof` | Generate short-lived signed URL (5 min) for proof photo | User JWT + participant verification |
| `notify` | Send FCM push notifications with Web Crypto RS256 signing | Internal (cron trigger) |

---

## Third-Party Services

| Service | Purpose | API Key Location |
|---------|---------|------------------|
| **Supabase** | Auth, database, storage, edge functions | `apps/mobile/.env` (EXPO_PUBLIC_*) |
| **OpenAI** | SnapBot AI assistant (gpt-4o-mini) | Supabase Edge Function env |
| **Firebase Cloud Messaging** | Push notifications | Supabase Edge Function env (service account JSON) |
| **Google OAuth** | Sign-in with Google | Firebase Console + Google Cloud Console |
| **MapLibre** | Map rendering | No API key (OpenFreeMap tiles) |
| **Kaggle** | GPU training for ML models | Manual upload/download |

---

## Privacy & Security

### Privacy-by-Design Features
- **Grid Snapping:** Exact coordinates masked to 0.01° grid (~1km precision) in public marketplace
- **Private Details Table:** Exact location + address only accessible to requester & collector
- **No User IDs in LLM Prompts:** SnapBot receives only waste class names, never images/addresses
- **Signed URLs:** Proof photos accessible via short-lived (5 min) signed URLs, not public
- **Consent Gating:** Images uploaded only if user granted `image_storage_consent` + `training_opt_in`
- **EXIF Stripping:** Proof photos downsampled to 800px with all EXIF/GPS metadata removed

### Row-Level Security (RLS)
Every table has RLS enabled with policies:
- `profiles`: Users can read/update own profile only
- `scans`, `detections`: Users can read/write own scans only
- `pickup_requests_public`: Users can read marketplace, write own requests
- `pickup_request_private_details`: Only requester + collector can read
- `pickup_proofs`: Only requester + collector can read
- Admin tables: `is_admin()` function check

---

## Testing

### Mobile App Tests (63 tests)
```bash
cd apps/mobile
npm test
```
- **Detector:** Preprocessing (centre crop), NMS, rules engine, presentation logic
- **Pickup:** Form validation, grid snapping, window calculation
- **Guidance:** Prompt templates, cache key generation

### ML Tests (10 tests)
```bash
python -m unittest discover -s ml/tests
python -m unittest discover -s scripts
```
- **Contract:** Manifest validation, tensor shape checks
- **Dataset:** Image integrity, annotation format
- **Parity:** Python vs TFLite output comparison

### Supabase Integration Tests (6 suites, 48 tests)
```bash
cd supabase/tests
npm run test:rls          # Row-level security isolation
npm run test:pickup       # Pickup creation, cancellation
npm run test:marketplace  # Claim, concurrency, 3-job cap
npm run test:expiry       # Auto-release expired claims
npm run test:completion   # Proof upload, confirm/dispute
npm run test:feedback     # Active learning gating
```

---

## What's NOT Built Yet

| Phase | Feature | Status |
|-------|---------|--------|
| **Phase 11** | ML Pipeline Automation (GitHub Actions + Kaggle runner) | Python scripts exist, no automation |
| **Phase 12** | Model Delivery & Rollout (app downloads updated models) | Not implemented |
| **Phase 13** | Admin Dashboard (review feedback, approve models) | Empty `apps/dashboard/` folder |
| **Phase 14** | Admin features (disputes, retention pruning, rule-set editor) | Simplified database tables exist |
| **Phase 15** | Research experiments, pilot deployment, release APK | Not started |

---

## Next Steps

1. **Collect Local Dataset:** Follow `DATASET_COLLECTION_GUIDE.md` to create Perak-specific training set
2. **Build ML Automation:** Automate retraining pipeline (GitHub Actions + Kaggle API)
3. **Build Admin Dashboard:** Next.js app for feedback review, model approval
4. **Implement Model Delivery:** OTA model updates via Supabase storage

---

## References

- **Development Guide:** [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- **Dataset Collection:** [DATASET_COLLECTION_GUIDE.md](./DATASET_COLLECTION_GUIDE.md)
- **Model Improvement:** [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md)
- **Environment Setup:** [ENVIRONMENT.md](./ENVIRONMENT.md)
- **Development Rules:** [../AGENTS.md](../AGENTS.md)
