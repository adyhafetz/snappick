# SnapPick public website and community dashboard

Status: **built in `apps/web` (milestones 1 to 7 below); see section 16 for what differs from this plan and what is unverified.** This is the one document to build from. It covers the marketing website and the public dashboard (one project, two areas). The mobile app, database and admin are done; this is the last unfinished part.

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

## 16. Build status

Run it: `cd apps/web && npm install && npm run dev` (port 3002). Needs `.env.local` (copy `.env.example`). Data comes from migrations `20261107000100` and `20261107000200` (snapshot tables, `refresh_public_stats()`, hourly pg_cron job, `get_public_districts()`). To see sample data: `npm run db:seed-pilot` in `apps/mobile`, then `select public.refresh_public_stats();` (or wait for the hourly job).

Built: marketing pages (home, how it works, download, about), dashboard (filters, key numbers, district map with shaded districts and aggregated pins, five charts with a "show as table" option for the map, suggestions, report button), SnapBot (avatar, tour, chat), PDF report, `.env.example`, 7 unit tests for the selectors and suggestions.

Differences from the plan above:

- **Suggestions are rule-based** (`src/lib/insights.ts`), computed in the page from the published figures, not stored in `public_ai_insights` (that table was not created). The report can use a language-model rewrite when `OPENAI_API_KEY` is set (`src/lib/ai.ts`); without a key the report says "Generated automatically". The dashboard says "Generated", not "AI-written".
- **SnapBot** gets a JSON block of the published aggregates for the chosen period and district and may only use it, instead of calling separate query tools. Without `OPENAI_API_KEY` it answers from keyword rules. Limited to 20 questions per IP per 10 minutes (in memory, per server instance).
- **Snapshots are keyed by period** (30 days, 90 days, all time) instead of by month for the cards and charts, so suppression is checked per period. Months are used for the trend chart only. Hotspot cells need 5 households, so only a few pins appear with the pilot data.
- **Report** uses PDFKit with the built-in Helvetica font (not Roboto) and has no logo yet (PDFKit cannot embed SVG). The map is not drawn in the PDF; districts appear as a table.
- SnapBot stays in the bottom-right corner; the tour scrolls to each section and shows a bubble (no flying between sections, per default D6).
- No analytics, no cookies.

Verified: unit tests, typecheck and production build pass; dashboard, filters, map, charts, SnapBot chat and tour were exercised in the browser against the remote project with the pilot data; the report endpoint returns a 7-page PDF for state and district scope; a suppressed district shows "Not enough data" and no figures leave the database.

Not verified: the PDF layout was never viewed (no PDF renderer available here); the OpenAI paths (SnapBot and report rewrite) have not been run with a real key; mobile layout and accessibility (keyboard, contrast, screen reader) have not been tested; no hosting, domain or release APK; the rate limiter is not shared across instances.

### Update after design review

- **Avatar:** `docs/brand/snapbot.svg` is now the avatar supplied by the owner (the earlier flying-wings design was replaced); `snapbot-icon.svg` is its head, cropped. The header uses the brand `logo-full.svg` (copied to `apps/web/public/brand/`).
- **Marketing site redesigned** (home page): hero with phone and live numbers, three numbered steps, four feature rows with app screens, a dashboard teaser, news, FAQ and a download call to action. The "Dashboard" button is the highlighted one in the header. The app screens are illustrations drawn in code (`src/components/Phone.tsx`), not screenshots of the real app. News and FAQ text live in `src/content/site.ts` and the news items are placeholders to replace.
- **Dashboard redesigned:** sticky filter bar with the report button, icon stat cards, map beside a "Top districts" / selected-district panel, charts, and a dark suggestions section. Map pins and the area and not-collected dots were removed (hotspot tables remain in the database but the web app no longer reads them); the map only shades districts, lighter for fewer pickups and darker for more. The pilot-data banner and the pilot notice in the report were removed.
- **AI wording:** the suggestions block says "Written by AI from the figures above." only when a language model actually produced them (needs `OPENAI_API_KEY` in `apps/web/.env.local`; `/api/insights` caches one call per snapshot, period and district). Without a key it says "Generated from the figures above." The report follows the same rule.

### Update: real app screens and content

