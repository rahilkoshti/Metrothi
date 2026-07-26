import { describe, it, expect } from "vitest";
import { fareForKm, routeKm, fareForRoute } from "./fareEngine";
import {
  planJourney,
  estimateLine,
  estimateLineAtStation,
  formatDuration,
  formatLeaveIn,
  walkMinsForKm,
  hourOf,
  istDayStartMs,
  haversineKm,
  travelMinsBetween,
  getActiveTrains,
  STATION_BY_ID,
  LINE_PATHS,
  LINE_META,
  LINE_CUM_MINS,
} from "./journeyEngine";

// ─── Time helpers ─────────────────────────────────────────────────────────────
// The engine reads schedules in IST (fixed UTC+5:30, no DST). Build Dates whose
// IST wall-clock is a given decimal hour, independent of the machine's timezone.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const WEEKDAY = "2026-07-15"; // Wednesday
const SATURDAY = "2026-07-18";
const SUNDAY = "2026-07-19";

function ist(hour: number, day: string = WEEKDAY): Date {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + hour * 3600000 - IST_OFFSET_MS);
}

// ─── IST / midnight boundaries ────────────────────────────────────────────────

describe("IST time handling", () => {
  it("hourOf returns IST decimal hours regardless of UTC date", () => {
    expect(hourOf(ist(0.5))).toBeCloseTo(0.5, 5);
    expect(hourOf(ist(23.98))).toBeCloseTo(23.98, 5);
  });

  it("istDayStartMs anchors to IST midnight, not UTC midnight", () => {
    // 01:30 IST is still 20:00 UTC of the *previous* calendar day.
    const lateNight = ist(1.5, SUNDAY);
    expect(istDayStartMs(lateNight)).toBe(ist(0, SUNDAY).getTime());
  });

  it("day type is derived from the IST calendar day across midnight", () => {
    // 01:30 IST Sunday = 20:00 UTC Saturday. Blue has distinct Sunday rules;
    // first train is 6.333 so this must read before-first-train with the
    // wait measured from the IST clock, not the UTC one.
    const est = estimateLine("blue", ist(1.5, SUNDAY));
    expect(est.status).toBe("before-first-train");
    if (est.status === "before-first-train") {
      expect(est.minsUntilFirst).toBe(Math.round((6.333 - 1.5) * 60));
    }
  });

  it.each([
    ["weekday", WEEKDAY, 10],
    ["saturday", SATURDAY, 12],
    ["sunday", SUNDAY, 12],
  ])("blue midday frequency on %s is every %i min", (_label, day, every) => {
    const est = estimateLine("blue", ist(12, day));
    expect(est.status).toBe("running");
    if (est.status === "running") {
      expect(est.currentFrequencyMins).toBe(every);
    }
  });

  it("just before IST midnight is after-last-train, not a wrap-around", () => {
    const est = estimateLine("blue", ist(23.98));
    expect(est.status).toBe("after-last-train");
  });
});

// ─── Before-first-train, per direction ────────────────────────────────────────

describe("direction-aware first trains (yellow)", () => {
  // Yellow's two terminals start service at different times:
  // from Motera 6.917 (06:55), from Mahatma Mandir 6.667 (06:40).
  it.each([
    ["motera-stadium", "mahatma-mandir", 6.917],
    ["mahatma-mandir", "motera-stadium", 6.667],
  ])("waiting at %s heading %s uses that terminal's first departure", (at, heading, firstStart) => {
    const est = estimateLineAtStation("yellow", at, heading, ist(6.5));
    expect(est.status).toBe("before-first-train");
    if (est.status === "before-first-train") {
      expect(est.minsUntilFirst).toBe(Math.round((firstStart - 6.5) * 60));
    }
  });
});

// ─── Violet bus-only window ───────────────────────────────────────────────────

describe("violet bus-only window (10.3–16.1)", () => {
  it("estimateLine reports bus-only with time until trains resume", () => {
    const est = estimateLine("violet", ist(12));
    expect(est.status).toBe("bus-only");
    if (est.status === "bus-only") {
      expect(est.resumesInMins).toBe(Math.round((16.1 - 12) * 60));
    }
  });

  it("a violet trip planned inside the window warns but stays feasible", () => {
    const plan = planJourney("gnlu", "gift-city", { queryTime: ist(12) });
    expect(plan).not.toBeNull();
    expect(plan!.feasible).toBe(true);
    expect(plan!.totalMins).not.toBeNull();
    expect(plan!.warnings.some((w) => w.includes("bus-only"))).toBe(true);
    // First departure is after the window closes.
    expect(plan!.initialWaitMins).toBeGreaterThanOrEqual(Math.round((16.1 - 12) * 60));
  });

  it("violet runs normally outside the window", () => {
    const est = estimateLine("violet", ist(9));
    expect(est.status).toBe("running");
  });
});

