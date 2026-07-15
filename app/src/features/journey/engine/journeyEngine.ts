// Metrothi Journey Engine (Ported from prototype)

import stationsData from "../../../data/stations.json";

export interface PlaceNode {
  isPlace: true;
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface StationRecord {
  id: string;
  name: string;
  line: string;
  secondLine?: string;
  secondLineOrder?: number;
  order: number;
  phase: number;
  terminal?: boolean;
  interchange?: boolean;
  operational?: boolean;
  needsVerification?: boolean;
  lat: number | null;
  lng: number | null;
}

export const STATIONS: StationRecord[] = (stationsData as { stations: StationRecord[] }).stations;

export const STATION_BY_ID: Record<string, any> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

const LINE_ORDER = ["blue", "red", "yellow", "violet"];

// A line's path is every station with `line === lineId` (positioned by `order`)
// merged with every station with `secondLine === lineId` (positioned by
// `secondLineOrder`, which lets an interchange sit mid-route rather than only
// at an end - e.g. old-high-court is a genuine stop in the middle of red).
// This is the only place route topology is derived; stations.json is the
// single source of truth for it.
function buildLinePath(lineId: string): string[] {
  const entries: { id: string; pos: number }[] = [];
  for (const s of STATIONS) {
    if (s.line === lineId) entries.push({ id: s.id, pos: s.order });
    else if (s.secondLine === lineId) entries.push({ id: s.id, pos: s.secondLineOrder ?? 0 });
  }
  return entries.sort((a, b) => a.pos - b.pos).map((e) => e.id);
}

export const LINE_PATHS: Record<string, string[]> = Object.fromEntries(
  LINE_ORDER.map((lineId) => [lineId, buildLinePath(lineId)])
);
const INTERCHANGE_BETWEEN: Record<string, string> = { "blue|red": "old-high-court", "red|yellow": "motera-stadium", "yellow|violet": "gnlu" };

function interchangeBetween(a: string, b: string) {
  return INTERCHANGE_BETWEEN[`${a}|${b}`] || INTERCHANGE_BETWEEN[`${b}|${a}`];
}

export const LINE_META: Record<string, any> = {
  blue: { name: "Line 1 (Vastral Gam \u2013 Thaltej Gam)", avgSegmentMins: 45 / 17, avgFrequencyMins: 10 },
  red: { name: "Line 2 (APMC \u2013 Motera Stadium)", avgSegmentMins: 35 / 13, avgFrequencyMins: 12 },
  yellow: { name: "Line 3 (Motera Stadium \u2013 Mahatma Mandir)", avgSegmentMins: 43 / 19, avgFrequencyMins: 24 },
  violet: { name: "Line 4 (GNLU \u2013 GIFT City)", avgSegmentMins: 6 / 2, avgFrequencyMins: 53, noTrainWindow: [10.3, 16.1] },
};

const FARE_SLABS = [
  { max: 2, fare: 5 },
  { max: 5, fare: 10 },
  { max: 9, fare: 15 },
  { max: 15, fare: 20 },
  { max: 999, fare: 25 },
];
export function fareForStops(stops: number) {
  return FARE_SLABS.find((s) => stops <= s.max)!.fare;
}

const INTERCHANGE_BUFFER_MINS = 3;
const WALK_SPEED_KMH = 5;

export function walkMinsForKm(km: number) {
  return Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
}

function getTicketOptions(source: any, dest: any) {
  const crossesPhase = source.phase !== dest.phase;
  if (crossesPhase) {
    return {
      tokenValid: false,
      cscValid: false,
      ncmcValid: true,
      note: "This trip crosses Ahmedabad \u2194 Gandhinagar \u2014 only an NCMC card works. Token and Smart Card (CSC) aren't valid here.",
    };
  }
  return {
    tokenValid: true,
    cscValid: true,
    ncmcValid: true,
    note: "Token, Smart Card, or NCMC all work for this trip. NCMC gets a 10% fare discount.",
  };
}

export function haversineKm(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function findNearestStation(loc: { lat: number, lng: number }) {
  let best = null, bestDist = Infinity;
  for (const s of STATIONS) {
    if (s.lat == null || s.operational === false) continue;
    const d = haversineKm(loc, s as { lat: number, lng: number });
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { station: best!, distKm: bestDist };
}

function sliceLine(lineId: string, fromId: string, toId: string) {
  const path = LINE_PATHS[lineId];
  const i = path.indexOf(fromId);
  const j = path.indexOf(toId);
  return i <= j ? path.slice(i, j + 1) : path.slice(j, i + 1).reverse();
}

function buildLegs(sourceId: string, destId: string) {
  const source = STATION_BY_ID[sourceId];
  const dest = STATION_BY_ID[destId];
  if (!source || !dest || sourceId === destId) return null;

  let legs: any[] = [];
  if (source.line === dest.line) {
    legs = [{ line: source.line, ids: sliceLine(source.line, sourceId, destId) }];
  } else {
    const li = LINE_ORDER.indexOf(source.line);
    const lj = LINE_ORDER.indexOf(dest.line);
    const chain = li <= lj ? LINE_ORDER.slice(li, lj + 1) : LINE_ORDER.slice(lj, li + 1).reverse();
    let cursor = sourceId;
    for (let k = 0; k < chain.length; k++) {
      const line = chain[k];
      const isLast = k === chain.length - 1;
      const legEnd = isLast ? destId : interchangeBetween(line, chain[k + 1]);
      legs.push({ line, ids: sliceLine(line, cursor, legEnd) });
      cursor = legEnd;
    }
  }

  // An interchange endpoint's stored `line` doesn't always match the line
  // actually ridden to reach/leave it (e.g. boarding at motera-stadium to go
  // one stop on yellow still records source.line "red" for chain-building).
  // That produces a leg that starts and ends on the same station with no
  // real travel - drop it so it doesn't count as a transfer or a wait.
  legs = legs.filter((leg) => leg.ids.length > 1);

  const merged: any[] = [];
  legs.forEach((leg, idx) => {
    const ids = idx === 0 ? leg.ids : leg.ids.slice(1);
    ids.forEach((id: string) => merged.push({ id, line: leg.line }));
  });

  return { source, dest, legs, merged, totalStops: merged.length - 1 };
}

// ---------------------------------------------------------------------------
// LIVE ESTIMATE
// ---------------------------------------------------------------------------
const BLUE_WEEKDAY = [
  { start: 6.333, end: 7, every: 20 }, { start: 7, end: 8, every: 10 },
  { start: 8, end: 11, every: 7 }, { start: 11, end: 17, every: 10 },
  { start: 17, end: 20, every: 7 }, { start: 20, end: 22, every: 10 },
  { start: 22, end: 23, every: 20 },
];
const BLUE_SATURDAY = [
  { start: 6.333, end: 7, every: 20 }, { start: 7, end: 8, every: 12 },
  { start: 8, end: 11, every: 10 }, { start: 11, end: 17, every: 12 },
  { start: 17, end: 20, every: 10 }, { start: 20, end: 22, every: 12 },
  { start: 22, end: 23, every: 20 },
];
const BLUE_SUNDAY = [
  { start: 6.333, end: 7, every: 20 }, { start: 7, end: 22, every: 12 },
  { start: 22, end: 23, every: 20 },
];
const RED_ALL = [{ start: 6.267, end: 22, every: 12 }, { start: 22, end: 23.17, every: 20 }];
const YELLOW_ALL = [{ start: 6.667, end: 8, every: 40 }, { start: 8, end: 21.33, every: 24 }];
const VIOLET_ALL = [
  { start: 7.6, end: 10.3, every: 49 },
  { start: 10.3, end: 16.1, every: null },
  { start: 16.1, end: 19.22, every: 57 },
];
const FREQ_RULES: Record<string, any> = {
  blue: { weekday: BLUE_WEEKDAY, saturday: BLUE_SATURDAY, sunday: BLUE_SUNDAY },
  red: { all: RED_ALL },
  yellow: { all: YELLOW_ALL },
  violet: { all: VIOLET_ALL },
};

// The metro runs on IST regardless of the device's timezone (a visitor's
// phone still set to home time would otherwise get wrong schedules). India
// has no DST, so a fixed +5:30 offset from UTC is exact - shift the instant
// into "IST-as-UTC" and read it back with the UTC getters.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function toIST(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/** UTC epoch ms of 00:00:00 IST on the IST calendar day containing `now`. */
export function istDayStartMs(now: Date): number {
  const shifted = now.getTime() + IST_OFFSET_MS;
  return Math.floor(shifted / 86400000) * 86400000 - IST_OFFSET_MS;
}

function dayType(now: Date) {
  const d = toIST(now).getUTCDay();
  if (d === 0) return "sunday";
  if (d === 6) return "saturday";
  return "weekday";
}
function rulesForLine(line: string, now: Date) {
  const r = FREQ_RULES[line];
  return r.all || r[dayType(now)];
}
export function hourOf(now: Date) {
  const ist = toIST(now);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60 + ist.getUTCSeconds() / 3600;
}
function simulateNextDeparture(rules: any[], hourNow: number) {
  let t = rules[0].start, guard = 0;
  while (t <= hourNow && guard < 3000) {
    const rule = rules.find((r) => t >= r.start && t < r.end) || rules[rules.length - 1];
    if (rule.every == null) { t = rule.end; continue; }
    t += rule.every / 60;
    guard++;
  }
  return t;
}
export function estimateLine(line: string, now = new Date()) {
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const firstStart = rules[0].start, lastEnd = rules[rules.length - 1].end;
  if (hourNow < firstStart) return { line, status: "before-first-train", minsUntilFirst: Math.round((firstStart - hourNow) * 60) };
  if (hourNow >= lastEnd) return { line, status: "after-last-train" };
  const activeRule = rules.find((r: any) => hourNow >= r.start && hourNow < r.end);
  if (activeRule && activeRule.every == null) return { line, status: "bus-only", resumesInMins: Math.round((activeRule.end - hourNow) * 60) };
  const nextDep = simulateNextDeparture(rules, hourNow);
  return { line, status: "running", waitMins: Math.max(0, Math.round((nextDep - hourNow) * 60)), currentFrequencyMins: activeRule ? activeRule.every : null };
}

export function upcomingDepartures(line: string, now: Date, count = 200) {
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const lastEnd = rules[rules.length - 1].end;
  if (hourNow >= lastEnd) return [];
  const deps = [];
  let cursor = hourNow;
  for (let i = 0; i < count; i++) {
    if (cursor >= lastEnd) break;
    const dep = simulateNextDeparture(rules, cursor);
    if (dep >= lastEnd) break;
    const activeRule = rules.find((r: any) => dep >= r.start && dep < r.end) || rules[rules.length - 1];
    deps.push({ hour: dep, waitMins: Math.max(0, Math.round((dep - hourNow) * 60)), frequencyMins: activeRule.every });
    cursor = dep;
  }
  return deps;
}

function stationOffsetHours(line: string, stationId: string, headingId: string) {
  const path = LINE_PATHS[line];
  const idx = path.indexOf(stationId);
  const headIdx = path.indexOf(headingId);
  const avgSegmentMins = LINE_META[line].avgSegmentMins;
  const stopsFromOrigin = headIdx > idx ? idx : path.length - 1 - idx;
  return (stopsFromOrigin * avgSegmentMins) / 60;
}

/**
 * Same as estimateLine, but offsets by the given station's position and
 * direction along the line - estimateLine alone reports the terminal's next
 * departure time, which is only correct if you're standing at the terminal.
 */
export function estimateLineAtStation(line: string, stationId: string, headingId: string, now = new Date()) {
  const path = LINE_PATHS[line];
  if (!path || path.indexOf(stationId) === -1 || path.indexOf(headingId) === -1) {
    return estimateLine(line, now);
  }

  const offsetHours = stationOffsetHours(line, stationId, headingId);
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const termHourNow = hourNow - offsetHours;
  const stationFirst = rules[0].start + offsetHours;
  const stationLast = rules[rules.length - 1].end + offsetHours;

  if (hourNow < stationFirst) return { line, status: "before-first-train", minsUntilFirst: Math.round((stationFirst - hourNow) * 60) };
  if (hourNow >= stationLast) return { line, status: "after-last-train" };

  const activeRule = rules.find((r: any) => termHourNow >= r.start && termHourNow < r.end);
  if (activeRule && activeRule.every == null) {
    return { line, status: "bus-only", resumesInMins: Math.round((activeRule.end + offsetHours - hourNow) * 60) };
  }

  const nextDepTerm = simulateNextDeparture(rules, termHourNow);
  const nextArrival = nextDepTerm + offsetHours;
  return { line, status: "running", waitMins: Math.max(0, Math.round((nextArrival - hourNow) * 60)), currentFrequencyMins: activeRule ? activeRule.every : null };
}

/** Direction/station-aware counterpart to upcomingDepartures. */
export function upcomingDeparturesAtStation(line: string, stationId: string, headingId: string, now: Date, count = 200) {
  const path = LINE_PATHS[line];
  if (!path || path.indexOf(stationId) === -1 || path.indexOf(headingId) === -1) {
    return upcomingDepartures(line, now, count);
  }

  const offsetHours = stationOffsetHours(line, stationId, headingId);
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const lastEnd = rules[rules.length - 1].end;
  const deps = [];
  let cursor = hourNow - offsetHours;
  for (let i = 0; i < count; i++) {
    if (cursor >= lastEnd) break;
    const dep = simulateNextDeparture(rules, cursor);
    if (dep >= lastEnd) break;
    const arrivalHour = dep + offsetHours;
    const activeRule = rules.find((r: any) => dep >= r.start && dep < r.end) || rules[rules.length - 1];
    deps.push({ hour: arrivalHour, waitMins: Math.max(0, Math.round((arrivalHour - hourNow) * 60)), frequencyMins: activeRule.every });
    cursor = dep;
  }
  return deps;
}

/**
 * Direction-aware next-departure preview for a station pair, using the same
 * leg-building the full planner uses - so a "next train" preview shown before
 * planning never disagrees with the plan itself.
 */
export function nextDepartureFromStation(sourceId: string, destId: string, now = new Date()) {
  const base = buildLegs(sourceId, destId);
  if (!base || base.legs.length === 0) return null;
  const firstLeg = base.legs[0];
  return estimateLineAtStation(firstLeg.line, sourceId, firstLeg.ids[firstLeg.ids.length - 1], now);
}

export function upcomingStationDepartures(stationId: string, line: string, now: Date, count = 2) {
  const path = LINE_PATHS[line];
  if (!path) return [];
  const idx = path.indexOf(stationId);
  if (idx === -1) return [];

  const total = path.length - 1;
  const avgSegmentMins = LINE_META[line].avgSegmentMins;
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const lastEnd = rules[rules.length - 1].end;

  const directions: { destination: string, departures: { hour: number, waitMins: number }[] }[] = [];

  function getDeparturesForOffset(offsetHours: number, destId: string) {
    const termTime = hourNow - offsetHours;
    const deps = [];
    let cursor = termTime;
    for (let i = 0; i < count; i++) {
      if (cursor >= lastEnd) break;
      const dep = simulateNextDeparture(rules, cursor);
      if (dep >= lastEnd) break;
      
      const arrivalHour = dep + offsetHours;
      if (arrivalHour >= hourNow) {
        deps.push({
          hour: arrivalHour,
          waitMins: Math.max(0, Math.round((arrivalHour - hourNow) * 60))
        });
      } else {
        i--;
      }
      cursor = dep;
    }
    if (deps.length > 0) {
      directions.push({
        destination: STATION_BY_ID[destId].name,
        departures: deps
      });
    }
  }

  if (idx < total) {
    getDeparturesForOffset((idx * avgSegmentMins) / 60, path[total]);
  }
  if (idx > 0) {
    getDeparturesForOffset(((total - idx) * avgSegmentMins) / 60, path[0]);
  }

  return directions;
}

export interface DayTrain {
  id: string;          // unique key
  clockTime: string;   // e.g. "06:40 AM"
  hour: number;        // decimal hour for comparison
  waitMins: number;    // negative = departed N mins ago
  departed: boolean;
  isNext: boolean;
}

export interface DayScheduleDirection {
  originId: string;        // terminal station ID the train starts from
  originName: string;      // terminal the train starts from
  destinationId: string;   // terminal station ID the train ends at
  destinationName: string; // terminal the train ends at
  trains: DayTrain[];
  nextIndex: number;       // index of the first upcoming train (-1 if all departed)
}

export function fullDayStationSchedule(stationId: string, line: string, now: Date): DayScheduleDirection[] {
  const path = LINE_PATHS[line];
  if (!path) return [];
  const idx = path.indexOf(stationId);
  if (idx === -1) return [];

  const total = path.length - 1;
  const avgSegmentMins = LINE_META[line].avgSegmentMins;
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const firstStart = rules[0].start;
  const lastEnd = rules[rules.length - 1].end;

  function buildDirection(offsetHours: number, originId: string, destId: string): DayScheduleDirection {
    const trains: DayTrain[] = [];

    // Walk from first possible terminal departure (going back far enough)
    let cursor = firstStart;
    let guard = 0;
    while (cursor < lastEnd && guard < 500) {
      guard++;
      const rule = rules.find((r: any) => cursor >= r.start && cursor < r.end) || rules[rules.length - 1];
      if ((rule as any).every == null) { cursor = (rule as any).end; continue; }

      const arrivalHour = cursor + offsetHours;
      if (arrivalHour >= lastEnd) break;

      const waitMins = Math.round((arrivalHour - hourNow) * 60);
      const clockTime = new Date(istDayStartMs(now) + arrivalHour * 3600000)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

      trains.push({
        id: `${line}-${originId}-${cursor.toFixed(4)}`,
        clockTime,
        hour: arrivalHour,
        waitMins,
        departed: waitMins < 0,
        isNext: false,
      });

      cursor += (rule as any).every / 60;
    }

    // Mark the next train
    let nextIndex = trains.findIndex(t => !t.departed);
    if (nextIndex !== -1) trains[nextIndex] = { ...trains[nextIndex], isNext: true };

    return {
      originId,
      originName: STATION_BY_ID[originId]?.name ?? originId,
      destinationId: destId,
      destinationName: STATION_BY_ID[destId]?.name ?? destId,
      trains,
      nextIndex,
    };
  }

  const result: DayScheduleDirection[] = [];

  // Direction A: towards terminal B (end of path)
  if (idx < total) {
    result.push(buildDirection((idx * avgSegmentMins) / 60, path[0], path[total]));
  }
  // Direction B: towards terminal A (start of path)
  if (idx > 0) {
    result.push(buildDirection(((total - idx) * avgSegmentMins) / 60, path[total], path[0]));
  }

  return result;
}


export function formatDuration(mins: number | null | undefined) {
  if (mins == null || Number.isNaN(mins)) return "\u2014";
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${String(rem).padStart(2, "0")}m`;
}

export function clockTimeAfter(now: Date, offsetMins: number) {
  const d = new Date(now.getTime() + offsetMins * 60000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

function simulateFromDeparture(legs: any[], now: Date, firstWaitMins: number, firstFrequencyMins: number | null) {
  let elapsedMins = firstWaitMins;
  const warnings: string[] = [];
  const legDetails: any[] = [];
  let feasible = true;
  let strandedAtLine = null;

  for (let idx = 0; idx < legs.length; idx++) {
    const leg = legs[idx];
    let waitMins = 0, currentFrequencyMins = null, status, bufferMins = 0;

    if (idx === 0) {
      waitMins = firstWaitMins;
      currentFrequencyMins = firstFrequencyMins ?? null;
      status = "running";
    } else {
      bufferMins = INTERCHANGE_BUFFER_MINS;
      elapsedMins += bufferMins;
      const projectedTime = new Date(now.getTime() + elapsedMins * 60000);
      const est = estimateLineAtStation(leg.line, leg.ids[0], leg.ids[leg.ids.length - 1], projectedTime);
      status = est.status;
      if (est.status === "running") {
        waitMins = est.waitMins!;
        currentFrequencyMins = est.currentFrequencyMins ?? null;
      } else if (est.status === "before-first-train") {
        waitMins = est.minsUntilFirst!;
        warnings.push(`${LINE_META[leg.line].name} hasn't started service yet \u2014 first train in ${formatDuration(est.minsUntilFirst)}.`);
      } else if (est.status === "bus-only") {
        waitMins = est.resumesInMins!;
        warnings.push(`${LINE_META[leg.line].name} is bus-only right now \u2014 trains resume in ${formatDuration(est.resumesInMins)}.`);
      } else {
        feasible = false;
        strandedAtLine = LINE_META[leg.line].name;
        legDetails.push({ line: leg.line, waitMins: null, travelMins: null, currentFrequencyMins: null, status, bufferMins });
        warnings.push(`${LINE_META[leg.line].name} has finished service for the day \u2014 you'd be stuck at the transfer.`);
        break;
      }
      elapsedMins += waitMins;
    }

    const travelMins = (leg.ids.length - 1) * LINE_META[leg.line].avgSegmentMins;
    elapsedMins += travelMins;
    legDetails.push({ line: leg.line, waitMins: Math.round(waitMins), travelMins: Math.round(travelMins), currentFrequencyMins, status, bufferMins });
  }

