# Map Tab — Step 1 Implementation Guide

Scope: real track geometry, zoom-progressive labels, route-highlight dimming, gliding trains — all on the existing Leaflet stack. Everything here transfers to a later MapLibre migration (the GeoJSON + measures are renderer-agnostic).

**Order of operations matters** — follow the phases in sequence.

---

## Phase A — Generate the track data (dev machine, ~30 min incl. review)

1. Drop `fetch-tracks.mjs` into a new `scripts/` folder at the **repo root** (sibling of `app/` and `files/`).
2. Run it: `node scripts/fetch-tracks.mjs`
   - It hits Overpass twice (rail ways, then station nodes) and writes `app/src/data/tracks.json` + `app/src/data/tracks-report.txt`.
   - Overpass is rate-limited; if you get a 429/504, wait a minute and re-run.
3. **Read `tracks-report.txt` before doing anything else.** Three things to look for:
   - `!! BAD COORD?` lines — stations sitting > 120 m from the traced track. **Vastral will be flagged.** The report suggests corrected coordinates from OSM's station nodes when a name match exists. Apply fixes to `stations.json` (and the engine's hardcoded copy, until you've done the JSON unification), remove the station from `TRACE_SKIP` in the script, and re-run.
   - `!! no rail path in OSM` — a segment OSM hasn't mapped. Phase 2 (yellow/violet) is the risk area. If yellow/violet come back empty entirely, flip `INCLUDE_CONSTRUCTION = true` and re-run (pre-opening tagging often lingers). If a segment is genuinely unmapped, the script draws a straight chord for just that segment and everything still works — you can map the missing viaduct in OSM yourself later (it's ~30 min in the iD editor and improves the commons).
   - `Measures monotonic ✓` per line — if a line reports non-monotonic measures, the trace doubled back somewhere; inspect that line's coords on geojson.io before shipping.
4. Sanity-check the output size — expect roughly 40–90 KB total. Commit `tracks.json`; the report is up to you (I'd commit it as provenance, consistent with your `_meta` discipline).
5. **Attribution (required by ODbL):** add "Track geometry © OpenStreetMap contributors" to the map attribution string in `MapScreen.tsx` — you already credit OSM for tiles, so extend that line.

## Phase B — Runtime geometry module (~15 min)

Place `trackGeometry.ts` at `app/src/features/map/geometry/trackGeometry.ts`. It's pure TS (zero React), mirroring the engine rule. It exports:

- `trackPath(lineId)` — full polyline for rendering the line
- `trainPositionOnTrack(lineId, fromStationId, toStationId, progress)` — position along real track
- `sliceTrackBetween(lineId, fromId, toId)` — real-geometry slice for route highlights (handles reverse travel)
- `routeLegSlices(stops)` — takes `planJourney(...)!.stops` directly, returns one colored slice per leg

Every function returns `null`/falls back to chords when data is missing, so a bad `tracks.json` can never break the map — it just looks like today.

## Phase C — Engine: expose station IDs on ActiveTrain (~5 min)

Two tiny edits in `journeyEngine.ts` (keeps the engine geometry-free; the map layer owns track lookup):

In the `ActiveTrain` interface, after `destId: string;` add:

```ts
  /** Station the train just departed (id) */
  fromStationId: string;
  /** Station the train is heading to (id) */
  toStationId: string;
```

In `getActiveTrains`, inside `trains.push({ ... })`, add alongside `fromStationName`/`toStationName`:

```ts
            fromStationId: fromStation.id,
            toStationId: toStation.id,
```

## Phase D — Trains follow track + glide (~10 min)

Replace `app/src/features/map/components/LiveTrainsLayer.tsx` with the provided file. Changes from yours:

- Position comes from `trainPositionOnTrack(...)` with chord fallback.
- Icons are cached per color (you were rebuilding a `divIcon` for every train every second — new DOM node each tick, which also made the CSS-glide trick impossible).
- The icon gets `className: 'train-glide'` so the CSS below animates Leaflet's `transform` between 1-second ticks → smooth motion instead of teleporting dots. At metro speeds and city zoom this reads as continuous; no rAF loop needed.
- A small "Simulated" tag in the tooltip (your honesty principle, now on the map itself).

Add to `index.css`:

```css
/* Trains glide between 1s simulation ticks */
.leaflet-marker-icon.train-glide {
  transition: transform 0.95s linear;
}
/* …but never during zoom/pan animations, or markers lag behind the map */
.leaflet-zoom-anim .leaflet-marker-icon.train-glide {
  transition: none;
}
```

## Phase E — MapScreen: real tracks, route highlight, dimming, labels (~1–2 hrs)

All edits in `MapScreen.tsx`.

### E1. Imports

```tsx
import { useMapEvents } from 'react-leaflet';
import { trackPath, routeLegSlices } from '../geometry/trackGeometry';
```

### E2. Render real track polylines

In the `polylines` useMemo, use the track and keep the chord as fallback:

```tsx
const polylines = useMemo(() => {
  return Object.entries(LINE_PATHS)
    .filter(([lineId]) => activeLines.has(lineId))
    .map(([lineId, path]) => {
      const track = trackPath(lineId);
      if (track) return { lineId, coords: track };
      const lineCoords: [number, number][] = [];
      path.forEach(stationId => {
        const station = STATION_BY_ID[stationId];
        if (station && station.lat !== null && station.lng !== null) {
          lineCoords.push([station.lat, station.lng]);
        }
      });
      return { lineId, coords: lineCoords };
    });
}, [activeLines]);
```

Also render a subtle white/dark casing under each line for the classic transit-map look — add this directly **before** your existing line `<Polyline>` block (Leaflet stacks in render order):

```tsx
{polylines.map(line => (
  <Polyline
    key={`${line.lineId}-casing`}
    positions={line.coords}
    pathOptions={{
      color: theme === 'dark' ? '#0f0f0f' : '#ffffff',
      weight: plannedJourney ? 0 : 13,
      opacity: 1, lineJoin: 'round', lineCap: 'round',
    }}
  />
))}
```

### E3. Route highlight — replace the dashed chord overlay

Delete the `plannedRouteCoords` useMemo and its `<Polyline>` (the white dashed one). Replace with per-leg colored slices of real track:

```tsx
const routeLegs = useMemo(() => {
  if (!plannedJourney?.stops) return null;
  return routeLegSlices(plannedJourney.stops);
}, [plannedJourney]);
```

and in the JSX, after the dimmed base lines:

```tsx
{routeLegs?.map((leg, i) => (
  <Polyline key={`route-casing-${i}`} positions={leg.coords}
    pathOptions={{ color: theme === 'dark' ? '#fff' : '#000', weight: 12, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }} />
))}
{routeLegs?.map((leg, i) => (
  <Polyline key={`route-${i}`} positions={leg.coords}
    pathOptions={{ color: LINE_COLORS[leg.line], weight: 7, opacity: 1, lineJoin: 'round', lineCap: 'round' }} />
))}
```

Drop the non-route line opacity during routing from `0.3` to `0.15` in your existing base-line `pathOptions`.

### E4. Basemap dimming during routing

On the `MapContainer`, make the className conditional:

```tsx
className={`w-full h-full bg-[#ebe8e0] ${plannedJourney ? 'map-routing' : ''}`}
```

Add to `index.css`:

```css
/* When a route is active, mute the basemap so the route owns the screen */
.map-routing .leaflet-tile-pane {
  filter: grayscale(1) brightness(1.06) contrast(0.92);
  transition: filter 0.3s ease;
}
:root[data-theme="dark"] .map-routing .leaflet-tile-pane {
  filter: grayscale(1) brightness(0.75) contrast(0.95);
}
```

Also auto-fit the camera to the route — inside `MapEffect` (or a sibling), add:

```tsx
function RouteFitEffect({ routeLegs }: { routeLegs: { coords: [number, number][] }[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!routeLegs?.length) return;
    const all = routeLegs.flatMap(l => l.coords);
    map.fitBounds(L.latLngBounds(all), { padding: [60, 60], animate: true });
  }, [routeLegs, map]);
  return null;
}
```

Mount it inside `MapContainer`: `<RouteFitEffect routeLegs={routeLegs} />`.

### E5. Zoom-progressive labels

Add a tiny watcher component (inside MapScreen file):

```tsx
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}
```

In MapScreen: `const [zoom, setZoom] = useState(12);` and mount `<ZoomWatcher onZoom={setZoom} />` inside the MapContainer.

Then in the station-marker map, compute a label tier and key the Marker on it (react-leaflet can't toggle a Tooltip's `permanent` prop live — remounting via the key is the clean workaround):

```tsx
const isMajor = station.interchange || station.terminal ||
  LINE_PATHS[station.line]?.[0] === station.id ||
  LINE_PATHS[station.line]?.at(-1) === station.id;
