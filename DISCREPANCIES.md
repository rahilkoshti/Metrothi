# Known Discrepancies / Deferred Fixes

Running list of code issues spotted but deliberately not fixed yet. Add to this
whenever something is found mid-task but is out of scope for that task. Remove
an entry once it's fixed.

---

## Map track geometry (`files/map/STEP1-IMPLEMENTATION.md`)

Phase A (OSM track fetch) has run and produced `app/src/data/tracks.json`, but
`app/src/data/tracks-report.txt` has unresolved `!!` flags the guide's own
acceptance checklist requires clearing before Phase E ships:

- [ ] `mahatma-mandir` station coord is 153m off the traced track (`!! BAD COORD?`).
      OSM suggests `lat 23.2339412, lng 72.6338714` (node 13457569598) — apply to
      `app/src/data/stations.json`.
- [ ] Non-monotonic trace warnings need manual inspection on geojson.io:
      `vastral`, `gheekanta`, `gujarat-university`, `gurukul-road`, `thaltej`,
      `motera-stadium`, `koba-circle`, `koba-gam`, `sector-1`.
- [ ] Two segments have no OSM rail path and fall back to a straight chord:
      `gandhigram → old-high-court` and `old-high-court → usmanpura`. Either
      accept the chord or trace the missing viaduct in OSM's iD editor.

Phases B–E of the same guide are **not started** — `trackGeometry.ts` and the
updated `LiveTrainsLayer.tsx` sit unused in `files/map/`, not yet copied to
`app/src/features/map/geometry/` and `app/src/features/map/components/`.
`journeyEngine.ts`'s `ActiveTrain` doesn't yet expose `fromStationId`/
`toStationId`, and `MapScreen.tsx` doesn't render real track polylines, route
dimming, or zoom-progressive labels.

---

## Engine (`app/src/features/journey/engine/journeyEngine.ts`)

- [ ] `INTERCHANGE_BUFFER_MINS` (line 77) is a flat 3-minute transfer penalty
      for every interchange. PRD §5.1 calls this out explicitly: "Must be
      upgraded to per-station walking matrixes before v2.0 launch."

- [ ] `tracks.json` `stationKm` values are non-monotonic for most of blue,
      red, and yellow (its own `tracks-report.txt` flags these), so track-length
      distances can't yet replace the straight-line distances used for
      segment-time weighting (`buildCumulativeMins`). Once the Phase A traces
      are cleaned up, swap haversine for along-track distance there.



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

- [ ] **Leaflet default marker icons load from a CDN**
      (`MapScreen.tsx:15-17` → `cdnjs.cloudflare.com/.../leaflet/1.7.1/images/*`).
      These won't be cached by the service worker's runtime rules, so any
      default Leaflet marker breaks offline. Fix by importing the marker PNGs
      from the `leaflet` package (so Vite bundles + precaches them) instead of
      pointing at the CDN. Out of scope for the PWA pass; low impact since the
      app mostly uses `CircleMarker`s.

- [ ] **Full-viewport screens still hardcode an 80px tab-bar offset**
      (`MapScreen.tsx:124`, `Planner.tsx:154`, `App.tsx` `MapFallback`).
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

- **[Fixed 2026-07-21]** `TS6133: 'walkMinsForKm' is declared but its value is never read` in `useJourneySession.ts` broke `npm run build`. The in-flight edits replaced that call with `result.sourceWalkMins` and left the import behind; import removed.

- **[Fixed 2026-07-20]** `LINE_META` run-time denominators for red and yellow lines corrected (red: 35 / 14, yellow: 43 / 20) to match actual segment counts.
- **[Fixed 2026-07-20]** `computeStopTimeline` now correctly divides `travelMins` over `len - 1` segments for post-interchange legs instead of `len - 2`.
- **[Fixed 2026-07-20]** Walk estimate correctly uses `result.sourceWalkMins` if available, instead of blindly falling back to `DEFAULT_WALK_MINS`.
- **[Fixed 2026-07-20]** Journey progress state no longer resets on minimize/maximize; `useJourneySession` was lifted up to `MainApp` in `App.tsx`.
- **[Fixed 2026-07-20]** Fare calculation rebuilt on real GMRC distance data (`fareEngine.ts`) instead of the guessed station-count slabs in the old `fares.json`; see PRD §5.4.
- **[Fixed 2026-07-20]** Cross-phase ticket rule ("only NCMC works between Phase 1 and Phase 2") and the CSC/NCMC 10% discount are now confirmed against GMRC's `fare-rules` page and recorded in `app/src/data/metroInfo.json`. The discount is display-only and intentionally not applied to any fare.
