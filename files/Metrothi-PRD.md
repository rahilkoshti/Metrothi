# Metrothi — Product Requirements Document & Technical Blueprint

**Version:** 1.1 · **Date:** 2026-07-11 · **Owner:** Rahil
**Status:** Master reference. All future build work should trace back to this document. Changes to scope/architecture get made *here first*, then implemented.

---

## 1. Product vision

Metrothi is the app the Ahmedabad Metro should have shipped: open it, and within two seconds you know **which station to walk to, when the next train actually leaves, and exactly how to get where you're going** — including what ticket works, where to change lines, and whether the trip is even possible right now.

**One-line pitch:** Uber-simple journey planning for the Ahmedabad–Gandhinagar metro, honest about what the schedule can and can't promise.

### Guiding principles
1. **Honesty over illusion.** GMRC publishes no live vehicle feed. We never fake "live tracking" — we simulate from the real timetable and say so. If a trip can't be completed today, we say "not possible," never a fabricated ETA.
2. **Works without asking anything.** No login, no signup, no permission walls for core features. GPS improves the experience but is never required.
3. **Functionality before beauty.** UI stays minimal black/white until every flow, state, and edge case works. Design pass comes after the product is frozen.
4. **Local-first.** Core features (nearest station, journey planning, schedule estimates) must work offline once data is cached.

---

## 2. Users & core jobs-to-be-done

| User | Job |
|---|---|
| Daily commuter | "Get me to work; tell me when to leave and warn me if my usual route is disrupted." |
| Occasional rider | "I don't know the network. Which station, which line, which ticket, how much?" |
| Cross-city traveler (Ahmedabad ↔ Gandhinagar/GIFT City) | "Is this trip possible right now, what does it cost, and why doesn't my token work?" |
| Visitor/tourist | "I know my destination *place*, not a station name. Route me anyway." (Phase 4+) |

---

## 3. Scope

### In scope (product)
- Nearest-station detection (GPS) with walking ETA
- Schedule-based live estimates ("next train in X min") per line/station
- Journey planner: any station → any station, incl. multi-transfer
- Upcoming-departures picker ("catch a later train")
- Feasibility checking (last-train cutoffs, bus-only windows)
- Ticket-type guidance (token/CSC/NCMC, cross-phase rule)
- Fare display (placeholder slabs until real data sourced)
- Interactive metro map, station detail pages, saved places, journey mode (later phases)

### Explicitly out of scope
- Real-time vehicle positions (no data source exists)
- Ticket purchase / NCMC recharge (no GMRC API; do not build card features)
- Multi-modal routing beyond first/last-mile walking hints (no bus/auto integration in v1)
- Phone-OTP auth (complexity + cost; Google/Apple/email only, and only in Phase 5)

---

## 4. Information architecture — 5 tabs

```
HOME        GO         MAP        STATIONS      YOU
dashboard   planner    network    directory     profile/
+ commute   + journey  map        + detail      settings
            mode                  pages
```

### 4.1 HOME — contextual dashboard
**Status: Built ✅**

Implemented features:
- Greeting ("Good morning/afternoon/evening") + "Where to?" destination search → triggers GO planner with `nearest` as source
- **Nearby card:** nearest station, walk distance/ETA, live next-train status (running / before-first-train / after-last-train / bus-only) — with locating skeleton and GPS-denied fallback
- **Service status strip:** shows degraded-state alerts for any line not currently running (only renders if at least one line is non-running)
- **Your commute** placeholder card (Phase 4)
- **Recent** placeholder card (Phase 4)

Not yet built: recent searches persistence, saved-journey commute card.

### 4.2 GO — the heart of the product
**Status: Built ✅ (core flow complete)**

Implemented features:
- From/To station inputs with live search (filters out non-operational stations)
- Auto-fills "From" with nearest station (GPS); shows walk distance + service status for source
- Swap button, same-station validation, location-off notice
- Prefill source from StationDetail "Plan Trip From Here" (via React Router state)
- **Results screen:** source → dest header, total stops + transfers, fare estimate, total time, depart-in countdown
- **Ticket guidance card:** NCMC-only warning for cross-phase trips; token/CSC/NCMC note for same-phase
- **Warning cards:** bus-only window, before-first-train, after-last-train, stranded-at-interchange
- **Infeasible banner:** blocks display of fake ETAs when trip is impossible
- **Departure options:** up to 5 upcoming trains, selectable, each with depart/arrive clock time and feasibility state
- **Route detail:** full stop-by-stop list with line color dots, interchange "Change here" callouts, Opening Soon badge

Not yet built: destination-as-place resolver, Journey Mode.

### 4.3 MAP
**Status: Built ✅**

Implemented features:
- Interactive geographic map (Leaflet) with dark/light mode tiles.
- Custom styled React markers that pulse when selected.
- **Station Bottom Sheet:** Tapping a station slides up a context-preserving panel with live departures and quick routing actions.
- **In-Map Route Planning:** "Directions To/From Here" allows plotting a route directly on the map, dimming non-relevant lines and highlighting the path.
- **Floating Action Controls:** Location FAB to snap to GPS, and Layers FAB to toggle visibility of specific metro lines.