const showLabel = zoom >= 13 || isMajor;

<Marker
  key={`${station.id}-${showLabel ? 'lbl' : 'dot'}`}
  ...
>
  {showLabel && (
    <Tooltip permanent direction="right" className={`vignelli-label ${zoom >= 15 ? 'vignelli-lg' : ''}`} ...>
```

(Note: the engine's hardcoded STATIONS array has no `terminal` field — stations.json does. The `LINE_PATHS` first/last check above covers terminals either way; once you unify onto stations.json you can use the field directly.)

Add to `index.css`:

```css
.leaflet-tooltip.vignelli-label.vignelli-lg { font-size: 13px; }
:root[data-theme="dark"] .leaflet-tooltip.vignelli-label {
  color: #fff;
  text-shadow: 1px 1px 0 #0f0f0f, -1px -1px 0 #0f0f0f, 1px -1px 0 #0f0f0f, -1px 1px 0 #0f0f0f;
}
```

(That second rule also fixes an existing bug: your label halo is hardcoded to the light basemap color, so labels look wrong on the dark CARTO tiles today.)

---

## Acceptance checklist

- [ ] Blue line no longer zigzags around Vastral; all four lines follow the viaduct through curves (compare against the GMRC route map at 2–3 spots per line).
- [ ] `tracks-report.txt` has zero unreviewed `!!` lines; Vastral's coordinate corrected in stations.json **and** the engine array.
- [ ] Train dots ride the curve, glide smoothly, and never animate-lag during pinch zoom.
- [ ] Train tooltip shows "Simulated".
- [ ] Planning a route on the map: basemap desaturates, non-route lines drop to near-invisible, the route renders as full-color real geometry per leg with casing, camera fits the route.
- [ ] Zoom 11–12 shows labels only at interchanges/terminals; zoom 13+ shows all; labels legible on both themes.
- [ ] Delete `tracks.json` temporarily → map still renders identically to today (fallback path works). Restore it.
- [ ] Map attribution includes OpenStreetMap credit for track geometry.

## Known limits (accepted for Step 1, solved by MapLibre later)

- Label *collision* isn't handled — tiers just reduce density. True collision detection comes free with MapLibre's symbol layers.
- Raster tile blur between zoom levels remains.
- `tracks.json` uses one directional track per line; parallel-track separation at high zoom isn't modeled (nobody will notice at city scale).
