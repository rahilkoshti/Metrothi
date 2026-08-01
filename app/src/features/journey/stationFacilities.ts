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

/** Every mode GMRC names, in the order the connection facet lists them. */
export const TRANSPORT_MODES: TransportMode[] = [
  "brts",
  "gsrtc",
  "indian-railways",
  "high-speed-rail",
];

/**
 * The words a rider types when they know the mode but not the station name —
 * fed to search as non-displayed aliases (§4.4). Each mode's own label, plus
 * the everyday word for it: someone looking for the intercity bus stand types
 * "bus", not "GSRTC", and a visitor types "railway", not "Kalupur".
 *
 * These are search keys, not rendered text, so they assert nothing beyond the
 * `modes` array they come from — the station page still shows only GMRC's own
 * wording. They stay deliberately short: a keyword that matches loosely pulls
 * unrelated stations above a name match.
 */
export const MODE_KEYWORDS: Record<TransportMode, string[]> = {
  brts: ["BRTS", "bus", "bus rapid transit"],
  gsrtc: ["GSRTC", "bus", "state bus", "intercity bus"],
  "indian-railways": ["Indian Railways", "railway", "rail"],
  "high-speed-rail": ["high speed rail", "bullet train", "NHSRCL", "rail"],
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

/**
 * "1, 2 & 4" — the numbers alone, in the order GMRC lists them. Falls back to
 * an em dash when there are none.
 *
 * The word in front of them ("Gate"/"Gates") is *not* here, deliberately: it
 * inflects, so it belongs to a `_one`/`_other` pair in the bundles (§6.2) and
 * the caller wraps this with `t('journey.gateList', { count, gates })`. This
 * used to return the whole phrase, which made it a composed English sentence
 * inside a React-free module — the shape §6 keeps finding.
 */
export function gateNumbers(gates: number[]): string {
  if (gates.length === 0) return "—";
  if (gates.length === 1) return String(gates[0]);
  return `${gates.slice(0, -1).join(", ")} & ${gates[gates.length - 1]}`;
}

/** Stations with a published interchange, for a "connects to BRTS" filter. */
export function stationsWithMode(mode: TransportMode): string[] {
  return Object.entries(FACILITIES)
    .filter(([, f]) => f.multiModal?.modes.includes(mode))
    .map(([id]) => id);
}

/**
 * The modes a station physically connects to, empty when GMRC names none.
 *
 * Empty is the honest answer for 44 of the 54 stations and for PDEU, whose
 * `multiModal` is a parking amenity and no interchange at all — a station you
 * cannot change modes at reads the same either way (§5.6).
 */
export function stationModes(stationId: string | null | undefined): TransportMode[] {
  return stationFacilities(stationId)?.multiModal?.modes ?? [];
}

/** "BRTS · Indian Railways" — the modes a station connects to, for a meta line. */
export function formatModeList(modes: TransportMode[]): string {
  return modes.map((m) => MODE_LABELS[m]).join(" · ");
}

/** Non-displayed search keywords for a station: the modes it connects to. */
export function stationSearchKeywords(stationId: string): string[] {
  return stationModes(stationId).flatMap((m) => MODE_KEYWORDS[m]);
}
