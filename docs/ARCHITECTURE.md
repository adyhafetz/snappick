# SnapPick Architecture

**Last Updated:** 2026-11-04  
**Status:** Mobile App Production-Ready (95%+ Complete) | Database & Migrations Complete | Focus Shifting to Admin Panel (`apps/admin`)

---

## Overview

SnapPick is a community-driven recycling platform for Perak, Malaysia combining:
- **On-device ML waste detection** (Ultralytics YOLOv8n TFLite running on CPU, 7 material classes)
- **Community pickup marketplace** (residents request pickups within Perak districts; community collectors claim, navigate, and complete)
- **Streamlined proof & verification** (1-tap photo verification, EXIF/GPS stripped client-side, 48-hour requester confirmation, dispute handling, mutual user ratings)
- **Continuous learning pipeline** (user feedback and active learning signals feed gated retraining)

**Core Innovation:** The ML detector improves over time from consented, verified user images through a gated retraining pipeline with staged OTA model delivery.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Mobile App (React Native / Expo SDK 57)            │
│  Tabs: Home | Activity | Scan | Collect | Profile                            │
│  • Camera / Gallery + On-Device TFLite Inference (CPU delegate, ~1-2s)       │
│  • MapLibre GL Native (OpenFreeMap vector tiles, no API key required)        │
│  • SnapBot AI Assistant (OpenAI GPT-4o-mini proxy with local cache)          │
│  • Route Preview & Navigation handoff (Google Maps / Waze)                   │
│  • Offline queue for scan uploads & cached home statistics                   │
│  • Staged OTA Model Update Manager & remote model activation                │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ↓ (Supabase Client SDK)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Supabase Backend (PostgreSQL 15 + PostGIS 3)             │
│  Auth: Email + Google OAuth                                                 │
│  Database: 28 migrations, 22 tables with RLS, PostGIS boundary geofencing   │
│  Realtime: Broadcast channel ('pickup-marketplace') for live job updates     │
│  Storage: Scan images ('scans') + proof photos ('proofs') + models ('models')│
│  Edge Functions: SnapBot, Private Details, Short-lived Proof URLs, FCM Notify│
│  pg_cron: Auto-expire claims (24h), auto-complete pickups (48h), daily drift │
└─────────────────────────────────────────────────────────────────────────────┘
                 ↓ (public anon)                             ↓ (admin JWT)
┌──────────────────────────────┐             ┌────────────────────────────────┐
│   Public Dashboard           │             │         Admin Panel            │
│   apps/dashboard             │             │         apps/admin             │
│   Next.js 15                 │             │         Next.js 15             │
│   No login required          │             │         Requires is_admin()    │
│   Community stats            │             │         Model version approval │
│   Pickup trends              │             │         Staged rollout control │
│   Material breakdown         │             │         Feedback queue review  │
│   District map               │             │         Dispute resolution     │
│   Model transparency tab     │             │         Drift & latency monitor│
└──────────────────────────────┘             └────────────────────────────────┘
                                       ↓ (Automated / Kaggle)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ML Retraining Pipeline (Python + Kaggle GPU)             │
│  1. Query active learning samples (Tier A/B/C/D) via RPC                    │
│  2. Label verification / annotation via Label Studio                        │
│  3. Retrain YOLOv8n on Kaggle GPU                                           │
│  4. Export to TFLite, validate export contract & tensor shapes              │
│  5. Gate check against frozen golden evaluation set (mAP regression guard)   │
│  6. Register version in DB → Admin approves rollout → Staged OTA delivery   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile App (`apps/mobile`)

### Tech Stack
- **Framework:** Expo SDK 57, React Native 0.86.3, React 19.2.3 (New Architecture enabled)
- **Navigation:** Expo Router (file-based routing with typed routes)
- **Styling:** NativeWind 4.2.7 (Tailwind CSS for React Native)
- **Storage:** `@react-native-async-storage/async-storage` (offline caching, active model config)
- **Camera & Media:** `expo-camera`, `expo-image-picker`, `expo-image`, `expo-image-manipulator`
- **Map:** `@maplibre/maplibre-react-native` (OpenFreeMap tiles, zero external API key dependencies)
- **ML Engine:** `react-native-fast-tflite` 3.0.1 (TensorFlow Lite with CPU delegate)
- **Auth:** Supabase Auth (`@supabase/supabase-js` 2.117.2) with Google Sign-In support
- **Icons:** `lucide-react-native`

