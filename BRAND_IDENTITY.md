# SnapPick Brand Identity & Design System

> **Version:** 1.0.0  
> **Target Platforms:** Mobile App (Expo / React Native), Admin Panel (Next.js 15), Public Dashboard (Next.js 15)  
> **Source of Truth:** `apps/mobile/src/theme.ts`, `apps/mobile/src/global.css`, `apps/mobile/tailwind.config.js`

---

## 1. Brand Philosophy & Design Vision

SnapPick is an eco-centric, community-driven civic platform built for Perak, Malaysia. The visual aesthetic is **organic minimalism**—balancing clean, modern utility with a warm, natural feel.

### Core Principles
1. **Breathing Room over Clutter:** Generous white space, soft canvas backgrounds, and focused single-action screens.
2. **Tactile & Responsive:** Soft pill shapes, generous border radiuses (`rounded-2xl` to `rounded-3xl`), micro-scale press states (`scale: 0.97`), and smooth transitions.
3. **Calm, Earthy Palette:** Anchored by deep forest emerald and oceanic ink, supported by warm sage canvas, clean white surfaces, and golden amber accents.
4. **Honest & Direct Language:** Clear, non-technical microcopy. Guidance is helpful and respectful without sounding bureaucratic or robotic.

---

## 2. Color Palette & Tokens

SnapPick avoids harsh pure blacks (`#000000`) and sterile grays. All neutrals are subtly tinted with deep ocean and sage undertones.

### Core Swatches

| Token | Hex | HSL Equivalent | Role & Application |
|-------|-----|----------------|---------------------|
| **Primary (Brand Green)** | `#19806d` | `169 67% 30%` | Primary buttons, active tab indicators, brand accents, brand pill badges |
| **Primary Dark** | `#126253` | `169 69% 23%` | Hover / pressed button states, deep green headers |
| **Primary Surface** | `#e8efe9` / `#eaf6f2` | `130 18% 92%` | Light tint card backgrounds (SnapBot card, active pills, icon backgrounds) |
| **Ink (Foreground)** | `#183e48` | `192 50% 19%` | Primary heading color, brand title text, deep body text |
| **Muted Slate** | `#5b7072` | `185 11% 40%` | Secondary descriptions, subheadings, inactive icons, timestamps |
| **Canvas (Background)** | `#f5f7f2` | `80 14% 96%` | Warm sage-tinted app canvas & screen background |
| **Surface / Card** | `#ffffff` | `0 0% 100%` | Elevated card surfaces, sheet backgrounds, modal dialogs |
| **Border / Divider** | `#d9e2dc` | `140 12% 87%` | Subtle card borders, input borders, list item separators |
| **Accent (Golden Amber)** | `#e7b73e` | `43 78% 57%` | Rating stars, review/pending status badges, highlights |

### Semantic & Status Colors

| Semantic State | Foreground Hex | Background / Surface Hex | Border Hex | Tailwind Mapping |
|----------------|----------------|--------------------------|------------|------------------|
| **Success / Completed** | `#15803d` / `#16a34a` | `#e8efe9` (`bg-emerald-500/10`) | `border-emerald-500/25` | `text-emerald-800 bg-emerald-500/10` |
| **Active / In Progress** | `#2563eb` / `#1d4ed8` | `#eff6ff` (`bg-blue-500/10`) | `border-blue-500/25` | `text-blue-700 bg-blue-500/10` |
| **Pending / Review** | `#805d13` / `#b45309` | `#f8f0d8` (`bg-amber-500/10`) | `border-amber-500/25` | `text-amber-800 bg-amber-500/10` |
| **Disputed / Danger** | `#b42318` / `#e11d48` | `#fef3f2` (`bg-rose-500/10`) | `border-rose-500/25` | `text-rose-800 bg-rose-500/10` |
| **Uncertain / Neutral** | `#536d7d` / `#64748b` | `#e9eff2` (`bg-slate-100`) | `border-slate-200` | `text-slate-700 bg-slate-100` |
| **Cancelled / Inactive** | `#52525b` | `bg-zinc-500/10` | `border-zinc-500/20` | `text-zinc-600 bg-zinc-500/10` |

---

## 3. Typography & Hierarchy

### Font Family & Characteristics
- **Sans-Serif:** Clean geometric grotesk (Inter, Roboto, SF Pro, or system font stack).
- **Weight Contrast:** High contrast between dense black/bold headings and comfortable regular/medium body copy.

### Standard Typography Scale

