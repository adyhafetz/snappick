# SnapPick Dataset Collection Guide

This is the canonical guide for collecting local photos for SnapPick. Use it for owner-collected data and adapt the same privacy and split rules for consented pilot-user uploads. The aim is not merely to accumulate images; it is to create varied, correctly annotated, leakage-free evidence that can improve and fairly evaluate the seven-class detector.

Related documents:

- `docs/MODEL_IMPROVEMENT_GUIDE.md` — how to train, compare, promote, and roll back models.
- `docs/SNAPPICK_PLAN.md` — research design and model gate.
- `docs/SNAPPICK_BUILD_GUIDE.md` — phase implementation requirements.

## 1. Fixed labels and meanings

Use these exact labels and numeric IDs. Do not rename or remap them.

| ID | Label | Include | Useful variations | Exclude or handle carefully |
|---|---|---|---|---|
| 0 | `metal` | Drink/food cans and other metal items consistent with the verified source class | Aluminium/steel appearance, shiny/dull, intact/dented/crushed, labels on/off | Do not guess hidden material. Exclude ambiguous foil/composites until a written annotation decision is approved. |
| 1 | `trash` | Masks, diapers, wrappers, and mixed non-recyclable trash represented by the verified source class | Different wrapper colours/shapes, tied/loose items, small mixed pieces | Never handle unsafe or medical waste for a photo. Do not use `trash` as a catch-all for an uncertain class. |
| 2 | `glass` | Bottles, jars, drinking glasses, and other glass represented by the verified source class | Clear/green/brown, transparent/reflective, labels, lids, intact shapes | Photograph broken glass only without handling it and only if safe; mark condition separately. Do not label clear plastic as glass. |
| 3 | `paper` | Newspapers, magazines, office paper, flyers, and paper bags | White/coloured/printed, flat/folded/crumpled, single sheets/stacks | Beverage cartons and cardboard boxes follow `cardboard`; heavily mixed/laminated items may be excluded if ambiguous. |
| 4 | `cardboard` | Cardboard, boxes, and the milk-carton/box examples represented by the verified source class | Corrugated/thin boxboard, small/large, open/closed/flattened, printed/plain | Keep the source meaning even if local recycling rules differ. Eligibility is decided after detection. |
| 5 | `plastic` | Plastic bottles, tubs, cups, containers, and other plastic represented by the verified source class | Clear/opaque/coloured, rigid/flexible, caps on/off, intact/crushed | Wrappers consistent with the source `trash` class stay `trash`. Do not guess material when it cannot be verified. |
| 6 | `biological` | Food and biological waste represented by the verified source class | Fruit/vegetable scraps, cooked food, peels, mixed safe food remnants | Do not create spoiled or unsafe material for the dataset. Avoid liquids leaking into the scene. |

The label describes visual content, not pickup eligibility. Cleanliness, contamination, breakage, safety, and local acceptance are separate condition/rule fields. Batteries, bulbs, e-waste, chemicals, sharp objects, and other hazards remain manual safety declarations and are not new detector classes.

When an object is genuinely ambiguous, set it aside and record it in an ambiguity log. Do not force a label merely to meet a quota. A small clean dataset is better than a larger mislabeled one.

## 2. Keep three data streams separate

Choose the stream **before** taking a session. Never copy images between streams later.

| Stream | Purpose | Can train on it? | Changes over time? |
|---|---|---:|---|
| Development pool | Training and validation, split by session/group | Yes, except its validation split | Yes; create a new version for each build |
| Golden evaluation set | Fair champion-versus-candidate comparison | **Never** | Frozen once versioned |
| Negatives | Measure/teach when the detector should stay quiet | Training subset plus separate frozen evaluation subset | Versioned |

Golden sessions must use different physical items, arrangements, capture bursts, days, and preferably places from development sessions. Do not place alternate views of the same object/scene in development and golden.

## 3. How much to collect

Count **annotated object instances**, not files. One photo containing three plastic objects contributes three `plastic` instances if all three are boxed. A photo with no target object is one negative photo.

