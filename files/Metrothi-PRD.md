# Metrothi — Product Requirements Document & Technical Blueprint

**Version:** 2.0 · **Date:** 2026-07-15 · **Owner:** Rahil
**Status:** Master reference. All future build work should trace back to this document. Changes to scope/architecture get made *here first*, then implemented.
**Last updated:** 2026-07-20 — fare engine rebuilt on real GMRC data (§5.4). See Change Log at the bottom.

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

### Explicitly out of scope
- Real-time vehicle positions (no data source exists yet; architecture must support it *when* it drops).
- Ticket purchase / NCMC recharge (No GMRC API available; do not build financial transacting logic).

---

## 4. Information architecture — 5 tabs

```text
HOME        GO         MAP        STATIONS      YOU
dashboard   planner    network    directory     profile/
+ commute   + journey  map        + detail      settings
            mode                  pages
```

### 4.1 HOME — contextual dashboard
- **Greeting & Search:** Smart contextual greeting + "Where to?" place search.
- **Nearby card:** Nearest station, walk distance/ETA, live next-train status.
- **Your commute:** Machine-learned or saved daily commutes with immediate 1-tap ETA cards.
- **Service status strip:** Shows degraded-state alerts for any line not currently running.

### 4.2 GO — the heart of the product
- **From/To inputs:** Intelligent search resolving both station names and generic places (via Geocoding).
- **Results screen:** Stop-by-stop list, total transfers, fare, total time. Fare is computed from real GMRC distance data (§5.4), not an approximation, and is shown as `—` rather than a guess if a route's distance can't be resolved.
- **Ticket guidance card:** Advises on Token vs CSC vs NCMC requirements based on crossed phases, and notes the CSC/NCMC 10% discount (confirmed, §5.4) — display only, never folded into the fare shown.
- **Warning cards:** Feasibility warnings for last-train cutoffs or bus-only windows.
- **Journey Mode:** Actively transitions UI state as the user progresses geographically through their trip.

### 4.3 MAP
- **Interactive geographic map:** High-performance vector map (MapLibre/Leaflet).
- **Dynamic highlighting:** Dimming non-relevant lines and highlighting the active path during route planning.
- **Station Bottom Sheet:** Quick actions directly from the map viewport.

### 4.4 STATIONS
- **Directory & Live Details:** Grouped by line with interchange and phase badges.
- **Station Detail Pages:** Shows all live simulated departures per line.

### 4.5 YOU
- **Authentication:** Login/Signup flows powered by Supabase Auth.
- **Data Management:** Sync settings, clear local data, manage saved commutes and places.

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

## 6. Success Criteria for Production Launch

1. **Performance & Installability:** App is installable per Chrome's current criteria (web app manifest + registered service worker, verified in DevTools → Application), and scores well on time-to-interactive. *Note: the standalone "PWA" Lighthouse category was removed in Lighthouse v12 (GoogleChrome/lighthouse#15535) and no longer exists — the original "100 Lighthouse PWA score" target is unmeasurable. Track Lighthouse **Performance** ≥ 90 for the TTI half instead.*
2. **Offline Resilience:** A user in airplane mode can successfully plan a multi-transfer journey and view the exact fare and time estimate.
3. **Data Accuracy:** Zero cases where an impossible trip (e.g. arriving after the last train leaves a transfer station) shows a completable ETA.
4. **Place Resolution:** Users can search for "GIFT City Club" or "Narendra Modi Stadium" and the app correctly routes them to the nearest metro station (GNLU / Motera) with a walking ETA tail.
5. **Fare Accuracy:** The fare shown for a trip matches GMRC's own published fare for that trip (see §5.4), never a fabricated or guessed number — if a route's distance can't be resolved, the app shows nothing rather than an incorrect figure.

---

## Change Log

- **2026-07-20** — Fare engine rebuilt from scratch on real GMRC data (§5.4). Previous fare logic was station-count-based, self-labelled a placeholder, and capped at ₹25 with no citation; it undercharged long trips by up to ₹15. CSC/NCMC 10% discount and the Phase 1/Phase 2 ticket restriction confirmed against GMRC's official pages and recorded in `app/src/data/metroInfo.json`.