  return { legs: legDetails, totalMins: feasible ? Math.round(elapsedMins) : null, warnings, feasible, strandedAtLine };
}

// ---------------------------------------------------------------------------
// LIVE TRAIN POSITION SIMULATION
// ---------------------------------------------------------------------------

export interface ActiveTrain {
  id: string;
  line: string;
  /** Direction label e.g. "Towards Thaltej Gam" */
  direction: string;
  /** Origin terminal of this train's run */
  originId: string;
  /** Destination terminal of this train's run */
  destId: string;
  /** Current interpolated latitude */
  lat: number;
  /** Current interpolated longitude */
  lng: number;
  /** The station the train just departed */
  fromStationName: string;
  /** The next station the train is heading to */
  toStationName: string;
  /** 0–1 progress between fromStation and toStation */
  segmentProgress: number;
}

/**
 * Compute the positions of all trains currently in service.
 * Uses the same frequency rules as the planner engine. Trains are simulated as
 * moving at a constant speed between adjacent stations.
 */
export function getActiveTrains(now: Date = new Date()): ActiveTrain[] {
  const hourNow = hourOf(now);
  const trains: ActiveTrain[] = [];

  for (const lineId of Object.keys(LINE_PATHS)) {
    const path = LINE_PATHS[lineId];
    const meta = LINE_META[lineId];
    const rules = rulesForLine(lineId, now);
    const firstStart = rules[0].start;
    const lastEnd = rules[rules.length - 1].end;

    if (hourNow < firstStart || hourNow >= lastEnd) continue;

    // Skip if we're currently inside a bus-only (null-frequency) window
    const currentWindowRule = rules.find((r: any) => hourNow >= r.start && hourNow < r.end);
    if (currentWindowRule && (currentWindowRule as any).every == null) continue;

    // Collect valid stations along this line (skip ones with null coords)
    const validPath: { id: string; lat: number; lng: number }[] = [];
    for (const stationId of path) {
      const s = STATION_BY_ID[stationId];
      if (s && s.lat !== null && s.lng !== null && s.operational !== false) {
        validPath.push({ id: stationId, lat: s.lat, lng: s.lng });
      }
    }
    if (validPath.length < 2) continue;

    const avgSegmentMins = meta.avgSegmentMins;
    const totalTravelMins = (validPath.length - 1) * avgSegmentMins;
    const totalTravelHours = totalTravelMins / 60;

    // Simulate trains in BOTH directions
    const directions = [
      { orderedPath: validPath, destId: validPath[validPath.length - 1].id },
      { orderedPath: [...validPath].reverse(), destId: validPath[0].id },
    ];

    for (const { orderedPath, destId } of directions) {
      const originId = orderedPath[0].id;
      const destinationName = STATION_BY_ID[destId]?.name ?? destId;

      // Walk through all possible departure times from origin
      let cursor = firstStart;
      let guard = 0;
      while (cursor < lastEnd && guard < 500) {
        guard++;
        const rule = rules.find((r: any) => cursor >= r.start && cursor < r.end) || rules[rules.length - 1];
        if ((rule as any).every == null) {
          cursor = (rule as any).end;
          continue;
        }

        const departureHour = cursor;
        const arrivalHour = departureHour + totalTravelHours;

        // This train is currently in transit if it has departed and not yet arrived
        if (departureHour <= hourNow && hourNow < arrivalHour) {
          const elapsedHours = hourNow - departureHour;
          const elapsedMins = elapsedHours * 60;

          // Which segment are we on?
          const segmentIndex = Math.min(
            Math.floor(elapsedMins / avgSegmentMins),
            orderedPath.length - 2
          );
          const segmentProgress = (elapsedMins % avgSegmentMins) / avgSegmentMins;

          const fromStation = orderedPath[segmentIndex];
          const toStation = orderedPath[segmentIndex + 1];

          // Interpolate lat/lng
          const lat = fromStation.lat + (toStation.lat - fromStation.lat) * segmentProgress;
          const lng = fromStation.lng + (toStation.lng - fromStation.lng) * segmentProgress;

          trains.push({
            id: `${lineId}-${originId}-${departureHour.toFixed(4)}`,
            line: lineId,
            direction: `Towards ${destinationName}`,
            originId,
            destId,
            lat,
            lng,
            fromStationName: STATION_BY_ID[fromStation.id]?.name ?? fromStation.id,
            toStationName: STATION_BY_ID[toStation.id]?.name ?? toStation.id,
            segmentProgress,
          });
        }

        cursor += (rule as any).every / 60;
      }
    }
  }

  return trains;
}

