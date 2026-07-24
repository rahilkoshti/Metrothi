# Metrothi — UI/UX Parity Plan (Google Maps reference)

> **Purpose.** Bring Metrothi's journey surfaces in line with the Google Maps
> reference screens in `files/UI-UX-inspiration/`. This doc is split into
> **independent phases**, each meant to be executed in its own fresh chat.
> Read the **"Shared context"** section first, then jump to the phase you're
> assigned. Everything you need to do a phase is inside that phase's section.

---

## How to use this document

- Each phase below is **self-contained**. In a fresh chat, paste/point to this
  file and say which phase to run. Don't assume any prior conversation.
- Phases are ordered cheapest/lowest-risk → highest. Recommended order:
  **1 → 2 → 3 → 4**. Phase 4 benefits from Phase 3's pinned-action-bar pattern
  but does not hard-depend on it.
- **Do not** start a phase before its **"Preconditions"** are met.
- When a phase is done, tick its **Acceptance criteria** and note anything
  deferred in `DISCREPANCIES.md` (see conventions).

---

## Shared context (read before any phase)

### The app
- Metrothi is a **metro-only** journey app for the Ahmedabad Metro (React + Vite
  + TypeScript + Tailwind, Leaflet map, framer-motion for animation/gesture).
- Primary working dir: `R:\Metrothi`. App source lives under `app/src`.
- The home experience is a **map with a draggable bottom sheet**. The sheet has
  three *modes* driven by `journeyMode` in
  [`HomeScreen.tsx`](../app/src/features/journey/components/HomeScreen.tsx):
  - `station` — default: nearest/selected station detail.
  - `plan` — a route is planned but not started (summary + timeline).
  - `live` — a journey is underway.
- The map (`HomeMap`) stays **mounted** across all modes; planning and the live
  view overlay it. Never wrap the sheet in a full-bleed container — it will
  swallow map gestures.

### Product decisions already made (do not re-litigate)
1. **Live view = map-first rewrite** (Phase 4). The current vertical timeline is
   re-housed as an expandable detail sheet, not deleted.
2. **Adapt to metro, drop Google's multimodal chrome.** No car/bike/walk mode
   row, no "Add stops", no "Avoid tolls/highways". No Home/Work saved-places
   feature for now. Keep metro semantics: Leave now / Depart at / Arrive by,
   Save, Share.

### Reference screenshots (`files/UI-UX-inspiration/`)
| File | Maps to | Phase |
|---|---|---|
| `search-bar-dropdown.jpeg` | `HomeSearch.tsx` (search overlay) | 1 |
| `GO-button-journey-planner.jpeg` | `Planner.tsx` (directions entry) | 2 |
| `journey-summary.jpeg` | plan-mode sheet, **mid** snap | 3 |
| `journey-summary-minimized.jpeg` | plan-mode sheet, **collapsed** snap | 3 |
| `journey-summary-expanded.jpeg` | plan-mode sheet, **full** snap | 3 |
| `live-active-journey.jpeg` | `LiveJourneyScreen.tsx` (live nav) | 4 |

> These are **Google Maps** frames — use them for layout/hierarchy/interaction
> grammar, **not** literal content (no "diesel", "tolls", street maneuvers).
> Translate each element to its metro equivalent as spelled out per phase.

### Working conventions (project memory — honour these)
- **DISCREPANCIES.md**: out-of-scope bugs found mid-task get **appended to
  `R:\Metrothi\DISCREPANCIES.md`**, not fixed inline.
- **Check existing idiom first**: framer-motion is already the animation/gesture
  library. Grep the repo before hand-rolling primitives (e.g. the sheet uses
  `DraggableSheet`; animation uses `motion`).
- **Preview screenshots hang on the map**: the always-on train animation makes
  Browser-pane screenshots time out on the map screen. **Verify via
  `read_page` / `javascript_tool` measurements**, not screenshots, whenever the
  map is on screen.
