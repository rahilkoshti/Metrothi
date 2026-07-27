# Known Discrepancies / Deferred Fixes

Running list of code issues spotted but deliberately not fixed yet. Add to this
whenever something is found mid-task but is out of scope for that task. Remove
an entry once it's fixed.

Line references are checked against `develop` on the date in each entry — treat
an older date as "roughly here", not exact.

---

## Engine (`app/src/features/journey/engine/journeyEngine.ts`)

- [ ] `INTERCHANGE_BUFFER_MINS` (line 261) is a flat 3-minute transfer penalty
      for every interchange, applied at `journeyEngine.ts:829`. PRD §5.1 calls
      this out explicitly: "Must be upgraded to per-station walking matrixes
      before v2.0 launch."

## Map rendering (`app/src/features/map/components/HomeMap.tsx`, `map/geometry/trackGeometry.ts`)

_(no open entries)_

## Home station sheet (`HomeScreen.tsx`, `components/DraggableSheet.tsx`, `components/stationSheet/*`)

_(no open entries)_

## Design tokens

_(no open entries)_

## PWA / offline deviations

- [ ] **Dexie deliberately not implemented.** PRD §5.2/§5.3 originally mandated
      Dexie.js (IndexedDB) for the transit graph, schedules, and user data. The
      PWA/offline work (2026-07-22) instead relies on the transit graph being
      bundled JSON precached by the service worker, and keeps user data in
      `localStorage`. This satisfies the airplane-mode launch criterion (§6.2)
      without Dexie. PRD §5.2/§5.3 have been amended to match. Revisit only if
      saved-journey data outgrows localStorage's ~5 MB budget.
      *(Kept as a recorded decision, not a bug — nothing to fix.)*

---

## Resolved / Fixed

- **[Fixed 2026-07-28]** Station sheet's fitted mid snap capped at ~60% of
  viewport, resolving the map-strip-too-thin item that used to sit in the
  "Home station sheet" section above. It was floored at
  `Math.round(h * 0.12)` in `DraggableSheet.pointsFor` (`DraggableSheet.tsx:98`)
  — free to grow to 88% of the screen, measured live at 715px of an 812px
  viewport on a 4-card interchange, leaving only a 97px map strip once the
  search pill and line-status strip claimed their share, crowding out the
  floating controls. Floor raised to `Math.round(h * 0.4)`, capping the sheet
  at ~60% (~325px of map on the same viewport) — chosen over the two
  alternatives considered (moving the controls into the header; overlapping
  the sheet Material-FAB style) because it's the only one that also restores
  the bare map the tap-to-collapse gesture needs, rather than just
  rearranging controls around an oversized sheet. Trade-off: a 4-card
  interchange's departures now scroll within the mid snap instead of all
  fitting above the fold — same as any other overflow, and the full snap
  already exists for "see everything." `tsc -b --noEmit` clean; confirmed
  working live by the user at 375×812.

- **[Fixed 2026-07-28]** Recenter button (and the pan-to-selected-station
  nudge) no longer assume the sheet is always at its mid snap. `HomeScreen`'s
  `sheetInset` — fed to `HomeMap` as `bottomInset` for both the
  `home-recenter` listener and `PanTo` — was computed from a fixed `midRatio`
  approximation that never read the sheet's actual `snap` state, so
  recentering shifted the map by the same amount whether the sheet was
  collapsed, mid, or fitted extra-tall on an interchange. Replaced with
  `sheetEdge`, the value `DraggableSheet`'s `onRestEdgeChange` already
  measures live for the floating-control fit check — the sheet's real rest
  height at whatever snap and header-wrap state it's actually in.
  `tsc -b --noEmit` clean, full suite 239/239; not yet checked live in-app —
  the Browser pane could not reach this session's dev server (localhost
  navigation denied), so verify by selecting a station at collapsed vs. mid
  and confirming recenter shifts the map by a different amount each time.

- **[Fixed 2026-07-28]** Click-and-drag no longer highlights text across the
  app (sheet, cards, map chrome) on desktop. Added `user-select: none` (plus
  `-webkit-user-select` and `-webkit-touch-callout: none` for Safari/iOS) to
  `html, body` in `index.css`, re-enabled on `input`/`textarea` so the search
  boxes keep normal text selection and editing. `tsc -b --noEmit` clean; not
  yet checked live in-app for the same reason as above.

