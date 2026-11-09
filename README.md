# SnapPick

A community recycling app for Perak, Malaysia (Android only). Residents photograph household waste and an on-device model identifies the material. They can request a pickup, a community collector claims it, and verified scans help train a better detector over time.

## Status

| Part | Location | Status |
|---|---|---|
| Mobile app | `apps/mobile` | Done |
| Database, storage, edge functions | `supabase/` | Done |
| Admin dashboard | `apps/admin` | Done |
| Public website and dashboard | `apps/web` | Built (see docs/PUBLIC_WEBSITE_AND_DASHBOARD.md) |
| Model retraining (Kaggle) | `ml/` | Done |
| Public website and community dashboard | (not started) | Planned |

## What it does

- **Scan:** on-device YOLOv8n TFLite detection of 7 materials (`metal, trash, glass, paper, cardboard, plastic, biological`), works offline, with preparation guides and a safety declaration.
- **Pickups:** request a pickup inside the 13 Perak districts. Exact addresses stay private; collectors see a grid-snapped pin until they claim.
- **Collect:** collectors claim jobs on a live map, collect with a proof photo, and the requester confirms and rates (or disputes).
- **SnapBot:** a recycling chat assistant.
- **Admin:** review user label edits, press Retrain, compare models and decide which one is live, resolve disputes.

## Repository layout

Single Git repository with independent package roots (no root JavaScript workspace):

```text
apps/mobile      Expo (React Native) Android app
apps/admin       Next.js admin dashboard (port 3001)
apps/web         Next.js public website and community dashboard (port 3002)
ml/              Kaggle retraining notebook (ml/notebooks/)
supabase/        migrations, edge functions, seed data, remote test script
scripts/         database helpers and the Perak district importer
docs/            documentation
```

## Quick start

```powershell
cd apps\mobile
copy .env.example .env      # fill in the Supabase URL and anon key
npm install
npx expo run:android        # development build on a connected phone
```

```powershell
cd apps\admin
copy .env.example .env.local
npm install
npm run dev                 # http://localhost:3001
```

Everything is developed and tested against the linked remote Supabase project. See [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).

## Documentation

| Document | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system fits together |
| [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Setup, running, tests, database workflow, common problems |
| [docs/MODEL_LIFECYCLE.md](docs/MODEL_LIFECYCLE.md) | Gather → review → retrain → decide → phones update |
| [docs/KAGGLE_SETUP.md](docs/KAGGLE_SETUP.md) | One-time Kaggle setup for Retrain |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Machine, toolchain and library versions |
| [docs/BRAND_IDENTITY.md](docs/BRAND_IDENTITY.md) | Colours, type, components, tone of voice |
| [PRODUCT.md](PRODUCT.md) | Product purpose, users and principles |
| [AGENTS.md](AGENTS.md) | Rules for the AI assistant working on this repository |
