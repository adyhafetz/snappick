# SnapPick Brand Identity & Design System

> **Version:** 1.0.0  
> **Source of Truth:** [`BRAND_INDENTITY.svg`](./BRAND_INDENTITY.svg)  
> **System:** SNAPPICK / IDENTITY SYSTEM / 2026  
> **Brand Vision:** *"A naturally smarter identity. Smart recycling & pickup VISUAL SYSTEM / 01.0"*  
> **Taglines:** *"Circular by nature. Forward by design."* · *"Small action. Circular impact."*

---

## 1. Brand Foundations & Signature

SnapPick is an eco-centric, community-driven civic platform built for Perak, Malaysia. The visual aesthetic is **organic minimalism**—balancing clean, modern utility with a warm, natural feel.

### 01 / Primary Signature (Horizontal Lockup)
- **Emblem:** A confident circular emblem featuring three rising leaf veins—an expression of renewal, effortless movement, and a connected circular economy.
- **Wordmark:** **SnapPick** set in **Roboto Black (900)** with tight `-4.5%` letter tracking and capitalized **S** and **P**.
- **Cohesion Rule:** The horizontal signature leads across product and communications. Keep the emblem and tightly spaced wordmark together as one clear, recognizable unit.

### 02 / Signature Contexts & Standards
| Variant | Background Context | Emblem Color | Wordmark Color | Assets |
|---------|-------------------|--------------|----------------|--------|
| **Light / Full Colour** | Eco Canvas (`#f5f7f2`) / White (`#ffffff`) | Primary Brand Green (`#19806d`) | Deep Slate Ink (`#183e48`) | `logo-full.svg`, `logo-full.png` |
| **Dark / Reversed** | Deep Slate Ink (`#183e48`) | Primary Brand Green (`#19806d`) | Pure White (`#ffffff`) | `logo-full-dark.svg` |
| **Symbol Only (Emblem)** | App icons, nav headers, elevated avatars | Primary Brand Green (`#19806d`) | N/A | `logo.svg`, `logo.png` |
| **App Icon** | Rounded rect badge (`rx="38"` on 148×148) | Single familiar silhouette inside container. **No wordmark inside app badge.** | N/A | Android/iOS launcher icons |

### Clear Space & Minimum Sizing
- **Clear Space:** Maintain at least `¼` emblem diameter of breathing room around every signature.
- **Minimum Size:**
  - Emblem alone: minimum `24px` height.
  - Horizontal lockup: minimum `120px` width.

---

## 2. Color Palette & Purposeful Tokens

SnapPick adheres to a restrained eco-tech palette of **six purposeful tokens** from `BRAND_INDENTITY.svg`. We lead with neutral space and brand green, using amber sparingly to signal meaningful moments.

### The Six Core Brand Tokens

| Token Identifier | Color Name | Hex Code | Role & Application |
|------------------|------------|----------|---------------------|
| `brand.primary` | **Primary Brand Green** | `#19806d` | Primary brand presence, primary buttons, active states, key interactive actions |
| `content.ink` | **Deep Slate Ink** | `#183e48` | Primary typography, deep headings, dark reversed containers |
| `brand.pressed` | **Forest Green Dark** | `#126253` | Pressed button states, active hover emphasis, dark accents |
| `accent.reward` | **Accent Amber** | `#e7b73e` | Reward badges, rating stars, verification highlights (use sparingly) |
| `surface.canvas` | **Eco Canvas / Light Neutral** | `#f5f7f2` | Warm sage-tinted app canvas and default screen background |
| `surface.soft` | **Soft Mint Surface** | `#e8efe9` | Cards, subtle grouping, active icon container backdrops, input backgrounds (`bg-secondary/40`) |

### Semantic & Extended Tokens

