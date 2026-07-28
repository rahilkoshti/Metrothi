import facilitiesData from "../../data/stationFacilities.json";

/** One lift, as GMRC numbers it, and the gate(s) it serves. */
export interface StationLift {
  lift: number;
  gates: number[];
}

/** A transport mode GMRC names as physically integrated with a station. */
export type TransportMode = "brts" | "gsrtc" | "indian-railways" | "high-speed-rail";

export const MODE_LABELS: Record<TransportMode, string> = {
  brts: "BRTS",
  gsrtc: "GSRTC buses",
  "indian-railways": "Indian Railways",
  "high-speed-rail": "High-speed rail",
};

export interface MultiModalConnection {
  /** The Entry-Exit the transfer uses — matches `gates`. Null if GMRC doesn't say. */
  gate: number | null;
  /** GMRC's own wording, e.g. "Entry-Exit 5 – Lift and Skywalk connecting BRTS". */
  text: string;
}

export interface MultiModal {
  summary: string;
  modes: TransportMode[];
  connections: MultiModalConnection[];
  /** Present only where GMRC states a station amenity outright (PDEU: parking). */
  amenities?: string[];
  plannedAmenities?: string[];
  sourceNote?: string;
}

export interface StationFacilities {
  /** The station's name as printed by GMRC, where it differs from ours. */
  gmrcName: string;
  structure: "elevated" | "underground";
  interchange: boolean;
  /** Street-level gate numbers currently open, ascending. */
  gates: number[];
  /** Empty only if GMRC lists no lift for the station. */
  lifts: StationLift[];
  /**
   * Only on the 10 stations GMRC names. Absence means "GMRC publishes no built
   * interchange here" — not "nothing nearby" — so don't render a negative.
   */
  multiModal?: MultiModal;
}

const FACILITIES = facilitiesData.stations as Record<string, StationFacilities>;

/**
 * Gates, lifts and structure for a station, or null when GMRC does not list it.
 *
 * The only station GMRC omits is `sabarmati-railway-station`, which is not yet
 * operational — so a miss here is a real "not published", not a data gap to
 * paper over. Callers must handle null rather than showing a placeholder: an
 * invented gate number sends someone to the wrong side of the road.
 */
export function stationFacilities(stationId: string | null | undefined): StationFacilities | null {
  if (!stationId) return null;
  return FACILITIES[stationId] ?? null;
}

/** Gate numbers with a lift, ascending — the step-free way in. */
export function accessibleGates(facilities: StationFacilities): number[] {
  const gates = new Set(facilities.lifts.flatMap((l) => l.gates));
  return [...gates].sort((a, b) => a - b);
}

/** "Gate 1, 2 & 4" — for prose. Falls back to an em dash when there are none. */
export function formatGateList(gates: number[]): string {
  if (gates.length === 0) return "—";
  if (gates.length === 1) return `Gate ${gates[0]}`;
  return `Gates ${gates.slice(0, -1).join(", ")} & ${gates[gates.length - 1]}`;
}

/** Stations with a published interchange, for a "connects to BRTS" filter. */
export function stationsWithMode(mode: TransportMode): string[] {
  return Object.entries(FACILITIES)
    .filter(([, f]) => f.multiModal?.modes.includes(mode))
    .map(([id]) => id);
}
