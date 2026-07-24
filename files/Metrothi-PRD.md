# Metrothi — Product Requirements Document & Technical Blueprint

**Version:** 2.0 · **Date:** 2026-07-15 · **Owner:** Rahil
**Status:** Master reference. All future build work should trace back to this document. Changes to scope/architecture get made *here first*, then implemented.
**Last updated:** 2026-07-23 — added the Localization & Multilingual Support plan (English / Hindi / Gujarati via `react-i18next`), §6. Prior update the same day: map rendering upgraded to real track geometry and the viewport fenced to the Ahmedabad–Gandhinagar area (§4.3). See Change Log at the bottom.

---

## 1. Product vision

Metrothi is the ultimate, fully-functional companion application for the Ahmedabad Metro system. Built for speed and utility: open it, and within two seconds you know **which station to walk to, when the next train actually leaves, and exactly how to get where you're going** — including what ticket works, where to change lines, and whether the trip is even possible right now.

**One-line pitch:** A production-ready, lightning-fast, offline-capable journey planning platform for the Ahmedabad–Gandhinagar metro.

### Guiding principles
1. **Honesty over illusion.** GMRC publishes no live vehicle feed. We simulate from the real timetable and explicitly say so. If a trip can't be completed today, we say "not possible," never a fabricated ETA.
2. **Frictionless Onboarding.** The app works immediately without forcing a login. GPS improves the experience but is never required. 
3. **Local-first & Offline-ready.** Core features (nearest station, journey planning, schedule estimates) must work seamlessly offline (Progressive Web App architecture).
4. **Cloud-Synced for Power Users.** Once logged in, users can sync saved journeys, frequent places, and preferences securely across devices.

---

## 2. Users & core jobs-to-be-done

| User | Job |
|---|---|
| Daily commuter | "Get me to work; tell me when to leave, track my exact current location in transit, and sync my saved routes." |
| Occasional rider | "I don't know the network. Which station, which line, which ticket, how much?" |
| Cross-city traveler (Ahmedabad ↔ Gandhinagar/GIFT City) | "Is this trip possible right now, what does it cost, and why doesn't my token work?" |
| Visitor/tourist | "I know my destination *place* (e.g. Narendra Modi Stadium), not a station name. Route me anyway using multimodal suggestions." |

---

## 3. Scope

### In scope (Full Production Features)
- **Core Routing:** Nearest-station detection (GPS), schedule-based live estimates, multi-transfer routing, feasibility checking, fare calculation.
- **Progressive Web App (PWA):** Installable on iOS/Android, fully capable of offline routing and schedule lookups.
- **Backend & Auth (Supabase):** Secure user authentication (Email/Google/Apple) with Postgres RLS securing user data.
- **User Profiles:** Cloud synchronization of saved places, saved daily commutes, and user preferences.
- **Destination Resolving:** Integration with MapLibre/Google Places to resolve point-of-interest names to the nearest metro station.
- **Journey State Machine:** Live turn-by-turn tracking when a user starts a journey (Walking → Waiting → On Train → Transferring → Arrived).
- **Push Notifications:** Service-worker-based notifications (e.g. "Leave in 10 minutes to catch the 9:45 AM Blue Line train").
- **Multilingual UI (English / Hindi / Gujarati):** Full interface localization with a language switcher in settings, plus station, line, and place names localized from official GMRC naming. Planned — see §6.

### Explicitly out of scope
- Real-time vehicle positions (no data source exists yet; architecture must support it *when* it drops).
- Ticket purchase / NCMC recharge (No GMRC API available; do not build financial transacting logic).

---

## 4. Information architecture — map-first, overlay-driven

The app is a single map-first surface rather than a tab-bar shell (the nav bar
is currently suppressed — `--nav-h: 0`). HOME *is* the live map; everything else
— search, the GO planner, station detail — floats over it as an overlay so the
map never unmounts and no page transition is needed. YOU (settings) is the one
genuine route. The GO / MAP / STATIONS / YOU descriptions below define those
surfaces regardless of how they're currently mounted.

```text
HOME (the map)  ── overlays ──▶  SEARCH · GO planner · station sheet
                └─ route ──────▶  YOU (settings)
```

