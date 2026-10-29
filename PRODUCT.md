# Product

<!-- impeccable:product-schema 1 -->

## Platform

Android (React Native / Expo SDK 57 new architecture, API 35–37 target).

## Users

1. **Residents in Perak, Malaysia:** Photograph household waste, receive instant Community Recycling Guidelines sorting and preparation advice, request community pickups within supported Perak district boundaries, and track real recycling impact stats.
2. **Community Collectors:** Browse nearby pickup requests on an interactive map with privacy-masked 0.01° grid pins, claim jobs (up to 3 active jobs), preview driving routes, launch native navigation, complete collection checklists, and upload verification photo proofs.
3. **Project Administrator / Research Lead:** Governs retraining triggers, evaluates candidate detector models against the frozen golden dataset, resolves disputes, and monitors continuous learning performance.

## Product Purpose

SnapPick bridges on-device computer vision and community-coordinated recycling pickups under local Community Recycling Guidelines. It empowers residents to sort waste correctly, reduces contamination through verified collection checklists, and powers an academic continuous-learning loop where consented, verified images systematically improve the on-device detector.

## Positioning

SnapPick combines fast offline on-device waste detection with community coordination and continuous machine learning. It is an academic Final Year Project (FYP) pilot focused on Perak, adhering strictly to privacy by design (exact coordinates masked to 0.01° grid cells; images stripped of all EXIF/GPS metadata). It is a community pilot and not an official municipal or statutory collection scheme.

## Operating Context

The five main navigation destinations:
- **Home:** Real personal recycling impact statistics (`total_scans`, `verified_recyclable_items`, `active_requests`), offline cached status, primary scan action, and SnapBot AI assistant modal with cached responses.
- **Scan:** On-device camera/gallery waste scanning with YOLOv8n TFLite (CPU delegate), bounding boxes, condition classification, instant visual preparation guide cards (720p animated WebP), and direct flow into Pickup Request.
- **Request:** Interactive MapLibre pin placement with reverse geocoding to 13 Perak district boundaries, material summary selection, pickup time window scheduling, and immediate transition to Collector Marketplace for collectors.
- **Activity:** Dual-tab management for "My Requests" (with cancellation, proof viewing, confirmation, dispute, and relist actions) and "Pickups I Claimed" (with Start, Release, route preview, and completion checklist handoff).
- **Profile:** Account management, Google OAuth linking, privacy & consent toggles (storage consent, safety acknowledgment, continuous learning opt-in), and cache flushing.

## Capabilities and Constraints

- **Android only:** No iOS code, CoreML, or APNs.
- **Detector taxonomy:** Seven fixed labels in immutable order: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`. Hazardous materials (batteries, bulbs, chemicals, e-waste) remain mandatory manual declarations.
- **Model manifest contract:** Detector parameters (layout, input size, output format, thresholds) are strictly driven by `model_manifest.json` and validated against tensor shapes.
- **Privacy by design:** Exact coordinates exist only in `pickup_request_private_details` accessed via authorized Edge Functions. Public marketplace surfaces only grid-snapped coordinates (`ST_SnapToGrid(p, 0.01)`). All uploaded images are client-side downsampled to 800px max and stripped of EXIF/GPS metadata.
- **Continuous learning pipeline:** Opted-in scans with active-learning signals (uncertain confidence 0.40–0.79, user corrections, collector count matches, 5% random baseline) feed the dataset via label tiers (A/B/C/D), gated retraining, and automated evaluation against a frozen golden evaluation set.

## Product Principles

- **Guidance integrity:** Provide clear, practical household sorting and preparation instructions under Community Recycling Guidelines without asserting uncertain detector predictions as fact.
- **Privacy by default:** Never expose exact user locations, names, phone numbers, or metadata to unauthorized parties or public views.
- **Robust offline resilience:** Enable offline detection, cached home statistics, and persistent background upload queues that drain automatically upon reconnect.
- **Transparent model lifecycle:** Bundled baseline fallback is immutable; new models deploy only after automated regression testing against frozen golden sets.