### Code Structure
```text
apps/mobile/src/
├── app/
│   ├── _layout.tsx                     # Root layout, AuthProvider, navigation stack
│   ├── index.tsx                       # Entry redirector
│   ├── (auth)/                         # Sign-in and sign-up screens
│   ├── (consent)/                      # Image storage & safety consent screens
│   ├── (tabs)/                         # 5 Core Bottom Tabs
│   │   ├── _layout.tsx                 # Tab bar styling & auth protection
│   │   ├── index.tsx                   # [Home] Stats, Perak Eco News, SnapBot trigger
│   │   ├── activity.tsx                # [Activity] Dual-tab: My Requests & Claimed Pickups
│   │   ├── scan.tsx                    # [Scan] 3-step: Review -> Guidance -> Schedule
│   │   ├── collect.tsx                 # [Collect] Realtime collector marketplace map
│   │   └── profile.tsx                 # [Profile] Settings, Privacy, OTA Model Updates
│   └── pickup/
│       └── [id].tsx                    # Pickup detail screen (Requester & Collector views)
├── components/
│   ├── guidance/
│   │   ├── RecyclingAnimation.tsx      # Material-specific animated guide cards (WebP)
│   │   └── SnapBotModal.tsx            # AI assistant modal with cached responses
│   ├── pickup/
│   │   ├── CollectionChecklist.tsx     # Checklist row items for collector verification
│   │   ├── MyRequestDetailsModal.tsx   # Detailed modal for requester's view of request
│   │   ├── PickupCollect.tsx           # Full interactive map marketplace component
│   │   ├── PickupDisputeModal.tsx      # Dispute submission modal for requesters
│   │   ├── PickupRatingModal.tsx       # 1-5 star mutual rating modal with attribute tags
│   │   ├── PickupRequestSection.tsx    # Integrated pickup scheduling & pin placement form
│   │   ├── PickupStatusPill.tsx        # Color-coded badge for all request statuses
│   │   ├── ProofPhotoModal.tsx         # Full-screen proof photo viewer
│   │   └── RoutePreviewMap.tsx         # Embedded MapLibre route preview & turn-by-turn launcher
│   └── ui/                             # Base UI components (Button, Card, Input, Badge, Switch, Text)
├── lib/
│   ├── detector/                       # Preprocessing, inference, postprocessing, active learning
│   │   ├── manager.ts                  # Active model resolution, OTA update checking, activation
│   │   ├── manifest.ts                 # Manifest validation & tensor contract checks
│   │   ├── persistence.ts              # Scan & detection recording in Supabase
│   │   ├── postprocess.ts              # Bounding box decode & Non-Maximum Suppression (NMS)
│   │   ├── preprocess.ts               # 384x384 centre crop, normalization, float32 conversion
│   │   ├── rules.ts                    # Waste eligibility rules engine
│   │   ├── scanner.ts                  # End-to-end photo scan coordinator
│   │   └── upload-queue.ts             # Offline upload queue for active learning samples
│   ├── guidance/                       # SnapBot client & recycling preparation guides
│   ├── home/                           # Home impact stats fetcher & offline cache
│   ├── news/                           # Perak environmental news and recycling updates
│   ├── pickup/                         # Marketplace grouping, routing, navigation, proof preparation
│   ├── consent.ts                      # Consent checking and persistence
│   ├── notifications.ts                # FCM token registration
│   └── supabase.ts                     # Supabase client singleton
└── assets/
    └── models/                         # Bundled immutable model and contract manifest
        ├── model_manifest.json         # Input layout, labels, thresholds, NMS configs
        └── waste_detector_v0.tflite    # 12.7 MB YOLOv8n TFLite binary
```

---

## The 5 Core Tabs

| Tab | Icon | Purpose | Key Implementation Details |
|-----|------|---------|----------------------------|
| **Home** | `Home` | User dashboard & impact overview | Displays personal statistics (`total_scans`, `verified_recyclable_items`, `active_requests`), offline-cached fallback, Perak Eco News carousel/feed, recent scans preview, and SnapBot AI launcher. Flushes offline upload queue on focus. |
| **Activity** | `History` | Track pickups & claims | Dual tab view: **"My Requests"** (view details modal, cancel pending, view proof photo, confirm collection, dispute modal, rate collector) and **"Claimed Pickups"** (start job, release claim, route preview, complete collection, rate requester). Filterable by All / Active / Completed. Listens to Realtime broadcast updates. |
| **Scan** | `ScanLine` | 3-step waste classification & pickup flow | **Step 1: Review** — Camera capture or gallery picker, on-device TFLite inference (~1-2s), bounding boxes, condition picker, item correction/addition. Auto-persists scan data and queues training samples if active learning criteria met.<br>**Step 2: Guidance** — Animated recycling preparation guides (WebP) per detected class and mandatory safety declaration checklist.<br>**Step 3: Schedule** — Inline MapLibre pin placement, 13 Perak district boundary check, date & time window selection, creating pending request. |
| **Collect** | `MapPin` | Realtime collector marketplace | Interactive MapLibre map displaying pending pickup requests grouped into 0.01° grid cells (~1km). Realtime WebSocket connection (`pickup-marketplace` broadcast channel). Features GPS auto-locate, request preview card, and one-tap atomic claim (enforces 3 concurrent claim limit). |
| **Profile** | `User` | Preferences, privacy, & OTA updates | Edit display name and contact phone, view collector reputation rating, toggle privacy settings (image storage consent, training contribution opt-in), check for OTA model updates and activate candidate versions, and permanent account deletion (`delete_my_account` RPC). |