### 4.1 HOME — live map dashboard
- **Map as the surface:** The home screen is the full-bleed live map (§4.3), not a card list. Floating over it: a search pill ("Search stations and landmarks"), a settings button, and the line-status strip.
- **Nearest-station sheet:** A draggable bottom sheet (collapsed peek → mid → full) anchored to the user's nearest station (or a default when location is denied). Its sticky header names the station once — line badge, name, and a chip row: line · walk distance · walk time when collapsed; line · phase · stop-of-N (plus interchange / a service-status chip) when expanded. The collapsed peek is sized to the header so the body's actions never peek through.
- **Merged schedule:** Inside the sheet, each line's full-day schedule lists **both directions in one time-sorted list** (no direction tabs), greying past departures and highlighting the next train each way. Tapping any train opens its full stop-by-stop route.
- **Trip entry from a station:** Two buttons — **From here** (seeds the trip origin) and **To here** (seeds the destination) — open the GO planner as an overlay via an in-app event; the map stays mounted beneath. A Plan-route FAB opens the planner with no prefill.
- **Service status strip:** Degraded-state pills for any line not currently running; tapping one opens search focused on that line.

### 4.2 GO — the heart of the product
- **From/To inputs:** Intelligent search resolving both station names and generic places (via Geocoding).
- **Results screen:** Stop-by-stop list, total transfers, fare, total time. Fare is computed from real GMRC distance data (§5.4), not an approximation, and is shown as `—` rather than a guess if a route's distance can't be resolved.
- **Ticket guidance card:** Advises on Token vs CSC vs NCMC requirements based on crossed phases, and notes the CSC/NCMC 10% discount (confirmed, §5.4) — display only, never folded into the fare shown.
- **Warning cards:** Feasibility warnings for last-train cutoffs or bus-only windows.
- **Journey Mode:** Actively transitions UI state as the user progresses geographically through their trip.

### 4.3 MAP
- **Interactive geographic map:** High-performance vector map (MapLibre/Leaflet).
- **Real track geometry:** Line polylines are drawn from actual OpenStreetMap rail geometry (`app/src/data/tracks.json`, `map/geometry/trackGeometry.ts`), not straight station-to-station chords. Each line degrades gracefully to the chord if track data is missing.
- **Snapped station markers:** Station markers are projected onto the drawn track (via each station's `stationKm`) so they sit *on* the line rather than beside it. Terminal (end-of-line) markers are rectangular "buffer caps" rotated to sit **perpendicular to the track direction** at that point, computed in Web Mercator so the angle matches the rendered polyline.
- **Live simulated trains:** Schedule-derived trains glide along the real track (`LiveTrainsLayer`), interpolated by segment progress, updating every second. Each train marker carries a **direction-of-travel arrowhead** pointing the way the train is heading, so the map reads as live movement. (Positions remain simulation from the timetable, per §1 principle 1 — no live feed is implied.)
- **Constrained viewport:** The map is fenced to the metro's footprint so users never wander off into empty map. Implemented with Leaflet `maxBounds` (the network bounding box padded ~25%, i.e. Ahmedabad through Gandhinagar/GIFT City) + `maxBoundsViscosity: 1.0`, so the drag stops solid at the edge (a hard fence, no bounce-back). Zoom is floored at `minZoom` (can't zoom out past seeing the whole network) and capped at `maxZoom: 18` (free to inspect any section up close). Panning is unrestricted *within* the box at any zoom.
- **Dynamic highlighting:** Dimming non-relevant lines and highlighting the active path during route planning.
- **Station Bottom Sheet:** Quick actions directly from the map viewport.

### 4.4 STATIONS
- **Directory & Live Details:** Grouped by line with interchange and phase badges.
- **Station Detail Pages:** Shows all live simulated departures per line.

### 4.5 YOU
- **Authentication:** Login/Signup flows powered by Supabase Auth.
- **Data Management:** Sync settings, clear local data, manage saved commutes and places.
- **Language:** A three-way selector (English / हिंदी / ગુજરાતી) sets the app-wide interface language, styled like the existing theme toggle. Planned — see §6.6.

---

## 5. Journey Engine & Architecture

### 5.1 Network Model & Simulation
- The engine uses a pure TS ordered-array approach for deterministic, zero-dependency routing.
- **Transfer buffer:** Currently a flat 3-minute penalty. Must be upgraded to per-station walking matrixes before v2.0 launch.
- **Simulated Headways:** Engine projects schedule times using frequency bands hand-transcribed from GMRC's official PDF timetables.

