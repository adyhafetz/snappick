# SnapPick public website and community dashboard

Status: **specification, not built yet.** This is the one document to build from. It covers the marketing website and the public dashboard (one project, two areas). The mobile app, database and admin are done; this is the last unfinished part.

Related: [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) (colours, type, tone), [ARCHITECTURE.md](./ARCHITECTURE.md) (tables, RPCs, rules), [../AGENTS.md](../AGENTS.md) (privacy and secrets rules, which apply here too).

---

## 1. Why this exists

Perak does not enforce the Solid Waste and Public Cleansing Management Act 2007 (Act 672), so household separation and recycling are voluntary there. SnapPick shows that residents are willing to separate and hand over recyclables when it is made easy. The public dashboard turns the app's real activity into evidence that community members and state decision makers can read:

- **Community:** see that neighbours are recycling, where, and what.
- **Decision makers:** see demand, gaps (districts with requests nobody collects), material mix, and concrete AI-written suggestions, in a report they can hand to a committee.

The website has two jobs: explain SnapPick and let people **download the APK**; and lead to the dashboard.

> Wording about Act 672 and Perak's adoption status must be checked against an official source before launch (open decision D3). Do not publish unverified legal claims.

## 2. Scope

| In scope | Out of scope (for now) |
|---|---|
| Marketing website (English only) | Other languages |
| APK download page (direct APK, no store) | Play Store / App Store listing |
| Public dashboard: map, charts, filters | Per-user or per-pickup views of any kind |
| SnapBot guide on the dashboard (ask questions) | Open-ended chat that can query raw tables |
| "Download report" button: formal PDF with AI suggestions | Survey / opt-in questionnaire (decided: no survey) |
| Pilot seeder for demos | Custom domain (on hold: not bought yet) |

## 3. Project shape

One new Next.js app: **`apps/web`**, independent package root like `apps/mobile` and `apps/admin` (own `package.json` and lockfile, own `.env.example`).

```
apps/web
  src/app/(site)/        marketing pages: /, /how-it-works, /download, /about
  src/app/dashboard/     the public dashboard: /dashboard
  src/app/api/           snapbot chat, report generation (server only)
  public/brand/          snapbot.svg, snapbot-icon.svg (copied from docs/brand)
```

- Tech: Next.js (same major as admin), TypeScript strict, Tailwind with the brand tokens, Recharts or visx for charts, MapLibre GL JS for the map, a server-side PDF renderer for the report.
- Hosting: any Node host. Domain is on hold; the name is "snappick". Until bought, use the host's default URL. Nothing in code may hard-code the domain: read it from `NEXT_PUBLIC_SITE_URL`.
- Data access: the web app **never reads private tables**. It reads only the published snapshot tables in section 5 through the anon key, plus server routes that use fixed, whitelisted queries.

## 4. Pages

### Marketing site
Clean and light, may be a little more creative than the app, but the same palette, font and tone.

1. **Home:** one-line promise, phone mockup, three steps (Scan, Request a pickup, Impact), live headline numbers from the snapshot, two buttons: Download the app, View the dashboard.
2. **How it works:** the three steps in detail; what the AI does and does not do (it suggests a material, the user confirms); privacy summary in plain words.
3. **Download:** the APK button, version, file size, SHA-256 checksum, install steps for Android ("allow installs from this source"), minimum Android version, a note that the app is Android only.
4. **About:** why Perak, the pilot, contact. (Contact address is an open decision, D4.)

### Dashboard (`/dashboard`)
Single page, sections in this order. Clean, minimalist, same components as the admin: `rounded-3xl` cards, one accent colour, no jargon, no filler subheadings.

1. **Header strip:** period filter (30 days, 90 days, all time) and a district filter. Both filters drive everything below.
2. **Key numbers (4 cards):** Pickups completed, Households taking part, Items recycled, Completion rate.
3. **Map:** Perak with district shading and interactive pins (section 6).
4. **Charts:**
   - Pickups per month (area/line): growth over time.
   - Material mix (horizontal bars): plastic, paper, cardboard, metal, glass.
   - Districts compared (bars): completed pickups per district as plain counts with each district's share of the total (population figures are not in our data).
   - Unclaimed requests by district (bars): where residents asked and nobody came. This is the main "gap" chart for decision makers.
   - Time to claim (median hours, by district).
