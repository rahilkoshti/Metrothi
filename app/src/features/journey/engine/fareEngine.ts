// Metrothi Fare Engine
//
// GMRC charges on route distance, not station count. Every number here was read
// from GMRC's own fare endpoint - see the `_meta` block in fares.json for how it
// was gathered and what remains unverified.
//
// Nothing in this file applies the CSC/NCMC 10% discount (confirmed on GMRC's
// fare-rules page, see app/src/data/metroInfo.json). It is deliberately kept out
// of the arithmetic and shown as text only, in journeyEngine's getTicketOptions.

import faresData from "../../../data/fares.json";

interface Slab {
  /** Upper bound in km, exclusive. `null` on the top slab. */
  maxKm: number | null;
  fare: number;
}

const SEGMENTS = faresData.segments as Record<string, number>;
const OVERRIDES = faresData.overrides as Record<string, number>;
const SLABS = faresData.slabs as Slab[];
const MIN_FARE = faresData.minFare;

/** Segment and override keys are the two station ids sorted, joined by "|". */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/**
 * Track distance between two *adjacent* stations, or null if they are not
 * neighbours. Adjacency here follows the physical track, so it includes the
 * cross-line joins (motera-stadium->koteshwar-road, gnlu->pdeu) that the line
 * grouping in stations.json does not express.
 */
export function segmentKm(a: string, b: string): number | null {
  return SEGMENTS[pairKey(a, b)] ?? null;
}

/**
 * Distance along a route, given the ordered station ids the train actually
 * passes through. Returns null if any consecutive pair is not a real segment,
 * which means the caller handed us a path the network does not have.
 */
export function routeKm(stopIds: string[]): number | null {
  if (stopIds.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stopIds.length - 1; i++) {
    const km = segmentKm(stopIds[i], stopIds[i + 1]);
    if (km == null) return null;
    total += km;
  }
  // Segment distances are published to 2dp, so a long route accumulates a little
  // rounding noise. Round back to 2dp rather than let it drift.
  return Math.round(total * 100) / 100;
}

/** Slab lookup. Boundaries are inclusive-below: exactly 7.5km is the ₹15 slab. */
export function fareForKm(km: number): number {
  for (const slab of SLABS) {
    if (slab.maxKm == null || km < slab.maxKm) return slab.fare;
  }
  return SLABS[SLABS.length - 1].fare;
}

/**
 * Fare for a journey, given the ordered stations it passes through.
 *
 * GMRC's internal chargeable distance differs slightly from the distance it
 * displays, so a handful of pairs sit on the wrong side of a slab cut. Those are
 * listed in fares.json `overrides` and win over the slab result.
 *
 * Returns null when the route distance cannot be computed, so callers can decide
 * whether to hide the fare rather than show a fabricated one.
 */
export function fareForRoute(stopIds: string[]): number | null {
  if (stopIds.length < 2) return null;

  const override = OVERRIDES[pairKey(stopIds[0], stopIds[stopIds.length - 1])];
  if (override != null) return override;

  const km = routeKm(stopIds);
  if (km == null) return null;
  return Math.max(MIN_FARE, fareForKm(km));
}