- **CSS transitions hang on the animated map**: runtime style toggles on Leaflet
  panes never settle. Apply target styles instantly (no CSS transition) for
  anything layered on the map.
- **Viewport height**: use `100dvh` (`min-h-[100dvh]`), never `100vh` /
  `min-h-screen`, so mobile toolbars don't clip the UI.
- **Touch targets ≥ 44px.**

### Running & verifying (do this once at the start of a phase)
1. Only **one** dev server should own port **5173** (the Browser-pane proxy
   targets it). If another chat's server holds it, free the port before
   starting yours, then `preview_start` the `dev` config from
   `.claude/launch.json`.
2. Verify with `read_page` for structure and `javascript_tool` for computed
   sizes/positions. Example height check:
   ```js
   [...document.querySelectorAll('button')]
     .filter(b => /From here|To here/.test(b.textContent))
     .map(b => Math.round(b.getBoundingClientRect().height));
   ```
3. Test both light and dark (`resize_window` with `colorScheme`), and mobile
   width (375px) since this is a mobile-first PWA.

### Theming tokens (use these, not raw colors)
- Surfaces: `var(--c-bg)`, `var(--c-card)`, `var(--c-card-alt)`, `var(--c-blur)`
- Text: `var(--c-text)`, `--c-text-2`, `--c-text-3`, `--c-text-4`
- Borders: `var(--c-border)`, `var(--c-border-2)`
- Accent: `var(--c-accent)`, `var(--c-accent-fg)`
- Lines: `LINE_COLORS`, `LINE_NAMES`, `LINE_BADGE_BG` from
  `app/src/features/journey/constants.ts`; `LineBadge` component for badges.

---

## Phase 1 — Search dropdown

**Reference:** `files/UI-UX-inspiration/search-bar-dropdown.jpeg`
**Primary file:** [`app/src/features/journey/components/HomeSearch.tsx`](../app/src/features/journey/components/HomeSearch.tsx)
**Risk:** Low · **Preconditions:** none.

### What the reference shows
Rounded search pill (back + mic) · quick-action chips (Home/Work/More) · a
"Recent" section header with an info icon · recent rows as **circular clock icon
+ two-line entry** (name + address) · a footer CTA card.

### Current state
`HomeSearch` is a full-screen overlay (`z-[1200]`) opened from the home search
button. It already has: a search pill (back arrow + clear ✕), and sections for
**Saved**, **Recent**, and a browsable **All stations** directory grouped by
line. Rows are rendered by the local `Row` component; section headers by
`SectionLabel`. Leading icons are bare lucide glyphs (`History`, `Star`,
`MapPin`), **not** wrapped in circular containers.

### Changes
1. **Circular icon containers.** In `Row`, wrap the leading `icon`/`badge` slot
   in a ~36px grey circle (`background: var(--c-card-alt)`, rounded-full, centred)
   so Recent/Saved rows read like the Maps reference. Keep `LineBadge` badges as
   they are for station rows.
2. **Quick-chip strip** under the search pill (metro-adapted — **no Home/Work**):
   - `Nearest station` → calls `onSelectStation(nearestId)` (pass nearest id in
     as a prop from `HomeScreen`, or reuse an existing source; check what
     `HomeScreen` already has — it knows `nearest`).
   - `Saved` → scrolls to / filters the Saved section.
   - `Browse by line` → opens the All-stations directory (already exists via
     `focusLine`); a simple version just scrolls to All stations.
   - Style as pill chips: `rounded-full px-3`, `min-h-[44px]` for touch, horizontal
     scroll (`overflow-x-auto no-scrollbar`).
3. **Drop the mic** (no voice search). Keep back + clear.
4. Leave the **All stations** directory intact — it's a deliberate metro
   extension beyond Maps.

### Metro translations
- Maps' Home/Work/More → **Nearest / Saved / Browse by line**.
- Maps' "businesses" row → omit.

### Acceptance criteria
- [x] Recent & Saved rows show a circular icon container matching the reference.
- [x] A horizontally-scrollable quick-chip row sits directly under the search pill.
- [x] All chips have ≥44px touch height and work in light + dark.
- [x] No regression to existing search/typing, station select, or "plan to" flows.