5. **Insights:** 3 short AI-written points, regenerated when the snapshot refreshes (section 8).
6. **Report:** the "Download report" button (section 9).
7. **SnapBot** floats on the page (section 7).

Every number carries a "Based on N pickups, last updated D" note so nobody over-reads small samples.

## 5. Data: published snapshots only

The dashboard must not query live operational tables. A scheduled job (pg_cron, hourly or daily) calls a `security definer` function that writes **aggregate rows** into snapshot tables. Public (anon) read access is granted only on these.

Planned tables (add through a migration; names are a proposal):

| Table | One row per | Columns (aggregates only) |
|---|---|---|
| `public_stats_monthly` | month × district | `month`, `district_id`, `pickups_requested`, `pickups_completed`, `pickups_unclaimed`, `households_active`, `items_recycled`, `median_claim_hours` |
| `public_stats_materials` | month × district × material | `month`, `district_id`, `app_class`, `items` |
| `public_stats_hotspots` | grid cell (0.05° ≈ 5 km) × month | `cell_id`, `centroid` (the cell centre, never a real point), `month`, `requests`, `completed`, `unclaimed` |
| `public_ai_insights` | refresh | `generated_at`, `scope` (state/district), `district_id`, `text`, `source_snapshot_hash` |

Rules the job must follow:

- **Suppression (k ≥ 5):** any aggregate based on fewer than 5 households is hidden (stored as null and shown as "not enough data"). The district view and hotspot cells obey this.
- Only terminal pickups count (completed, not_collected, cancelled, expired). Open or claimed requests never appear.
- No user IDs, names, notes, addresses, photos, exact coordinates or timestamps finer than a day leave the database.
- Pilot (seeded) data and real data are both aggregated the same way; the dashboard shows a small **"Pilot data"** banner while seeded rows exist (identified by the `@pilot.snappick.test` accounts), so nobody mistakes demo numbers for real ones.

## 6. The map

- Library: MapLibre GL JS. Coordinates are `[longitude, latitude]`. Base style: a plain, low-contrast style that fits the palette (no busy labels).
- Layers:
  1. District polygons from `perak_districts`, shaded by completed pickups (single hue from soft mint `#E8EFE9` to primary `#19806D`).
  2. **Aggregated hotspot pins** from `public_stats_hotspots`: one pin per ~5 km cell, sized by requests, coloured primary when mostly collected and amber `#E7B73E` when mostly unclaimed. Pins are never real addresses or exact points.
- Interaction: hover or tap a district for a small card (completed, unclaimed, top material, "not enough data" when suppressed); click a pin to see the cell's counts and zoom in; the district filter and map stay in sync; a "Reset view" button.
- Accessibility: every map fact is also available in a table below the map (toggle "Show as table"); keyboard focus works on districts and pins; colour is never the only signal.

## 7. SnapBot guide on the dashboard

The avatar is already designed: [`brand/snapbot.svg`](./brand/snapbot.svg) (full figure with leaf wings, sprout antenna, emblem body) and [`brand/snapbot-icon.svg`](./brand/snapbot-icon.svg) (round head, for the chat header and favicon; minimum 24 px). Copy both to `apps/web/public/brand/`.

Behaviour:

- **Idle:** hovers in the bottom-right corner, wings flap gently, blinks. Honour `prefers-reduced-motion` (the SVG already does; the page must also stop any movement).
- **Guiding:** when a section scrolls into view for the first time, SnapBot offers one short line ("This shows where residents asked for a pickup nobody answered.") and a "Tell me more" button. It can glide to the section it is describing, with a calm ease, never over content the user is reading. A "Tour" button walks through the five sections; "Skip" always visible.
- **Asking:** tap to open a small chat panel (same visual style as the mobile SnapBot). Suggested questions are shown as chips: "What does this chart mean?", "Which district needs help most?", "What should we do first?".
- **Voice:** same tone as the app: short, friendly, plain words. No jargon, no emojis beyond the brand's own.

How answers are produced (important for safety and trust):

