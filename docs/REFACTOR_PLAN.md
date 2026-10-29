# SnapPick Documentation Refactor Plan

## What I Found

Your codebase is actually in **excellent shape** for Phases 1-10. The mobile app works end-to-end:
- ✅ Authentication (email + Google OAuth)
- ✅ On-device ML waste detection (YOLOv8n TFLite)
- ✅ Scan review with Malaysian SAS guidance
- ✅ SnapBot AI assistant (OpenAI GPT-4o-mini)
- ✅ Pickup request creation with map + geofencing
- ✅ Marketplace map for collectors to claim pickups
- ✅ Complete pickup flow with proof photos
- ✅ Activity tracking and home statistics
- ✅ Feedback capture for model improvement

**The problem:** Documentation is confusing because it describes a **phased** build plan, but you've already built phases 1-10. The docs make it hard to understand what exists vs what's planned.

## What's Actually Missing

1. **Admin Dashboard** (Phase 13) - completely unbuilt
2. **ML Pipeline Automation** (Phase 11) - Python scripts exist, but no automation
3. **Model Delivery/Rollout** (Phase 12) - model update mechanism not built
4. **Your Local Dataset** - still using temporary Kaggle dataset

## Refactor Strategy

### Keep & Simplify:
1. **README.md** - Update to reflect current state (done ✅)
2. **AGENTS.md** - Keep as development rules
3. **ENVIRONMENT.md** - Keep as machine setup reference
4. **ARCHITECTURE.md** (NEW) - Single source of truth for what's built
5. **DEVELOPMENT_GUIDE.md** (NEW) - How to work on the project

### Remove:
- ❌ SNAPPICK_PLAN.md (confusing, too detailed)
- ❌ SNAPPICK_BUILD_GUIDE.md (phase-by-phase no longer relevant)
- ❌ All PHASE-X-CHECKLIST.md files (already done)
- ❌ SNAPPICK_PREREQUISITE.md (merge into DEVELOPMENT_GUIDE)
- ❌ PROGRESS.md (obsolete)
- ❌ UI_UX_SPECIFICATION.md (reference only, too long)

### Keep for Reference:
- ✅ DATASET_COLLECTION_GUIDE.md (still relevant for your local dataset)
- ✅ MODEL_IMPROVEMENT_GUIDE.md (still relevant for retraining)
- ✅ SPIKE_RESULTS.md (historical record)

## New Documentation Structure

```
docs/
  ARCHITECTURE.md          # What's built: database, mobile app, ML pipeline
  DEVELOPMENT_GUIDE.md     # How to: setup, run, test, deploy
  DATASET_COLLECTION_GUIDE.md
  MODEL_IMPROVEMENT_GUIDE.md
  SPIKE_RESULTS.md
  ENVIRONMENT.md
  archive/                 # Move old docs here
    SNAPPICK_PLAN.md
    SNAPPICK_BUILD_GUIDE.md
    SNAPPICK_PREREQUISITE.md
    UI_UX_SPECIFICATION.md
    phases/
```

## What You Need Next

**To continue development, you need:**

1. **Start collecting your local dataset** (see DATASET_COLLECTION_GUIDE.md)
2. **Build ML pipeline automation** (Phase 11) - automate retraining on GitHub Actions
3. **Build Admin Dashboard** (Phase 13) - review feedback, approve models
4. **Build Model Delivery** (Phase 12) - app downloads updated models

I'll now create the clean, accurate documentation.
