# Metrothi — Product Requirements Document & Technical Blueprint

**Version:** 2.0 · **Date:** 2026-07-15 · **Owner:** Rahil
**Status:** Master reference. All future build work should trace back to this document. Changes to scope/architecture get made *here first*, then implemented.
**Last updated:** 2026-07-28 — station & passenger information scraped from GMRC (gates, lifts, multi-modal interchange, rules, facilities, contacts) and given a delivery plan: Station Info tab blocks (§4.4.1), reference pages under YOU (§4.5.1), last-mile arrival guidance (§4.2), the data layer and its sourcing rule (§5.6), and a phased rollout (§8). See Change Log at the bottom.

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
- **Nearest-station sheet:** A draggable bottom sheet anchored to the user's nearest station (or a default when location is denied). Three snaps — collapsed peek → mid → full — but the sheet **opens at mid**, not at the peek: the station's actions and next departures are the screen's primary content and shouldn't cost a drag.
- **Sheet header (sticky):** A **station photo** (see §4.6), an accent eyebrow ("Nearest station" / "Default station" / "Station"), the station name, and — right-aligned — a **walking-directions** icon button and a **save** toggle that persists to `localStorage['metrothi-saved-stations']`. There is deliberately **no line badge**: the first chip below already names the line, and the badge only repeated it.
  - **Walking directions** (shown only at the user's *nearest* station, where the walk is the next thing you actually do) hands off to **Google Maps walking directions** — street-level navigation is not something this app models. Origin is the live fix where available; Google Maps falls back to the device's own location otherwise. It stays a quiet icon rather than a button so it doesn't compete with Start Journey below.
  - **Save** is a bare bookmark icon when unsaved — the icon alone reads as "save" — and widens into a labelled "Saved" pill once set, so the state is confirmed in words.
- **Chip row:** **line · walk distance · walk time · Interchange**, all visible at **every** snap including the collapsed peek. Service status is folded into the line chip itself rather than carried as a separate pill: a running line shows its name alone, a line that isn't appends the reason ("Starts in 12m", "Service ended", "Bus only") in the same alert-toned pill. The structural and status chips used to be gated behind an expanded sheet to hold the row to one line; the peek now **grows with its header** (`max(collapsedHeight, headerH)`, base 118px), so a wrap costs nothing and nothing is cut off at the fold.
- **Upcoming Trains preview:** The first thing in the sheet body — above the action, since the departures are what you came for. The next departure in each direction, for every line the station serves (2 cards at a through-station, 4 at an interchange, 1 per line at a terminal), rendered with the shared `DepartureRow` (§4.6). A green "Live" marker appears while any of the station's lines is running. **View all →** opens the full station page.
- **Sheet body — action:** A single primary **Start Journey** button below the departures. Which end of the trip the station fills depends on proximity: at the **nearest** station you're standing at the origin, so it seeds the *source*; anywhere else you're looking at somewhere you want to get to, so it seeds the *destination*. Either way it fires the in-app `home-plan-trip` event, so the planner opens as an overlay with the map still mounted beneath.
- **Merged schedule:** Below the preview, each line's full-day schedule lists **both directions in one time-sorted list** (no direction tabs), greying past departures and highlighting the next train each way. Tapping any train opens its full stop-by-stop route.
- **Sheet sizing & gestures:** The mid snap is **fitted to its own content**, not a fixed fraction — it measures the departures + action block and rests exactly at that block's bottom edge, so the schedule below never peeks through the fold on a normal station. It's floored so the sheet can never take more than **~60% of the screen** — raised from an earlier ~88% cap, which on a 4-card interchange left too thin a map strip for the floating controls (see DISCREPANCIES.md, resolved 2026-07-28); a big interchange's departures now scroll within the mid snap rather than all fitting above the fold. A tap on the header **climbs** the ladder (collapsed → mid → full, full → mid); a tap on the **map surface collapses** the sheet to its peek. Leaflet suppresses the map tap after a pan, and station markers don't trigger it — tapping a marker selects that station and raises the sheet to mid.
- **Map framing:** The map's centre nudge tracks the sheet's *resting* height rather than the collapsed peek, so the selected station's marker lands in the middle of the exposed map band instead of hugging the sheet's edge.
- **Map hidden while covered:** When nothing of the map is on screen — the sheet fully raised, or the search / planner overlay open, all three being opaque and full-bleed — the map is hidden outright (`visibility: hidden` on a wrapper, so no paint and no compositing) and its live-train ticker is stopped (§4.3). Two rules make this safe:
  - The map **never unmounts**. Remounting Leaflet would drop the user's pan and zoom, and `visibility` preserves its size, so there is nothing to restore on the way back. The wrapper's background matches the sheet's, so the strip under the sheet's rounded top corners stays seamless.
  - "Covered" is read from the sheet's **live position**, not its `snap` prop (`DraggableSheet`'s `onCoverageChange`). The map therefore stays painted for the whole drag or spring and only goes dark once the sheet has actually arrived — gating on `snap` would blank it the instant the animation *started*.
- **Service status strip:** Degraded-state pills for any line not currently running; tapping one opens search focused on that line.

### 4.2 GO — the heart of the product
- **From/To inputs:** Intelligent search resolving both station names and generic places (via Geocoding).
- **Results screen:** Stop-by-stop list, total transfers, fare, total time. Fare is computed from real GMRC distance data (§5.4), not an approximation, and is shown as `—` rather than a guess if a route's distance can't be resolved.
- **Summary sheet (mid snap):** The planned trip's summary lives in the home sheet, built around **one hero figure and one supporting column** rather than a row of equal stats.
  - **Hero — "Leave in N"** (or "Leave · Now", or "Leave now — tight" in amber). The rider has exactly one thing to do next, so the countdown to it gets the only large number. Urgency reads off the countdown itself; colour only intervenes for a tight connection, where "now" isn't quite enough.
  - **Beside it — the trip as a span:** `depart → arrive`, with **time actually spent on a train** underneath and the fare appended. Only the arrival carries a meridiem — the pair almost always shares one. Laid out as two columns on one row rather than stacked, because stacking cost ~70px and pushed Start Journey below the sheet's mid snap.
  - **Departure picker:** a **fixed four-cell segmented row**, not a scroller — four cells always fit, so nothing is clipped by the fold and it doesn't compete with the sheet's own vertical drag. Each cell is only the clock time; the countdown lives once, in the hero this control drives. The meridiem is printed timetable-style, only when it changes. Difference is carried by **colour, not opacity** (a dimmed cell reads as disabled, and infeasible and tight options are both still selectable). It renders even when the current selection is infeasible — that is precisely when the rider needs to switch.
  - **Walk disclosure:** door-to-door plans append "Includes N walking", summed rather than split by end, since the route timeline below names each walk in full.
  - Arrival is **not** repeated in the sheet header above: the header owns the route's *static* facts (stops, transfers), the summary owns the chosen departure's, which change under it every time the picker moves. Carrying arrival in both printed the same clock time twice, one above the other.