### 5.2 Application Architecture
- **Frontend Stack:** React 19, TypeScript, Vite, TailwindCSS (Vanilla CSS for tokens).
- **State Management:** Zustand for local app state, TanStack Query for remote asynchronous caching (Places API, backend sync).
- **Local Persistence:** The transit graph and schedules are **bundled at build time** as imported JSON (`app/src/data/*.json`), so they ship inside the precached JS and need no runtime store. User data (saved journeys, recent trips, theme) is in `localStorage`. *Dexie.js/IndexedDB was specified here originally but is **not** used — it would add an async hydration path and a migration without enabling any offline behaviour that bundled data + localStorage doesn't already provide. Revisit only if user data outgrows localStorage's ~5 MB. See DISCREPANCIES.md.*
- **Backend Stack:** Supabase (PostgreSQL, GoTrue for Auth, PostgREST for APIs).
- **Hosting:** Vercel (or Cloudflare Pages) with Edge caching.
- **Telemetry:** Sentry (Error tracking), PostHog (Product analytics with stringent PII stripping).

### 5.3 Local-First Sync Strategy
All transit graph data (stations, lines, schedules) is bundled with the PWA and precached by the service worker, so journey planning and fare calculation run fully offline. User data (saved journeys, recent trips) is written synchronously to `localStorage` for immediate UI updates. Supabase sync for authenticated users remains a future addition; the Dexie-first write path described in earlier drafts was not implemented (see §5.2).

### 5.4 Fare Engine
`fareEngine.ts` computes fares from route **distance**, not station count — GMRC's own `get_fare` endpoint (`gujaratmetrorail.com/ahmedabad/wp-admin/admin-ajax.php`, action `get_fare`) confirmed distance is the actual basis: pairs with identical station counts but different distances return different fares.

