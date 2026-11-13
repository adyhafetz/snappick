# SnapPick public website and community dashboard

The marketing website and the public dashboard live in one Next.js app, **`apps/web`** (its own `package.json`, lockfile and `.env.example`, like `apps/mobile` and `apps/admin`). This document describes how it works today. Related: [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) (colours, type, naming), [ARCHITECTURE.md](./ARCHITECTURE.md) (tables, functions, rules), [../AGENTS.md](../AGENTS.md) (privacy and secrets rules, which apply here too).

## 1. Purpose

Household recycling in Perak is voluntary. SnapPick shows that residents will separate and hand over recyclables when it is easy, and the dashboard turns the app's real activity into figures that communities and decision makers can read: where people recycle, what, where requests are left uncollected, and suggestions in a report that can go to a committee. The website explains SnapPick and lets people download the Android APK.

Wording about Act 672 and Perak's status is not verified against an official source (open decision D3); the site keeps to neutral statements.

## 2. Run it

```powershell
cd apps/web
copy .env.example .env.local     # fill in the values
npm install
npm run dev                       # http://localhost:3002
npm test                          # unit tests
```

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Read the published statistics (public values) |
| `NEXT_PUBLIC_SITE_URL` | The site address. Never hard-code the domain (it is not bought yet) |
| `DASHBOARD_AI_SECRET` | Server only. Lets the website call the `dashboard-ai` function (section 6) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Server only, local alternative that skips Supabase. Do not use in production |
| `NEXT_PUBLIC_APK_URL`, `_VERSION`, `_SIZE`, `_SHA256` | The download page; leave empty until a release APK exists |

## 3. Pages

| Page | Content |
|---|---|
| `/` | Hero (still image of the Home tab), **How it works** (six steps, each with a screen recording in a phone frame, plus SnapBot and privacy), **Who it's for** (residents short on time, collectors who see value in waste), dashboard teaser, news, questions, closing call to action |
| `/dashboard` | The public dashboard (section 4) |
| `/download` | APK button, version, size, SHA-256, install steps |
| `/about` | Why SnapPick exists, four pillars, pilot status |
| `/privacy` | **Privacy and policy**: how photos, location and deletion work, and the community rules for requesting and collecting. Written from the app's code; a plain-language description, not reviewed legal terms. `/how-it-works` redirects to `/#how` |

The home page news is the same three Perak recycling articles as the app's Home tab (`src/content/site.ts`, copied from `apps/mobile/src/lib/news/perakNews.ts`). It is a curated list, not a live feed; keep the two in sync and confirm image use with The Star before launch. Page titles use `SnapPick | <Page>`; the tab icon is the emblem.

## 4. The dashboard

A sticky bar holds the filters, then the page shows:

1. **Filters:** period (30 days, 90 days, all time, or a **custom range**), a district dropdown, the data date, and **Preview report**.
2. **Four key numbers:** pickups completed, households taking part, items recycled, completion rate (with the median hours to claim). The completion rate appears once, on its own card.
3. **Map and side panel:** districts shaded from light (few completed pickups) to dark (many); a panel with the top districts, or the chosen district's summary. A "Show as table" option gives the same facts as a table.
4. **Four charts:** pickups per month, what is recycled, pickups completed by district, requests not collected.
5. **SnapBot:** a round icon bottom-right that bounces gently. It opens a chat styled like the mobile app's SnapBot.
6. A footer line: figures come from app users, figures from fewer than 5 households are hidden, and all insights and suggestions are AI-generated from real data (it says "generated automatically" when no AI is configured).

**Custom range.** Two dates, at least 7 days apart, not in the future, read as Malaysia time. Everything follows the range: numbers, map, lists, materials, the monthly chart (whole months that touch the range), SnapBot, the "?" explanations and the report.

**"?" on every card.** SnapBot flies to the card, the page dims (still visible), a thinking indicator shows, and a square bubble types an explanation. The text is written by the page from the published figures (`src/lib/cardHelp.ts`), with no AI call. Escape, the close button or a click outside ends it. Reduced motion skips the animations.

**Report.** Preview report opens a window where SnapBot shows progress steps while `/api/report` builds the PDF (at least about 4 seconds so the steps can be read), then shows it with Download and Open. `/api/report` allows 10 reports per visitor per 10 minutes, `/api/snapbot` 20 questions and `/api/range` 60 requests (`src/lib/rate-limit.ts`; counted per server instance, so a shared limiter belongs in front in production). A browser with a PDF viewer is needed for the preview; Download works anywhere. The PDF (PDFKit, Helvetica, A4, about 4 pages) has: cover, summary, method and data notes, participation, materials, districts table, service gaps, recommendations, appendix, and a footer on every page saying the insights are generated from real data. It has no logo or map.

