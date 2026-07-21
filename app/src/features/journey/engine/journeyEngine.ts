// Metrothi Journey Engine (Ported from prototype)

import stationsData from "../../../data/stations.json";
import { fareForRoute } from "./fareEngine";

export interface PlaceNode {
  isPlace: true;
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface StationRecord {
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
  connectsTo?: string;
  notes?: string;
  lat: number | null;
  lng: number | null;
}

/** One window of a line's timetable: trains every `every` minutes between
 *  `start` and `end` (decimal IST hours). `every: null` = bus-only window. */
export interface FrequencyRule {
  start: number;
  end: number;
  every: number | null;
}

/** Timetable rules keyed by day type; `all` applies every day. */
interface DayRules {
  all?: FrequencyRule[];
  weekday?: FrequencyRule[];
  saturday?: FrequencyRule[];
  sunday?: FrequencyRule[];
}

/** A line's full timetable, optionally split per origin terminal. */
interface LineFrequencyConfig extends DayRules {
  directions?: Record<string, DayRules>;
}

export interface LineMeta {
  name: string;
  avgSegmentMins: number;
  avgFrequencyMins: number;
  /** Decimal-hour window during which no trains run (violet's bus bridge). */
  noTrainWindow?: [number, number];
}

export type LineEstimate =
  | { line: string; status: "before-first-train"; minsUntilFirst: number }
  | { line: string; status: "after-last-train" }
  | { line: string; status: "bus-only"; resumesInMins: number }
  | { line: string; status: "running"; waitMins: number; currentFrequencyMins: number | null };

/** One ride on a single line, from ids[0] to ids[ids.length - 1]. */
export interface Leg {
  line: string;
  ids: string[];
  /** Terminal the train is signed towards (for platform signage). */
  headingId: string;
  headingName: string;
}

/** A leg augmented with simulated timing for a concrete departure. */
export interface LegDetail extends Leg {
  waitMins: number | null;
  travelMins: number | null;
  currentFrequencyMins: number | null;
  status: LineEstimate["status"];
  bufferMins: number;
}

export interface TicketInfo {
  tokenValid: boolean;
  cscValid: boolean;
  ncmcValid: boolean;
  note: string;
}

export type JourneyStop = StationRecord & { viaLine: string };

export interface Departure {
  hour: number;
  waitMins: number;
  frequencyMins: number | null;
}

/** One concrete departure choice within a plan. */
export interface JourneyOption {
  departInMins: number;
  departClockTime: string;
  arriveClockTime: string | null;
  totalMins: number | null;
  legs: LegDetail[];
  warnings: string[];
  feasible: boolean;
  strandedAtLine: string | null;
  departTimeMs: number;
  leaveTimeMs: number;
  arriveTimeMs: number | null;
  leaveClockTime: string;
  leaveInMins: number;
}

export interface PlanResult {
  /** Place if the user searched from a place, otherwise the source station. */
  source: StationRecord | PlaceNode;
  dest: StationRecord | PlaceNode;
  sourceStation: StationRecord;
  destStation: StationRecord;
  sourcePlace: PlaceNode | null;
  destPlace: PlaceNode | null;
  sourceWalkMins: number;
  destWalkMins: number;
  legs: LegDetail[];
  stops: JourneyStop[];
  totalStops: number;
  travelMins: number | null;
  initialWaitMins: number | null;
  totalMins: number | null;
  feasible: boolean;
  strandedAtLine: string | null;
  /** null when route distance could not be resolved - show nothing, never a guess. */
  fare: number | null;
  ticketInfo: TicketInfo;
  usesViolet: boolean;
  crossesPhase: boolean;
  numTransfers: number;
  warnings: string[];
  options: JourneyOption[];
  queryTime: Date;
  arriveBy: boolean;
  isLeaveNow: boolean;
}

export const STATIONS: StationRecord[] = (stationsData as { stations: StationRecord[] }).stations;

export const STATION_BY_ID: Record<string, StationRecord> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

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

export const LINE_META: Record<string, LineMeta> = {
  blue: { name: "Line 1 (Vastral Gam \u2013 Thaltej Gam)", avgSegmentMins: 45 / 17, avgFrequencyMins: 10 },
  red: { name: "Line 2 (APMC \u2013 Motera Stadium)", avgSegmentMins: 35 / 14, avgFrequencyMins: 12 },
  yellow: { name: "Line 3 (Motera Stadium \u2013 Mahatma Mandir)", avgSegmentMins: 43 / 20, avgFrequencyMins: 24 },
  violet: { name: "Line 4 (GNLU \u2013 GIFT City)", avgSegmentMins: 6 / 2, avgFrequencyMins: 53, noTrainWindow: [10.3, 16.1] },
};

// Distance-weighted cumulative run times (minutes) from a line's first
// station to each station on its path. The end-to-end total stays pinned to
// the published run time (segments × avgSegmentMins) so full-line totals are
// unchanged; within the line, each segment's share is proportional to the
// straight-line distance between its stations instead of an even split.
// (tracks.json's stationKm values are non-monotonic per its own report, so
// station coordinates are the reliable distance source for now.)
function buildCumulativeMins(lineId: string): number[] {
  const path = LINE_PATHS[lineId];
  const totalMins = (path.length - 1) * LINE_META[lineId].avgSegmentMins;

  // Segment distances. Stations with unknown coords (e.g. the unopened
  // Sabarmati Railway Station) are bridged by splitting the distance between
  // the surrounding known stations evenly across the spanned segments.
  const dists: number[] = new Array(path.length - 1).fill(0);
  let prevKnown = -1;
  for (let i = 0; i < path.length; i++) {
    const s = STATION_BY_ID[path[i]];
    if (!s || s.lat == null || s.lng == null) continue;
    if (prevKnown !== -1) {
      const prev = STATION_BY_ID[path[prevKnown]];
      const d = haversineKm(
        { lat: prev.lat!, lng: prev.lng! },
        { lat: s.lat, lng: s.lng }
      );
      const span = i - prevKnown;
      for (let k = prevKnown; k < i; k++) dists[k] = d / span;
    }
    prevKnown = i;
  }

  const totalDist = dists.reduce((a, b) => a + b, 0);
  const cum: number[] = [0];
  if (totalDist <= 0) {
    // No usable coordinates — fall back to uniform segments.
    for (let i = 1; i < path.length; i++) cum.push(i * LINE_META[lineId].avgSegmentMins);
    return cum;
  }
  let acc = 0;
  for (const d of dists) {
    acc += totalMins * (d / totalDist);
    cum.push(acc);
  }
  cum[cum.length - 1] = totalMins; // pin exactly, avoiding float drift
  return cum;
}

export const LINE_CUM_MINS: Record<string, number[]> = Object.fromEntries(
  LINE_ORDER.map((lineId) => [lineId, buildCumulativeMins(lineId)])
);

/** Distance-weighted run time in minutes between two stations on a line. */
export function travelMinsBetween(line: string, fromId: string, toId: string): number {
  const path = LINE_PATHS[line];
  const cum = LINE_CUM_MINS[line];
  const i = path.indexOf(fromId);
  const j = path.indexOf(toId);
  if (i === -1 || j === -1) return 0;
  return Math.abs(cum[j] - cum[i]);
}

// Fares live in fareEngine.ts - GMRC charges on distance, not stop count.

const INTERCHANGE_BUFFER_MINS = 3;
const WALK_SPEED_KMH = 5;

export function walkMinsForKm(km: number) {
  return Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
}

function getTicketOptions(source: StationRecord, dest: StationRecord): TicketInfo {
  const crossesPhase = source.phase !== dest.phase;
  if (crossesPhase) {
    return {
      tokenValid: false,
      cscValid: false,
      ncmcValid: true,
      note: "This trip crosses Ahmedabad \u2194 Gandhinagar \u2014 only an NCMC card works. Token and Smart Card (CSC) aren't valid here. NCMC also gets 10% off the fare shown.",
    };
  }
  return {
    tokenValid: true,
    cscValid: true,
    ncmcValid: true,
    // Both CSC and NCMC carry the same 10% (GMRC fare-rules and smart-cards
    // pages). It is deliberately NOT applied to the fare - the number we show is
    // the token fare, and this note tells the rider what they would save.
    // Do not fold it into the arithmetic.
    note: "Token, Smart Card, or NCMC all work for this trip. Smart Card and NCMC both get 10% off the fare shown, deducted on exit.",
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
  let best: StationRecord | null = null, bestDist = Infinity;
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

  let rawLegs: { line: string; ids: string[] }[] = [];
  if (source.line === dest.line) {
    rawLegs = [{ line: source.line, ids: sliceLine(source.line, sourceId, destId) }];
  } else {
    const li = LINE_ORDER.indexOf(source.line);
    const lj = LINE_ORDER.indexOf(dest.line);
    const chain = li <= lj ? LINE_ORDER.slice(li, lj + 1) : LINE_ORDER.slice(lj, li + 1).reverse();
    let cursor = sourceId;
    for (let k = 0; k < chain.length; k++) {
      const line = chain[k];
      const isLast = k === chain.length - 1;
      const legEnd = isLast ? destId : interchangeBetween(line, chain[k + 1]);
      rawLegs.push({ line, ids: sliceLine(line, cursor, legEnd) });
      cursor = legEnd;
    }
  }

  // An interchange endpoint's stored `line` doesn't always match the line
  // actually ridden to reach/leave it (e.g. boarding at motera-stadium to go
  // one stop on yellow still records source.line "red" for chain-building).
  // That produces a leg that starts and ends on the same station with no
  // real travel - drop it so it doesn't count as a transfer or a wait.
  const legs: Leg[] = rawLegs.filter((leg) => leg.ids.length > 1).map(leg => {
    const path = LINE_PATHS[leg.line];
    const fromId = leg.ids[0];
    const toId = leg.ids[leg.ids.length - 1];
    const i = path.indexOf(fromId);
    const j = path.indexOf(toId);
    const headingId = i <= j ? path[path.length - 1] : path[0];
    const headingName = STATION_BY_ID[headingId]?.name || "";
    return { ...leg, headingId, headingName };
  });

  const merged: { id: string; line: string }[] = [];
  legs.forEach((leg, idx) => {
    const ids = idx === 0 ? leg.ids : leg.ids.slice(1);
    ids.forEach((id) => merged.push({ id, line: leg.line }));
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
const RED_APMC = [{ start: 6.333, end: 22, every: 12 }, { start: 22, end: 23.167, every: 20 }];
const RED_MOTERA = [{ start: 6.267, end: 22, every: 12 }, { start: 22, end: 23.000, every: 20 }];

const YELLOW_ALL = [{ start: 6.667, end: 8, every: 40 }, { start: 8, end: 21.33, every: 24 }];
const YELLOW_MOTERA = [{ start: 6.917, end: 8, every: 40 }, { start: 8, end: 21.333, every: 24 }];
const YELLOW_MAHATMA = [{ start: 6.667, end: 8, every: 40 }, { start: 8, end: 21.000, every: 24 }];

const VIOLET_ALL = [
  { start: 7.6, end: 10.3, every: 49 },
  { start: 10.3, end: 16.1, every: null },
  { start: 16.1, end: 19.22, every: 57 },
];
const FREQ_RULES: Record<string, LineFrequencyConfig> = {
  blue: { weekday: BLUE_WEEKDAY, saturday: BLUE_SATURDAY, sunday: BLUE_SUNDAY },
  red: { 
    directions: {
      "apmc": { all: RED_APMC },
      "motera-stadium": { all: RED_MOTERA }
    },
    all: RED_ALL 
  },
  yellow: { 
    directions: {
      "motera-stadium": { all: YELLOW_MOTERA },
      "mahatma-mandir": { all: YELLOW_MAHATMA }
    },
    all: YELLOW_ALL 
  },
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
function rulesForLine(line: string, now: Date, originId?: string): FrequencyRule[] {
  const r = FREQ_RULES[line];
  if (originId && r.directions && r.directions[originId]) {
    const dirR = r.directions[originId];
    return dirR.all || dirR[dayType(now)]!;
  }
  return r.all || r[dayType(now)]!;
}
export function hourOf(now: Date) {
  const ist = toIST(now);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60 + ist.getUTCSeconds() / 3600;
}
const DEPARTURE_GRID_CACHE: Record<string, number[]> = {};

function getDepartureGrid(line: string, now: Date, originId?: string): number[] {
  const dt = dayType(now);
  const cacheKey = `${line}-${originId || 'any'}-${dt}`;
  if (DEPARTURE_GRID_CACHE[cacheKey]) return DEPARTURE_GRID_CACHE[cacheKey];

  const rules = rulesForLine(line, now, originId);
  const grid: number[] = [];
  const lastEnd = rules[rules.length - 1].end;
  
  let cursor = rules[0].start;
  let guard = 0;
  while (cursor <= lastEnd + 2 && guard < 5000) {
    const activeRule = rules.find((r) => cursor >= r.start && cursor < r.end) || rules[rules.length - 1];
    if (activeRule.every == null) {
      cursor = activeRule.end;
      continue;
    }
    grid.push(cursor);
    if (cursor >= lastEnd) break;
    cursor += activeRule.every / 60;
    guard++;
  }
  
  DEPARTURE_GRID_CACHE[cacheKey] = grid;
  return grid;
}

function simulateNextDeparture(line: string, now: Date, hourNow: number, originId?: string) {
  const grid = getDepartureGrid(line, now, originId);
  
  let left = 0;
  let right = grid.length - 1;
  let result = grid[grid.length - 1];
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (grid[mid] > hourNow) {
      result = grid[mid];
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  if (result <= hourNow) {
    const rules = rulesForLine(line, now, originId);
    let t = result;
    let guard = 0;
    while (t <= hourNow && guard < 3000) {
      const rule = rules.find((r) => t >= r.start && t < r.end) || rules[rules.length - 1];
      if (rule.every == null) { t = rule.end; continue; }
      t += rule.every / 60;
      guard++;
    }
    return t;
  }
  
  return result;
}
export function estimateLine(line: string, now = new Date()): LineEstimate {
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const firstStart = rules[0].start, lastEnd = rules[rules.length - 1].end;
  if (hourNow < firstStart) return { line, status: "before-first-train", minsUntilFirst: Math.round((firstStart - hourNow) * 60) };
  if (hourNow >= lastEnd) return { line, status: "after-last-train" };
  const activeRule = rules.find((r) => hourNow >= r.start && hourNow < r.end);
  if (activeRule && activeRule.every == null) return { line, status: "bus-only", resumesInMins: Math.round((activeRule.end - hourNow) * 60) };
  const nextDep = simulateNextDeparture(line, now, hourNow);
  return { line, status: "running", waitMins: Math.max(0, Math.round((nextDep - hourNow) * 60)), currentFrequencyMins: activeRule ? activeRule.every : null };
}

export function upcomingDepartures(line: string, now: Date, count = 200): Departure[] {
  const rules = rulesForLine(line, now);
  const hourNow = hourOf(now);
  const lastEnd = rules[rules.length - 1].end;
  if (hourNow >= lastEnd) return [];
  const deps: Departure[] = [];
  let cursor = hourNow;
  for (let i = 0; i < count; i++) {
    if (cursor >= lastEnd) break;
    const dep = simulateNextDeparture(line, now, cursor);
    if (dep >= lastEnd) break;
    const activeRule = rules.find((r) => dep >= r.start && dep < r.end) || rules[rules.length - 1];
    deps.push({ hour: dep, waitMins: Math.max(0, Math.round((dep - hourNow) * 60)), frequencyMins: activeRule.every });
    cursor = dep;
  }
  return deps;
}

function stationOffsetHours(line: string, stationId: string, headingId: string) {
  const path = LINE_PATHS[line];
  const cum = LINE_CUM_MINS[line];
  const idx = path.indexOf(stationId);
  const headIdx = path.indexOf(headingId);
  const minsFromOrigin = headIdx > idx ? cum[idx] : cum[cum.length - 1] - cum[idx];
  return minsFromOrigin / 60;
}

/**
 * Same as estimateLine, but offsets by the given station's position and
 * direction along the line - estimateLine alone reports the terminal's next
 * departure time, which is only correct if you're standing at the terminal.
 */
export function estimateLineAtStation(line: string, stationId: string, headingId: string, now = new Date()): LineEstimate {
  const path = LINE_PATHS[line];
  if (!path || path.indexOf(stationId) === -1 || path.indexOf(headingId) === -1) {
    return estimateLine(line, now);
  }

  const idx = path.indexOf(stationId);
  const headIdx = path.indexOf(headingId);
  const originId = headIdx > idx ? path[0] : path[path.length - 1];

  const offsetHours = stationOffsetHours(line, stationId, headingId);
  const rules = rulesForLine(line, now, originId);
  const hourNow = hourOf(now);
  const termHourNow = hourNow - offsetHours;
  const stationFirst = rules[0].start + offsetHours;
  const stationLast = rules[rules.length - 1].end + offsetHours;

  if (hourNow < stationFirst) return { line, status: "before-first-train", minsUntilFirst: Math.round((stationFirst - hourNow) * 60) };
  if (hourNow >= stationLast) return { line, status: "after-last-train" };

  const activeRule = rules.find((r) => termHourNow >= r.start && termHourNow < r.end);
  if (activeRule && activeRule.every == null) {
    return { line, status: "bus-only", resumesInMins: Math.round((activeRule.end + offsetHours - hourNow) * 60) };
  }

  const nextDepTerm = simulateNextDeparture(line, now, termHourNow, originId);
  const nextArrival = nextDepTerm + offsetHours;
  return { line, status: "running", waitMins: Math.max(0, Math.round((nextArrival - hourNow) * 60)), currentFrequencyMins: activeRule ? activeRule.every : null };
}

/** Direction/station-aware counterpart to upcomingDepartures. */
export function upcomingDeparturesAtStation(line: string, stationId: string, headingId: string, now: Date, count = 200): Departure[] {
  const path = LINE_PATHS[line];
  if (!path || path.indexOf(stationId) === -1 || path.indexOf(headingId) === -1) {
    return upcomingDepartures(line, now, count);
  }

  const idx = path.indexOf(stationId);
  const headIdx = path.indexOf(headingId);
  const originId = headIdx > idx ? path[0] : path[path.length - 1];

  const offsetHours = stationOffsetHours(line, stationId, headingId);
  const rules = rulesForLine(line, now, originId);
  const hourNow = hourOf(now);
  const lastEnd = rules[rules.length - 1].end;
  const deps: Departure[] = [];
  let cursor = hourNow - offsetHours;
  for (let i = 0; i < count; i++) {
    if (cursor >= lastEnd) break;
    const dep = simulateNextDeparture(line, now, cursor, originId);
    if (dep >= lastEnd) break;
    const arrivalHour = dep + offsetHours;
    const activeRule = rules.find((r) => dep >= r.start && dep < r.end) || rules[rules.length - 1];
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
export function nextDepartureFromStation(sourceId: string, destId: string, now = new Date()): LineEstimate | null {
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
  const cum = LINE_CUM_MINS[line];
  const hourNow = hourOf(now);

  const directions: { destination: string, departures: { hour: number, waitMins: number }[] }[] = [];

  function getDeparturesForOffset(offsetHours: number, destId: string, originId: string) {
    const rules = rulesForLine(line, now, originId);
    const lastEnd = rules[rules.length - 1].end;
    const termTime = hourNow - offsetHours;
    const deps: { hour: number, waitMins: number }[] = [];
    let cursor = termTime;
    for (let i = 0; i < count; i++) {
      if (cursor >= lastEnd) break;
      const dep = simulateNextDeparture(line, now, cursor, originId);
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
    getDeparturesForOffset(cum[idx] / 60, path[total], path[0]);
  }
  if (idx > 0) {
    getDeparturesForOffset((cum[total] - cum[idx]) / 60, path[0], path[total]);
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
  const cum = LINE_CUM_MINS[line];
  const hourNow = hourOf(now);

  function buildDirection(offsetHours: number, originId: string, destId: string): DayScheduleDirection {
    const rules = rulesForLine(line, now, originId);
    const lastEnd = rules[rules.length - 1].end;
    const trains: DayTrain[] = [];

    // Walk from first possible terminal departure (going back far enough)
    const grid = getDepartureGrid(line, now, originId);
    for (const cursor of grid) {
      if (cursor >= lastEnd) break;

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
    result.push(buildDirection(cum[idx] / 60, path[0], path[total]));
  }
  // Direction B: towards terminal A (start of path)
  if (idx > 0) {
    result.push(buildDirection((cum[total] - cum[idx]) / 60, path[total], path[0]));
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

interface SimResult {
  legs: LegDetail[];
  totalMins: number | null;
  warnings: string[];
  feasible: boolean;
  strandedAtLine: string | null;
}

function simulateFromDeparture(legs: Leg[], now: Date, firstWaitMins: number, firstFrequencyMins: number | null): SimResult {
  let elapsedMins = firstWaitMins;
  const warnings: string[] = [];
  const legDetails: LegDetail[] = [];
  let feasible = true;
  let strandedAtLine: string | null = null;

  for (let idx = 0; idx < legs.length; idx++) {
    const leg = legs[idx];
    let waitMins = 0, currentFrequencyMins: number | null = null, status: LineEstimate["status"], bufferMins = 0;

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
        waitMins = est.waitMins;
        currentFrequencyMins = est.currentFrequencyMins ?? null;
      } else if (est.status === "before-first-train") {
        waitMins = est.minsUntilFirst;
        warnings.push(`${LINE_META[leg.line].name} hasn't started service yet \u2014 first train in ${formatDuration(est.minsUntilFirst)}.`);
      } else if (est.status === "bus-only") {
        waitMins = est.resumesInMins;
        warnings.push(`${LINE_META[leg.line].name} is bus-only right now \u2014 trains resume in ${formatDuration(est.resumesInMins)}.`);
      } else {
        feasible = false;
        strandedAtLine = LINE_META[leg.line].name;
        legDetails.push({ ...leg, waitMins: null, travelMins: null, currentFrequencyMins: null, status, bufferMins });
        warnings.push(`${LINE_META[leg.line].name} has finished service for the day \u2014 you'd be stuck at the transfer.`);
        break;
      }
      elapsedMins += waitMins;
    }

    const travelMins = travelMinsBetween(leg.line, leg.ids[0], leg.ids[leg.ids.length - 1]);
    elapsedMins += travelMins;
    legDetails.push({ ...leg, waitMins: Math.round(waitMins), travelMins: Math.round(travelMins), currentFrequencyMins, status, bufferMins });
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
    const rules = rulesForLine(lineId, now);
    const firstStart = rules[0].start;
    const lastEnd = rules[rules.length - 1].end;

    if (hourNow < firstStart || hourNow >= lastEnd) continue;

    // Skip if we're currently inside a bus-only (null-frequency) window
    const currentWindowRule = rules.find((r) => hourNow >= r.start && hourNow < r.end);
    if (currentWindowRule && currentWindowRule.every == null) continue;

    // Collect valid stations along this line (skip ones with null coords),
    // each carrying its distance-weighted run-time offset from the terminal.
    const cum = LINE_CUM_MINS[lineId];
    const validPath: { id: string; lat: number; lng: number; mins: number }[] = [];
    for (let i = 0; i < path.length; i++) {
      const s = STATION_BY_ID[path[i]];
      if (s && s.lat !== null && s.lng !== null && s.operational !== false) {
        validPath.push({ id: path[i], lat: s.lat, lng: s.lng, mins: cum[i] });
      }
    }
    if (validPath.length < 2) continue;

    const totalTravelMins = cum[cum.length - 1];
    const totalTravelHours = totalTravelMins / 60;

    // Simulate trains in BOTH directions; the reversed direction's offsets
    // are measured from the opposite terminal.
    const backwardPath = [...validPath].reverse().map((p) => ({ ...p, mins: totalTravelMins - p.mins }));
    const directions = [
      { orderedPath: validPath, destId: validPath[validPath.length - 1].id, terminalOriginId: path[0] },
      { orderedPath: backwardPath, destId: validPath[0].id, terminalOriginId: path[path.length - 1] },
    ];

    for (const { orderedPath, destId, terminalOriginId } of directions) {
      const originId = orderedPath[0].id;
      const destinationName = STATION_BY_ID[destId]?.name ?? destId;

      const rules = rulesForLine(lineId, now, terminalOriginId);
      const lastEnd = rules[rules.length - 1].end;

      // Walk through all possible departure times from origin
      const grid = getDepartureGrid(lineId, now, terminalOriginId);
      for (const departureHour of grid) {
        if (departureHour >= lastEnd) break;

        const arrivalHour = departureHour + totalTravelHours;

        // This train is currently in transit if it has departed and not yet arrived
        if (departureHour <= hourNow && hourNow < arrivalHour) {
          const elapsedMins = (hourNow - departureHour) * 60;

          // Which segment are we on? Segments span unequal time shares now,
          // so walk the cumulative offsets instead of dividing evenly.
          let segmentIndex = orderedPath.length - 2;
          for (let k = 0; k < orderedPath.length - 1; k++) {
            if (elapsedMins < orderedPath[k + 1].mins) { segmentIndex = k; break; }
          }
          const segStartMins = orderedPath[segmentIndex].mins;
          const segMins = orderedPath[segmentIndex + 1].mins - segStartMins;
          const segmentProgress = segMins > 0
            ? Math.min(1, Math.max(0, (elapsedMins - segStartMins) / segMins))
            : 0;

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
      }
    }
  }

  return trains;
}

export interface PlanConfig {
  queryTime?: Date;
  actualNow?: Date;
  arriveBy?: boolean;
}

export function planJourney(sourceInput: string | PlaceNode, destInput: string | PlaceNode, config: PlanConfig = {}): PlanResult | null {
  const queryTime = config.queryTime || new Date();
  const actualNow = config.actualNow || new Date();
  const arriveBy = config.arriveBy || false;
  const searchTime = arriveBy ? new Date(queryTime.getTime() - 120 * 60000) : queryTime;

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
  const { source, dest, legs, merged, totalStops } = base;
  const stops: JourneyStop[] = merged.map((m) => ({ ...STATION_BY_ID[m.id], viaLine: m.line }));
  // Charged on the distance actually travelled, so it follows the same station
  // sequence the rider passes through - including any interchange.
  const fare = fareForRoute(merged.map((m) => m.id));

  const firstLeg = legs[0];
  const firstLegHeading = firstLeg.ids[firstLeg.ids.length - 1];
  const firstEst = estimateLineAtStation(firstLeg.line, sourceId, firstLegHeading, searchTime);
  const ticketInfo = getTicketOptions(source, dest);
  const crossesPhase = source.phase !== dest.phase;
  const usesViolet = legs.some((l) => l.line === "violet");

  if (firstEst.status === "after-last-train") {
    return {
      source: sourcePlace || source,
      dest: destPlace || dest,
      sourceStation: source,
      destStation: dest,
      sourcePlace,
      destPlace,
      sourceWalkMins,
      destWalkMins,
      legs: [],
      stops,
      totalStops,
      travelMins: null,
      initialWaitMins: null,
      totalMins: null,
      feasible: false,
      strandedAtLine: LINE_META[firstLeg.line].name,
      fare,
      ticketInfo,
      usesViolet,
      crossesPhase,
      numTransfers: legs.length - 1,
      warnings: [`${LINE_META[firstLeg.line].name} has finished service for the day \u2014 no trains from ${source.name} right now.`],
      options: [],
      queryTime, arriveBy, isLeaveNow: !config.queryTime
    };
  }

  let firstWaitMins = 0, firstFrequencyMins: number | null = null;
  const leadWarnings: string[] = [];
  if (firstEst.status === "running") {
    firstWaitMins = firstEst.waitMins;
    firstFrequencyMins = firstEst.currentFrequencyMins ?? null;
  } else if (firstEst.status === "before-first-train") {
    firstWaitMins = firstEst.minsUntilFirst;
    leadWarnings.push(`${LINE_META[firstLeg.line].name} hasn't started service yet \u2014 first train in ${formatDuration(firstEst.minsUntilFirst)}.`);
  } else if (firstEst.status === "bus-only") {
    firstWaitMins = firstEst.resumesInMins;
    leadWarnings.push(`${LINE_META[firstLeg.line].name} is bus-only right now \u2014 trains resume in ${formatDuration(firstEst.resumesInMins)}.`);
  }

  const sim = simulateFromDeparture(legs, searchTime, firstWaitMins, firstFrequencyMins);

  const departures = upcomingDeparturesAtStation(firstLeg.line, sourceId, firstLegHeading, searchTime, 200);
  let options: JourneyOption[] = departures.map((d) => {
    const optSim = simulateFromDeparture(legs, searchTime, d.waitMins, d.frequencyMins ?? null);
    
    const departTimeMs = searchTime.getTime() + d.waitMins * 60000;
    const leaveTimeMs = departTimeMs - (sourceWalkMins * 60000);
    const arriveTimeMs = optSim.feasible ? departTimeMs + optSim.totalMins! * 60000 : null;

    return {
      departInMins: d.waitMins,
      departClockTime: clockTimeAfter(searchTime, d.waitMins),
      arriveClockTime: optSim.feasible ? clockTimeAfter(searchTime, optSim.totalMins!) : null,
      totalMins: optSim.totalMins,
      legs: optSim.legs,
      warnings: optSim.warnings,
      feasible: optSim.feasible,
      strandedAtLine: optSim.strandedAtLine,
      departTimeMs,
      leaveTimeMs,
      arriveTimeMs,
      leaveClockTime: clockTimeAfter(new Date(leaveTimeMs), 0),
      leaveInMins: Math.round((leaveTimeMs - actualNow.getTime()) / 60000),
    };
  });

  if (arriveBy) {
    options = options.filter(o => o.feasible && o.arriveTimeMs! <= queryTime.getTime());
    options = options.slice(-5).reverse();
  }

  // Prefer the first concrete departure option; fall back to the "leave now"
  // simulation when no options survive (e.g. arrive-by filtered them all out).
  const chosen: JourneyOption | null = options[0] ?? null;
  const chosenLegs = chosen ? chosen.legs : sim.legs;
  const chosenTotalMins = chosen ? chosen.totalMins : sim.totalMins;

  return {
    source: sourcePlace || source,
    dest: destPlace || dest,
    sourceStation: source,
    destStation: dest,
    sourcePlace,
    destPlace,
    sourceWalkMins,
    destWalkMins,
    legs: chosenLegs,
    stops,
    totalStops,
    travelMins: Math.round(chosenLegs.reduce((s, l) => s + (l.travelMins || 0), 0)),
    initialWaitMins: chosen ? chosen.departInMins : firstWaitMins,
    totalMins: chosenTotalMins != null ? chosenTotalMins + sourceWalkMins + destWalkMins : null,
    feasible: chosen ? chosen.feasible : sim.feasible,
    strandedAtLine: chosen ? chosen.strandedAtLine : sim.strandedAtLine,
    fare,
    ticketInfo,
    usesViolet,
    crossesPhase,
    numTransfers: legs.length - 1,
    warnings: [...leadWarnings, ...(chosen ? chosen.warnings : sim.warnings)],
    options,
    queryTime, arriveBy, isLeaveNow: !config.queryTime
  };
}