- **Segment data:** Track distance for all 55 adjacent station segments was read directly from that endpoint and stored in `app/src/data/fares.json`. A cumulative-distance graph built from those segments reproduces GMRC's own station counts on every sampled pair and its published distance to within 2-decimal rounding — including cross-line paths through an interchange (e.g. Gandhigram → Old High Court → Usmanpura).
- **Slabs:** ₹5 minimum, then cuts at 2.5 / 7.5 / 12.5 / 17.5 / 22.5 / 30 / 37.5 km → ₹5 / 10 / 15 / 20 / 25 / 30 / 35 / 40. (The fare previously shipped was station-count-based and capped at ₹25 — it undercharged every trip over ~22.5km by up to ₹15.)
- **Overrides:** GMRC's internal chargeable distance differs from the distance it *displays* by up to ~0.06km, so a handful of pairs sitting almost exactly on a slab cut land on the wrong side of the rule. 6 such pairs were confirmed directly against GMRC and are hard-coded as overrides that win over the slab calculation.
- **Route fare** is computed off the actual ordered station sequence a journey passes through (`journeyEngine.ts`'s `merged` path), not the endpoints alone, so it's correct through interchanges.
- **Verification:** `fareEngine.test.ts` asserts 156 real GMRC-sampled pairs end-to-end through `planJourney` (fixture: `__fixtures__/gmrc-fare-samples.json`). Known gap: only pairs within ~0.12km of a slab cut were checked exhaustively; pairs further from a cut are unverified but low-risk. Full methodology and confidence notes live in `fares.json`'s `_meta` block.
- **NCMC / CSC 10% discount:** Confirmed against GMRC's `fare-rules` page and independently by the product owner. Deliberately **not** applied to any computed fare — every fare in the app is the token fare. The discount is surfaced as text only, in the ticket guidance card's note.
- **Operational facts:** Concessions, luggage limits, penalties, refund policy, ticket validity windows, and the Phase 1/Phase 2 token & CSC restriction were scraped from GMRC's official `fare-rules`, `smart-cards`, `national-common-mobility-card-ncmc`, and `train-information` pages and stored in `app/src/data/metroInfo.json`, with per-fact source quotes and any figure GMRC doesn't state left `null` rather than filled in from third-party sources. Not yet surfaced in any screen — candidate for a "Fares & Rules" info panel under GO or YOU.

---

## 6. Localization & Multilingual Support (Planned)

**Goal:** A full app-wide language switch between **English (`en`, default), Hindi (`hi`), and Gujarati (`gu`)**, selectable from the YOU screen and persisted across sessions. All three are left-to-right, so **no RTL layout mirroring is required**.

The work splits into two very different surfaces. The UI framework is the small, unblocked part; the translated *content* — especially the 54 station names — is the larger part and gates the feature feeling complete.

### 6.1 Library & architecture
- **`react-i18next` + `i18next`** (chosen over a hand-rolled context because Hindi and Gujarati have real CLDR plural rules, and the app already has interpolated strings — `Starts in {duration}`, `Stop {n} of {total}` — that i18next handles natively). A custom context mirroring `ThemeContext` was considered and rejected on the plural/interpolation cost.
- `app/src/i18n/index.ts` initialises i18next: registers the three resource bundles, `fallbackLng: 'en'`, `interpolation.escapeValue: false` (React already escapes), and reads the persisted language on boot.
- A thin `useLanguage()` hook wraps `i18n.changeLanguage` + persistence, **mirroring the existing `ThemeContext` pattern** (`contexts/ThemeContext.tsx`): the choice is written to `localStorage['metrothi-lang']` and reflected onto `document.documentElement.lang`, exactly as the theme flow writes `data-theme`.

### 6.2 Two translation surfaces
1. **UI chrome** — button labels, section headers, and status text (e.g. "Nearest Station", "Service ended", "Plan route") hardcoded across the ~24 `.tsx` components. Extracted into namespaced bundles `app/src/i18n/locales/{en,hi,gu}.json` and rendered via `t('namespace.key')`. Interpolated and pluralised strings use i18next placeholders and `_one`/`_other` suffixes.
2. **Data content** — station names (×54), line names, and landmark/place names. Handled as data, not UI strings:
   - Extend `app/src/data/stations.json` with `nameHi` / `nameGu` per station.
   - Extend `LINE_NAMES` in `app/src/features/journey/constants.ts` (e.g. Blue Line → नीली लाइन / વાદળી લાઇન).
   - A resolver (e.g. `stationName(station, lang)` in `journeyEngine.ts`) returns the localized name with **per-name fallback to English** when a translation is absent; every `station.name` read routes through it.

### 6.3 Dynamic formatting
Durations, dates, and distances (`formatDuration`, "Effective 18.05.2026", "600m ago" in `journeyEngine.ts`) route through `Intl` (`Intl.NumberFormat` / `Intl.DateTimeFormat`) or i18next formatters. **Decision pending:** keep Western digits (recommended — matches GMRC signage) vs. Indic numerals.

### 6.4 Fonts (easily missed)
The app currently loads **only Space Grotesk** (`app/index.html`), which has **zero Devanagari or Gujarati glyph coverage** — without action, Hindi/Gujarati would render as tofu. Add **Noto Sans Devanagari** and **Noto Sans Gujarati**, and switch `font-family` by active language via a `[lang="hi"]` / `[lang="gu"]` rule in `app/src/index.css` (the `<html lang>` attribute is already set by `useLanguage()`).

### 6.5 Settings UI
A **Language** section in `YouScreen.tsx` — a three-way segmented selector (`English` / `हिंदी` / `ગુજરાતી`, each label in its own script so it is self-identifying), styled like the existing `Row` + `ThemeToggle`, calling the `useLanguage()` setter.

### 6.6 Phased implementation plan
| Phase | Work | Blocked? |
|---|---|---|
| **1 — Infra** | Install deps; `i18n/index.ts` init; empty `en/hi/gu.json` bundles; `useLanguage()` hook wired at app entry. | No |
| **2 — UI extraction** | Sweep all ~24 `.tsx` files, replacing hardcoded strings with `t()` keys. Priority by visibility: HomeScreen → YouScreen → Planner → ResultsScreen → StationDetail → LiveJourneyScreen → LineStatusPills → search. Interpolation & plurals via i18next. | No |
| **3 — Name data** | Add `nameHi`/`nameGu` to `stations.json` and `LINE_NAMES`; add the resolver with English fallback. | **Yes — needs an official GMRC name source (see §6.7)** |
| **4 — Formatting** | Localize durations/dates/distances via `Intl`; resolve the numeral-system decision. | No |
| **5 — Fonts** | Add Noto Devanagari + Gujarati; language-driven `font-family`. | No |
| **6 — Settings UI** | Language selector in `YouScreen.tsx`. | No |
| **7 — QA** | Per-language pass: no missing-key warnings, no tofu, no overflow (Indic strings run longer than English — check the collapsed sheet peek and buttons), correct `<html lang>`, persistence across reload. | No |

**Critical path:** Phases 1, 5, 6 are quick and ship a working switcher immediately. Phase 2 is the bulk mechanical effort. Phase 3 can proceed in parallel once the name source lands, and is the only hard dependency.

### 6.7 Open dependency — station & place name source
Hindi/Gujarati station, line, and landmark names **do not exist anywhere in the repo today.** GMRC station signage is trilingual, so authoritative names exist, but they must not be machine-transliterated and shipped unverified (54 proper nouns × 2 languages, plus landmarks). **Required input:** a table keyed on the existing `id` slugs in `stations.json` with Hindi + Gujarati columns (+ line and place names). Until it lands, Phase 3 stays stubbed and the UI falls back to English per name.

---

## 7. Success Criteria for Production Launch

1. **Performance & Installability:** App is installable per Chrome's current criteria (web app manifest + registered service worker, verified in DevTools → Application), and scores well on time-to-interactive. *Note: the standalone "PWA" Lighthouse category was removed in Lighthouse v12 (GoogleChrome/lighthouse#15535) and no longer exists — the original "100 Lighthouse PWA score" target is unmeasurable. Track Lighthouse **Performance** ≥ 90 for the TTI half instead.*
2. **Offline Resilience:** A user in airplane mode can successfully plan a multi-transfer journey and view the exact fare and time estimate.
3. **Data Accuracy:** Zero cases where an impossible trip (e.g. arriving after the last train leaves a transfer station) shows a completable ETA.
4. **Place Resolution:** Users can search for "GIFT City Club" or "Narendra Modi Stadium" and the app correctly routes them to the nearest metro station (GNLU / Motera) with a walking ETA tail.
5. **Fare Accuracy:** The fare shown for a trip matches GMRC's own published fare for that trip (see §5.4), never a fabricated or guessed number — if a route's distance can't be resolved, the app shows nothing rather than an incorrect figure.

---

## Change Log

- **2026-07-24** — Home nearest-station sheet redesigned (§4.1). Killed the duplicated station identity (the sheet body's hero repeated the name/line the sticky header already showed) via a `showHero` flag — the standalone `/stations/:id` SEO page keeps its hero. The header now carries a chip row (line · distance · walk when collapsed; line · phase · stop, plus interchange/status, when expanded); the collapsed peek is sized to the header so the "From here / To here" buttons no longer peek through the fold. The per-line schedule dropped its two direction tabs for a single time-sorted list of both directions, highlighting the next train each way. Trip entry became two buttons — **From here** (source) / **To here** (destination) — that open the GO planner as an overlay through an in-app `home-plan-trip` event; this also fixed the old "Plan Trip From Here" / "I want to catch this train" buttons, which navigated to a non-existent `/go` route and silently no-op'd. The redundant "catch this train" button was removed. Dead code and the SEO-page overlay gap are logged in DISCREPANCIES.md.
- **2026-07-23** — Added the Localization & Multilingual Support plan (§6, new section; Success Criteria renumbered §6→§7). Specifies English/Hindi/Gujarati via `react-i18next`, the split between UI-chrome and name-data translation surfaces, the Devanagari/Gujarati font requirement, a settings-screen selector (§4.5), and a 7-phase implementation plan. Blocked only on an official GMRC name source (§6.7). No code written yet — scope-first, per the doc's operating rule.
- **2026-07-23** — Map viewport constrained (§4.3). The home map is now fenced to the Ahmedabad–Gandhinagar area via Leaflet `maxBounds` + `maxBoundsViscosity: 1.0` (hard fence — the drag stops solid at the edge, no bounce-back), with a `minZoom` floor locking zoom-out and `maxZoom: 18` for close inspection.
- **2026-07-23** — Map rendering upgraded to real track geometry (§4.3). Station markers are now snapped onto the drawn track (previously they floated up to ~52m off the line once polylines switched from station chords to OSM geometry). Terminal markers are rotated perpendicular to the track. The live-trains layer — which had silently never rendered because it attached to a non-existent Leaflet renderer property (`_renderer._svg`; fixed to `_rootGroup`) — now works, and each train shows a direction-of-travel arrowhead. A stale `move zoom` listener leak in the same layer was also fixed, and three pre-existing TypeScript build errors cleared. See DISCREPANCIES.md (Resolved / Fixed, 2026-07-23).
- **2026-07-20** — Fare engine rebuilt from scratch on real GMRC data (§5.4). Previous fare logic was station-count-based, self-labelled a placeholder, and capped at ₹25 with no citation; it undercharged long trips by up to ₹15. CSC/NCMC 10% discount and the Phase 1/Phase 2 ticket restriction confirmed against GMRC's official pages and recorded in `app/src/data/metroInfo.json`.