- The marketing site no longer uses the bot illustration; it uses the official logo (`logo-full.svg`, `logo.svg`). The bot appears only on the dashboard (chat and tour).
- The app screens on the home page are **real screenshots** taken from the app on a connected Android phone (`apps/web/public/screens/`: home, scan, activity, collect, privacy). The Expo dev-tools button was painted out. Home is cropped above the news list (third-party news photos) and the profile image is only the Privacy and Storage card (no email or phone). They show an account with no activity, so counts are 0 and the scan screen is the empty viewfinder.
- Page content follows PRODUCT.md and the mobile screens: scan (camera or gallery, offline detector, editing), guidance and safety checklist, SnapBot, pickup request with a pin inside Perak, Activity (My Requests and Claimed Tasks, proof photo, 48-hour confirmation, rating, dispute), Collect (real-time masked pins, up to 3 jobs, route and Waze or Google Maps), Profile privacy switches, and account deletion that also deletes photos. It states that SnapPick is a community pilot, not an official scheme.
- Not covered by a real screenshot: the scan result, guidance, request form, proof, rating and dispute screens (they need scan data on the phone), so those are described in text only.

### Update: consistent phones and highlights

- Every phone on the marketing site now shows a **full** screenshot (same ratio, same size): home, scan result, activity, collect and profile in `apps/web/public/screens/`. A pulsing amber box (`highlight` prop of `Phone`, percentages of the image) marks the part of the screen a feature is about; it stops pulsing when reduced motion is on.
- Home is shown unblurred as requested (the news photos in it are third-party images). Profile has the name, email and phone blurred. The Expo dev-tools button is painted out. The scan image is a real scan result (a plastic bottle detected at 89%).
- Still not shown as screenshots: guidance, request form, proof photo, rating and dispute screens.

### Update: feature videos

- The home page now shows short screen recordings (muted, looping, 540x1200, 7 to 15 seconds, 3.7 MB in total) in the phone frame for: hero (home), scan, guidance, SnapBot, request, collect, activity and confirm-and-rate. Privacy stays a screenshot. Files are in `apps/web/public/videos/` and posters in `public/posters/`; the component is `src/components/PhoneVideo.tsx` (plays only while on screen, pauses when scrolled away, stays on the poster with reduced motion, has a play/pause button).
- They were recorded from the app on a connected phone with `adb screenrecord`, signed in as the demo account, with data from `scripts/seed_demo_account.sql` and `supabase/tests/seed-demo.mjs`. There was no ffmpeg on the machine, so the clips are untrimmed (about one second of lead-in) and not recompressed.
- Not recorded: the collector flow (start pickup, route, proof photo) because the route preview draws a line from the phone's real location, and the privacy screen because the profile header shows the account email.
- Check before launch: the home clip shows the news photos (third-party images); the request and collect clips show map areas around Ipoh.

### Update: page structure, news and privacy

- **Home page order:** hero (still image of the Home tab) → How it works (stepper and six videos: scan, guidance, request, collect, follow, confirm, plus a smaller "Also in the app" pair for SnapBot and privacy) → Who it's for (residents who lack time to haul recyclables, and collectors who see value in what others throw away; no payment is mentioned) → dashboard teaser → news → questions → call to action with the full logo (a light band, not a card).
- **News** now shows the same three Perak recycling articles as the app's Home tab (`src/content/site.ts`, copied from `apps/mobile/src/lib/news/perakNews.ts`). The app's list is hard-coded, so this is a curated list, not a live feed; keep the two in sync. Headlines, summaries and images are from The Star and link to the articles. Confirm that using their images is allowed before launch.
- **Privacy page** (`/privacy`) replaces `/how-it-works`, which now redirects to `/#how`. It was written from the app code: photos are downsized to 800 px, saved as JPEG and stripped of metadata; storage and model training are separate switches; exact locations go only to the accepting collector; deleting an account first removes the user's scan and proof photos, then cancels open requests, releases pickups being collected and deletes the account, but anonymised images already used in past AI training sets cannot be removed individually.
- Photos upload only for users who consented (see docs/ARCHITECTURE.md, offline scans), which the privacy page now states.

### Update: copy, policy page, about page and videos

