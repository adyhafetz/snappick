# SnapPick Admin

Admin dashboard for SnapPick (Next.js 15, App Router). Sign-in requires an account whose profile has `is_admin = true`; the middleware protects every page and API route, and the API routes run with the signed-in admin's session so Row Level Security applies.

## Pages

| Page | Purpose |
|---|---|
| Overview | Live model, items waiting for review, open disputes, dataset progress |
| Dataset (`/feedback`) | Review users' label edits, see new images since the last model, export a manifest, press **Retrain** |
| Models | Compare model versions, make one live (**Use**), delete a rejected one, reset to the built-in model, upload a `.tflite` file |
| Disputes | View the proof photo and uphold, reject or close a dispute |

API routes (admin only): `POST /api/retrain/trigger` (starts the Kaggle run), `GET /api/retrain/status` (run state), `GET /api/retrain/export` (training manifest).

## Run

```powershell
cd apps\admin
copy .env.example .env.local   # Supabase URL and anon key, plus the Kaggle values for Retrain
npm install
npm run dev                    # http://localhost:3001
```

Retrain needs a one-time Kaggle setup: [../../docs/KAGGLE_SETUP.md](../../docs/KAGGLE_SETUP.md). The flow itself: [../../docs/MODEL_LIFECYCLE.md](../../docs/MODEL_LIFECYCLE.md).

No service-role key is used in this app. The service-role key lives only in the Kaggle notebook's secrets.