- **[Fixed 2026-07-28]** Accent foreground unified to black across all accent
  CTAs, resolving the token-vs-hardcode split. `--c-accent-fg` was `#ffffff`
  while three CTAs (`HomeScreen.tsx` Plan-route FAB, `Planner.tsx` primary CTA,
  `StationDetail.tsx` "From here") hardcoded `color: '#000'` directly instead
  of using the token — so the same accent button rendered black-on-orange in
  some places and white-on-orange in others (`StationSheetActions.tsx`,
  `JourneySummary.tsx`, `ErrorBoundary.tsx`, plus several `--c-accent-fg`
  reads in `Planner.tsx` and `AllTrainsList.tsx`, all already using the
  token). **Went with black, not a mechanical "just use the token" rename**:
  the two aren't equivalent for contrast — black on `#f97316` is ~7.6:1, white
  is ~2.8:1, failing WCAG AA even for large text/UI components. So the token
  itself was the thing that was wrong. Changed `--c-accent-fg` to `#000000`
  in `index.css` (accent colour doesn't change between themes, so neither
  does its foreground — no dark-mode override needed) and pointed the three
  hardcoded spots at `var(--c-accent-fg)` instead of `'#000'`, so all six-plus
  accent CTAs now render identically and pass contrast. Verified live: the
  Plan-route FAB, "Start Journey", and "From here" all compute to
  `rgb(0, 0, 0)` on `rgb(249, 115, 22)`; the Planner's CTA uses the identical
  one-line pattern and reads the same token, unverified live only because the
  planner overlay's ref map kept going stale under browser automation — not a
  reason to doubt it. `tsc -b --noEmit` clean; suite still 239/239 (CSS-only).

- **[Fixed 2026-07-28]** "View all →" no longer routes away from the sheet.
  `UpcomingTrains` navigated to `/stations/:id` for the full-day schedule, but
  the sheet's own full snap already renders the identical schedule
  (`StationDetailBody`, `showHero={false} showActions={false}`) — two routes to
  one piece of content, and only one kept the map mounted. `UpcomingTrains` now
  takes an `onViewAll` callback instead of calling `useNavigate` itself;
  `HomeScreen` wires it to `setSnap('full')`. The standalone `/stations/:id`
  route is untouched — it still exists for deep links, "From here"/"To here"
  hand-off, and its hero/phase/position-on-line info the sheet doesn't show —
  this only changes what the in-sheet "View all" button does. Verified live:
  clicking it expands the sheet to the full day's schedule (Blue Line, Red
  Line, etc.) while `location.pathname` stays `/` and the map stays mounted
  underneath. `tsc -b --noEmit` clean; no other call sites of `UpcomingTrains`
  existed to update.

- **[Fixed 2026-07-28]** Sheet surface now uses `--c-card`, not `--c-bg`. The
  design reference shows a white sheet with grey inset chips and cards;
  `DraggableSheet` had it backwards — sheet at `--c-bg` (#f4f4f5 light) with
  white cards, the same contrast, inverted. Flipping the sheet's own background
  to `--c-card` (`DraggableSheet.tsx`) meant every direct child that read
  `--c-card` as "the card colour" would go white-on-white, so all of them
  flipped to `--c-bg` instead, becoming the grey inset content the reference
  shows: `HomeScreen`'s `Chip` and its three sheet-header icon buttons (clear
  route, walking directions, save), `UpcomingTrains`'s empty-state card,
  `JourneySummary`, `AllTrainsList`, `RouteTimeline`, and four pill/chip spots
  in `LiveJourneyScreen` — all confirmed used only inside `DraggableSheet`, so
  none of this touches anything outside the sheet.
  Two components don't get that blanket treatment because they're **shared
  with the standalone `/stations/:id` page**, which sits on the grey `--c-bg`
  page background and still wants a white card there:
  - `DepartureRow` gained an `inset?: boolean` prop (default off). `UpcomingTrains`
    passes it (rows sit directly on the sheet); the full-day schedule's rows
    (`MergedTrainList`) don't, because they already sit inside an
    explicitly-grey scroller regardless of the ambient surface.
  - `StationDetailBody` / `LineScheduleCard` gained a `surface?: 'page' |
    'sheet'` prop (default `'page'`), so the schedule card is grey inside the
    home sheet's full snap but stays white on the standalone page. `HomeScreen`
    is the only caller that passes `surface="sheet"`.
  Verified live in both themes via the app's real theme toggle (not a forced
  `data-theme` attribute, which the ThemeContext fights): sheet/inset pairs are
  `#fff`/`#f4f4f5` (light) and `#1a1a1a`/`#0f0f0f` (dark) in all three sheet
  modes, while the standalone page's schedule card stays `#fff`/`#1a1a1a`
  against its grey page background, unchanged in both themes. `tsc -b --noEmit`
  clean; full suite still 239/239 (CSS-only elsewhere, so untested by design).

