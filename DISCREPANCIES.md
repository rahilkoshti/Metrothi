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
- [ ] `LINE_META` run-time denominators don't all match their line's actual
      segment count: yellow's path is 21 stations (20 segments) but its run
      time is `43 / 19`; red's path is 15 stations (14 segments) but uses
      `35 / 13` (which matches only if the non-operational Sabarmati Railway
      Station doesn't count as a stop — yet the engine's paths include it).
      Net effect: full-line red rides show ~37.7 min instead of the published
      35, yellow ~45.3 instead of 43. Verify segment counts against GMRC's
      published end-to-end times and fix the `avgSegmentMins` fractions.
- [ ] `tracks.json` `stationKm` values are non-monotonic for most of blue,
      red, and yellow (its own `tracks-report.txt` flags these), so track-length
      distances can't yet replace the straight-line distances used for
      segment-time weighting (`buildCumulativeMins`). Once the Phase A traces
      are cleaned up, swap haversine for along-track distance there.

---

## Journey session hook (`app/src/features/journey/hooks/useJourneySession.ts`)

- [ ] `computeStopTimeline` distributes a non-first leg's `travelMins` over
      `len - 2` segments instead of `len - 1` (leg starts are detected at the
      first stop *after* the interchange, since the interchange stop carries
      the previous leg's `viaLine`). Net effect: the first stop after an
      interchange shows the departure time as its arrival, and per-stop times
      within later legs are slightly stretched.
- [ ] The initial walk-time estimate reads `result.source.distanceKm`, but no
      `planJourney` output ever carries that field (App.tsx only attaches
      `distanceKm` to its nearest-station fallback object, which enters
      `planJourney` as a plain station ID). The estimate therefore always falls
      back to `DEFAULT_WALK_MINS` — `result.sourceWalkMins` is the field that
      actually holds the walk estimate for place-based searches.
- [ ] Journey progress resets on minimize/maximize: `useJourneySession` state
      lives inside `LiveJourneyScreen` / `MinimizedJourneyBar` (each mounts its
      own session with a fresh `startedAt`). The session should be lifted to
      App level (or a context) so progression survives UI transitions.

---

## Template for new entries

```
## <area> (`path/to/file.ts`)

- [ ] <what's wrong> — <where/how to fix it>
```
