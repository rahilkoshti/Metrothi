# Metrothi — Product Requirements Document & Technical Blueprint

**Version:** 2.0 · **Date:** 2026-07-15 · **Owner:** Rahil
**Status:** Master reference. All future build work should trace back to this document. Changes to scope/architecture get made *here first*, then implemented.

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
- **Results screen:** Stop-by-stop list, total transfers, fare estimate, total time.
- **Ticket guidance card:** Advises on Token vs CSC vs NCMC requirements based on crossed phases.
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
- **Local Persistence:** Dexie.js (IndexedDB wrapper) for storing the transit graph, schedules, and offline user data.
- **Backend Stack:** Supabase (PostgreSQL, GoTrue for Auth, PostgREST for APIs).
- **Hosting:** Vercel (or Cloudflare Pages) with Edge caching.
- **Telemetry:** Sentry (Error tracking), PostHog (Product analytics with stringent PII stripping).

### 5.3 Local-First Sync Strategy
All transit graph data (stations, lines, schedules) is bundled with the PWA. User data (saved places) is written to Dexie.js *first* to ensure immediate UI updates, and asynchronously synced to Supabase if the user is authenticated.

---

## 6. Success Criteria for Production Launch

1. **Performance:** App achieves 100 Lighthouse score for PWA installability and time-to-interactive.
2. **Offline Resilience:** A user in airplane mode can successfully plan a multi-transfer journey and view the exact fare and time estimate.
3. **Data Accuracy:** Zero cases where an impossible trip (e.g. arriving after the last train leaves a transfer station) shows a completable ETA.
4. **Place Resolution:** Users can search for "GIFT City Club" or "Narendra Modi Stadium" and the app correctly routes them to the nearest metro station (GNLU / Motera) with a walking ETA tail.
