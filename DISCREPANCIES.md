# Known Discrepancies / Deferred Fixes

Running list of code issues spotted but deliberately not fixed yet. Add to this
whenever something is found mid-task but is out of scope for that task. Remove
an entry once it's fixed.

---



---

## Engine (`app/src/features/journey/engine/journeyEngine.ts`)

- [ ] `INTERCHANGE_BUFFER_MINS` (line 77) is a flat 3-minute transfer penalty
      for every interchange. PRD §5.1 calls this out explicitly: "Must be
      upgraded to per-station walking matrixes before v2.0 launch."

- [ ] **Failing test: "segment time shares are proportional to inter-station
      distance"** (`journeyEngine.test.ts:276`). `toBeCloseTo(..., 6)` expects
      ~5e-7 precision but the actual ratio differs by ~3.4e-3, so it fails. The
      assertion tolerance looks too tight for the distance-weighted split.
      Pre-existing (engine untouched by the journey-sheet work). Found 2026-07-25.

- [ ] **Station-to-station journeys render phantom "Walk 1 min" rows.** When a
      route is planned from a station (not a place), the live recompute in
      `HomeScreen` (and previously `ResultsScreen`) passes the `sourceStation`/
      `destStation` object — not its id — to `planJourney`. The engine's source
      branch (`journeyEngine.ts:971`) treats any non-string as a place and runs
      `findNearestStation`, so the station is re-tagged as a `sourcePlace`/
      `destPlace` with a ~0-distance walk, producing "Walk 1 min to/from X" rows
      in the timeline. Pre-existing behavior (visible in the old results page);
      preserved as-is by the sheet redesign. Fix by passing `.id` when there is
      no real place. Found 2026-07-25.




## Map rendering (`app/src/features/map/components/HomeMap.tsx`, `map/geometry/trackGeometry.ts`)


## Template for new entries

```
## <area> (`path/to/file.ts`)

- [ ] <what's wrong> — <where/how to fix it>
```

## Place search (`app/src/services/GeocodingService.ts`)

- [ ] Place suggestions look wrong — typing "Vastral Gam" returned five identical "Old High Court, Usmanpura" rows, and typing "Vastral" returned "Vastral, Rabari Colony" three times. Station matching is fine; only the PLACES section is affected. Likely fallout from the in-flight GeocodingService change and/or the removed `proxy/geocode-worker`. Seen on /go, 2026-07-20.

## PWA / offline deviations

- [ ] **Dexie deliberately not implemented.** PRD §5.2/§5.3 originally mandated
      Dexie.js (IndexedDB) for the transit graph, schedules, and user data. The
      PWA/offline work (2026-07-22) instead relies on the transit graph being
      bundled JSON precached by the service worker, and keeps user data in
      `localStorage`. This satisfies the airplane-mode launch criterion (§6.2)
      without Dexie. PRD §5.2/§5.3 have been amended to match. Revisit only if
      saved-journey data outgrows localStorage's ~5 MB budget.

- [ ] **Full-viewport screens still hardcode an 80px tab-bar offset**
      (`Planner.tsx:154`, `App.tsx` `MapFallback`).
      The tab bar is ~68px intrinsically and grows by
      `env(safe-area-inset-bottom)` on notched phones, so these leave a ~12px
      dead gap on most devices and overlap the bar on iPhones. `App.tsx` now
      measures the bar and publishes `--nav-h`; these three should switch to
      `calc(100dvh - var(--nav-h, 80px))`. They also use `100vh` rather than
      `100dvh`, so they jump as mobile browser toolbars collapse. Found while
      making the home screen mobile-safe; left alone to keep that change scoped.

- [ ] **Sub-44px touch targets in shared components**
      (`LocationNotice` Retry button ~27px tall; `StationDetail` direction tabs
      ~39px; `App.tsx` tab-bar links ~39px). Below both Apple's 44pt and
      Material's 48dp minimums. Found during the home-screen mobile audit; these
      are pre-existing and shared across screens, so changing them affects more
      than the home surface.

---

## Resolved / Fixed

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

- **[Fixed 2026-07-21]** `TS6133: 'walkMinsForKm' is declared but its value is never read` in `useJourneySession.ts` broke `npm run build`. The in-flight edits replaced that call with `result.sourceWalkMins` and left the import behind; import removed.

- **[Fixed 2026-07-20]** `LINE_META` run-time denominators for red and yellow lines corrected (red: 35 / 14, yellow: 43 / 20) to match actual segment counts.
- **[Fixed 2026-07-20]** `computeStopTimeline` now correctly divides `travelMins` over `len - 1` segments for post-interchange legs instead of `len - 2`.
- **[Fixed 2026-07-20]** Walk estimate correctly uses `result.sourceWalkMins` if available, instead of blindly falling back to `DEFAULT_WALK_MINS`.
- **[Fixed 2026-07-20]** Journey progress state no longer resets on minimize/maximize; `useJourneySession` was lifted up to `MainApp` in `App.tsx`.
- **[Fixed 2026-07-20]** Fare calculation rebuilt on real GMRC distance data (`fareEngine.ts`) instead of the guessed station-count slabs in the old `fares.json`; see PRD §5.4.
- **[Fixed 2026-07-20]** Cross-phase ticket rule ("only NCMC works between Phase 1 and Phase 2") and the CSC/NCMC 10% discount are now confirmed against GMRC's `fare-rules` page and recorded in `app/src/data/metroInfo.json`. The discount is display-only and intentionally not applied to any fare.
- **[Found 2026-07-25, not fixed]** Dead `animate-in` / `fade-in` / `slide-in-from-top-*` classes across the app (e.g. the `HomeSearch` overlay root, `Planner.tsx:195` dropdown, other overlays). The project is on **Tailwind v4 with no `tailwindcss-animate` / `tw-animate-css`**, so these utilities generate **no CSS** (`getComputedStyle` → `animation-name: none`) and the intended entrance animations simply don't happen for real users. Fix options: add `tw-animate-css` and `@import` it, or replace with framer-motion / hand-written `@keyframes`. (The search-suggestions entrance was done with framer-motion instead.) Out of scope for the UI-parity search work.
