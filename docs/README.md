# SnapPick Documentation

Welcome to SnapPick! This folder contains all technical documentation for the project.

## Quick Start

- **New to the project?** Read [ARCHITECTURE.md](./ARCHITECTURE.md) first
- **Setting up locally?** Follow [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- **Want to contribute?** Check [../AGENTS.md](../AGENTS.md) for development rules

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, database schema, app structure, what's built |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Setup, running tests, common tasks, troubleshooting |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Machine setup, installed versions, toolchain reference |
| [DATASET_COLLECTION_GUIDE.md](./DATASET_COLLECTION_GUIDE.md) | How to collect local Perak-specific training dataset |
| [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md) | ML model retraining workflow (manual) |
| [SPIKE_RESULTS.md](./SPIKE_RESULTS.md) | Historical: Phase 0 spike findings (archived) |

### Internal

| Document | Description |
|----------|-------------|
| [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) | Documentation refactor decisions (2026-10-30) |

## Project Status

**Current:** Phases 1–10 Complete (Mobile app production-ready)

| Component | Status |
|-----------|--------|
| ✅ Mobile App | Production-ready (5 tabs, ML, pickups, SnapBot AI) |
| ✅ Database | All tables, RLS, geofencing, auto-jobs |
| ✅ ML Model | Temporary Kaggle baseline (YOLOv8n TFLite) |
| ✅ Edge Functions | SnapBot, proof URLs, notifications |
| ⏸️ ML Automation | Manual workflow (Phase 11 pending) |
| ⏸️ Model Delivery | Not implemented (Phase 12 pending) |
| ❌ Admin Dashboard | Not built (Phase 13 pending) |

## What's Next?

1. **Collect local dataset** (see DATASET_COLLECTION_GUIDE.md)
2. **Build ML pipeline automation** (Phase 11: GitHub Actions + Kaggle)
3. **Build admin dashboard** (Phase 13: Next.js app)
4. **Implement model delivery** (Phase 12: OTA updates)

## Archive

Old documentation moved to [`archive/`](./archive/) for reference:
- Build guides for completed phases
- UI/UX specifications
- Prerequisite setup (merged into DEVELOPMENT_GUIDE)
- Phase-by-phase checklists

---

**Last Updated:** 2026-10-30