- **Ticket guidance card:** Advises on Token vs CSC vs NCMC requirements based on crossed phases, and notes the CSC/NCMC 10% discount (confirmed, §5.4) — display only, never folded into the fare shown. Rendered as a quiet aside rather than a third coloured block competing with the picker and the CTA. *Planned:* where it already tells a rider they need an NCMC, `metroInfo.purchase` lets it say **where to get one** in the same breath — counter (cash/UPI/card) or the GMRC app — instead of leaving them to find out at the gate.
- **Arrival & last-mile guidance (planned):** The destination station's exit information is the natural close of a journey, and it is the one place the physical-station data (§5.6) is *decision-making-in-the-moment* rather than reference. On the results screen's destination row, and again on the Live Journey **Arrived** state (§4.2 Journey Mode), show the destination's step-free gate and — on the 10 stations that have one — its onward connection: *"Step-free exit at Gate 3 · BRTS via the skywalk at Gate 3"* at Sabarmati. This is precisely the "first- and last-mile connectivity" GMRC's MMI page exists to describe, and it lands at the moment the rider needs it rather than in a settings page they'd have read yesterday. Suppressed silently where the station has no published connection — same no-false-negative rule as §4.4.1.
- **Warning cards:** Feasibility warnings for last-train cutoffs or bus-only windows. An infeasible selection replaces the hero with a "Route Not Possible" card naming the line you'd be stranded at, and the Start Journey CTA is withheld.
- **All trains list:** Every departure for the day below the summary. Rows show the **train's own departure time** (matching the picker above, not the door-to-door leave time, which is a minute or two earlier and made one train read as two) and the **ride time** (§5.5, not `totalMins`).
- **Journey Mode:** Actively transitions UI state as the user progresses geographically through their trip.

### 4.3 MAP
- **Interactive geographic map:** High-performance vector map (MapLibre/Leaflet).
- **Real track geometry:** Line polylines are drawn from actual OpenStreetMap rail geometry (`app/src/data/tracks.json`, `map/geometry/trackGeometry.ts`), not straight station-to-station chords. Each line degrades gracefully to the chord if track data is missing.
- **Snapped station markers:** Station markers are projected onto the drawn track (via each station's `stationKm`) so they sit *on* the line rather than beside it. Terminal (end-of-line) markers are rectangular "buffer caps" rotated to sit **perpendicular to the track direction** at that point, computed in Web Mercator so the angle matches the rendered polyline.
- **Live simulated trains:** Schedule-derived trains glide along the real track (`LiveTrainsLayer`), interpolated by segment progress, updating every second. Each train marker carries a **direction-of-travel arrowhead** pointing the way the train is heading, so the map reads as live movement. (Positions remain simulation from the timetable, per §1 principle 1 — no live feed is implied.)
  - **Paused while covered:** rebuilding every train's SVG once a second is the map's only continuous cost, so the ticker stops whenever the map can't be seen (§4.1), and a pan or zoom while paused doesn't redraw either. Resuming **ticks immediately** rather than waiting out the interval — positions held over from before the pause are stale by however long it lasted. The pause is driven by the owner, deliberately **not** by `document.visibilityState`: browsers already throttle background timers hard, and the dev preview reports itself hidden while plainly on screen, which would leave the map trainless throughout.
- **Constrained viewport:** The map is fenced to the metro's footprint so users never wander off into empty map. Implemented with Leaflet `maxBounds` (the network bounding box padded ~25%, i.e. Ahmedabad through Gandhinagar/GIFT City) + `maxBoundsViscosity: 1.0`, so the drag stops solid at the edge (a hard fence, no bounce-back). Zoom is floored at `minZoom` (can't zoom out past seeing the whole network) and capped at `maxZoom: 18` (free to inspect any section up close). Panning is unrestricted *within* the box at any zoom.
- **Dynamic highlighting:** Dimming non-relevant lines and highlighting the active path during route planning.
- **Station Bottom Sheet:** Quick actions directly from the map viewport.

### 4.4 STATIONS
- **Directory & Live Details:** Grouped by line with interchange and phase badges. *Planned:* a **connection facet** — "connects to BRTS / GSRTC / Railways" — over `stationsWithMode()` (§5.6). Ten stations, four modes; cheap to build and it answers a question the directory currently can't ("where can I pick up the BRTS?").
- **Search keywords (planned):** `fuzzySearch.ts` matches station names only, so a visitor searching *"railway"* finds nothing, though Kalupur, Gandhigram, AEC and Mahatma Mandir all physically connect to one. Feed each station's `multiModal.modes` in as **non-displayed keyword aliases** — ranked below a name match, never overriding one — so "BRTS", "bus", "railway" and "airport-style" mode words resolve to real stations. This directly serves the visitor persona (§2), who knows the mode, not the station name.
- **Station Detail Pages:** `/stations/:id` shows all live simulated departures per line. It is a real route (the SEO/deep-link surface) and is reached from the sheet's **View all →**. The same full-day schedule also lives further down the home sheet at its full snap, so the two are alternative ways to the same content — see the open item in `DISCREPANCIES.md`.
- **Shared body:** `StationDetailBody` renders the schedule for both the standalone page and the home sheet, so the two can't drift. Two flags adapt it: `showHero` (the sheet already names the station in its header) and `showActions` (the sheet supplies its own Start Journey action, so the page's **From here / To here** buttons are suppressed there). Phase and stop-of-N remain on the standalone page's hero; they were dropped from the sheet's chip row.
- **Merged schedule anchoring:** the full-day list parks the first still-upcoming train at the **top** of the scroller and keeps it there as departures roll past. The offset is derived from bounding rects rather than `offsetTop`, which is measured from the nearest positioned ancestor and not the scroller, so it stays correct however the sheet above is laid out. The first anchor is a **jump**, not a smooth scroll — animating from an arbitrary mount position is what reads as "the list loaded mid-scroll".

