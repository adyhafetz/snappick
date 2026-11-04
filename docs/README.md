# SnapPick Documentation

Welcome to SnapPick! This directory contains the technical documentation, architecture specifications, development guides, and machine reference.

## Quick Start

- **New to the project?** Read [ARCHITECTURE.md](./ARCHITECTURE.md) first
- **Setting up locally?** Follow [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- **Toolchain & versions?** Check [ENVIRONMENT.md](./ENVIRONMENT.md)
- **Want to contribute?** Check [../AGENTS.md](../AGENTS.md) for development rules

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, database schema, app structure, user flows |
| [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) | Brand philosophy, color tokens, typography scale, UI patterns, and tone of voice |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Setup, running tests, database utilities, common tasks, troubleshooting |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Machine setup, installed package versions, toolchain reference |
| [DATASET_COLLECTION_GUIDE.md](./DATASET_COLLECTION_GUIDE.md) | How to collect local Perak-specific training dataset |
| [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md) | ML model retraining and continuous learning workflow |
| [SPIKE_RESULTS.md](./SPIKE_RESULTS.md) | Historical: Phase 0 spike findings (archived reference) |

## Project Status

**Current Status:** Mobile App 95%+ Complete & Production-Ready | Focus Shifting to Admin Panel (`apps/admin`)

| Component | Status | Location / Details |
|-----------|--------|---------------------|
| ✅ Mobile App | Complete (95%+) | `apps/mobile` (5 tabs: Home, Activity, Scan, Collect, Profile) |
| ✅ Database & Storage | Complete | `supabase/migrations` (28 migrations, RLS, PostGIS, Realtime) |
| ✅ ML Baseline | Complete | `waste_detector_v0.tflite` (YOLOv8n TFLite CPU) |
| ✅ Edge Functions | Complete | SnapBot GPT-4o-mini, signed proof URLs, private details |
| 🔄 Admin Panel | In Progress | `apps/admin` (Next.js 15: models, feedback review, disputes) |
| ⏸️ Public Dashboard | Planned | `apps/dashboard` (Next.js 15: community stats & open views) |
| ⏸️ ML Pipeline Automation | Planned | GitHub Actions + Kaggle automated training |

## Archive

Historical planning documentation and phase-specific checklists are preserved in [`archive/`](./archive/):
- `archive/phases/`: Checklists for Phase 1 through Phase 10
- `archive/SNAPPICK_PLAN.md`: Original 15-phase master plan
- `archive/SNAPPICK_BUILD_GUIDE.md`: Detailed build instructions
- `archive/SNAPPICK_PREREQUISITE.md`: Initial environment setup
- `archive/UI_UX_SPECIFICATION.md`: Original interface designs

---

**Last Updated:** 2026-11-04