### Milestones

| Milestone | Development instances per class | Golden instances per class | Negatives | What it supports |
|---|---:|---:|---:|---|
| Pipeline proof | 50 | 20 | 30 | Exercises annotation, training, evaluation, and rejection/promotion flow; not a strong final model |
| First useful local candidate | 150 | 30 | 50–100 | Early local fine-tuning and per-class diagnosis |
| Recommended FYP experiment | 300+ | 50+ | 100–200 | More credible per-class comparison and variation coverage |
| Expand weak classes | Add 100–200 | Keep golden frozen | Add confusing negatives as found | Address measured errors without contaminating golden |

For the recommended target, collect at least 2,100 development instances (300 × 7) plus 350 golden instances (50 × 7). If development photos average 1.5 valid objects, this is roughly 1,400 development photos; actual photo count will vary. Multi-object scenes help, but do not pack scenes unnaturally just to reduce the file count.

For each class at the recommended target, aim for at least 20 distinct physical examples or visibly different item types/brands/shapes. More object diversity is better than many nearly identical frames of one item. Limit near-identical burst frames; normally keep the best one or two unless the views are meaningfully different.

### Suggested development/validation split

Split by session/scene group after collection:

- approximately 80% of development instances for training;
- approximately 20% for validation/early stopping;
- zero golden images in either group.

Balance at the group level as closely as practical. Do not move individual near-duplicate images across groups to perfect the counts.

## 4. Variation plan

Use the table as a coverage checklist per class. Percentages are approximate and may overlap; a photo can satisfy several dimensions. Do not manufacture exact percentages at the cost of natural scenes.

| Dimension | Recommended coverage |
|---|---|
| Lighting | 30% daylight, 25% bright indoor, 20% warm/evening, 15% shadow/backlight, 10% safely dim/challenging |
| Background | 20% plain, 25% table/counter, 20% floor, 15% bin/recycling area, 10% outdoor/gate, 10% cluttered household scene |
| Apparent size | 30% close/large, 40% normal scan distance, 20% small/distant, 10% partly cut by frame edge |
| View angle | 25% front/side, 25% top-down, 35% oblique, 15% low/unusual but realistic angle |
| Scene composition | 35% single object, 20% multiple same-class objects, 30% mixed detector classes, 15% partial occlusion/clutter |
| Condition | About 50% clean/intact, 25% folded/crumpled/dented/flattened where relevant, 15% safely dirty/food-marked, 10% other realistic condition |
| Placement | Upright, sideways, stacked, inside/near a bag without being invisible, near image centre, near edges |
| Camera | Primary target phone for most images; add another Android phone/camera for 20–30% if available |
| Orientation | Mostly the orientation used by the app, plus a smaller set of landscape/rotated captures to verify EXIF correction |

For transparent and reflective items (`glass`, some `plastic`, shiny `metal`), deliberately vary reflections, backlighting, patterned backgrounds, and similar-looking materials. For flat classes (`paper`, flattened `cardboard`), vary folds, stacks, overlap, and perspective. For `trash` and `biological`, vary safe appearances without staging unhygienic scenes.

### Mixed scenes

Mixed scenes are important because the app supports multiple detections. Include:

- two or three classes separated clearly;
- overlapping items with each still recognizable;
- repeated instances of one class;
- target objects beside common non-target household objects;
- objects near the crop boundary, because M0 analyses the centre square;
- some full-photo edge objects for the later letterbox experiment.

Do not make all training photos neat tabletop product shots. Include realistic kitchen, storage, recycling, and household clutter while respecting privacy.

## 5. Negative photos

Negatives contain **none of the seven target classes**. They are needed because a detector must learn and be tested on when to return no boxes.

Collect easy and hard negatives:

- empty tables, floors, counters, bags, shelves, and rooms;
- toys, tools, plants, furniture, clothes, shoes, cables, electronics, ceramics, wood, and food-free plates;
- objects visually similar to targets, such as ceramic cups versus glass/plastic cups, colourful packages, reflective appliances, round containers made from excluded materials, and printed patterns;
- blurred, dim, backlit, cluttered, and unusual-angle scenes that are still valid phone photos.

