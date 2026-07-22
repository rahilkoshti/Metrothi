// Metrothi — track geometry runtime module
// Pure TypeScript, zero React imports (same rule as journeyEngine).
// Consumes app/src/data/tracks.json produced by scripts/fetch-tracks.mjs.
//
// Every function degrades gracefully: if a line or station is missing from
// tracks.json, callers get null and should fall back to the old
// station-to-station chord behaviour.

import tracksJson from '../../../data/tracks.json';

type LatLng = [number, number];

interface TrackLine {
  coords: LatLng[];
  stationKm: Record<string, number | null>;
  totalKm: number;
}

interface TracksFile {
  _meta: unknown;
  lines: Record<string, TrackLine>;
}

// JSON imports type tuples as number[][], so route the cast through unknown.
const TRACKS = (tracksJson as unknown as TracksFile).lines ?? {};

// Cumulative km per line, computed once at module load (kept out of the JSON
// to keep the bundle small).
const CUM_KM: Record<string, number[]> = {};

const R = 6371;
function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

for (const [lineId, line] of Object.entries(TRACKS)) {
  const cum: number[] = [0];
  for (let i = 1; i < line.coords.length; i++) {
    cum.push(cum[i - 1] + haversineKm(line.coords[i - 1], line.coords[i]));
  }
  CUM_KM[lineId] = cum;
}

/** Full track polyline for a line, or null if not in tracks.json. */
export function trackPath(lineId: string): LatLng[] | null {
  return TRACKS[lineId]?.coords ?? null;
}

/** Binary search: index of the last cumKm entry <= km. */
function segmentIndexAtKm(cum: number[], km: number): number {
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= km) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(lo, cum.length - 2);
}

/** Interpolated point at a distance (km) along a line's track. */
export function pointAtKm(lineId: string, km: number): LatLng | null {
  const line = TRACKS[lineId];
  const cum = CUM_KM[lineId];
  if (!line || !cum || line.coords.length < 2) return null;
  const clamped = Math.max(0, Math.min(km, cum[cum.length - 1]));
  const i = segmentIndexAtKm(cum, clamped);
  const segLen = cum[i + 1] - cum[i];
  const t = segLen > 0 ? (clamped - cum[i]) / segLen : 0;
  const [aLat, aLng] = line.coords[i];
  const [bLat, bLng] = line.coords[i + 1];
  return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t];
}

/** Km measure of a station along its line's track, or null. */
export function stationKm(lineId: string, stationId: string): number | null {
  const km = TRACKS[lineId]?.stationKm?.[stationId];
  return km == null ? null : km;
}

/**
 * Position of a train that is `progress` (0–1) of the way between two
 * stations, following the real track. Returns null when geometry is missing —
 * caller should fall back to straight-line interpolation.
 */
export function trainPositionOnTrack(
  lineId: string,
  fromStationId: string,
  toStationId: string,
  progress: number
): LatLng | null {
  const a = stationKm(lineId, fromStationId);
  const b = stationKm(lineId, toStationId);
  if (a == null || b == null) return null;
  return pointAtKm(lineId, a + (b - a) * Math.max(0, Math.min(1, progress)));
}

/**
 * The slice of real track between two stations on the same line, ordered
 * from → to (handles travel in either direction). Endpoints are exact
 * interpolated points, so consecutive leg slices join cleanly.
 * Returns null when geometry is missing.
 */
export function sliceTrackBetween(
  lineId: string,
  fromStationId: string,
  toStationId: string
): LatLng[] | null {
  const line = TRACKS[lineId];
  const cum = CUM_KM[lineId];
  const a = stationKm(lineId, fromStationId);
  const b = stationKm(lineId, toStationId);
  if (!line || !cum || a == null || b == null) return null;

  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const start = pointAtKm(lineId, lo);
  const end = pointAtKm(lineId, hi);
  if (!start || !end) return null;

  const out: LatLng[] = [start];
  const iLo = segmentIndexAtKm(cum, lo);
  const iHi = segmentIndexAtKm(cum, hi);
  for (let i = iLo + 1; i <= iHi; i++) {
    if (cum[i] > lo && cum[i] < hi) out.push(line.coords[i]);
  }
  out.push(end);
  if (b < a) out.reverse(); // travelling "down" the line
  return out;
}

/**
 * Convenience for the map's route highlight: given planJourney's `stops`
 * array (each stop has id + viaLine), return one track slice per leg.
 * Falls back to the chord between the leg's stops when track data is missing.
 */
export function routeLegSlices(
  stops: Array<{ id: string; viaLine: string; lat: number | null; lng: number | null }>
): Array<{ line: string; coords: LatLng[] }> {
  if (!stops || stops.length < 2) return [];

  // Group travel *segments* by the line they're ridden on. The engine's merged
  // stops give the interchange stop the PREVIOUS leg's viaLine, so the line of
  // the segment between stop[i-1] and stop[i] is stops[i].viaLine.
  const legs: Array<{ line: string; from: number; to: number }> = [];
  for (let i = 1; i < stops.length; i++) {
    const segLine = stops[i].viaLine;
    const last = legs[legs.length - 1];
    if (last && last.line === segLine) last.to = i;
    else legs.push({ line: segLine, from: i - 1, to: i });
  }

  return legs
    .filter((l) => l.to > l.from)
    .map((l) => {
      const fromStop = stops[l.from];
      const toStop = stops[l.to];
      const line = l.line;
      const slice = sliceTrackBetween(line, fromStop.id, toStop.id);
      if (slice) return { line, coords: slice };
      // Fallback: chord through the leg's stops that have coords.
      const chord = stops
        .slice(l.from, l.to + 1)
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => [s.lat as number, s.lng as number] as LatLng);
      return { line, coords: chord };
    })
    .filter((l) => l.coords.length >= 2);
}