## 5. Data and privacy

The web app never reads private tables. It reads only these, with the public (anon) key:

| Source | Content |
|---|---|
| `public_meta` | When the figures were refreshed, and a hash of the snapshot |
| `public_stats_period` | Per period (30d, 90d, all) and district (or `state`): requested, completed, unclaimed, households, items, median hours to claim |
| `public_stats_monthly` | The same by month, for the trend chart |
| `public_stats_materials` | Items by material, per period and district |
| `get_public_districts()` | District outlines for the map |
| `get_public_range_stats(from, to)` | The same figures for a custom range, computed on demand |

`public_stats_hotspots` is still filled but the web app no longer reads it.

- `refresh_public_stats()` (hourly pg_cron) rebuilds the tables; only requests that reached a final outcome (completed, not collected, cancelled, expired) count.
- **Suppression:** any figure based on fewer than 5 households is stored as null and shown as "not enough data" (a trigger also hides the household count). The range function applies the same rule.
- No user ids, names, notes, addresses, photos, exact coordinates or timestamps finer than a day leave the database, and none reach the AI prompts, caches or logs.
- **Known limit:** because any dates can be chosen, comparing two ranges that differ by a few days could reveal what a few households did in those days, even though each range alone has 5 or more households. The 7-day minimum limits this. If it matters, restrict the picker to whole months, which are already published.
- Service-role and AI keys are server-only. The site sets no cookies and uses no analytics.

## 6. AI

The website holds no OpenAI key. SnapBot answers and the report's suggestions go through the `dashboard-ai` Supabase edge function (`supabase/functions/dashboard-ai`), which uses the project's `OPENAI_API_KEY` secret, the same one the mobile `snapbot-chat` uses. The function needs no login, so it accepts only requests that carry the shared secret `DASHBOARD_AI_SECRET` in the `x-dashboard-secret` header (set with `supabase secrets set` and in `apps/web/.env.local`). It takes at most 4 messages and about 12,000 characters.

- **SnapBot** (`/api/snapbot`) is given a JSON block of the published figures for the chosen period, range and district and may answer only from it. 20 questions per IP per 10 minutes (in memory, per instance). Without AI configured it answers from keyword rules.
- **Report suggestions** (`src/lib/ai.ts`) rewrite the rule-based suggestions (`src/lib/insights.ts`) and are cached per snapshot, period, range and district. Each suggestion must cite a number from the figures. If the model fails, the rule-based text is used and labelled as automatic.
- `/api/range` is limited to 60 calls per IP per 10 minutes.

## 7. Design

The brand tokens, Roboto and Lucide icons from [BRAND_IDENTITY.md](./BRAND_IDENTITY.md). The marketing pages use the official logo (never the bot); the bot appears only on the dashboard. Phones show real screenshots and screen recordings from the app (`public/screens`, `public/videos`, `public/posters`; recorded with `adb`, muted, looping, playing only while on screen). Charts use one accent colour, mint for context and amber for gaps, with direct labels. English only; keep strings in `src/content/site.ts` so another language is cheap to add.

## 8. Tests and status

- 10 unit tests (`npm test`): selectors, hiding rule, suggestions, range rules and wording. Typecheck and production build pass.
- Checked in a browser: dashboard, filters, custom range (matches the database), map, charts, "?" guide, SnapBot chat, report preview (page count and file validity).
- **Not verified:** the report's page layout (never viewed), the PDF preview in a browser with a viewer, phone-sized screens and accessibility (keyboard, contrast, screen reader), the demo videos on a phone, hosting, a release APK, and the in-memory rate limiters across several instances.
- The videos show the demo account's name and email and Ipoh map areas; check before launch.

## 9. Open decisions

| # | Question | Default |
|---|---|---|
| D1 | Domain and hosting (on hold) | Host default URL; `NEXT_PUBLIC_SITE_URL` |
| D3 | Verified wording and sources for Act 672 and Perak's status | Neutral wording |
| D4 | Public contact address on the About page | Placeholder |
| D5 | Review AI text before it is public? | Auto-publish with the "generated from real data" line |
| D6 | Keep "community pilot" wording on About, Privacy and the questions | Kept |