If any target-class object appears—even small in the background—the photo is not a true negative. Either annotate every visible target instance and move it to the appropriate development/golden session, or retake the negative.

Keep a frozen negative evaluation subset separate from negatives used during training.

## 6. Capture-session procedure

1. Decide `development`, `golden`, or `negative` before starting.
2. Create a random session ID such as `TR_S001`, `GD_S001`, or `NG_S001`. Do not encode a user name, address, or exact location.
3. Choose the planned classes and missing variation cells. Avoid repeatedly photographing what is already overrepresented.
4. Inspect the scene for private or unsafe content.
5. Use the normal phone camera/app flow at original resolution. Do not apply beauty filters, artificial blur, stickers, colour filters, or manual crops.
6. Take deliberate photos rather than long bursts. Change distance, angle, arrangement, lighting, or background between retained shots.
7. Review immediately and remove accidental duplicates, unusable blur, exposure failures, or privacy violations. Do not delete difficult but valid images merely because M0 misses them.
8. Record a privacy-safe session log and copy files into the correct git-ignored folder.
9. Back up raw data securely. Generate sanitized working copies for annotation/training; do not destructively edit the only originals.

Suggested folder layout:

```text
ml/data/local/
  inbox/
  development/raw/TR_S001/
  development/annotations/
  golden/v1/raw/GD_S001/
  golden/v1/annotations/
  negatives/train/
  negatives/evaluation/v1/
  manifests/
  logs/
```

Everything under `ml/data/` remains git-ignored. Commit only privacy-safe schemas, scripts, aggregate manifests, hashes, and documentation.

### Session log fields

Use fields such as:

```text
session_id,split_purpose,capture_date,broad_setting,lighting,phone_model,planned_classes,photo_count,notes,consent_basis,privacy_reviewed
```

`broad_setting` may be `indoor_kitchen`, `indoor_storage`, or `outdoor_gate`; never store an address or exact coordinates. For pilot users, use an anonymous random session ID, not their account ID.

## 7. Privacy, consent, and safety

- Photograph only your own items or items whose owner agreed to the stated dataset use.
- Pilot-user images require the separate, revocable **Help improve SnapPick** opt-in and the project retention policy. Storage consent alone is not training consent.
- Exclude faces, children, body parts that could identify someone, identity documents, mail labels, receipts with personal details, vehicle plates, house numbers, computer/phone screens, family photos, and distinctive private interiors when practical.
- Never store user IDs, names, addresses, notes, exact coordinates, or pickup details in filenames, annotations, manifests, logs, notebooks, or experiment trackers.
- Strip EXIF/GPS from working/exported copies and user uploads. Keep raw owner-collected originals in access-controlled storage only when genuinely needed.
- Do not handle broken glass, biological hazards, medical waste, sharp metal, chemicals, batteries, or spoiled waste merely to obtain a photo. Use gloves/tongs and normal hygiene where appropriate; safety overrides quotas.
- If an image fails privacy or consent review, quarantine and delete it according to the retention policy rather than trying to crop around the problem for convenience.

## 8. Annotation rules

Annotate in Label Studio or CVAT and export standard YOLO bounding boxes only after confirming the current tool/export behavior.

- Draw a tight box around the visible extent of every recognizable instance of the seven classes.
- Annotate all target objects in a positive image, including background targets that meet the visibility rule. Missing boxes teach the model that visible targets are background.
- One physical object gets one box even when it has multiple parts. Separate physical objects get separate boxes.
- For partial occlusion or truncation, box the visible extent if the class is still confidently recognizable. If it cannot be labeled confidently, mark it for review/exclusion rather than guessing.
- Very tiny objects that cannot be consistently recognized at the intended inference resolution may be marked `ignore` in the annotation workflow or excluded according to one documented rule; do not apply the rule inconsistently by class.
- A damaged item keeps its visual class (`glass`, `metal`, and so on). Damage/unsafe condition belongs in metadata or product review, not a new detector label.
- Do not draw boxes around manual-only hazards as if they were detector classes. If they create ambiguity or danger, reject the image.
- Review class ID/order after every export. Many tools may reorder names alphabetically; reject or correct the export before training if the numeric mapping changes.