- Persona quotes, the "You leave it out. Others pick it up." headline and the closing line were reworded. The summary step boxes under the How it works headline were removed, and the step numbers are now solid circles.
- The footer uses the dark/reversed full logo from the brand sheet (`public/brand/logo-full-reversed.svg`, the same artwork in #F5F7F2).
- `/privacy` is now **Privacy and policy**: the privacy sections plus a community policy (what can be offered, requesting, collecting, confirmations, ratings and disputes, SnapBot, pilot status), all taken from the app's consent screens and the rules in docs/ARCHITECTURE.md. It is a plain-language description of how the app works, not reviewed legal terms.
- The About page was rewritten (purpose, four pillars, pilot status).
- Video play/pause buttons were removed. The privacy card is now a recording of switching AI Model Training on and off (the account ends with it off, as before). The recording is shown unblurred, with the account name and email visible.

## Update: "?" help on dashboard cards

Every dashboard card (the four key numbers, map, top districts or district summary, the four charts, and the suggestions) has a small "?" button. Clicking it makes SnapBot fly to that card while the rest of the page is dimmed with a dark, see-through layer and the card stays lit. SnapBot shows a "thinking" indicator (three bouncing dots), then types its explanation into a square speech bubble. Escape, the close button or a click on the dimmed area ends it.

The explanations are written by the page itself from the published figures for the current period and district (`src/lib/cardHelp.ts`), so they need no AI call and never include anything beyond what the dashboard already shows. Components: `src/components/CardGuide.tsx` (the guide and `HelpButton`), wired in `Dashboard.tsx`. With reduced motion on, the flight and typing animation are skipped. Not yet checked on a phone-sized screen.

## Update: dashboard rework (suggestions card, tour, SnapBot look, report preview)

- The "Suggestions" card and the "Take a tour" button are removed from the dashboard. Suggestions now appear only in the report. The "?" help on cards (see above) replaces the tour, and the suggestions card has no "?" any more.
- SnapBot on the dashboard now looks like the mobile app's SnapBot: the icon-only `snapbot-icon.svg`, a mint "Ask SnapBot" launcher card, and a chat with the same header, card-style bubbles with times, a "Frequently asked questions" box and a "SnapBot is thinking…" row. The "?" guide uses the same icon.
- "Download report" became "Preview report". It opens a window where SnapBot shows progress steps while the PDF is really built by `/api/report` (the steps wait at least about 4 seconds so they can be read, longer if the AI call is slow). When it is done the PDF is shown with Download and Open buttons. The preview needs a browser with a built-in PDF viewer; Download works regardless.
- The word "pilot" is removed from the report (title, cover, header, limits note), the AI prompt and the facts sent to the model.
- All insights and suggestions carry a line saying they are generated from real SnapPick data: on the dashboard footer, under the report preview, and in every report page footer. The wording says "AI-generated" only when `OPENAI_API_KEY` is set on the server; otherwise it says "generated automatically", so the page never claims AI wrote something that a rule did.

## Update: AI through Supabase

The website does not hold an OpenAI key. SnapBot answers and the report's suggestions call the `dashboard-ai` Supabase edge function (`supabase/functions/dashboard-ai`), which uses the project's existing `OPENAI_API_KEY` secret, the same one the mobile app's `snapbot-chat` uses. The function needs no user login, so it only accepts requests that carry the shared secret `DASHBOARD_AI_SECRET` in the `x-dashboard-secret` header; the website's server sends it and the browser never sees it. It accepts at most 4 messages and about 12,000 characters, and the website sends published aggregates only.

To turn it on: `supabase secrets set DASHBOARD_AI_SECRET=<random value>`, `supabase functions deploy dashboard-ai`, and add the same value as `DASHBOARD_AI_SECRET` in `apps/web/.env.local`. Without it the website falls back to keyword answers and "generated automatically" wording. Report suggestions are cached per snapshot, period and district, so previewing a report repeatedly makes one model call. Status: written and typechecked, not yet deployed or run against the real model.

## Update: custom date range and district dropdown

- **Custom range.** The period bar has a "Custom range" button with From and To dates and quick choices (last 7, 14 or 30 days). The range must be at least 7 days long, cannot end in the future, and dates are read as Malaysia time. Everything on the page follows it: the four key numbers, map, district lists, materials, the monthly chart (whole months that touch the range), SnapBot answers, the "?" explanations and the report.
- **How it works.** Migration `20261107000400_public_range_stats.sql` adds `get_public_range_stats(p_from, p_to)`, a security-definer function the public key may call. It uses the same rules as the hourly snapshot (only requests that reached a final outcome, a district or all of Perak, any figure from fewer than 5 households returned as null). The website calls it through `/api/range` (limited to 60 calls per IP per 10 minutes) and `fetchSnapshot(range)`. For a range covering all data it returns exactly the all-time snapshot figures (checked: 336 completed of 452 requests, 123 households), and for 1 to 31 October the page and the database agree (171 of 229).
- **Known limit.** Because any dates can be chosen, someone who compares two ranges that differ by a few days could work out what a few households did in those days, even though each range on its own has 5 or more households. The 7-day minimum limits this but does not remove it. If that matters, restrict the picker to whole months, which are already published.
- **District dropdown.** The browser's own select list is replaced by a styled dropdown (`DistrictSelect.tsx`) with a map pin, a check on the chosen district and keyboard support (arrows, Enter, Escape).
- The SnapBot launcher icon is smaller (60 px).
- Tests: `src/lib/range.test.ts` (range rules, wording, monthly filtering). Not checked: phone-sized screens, and the monthly chart for a range inside a single month.

Fix: the report no longer has blank pages. The footer text sits inside the page's bottom margin, which made the PDF library add a new empty page after each footer line (10 pages instead of 4). The footer now clears that margin first. Checked by page count only (4 pages for all of Perak, for a custom range and for one district); the page layout itself has not been viewed.