### Verify
`read_page` the overlay; confirm chip row present and rows restructured. Check
chip heights via `javascript_tool`. No map on this screen, so screenshots are OK
here.

---

## Phase 2 — Journey planner (directions entry)

**Reference:** `files/UI-UX-inspiration/GO-button-journey-planner.jpeg`
**Primary file:** [`app/src/features/journey/components/Planner.tsx`](../app/src/features/journey/components/Planner.tsx)
**Also:** [`StationInput.tsx`](../app/src/features/journey/components/StationInput.tsx) (small tweaks)
**Risk:** Medium (must preserve dropdown/focus/keyboard-nav behaviour) · **Preconditions:** none.

### What the reference shows
Two stacked inputs joined by a **connector rail**: a blue **origin dot** at top,
a **dotted vertical connector**, a red **destination pin** at bottom. A vertical
**swap** control (up/down arrows) sits at the right, centred between the inputs.
Below: a **Recent** list — clock icon + place name + address subtitle, each with
a **✕ to delete**.

### Current state
`Planner` renders inside the planner overlay (opened from `HomeScreen`'s
`plannerOpen`). It has: a "Journey Planner / Where to?" heading, a card holding
two `StationInput`s (labelled **From**/**To**) separated by a hairline, a swap
button (`ArrowUpDown`) absolutely positioned at the right, a results dropdown
(stations + geocoded places, with keyboard nav via `handleKeyDown`/`focusedIndex`),
a source-status strip, a **Leave Now / Depart At / Arrive By** tab group with a
`datetime-local` input, and a full-width **"View Route Options"** CTA. **No
recents** are shown here (recents currently only live in `HomeSearch`).

### Changes
1. **Connector-rail input block.** Restyle the From/To card to the reference:
   left gutter with origin dot → dotted connector → destination pin aligned to
   each input; inputs stacked; the swap control vertically centred at the right.
   Keep `StationInput`'s existing props/behaviour (focus, change, clear,
   keydown) — this is layout/chrome only. Add minimal `StationInput` tweaks only
   if needed to fit the rail gutter.
2. **Recent trips list** below the inputs. Read `metrothi-recent-trips` from
   `localStorage` (same store `HomeSearch` and `App.handlePlan` use — shape:
   `{ key, source, dest, savedAt }`). Render clock icon + `dest.name` (title) +
   `from {source.name}` (subtitle) + **✕** to remove (write back the filtered
   array). Tapping a recent fills From/To (`setSource`/`setDestination` +
   queries) — optionally plan immediately.
3. **Compact time control.** Collapse the three-tab Leave/Depart/Arrive group
   into a single **"Leave now ▾"** chip that expands to reveal the mode + the
   `datetime-local` picker (keep the underlying `timeMode`/`timeStr` state and
   the `onPlan` timeConfig logic unchanged).
4. **No mode row** (metro-only). Do not add car/bike/walk.
5. Keep the CTA; wording can stay "View Route Options" or shorten to "Get
   directions". (The screenshot filename says "GO button" — that's the concept,
   not a literal label.)

### Metro translations
- Origin dot / destination pin rail = same idea, but endpoints are stations or
  geocoded places (a place resolves to its nearest station downstream).
- Maps' "Recent" with addresses → recent **trips** (dest ← source).

### Acceptance criteria
- [x] From/To inputs use the connector-rail visual (dot → dotted line → pin).
- [x] Swap button is vertically centred at the right and still swaps values.
- [x] Recent trips render with ✕-delete and correctly fill the inputs on tap.
- [x] Station + place search dropdown, keyboard nav, and all four
      `sourceStatus` states still work.
- [x] Time control collapses to a chip and still produces correct `timeConfig`.
- [x] Light + dark, 375px width verified.

### Verify
No map here (planner is a full overlay), so screenshots are fine. Exercise
search, swap, a recent tap, and each time mode; confirm `onPlan` fires with the
expected args.

---

## Phase 3 — Journey summary sheet (3 snaps)

**References:** `journey-summary.jpeg` (mid), `journey-summary-minimized.jpeg`
(collapsed), `journey-summary-expanded.jpeg` (full).
**Primary files:**
[`HomeScreen.tsx`](../app/src/features/journey/components/HomeScreen.tsx) (plan-mode header/body + sheet footer),
[`journeySheet/JourneySummary.tsx`](../app/src/features/journey/components/journeySheet/JourneySummary.tsx)
**Also relevant (don't rewrite, just place):** `RouteTimeline.tsx`, `AllTrainsList.tsx`.
**Risk:** Medium (snap heights re-measure) · **Preconditions:** none, but easier after Phase 2.

### What the references show (invariants across all three snaps)
The Maps route sheet keeps **three things constant** that Metrothi currently
doesn't: (a) a **pinned action row** (Start / Add stops / Save), (b) a
**headline metric** (big green time + arrival + distance), and (c) an
**alert banner** (the floods card). The snaps differ only in how much detail
sits between the headline and the pinned actions.

### Current state
Plan mode lives in `HomeScreen`:
- **Header** (`sheetHeader`, `journeyMode === 'plan'`): "source → dest" title +
  chips (`{n} stops`, `{n} transfers`, `arrive {time}`) + a ✕ clear button.
- **Body** (`sheetBody`): `<JourneySummary>` (a departures strip, a 3-cell
  fare/journey/arrival grid, a ticket note, and a full-width **Start Journey**
  button) followed by `RouteTimeline` + `AllTrainsList`.
- Snap heights: `PLAN_COLLAPSED_H = 104`. The `DraggableSheet` snaps are
  `collapsed` / `mid` (ratio 0.42) / `full`.
- The **Start** action currently lives **inside** the scrolling body, so it's
  below the fold when collapsed and not pinned.

### Changes
1. **Pinned action bar.** Add a sticky footer *inside* the `DraggableSheet`
   (visible at mid + full) with **Start Journey** (filled accent) + **Save** +
   **Share** secondary buttons. Reuse the save/share implementations from
   `LiveJourneyScreen.tsx` (`toggleSave`, `share`, the `metrothi-saved-journeys`
   store) — extract them to a shared hook/util if clean, otherwise mirror.
   Google's "Add stops" → **replaced** by Save/Share (no metro meaning).
2. **Minimized peek** (`PLAN_COLLAPSED_H`). Rework the collapsed plan header to
   lead with the **headline metric**: journey duration + arrival + stop count,
   with small share/close icons at the right (like the "13 min · 6.4 km" peek).
   Re-measure and adjust `PLAN_COLLAPSED_H` so the metric row + handle fit
   exactly. Keep the peek tappable to expand.
3. **Mid summary** (`JourneySummary`). Reorder so it **leads with a big
   time + arrival + fare** block (the reference's large green time), *then* the
   upcoming-departures strip, *then* promote service status into a **full
   alert banner** — extend the existing `StatusChip` logic
   (`estimateLine(...).status !== 'running'`) into a full-width tinted card
   (icon + title + optional chevron), matching the floods banner. When the line
   is running, no banner.
4. **Expanded** (`full` snap). Keep `RouteTimeline` + `AllTrainsList` as the
   metro analogue of Maps' traffic/eco/destination detail. Add a **re-time chip
   row** at the top of the expanded body — Leave now / Depart / Arrive — so the
   user can re-time without reopening the planner (call back into `onPlan` /
   the plan recompute with a new `queryTime`/`arriveBy`; check how `HomeScreen`
   already recomputes `plan` via `planJourney` on the 15s tick).

### Metro translations
- Big green "13 min · Arrive 2:41 · 6.4 km · Saves 11% diesel" → **journey
  duration · arrival time · {n} stops · fare est.** (no diesel/eco).
- Floods alert banner → **service-status** banner (Service ended / Starts in… /
  Bus only), only when not running.
- "Add stops" → **Save** (already have Save/Share).
- Traffic/eco/destination-photo sections → RouteTimeline + AllTrainsList.

### Acceptance criteria
- [ ] Start / Save / Share are pinned and reachable at mid **and** full snaps.
- [ ] Collapsed peek shows the headline metric (duration/arrival/stops), fits
      exactly (no clipped/overflowing content), and expands on tap.
- [ ] Mid summary leads with the big metric block; departures strip and alert
      banner follow; banner only appears when the line isn't running.
- [ ] Expanded shows a working re-time chip row above the timeline/trains list.
- [ ] Save/Share behave identically to the live screen (same localStorage key).
- [ ] No map-gesture regression; sheet drag/snap still smooth. Light + dark, 375px.

### Verify
The map is on screen → **use `read_page` + `javascript_tool`, not screenshots.**
Plan a route (source→dest), then check: peek height fits, action bar visible at
each snap (query element positions), banner appears for an off-hours line, and
the re-time chips recompute arrival.

---

## Phase 4 — Live active journey (map-first rewrite)

**Reference:** `files/UI-UX-inspiration/live-active-journey.jpeg`
**Primary files:**
[`LiveJourneyScreen.tsx`](../app/src/features/journey/components/LiveJourneyScreen.tsx) (largest change),
[`HomeScreen.tsx`](../app/src/features/journey/components/HomeScreen.tsx) (live-mode composition),
[`map/components/HomeMap.tsx`](../app/src/features/map/components/HomeMap.tsx) (route + train-glide already exist; may need a "live/follow" prop).
**New:** a `LiveNavBanner` component (top next-action banner).
**Risk:** High · **Preconditions:** Phases 1–3 landed and stable. Read the whole
of `LiveJourneyScreen.tsx`, `useJourneySession`, and `HomeMap.tsx` before starting.

### What the reference shows
A **map-first turn-by-turn** view: a green **maneuver banner** at top ("100m ·
Chief Justice Bungalow Ln", "Then ←"), the live position on the highlighted
route, floating right-side controls (compass / search / mute / report), a
speed pill, and a **bottom bar** ("13 min · 6.4 km · 2:42 · Exit").

### Current state
`LiveJourneyScreen` is a **vertical schematic timeline** overlay (no map): a
thick colored rail with station dots, a gliding "glow head" (train position),
per-leg cards with collapsible intermediate stops, transfer connectors, a
sticky header (dest title + End/Save/Share/Simulate/+5min pills), and floating
bottom status pills (mins-left + state label). State comes from
`useJourneySession` (states: `NOT_STARTED`, `WALKING_TO_STATION`,
`WAITING_FOR_TRAIN`, `ON_TRAIN`, `APPROACHING_TRANSFER`, `TRANSFERRING`,
`APPROACHING_DESTINATION`, `FINAL_WALK`, `COMPLETED`). In `App.tsx`, the live
view is shown full-screen when `activeJourney && !isJourneyMinimized`; when
minimized it collapses into the home sheet via `LiveJourneySummary`.

### Target architecture
Make the live view **map-first**, with the current timeline **re-housed** as an
expandable detail sheet (do **not** delete it):
1. **Map** — keep `HomeMap` mounted showing the route polyline + gliding train
   at the session's live progress. Add a follow/recenter control (reuse the
   `home-recenter` event pattern already in `HomeScreen`). Respect the
   "instant styles on the map, no CSS transitions" rule.
2. **Top next-action banner** (`LiveNavBanner`) — the metro analogue of the
   maneuver card, driven by `useJourneySession` state:
   - `WALKING_TO_STATION` → "Walk to {source}"
   - `WAITING_FOR_TRAIN` → "Board {Line} → {heading}" + next-departure time
   - `ON_TRAIN` → "Ride {N} stops → alight at {station}"
   - `APPROACHING_TRANSFER` / `TRANSFERRING` → "Change at {station} to {Line}"
   - `APPROACHING_DESTINATION` / `FINAL_WALK` → "Alight at {dest}"
   - `COMPLETED` → "Arrived"
   Include a "Then …" secondary line for the following step where available.
   Use `LineBadge` + line color for the accent (green banner in the reference
   → line-colored or accent banner here).
3. **Bottom bar** — **N min left · arrive HH:MM** + a red **Exit** button
   (`onEnd`). Move Simulate / +5min into an overflow (they're dev/sim controls).
   A drag-up (or a "Steps"/chevron button) **expands the existing timeline** as
   a bottom sheet over the map.
4. **HomeScreen live composition** — with the map already mounted beneath,
   `journeyMode === 'live'` should render the banner + bottom bar over the map
   instead of (or in addition to) today's `LiveJourneySummary` peek. Reconcile
   with `App.tsx`'s `showLive`/`isJourneyMinimized` overlay: the maximized live
   view is now map-first; "minimize" still tucks it into the home sheet.

### Metro translations
- Street maneuver + distance → **metro action + stops/next-departure**.
- Speed pill / Report / search controls → optional; **recenter/compass** is the
  meaningful one. Speed has no metro meaning — omit. Report/search omit unless
  desired later.
- "Exit" (red) → same (ends the journey, `onEnd`).
- Keep Save/Share reachable (overflow or the expanded sheet header).

### Acceptance criteria
- [ ] Live view shows the map with route + moving train, not a full-screen list.
- [ ] Top banner reflects the correct next action for every `useJourneySession`
      state, with a "Then" secondary where applicable.
- [ ] Bottom bar shows mins-left + arrival + a working red **Exit**.
- [ ] The detailed timeline is still reachable (expandable sheet) — no loss of
      the leg/stop/transfer detail or the glow-head animation.
- [ ] Minimize → home-sheet `LiveJourneySummary` still works; maximize returns
      to the map-first view.
- [ ] Simulate / +5min still available (overflow) for testing.
- [ ] Light + dark, 375px. Map-gesture-safe (instant styles, no CSS transitions
      on Leaflet panes).

### Verify
Map is central → **`read_page` + `javascript_tool` only, no screenshots.** Start
a journey, toggle Simulate to advance state, and assert the banner text changes
per state and the bottom bar counts down. Confirm minimize/maximize round-trips.

---

## Appendix — file quick-reference

| Concern | Path |
|---|---|
| Home shell / journey modes / sheet host | `app/src/features/journey/components/HomeScreen.tsx` |
| Search overlay | `app/src/features/journey/components/HomeSearch.tsx` |
| Directions entry | `app/src/features/journey/components/Planner.tsx` |
| From/To input | `app/src/features/journey/components/StationInput.tsx` |
| Plan summary (mid) | `app/src/features/journey/components/journeySheet/JourneySummary.tsx` |
| Route timeline (expanded) | `app/src/features/journey/components/journeySheet/RouteTimeline.tsx` |
| All departures (expanded) | `app/src/features/journey/components/journeySheet/AllTrainsList.tsx` |
| Live summary (minimized peek) | `app/src/features/journey/components/journeySheet/LiveJourneySummary.tsx` |
| Live full screen | `app/src/features/journey/components/LiveJourneyScreen.tsx` |
| Live session state machine | `app/src/features/journey/hooks/useJourneySession.ts` |
| Map + route + train-glide | `app/src/features/map/components/HomeMap.tsx` |
| Draggable sheet primitive | `app/src/components/DraggableSheet.tsx` |
| Location notice | `app/src/components/LocationNotice.tsx` |
| Line tokens/badges | `app/src/features/journey/constants.ts`, `app/src/components/LineBadge.tsx` |
| Engine (planJourney, schedules, geometry) | `app/src/features/journey/engine/journeyEngine.ts` |

## Appendix — status tracker
- [x] Phase 1 — Search dropdown
- [x] Phase 2 — Journey planner
- [ ] Phase 3 — Journey summary sheet
- [ ] Phase 4 — Live active journey (map-first)