### Annotation quality control

- First pass: annotator boxes and labels all targets.
- Second pass: reviewer checks every golden image and at least 20% of development images, with 100% review of ambiguous/rare classes.
- Run automated checks for invalid/out-of-range boxes, empty positive labels, unknown class IDs, duplicate filenames/hashes, extreme tiny boxes, and class imbalance.
- Visually sample at least 50 boxes per class after YOLO export to catch ID-order and coordinate mistakes.
- Resolve disagreements in an annotation-decision log and apply the rule consistently to existing data.

## 9. Golden-set rules

The golden set must be harder to contaminate than ordinary test data:

- collect it in dedicated `GD_` sessions using objects/scenes excluded from development;
- include the same variation dimensions as real use, not only clean single objects;
- annotate and review every image;
- freeze file hashes, annotation hashes, class counts, and session IDs in a versioned manifest;
- never use golden images for training, augmentation, early stopping, threshold tuning, manual candidate selection, or reference-image debugging;
- compare champion and candidate on the identical golden version;
- if it is accidentally used in training, retire that golden version and create a new independent one;
- when expanding golden, create `v2` and re-evaluate both champion and candidate on `v2`; preserve `v1` results for audit.

Do not repeatedly inspect individual golden failures and then recreate those exact scenes for training. Use aggregate failure categories (for example, “transparent glass under backlight”) to collect new independent training sessions.

## 10. Pre-training quality report

Before a dataset version is accepted, generate and review:

- image and annotated-instance count by split and class;
- count of distinct sessions and physical-item groups where recorded;
- variation coverage summary;
- empty/corrupt image and annotation results;
- duplicate and near-duplicate report within and across splits;
- box-size/aspect-ratio distributions and example mosaics per class;
- consent, privacy-review, source, and licence summary;
- list of ambiguous/excluded images and reasons;
- frozen manifest hash.

Stop the build if any golden/development leakage, unknown class, label-order change, missing consent, privacy violation, or material annotation error is found.

## 11. Collection checklist

### Before a session

- [ ] Stream chosen: development, golden, or negative.
- [ ] Anonymous session ID created.
- [ ] Missing classes/variations identified from current counts.
- [ ] Physical items are not used in another stream.
- [ ] Consent and safe handling confirmed.
- [ ] Scene checked for personal information.

### After a session

- [ ] Original files preserved at full resolution.
- [ ] Blurry/exposure failures and accidental bursts reviewed.
- [ ] Privacy/consent review passed.
- [ ] Files placed only in the assigned stream/session folder.
- [ ] Session log completed without identifying fields.
- [ ] Backup completed.
- [ ] Class instance counts and variation coverage updated after annotation.

### Before training

- [ ] Exact seven-label order verified after export.
- [ ] Every visible target in positive images is boxed or handled by the documented ignore rule.
- [ ] Golden images/sessions absent from train and validation.
- [ ] Cross-split exact and perceptual duplicate checks passed.
- [ ] Annotation QC and aggregate dataset report passed.
- [ ] Dataset manifest frozen and hashed.

## 12. Assumptions and practical limits

- The seven smoke-app labels and their visually verified meanings are authoritative for this project.
- Counts are starting targets, not a promise of accuracy. Variety, annotation quality, and independent evaluation matter more than raw volume.
- Per-class metrics may remain unstable at 20–30 golden instances; 50+ is the minimum final target, and confidence intervals should be reported.
- A single photo may contain several instances, so image counts cannot replace instance counts.
- The temporary source dataset may differ from Perak household scenes; local collection exists specifically to measure and reduce that domain gap.