#### 4.4.1 Station Info tab — physical station data (planned)

The **Station Info** tab (the second of `StationDetailBody`'s two tabs, beside **Schedule**) currently shows only what the topology and the timetable already knew: line count, phase, stop-of-N, operational status, interchange/terminus, and today's first/last train. `stationFacilities.json` (§5.6) adds the station's *physical* facts, which is what someone standing outside it actually needs. Three new blocks, in this order — nearest-term need first:

1. **Entrances.** Which numbered gates are open (`gates`), rendered from `formatGateList()`. This is the highest-value fact in the whole dataset: at Old High Court six of eight gates are open and at Ranip only three of four, and picking the wrong one costs a road crossing. Gate **numbers match the signage**, which is why GMRC's numbering is reproduced verbatim rather than re-indexed to 1..n.
2. **Step-free access.** The gates with a lift (`accessibleGates()`), named with GMRC's own lift numbers so they match the signage too. Stated **positively** — "Step-free entry at Gates 1 & 3" — never as "Gates 2 and 4 have no lift": GMRC publishes where lifts *are*, and inferring their absence elsewhere from that is a claim the source does not make. Every one of the 53 listed stations has at least one lift, so this block always renders when the station is listed.
3. **Connections.** Only on the **10 stations** that have one (`multiModal`): a mode chip per `modes` entry (BRTS / GSRTC buses / Indian Railways / High-speed rail) over GMRC's verbatim `connections[].text`, each tied to the gate it uses — "BRTS · Lift and Skywalk at Gate 5" at AEC. Because `connections[].gate` is validated at scrape time against the same station's operational gates, this cross-references block 1 rather than contradicting it. The block is keyed off having *something* to say, not off `modes`: PDEU carries an `amenities` entry (parking, from a rendering's caption — so it shows GMRC's `sourceNote` in fine print) with no interchange at all, and keying off modes would drop its one published fact. `plannedAmenities` is not rendered, since planned is not built.

**Structure** (`elevated` / `underground`) joins the existing Station Overview tiles — replacing nothing, since it answers a different question from the four already there, and it matters: four stations are underground, where the street-to-platform walk is longer and GPS dies at the concourse.

**Absent data is absent.** 43 stations have no `multiModal` and the Connections block simply does not render for them — no "No connections nearby" line, which would be a false negative (GMRC publishes *built interchanges*, not the presence or absence of bus stops). `sabarmati-railway-station` returns `null` from `stationFacilities()` entirely; it is not yet operational, the Status tile already says so, and all three blocks close up. This is the `stationImages.ts` rule (§4.6) applied to facts instead of photos.

**Chip row.** `multiModal.modes` is also a candidate for a conditional chip in the sheet's chip row (§4.1) — "BRTS" at Vadaj tells a rider something that changes their plan, and it appears on only 10 stations so it never crowds the other 44. It is **not** committed until it's been checked at 375px: the row already carries four chips and wraps under the collapsed fold if pushed.

### 4.5 YOU
- **Authentication:** Login/Signup flows powered by Supabase Auth.
- **Data Management:** Sync settings, clear local data, manage saved commutes and places.
- **Language:** A three-way selector (English / हिंदी / ગુજરાતી) sets the app-wide interface language, styled like the existing theme toggle. Planned — see §6.6.

#### 4.5.1 Reference content — "Riding the metro" & "Help" (planned)

Everything in `passengerInfo.json` and the non-fare half of `metroInfo.json` (§5.6) is **reference content**: read rarely, but the app is worthless to an occasional rider or a visitor (§2) without it. It belongs in YOU rather than on the map, because none of it is decision-making-in-the-moment data — with one exception noted below. Two new sections, using the existing `SectionHeader` + `Row` primitives:

**"Riding the metro"** — five rows, each opening one reference page:

| Row | Source | Why a rider opens it |
|---|---|---|
| **Fares & ticket rules** | `metroInfo.json` — `fareMedia`, `fareProducts`, `purchase`, `ticketValidity`, `timeInPaidArea`, `concessions`, `discounts`, `refunds`, `phaseRestriction`, `ticketConditions`, `penalties` | "Which ticket, bought where, valid for how long, and what happens if I get it wrong." Answers the cross-city traveler's *"why doesn't my token work?"* (§2) at leisure, where the GO ticket card (§4.2) only warns in passing. |
| **Do's & don'ts** | `passengerInfo.dosAndDonts` — 9 dos, 14 don'ts | First-time riders. Several are genuinely non-obvious (no eating in the paid area, no sharing one ticket across a group). |
| **Prohibited items** | `passengerInfo.prohibitedItems` — dangerous, offensive, live animals, each with its exception, under the Metro Rail (O&M) Act 2002 | "Can I bring this." The pets answer alone justifies the row. |
| **Facilities & accessibility** | `passengerInfo.facilities` — 10 general, 8 accessibility | Network-wide, deliberately split from the per-station data. Ends with a pointer to the Station Info tab (§4.4.1), which is where lift-by-gate lives. |
| **Safety & emergency** | `passengerInfo.emergencyFacilities` — 11 items grouped by `location` (platform / station / train / both) | Grouped by *where the thing is*, not listed flat: "on the platform" and "in the train" are how you'd look for it. |

**"Help & contact"** — four rows:

- **Customer care** — `contact.customerCare`, with the phone and email as **`tel:` and `mailto:` actions**, not copyable text. Carries GMRC's own scope note (operational matters only) so nobody emails passenger care about a tender.
- **Lost & found** — `lostAndFound`. Office, hours, `tel:`/`mailto:`, the four claim rules, and the six-month disposal deadline. The live found-items list is **not** bundled (it changes weekly); the row links out to `listingUrl` instead.
- **Official GMRC app** — `officialApp`, platform-aware. Metrothi does not and will not sell tickets (§3, out of scope), so the honest move is to name the app that does rather than dead-end the user.
- **GMRC on the web** — `officialLinks` (12) and `social` (5). Every reference page also carries a "Read the original on gujaratmetrorail.com" footer link to its own source, so a rider can always check us against GMRC.

**About & Data** gains a provenance row for this data — source and `_meta.scrapedOn` — matching the existing timetable/fares/live-estimates rows. This is principle 1 (§1) applied to reference content: the rider can see how old it is.

**Feedback** keeps its two existing rows and gains GMRC's `feedbackUrl`, clearly separated: reporting a *timetable error in Metrothi* goes to us, a complaint about *the metro* goes to GMRC.

**Considered and rejected — emergency info outside settings.** A quiet "Emergency" affordance on the Live Journey screen (§4.2) was considered and dropped. Reading a list of equipment on a phone is not what anyone does in an emergency, and our own source says why: the platform has a stop plunger, the train has a passenger alarm, and the station has a helpline. An app that inserts itself between a rider and those is worse than one that stays out of the way. The content stays informational, in settings, where it's read *before* it's needed.

### 4.6 Shared UI primitives

- **`DepartureRow`** (`features/journey/components/DepartureRow.tsx`) — one departure card: a line-tinted initial badge, "Towards X", a subtitle, and one big figure on the right. Shared by the station sheet's departure board and the station page's full-day schedule so the two can't drift apart. A `primary` prop picks which figure takes the big right-hand slot and pushes the other into the subtitle: the sheet leads with the **countdown** (clock time below), the full-day schedule leads with the **departure time**, since the timetable itself is what you're reading there. Renders as a `button` only when given an `onClick`, a `div` otherwise. Departed rows dim and strike through; the highlighted "next" row is tinted with the line colour.
- **`InfoPage`** (planned, `features/info/InfoPage.tsx`) — one generic reference-content screen, not nine hand-built ones. The pages in §4.5.1 differ only in their content, and that content is already structured in JSON, so they render from a shared block model: `list` (bulleted, e.g. the don'ts), `keyValue` (e.g. luggage limits, penalties), `prose`, `actions` (`tel:` / `mailto:` / external), and `sourceLink`. A registry (`features/info/topics.ts`) maps a topic slug to `{ title, blocks }` built from the JSON, and each topic is a real deep-linkable route `/you/:topic` — reference content is exactly the kind of thing a rider gets sent a link to, the same argument that makes `/stations/:id` a real route (§4.4). Nine screens hand-built against nine JSON shapes would drift; one component against one block model can't. Reference JSON is **dynamically imported** by this route so 12 KB of do's-and-donts prose stays out of the boot path of a map-first app (§5.6).
- **Station photos** (`features/journey/stationImages.ts`) — photos of the stations themselves, keyed by station id. Only stations that have **actually been shot** appear: there is **no placeholder and no per-line stand-in**, because a photo of the wrong station is worse than no photo in a wayfinding app. `stationImage(id)` returns `null` on a miss and callers must handle it — the sheet header simply closes the row up. Assets are square (the slots that use them are), pre-cropped on the station structure, and compressed at build-input time rather than resized in CSS from a multi-megabyte original. The photo is decorative — the station's name sits right beside it — so it carries an empty `alt`. Currently: Doordarshan Kendra.

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
- **Operational facts:** Concessions, luggage limits, penalties, refund policy, ticket validity windows, and the Phase 1/Phase 2 token & CSC restriction were scraped from GMRC's official `fare-rules`, `smart-cards`, `national-common-mobility-card-ncmc`, and `train-information` pages and stored in `app/src/data/metroInfo.json`, with per-fact source quotes and any figure GMRC doesn't state left `null` rather than filled in from third-party sources. Re-read in full on 2026-07-28, adding `purchase` (where and how tickets are actually bought), `ticketConditions` (10 rules the earlier pass missed — screenshots of a QR are invalid, reverse-direction travel is not permitted, a dead phone is not an excuse), two overstepping penalties, and the two paper fare media. Its destination is now specified: the **Fares & ticket rules** page under YOU (§4.5.1), with the GO ticket card (§4.2) as the in-context excerpt.
  - One cross-source tension is recorded rather than resolved: the fare-rules and NCMC pages describe NCMC purely as a bank-issued product, while the MMI page says it is "available at every station". Both are kept, with the discrepancy noted in `cards.ncmc.alsoAtStationsNote`, because picking a winner would be us deciding which GMRC page is wrong.

### 5.5 Reported durations — ride time vs `totalMins`

A journey option carries two different notions of "how long", and the UI must not confuse them.

- **`totalMins`** is the platform wait **plus** the ride. It is the correct figure for "when will I be there", and it is what the arrival clock time is derived from.
- **`rideMinsOf(option)`** is the time from **boarding to arrival**. It excludes the *first* leg's wait — that is the platform wait, and it is already expressed as a countdown ("Leave in N") wherever it matters — but **includes every later leg's wait**, because interchange time is time you genuinely spend on the trip.

Anything labelled as the trip's own duration uses `rideMinsOf`, never `totalMins`. Doubling the platform wait into the duration is what made a plan opened at 4am bill an 8-minute hop as a **2h 17m journey**, in the largest type on the screen. The helper takes anything carrying `legs`, so it works on a `JourneyOption` or on the plan, and returns `null` when there are none.

### 5.6 Station & passenger reference data

Everything the app knows about stations as *places* and about riding the metro as an *activity*, scraped from GMRC's own pages on 2026-07-28. Three files, split by who consumes them:

| File | Shape | Consumed by |
|---|---|---|
| `app/src/data/stationFacilities.json` | `stations[id]` → `structure`, `gates[]`, `lifts[{lift, gates[]}]`, optional `multiModal` | Station Info tab (§4.4.1), arrival guidance (§4.2), search (below) |
| `app/src/data/passengerInfo.json` | `facilities`, `emergencyFacilities`, `dosAndDonts`, `prohibitedItems`, `contact`, `lostAndFound`, `social`, `officialApp`, `officialLinks` | YOU reference pages (§4.5.1) |
| `app/src/data/metroInfo.json` | fare, ticketing and card rules (extended 2026-07-28 with `purchase`, `ticketConditions`, two overstepping penalties, two paper fare media) | GO ticket card (§4.2), Fares & ticket rules page (§4.5.1) |

**Access.** `features/journey/stationFacilities.ts` mirrors the `stationImages.ts` pattern: `stationFacilities(id)` returns the record or `null`, plus `accessibleGates()`, `formatGateList()` and `stationsWithMode()`. Typed at the accessor, JSON imported directly, per the repo convention.

**Sourcing rule — the same one as `fares.json` and `stations.json`.** Only facts GMRC states appear. Nothing is filled in from a wiki, a blog or a transit aggregator, and every file carries a `_meta.rule` saying so with per-fact source URLs. Two consequences worth stating plainly, because both look like bugs otherwise:
- **Never published per station:** toilets, Wi-Fi, ATMs, feeder-bus *routes*, and **gate landmarks** — the gate table numbers gates but never says which road each opens onto. Gate 3 is therefore "Gate 3", not "Gate 3 (Ashram Road)". A landmark per gate is the single highest-value missing field in this dataset; it would need a survey, not a scrape.
- **`multiModal` is on 10 of 53 stations.** Its absence means "GMRC lists no *built* interchange here", never "no buses nearby", and the UI must not render it as a negative (§4.4.1).

**Regeneration.** `node scripts/fetch-station-facilities.mjs` re-scrapes both source pages and rebuilds `stationFacilities.json`. It is defensive by design, because a silent mis-scrape here attaches one station's entrances to another: it throws if either page's table count changes, warns on any station name it can't map (both pages name stations differently — "Vadaj Metro Station" vs "Vadaj", "Kalupur Rly. Station"), re-validates the two Phase-2 facts that exist only as prose and an image caption, and **cross-checks every Entry-Exit cited by the MMI page against that station's operational gates**. All 10 currently pass, which is independent confirmation the cross-page name mapping is right. `passengerInfo.json` is hand-maintained: two of its sources are poster JPEGs with no machine-readable text.

**Staleness.** GMRC edits these pages — gates open, MMI extends with Phase 2A/2B. `_meta.scrapedOn` is surfaced in About & Data (§4.5.1) and re-running the script belongs on the release checklist. `_meta.notCovered` currently lists `sabarmati-railway-station` and should shrink to empty when it opens.

**Bundle & offline.** ~44 KB raw across the three files, bundled and precached like the rest of the transit data (§5.3), so every reference page works in airplane mode — which is the point, since the concourse of an underground station is exactly where you have no signal and want to know which gate has the lift. `stationFacilities.json` sits in the main bundle (the station sheet is boot-critical); `passengerInfo.json` is dynamically imported by the `/you/:topic` route (§4.6), since reference prose has no business in the boot path.

**What this data does *not* unblock.** §5.1's flat 3-minute interchange buffer still needs a per-station walking matrix. Knowing a station is elevated or underground does not supply one, and in any case all three interchanges (Old High Court, Motera Stadium, GNLU) are elevated, so `structure` cannot even discriminate between them. That item stays open.

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
| **3 — Name data** | Add `nameHi`/`nameGu` to `stations.json` and `LINE_NAMES`; add the resolver with English fallback. | **Yes — needs an official GMRC name source (see §6.8)** |
| **4 — Formatting** | Localize durations/dates/distances via `Intl`; resolve the numeral-system decision. | No |
| **5 — Fonts** | Add Noto Devanagari + Gujarati; language-driven `font-family`. | No |
| **6 — Settings UI** | Language selector in `YouScreen.tsx`. | No |
| **7 — QA** | Per-language pass: no missing-key warnings, no tofu, no overflow (Indic strings run longer than English — check the collapsed sheet peek and buttons), correct `<html lang>`, persistence across reload. | No |

**Critical path:** Phases 1, 5, 6 are quick and ship a working switcher immediately. Phase 2 is the bulk mechanical effort. Phase 3 can proceed in parallel once the name source lands, and is the only hard dependency.

### 6.7 Third surface — scraped GMRC reference content

§6.2 splits translation into UI chrome and name data. The reference content added in §5.6 is a **third surface** with different rules again, and it is the largest body of prose in the app: ~30 rules and ~30 list items of official, partly legal text (penalties, the Metro Rail (O&M) Act 2002 prohibited-items list, ticket conditions).

**We must not translate it ourselves.** Machine- or hand-translating GMRC's penalty and prohibited-items wording into Hindi and Gujarati would put words in a transport authority's mouth on matters where a rider could be fined, and it fails the same test §6.8 applies to station names.

**We don't have to.** GMRC's own Do's & Don'ts and Prohibited Items posters are **trilingual** — Gujarati, Hindi and English side by side in the same image, already transcribed for English in `passengerInfo.json`. So for those two topics the authoritative translations exist at the same source and need only the same transcription pass, which makes them **unblocked**, unlike the station names of §6.8.

Per-topic disposition:

| Topic | Hi/Gu source | Status |
|---|---|---|
| Do's & don'ts, Prohibited items | The same GMRC posters, other two columns | **Unblocked** — transcribe alongside the English pass |
| Fares & ticket rules, Facilities, Safety & emergency | English-only on gujaratmetrorail.com | **Blocked** — falls back to English with an explicit "Available in English only from GMRC" note, rather than a silent untranslated block |
| Contact / lost & found / links | Phone numbers, emails, URLs | Not translatable content; only the surrounding labels are UI chrome (§6.2) |

Structurally this means `passengerInfo.json` gains parallel `*_hi` / `*_gu` arrays for the two poster topics only, resolved with per-string English fallback — the same resolver shape as §6.2's station names, not a second mechanism.

### 6.8 Open dependency — station & place name source
Hindi/Gujarati station, line, and landmark names **do not exist anywhere in the repo today.** GMRC station signage is trilingual, so authoritative names exist, but they must not be machine-transliterated and shipped unverified (54 proper nouns × 2 languages, plus landmarks). **Required input:** a table keyed on the existing `id` slugs in `stations.json` with Hindi + Gujarati columns (+ line and place names). Until it lands, Phase 3 stays stubbed and the UI falls back to English per name.

---

## 7. Success Criteria for Production Launch

1. **Performance & Installability:** App is installable per Chrome's current criteria (web app manifest + registered service worker, verified in DevTools → Application), and scores well on time-to-interactive. *Note: the standalone "PWA" Lighthouse category was removed in Lighthouse v12 (GoogleChrome/lighthouse#15535) and no longer exists — the original "100 Lighthouse PWA score" target is unmeasurable. Track Lighthouse **Performance** ≥ 90 for the TTI half instead.*
2. **Offline Resilience:** A user in airplane mode can successfully plan a multi-transfer journey and view the exact fare and time estimate.
3. **Data Accuracy:** Zero cases where an impossible trip (e.g. arriving after the last train leaves a transfer station) shows a completable ETA.
4. **Place Resolution:** Users can search for "GIFT City Club" or "Narendra Modi Stadium" and the app correctly routes them to the nearest metro station (GNLU / Motera) with a walking ETA tail.
5. **Fare Accuracy:** The fare shown for a trip matches GMRC's own published fare for that trip (see §5.4), never a fabricated or guessed number — if a route's distance can't be resolved, the app shows nothing rather than an incorrect figure.
6. **Station Fact Accuracy:** Every physical claim the app makes about a station — gate numbers, lift locations, structure, onward connections — traces to a GMRC page (§5.6). No amenity is invented, inferred, or imported from a third party, and no absence is rendered as a negative ("no lift here", "no connections"). Sending someone to a gate that isn't open is a worse failure than saying nothing, in the same way a photo of the wrong station is (§4.6).

---

## 8. Delivery plan — station & passenger information

Ordered by rider value per unit of work. Phases 1–3 are unblocked and independent; nothing here depends on auth, sync, or the map.

| Phase | Work | Surfaces | Blocked? |
|---|---|---|---|
| **1 — Station Info tab** ✅ *shipped 2026-07-28* | Entrances, step-free access and Connections blocks; `structure` tile; update the stale `StationInfoPanel` doc-comment (§4.4.1). | `StationDetail.tsx` | No |
| **2 — Reference pages** ✅ *shipped 2026-07-29* | `InfoPage` + topic registry (§4.6); the nine rows of §4.5.1 wired into two new YOU sections as **eight pages plus one direct store link**; `tel:`/`mailto:` actions; About & Data provenance read from `_meta`; `/you/:topic` routes with dynamic import. | `YouScreen.tsx`, new `features/info/` | No |
| **3 — Last-mile guidance** | Destination exit gate + onward connection on the results screen and the Live Journey **Arrived** state (§4.2). | `JourneySummary`, `LiveJourneyScreen` | No |
| **4 — Discovery** | `multiModal.modes` as search keyword aliases; connection facet in the STATIONS directory (§4.4). | `fuzzySearch.ts`, directory | No |
| **5 — Chip row** | Conditional connection chip in the station sheet — **only if** it survives a 375px check without pushing the row under the fold (§4.4.1). | `HomeScreen.tsx` | No — but may be rejected on measurement |
| **6 — Ticket card depth** | `metroInfo.purchase` folded into the GO ticket guidance card (§4.2). | `JourneySummary` | No |
| **7 — Localization** | Transcribe the Gujarati/Hindi columns of the two GMRC posters; English-only note on the remaining topics (§6.7). | `passengerInfo.json` | Only by §6 shipping first |

**Critical path:** Phases 1 and 2 are shipped. Phase 3 is next and is the last item that changes what a rider sees mid-journey; 4–6 are refinements, and phase 5 is the only item that could be cut outright.

**Not planned, and why:** a per-gate landmark ("Gate 3 — Ashram Road side") would be the single most useful addition to the Station Info tab and is the one thing GMRC does not publish (§5.6). It needs a physical survey of 53 stations. Until someone does that survey it stays out — inventing it from map data would fail §7.6.

---

## Change Log

- **2026-07-29** — **§8 phase 2 shipped.** The reference content of §4.5.1 is reachable: one generic `InfoPage` over a block model (`features/info/`), a topic registry, and eight deep-linkable `/you/:topic` routes behind `React.lazy`, reached from two new YOU sections placed **above** Preferences/Saved/History so live content isn't buried under three sections of Phase-4 stubs. Deviations from §4.5.1 as written, all deliberate: the **official GMRC app is a row, not a page** (two store URLs and a sentence do not earn a screen — the row opens the right store per platform); **prohibited items is reordered** to pets and luggage before the statutory lists, since GMRC's order is the Act's and the rider's question is "can I bring my dog"; **`metroInfo.luggage` renders on that page too**, because "can I bring this" includes size; and there is **no `numbered` list marker** — every GMRC list is a set of rules, not a sequence, and numbering a set invents an order. The block model gained `chips`, `linkList` and `definitions` beyond §4.6's five, each mapping to an idiom the Station Info tab already uses. §6.7 stays satisfiable: blocks hold strings, never composed JSX, so the Hindi/Gujarati resolver can swap them per language. **Bundle note worth keeping:** a named JSON import does *not* tree-shake per key — Vite emits one module per file, so any boot-path import drags the whole file into the main chunk. Confirmed by grepping the built output, not assumed; see `DISCREPANCIES.md`.

- **2026-07-28** — **§8 phase 1 shipped.** The Station Info tab now renders the physical station data: Entrances (a chip per open gate, GMRC's numbering, no invented denominator), Step-free access (lift→gate rows under a positive summary line), and Connections on the 10 stations that have one. `structure` joined the Station Overview tiles as a full-width fifth tile. One deviation from §4.4.1 as written: the Connections block is keyed off having *anything* to say rather than off `modes`, because `pdeu` has an amenity (parking) and no interchange — otherwise its only published fact would render nowhere. `plannedAmenities` stays unrendered; planned is not built.

- **2026-07-28** — Station & passenger information scraped from GMRC and given a delivery plan (§4.2, §4.4, §4.4.1, §4.5.1, §4.6, §5.4, §5.6, §6.7, §7.6, new §8). No UI written yet — scope-first, per this doc's operating rule.
  - **New data (§5.6).** `stationFacilities.json` — 53 of 54 stations, with structure (elevated/underground), operational gate numbers, lift→gate mapping, and multi-modal interchange on the 10 stations that have one, scraped from GMRC's entry/exit-gate page and its Multi Modal Integration page. `passengerInfo.json` — network facilities, do's & don'ts, prohibited items, emergency equipment, customer care, lost & found, official links. `metroInfo.json` extended after a full re-read of the fare-rules page. Regenerated by `scripts/fetch-station-facilities.mjs`, which throws on a page-shape change and cross-checks every MMI-cited Entry-Exit against that station's operational gates (all 10 pass, confirming the cross-page name mapping).
  - **Corrects an earlier claim.** The 2026-07-20 pass concluded GMRC publishes no per-station amenity data. The MMI page does, for 10 stations, and it is the most useful station data found so far. Still genuinely absent per station: toilets, Wi-Fi, ATMs, feeder-bus routes, and **gate landmarks** — the gate table numbers gates but never says which road each opens onto (§5.6, §8).
  - **Station Info tab (§4.4.1).** Gets Entrances / Step-free access / Connections blocks. Its doc-comment currently asserts no amenity data exists and is now half-wrong; logged in DISCREPANCIES.md. Step-free access is stated **positively** only — GMRC publishes where lifts are, so "Gate 2 has no lift" is a claim the source doesn't make.
  - **Reference content in YOU (§4.5.1).** Two new sections, nine topics, rendering through one generic `InfoPage` (§4.6) against a block model rather than nine hand-built screens. Deep-linkable at `/you/:topic`; JSON dynamically imported so reference prose stays out of the boot path.
  - **Last-mile guidance (§4.2).** The one place this data is in-the-moment rather than reference: the destination's step-free exit and onward connection, on the results screen and the Live Journey **Arrived** state.
  - **Emergency info deliberately kept in settings.** A Live Journey emergency affordance was considered and rejected — the platform's stop plunger and the train's passenger alarm are the right channel mid-emergency, and our own source says so.
  - **Localization gained a third surface (§6.7, old §6.7 renumbered §6.8).** GMRC's Do's & Don'ts and Prohibited Items posters are trilingual, so those two topics are **unblocked** for Hindi/Gujarati — unlike station names. The remaining topics are English-only at source and will say so rather than silently showing untranslated text. We do not translate GMRC's penalty or legal wording ourselves.
  - **New success criterion §7.6** — every physical station claim traces to a GMRC page; no invented amenity, no absence rendered as a negative.
- **2026-07-28** — Interchange sheet overflow and map-recenter accuracy fixed (§4.1); text selection disabled app-wide.
  - **Mid-snap cap.** `DraggableSheet`'s fitted mid snap was floored at `h * 0.12` (free to grow to ~88% of viewport) — on a 4-card interchange it measured 715px of an 812px screen, leaving only a 97px map strip once the search pill and line-status strip took their share, crowding out the floating Plan-route FAB and Recentre button. Floor raised to `h * 0.4`, capping the sheet at ~60% (~325px of map on the same viewport); a big interchange's departures now scroll within the mid snap instead of all fitting above the fold. Logged and resolved in DISCREPANCIES.md.
  - **Map recenter/pan accuracy.** `HomeScreen`'s `sheetInset` — the offset fed to `HomeMap` for both the recenter button and the pan-to-station nudge — was a fixed `midRatio` approximation that ignored the sheet's actual `snap` state, so recentering always shifted the map as if the sheet were at mid, even when it was collapsed or fitted taller on an interchange. Replaced with `sheetEdge`, the live rest-height measurement `DraggableSheet` already reports for the floating-control fit check (§4.1's "Map framing").
  - **Text selection.** `user-select: none` added to `html, body` (`index.css`), re-enabled on `input`/`textarea`, so dragging the sheet or a card no longer highlights text on desktop.
- **2026-07-27** — Journey summary rebuilt, station sheet header reworked, map paused while covered (§4.1, §4.2, §4.3, §4.6, §5.5).
  - **Ride time vs total time.** New `rideMinsOf` in the engine (§5.5) — boarding to arrival, excluding the *first* leg's platform wait but including interchange waits. Every "how long is this trip" figure in `JourneySummary` and `AllTrainsList` now uses it. Previously they showed `totalMins`, which is wait + ride, so a plan opened at 4am billed an 8-minute hop as a **2h 17m journey** in the screen's largest type. `AllTrainsList` also switched its row time to the train's own `departClockTime`; the door-to-door leave time is a minute or two earlier and made one train read as two different departures.
  - **Journey summary.** The row of three equal stats (fare / journey / arrival) became **one hero and one supporting column**: a large "Leave in N" countdown against a `depart → arrive` span with ride time and fare beneath. Arrival was dropped from the sheet header above, which had been printing the same clock time twice. The horizontal departure scroller became a **fixed four-cell segmented picker** — it can't be clipped by the fold and doesn't fight the sheet's vertical drag — and now renders for infeasible selections too, which is exactly when the rider needs to switch. The ticket note dropped to a quiet aside. Two columns rather than stacked because stacking pushed Start Journey below the mid snap.
  - **Station sheet header.** Line badge → **station photo** (new `stationImages.ts`, §4.6; no placeholder — a photo of the wrong station is worse than none). Star/"Favorite" → **bookmark** icon that widens to a "Saved" pill when set. Walking directions moved out of the body into a quiet header icon at the nearest station only; `openWalkingDirections` was extracted from `StationSheetActions` for it. Service status folded into the line chip instead of a separate pill, and the whole chip row now shows at **every** snap — the collapsed peek grows with its header rather than clipping it.
  - **Station sheet body.** The **Get Directions / Station Details** pair collapsed to a single **Start Journey** CTA, now *below* the departures rather than above them. It seeds the planner's **source** at the nearest station and its **destination** anywhere else. Removing "Station Details" leaves "View all →" as the sheet's only route away — logged in DISCREPANCIES.md.
  - **Shared `DepartureRow`** (§4.6) extracted from the two hand-rolled departure lists in `UpcomingTrains` and the station page's merged schedule, which had drifted apart. The merged schedule also now anchors the next train to the top of the scroller, measured from bounding rects rather than `offsetTop` (which is relative to the nearest positioned ancestor, not the scroller).
  - **Map paused while covered.** `HomeMap`/`LiveTrainsLayer` gained a `paused` prop and `DraggableSheet` an `onCoverageChange` callback. With the sheet fully raised or an overlay open, the map is hidden via `visibility` (never unmounted — that would drop pan/zoom) and the once-a-second train redraw stops. Coverage is read from the sheet's **live position**, not its `snap`, so the map stays painted for the whole animation. Resume ticks immediately rather than leaving stale positions up for another second.
- **2026-07-26** — Home station sheet rebuilt against a supplied design reference (§4.1, §4.4).
  - **Resting position.** The sheet now opens at **mid** instead of the collapsed peek, and its mid snap is **fitted to its own content** rather than a fixed fraction of the viewport. `DraggableSheet` gained an optional `midContentHeight`; `HomeScreen` measures the actions + departures block with a `ResizeObserver` and feeds it through. Measured rather than derived from constants because card count, chip-row wrapping and the location notice all move it. Floored at ~12% of the viewport so the sheet can never swallow the whole map. Verified at 375×812: a 4-card interchange shows all four cards with the schedule below the fold; a 2-card terminal rests ~150px lower.
  - **Header.** Chevron replaced by a **Favorite** toggle (`localStorage['metrothi-saved-stations']`, new `useSavedStations` hook). Eyebrow tinted with the accent; title 19→22px. Proximity chips (line · distance · walk) now show at *every* snap instead of only when collapsed. **Phase** and **Stop N of M** chips were removed from the sheet; they remain on the standalone `/stations/:id` hero. The inline Interchange tag moved out of the eyebrow into the chip row — at 375px it wrapped to a second line and pushed the chip row below the collapsed fold.
  - **Actions.** "From here / To here" replaced by **Get Directions** / **Station Details** (new `stationSheet/StationSheetActions`). The primary button splits on proximity: at the nearest station it is *Get Directions* and hands off to **Google Maps walking directions**; at any other station it is *Trip to here* and seeds the in-app planner. **Station Details** expands the sheet to full rather than routing to `/stations/:id` — the detail is already further down the same sheet. `StationDetailBody` gained `showActions` so its own button pair doesn't double up.
  - **Upcoming Trains.** New `stationSheet/UpcomingTrains` preview: next departure per direction per line, with a live marker and **View all →** to the station page. The full-day merged schedule continues below it — the preview is additive, nothing was removed.
  - **Gestures.** A header tap now **climbs** the snap ladder (collapsed → mid → full, full → mid) instead of dismissing to collapsed, matching the planned-route header. A tap on the **map surface** collapses the sheet (Leaflet's map-level `click`, so station markers — which don't bubble — still select and raise instead).
  - **Map framing.** `HomeMap`'s `bottomInset` now tracks the sheet's resting height instead of the hardcoded collapsed peek; the selected station's marker sits mid-band rather than against the sheet edge.
  - Known trade-offs and deferred items logged in DISCREPANCIES.md.
- **2026-07-24** — Home nearest-station sheet redesigned (§4.1). Killed the duplicated station identity (the sheet body's hero repeated the name/line the sticky header already showed) via a `showHero` flag — the standalone `/stations/:id` SEO page keeps its hero. The header now carries a chip row (line · distance · walk when collapsed; line · phase · stop, plus interchange/status, when expanded); the collapsed peek is sized to the header so the "From here / To here" buttons no longer peek through the fold. The per-line schedule dropped its two direction tabs for a single time-sorted list of both directions, highlighting the next train each way. Trip entry became two buttons — **From here** (source) / **To here** (destination) — that open the GO planner as an overlay through an in-app `home-plan-trip` event; this also fixed the old "Plan Trip From Here" / "I want to catch this train" buttons, which navigated to a non-existent `/go` route and silently no-op'd. The redundant "catch this train" button was removed. Dead code and the SEO-page overlay gap are logged in DISCREPANCIES.md.
- **2026-07-23** — Added the Localization & Multilingual Support plan (§6, new section; Success Criteria renumbered §6→§7). Specifies English/Hindi/Gujarati via `react-i18next`, the split between UI-chrome and name-data translation surfaces, the Devanagari/Gujarati font requirement, a settings-screen selector (§4.5), and a 7-phase implementation plan. Blocked only on an official GMRC name source (§6.7). No code written yet — scope-first, per the doc's operating rule.
- **2026-07-23** — Map viewport constrained (§4.3). The home map is now fenced to the Ahmedabad–Gandhinagar area via Leaflet `maxBounds` + `maxBoundsViscosity: 1.0` (hard fence — the drag stops solid at the edge, no bounce-back), with a `minZoom` floor locking zoom-out and `maxZoom: 18` for close inspection.
- **2026-07-23** — Map rendering upgraded to real track geometry (§4.3). Station markers are now snapped onto the drawn track (previously they floated up to ~52m off the line once polylines switched from station chords to OSM geometry). Terminal markers are rotated perpendicular to the track. The live-trains layer — which had silently never rendered because it attached to a non-existent Leaflet renderer property (`_renderer._svg`; fixed to `_rootGroup`) — now works, and each train shows a direction-of-travel arrowhead. A stale `move zoom` listener leak in the same layer was also fixed, and three pre-existing TypeScript build errors cleared. See DISCREPANCIES.md (Resolved / Fixed, 2026-07-23).
- **2026-07-20** — Fare engine rebuilt from scratch on real GMRC data (§5.4). Previous fare logic was station-count-based, self-labelled a placeholder, and capped at ₹25 with no citation; it undercharged long trips by up to ₹15. CSC/NCMC 10% discount and the Phase 1/Phase 2 ticket restriction confirmed against GMRC's official pages and recorded in `app/src/data/metroInfo.json`.