### 4.4 STATIONS
**Status: Built ✅**

Implemented features:
- Searchable directory grouped by line (Blue → Red → Yellow → Violet)
- Live station count per line group
- Interchange badge, Phase badge, Opening Soon badge per station row
- Tap-through to **Station Detail**:
  - Station name, phase, interchange/not-yet-operational tags
  - "Plan Trip From Here" button (prefills GO planner source)
  - **Live departures** per line (or both lines for interchange stations), auto-refreshing every 60s
  - Handles non-operational station gracefully (no fake departures)

### 4.5 YOU
**Status: Coming Soon placeholder ✅**

Saved places, saved journeys, history, preferences (Phase 4–5). Auth (Phase 5).

---

## 5. Screen & state inventory

Every screen must handle all of: **loading / ready / empty / error / degraded**.

| Screen | States built |
|---|---|
| Home | locating skeleton · GPS granted · GPS denied (fallback station + amber notice) · service degraded strip · after-last-train |
| GO planner | idle · searching (live suggestions) · same-station error · non-operational station blocked from search results |
| Results | feasible · **infeasible/stranded** (blocking red banner, no fake ETA) · warnings (bus-only, before-first-train) · zero remaining departures |
| Departure options | selectable cards · infeasible cards (greyed + "stuck at Line X") |
| Station detail | normal · interchange (two live estimate blocks) · not-yet-operational (alert, no fake departures) |
| Map | Geographic base, animated route highlighting, interactive bottom sheet, floating action controls |
| Journey Mode | Live active state tracking (Walking, Waiting, On Train, Transferring), debug simulation mode |

---

## 6. Journey engine (built ✅)

Pure TS, zero React imports. Lives in `features/journey/engine/journeyEngine.ts`. UI only ever calls it and renders results.

### 6.1 Network model
4 lines as **ordered station arrays** (`LINE_PATHS`), interchanges placed at their true mid-line positions:
- **Blue** Vastral Gam ↔ Thaltej Gam (17 stn) · **Red** APMC ↔ Motera Stadium (15) · **Yellow** Motera Stadium ↔ Mahatma Mandir (21) · **Violet** GNLU ↔ GIFT City (3)
- Interchanges: Old High Court (B↔R), Motera Stadium (R↔Y), GNLU (Y↔V)

**Deliberate decision:** index-walking on ordered arrays, **not** Dijkstra/A*. The network is a chain with zero alternate routes between any station pair, so graph search adds complexity for identical answers. Revisit *only if* GMRC adds a line creating route choice.

### 6.2 `planJourney(sourceId, destId, {now})` returns
`source, dest, legs[] (line, waitMins, travelMins, bufferMins, currentFrequencyMins, status), stops[], totalStops, numTransfers, travelMins, initialWaitMins, totalMins, feasible, strandedAtLine, fare, ticketInfo, crossesPhase, usesViolet, warnings[], options[]`

### 6.3 Rules encoded
- **Transfer buffer:** flat 3 min per interchange (placeholder until per-station data)
- **Projected-time waits:** each leg's wait computed at the moment you'd *actually arrive* there, not at t=0 — this is what catches "fine now, stranded at the transfer"
- **Feasibility:** any leg hitting after-last-train ⇒ `feasible:false` + `strandedAtLine`; UI shows blocking banner, never a fake total. Source line already closed ⇒ immediate infeasible, zero options.
- **Tickets:** cross-phase (Ahmedabad↔Gandhinagar) ⇒ NCMC only; same-phase ⇒ token/CSC/NCMC all valid, NCMC −10%
- **Fares:** slab lookup on `totalStops` — **placeholder numbers, must not ship as real** (see §9)
- **Walking:** 5 km/h → `walkMinsForKm()`
- **Formatting:** ≥60 min always renders as `1h 05m`

### 6.4 Live estimate (`estimateLine`, built ✅)
Simulates departures forward from first train through hand-transcribed frequency bands (weekday peak/off-peak, Sat, Sun, late-night, Violet bus-only 10:18–16:06). Returns `running | before-first-train | after-last-train | bus-only`. Direction-agnostic (headways symmetric in practice). Bands are transcribed from the official timetable image — **schedule revision ⇒ manual re-transcription required** (see §9).

### 6.5 Future: `TransitDataProvider` abstraction
UI asks `getNextTrains()`; today answered by `TimetableProvider` (our simulation), someday by `GMRCAPIProvider` / realtime, without UI changes. Adopt when scaffolding the real codebase (Phase 2).

---

## 7. Journey Mode — state machine (Phase 3/4)

Pressing **Start Journey** creates a `JourneySession { journeyId, route, startedAt, currentStep, currentStation, nextStation, transferStation, destination, status }`.