| Style Level | Classes | Font Size / Weight | Used For |
|-------------|---------|---------------------|----------|
| **Brand Wordmark** | `text-2xl font-black tracking-tight text-ink` | 24px / Black (900) | Top app header with decorative brand bar (`h-1 w-7 rounded-full bg-primary mt-1`) |
| **Screen Title** | `text-3xl font-black tracking-tight text-foreground` | 30px / Black (900) | Top tab headers (Collect, Activity, Scan, Profile) |
| **Section Header** | `text-xs font-bold uppercase tracking-wider text-muted-foreground` | 12px / Bold (700) | Category dividers (`YOUR IMPACT`, `LATEST NEWS`, `COLLECTION DETAILS`) |
| **Card Title (Hero)** | `text-xl font-black text-foreground leading-tight` | 20px / Black (900) | Primary cards (`Scan Waste`, `Ask SnapBot`) |
| **Card Title (Item)** | `text-base font-bold text-foreground` | 16px / Bold (700) | List items, pickup item headings, modal dialog titles |
| **KPI / Metric Stat** | `text-2xl font-black text-foreground tracking-tight` | 24px / Black (900) | Number counts in impact metrics (`total_scans`) |
| **Body (Default)** | `text-sm text-foreground` | 14px / Regular (400) | Standard instructions, address text, descriptions |
| **Body (Muted)** | `text-sm text-muted-foreground leading-relaxed` | 14px / Regular (400) | Secondary explanations, form helper text |
| **Caption / Subtitle** | `text-xs font-medium text-muted-foreground` | 12px / Medium (500) | Timestamps, district labels, sub-captions |
| **Status Pill / Badge** | `text-[11px] font-bold tracking-tight` | 11px / Bold (700) | Status tags (`Pending`, `Review`, `Completed`) |
| **Button (Primary)** | `text-base font-bold text-white` | 16px / Bold (700) | Primary CTA labels (`Claim Pickup`, `Start Pickup`) |
| **Button (Small)** | `text-xs font-bold` | 12px / Bold (700) | Compact utility buttons (`Release`, `Cancel`) |

---

## 4. Components & Spatial Structure

### Border Radius Hierarchy
- **Extra Large (`rounded-3xl` / 24px):** Hero action cards (Scan Waste, SnapBot), Impact metric cards, Carousel items, Modal container tops.
- **Large (`rounded-2xl` / 16px):** Primary buttons (`h-12`), Inputs (`h-12`), List item cards, Icon container backdrops (`h-9 w-9` or `h-10 w-10`).
- **Medium (`rounded-xl` / 12px):** Small buttons (`h-9`), Dropdown selectors, Inner checklist items.
- **Pill / Circular (`rounded-full` / 9999px):** Status badges, user avatar circles, tab focus pills, floating icon buttons.

### Card Pattern
All cards use consistent subtle framing rather than heavy shadows:
```tsx
<View className="rounded-3xl bg-card border border-border/80 shadow-xs p-4">
  {/* Card Content */}
</View>
```
- **Hero / Action Card Decoration:** Translucent layered background orbs (`rgba(255,255,255,0.08)` or `rgba(25,128,109,0.08)`) with `overflow-hidden relative` to create subtle depth without distraction.

### Button Patterns
- **Primary Button:**
  `h-12 px-5 py-2.5 rounded-2xl bg-primary active:opacity-90 active:scale-[0.97] transition-all`
- **Secondary / Outline Button:**
  `h-12 px-5 py-2.5 rounded-2xl border border-input bg-card active:bg-accent active:scale-[0.97]`
- **Destructive Button:**
  `h-12 px-5 py-2.5 rounded-2xl bg-destructive text-white active:scale-[0.97]`
- **Small Button:**
  `h-9 px-3.5 rounded-xl font-bold text-xs`

### Status Pills
Always compact with high legibility:
```tsx
<View className="items-center justify-center rounded-full border px-2.5 py-0.5 bg-amber-500/10 border-amber-500/25">
  <Text className="text-[11px] font-bold tracking-tight text-amber-800">Review</Text>
</View>
```

---

## 5. Iconography & Visual Metaphors

SnapPick uses **Lucide icons** exclusively for clean geometric clarity.

### Icon Styling Rules
- **Stroke Weights:**
  - Active / Primary Focus: `strokeWidth={2.4}`
  - Inactive / Normal: `strokeWidth={1.8}`
  - Small / Micro indicators: `strokeWidth={1.5}` to `2.0`
- **Container Framing:** Standalone icons are almost always wrapped in a soft rounded container (`rounded-2xl` or `rounded-full`) with a 10% opacity tint of the icon color.

### Core Icon Assignments
- **Navigation Tabs:**
  - Home: `<Home />`
  - Activity: `<History />`
  - Scan: `<ScanLine />`
  - Collect: `<MapPin />`
  - Profile: `<User />`
