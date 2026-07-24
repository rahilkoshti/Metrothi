# Metrothi vs AhmMetro — Deep Comparison

> [!NOTE]
> Based on a live exploration of [ahmedabadmetro.site](https://www.ahmedabadmetro.site/) and a full code review of the Metrothi codebase.

> [!TIP]
> **Updated 2026-07-23.** Since the original comparison, Metrothi has shipped **real track polylines** and **animated live train markers** on the map (commit `468c12f`), and a full **SEO foundation** (meta/OG/Twitter tags, geo tags, `robots.txt`, `sitemap.xml`, and JSON-LD for `WebApplication`, `FAQPage`, `BreadcrumbList`, and all 54 stations). Rows below are marked accordingly.

---

## At a Glance

| Dimension | **Metrothi** | **AhmMetro** |
|---|---|---|
| **Stack** | React 19 + Vite + TS + Tailwind 4 + React Router 7 | Vanilla JS SPA (no framework) + Tailwind + Leaflet |
| **Architecture** | Feature-folder (`features/journey/engine/`, `features/map/`) with React Router pages | Single-page, modal-driven map app — everything is an overlay on the map |
| **Engine size** | ~1,100 lines, one monolith `journeyEngine.ts` + 85-line `fareEngine.ts` | Unknown (minified), but comparable timetable logic |
| **Lines supported** | 4 (blue, red, yellow/green, violet/purple) | 4 (blue, red, green, purple) |
| **PWA** | Yes (vite-plugin-pwa, precached) | Yes (service worker, install prompt in menu) |
| **Offline** | Full (bundled JSON, localStorage) | Full (offline-first) |
| **Map** | Leaflet, lazy-loaded, station markers, **real colored track polylines + animated live train markers** (shipped) | Leaflet, **real colored track polylines** on the map, animated train markers |
| **Routing** | Station-to-station + place-search (geocoding → nearest station) | Station-to-station only (no place search) |
| **Fare engine** | Distance-based slabs from GMRC data, with segment overrides | Fare calculator integrated in route results |
| **i18n** | English only | English + Gujarati toggle |
| **Dark mode** | Yes (CSS vars, ThemeContext) | Yes (toggle in menu) |
| **SEO** | **Solid foundation** (shipped) — JSON-LD (WebApplication, FAQPage, BreadcrumbList, ItemList of 54 stations), OG/Twitter cards, geo meta, keyword meta, `robots.txt`, `sitemap.xml`. Missing vs AhmMetro: hreflang, `/llms.txt`, dedicated social image | **Extremely heavy** — JSON-LD (WebApplication, FAQPage, BreadcrumbList, ItemList), OG/Twitter cards, keyword meta, geo meta, hreflang, structured FAQ |

---

## Structural / Architectural Differences

### 1. Page Architecture: Multi-page vs Map-first SPA

````carousel
**Metrothi** uses React Router with 5+ distinct pages:
- `/` → HomeScreen (nearest station, search, line status pills)
- `/go` → Planner (from/to inputs, depart/arrive toggle)
- `/results` → ResultsScreen (timeline, options)
- `/live` → LiveJourneyScreen (active journey tracking)
- `/map` → MapScreen (Leaflet, lazy-loaded)
- `/stations` → StationsDirectory
- `/stations/:id` → StationDetail
- `/you` → YouScreen (saved journeys, settings)

This is a traditional **tab-bar navigation** app with a bottom nav.
<!-- slide -->
**AhmMetro** is a **map-first SPA** — the map is *always* visible, and everything else (route planner, station info, settings, tips) is rendered as **modal overlays / bottom sheets** on top of the map.

There is **no tab bar, no routing** — just a hamburger menu (☰) that opens a sidebar with options like "Plan Route", "Daily Commute", "Metro Card" toggle, "Tips", "Install App".

This means the map is **always in context** — you're never navigating away from it.
````

> [!IMPORTANT]
> **Takeaway**: AhmMetro's map-first design means the user *always* has spatial context. When you tap a station on the map, you see its departures in a bottom sheet. When you plan a route, the map is right behind the modal. Metrothi navigates away from the map entirely when you go to `/go` or `/results`.

### 2. Engine: Monolith vs Unknown (but equivalent logic)

Both apps use the same fundamental approach:
- **Frequency-rule timetables** (trains every N minutes between time windows)
- **Direction-aware departure simulation** from terminals
- **Station offset calculation** (travel time from terminal to mid-line station)
- **Interchange buffer** for transfer wait

Metrothi's engine is **1,100 lines of well-documented TypeScript** in [journeyEngine.ts](file:///r:/Metrothi/app/src/features/journey/engine/journeyEngine.ts), with:
- `buildLegs()` for multi-line path-finding via the ordered `LINE_ORDER` chain
- `simulateFromDeparture()` for forward-simulation with interchange handling
- `getActiveTrains()` for live train interpolation
- `fullDayStationSchedule()` for complete timetable generation
- A separate [fareEngine.ts](file:///r:/Metrothi/app/src/features/journey/engine/fareEngine.ts) with real GMRC distance-based slabs

AhmMetro's engine is minified, so I can't compare line-for-line, but the *outputs* are equivalent — both show departure times, interchange waits, total duration, and fare.

### 3. Data Model: `stations.json` shape

Metrothi's `StationRecord` is rich:
```typescript
{
  id, name, line, secondLine?, secondLineOrder?,
  order, phase, terminal?, interchange?, operational?,
  needsVerification?, connectsTo?, notes?, lat, lng
}
```
It encodes **multi-line membership** (a station can belong to two lines via `secondLine`), **phase** (for ticket cross-phase rules), and **operational status**. This is more nuanced than what AhmMetro appears to expose.

### 4. Line Naming

| Metrothi | AhmMetro |
|---|---|
| blue | Blue Line |
| red | Red Line |
| yellow | Green Line |
| violet | Purple Line |

> [!WARNING]
> Metrothi calls Line 3 "**yellow**" internally, while AhmMetro (and GMRC's own branding) calls it "**Green Line**". Similarly, Metrothi calls Line 4 "**violet**" vs "**Purple Line**". This could confuse users who see "yellow" in any UI that leaks the internal name. The interchange station is called `motera-stadium` in Metrothi for the red↔yellow join, but AhmMetro calls it `Koteshwar Road` for the red↔green join. This suggests there may be a station-naming discrepancy worth investigating.

---

## What AhmMetro Does Better (Things to Learn)

### 🗺️ 1. Real Track Polylines on the Map ✅ SHIPPED

> [!NOTE]
> **Closed (commit `468c12f`).** Metrothi now draws real colored track polylines from `trackGeometry.ts` in [MapScreen.tsx](file:///r:/Metrothi/app/src/features/map/components/MapScreen.tsx), including route-leg highlighting and casing. This was previously the single biggest visual gap; it is now at parity with AhmMetro.

Originally: AhmMetro drew colored polylines tracing each metro line while Metrothi showed only station markers with no connecting tracks.

### 🚇 2. Animated Live Train Markers on the Map ✅ SHIPPED

> [!NOTE]
> **Closed (commit `468c12f`).** [LiveTrainsLayer.tsx](file:///r:/Metrothi/app/src/features/map/components/LiveTrainsLayer.tsx) now renders `getActiveTrains()` output as gliding train markers on the map during operating hours. The engine function was already there; it is now wired to Leaflet.

Originally: the map didn't render the interpolated train positions the engine computed.

### 📊 3. Crowd Indicators

Station departure lists show crowd levels: **"Heavy"** (red), **"Moderate"** (orange), **"Low"** (green) next to each upcoming train. This is likely simulated from frequency (peak hours = heavy), but it's a great UX signal that Metrothi doesn't have.

### 🇬🇺 4. Gujarati Language Support

Station names are shown bilingually (e.g., "Old High Court" / "જૂની હાય કોર્ટ"). Metrothi is English-only. For a local transit app in Gujarat, this is a meaningful gap.

### 🔍 5. SEO ✅ FOUNDATION SHIPPED (some depth still to close)

> [!NOTE]
> **Largely closed (2026-07-23).** Metrothi's [index.html](file:///r:/Metrothi/app/index.html) now has JSON-LD (`WebApplication`, `FAQPage`, `BreadcrumbList`, and an `ItemList` of all 54 stations generated from `stations.json`), full Open Graph + Twitter cards, geo meta tags, a keyword-rich description, plus [robots.txt](file:///r:/Metrothi/app/public/robots.txt) and [sitemap.xml](file:///r:/Metrothi/app/public/sitemap.xml).

Still missing vs AhmMetro:
- **hreflang** tags (blocked on Gujarati support — see §4 below)
- **`/llms.txt`** file for AI discoverability
- A dedicated **1200×630 social image** (currently `og:image` points at the 512px PWA icon as a placeholder)
- The canonical origin is wired to `https://metrothi.vercel.app`; confirm/replace with the real production domain before relying on canonical/sitemap URLs.

### 🏠 6. Daily Commute Feature

A "set Home and Work stations" feature for quick access. Metrothi's `YouScreen` has saved journeys and recent searches, but no dedicated commute shortcut.

### 🎫 7. Metro Card Discount Toggle

A toggle in the menu that applies the 10% NCMC/Smart Card discount to all displayed fares. Metrothi deliberately keeps the discount as "display-only text" and never applies it to the fare number — a design choice, but AhmMetro's approach is arguably more user-friendly.

### 📤 8. "Share this Ride" Button

A share button on route results. Metrothi doesn't have sharing.

---

## What Metrothi Does Better

### 🧠 1. Dramatically Deeper Engine Architecture

Metrothi's [journeyEngine.ts](file:///r:/Metrothi/app/src/features/journey/engine/journeyEngine.ts) is a **1,100-line, pure-TS, zero-React-dependency engine** with:

- **Direction-specific timetables** per terminal (e.g., `RED_APMC` vs `RED_MOTERA` have different first/last train times) — not just one flat schedule per line
- **Day-type differentiation**: weekday / Saturday / Sunday schedules for the Blue Line (AhmMetro appears to use a single schedule)
- **Binary-search departure grid** with caching (`DEPARTURE_GRID_CACHE`) for O(log n) next-departure lookup
- **Distance-weighted cumulative run times** (`buildCumulativeMins`) — segment times are proportional to actual haversine distance, not uniform
- **Full `arriveBy` mode** — plan backwards from a desired arrival time
- **Strand detection** — detects when a transfer would leave you stuck because the connecting line has ended service
- **Bus-only window handling** for the violet/purple line's midday gap
- **`estimateLineAtStation()`** that offsets terminal departure times by a station's position — AhmMetro likely does this too but Metrothi's implementation is explicit and well-documented

This is genuinely more sophisticated than what a typical transit app builds.

### 💰 2. Real GMRC Distance-Based Fare Engine

[fareEngine.ts](file:///r:/Metrothi/app/src/features/journey/engine/fareEngine.ts) uses **actual track segment distances** from GMRC data (`fares.json` segments), **distance slabs**, and **per-pair overrides** for edge cases where GMRC's internal chargeable distance differs from computed distance. This is *more accurate* than a simple lookup table.

### 🎫 3. Cross-Phase Ticket Validation

`getTicketOptions()` knows that crossing Ahmedabad ↔ Gandhinagar requires an NCMC card — tokens and CSC cards don't work. This is real regulatory knowledge baked into the engine.

### 🔀 4. Multiple Journey Options (Deeper)

`planJourney()` generates up to 200 upcoming departures and simulates each one independently through all legs, producing a full `JourneyOption[]` array. Each option has its own feasibility check, arrival time, and strand warnings. AhmMetro shows multiple departure cards too, but Metrothi simulates them all individually.

### 📍 5. Place Search / Geocoding

Metrothi supports searching for *places* (not just stations) via `GeocodingService.ts`, resolving them to the nearest station with walk time. AhmMetro only searches stations. (Though this feature has bugs per DISCREPANCIES.md.)

### 🏗️ 6. Typed, Testable, Maintainable Codebase

- Full TypeScript with exported interfaces (`PlanResult`, `JourneyOption`, `LegDetail`, etc.)
- Vitest test suite ([journeyEngine.test.ts](file:///r:/Metrothi/app/src/features/journey/engine/journeyEngine.test.ts), [fareEngine.test.ts](file:///r:/Metrothi/app/src/features/journey/engine/fareEngine.test.ts))
- Feature-folder organization (`features/journey/engine/`, `features/journey/components/`, `features/map/`)
- Engine is pure TS with zero React imports — fully unit-testable

AhmMetro appears to be vanilla JS (not TypeScript), which makes it harder to refactor and test.

### 🎨 7. Richer UI Screens

Metrothi has dedicated screens for:
- **LiveJourneyScreen** (28KB!) — real-time journey tracking with a step-by-step timeline
- **StationDetail** (19KB) — full day schedule with direction tabs and departure highlighting
- **TrainRouteSheet** — detailed route breakdown
- **YouScreen** — user preferences, saved journeys, settings
- **StationsDirectory** — browsable list of all stations

AhmMetro's station detail is a slim bottom sheet; Metrothi's is a full-featured page.

### ⏱️ 8. IST Timezone Handling

```typescript
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function toIST(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}
```
The engine forces IST regardless of device timezone — a visitor from another timezone still gets correct schedules. This is a subtle but critical correctness detail.

---

## Feature-Level Comparison Table

| Feature | Metrothi | AhmMetro |
|---|:---:|:---:|
| Journey planning | ✅ | ✅ |
| Multiple departure options | ✅ (up to 200) | ✅ (horizontal scroll cards) |
| Arrive-by mode | ✅ | ❓ |
| Interchange wait calculation | ✅ (flat 3 min) | ✅ (variable, shown as "9 min wait") |
| Strand detection (line ended) | ✅ | ❓ |
| Fare calculation | ✅ (distance slabs + overrides) | ✅ |
| Metro Card discount display | ⚠️ (text only) | ✅ (applied toggle) |
| Ticket type validation | ✅ (Token/CSC/NCMC) | ❌ |
| Track polylines on map | ✅ (shipped) | ✅ |
| Animated train markers | ✅ (shipped) | ✅ |
| Station detail page | ✅ (full page) | ✅ (bottom sheet) |
| Full day timetable | ✅ | ❓ |
| Crowd indicators | ❌ | ✅ (simulated) |
| Place search (geocoding) | ✅ (buggy) | ❌ |
| Nearest station | ✅ (with walk time) | ✅ (with walk time) |
| Live journey tracking | ✅ (dedicated screen) | ❌ |
| Saved journeys | ✅ | ❌ |
| Daily commute shortcut | ❌ | ✅ |
| Share route | ❌ | ✅ |
| Dark mode | ✅ | ✅ |
| Gujarati language | ❌ | ✅ |
| PWA / offline | ✅ | ✅ |
| SEO / structured data | ✅ (foundation shipped; hreflang + llms.txt + social image pending) | ✅✅✅ |
| TypeScript / tests | ✅ | ❌ |
| IST timezone safety | ✅ | ❓ |

---

## Key Recommendations

### Quick wins to steal from AhmMetro:
1. ✅ **Track polylines on the map** — *Done (commit `468c12f`).*
2. ✅ **Render `getActiveTrains()` on the map** — *Done (commit `468c12f`).*
3. ✅ **Add basic SEO** — *Done (2026-07-23):* OG/Twitter, meta description, geo tags, `robots.txt`, `sitemap.xml`, and JSON-LD (`WebApplication`, `FAQPage`, `BreadcrumbList`, station `ItemList`). Remaining SEO depth: hreflang, `/llms.txt`, a dedicated 1200×630 social image.
4. **Add "Share this route"** — trivial to implement with the Web Share API. *(Not started — top remaining quick win.)*
5. **Crowd level indicators** — derive from frequency rules (peak = heavy, off-peak = low). Pure UI sugar, no new data needed. *(Not started.)*

### Medium effort:
6. **Gujarati support** — add a `nameGu` field to `stations.json` and a language toggle.
7. **Metro Card discount toggle** — you already have the 10% logic documented; add a user preference that applies it to the displayed fare.
8. **Rename `yellow` → `green` and `violet` → `purple`** internally, or at minimum ensure the user-facing names match GMRC branding.

### Keep doing what you're doing:
- The typed, tested engine is a **major competitive advantage** for maintainability.
- The fare engine with GMRC-sourced distance data is more accurate than what AhmMetro appears to use.
- The `LiveJourneyScreen` with real-time progress tracking is a feature AhmMetro doesn't have.
- IST-safe timezone handling is a correctness detail most transit apps get wrong.