| Role | Hex | Background Tint | Border | Usage |
|------|-----|-----------------|--------|-------|
| **Surface / Card** | `#ffffff` | `bg-card` | `#d9e2dc` (`border-border/80`) | Main elevated card surfaces |
| **Muted Slate** | `#5b7072` | N/A | N/A | Secondary body copy, timestamps, inactive icons |
| **Success / Completed** | `#16a34a` | `#e8efe9` (`bg-emerald-500/10`) | `border-emerald-500/25` | Completed pickup badges |
| **Active / In Progress** | `#2563eb` | `#eff6ff` (`bg-blue-500/10`) | `border-blue-500/25` | In-progress requests, GPS location |
| **Pending / Review** | `#e7b73e` / `#b45309` | `#f8f0d8` (`bg-amber-500/10`) | `border-amber-500/25` | Pending requester verification |
| **Disputed / Danger** | `#b42318` | `#fef3f2` (`bg-rose-500/10`) | `border-rose-500/25` | Error alerts, disputed pickup requests |

---

## 3. Typography: The SnapPick Typeface

> **Typeface:** **Roboto**  
> *"A single family for a connected experience — clear, at every scale."*

SnapPick uses **Roboto** across mobile and web interfaces. It combines geometric structure with friendly, open curves, ensuring optimal legibility from compact status pills to high-impact display titles.

### Wordmark Standard
- **Family:** Roboto
- **Weight:** Black (`900`)
- **Tracking:** Tight `-4.5%` (`tracking-tight`)
- **Casing:** Capital **S** and **P** (`SnapPick`)
- **Rule:** Keep text editable; never stretch, outline, or retype in another typeface family.

### Hierarchy & Scale

| Style Level | Spec (Font Size / Line Height · Weight) | Example Content / Role | Web & Mobile Tailwind Mapping |
|-------------|----------------------------------------|------------------------|-------------------------------|
| **Display** | `48 / 52 · Black 900` | *"A cleaner tomorrow."* | `text-5xl font-black leading-tight text-ink` |
| **Heading** | `32 / 38 · Bold 700` | *"Recycling, made simple."* | `text-3xl font-black tracking-tight text-foreground` |
| **Title** | `24 / 30 · Bold 700` | *"Your next pickup is on its way."* | `text-2xl font-bold tracking-tight text-foreground` |
| **Body** | `18 / 27 · Regular 400` | *"Snap a photo. Sort it right. We'll take care of the rest."* | `text-base text-foreground leading-relaxed` |
| **Label** | `12 / 16 · Bold 700` | *"PICKUP CONFIRMED"* | `text-xs font-bold uppercase tracking-wider text-muted-foreground` |
| **Status Pill** | `11 / 14 · Bold 700` | Status badges (`Pending`, `Confirm Pickup`) | `text-[11px] font-bold tracking-tight` |

---

## 4. Components & Spatial Structure

### Border Radius Scale
- **`rounded-3xl` (24px):** Hero action cards (Scan Waste, SnapBot), impact metric cards, authentication cards, bottom sheet modal tops.
- **`rounded-2xl` (16px):** Primary buttons (`h-12`), input fields (`h-12`), list item cards, elevated icon backdrops.
- **`rounded-xl` (12px):** Small buttons (`h-9`), checklist rows, select dropdowns.
- **`rounded-full` (9999px):** Status badges, circular logo marks, user avatar circles, tab indicators.

### Card Pattern
All cards use subtle framing rather than heavy drop shadows:
```tsx
<View className="rounded-3xl bg-card border border-border/80 shadow-xs p-5">
  {/* Card Content */}
</View>
```

### Button Patterns
- **Primary Action:**
  `h-12 px-5 rounded-2xl bg-primary text-white font-bold text-base shadow-sm active:scale-[0.98]`
- **Secondary / Outline:**
  `h-12 px-5 rounded-2xl border border-border bg-card text-foreground font-bold active:scale-[0.98]`
- **Destructive:**
  `h-12 px-5 rounded-2xl bg-destructive text-white font-bold active:scale-[0.98]`
- **Small Action:**
  `h-9 px-3.5 rounded-xl font-bold text-xs`

---

## 5. Iconography & Visual Language

SnapPick uses **Lucide icons** exclusively for crisp geometric alignment.

### Styling Rules
- **Active / Primary Focus:** `strokeWidth={2.4}`
- **Standard / Inactive:** `strokeWidth={1.8}`
- **Micro Badges:** `strokeWidth={1.5}` to `2.0`
- Standalone icons are placed in soft rounded container backdrops (`rounded-2xl` or `rounded-full`) with a 10% opacity tint of the respective brand color.