```
NOT_STARTED → WALKING_TO_STATION → WAITING_FOR_TRAIN → ON_TRAIN
→ APPROACHING_TRANSFER → TRANSFERRING → (loop back to WAITING)
→ APPROACHING_DESTINATION → FINAL_WALK → COMPLETED
```

Transitions driven by GPS proximity + elapsed schedule time. Build as an explicit state machine, **never** if/else soup. Each state defines: what's on screen, what notification can fire, what transition exits it.

---

## 8. Architecture & stack

```
UI (React) → Hooks → Services → Data sources
```
Never let components talk directly to storage/APIs/engine internals.

**Services layer (current):** `LocationService` (wraps `navigator.geolocation`; nothing else calls it directly; eases native migration).

**Stack (adopt per phase, not all upfront):** React + TypeScript + Vite + Tailwind + React Router · Zustand + TanStack Query **only when real server state exists** · Dexie/IndexedDB (Phase 4) · Supabase auth+DB with RLS on every user table (Phase 5) · MapLibre+OSM (evaluate vs Google on cost) · Vercel/Cloudflare · Sentry · PostHog.

**Folder structure:** feature-first (`features/journey/{components,engine}`), shared `components/ui`, `services/`, `data/`. Expand to full `{components,hooks,services,engine,types}` split in Phase 2.

**Local-first sync (Phase 5):** save locally → update UI immediately → sync to cloud if logged in. Guest users get the full app; account = backup/sync only.

**Security:** frontend never trusted; no secret keys in React; Supabase Edge Functions for sensitive ops; RLS on; validate/sanitize/rate-limit all input.

**Analytics:** app opened, journey searched/selected/started/completed, station viewed, place saved, account created. **No precise location history collection.**

---

## 9. Known gaps & risks (living list)

| # | Gap | Impact | Plan |
|---|---|---|---|
| 1 | Fares are placeholder | Can't ship fare display as truth | Source real slabs (station RTI/notice boards/manual survey); label "estimate" until then |
| 2 | Timetable bands hand-transcribed | Schedule revision silently breaks estimates | "Check for updates" tool (deferred): fetch site, diff, human-approve before overwrite |
| 3 | Flat 3-min transfer buffer | Slight ETA error at interchanges | Per-station buffers when measurable |
| 4 | Flat avg segment time per line | Mid-line ETAs approximate | Swap in real per-segment times if ever published (`avgSegmentMins` is single change point) |
| 5 | Vastral Gam coordinates need verify | Wrong nearest-station result near Vastral | Manual verify vs route map; note: the `vastral` duplicate has been removed |
| 6 | Mahatma Mandir pin ≈ Convention Centre landmark | Minor walking-ETA error | Refine pin to confirmed station entrance |
| 7 | GPS blocked in artifact preview/iframe | Dev confusion only | Sandbox limitation, not a bug; works deployed |
| 8 | No live vehicle data exists | "Live" is simulation | Keep honest labeling; provider abstraction ready if feed appears |
| 9 | Sabarmati Rly Stn opening date unknown | Data flip needed on opening | `operational:false` flag set; paths already include it; flip when confirmed open |
| 10 | Interchange stations only listed under primary line in directory | UX gap — searching Red Line misses Old High Court | Phase 2 enhancement: cross-reference or dual-list interchange stations |
| 11 | Engine doesn't distinguish direction per terminus | Assumes symmetric headways | True in practice; revisit if GMRC ever publishes direction-specific timetables |

---

## 10. Build phases & current position

- **Phase 1 — Prototype every screen/flow/state ◕ COMPLETE.**
  - Done: HOME dashboard, GO planner + results + Live Journey Mode, STATIONS directory + detail, MAP interactive routing tab.
- **Phase 2 — Real codebase: COMPLETE.** Vite+TS scaffold, feature folders, router, port engine.
- **Phase 3 — Engine hardening:** (In Progress) Journey Mode state machine, connections data, timetable-update tool.
- **Phase 4 — Local-first:** Dexie, saved places/journeys, history, preferences, destination-as-place resolver (geocode → nearest station → walk+metro+walk).
- **Phase 5 — Accounts:** Supabase auth (Google/Apple/email), RLS, local→cloud sync.
- **Phase 6 — Production:** PWA/service worker (offline shell + data + route calc), push notifications ("leave in 10 min", "last metro"), Sentry, PostHog, hardening, deploy.

**Rule:** finish Phase 1 completely — every screen, every state — before writing Phase 2 code. Scope changes get written into this document first.

---

## 11. Success criteria (v1 launch)

1. Cold open → correct nearest station + honest next-train in <2s (warm cache)
2. Any station pair → correct route, stops, transfers, ETA, ticket rule — verified against manual timetable checks
3. Zero cases where an impossible trip shows a completable ETA
4. Core planner works in airplane mode after first load (Phase 6)
5. A first-time GIFT City visitor can answer "which ticket do I need?" without external help