---

## Detailed User Flows

### 1. Scan & Detection Flow
```
User takes photo / picks from gallery
  → Image preprocessed (384×384 centre crop, RGB normalization, NCHW layout)
  → On-device TFLite inference (~1-2s on CPU)
  → Raw tensor [1, 11, 3024] decoded → IoU 0.5 NMS applied
  → Step 1 (Review): Bounding boxes rendered over image
      • User can edit material class, adjust condition (clean/dry vs contaminated), or add manual items
      • Detections & corrections logged to DB
      • If user has consented, active learning gating determines if image is uploaded (Tier A-D)
  → Step 2 (Guidance): Animated preparation instructions shown for each detected material
      • User acknowledges safety checklist (no batteries, e-waste, bulbs, or biohazards)
  → Step 3 (Schedule): Seamless handoff to pickup creation
```

### 2. Pickup Scheduling Flow
```
Eligible items from Scan step carried into Pickup form
  → MapLibre map allows user to drag pin or use current GPS location
  → PostGIS geofence check via RPC resolve_pickup_area() verifies location is within 13 Perak districts
  → Coordinates snapped to 0.01° grid (~1km) for public marketplace views
  → User enters private address: unit number, street, landmark, access instructions
  → User selects pickup date (1-3 days ahead) and time window (morning / afternoon)
  → Atomic RPC create_pickup_request() stores public metadata and private details in a single transaction
  → Broadcast event triggers realtime marketplace refresh
```

### 3. Collector Claim & Navigation Flow
```
Collector views Collect tab
  → Pending requests displayed as clustered markers on MapLibre map
  → Collector selects a pin → Views material summary, district, time window, and requester rating
  → Collector taps "Claim Pickup" → Atomic claim RPC locks row (enforces max 3 active jobs)
  → Job appears in Activity → "Claimed Pickups"
  → Collector taps "Start Pickup" (status: claimed → in_progress)
  → Opens /pickup/[id] detail screen:
      • Fetches private address details via authorized Edge Function
      • Displays RoutePreviewMap with route path and distance/duration
      • Button to launch native turn-by-turn navigation (Google Maps or Waze)
```

### 4. Streamlined Collection & Completion Flow
```
Collector arrives at location and inspects items
  → Happy Path (Items Collected):
      • Collector taps "Take Proof Photo"
      • Photo captured, downsampled to 800px, EXIF/GPS metadata completely stripped client-side
      • Photo uploaded to private Supabase storage bucket ('proofs')
      • Collector taps "Submit Collection" → submit_collection RPC sets status to awaiting_confirmation
      • 48-hour confirmation deadline starts
  → Alternative Path (Issue / Unable to Collect):
      • Collector selects non-collection reason ('contaminated', 'missing', 'unsafe', 'access_issue', 'other')
      • Takes proof photo of site/issue
      • submit_collection RPC immediately transitions status to not_collected
  → Requester Confirmation & Disputes:
      • Requester receives notification, views uploaded proof in Activity
      • If satisfied: Requester taps "Confirm Collection" → status: completed
      • If issue: Requester taps "Dispute" → enters dispute reason → status: disputed (routed to Admin Panel)
      • Auto-completion: If requester takes no action within 48 hours, pg_cron auto-completes request
  → Mutual Ratings:
      • Requester rates collector (1–5 stars + badges: "Punctual", "Friendly", "Careful")
      • Collector rates requester (1–5 stars + badges: "Well Packed", "Clean Items", "Easy Access")
```

---

## Database Architecture (`supabase`)

