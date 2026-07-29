import {
  stationFacilities,
  accessibleGates,
  formatGateList,
  type MultiModalConnection,
} from "./stationFacilities";

/**
 * What to tell a rider as they get off at their destination (PRD §4.2).
 *
 * The same physical-station data the Station Info tab renders as reference
 * (§5.6), reduced to the two facts that are a decision at the moment the doors
 * open: which exit is step-free, and which exit the onward connection uses.
 * Everything else about the station — its structure, every gate, every lift —
 * stays on the station page, where someone reading *about* a station wants it.
 */
export interface ExitGuidance {
  /** "Step-free exit at Gates 2, 3 & 5", or null where GMRC lists no lift. */
  stepFree: string | null;
  /** GMRC's connections, gate kept separate from its wording. */
  connections: MultiModalConnection[];
}

/**
 * GMRC prefixes most connection strings with the Entry-Exit they use
 * ("Entry-Exit 5 – Lift and Skywalk connecting BRTS"). The gate is printed on
 * its own, so the prefix would say it twice. Spelling varies across the source
 * rows — hyphen or space in "Entry Exit", en dash or hyphen as the separator —
 * so all four combinations are matched rather than the one that happened to be
 * looked at first.
 */
const GATE_PREFIX = /^entry[- ]?exit\s*\d+\s*[–—-]\s*/i;

/**
 * Destination guidance for a station, or null when there is nothing to say.
 *
 * Null covers three different cases on purpose, because they render the same:
 * the station GMRC does not list at all (`sabarmati-railway-station`), a
 * station with neither a lift nor a published interchange, and a missing id.
 * Absence in the source means GMRC publishes nothing here, *not* that there is
 * no step-free exit and no bus outside — so callers must render nothing rather
 * than a negative (§4.4.1, §7.6).
 */
export function exitGuidanceFor(stationId: string | null | undefined): ExitGuidance | null {
  const facilities = stationFacilities(stationId);
  if (!facilities) return null;

  const gates = accessibleGates(facilities);
  const stepFree = gates.length > 0 ? `Step-free exit at ${formatGateList(gates)}` : null;

  // Only connections, not `amenities`: parking at PDEU is a fact about the
  // station, not a way onward from it, and it already renders on the station
  // page. A journey ending at PDEU therefore shows its step-free exit alone.
  const connections = (facilities.multiModal?.connections ?? []).map((c) => ({
    gate: c.gate,
    text: c.text.replace(GATE_PREFIX, ""),
  }));

  if (!stepFree && connections.length === 0) return null;
  return { stepFree, connections };
}
