# SnapPick Architecture

SnapPick is a community recycling app for Perak, Malaysia (Android only). Residents photograph waste, an on-device model detects the material, and the resident can request a pickup that a community collector claims. Verified scans become training data, and the admin retrains and publishes better detector models.

| Part | Where | Status |
|---|---|---|
| Mobile app (Expo, React Native) | `apps/mobile` | Done |
| Database, storage, edge functions | `supabase/` | Done |
| Admin dashboard (Next.js) | `apps/admin` | Done |
| Public website and dashboard (Next.js) | `apps/web` | Built; reads only the `public_*` snapshot tables (migration `20261107000100`) |
| Model retraining (Kaggle notebook) | `ml/` | Done |
| Public website and community dashboard | (not started) | Planned |

```
 Phone (Expo app) ───────────────┐
   on-device YOLOv8n TFLite      │ Supabase client (RLS everywhere)
                                 ▼
                     Supabase (Postgres + PostGIS)
              Auth · RLS · RPCs · Realtime · Storage · pg_cron
              Edge functions: snapbot-chat, dashboard-ai, notify,
              get-pickup-private-details, get-pickup-proof
                                 ▲                     ▲
 Admin dashboard (Next.js) ──────┘                     │ service-role secret
   Dataset · Models · Disputes                         │ (stored only in Kaggle)
          │  Retrain button                            │
          └────────────► Kaggle notebook (GPU) ────────┘
                         trains, exports .tflite, registers a candidate model
```

## Mobile app (`apps/mobile`)

Expo SDK 57, React Native 0.86 (new architecture), Expo Router, NativeWind, `react-native-fast-tflite` (CPU), MapLibre, Supabase JS. It needs a development build (`npx expo run:android`); Expo Go does not work.

Five tabs:

| Tab | What it does |
|---|---|
| Home | Impact stats (cached offline), news, scan and SnapBot shortcuts. Syncs offline scans and checks for a new detector model when opened. |
| Activity | **My Requests** (cancel, view proof, confirm and rate, dispute) and **Claimed Tasks** (start, release, route, submit proof). |
| Scan | Pick or take a photo, review detections, add or remove items, read the preparation guide, then schedule a pickup. |
| Collect | Live map of pending pickups (grid-snapped pins), one-tap claim, at most 3 active claims. |
| Profile | Name and phone, privacy toggles, **Check Updates** for the detector model, sign out, delete account. |

Key behaviour:

- **Detection runs on the phone.** The model, labels, input size and thresholds come from `assets/models/model_manifest.json`, checked against the loaded model's tensor shapes. The labels, in fixed order, are `metal, trash, glass, paper, cardboard, plastic, biological`.
- **Detector model updates.** The bundled model (`v0`) is never overwritten. When the admin makes a newer model live, the phone offers it: automatically when Home opens (checked at most every 6 hours, "Later" is remembered for 24 hours) or via Profile, Check Updates. Any load failure falls back to the bundled model.
- **Offline scans.** If saving a scan fails (no network), the whole scan session is kept on the phone and saved on the next Home visit. Photos upload through a second queue, only for users who consented.
- **Low confidence is shown.** Detections under 80% show "Low confidence" and need a tap to confirm.
- **Proof photos** must be taken within 12 hours (camera, or a gallery photo with a readable capture time), are downsized to 800 px and stripped of EXIF/GPS before upload.
- **Ratings.** Only collectors are rated, by the requester, when the requester confirms a pickup (1 to 5 stars, required). New collectors show "New" until they have a rating.
- **Account deletion** removes the user's stored photos first, then the account.

## Backend (`supabase/`)

All schema changes are files in `supabase/migrations/` (applied to the linked remote project with `supabase db push`). Never edit the schema in the dashboard and never rewrite an applied migration.

**Storage** (all private): `scans` (scan photos), `proofs` (JPEG only, 10 MB max), `models` (`.tflite` files). Owners read their own folder (`<user id>/...`); admins can read `scans` and `proofs`.

