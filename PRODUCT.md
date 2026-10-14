# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Residents in Perak who want to sort household waste, check recycling guidance, and coordinate community pickups. The app also serves residents who collect nearby community pickup requests. This audience is derived from the project plan; it has not been separately confirmed by the owner.

## Product Purpose

SnapPick helps residents photograph household waste, receive sorting guidance, request pickup for eligible recyclable materials, and participate in nearby community pickups. Success means residents can understand what to do with an item and complete the supported pickup flow with clear safety and privacy boundaries.

## Positioning

SnapPick combines on-device waste detection with community-coordinated pickups. It is an academic pilot, not an official municipal collection service; local rules and service areas must be verified before public launch.

## Operating Context

The primary workflow is used on Android phones around household waste: sign in, scan a photo or use the camera, review detected items and their condition, and continue into pickup flows where implemented. Users may also browse and claim nearby community requests. The product plan defines Home, Activity, Scan, Request, and Profile destinations.

## Capabilities and Constraints

- Android only; no iOS implementation.
- The current shipped scope through Phase 5 includes authentication, consent, profile/privacy controls, and on-device waste scanning with editable review items.
- The bundled detector has seven fixed labels in order: metal, trash, glass, paper, cardboard, plastic, biological. Hazard declarations remain manual.
- Model behavior is governed by `model_manifest.json`; the bundled 384 x 384 centre-crop fallback remains immutable.
- The app is a community pilot, not an official municipal service. Avoid implying verified local recycling rules or pickup availability.
- Future pickup, dashboard, and continuous-learning capabilities are defined in the plan but are not assumed to be implemented in the current surface.

## Evidence on Hand

- Product and workflow definition: `docs/SNAPPICK_PLAN.md`.
- Implementation and phase contracts: `docs/SNAPPICK_BUILD_GUIDE.md` and `docs/phases/PHASE-1-CHECKLIST.md` through `docs/phases/PHASE-5-CHECKLIST.md`.
- Current app routes and detector implementation: `apps/mobile/src/app/` and `apps/mobile/src/lib/detector/`.
- No user research, pilot outcomes, municipal endorsement, or production-service evidence is recorded in this repository; do not fabricate any.

## Product Principles

- Give practical sorting guidance without presenting uncertain model output as fact.
- Keep hazard handling explicit and manual.
- Preserve privacy boundaries and user consent.
- Make pickup eligibility and its limits understandable.
- Treat local collection rules as configurable and subject to verification.

## Assumptions

- Product facts above are taken from the repository documents because no structured question surface was available in this session; the owner has not separately confirmed inferred audience and success phrasing.
- This redesign is limited to the existing Phase 1–5 screens and does not implement later-phase data, map, request, or statistics behavior.