### Core Assignments
- **Navigation Tabs:** Home (`<Home />`), Activity (`<History />`), Scan (`<ScanLine />`), Collect (`<MapPin />`), Profile (`<User />`)
- **Waste Materials:** Plastic (`<Milk />`), Cardboard (`<Package />`), Paper (`<FileText />`), Glass (`<Wine />`), Metal (`<Cylinder />`), Trash (`<Trash2 />`), Biological (`<Leaf />`)
- **Actions & Status:** Navigation (`<Navigation />`), Proof Camera (`<Camera />`), SnapBot AI (`<Bot />`), Rewards (`<Star />`), Verification (`<CheckCircle2 />`), Warning (`<AlertTriangle />`)

---

## 6. Voice, Tone & Microcopy Standards

| Concept | ✅ Approved Term | ❌ Prohibited Term | Rationale |
|---------|------------------|-------------------|-----------|
| Collector Tab | **Collect** | Request, Browse, Jobs, Tasks | Action-oriented community collector role |
| Pickup Entity | **Pickup Request** / **Pickup** | Order, Ticket, Booking | Emphasizes mutual community civic initiative |
| Claiming | **Claim** / **Claimed** | Accept, Assign, Reserve | "Claim" implies volunteer initiative & accountability |
| Proof | **Proof Photo** | Delivery photo, Evidence, Receipt | Clear, factual, client-side EXIF stripped |
| Issue Resolution | **Dispute** | Complaint, Report Abuse, Ticket | Standard mutual verification terminology |
| AI Assistant | **Ask SnapBot** | AI Chatbot, LLM Prompt, Robot | Warm, approachable character |
| Personal Stats | **Your Impact** | Metrics, KPIs, Analytics | Inspiring personal connection to civic progress |
| Awaiting Step | **Confirm Pickup** (requester) / **Waiting for Confirmation** (collector) | Review, Pending Requester, On Hold | Says who acts next |
| Ended without pickup | **Not Collected** (amber), **Expired** (grey), button **Request Again** | Disputed, Relist, Find another collector | Red is only for **Disputed** |
| Collector can't finish | **Couldn't Collect** | Report Issue, Unable to collect | Plain reason choices: Items Missing, Dirty or Unsafe, Couldn't Reach the Place |
| Safety Warning | **Safety Declaration** | Banned Items, Prohibited Waste | Proactive safety guidance over punitive restriction |
| Collector's list | **Claimed Pickups** | Claimed Tasks, Jobs | Same word as the Collect tab and the Claim button |
| When a pickup happens | **Pickup Time** | Schedule Window, Collection Window | Says what the user chooses |
| Home impact numbers | **Scans**, **Recyclables**, **Open Pickups** | Total Scans, Verified Items, Active Pickups | Short and literal |
| The waste model | **Detector** ("the built-in detector", "a newer detector") | Model, AI model, base model, candidate | Used in the app and admin; "AI Model Training" stays as the name of the consent switch |
| Model quality (admin) | **Accuracy** (and "points compared with the one in use") | mAP, pts vs live | mAP50 appears only in the upload field, as the technical name |
| Photo storage | **Photo Backup** (the same name on the consent screen, Profile and every message) | Cloud Storage, Cloud Photo Sync, Sync | Name the place: "stay on this phone" |
| Privacy of photos | **Location and hidden photo details removed** | Metadata, EXIF, tags stripped | Says what it means for the user |
| Dashboard rate | **Requests collected**, "usually claimed within N hours" | Completion rate, median | The PDF report keeps "median" with a definition, because it is a formal document |

---

Version names are always lowercase (`v0`, `v1`), never `V0`. Empty states say what is missing and when it will appear, in one or two plain sentences, instead of a bare "No data".

## 7. Platform Specifics (Mobile & Admin)

