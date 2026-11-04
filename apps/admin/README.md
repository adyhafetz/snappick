# SnapPick Admin

Admin panel for the SnapPick project. Requires authenticated Supabase session with `is_admin()` privilege.

## Purpose

- **Detector versions** — view, approve, and roll back model versions (referenced by version number: v0, v1, v2…)
- **Training runs** — monitor the continuous learning pipeline, check trigger stats
- **Feedback queue** — review user corrections and manage the annotation queue
- **Disputes** — resolve pickup disputes
- **Drift monitor** — daily model performance metrics
- **Audit log** — all admin actions

## Setup

```bash
cd apps/admin
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your Supabase project
npm install
npm run dev   # runs on http://localhost:3001
```

## Authentication

This app uses Supabase Auth. All admin RPCs and tables enforce `is_admin()` via Row Level Security. You must be signed in as an admin user; regular users will receive authorization errors from the database.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS
- @supabase/supabase-js + @supabase/ssr
- Recharts (for drift/metrics charts)
- lucide-react (icons)