**Pickup status flow:** `pending` → `accepted` (claimed) → `in_progress` → `awaiting_confirmation` → `completed`, with `not_collected`, `cancelled`, `expired` and `disputed` as the other states.

**Rules enforced in the database:**

- Exact coordinates and address live only in `pickup_request_private_details`. Public views show grid-snapped points (0.01°) and the district. The collector gets the address through an edge function, only after claiming.
- At most 5 open requests per requester, at most 3 active claims per collector.
- A submitted proof must exist in storage (at least 1 KB), be a JPEG and have been captured within the last 12 hours.
- A requester can only confirm by rating (`rate_and_confirm_pickup`). Ratings are readable only by the two people involved and admins.
- An admin who **upholds** a dispute sets the request to `not_collected` and records a 1-star rating for the collector. The requester can relist the pickup. Every dispute resolution is written to `audit_log`.
- `pg_cron` jobs: unstarted claims return to `pending` after 24 hours, unconfirmed pickups complete automatically 48 hours after submission (unless disputed).

**Main tables:** `profiles`, `scans`, `detections`, `label_feedback`, `feedback_samples`, `scan_upload_queue`, `pickup_requests_public`, `pickup_request_private_details`, `pickup_waste_items`, `pickup_proofs`, `pickup_ratings`, `disputes`, `perak_districts`, `pbt_rule_sets`, `model_versions`, `push_tokens`, `audit_log`, `llm_usage`, `instruction_cache`, `reports`.

**Public statistics** (read by `apps/web` with the anon key only): `public_meta`, `public_stats_period`, `public_stats_monthly`, `public_stats_materials`, `public_stats_hotspots`, rebuilt hourly by `refresh_public_stats()`; `get_public_districts()` (map outlines) and `get_public_range_stats(from, to)` (figures for a chosen date range). Any figure based on fewer than 5 households is returned as null. See [PUBLIC_WEBSITE_AND_DASHBOARD.md](./PUBLIC_WEBSITE_AND_DASHBOARD.md).

**Edge functions** (`supabase/functions/`): `snapbot-chat` (recycling chat assistant, signed-in users only), `dashboard-ai` (language-model gateway for the public website, same `OPENAI_API_KEY` secret, accepts only the shared secret `DASHBOARD_AI_SECRET`), `notify` (push notifications on status changes via Firebase), `get-pickup-private-details` and `get-pickup-proof` (return the address or a signed proof link to the people allowed to see them).

## Admin dashboard (`apps/admin`)

Next.js 15 (App Router) on port 3001. Sign-in requires an account with `profiles.is_admin = true`; the middleware protects every page and API route, and the API routes run with the signed-in admin's session.

| Page | What the admin does |
|---|---|
| Overview | Live model, items waiting for review, open disputes, dataset progress. |
| Dataset | Review label edits users made (Confirm, Discard, or for removals "Keep removed" or "Restore as…"), see how many images are new since the last model, export a manifest, and press **Retrain**. |
| Models | Compare versions (exact accuracy, difference from the live model, community images used), make one live with **Use**, delete a rejected one, reset to the built-in model, or upload a `.tflite` file. |
| Disputes | Open the proof photo and uphold, reject or close a dispute. |

## Retraining (`ml/`)

See [MODEL_LIFECYCLE.md](./MODEL_LIFECYCLE.md) for the full flow and [KAGGLE_SETUP.md](./KAGGLE_SETUP.md) for the one-time Kaggle setup. In short: Retrain pushes `ml/notebooks/kaggle_waste_detector_retraining.ipynb` to one fixed Kaggle notebook, which trains YOLOv8n on the public base dataset plus your verified community images, exports TFLite, uploads it and registers it as a candidate. The admin decides whether to use it.

## Testing

- **Mobile unit tests:** `npm test` in `apps/mobile` (Vitest, pure TypeScript).
- **Backend checks against the remote project:** `supabase/tests/remote-e2e.mjs` signs in as the two test accounts and checks permissions, privacy, proof rules, disputes, ratings and limits. See [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md).
- Development and testing happen directly against the remote Supabase project; there is no local Supabase workflow.