### 28 Applied Migrations Summary
1. `initial_schema`: Core tables, profiles, districts, pbt rule sets
2. `security_hardening`: RLS policies, spatial indexes
3. `auth_triggers`: Profile creation on sign-up, Google OAuth handling
4. `pickup_requests`: Public metadata, private details, waste items
5. `marketplace_rpcs`: `create_pickup_request`, `claim_pickup_request`, `cancel_pickup_request`
6. `proof_and_completion`: `submit_collection`, `confirm_pickup`, `raise_dispute`, `relist_pickup`
7. `cron_jobs`: Auto-expiration of unfulfilled claims (24h) and auto-completion (48h)
8. `scans_and_feedback`: Scan tracking, active learning queues (`feedback_samples` Tiers A–D)
9. `malaysian_sas_guidance`: Perak SAS (Separation at Source) guidelines
10. `ml_retraining_pipeline`: `model_versions`, `training_runs`, `dataset_versions`, trigger RPCs
11. `model_rollout_monitoring`: Staged rollout buckets, daily drift computation, rollout RPCs
12. `public_dashboard_views`: Privacy-masked views (`dashboard_*`) with small-count suppression (<5 masked)
13. `account_deletion_ratings`: `delete_my_account` RPC, mutual user ratings system and views
14. `simplified_collection_flow`: Streamlined 1-tap `submit_collection` RPC and database cleanup utilities
15. `requester_details_view`: Upgraded `my_claimed_pickups` view with requester names and rating aggregates

### Core Tables
| Table | Purpose | Access Control |
|-------|---------|----------------|
| `profiles` | User accounts, display names, phone numbers, privacy consent flags, ratings | Self read/write; public read for display info |
| `scans` | Recorded scan sessions with model version, preprocess/inference timings | Owner only |
| `detections` | Bounding boxes, predicted classes, confidence scores, condition states | Owner only |
| `label_feedback` | User corrections (removed boxes, changed labels, condition changes) | Owner insert; Admin read |
| `feedback_samples` | Active learning sample queue classified into Tiers A, B, C, D | Admin / ML service |
| `pickup_requests_public` | Public pickup request metadata (snapped 0.01° grid location, district, status) | Public read; Requester insert/cancel; Collector claim |
| `pickup_request_private_details` | Exact latitude/longitude, unit number, street address, access notes | Requester & assigned Collector only (Edge Function proxy) |
| `pickup_waste_items` | Individual items per request with quantities and conditions | Public read; Requester & Collector update |
| `pickup_proofs` | Verification photo paths, capture timestamps, non-collection flags | Requester & Collector read via signed URLs |
| `disputes` | Formally disputed collections requiring administrator resolution | Requester insert; Admin update |
| `ratings` | Mutual ratings between requesters and collectors (1-5 stars, feedback tags) | Rater insert; Both parties read |
| `perak_districts` | 13 DOSM official Perak district boundaries (PostGIS polygons) | Public read |
| `model_versions` | Detector registry (v0, v1...), SHA256 hashes, rollout %, champion status | Public read; Admin write |
| `training_runs` | Retraining logs, validation mAP metrics, golden set gate evaluation results | Admin only |
| `drift_daily` | Daily aggregated model metrics (correction rate, uncertain share, latency) | Admin only |

---

## Testing Strategy & Status

### Automated Test Suites
- **Mobile Unit Tests (apps/mobile):** **75 passed across 13 test files** (`npm test`)
  - `active-learning.test.ts`: Gating criteria (uncertain confidence, user corrections, sampling)
  - `detector.test.ts`: Tensor shape matching, class label alignment, NMS bounding box deduplication
  - `manager.test.ts`: Active model version resolution, config persistence, remote model update checks
  - `rules.test.ts`: Condition-based recycling eligibility decision logic
  - `upload-queue.test.ts`: Offline persistence and batch flushing logic
  - `snapbot.test.ts` & `recyclingGuides.test.ts`: Guidance templates, prompt sanitization, cache keys
  - `stats.test.ts`: Home stats fetching and offline AsyncStorage caching
  - `pickup.test.ts`, `checklist.test.ts`, `status.test.ts`, `routing.test.ts`, `proof.test.ts`: Pickup validations, window math, route parsing, EXIF stripping
- **ML Scripts & Invariants (ml):** 10 tests verifying contract integrity, tensor formats, and boundary importer
- **Supabase Integration Tests (supabase/tests):** RLS policy tests, atomic claim race condition tests, expiry cron tests, and feedback queue tests

---

## Upcoming Focus: Admin Panel (`apps/admin`)

The mobile application is feature-complete and tested. The primary focus is now the **Admin Panel** (`apps/admin`), built with Next.js 15:
1. **Authentication & Admin Shell:** Enforce `is_admin()` JWT check, navigation shell with responsive drawer.
2. **Model Version Management:** Review all detector versions, inspect contract manifests, approve candidate models, and manage staged rollout percentages (0% -> 10% -> 50% -> 100%).
3. **Continuous Learning / Feedback Review:** Interface to inspect Tier A active-learning images, review user corrections, and trigger dataset export for retraining.
4. **Dispute Resolution:** Review requester dispute claims, inspect uploaded proof photos via signed URLs, and issue binding resolutions (uphold completion / cancel request).
5. **Drift & Performance Monitoring:** Visual charts for daily model accuracy drift, uncertain prediction ratios, and on-device inference latency distributions.