export function planJourney(sourceInput: string | PlaceNode, destInput: string | PlaceNode, { now = new Date() } = {}) {
  let sourcePlace: PlaceNode | null = null;
  let destPlace: PlaceNode | null = null;
  let sourceWalkMins = 0;
  let destWalkMins = 0;

  let sourceId: string;
  if (typeof sourceInput === 'string') {
    sourceId = sourceInput;
  } else {
    sourcePlace = sourceInput;
    const { station, distKm } = findNearestStation(sourceInput);
    sourceId = station.id;
    sourceWalkMins = walkMinsForKm(distKm);
  }

  let destId: string;
  if (typeof destInput === 'string') {
    destId = destInput;
  } else {
    destPlace = destInput;
    const { station, distKm } = findNearestStation(destInput);
    destId = station.id;
    destWalkMins = walkMinsForKm(distKm);
  }

  const base = buildLegs(sourceId, destId);
  if (!base) return null;
  let { source, dest, legs, merged, totalStops } = base;

  // We keep source and dest as the actual stations for the metro logic,
  // but we will augment the final result to return the places if they exist.

  // Use the first *surviving* leg's line/direction, not the station's stored
  // primary line - at an interchange origin the real first ride can be on
  // the secondLine, and estimateLine alone ignores station position anyway.
  const firstLeg = legs[0];
  const firstLegHeading = firstLeg.ids[firstLeg.ids.length - 1];
  const firstEst = estimateLineAtStation(firstLeg.line, sourceId, firstLegHeading, now);
  const ticketInfo = getTicketOptions(source, dest);
  const crossesPhase = source.phase !== dest.phase;
  const usesViolet = legs.some((l: any) => l.line === "violet");

  if (firstEst.status === "after-last-train") {
    return {
      source, dest,
      legs: [],
      stops: merged.map((m: any) => ({ ...STATION_BY_ID[m.id], viaLine: m.line })),
      totalStops,
      travelMins: null,
      initialWaitMins: null,
      totalMins: null,
      feasible: false,
      strandedAtLine: LINE_META[firstLeg.line].name,
      fare: fareForStops(totalStops),
      ticketInfo,
      usesViolet,
      crossesPhase,
      numTransfers: legs.length - 1,
      warnings: [`${LINE_META[firstLeg.line].name} has finished service for the day \u2014 no trains from ${source.name} right now.`],
      options: [],
    };
  }

  let firstWaitMins = 0, firstFrequencyMins = null;
  const leadWarnings: string[] = [];
  if (firstEst.status === "running") {
    firstWaitMins = firstEst.waitMins!;
    firstFrequencyMins = firstEst.currentFrequencyMins ?? null;
  } else if (firstEst.status === "before-first-train") {
    firstWaitMins = firstEst.minsUntilFirst!;
    leadWarnings.push(`${LINE_META[firstLeg.line].name} hasn't started service yet \u2014 first train in ${formatDuration(firstEst.minsUntilFirst)}.`);
  } else if (firstEst.status === "bus-only") {
    firstWaitMins = firstEst.resumesInMins!;
    leadWarnings.push(`${LINE_META[firstLeg.line].name} is bus-only right now \u2014 trains resume in ${formatDuration(firstEst.resumesInMins)}.`);
  }

  const sim = simulateFromDeparture(legs, now, firstWaitMins, firstFrequencyMins);

  const departures = upcomingDeparturesAtStation(firstLeg.line, sourceId, firstLegHeading, now, 200);
  const options = departures.map((d) => {
    const optSim = simulateFromDeparture(legs, now, d.waitMins, d.frequencyMins ?? null);
    return {
      departInMins: d.waitMins,
      departClockTime: clockTimeAfter(now, d.waitMins),
      arriveClockTime: optSim.feasible ? clockTimeAfter(now, optSim.totalMins!) : null,
      totalMins: optSim.totalMins,
      legs: optSim.legs,
      warnings: optSim.warnings,
      feasible: optSim.feasible,
      strandedAtLine: optSim.strandedAtLine,
    };
  });

  return {
    source: sourcePlace || source,
    dest: destPlace || dest,
    sourceStation: source,
    destStation: dest,
    sourcePlace,
    destPlace,
    sourceWalkMins,
    destWalkMins,
    legs: sim.legs,
    stops: merged.map((m: any) => ({ ...STATION_BY_ID[m.id], viaLine: m.line })),
    totalStops,
    travelMins: Math.round(sim.legs.reduce((s, l) => s + (l.travelMins || 0), 0)),
    initialWaitMins: firstWaitMins,
    totalMins: sim.totalMins != null ? sim.totalMins + sourceWalkMins + destWalkMins : null,
    feasible: sim.feasible,
    strandedAtLine: sim.strandedAtLine,
    fare: fareForStops(totalStops),
    ticketInfo,
    usesViolet,
    crossesPhase,
    numTransfers: legs.length - 1,
    warnings: [...leadWarnings, ...sim.warnings],
    options,
  };
}