- **Material Categories:**
  - Plastic: `<Milk />`
  - Cardboard: `<Package />`
  - Paper: `<FileText />`
  - Glass: `<Wine />`
  - Metal: `<Cylinder />`
  - Trash / Non-recyclable: `<Trash2 />`
  - Biological / Organic: `<Leaf />`
- **Actions & Status:**
  - Navigation / Turn-by-turn: `<Navigation />`
  - Camera / Proof: `<Camera />`
  - SnapBot AI: `<Bot />`
  - Rating Stars: `<Star />` (filled with `#e7b73e`)
  - Disputes / Warnings: `<AlertTriangle />` / `<ShieldAlert />`
  - Verified / Confirmation: `<CheckCircle2 />`

---

## 6. Voice, Tone & Microcopy (Terminology Guide)

SnapPick communicates with warmth, humility, and absolute clarity. We avoid overly technical AI jargon, punitive warnings, or bureaucratic phrasing.

### Core Terminology Mapping

| Concept | ✅ Approved Term | ❌ Avoid / Do Not Use | Why |
|---------|------------------|-----------------------|-----|
| Collector Tab | **Collect** | Request, Browse, Jobs, Tasks | Action-oriented, highlights the community collector role. |
| Pickup Entity | **Pickup Request** / **Pickup** | Order, Ticket, Booking | Emphasizes mutual community initiative. |
| Collector Acceptance | **Claim** / **Claimed** | Accept, Assign, Reserve | "Claim" implies volunteer initiative and accountability. |
| Collection Proof | **Proof Photo** | Delivery photo, Receipt, Evidence | Clear, factual, client-side EXIF stripped. |
| Requester Issue | **Dispute** | Complaint, Report Abuse, Ticket | Standard mutual verification terminology. |
| AI Guidance | **Ask SnapBot** | AI Chatbot, LLM Prompt, Robot | Friendly, accessible character. |
| Personal Stats | **Your Impact** | User Metrics, KPIs, Analytics | Personal, inspiring connection to sustainability. |
| Awaiting Confirmation | **Review** / **Awaiting Confirmation** | Pending Requester, On Hold | Clean, immediate status label. |
| Ineligible Hazard Warning | **Safety Declaration** | Banned Items, Prohibited Waste | Proactive safety rather than punitive prohibition. |

### Microcopy Tone Examples
- **Home Scan Prompt:**
  *"Instantly check if it's recyclable"* (Direct benefit)
- **SnapBot Prompt:**
  *"Instant recycling & sorting advice"* (Clear expectation)
- **Safety Checklist:**
  *"Safety check: batteries, light bulbs, chemicals, and e-waste must be disposed through specialized council facilities, not household pickups."* (Informative, non-judgmental)
- **Proof Photo Guidance:**
  *"Snap a clear photo showing the items at the collection point. Location metadata is automatically removed for privacy."* (Reassuring on privacy)

---

## 7. Guidelines for Admin Panel (`apps/admin`) & Dashboard (`apps/dashboard`)

When designing and improving the Next.js **Admin Panel** and **Public Dashboard**, adapt the mobile design system cleanly to desktop web without losing brand cohesion:

### Web Layout & Structure
1. **Background:** Use the same `#f5f7f2` sage canvas for page background; wrap main data tables and detail views in pure white (`#ffffff`) cards with `rounded-2xl border border-border/80 shadow-xs`.
2. **Typography:**
   - Web headings should use the same `text-ink` (`#183e48`) font color with black or bold weights.
   - Section headers on tables and sidebars should follow the uppercase tracking style: `text-xs font-bold uppercase tracking-wider text-muted-foreground`.
3. **Data Tables:**
   - Soft borders, ample row padding (`py-3.5 px-4`), hover highlight `hover:bg-secondary/40`.
   - Use the exact same **PickupStatusPill** styles (color fills, borders, text tones) for request and model rollout statuses.
4. **Action Buttons:**
   - Primary action buttons: `bg-[#19806d] hover:bg-[#126253] text-white rounded-xl h-10 px-4 font-bold text-sm shadow-xs`.
   - Secondary buttons: `border border-border bg-white text-foreground hover:bg-secondary/50 rounded-xl h-10 px-4 font-semibold text-sm`.
5. **Chart & Metric Styling:**
   - Accent metrics with the brand green (`#19806d`), blue (`#2563eb`), amber (`#e7b73e`), and emerald (`#16a34a`).
   - Cards should feature soft rounded icons in top corners (`h-9 w-9 rounded-xl bg-primary/10`).