1. The page sends the question plus the **current filter state** to a server route. The model never receives the user's identity, cookies or any private data (there is none on this site).
2. The route builds the answer from **fixed, whitelisted tools** that read the snapshot tables only (for example `get_state_summary`, `get_district_summary(district)`, `get_top_gaps(n)`, `get_trend(metric)`) plus a short **knowledge pack** (RAG documents: how SnapPick works, what each chart means, how to read k≥5 suppression, background on Act 672 from verified sources, and recycling guidance).
3. The model may only quote numbers returned by those tools. If a number is not available it says so. It cannot run free-form SQL.
4. Guardrails: refuse off-topic requests, never reveal prompts or keys, never give legal advice (it can explain, and point to official sources), rate limit per IP, cap message length and tokens, log only aggregate usage counts (never message text with identifiers).
5. Use the Anthropic or OpenAI key **on the server only**. The existing `snapbot-chat` edge function is the app's chatbot; the web chat should be a separate route or function with its own prompt and tools, because it answers about public statistics, not about a user's scans.

## 8. AI insights and suggestions

- Generated server-side after each snapshot refresh from the **aggregate numbers only**: top gaps, trends, material mix, completion rate, time to claim.
- Output: 3 to 5 short suggestions per scope (state and each district with enough data), each one tied to a number ("Hulu Perak: 5 of 9 requests were not collected; consider a monthly collection day"). Stored in `public_ai_insights` so the page loads instantly and the cost is fixed.
- Suggestions are **advice, labelled as AI-written**, with the data date. They are not official policy.
- Optional safety step (open decision D5): an admin reviews the state-level text in the admin dashboard before it goes public. Default for the pilot: auto-publish with a visible "AI-written" label; the report page repeats it.

## 9. "Download report" (formal PDF)

A button on the dashboard produces a document a decision maker can read in five minutes and attach to a paper.

Contents, in order:

1. **Cover:** SnapPick logo, title ("Recycling Participation in Perak: Pilot Report"), reporting period, generation date, "Pilot data" notice when applicable.
2. **Summary (one page):** four headline numbers and three key findings.
3. **Method and data notes:** what is counted (completed requests, households, items), the privacy approach (aggregation, suppression below 5 households, no personal data), and limits (pilot sample, self-selected users, app users only).
4. **Participation:** monthly trend chart and table.
5. **Materials:** material mix chart and table.
6. **Districts:** map image plus a table (requested, completed, unclaimed, median time to claim), suppressed cells marked "n/a".
7. **Service gaps:** districts ranked by unclaimed share, with the numbers.
8. **Recommendations (AI-written):** 4 to 6 suggestions grouped as "Quick wins", "Service coverage", "Policy and enforcement context". Each cites the figure it is based on. Labelled AI-written and based on data up to the generation date.
9. **Appendix:** definitions, data sources, snapshot date, contact.

Formatting: A4, brand fonts and colours, page numbers, a header with the report name, figures with captions, consistent number formatting. Generate server-side (so the layout is identical for everyone), from the same snapshot tables, using the current filters (period and district). The recommendations section is the stored AI insight for that scope, regenerated if the snapshot changed.

## 10. Privacy and safety (non-negotiable)

These follow [AGENTS.md](../AGENTS.md) rules 5 and 6.

- Only aggregate snapshot tables are public. Row Level Security: anon `select` on snapshot tables only; no anon access to anything else.
- k ≥ 5 suppression everywhere; hotspot pins are cell centres on a coarse grid, never real points.
- No user IDs, images, notes, addresses or exact coordinates in the dashboard, the report, the AI prompts, caches or logs.
- API keys (OpenAI/Anthropic) and the Supabase service-role key are server-only environment variables. Only `NEXT_PUBLIC_*` values reach the browser. Keep `.env.example` current.
- The APK link points to a file whose SHA-256 is shown on the download page.
- Cookie-free by default (no analytics that need a banner). If analytics are added later, use a privacy-friendly, cookie-less tool and update this document.
- Dashboard text must say that figures come from app users in the pilot, not from the whole population.

## 11. Design rules