- **[Fixed 2026-07-28]** Failing test: "distance-weighted segment times >
  segment time shares are proportional to inter-station distance"
  (`journeyEngine.test.ts:265`). **Not an engine bug — the test's expectation
  used the wrong distance metric.** `travelMinsBetween` weights each segment by
  along-track distance (`tracks.json`'s `stationKm`, the real curved
  alignment), but the test computed its "expected" ratio from `haversineKm`
  (straight-line distance between the station pins). For the two segments
  compared (`sp-stadium`↔`commerce-six-road` vs `rabari-colony`↔`amraivadi`),
  those two distance metrics disagree because the actual track curves —
  confirmed by recomputing both: the along-track ratio is exactly
  `1.2019970314397526` (what the engine produces) while the haversine ratio is
  `1.1985712552604897` (what the test expected), a `3.4e-3` gap that has
  nothing to do with float precision. Fixed by having the test read the same
  `stationKm` table the engine uses instead of haversine. All 239 tests now
  pass (`npx vitest run`); `tsc -b --noEmit` clean.

- **[Fixed 2026-07-27]** Duplicate place suggestions. Typing "vastral" rendered
  three character-for-character identical rows ("Nearest to Vastral, Rabari
  Colony → Vastral"), separable only by walk distance (14 m / 2 m / 15 m).
  **The cause was not the one originally suspected** — neither the in-flight
  GeocodingService change nor the removed `proxy/geocode-worker` was involved;
  Photon is called directly and answers correctly. The duplicates are upstream:
  OSM maps that one place as three objects (`N9655564690`, `W1198140892`,
  `N6432742907`, all within ~15 m, all `type: house`) carrying identical
  `name` + `suburb`, and `searchViaPhoton` turned each into its own `PlaceNode`
  keyed `place_${lat}_${lng}` — distinct ids, colliding labels, no dedupe.
  `dedupePlaces` now collapses them in two passes: exact rendered-label match
  (the common case), plus same-base-name within 50 m (`SAME_PLACE_KM`), which
  catches one object tagged `suburb` and its twin tagged only `district`
  rendering as two strings for one doorway. Because Photon applies `limit`
  server-side *before* dedupe, the request over-fetches (`FETCH_LIMIT = 15`) and
  trims to `MAX_RESULTS = 5` after — otherwise filtering would have shrunk
  "vastral" from 5 rows to 3.
  Verified against the live API through the real module: "vastral" still returns
  5 rows, the duplicates replaced by genuine places (Vastral Bus Depot, Vastral
  Lake Park); "vastral gam" collapses 3 → 1. Checked for over-merging across
  sabarmati / ashram road / iim ahmedabad / gandhinagar / law garden — all still
  return 5 distinct results, and `IIM Overbridge, Vastrapur` vs `IIM Overbridge,
  Panjrapole` correctly survive as separate rows despite sharing a base name.
  The other half of the original report — "five identical *Old High Court,
  Usmanpura* rows for Vastral Gam" — no longer reproduces at all; that was a
  separate fault (a stale cache hit, or a race showing the previous query's
  results) and had already gone.

- **[Obsolete 2026-07-27]** "Full-viewport screens still hardcode an 80px
  tab-bar offset" no longer applies: **the tab bar is gone.** `App.tsx:74–76`
  now pins `--nav-h` to `0px` with the comment "No tab bar", and a repo-wide
  search finds no remaining `80px`, no `100vh`, and no `MapFallback` — the
  component the entry named. Retired without code changes; nothing to fix.

- **[Obsolete 2026-07-27]** "Sub-44px touch targets in shared components" —
  all three named targets are gone or fixed. `LocationNotice`'s Retry button
  carries `min-h-[44px]` (`LocationNotice.tsx:53`); `StationDetail`'s direction
  tabs no longer exist, the schedule having become one merged time-sorted list
  (`StationDetail.tsx:20`, `:141`); and the `App.tsx` tab-bar links went with
  the tab bar. Retired without code changes.

- **[Partly fixed 2026-07-27]** Floating map controls no longer pinned to the
  collapsed peek. `DraggableSheet` gained `onRestEdgeChange`, which reports how
  tall the sheet stands at its current *snap* (`height - snapY[snap]`) — fired
  per settled snap, not per frame, and accounting for a header that outgrows
  `collapsedHeight`, which the caller cannot compute from its own constants.
  `HomeScreen` anchors the Plan-route FAB and Recentre button to that instead of
  `COLLAPSED_H`, so they follow the sheet at every snap. They now hide only when
  they genuinely don't fit (`controlFits`, `TOP_CHROME_H = 128`) rather than
  whenever `snap !== 'collapsed'`. Verified live: at an 812px viewport both are
  on-screen with `pointerEvents: auto`; shrinking to 600px flips both to `none`.
  The map's `bottomInset` still uses the separate `sheetInset`, which
  deliberately tracks the *mid* inset regardless of snap. **Still open:** on a
  4-card interchange the mid snap leaves no room at all — see the open entry
  above.

- **[Fixed 2026-07-27]** Station-to-station journeys no longer render phantom
  "Walk 1 min" rows. `HomeScreen`'s 15s recompute passed the `sourceStation` /
  `destStation` *object* back into `planJourney`; the engine treats any
  non-string input as a place, so it ran `findNearestStation` and re-tagged each
  station as a place ~0 km from itself. Now passes `.id`
  (`HomeScreen.tsx:234-235`). `App.tsx handlePlan` was already correct
  (`source.isPlace ? source : source.id`), so only the recompute was affected.
  Guarded by three tests in `journeyEngine.test.ts` — a station-id plan has no
  place and no walk, the same holds across the recompute round-trip, and a place
  source still walks so the guard isn't vacuous.

- **[Fixed 2026-07-25]** Dead-code components removed. `MapScreen` and
  `StationsDirectory` were imported nowhere; deleted both, plus
  `StationBottomSheet` (used only by `MapScreen`, so orphaned by its removal).
  `LiveTrainsLayer` was kept — it's shared with `HomeMap`. Stale `MapScreen`
  references in a `HomeMap` comment and a PWA-section note were also cleaned up.

- **[Fixed 2026-07-25]** `StationDetail` SEO page's "From here"/"To here"
  buttons now work. `StationDetailBody` gained an optional `onPlanIntent` — the
  home sheet still falls back to the `home-plan-trip` event, while the standalone
  `/stations/:id` page passes a handler that navigates to `/` with the plan
  intent in router state (`{ planTrip: { source | dest } }`). `HomeScreen` reads
  that state once on mount, opens the planner with the prefill, then clears the
  state (`replace`) so a refresh/back-nav doesn't reopen it.

- **[Found 2026-07-25, not fixed]** Dead `animate-in` / `fade-in` /
  `slide-in-from-top-*` classes across the app (e.g. the `HomeSearch` overlay
  root, `Planner.tsx` dropdown, other overlays). The project is on **Tailwind v4
  with no `tailwindcss-animate` / `tw-animate-css`**, so these utilities generate
  **no CSS** (`getComputedStyle` → `animation-name: none`) and the intended
  entrance animations simply don't happen for real users. Fix options: add
  `tw-animate-css` and `@import` it, or replace with framer-motion /
  hand-written `@keyframes`. (The search-suggestions entrance was done with
  framer-motion instead.) Out of scope for the UI-parity search work.

- **[Added 2026-07-23]** Home-map viewport is now fenced to the metro area. Set
  `maxBounds` (network box padded ~25%), `maxBoundsViscosity: 1.0` (hard fence —
  the drag stops solid at the edge, no bounce-back), `minZoom: 11` (zoom-out
  locked to the whole-network view) and `maxZoom: 18` (free close-up within the
  box). Verified live: zoom-out clamps 3→11, zoom-in clamps 25→18, a pan toward
  Mumbai keeps the centre inside the bounds.

- **[Fixed 2026-07-23]** Home-map station markers floated off the line. Once the
  polylines switched from station chords to real OSM track geometry (commit
  468c12f), markers still rendered at raw `stations.json` coords and drifted up
  to ~52m off the drawn track. Markers now snap to the track via
  `stationPointOnTrack()` (projection stored as `stationKm`), verified on-screen
  to <1px. Terminal markers additionally rotate perpendicular to the track using
  `trackScreenAngleAtStation()` (exact vs Web Mercator; see the open caveat above
  re: Leaflet's drawn-line simplification).

- **[Fixed 2026-07-23]** Live train markers now indicate direction of travel.
  The old marker was a colour dot with a static, non-directional train glyph.
  Each train now renders a white arrowhead rotated to its on-screen heading
  (`trainHeadingDeg()`, from two track points straddling the train's progress in
  the from→to direction). Verified: arrows lie along the track and point forward
  — across a 4s window all 17 trains' arrows matched actual movement direction to
  within ~10°, none reversed.

- **[Fixed 2026-07-23]** `LiveTrainsLayer` never actually rendered. `onAdd`
  attached its SVG group via `map._renderer._svg`, but Leaflet 1.9's SVG
  renderer has no `_svg` property (the `<svg>` is `_container`, its content group
  is `_rootGroup`), so the group was never inserted and no trains appeared. Now
  attaches to the renderer's `_rootGroup` (via `map.getRenderer(this)`), the same
  coordinate space as the vector polylines. Also fixed a listener leak: `onAdd`
  and `onRemove` passed separate `() => this.render()` closures to `on`/`off`, so
  the `move zoom` handler was never detached — now a single stored `onMapMove`
  reference is used for both.

- **[Fixed 2026-07-23]** Three TypeScript build errors in the in-flight
  map/home WIP cleared, restoring a clean `tsc -b --noEmit`:
  - `HomeScreen.tsx` — the service-status message was built from an object
    literal that read `status.minsUntilFirst` on every variant; replaced with a
    `switch` that narrows the union, so only `before-first-train` reads it.
  - `HomeMap.tsx` — removed the unused value-imported `ReactNode`.
  - `LiveTrainsLayer.tsx` — `TrainRenderer.onRemove` now returns `this` to match
    Leaflet's `Layer.onRemove` signature.

- **[Fixed 2026-07-21]** `TS6133: 'walkMinsForKm' is declared but its value is
  never read` in `useJourneySession.ts` broke `npm run build`. The in-flight
  edits replaced that call with `result.sourceWalkMins` and left the import
  behind; import removed.

- **[Fixed 2026-07-20]** `LINE_META` run-time denominators for red and yellow lines corrected (red: 35 / 14, yellow: 43 / 20) to match actual segment counts.
- **[Fixed 2026-07-20]** `computeStopTimeline` now correctly divides `travelMins` over `len - 1` segments for post-interchange legs instead of `len - 2`.
- **[Fixed 2026-07-20]** Walk estimate correctly uses `result.sourceWalkMins` if available, instead of blindly falling back to `DEFAULT_WALK_MINS`.
- **[Fixed 2026-07-20]** Journey progress state no longer resets on minimize/maximize; `useJourneySession` was lifted up to `MainApp` in `App.tsx`.
- **[Fixed 2026-07-20]** Fare calculation rebuilt on real GMRC distance data (`fareEngine.ts`) instead of the guessed station-count slabs in the old `fares.json`; see PRD §5.4.
- **[Fixed 2026-07-20]** Cross-phase ticket rule ("only NCMC works between Phase 1 and Phase 2") and the CSC/NCMC 10% discount are now confirmed against GMRC's `fare-rules` page and recorded in `app/src/data/metroInfo.json`. The discount is display-only and intentionally not applied to any fare.

---

## Template for new entries

```
## <area> (`path/to/file.ts`)

- [ ] <what's wrong> — <where/how to fix it>
```