// ─── Interchange legs ─────────────────────────────────────────────────────────

describe("interchange leg building", () => {
  // Boarding at an interchange whose stored `line` differs from the line
  // actually ridden must not produce a degenerate zero-travel leg.
  it.each([
    // source, dest, expected line sequence
    ["motera-stadium", "koba-circle", ["yellow"]], // motera is stored as red
    ["koba-circle", "motera-stadium", ["yellow"]],
    ["old-high-court", "paldi", ["red"]], // old-high-court is stored as blue
    ["gnlu", "gift-city", ["violet"]], // gnlu is stored as yellow
  ])("%s → %s rides only %j with zero transfers", (src, dst, lines) => {
    const plan = planJourney(src, dst, { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    expect(plan!.legs.map((l) => l.line)).toEqual(lines);
    expect(plan!.numTransfers).toBe(lines.length - 1);
    // Every leg must involve real travel.
    for (const leg of plan!.legs) {
      expect(leg.ids.length).toBeGreaterThan(1);
    }
  });

  it("a blue→red trip transfers exactly once, at Old High Court", () => {
    const plan = planJourney("kalupur", "paldi", { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    expect(plan!.legs.map((l) => l.line)).toEqual(["blue", "red"]);
    expect(plan!.numTransfers).toBe(1);
    expect(plan!.legs[0].ids.at(-1)).toBe("old-high-court");
    expect(plan!.legs[1].ids[0]).toBe("old-high-court");
  });

  it("a four-line trip chains blue→red→yellow→violet", () => {
    const plan = planJourney("kalupur", "gift-city", { queryTime: ist(8) });
    expect(plan).not.toBeNull();
    expect(plan!.legs.map((l) => l.line)).toEqual(["blue", "red", "yellow", "violet"]);
    expect(plan!.numTransfers).toBe(3);
    expect(plan!.usesViolet).toBe(true);
  });
});

// ─── Feasibility: no impossible trip may show a completable ETA ───────────────

describe("infeasible trips never show a completable ETA", () => {
  it("after the last train, the plan is infeasible with null ETA", () => {
    const plan = planJourney("vastral-gam", "thaltej-gam", { queryTime: ist(23.5) });
    expect(plan).not.toBeNull();
    expect(plan!.feasible).toBe(false);
    expect(plan!.totalMins).toBeNull();
    expect(plan!.travelMins).toBeNull();
    expect(plan!.options).toEqual([]);
    expect(plan!.strandedAtLine).toContain("Line 1");
  });

  it("a late transfer onto a finished line strands the rider, ETA null", () => {
    // Blue still runs at 22:00 but yellow's last train is long gone by the
    // time the rider reaches Motera.
    const plan = planJourney("kalupur", "infocity", { queryTime: ist(22) });
    expect(plan).not.toBeNull();
    expect(plan!.feasible).toBe(false);
    expect(plan!.totalMins).toBeNull();
    expect(plan!.strandedAtLine).toContain("Line 3");
    expect(plan!.warnings.some((w) => w.includes("finished service"))).toBe(true);
  });

  it("every infeasible option has null timing fields", () => {
    const plan = planJourney("kalupur", "infocity", { queryTime: ist(20) });
    expect(plan).not.toBeNull();
    for (const opt of plan!.options) {
      if (!opt.feasible) {
        expect(opt.totalMins).toBeNull();
        expect(opt.arriveClockTime).toBeNull();
        expect(opt.arriveTimeMs).toBeNull();
      } else {
        expect(opt.totalMins).not.toBeNull();
      }
    }
  });

  it("a feasible daytime trip has a complete, positive ETA", () => {
    const plan = planJourney("vastral-gam", "thaltej-gam", { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    expect(plan!.feasible).toBe(true);
    expect(plan!.totalMins).toBeGreaterThan(0);
    expect(plan!.travelMins).toBeGreaterThan(0);
    expect(plan!.options.length).toBeGreaterThan(0);
  });
});

// ─── Cross-phase ticketing ────────────────────────────────────────────────────

describe("cross-phase ticketing", () => {
  it("Ahmedabad↔Gandhinagar trips accept only NCMC", () => {
    const src = STATION_BY_ID["ranip"];
    const dst = STATION_BY_ID["infocity"];
    expect(src.phase).not.toBe(dst.phase); // guard against data drift
    const plan = planJourney("ranip", "infocity", { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    expect(plan!.crossesPhase).toBe(true);
    expect(plan!.ticketInfo).toMatchObject({ tokenValid: false, cscValid: false, ncmcValid: true });
  });

  it("same-phase trips accept token, CSC and NCMC", () => {
    const plan = planJourney("vastral-gam", "thaltej-gam", { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    expect(plan!.crossesPhase).toBe(false);
    expect(plan!.ticketInfo).toMatchObject({ tokenValid: true, cscValid: true, ncmcValid: true });
  });

  it("ticketing rules apply even when the line has shut for the day", () => {
    const plan = planJourney("ranip", "infocity", { queryTime: ist(23.9) });
    expect(plan).not.toBeNull();
    expect(plan!.crossesPhase).toBe(true);
    expect(plan!.ticketInfo.tokenValid).toBe(false);
  });
});

// ─── Distance-weighted segment times ──────────────────────────────────────────

describe("distance-weighted segment times", () => {
  const lines = Object.keys(LINE_PATHS);

  it.each(lines)("%s: cumulative offsets are monotonic and start at 0", (line) => {
    const cum = LINE_CUM_MINS[line];
    expect(cum[0]).toBe(0);
    expect(cum.length).toBe(LINE_PATHS[line].length);
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThanOrEqual(cum[i - 1]);
    }
  });

  it.each(lines)("%s: end-to-end total is preserved exactly", (line) => {
    const path = LINE_PATHS[line];
    const expected = (path.length - 1) * LINE_META[line].avgSegmentMins;
    expect(travelMinsBetween(line, path[0], path[path.length - 1])).toBeCloseTo(expected, 10);
  });

  it("travelMinsBetween is symmetric", () => {
    expect(travelMinsBetween("blue", "kalupur", "thaltej")).toBeCloseTo(
      travelMinsBetween("blue", "thaltej", "kalupur"),
      10
    );
  });

  it("segment time shares are proportional to inter-station distance", () => {
    // Two blue segments with very different straight-line lengths.
    const shortKm = haversineKm(
      STATION_BY_ID["sp-stadium"] as { lat: number; lng: number },
      STATION_BY_ID["commerce-six-road"] as { lat: number; lng: number }
    );
    const longKm = haversineKm(
      STATION_BY_ID["rabari-colony"] as { lat: number; lng: number },
      STATION_BY_ID["amraivadi"] as { lat: number; lng: number }
    );
    const shortMins = travelMinsBetween("blue", "sp-stadium", "commerce-six-road");
    const longMins = travelMinsBetween("blue", "rabari-colony", "amraivadi");
    expect(shortMins / longMins).toBeCloseTo(shortKm / longKm, 6);
    // And they genuinely differ from the old uniform split.
    expect(shortMins).not.toBeCloseTo(longMins, 1);
  });

  it("bridges the null-coordinate Sabarmati Railway Station on red", () => {
    // ranip → sabarmati-rs → aec: the unknown-coords station splits the
    // ranip→aec distance evenly, so both halves are positive and equal.
    const a = travelMinsBetween("red", "ranip", "sabarmati-railway-station");
    const b = travelMinsBetween("red", "sabarmati-railway-station", "aec");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeCloseTo(b, 10);
  });

  it("a leg's travel time equals the weighted span, not stops × average", () => {
    const plan = planJourney("kalupur", "old-high-court", { queryTime: ist(9) });
    expect(plan).not.toBeNull();
    const leg = plan!.legs[0];
    expect(leg.travelMins).toBe(Math.round(travelMinsBetween("blue", "kalupur", "old-high-court")));
  });
});

describe("getActiveTrains with weighted interpolation", () => {
  it("returns in-transit trains with valid positions during service", () => {
    const trains = getActiveTrains(ist(9));
    expect(trains.length).toBeGreaterThan(0);
    for (const t of trains) {
      expect(t.segmentProgress).toBeGreaterThanOrEqual(0);
      expect(t.segmentProgress).toBeLessThanOrEqual(1);
      expect(Number.isFinite(t.lat)).toBe(true);
      expect(Number.isFinite(t.lng)).toBe(true);
    }
  });

  it("returns no trains before service starts", () => {
    expect(getActiveTrains(ist(5))).toEqual([]);
  });

  it("returns no violet trains inside the bus-only window", () => {
    const trains = getActiveTrains(ist(12));
    expect(trains.filter((t) => t.line === "violet")).toEqual([]);
  });
});

// ─── Fares and formatting ─────────────────────────────────────────────────────

describe("fare slabs", () => {
  // Cuts confirmed against GMRC's own fare endpoint. Boundaries are
  // inclusive-below: exactly 7.5km falls in the ₹15 slab.
  it.each([
    [0.5, 5], [2.49, 5],
    [2.5, 10], [7.49, 10],
    [7.5, 15], [12.49, 15],
    [12.5, 20], [17.49, 20],
    [17.5, 25], [22.49, 25],
    [22.5, 30], [29.99, 30],
    [30, 35], [37.49, 35],
    [37.5, 40], [45.72, 40],
  ])("%skm costs ₹%i", (km, fare) => {
    expect(fareForKm(km)).toBe(fare);
  });

  it("sums real segment distances along a route", () => {
    // Gandhigram -> Old High Court -> Usmanpura: 1.16 + 0.96, per GMRC.
    expect(routeKm(["gandhigram", "old-high-court", "usmanpura"])).toBe(2.12);
  });

  it("returns null for a path the network does not have", () => {
    expect(routeKm(["vastral-gam", "gift-city"])).toBeNull();
  });

  it("never charges below the ₹5 minimum", () => {
    expect(fareForRoute(["vastral-gam", "nirant-cross-road"])).toBe(5);
  });

  it("applies the confirmed GMRC overrides near slab cuts", () => {
    // 7.44km would slab to ₹10, but GMRC charges ₹15 for this pair.
    expect(fareForRoute(["rajivnagar", "vijaynagar"])).toBe(15);
    // 12.50km would slab to ₹20, but GMRC charges ₹15.
    expect(fareForRoute(["koteshwar-road", "infocity"])).toBe(15);
  });
});

describe("formatDuration", () => {
  it.each<[number | null, string]>([
    [null, "—"],
    [0, "0 min"],
    [59, "59 min"],
    [60, "1h 00m"],
    [125, "2h 05m"],
  ])("%s → %s", (mins, label) => {
    expect(formatDuration(mins)).toBe(label);
  });
});

// ─── Departure options: never surface a train the rider cannot take ──────────

describe("departure options are never already gone", () => {
  // A few hundred metres from Vastral Gam, so the plan carries a real walk to
  // the platform and `leaveInMins` can fall behind `departInMins`.
  const nearVastral = {
    isPlace: true as const,
    id: "test-place",
    name: "Somewhere near Vastral Gam",
    lat: 22.997249 + 0.006,
    lng: 72.667317,
  };

  it("drops departures that left before the wall clock on a leave-now plan", () => {
    // What HomeScreen does on its 15s tick: same query time, later real time.
    const plan = planJourney("vastral-gam", "thaltej-gam", {
      queryTime: ist(9),
      actualNow: ist(9.25),
      isLeaveNow: true,
    });
    expect(plan).not.toBeNull();
    expect(plan!.options.length).toBeGreaterThan(0);
    for (const opt of plan!.options) {
      expect(opt.departTimeMs).toBeGreaterThan(ist(9.25).getTime());
    }
  });

  it("keeps its options when the plan is anchored to a time the rider picked", () => {
    // The query time is hours behind the wall clock, but it is the clock the
    // rider chose - the schedule for it still stands.
    const plan = planJourney("vastral-gam", "thaltej-gam", {
      queryTime: ist(9),
      actualNow: ist(14),
      isLeaveNow: false,
    });
    expect(plan).not.toBeNull();
    expect(plan!.options.length).toBeGreaterThan(0);
    expect(plan!.options.every((o) => !o.isTight)).toBe(true);
  });

  it("recommends a departure whose walk has not already started", () => {
    const plan = planJourney(nearVastral, "thaltej-gam", {
      queryTime: ist(9),
      actualNow: ist(9),
      isLeaveNow: true,
    });
    expect(plan).not.toBeNull();
    expect(plan!.sourceWalkMins).toBeGreaterThan(0);

    const recommended = plan!.options[plan!.recommendedOptionIdx];
    expect(recommended).toBeDefined();
    expect(recommended.isTight).toBe(false);
    expect(recommended.leaveInMins).toBeGreaterThanOrEqual(0);
  });

  it("marks a still-catchable train with a passed walk as tight, not as negative", () => {
    const plan = planJourney(nearVastral, "thaltej-gam", {
      queryTime: ist(9),
      actualNow: ist(9),
      isLeaveNow: true,
    });
    for (const opt of plan!.options) {
      if (opt.leaveInMins < 0) expect(opt.isTight).toBe(true);
      if (opt.isTight) expect(opt.departTimeMs).toBeGreaterThan(ist(9).getTime());
      // Whatever the sign, nothing that reaches the screen reads as negative.
      expect(formatLeaveIn(opt.leaveInMins)).not.toContain("-");
    }
  });
});

describe("formatLeaveIn", () => {
  it.each([
    [-12, "now"],
    [-1, "now"],
    [0, "now"],
    [1, "in 1 min"],
    [90, "in 1h 30m"],
  ])("%i → %s", (mins, label) => {
    expect(formatLeaveIn(mins)).toBe(label);
  });

  it("shows a dash rather than a number it does not have", () => {
    expect(formatLeaveIn(null)).toBe("—");
  });
});

describe("walkMinsForKm", () => {
  it.each([
    [0, 1], // never less than a minute
    [1, 12],
    [5, 60],
  ])("%f km ≈ %i min at 5 km/h", (km, mins) => {
    expect(walkMinsForKm(km)).toBe(mins);
  });
});
