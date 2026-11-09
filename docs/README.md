# SnapPick documentation

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the mobile app, Supabase, admin dashboard and retraining fit together, and the rules the database enforces |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Setup, running the apps, tests, the database workflow and common problems |
| [MODEL_LIFECYCLE.md](./MODEL_LIFECYCLE.md) | Gather images → review → retrain → the admin decides → phones update |
| [KAGGLE_SETUP.md](./KAGGLE_SETUP.md) | One-time Kaggle setup so the Retrain button works |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Machine, toolchain and library versions |
| [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) | Colours, typography, components and tone of voice (SnapBot avatar files are in `brand/`) |
| [PUBLIC_WEBSITE_AND_DASHBOARD.md](./PUBLIC_WEBSITE_AND_DASHBOARD.md) | Specification for the marketing website, public dashboard, SnapBot guide and formal report |

See also [../PRODUCT.md](../PRODUCT.md) (product purpose and principles) and [../AGENTS.md](../AGENTS.md) (rules for the AI assistant).

## Status

| Part | Status |
|---|---|
| Mobile app (`apps/mobile`) | Done |
| Database, storage, edge functions (`supabase/`) | Done |
| Admin dashboard (`apps/admin`) | Done |
| Retraining (`ml/`) | Done |
| Public website and community dashboard (`apps/web`) | Built; APK hosting, domain and legal wording still open (see PUBLIC_WEBSITE_AND_DASHBOARD.md) |
