# Product

<!-- impeccable:product-schema 1 -->

## Platform

Android (React Native / Expo SDK 57 new architecture, API 35–37 target).

## Users

1. **Residents in Perak, Malaysia:** Photograph household waste, receive instant Community Recycling Guidelines sorting and preparation advice, request community pickups within supported Perak district boundaries, confirm or dispute collections, rate collectors, and track real recycling impact stats.
2. **Community Collectors:** Browse nearby pickup requests on an interactive MapLibre map with privacy-masked 0.01° grid pins and realtime updates, claim jobs (up to 3 active jobs), preview driving routes, launch native navigation (Google Maps / Waze), complete collections with proof photo submission, and rate requesters.
3. **Project Administrator / Research Lead:** Governs retraining triggers, evaluates candidate detector models against the frozen golden dataset, manages staged OTA rollouts, resolves disputes, and monitors continuous learning performance.

## Product Purpose

SnapPick bridges on-device computer vision and community-coordinated recycling pickups under local Community Recycling Guidelines. It empowers residents to sort waste correctly, reduces contamination through verified collections, and powers an academic continuous-learning loop where consented, verified images systematically improve the on-device detector.

## Positioning

SnapPick combines fast offline on-device waste detection with community coordination and continuous machine learning. It is an academic Final Year Project (FYP) pilot focused on Perak, adhering strictly to privacy by design (exact coordinates masked to 0.01° grid cells; images stripped of all EXIF/GPS metadata). It is a community pilot and not an official municipal or statutory collection scheme.

## Operating Context

The five main navigation destinations:
- **Home:** Personal recycling impact statistics (`total_scans`, `verified_recyclable_items`, `active_requests`), offline cached status, latest Perak Eco News stream, primary scan action, and SnapBot AI assistant modal with cached responses.
- **Activity:** Dual-tab management for "My Requests" (with cancellation, detail modal, proof photo viewing, confirmation, dispute modal, and collector rating) and "Claimed Pickups" (with Start, Release, route preview & turn-by-turn navigation handoff, streamlined collection completion, and requester rating).
- **Scan:** 3-step on-device waste scanning flow:
  1. *Review:* Camera/gallery capture, YOLOv8n TFLite inference (CPU delegate), bounding boxes, condition classification, and item review/editing.
  2. *Guidance:* Material-specific animated preparation guides (WebP animations) and safety verification checklist.
  3. *Schedule:* Interactive MapLibre pin placement with reverse geocoding to 13 Perak district boundaries, material summary selection, and pickup time window scheduling.
- **Collect:** Interactive MapLibre collector marketplace with realtime broadcast updates (`pickup-marketplace` channel), 0.01° grid cell clustering, request detail inspection, current location centering, and one-tap claim action (max 3 concurrent jobs).
- **Profile:** Account management (display name, phone number), Google OAuth linking, privacy & consent toggles (image storage consent, safety acknowledgment, continuous learning opt-in), OTA detector model update checking and remote model activation, and complete account deletion.

## Capabilities and Constraints

- **Android only:** No iOS code, CoreML, or APNs.
- **Detector taxonomy:** Seven fixed labels in immutable order: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`. Hazardous materials (batteries, bulbs, chemicals, e-waste) remain mandatory manual declarations.
- **Model manifest contract:** Detector parameters (layout, input size, output format, thresholds) are strictly driven by `model_manifest.json` and validated against tensor shapes.
- **Privacy by design:** Exact coordinates exist only in `pickup_request_private_details` accessed via authorized Edge Functions. Public marketplace surfaces only grid-snapped coordinates (`ST_SnapToGrid(p, 0.01)`). All uploaded images are client-side downsampled to 800px max and stripped of EXIF/GPS metadata.
- **Streamlined collection flow:** Collectors can complete pickups in 1 tap by uploading an EXIF-stripped proof photo, or report non-collection reasons (`contaminated`, `missing`, `unsafe`, `access_issue`, `other`). Requesters have a 48-hour confirmation window before auto-completion.
- **Continuous learning pipeline:** Opted-in scans with active-learning signals (uncertain confidence 0.40–0.79, user corrections, collector count matches, 5% random baseline) feed the dataset via label tiers (A/B/C/D), gated retraining, and automated evaluation against a frozen golden evaluation set.

## Product Principles

- **Guidance integrity:** Provide clear, practical household sorting and preparation instructions under Community Recycling Guidelines without asserting uncertain detector predictions as fact.
- **Privacy by default:** Never expose exact user locations, names, phone numbers, or metadata to unauthorized parties or public views.
- **Robust offline resilience:** Enable offline detection, cached home statistics, and persistent background upload queues that drain automatically upon reconnect.
- **Transparent model lifecycle:** Bundled baseline fallback (v0) is immutable; new models deploy only after automated regression testing against frozen golden sets and staged OTA delivery.