1. **Mobile App (`apps/mobile`)**:
   - Header features the centered horizontal lockup (`logo-full.png` / `logo-full.svg`, `154×32`).
   - Auth screens feature the standalone circular emblem (`logo.png`, `72×72`) with natural vertical breathing room (`mb-7`, `marginBottom: 20`).
   - **Launcher icon and notification icon** fill the whole icon shape: the three-vein leaf mark in Eco Canvas on a Primary Brand Green background (no circle, no wordmark, no dark variant). The splash screen shows the full circular emblem in green on Eco Canvas. Files in `apps/mobile/assets/images`: `icon.png`, `android-icon-foreground.png` (adaptive icon; its background colour `#19806D` is set in `app.json`), `android-icon-monochrome.png` (themed icons), `splash-icon.png`, and `notification-icon.png` (white leaf, tinted `#19806d`). They are generated from `logo.svg`. Changing them needs `npx expo prebuild --platform android` and a native rebuild.
2. **Admin Panel (`apps/admin`)** follows the same minimalist style as the mobile app:
   - Eco Canvas background (`#f5f7f2`), Deep Slate Ink text (`#183e48`), white `rounded-3xl` cards with a light border.
   - Short page titles with no subtitles; small icon buttons for refresh and export; one primary action per page (for example Retrain).
   - A left navigation (Overview, Dataset, Models, Disputes) where the active item has a soft green tint; the same segmented tab control as the mobile Activity screen.
   - Status pills use the same token colours as the mobile app (amber for review, red for disputed or upheld, green for live or confirmed).
   - The sign-in page shows the standalone circular emblem.

## 8. Naming and page titles

- The product is always written **SnapPick** (capital S and P, one word). The Android app name is "SnapPick".
- **Website** page titles use `SnapPick | <Page>`, for example "SnapPick | Dashboard"; the home page is just "SnapPick". The tab icon is the emblem (`/brand/logo.svg`).
- **Admin** page titles use `SnapPick Admin | <Page>`, for example "SnapPick Admin | Models" (pages: Overview, Dataset, Models, Disputes, Sign in). The tab icon is the emblem (`apps/admin/public/logo.svg`), the sidebar shows the horizontal lockup, and the sign-in and access-denied screens show the emblem.

## 9. Motion

One small motion system, the same in the website, admin and mobile app. Motion explains what changed; it never decorates. Every animation is switched off when the person prefers reduced motion (website and admin: a global CSS rule plus checks in the counters; mobile: Reanimated's default `ReduceMotion.System` and `useReducedMotion`).

| Token | Duration | Easing | Used for |
|---|---|---|---|
| **Press** | 150 ms | `cubic-bezier(.2,.7,.2,1)` | A slight shrink (to 97 to 98%) while a button or card is pressed |
| **Appear** | 250 ms | same | Content fades in and rises 8 px; list rows follow one another 70 ms apart (at most 5 steps, so long lists do not drag) |
| **Moment** | 500 ms | ease-out | Only for things that matter: a key number counting to its new value, a bar growing to its new length |

Rules:
- No new looping animations. The only loop is SnapBot's calm idle bounce on the dashboard.
- Animate when something changes or first appears, not on every render. Content already on screen at page load is not re-animated.
- Numbers always land on the real value, even if the animation is interrupted or the window is in the background.

Tools: **CSS (Tailwind)** for press, appear on load and bars, because they are short single transitions. **GSAP** (website and admin, pinned to 3.15.0) for anything sequenced or scroll-driven: number count-ups, scroll reveals (ScrollTrigger) and SnapBot's flight on the dashboard (one timeline: fly, think, type). **React Native Reanimated** for all mobile motion. Do not add another animation library.

Where it lives:
- **Website** (`apps/web`): `src/lib/motion.ts` (tokens, `setupGsap()` which registers ScrollTrigger and the `brand` ease, `useCountUp`), `src/components/CountUp.tsx`, `src/components/RevealOnScroll.tsx` (GSAP ScrollTrigger for elements marked `data-reveal`), `src/components/CardGuide.tsx` (SnapBot timeline), the `animate-appear` and `ease-brand` Tailwind tokens and the `.press` class in `globals.css`.
- **Admin** (`apps/admin`): `motion.ts` (GSAP `useCountUp`), `CountUp.tsx` and the same Tailwind tokens; the `Button` component already shrinks on press.
- **Mobile** (`apps/mobile`): `src/lib/motion.ts` (`appear(index)` entering animation, `useCountUp`), `src/components/ui/count-up.tsx`; `AnimatedPressable` is the press feedback.