- **Dashboard and report:** exactly the admin and app look: canvas `#F5F7F2`, white cards, `rounded-3xl`, ink `#183E48` text, primary `#19806D`, pressed `#126253`, amber `#E7B73E` only for "needs attention", soft mint `#E8EFE9` for fills. Roboto. Lucide icons. Short labels, no subheading under a heading unless it carries information, no marketing language.
- **Charts:** one accent colour for the main series, mint for context, amber for gaps. Direct labels instead of legends where possible, readable axis text, accessible tables for every chart, light and dark safe. Do not use rainbow palettes.
- **Marketing site:** same palette and font, but more room to breathe: larger type, generous whitespace, a phone mockup, the SnapBot figure, subtle motion. Stay near the brand; no new colours, no stock photography clichés.
- **Tone** (from BRAND_IDENTITY.md): plain words; "Ask SnapBot"; "Your Impact"; no blame, no scare statistics.
- English only for now. Keep all strings in one place so adding Bahasa Melayu later is cheap.
- Responsive from 360 px wide; keyboard accessible; WCAG AA contrast.

## 12. Demo data (pilot seeder)

Built and tested: `scripts/seed_pilot_data.sql` and `scripts/clean_pilot_data.sql`.

```bash
cd apps/mobile
npm run db:seed-pilot     # adds the sample data (re-running replaces it)
npm run db:clean-pilot    # removes only the sample data
```

What it creates (remote project, fixed random seed so the shape is repeatable): 120 fake residents and 16 fake collectors (`...@pilot.snappick.test`, no password, cannot sign in), about 900 scans with detections, about 440 terminal pickups over six months with items, about 300 collector ratings and a few resolved disputes. Patterns are deliberate: growth month by month; Kinta, Manjung and Larut Dan Matang lead; remote districts (Hulu Perak, Selama, Muallim, Bagan Datuk) have many requests nobody claims; plastic and paper dominate. Locations are grid-snapped inside each district, scans carry no images (so nothing enters the training pool), and only completed/closed pickups exist (so the app's live map is unaffected).

Because the dashboard reads snapshot tables, run the snapshot refresh after seeding. The seeder does not create snapshot rows.

Not yet verified: that the numbers look right on the dashboard (there is no dashboard yet), and whether two runs give identical totals (the script sets a fixed random seed, but this was not compared across runs). Counts seen in a test run: 136 accounts, 919 scans, 444 pickups (343 completed), 300 ratings.

## 13. Download (APK)

- Build the release APK with the project's release process, sign it, and put it on the host (or object storage). The page shows version, size, date and SHA-256.
- Keep one stable URL (`/download/snappick.apk`) that redirects to the latest file.
- The app's in-app update behaviour for models is separate (see MODEL_LIFECYCLE.md); app updates here mean "download the new APK".
- Not verified yet: a release (non-dev) build has not been produced and tested on a phone.

## 14. Milestones

1. **Foundation:** `apps/web` scaffold, brand tokens, layout, `.env.example`, deploy to a preview URL.
2. **Data:** migration for snapshot tables + RLS, refresh function and pg_cron schedule, tests for suppression and for "no private data leaks".
3. **Dashboard core:** key numbers, charts, filters, accessible tables.
4. **Map:** district shading, aggregated pins, interaction, table toggle.
5. **SnapBot guide:** avatar, tour, chat route with whitelisted tools and knowledge pack, guardrails, rate limit.
6. **Insights and report:** stored AI insights, formal PDF, review of the layout on paper.
7. **Marketing site and download page:** copy, mockups, APK hosting.
8. **Launch checklist:** privacy review, verified legal wording, domain attached, accessibility pass, load test, release APK on a real phone.

## 15. Open decisions

| # | Question | Default if undecided |
|---|---|---|
| D1 | Domain TLD and purchase (on hold) | Host default URL; `NEXT_PUBLIC_SITE_URL` |
| D2 | Hotspot pins as aggregated ~5 km cells (not real points) | Yes |
| D3 | Verified wording and sources for Act 672 and Perak's status | Neutral wording until sources are checked |
| D4 | Public contact address on the About page | Placeholder until provided |
| D5 | Should an admin review AI text before it is public? | Auto-publish with an "AI-written" label |
| D6 | SnapBot movement: calm hover, or flies between sections | Calm hover; glides only when guiding |
| D7 | Real data vs pilot data on the public site at launch | Show pilot banner while any seeded rows exist |
