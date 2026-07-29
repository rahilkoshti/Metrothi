import { describe, it, expect } from "vitest";
import { exitGuidanceFor } from "./exitGuidance";
import { STATIONS } from "./engine/journeyEngine";
import facilitiesData from "../../data/stationFacilities.json";

/**
 * The guidance is derived from GMRC's strings, so the two ways it can go wrong
 * are silent: a prefix spelling this code doesn't match leaves "Entry-Exit 5 –"
 * printed next to a "Gate 5" that already says it, and a station that loses its
 * lift row starts claiming an exit that isn't step-free. Both render as
 * plausible text, which is what these assertions are for.
 */

const FACILITIES = facilitiesData.stations as Record<string, { multiModal?: { connections: { gate: number | null; text: string }[] } }>;

const withConnections = Object.keys(FACILITIES).filter(
  (id) => (FACILITIES[id].multiModal?.connections.length ?? 0) > 0
);

describe("exitGuidanceFor", () => {
  it("says nothing where GMRC lists nothing", () => {
    // Not "no step-free exit" — GMRC does not publish this station at all,
    // and a negative would be a claim the source never made.
    expect(exitGuidanceFor("sabarmati-railway-station")).toBeNull();
    expect(exitGuidanceFor(undefined)).toBeNull();
    expect(exitGuidanceFor("not-a-station")).toBeNull();
  });

  it("names the step-free exits GMRC's lift table implies", () => {
    // Sabarmati's three lifts serve gates 2, 3 and 5 — not 1 and 4, which is
    // the whole reason this line is worth printing.
    expect(exitGuidanceFor("sabarmati")?.stepFree).toBe("Step-free exit at Gates 2, 3 & 5");
    expect(exitGuidanceFor("kalupur")?.stepFree).toBe("Step-free exit at Gate 1");
  });

  it("keeps the gate out of the wording, since the gate is printed separately", () => {
    // Every published spelling of the prefix, across all 9 stations that have
    // a connection — the regex must not be tuned to the first one read.
    for (const id of withConnections) {
      for (const c of exitGuidanceFor(id)!.connections) {
        expect(c.text, id).not.toMatch(/^entry[- ]?exit/i);
        expect(c.text, id).not.toMatch(/^[–—-]/);
        expect(c.text[0], id).toBe(c.text[0].toUpperCase());
      }
    }
  });

  it("pairs each connection with its own gate", () => {
    // Ranip is the station that would expose a merged gate list as wrong: two
    // connections, two modes, two different exits.
    expect(exitGuidanceFor("ranip")?.connections).toEqual([
      { gate: 2, text: "Footpath with GSRTC" },
      { gate: 3, text: "Lift and Skywalk connecting to BRTS" },
    ]);
  });

  it("keeps a connection GMRC gives no gate for", () => {
    // Mahatma Mandir's foot over bridge has no Entry-Exit number in the
    // source. Dropping it would lose the connection; inventing one would send
    // someone to the wrong door.
    const conns = exitGuidanceFor("mahatma-mandir")!.connections;
    expect(conns).toHaveLength(1);
    expect(conns[0].gate).toBeNull();
    expect(conns[0].text).toMatch(/^Connected to Gandhinagar Capital Railway Station/);
  });

  it("renders for a station with lifts but no interchange", () => {
    const g = exitGuidanceFor("old-high-court")!;
    expect(g.stepFree).not.toBeNull();
    expect(g.connections).toEqual([]);
  });

  it("leaves PDEU's parking to the station page", () => {
    // `multiModal` is not the same thing as a way onward: PDEU has an amenity
    // and no connection, so the journey shows its step-free exit alone.
    const g = exitGuidanceFor("pdeu")!;
    expect(g.connections).toEqual([]);
    expect(g.stepFree).toBe("Step-free exit at Gates 1 & 2");
  });

  it("resolves for every station a journey can end at", () => {
    // The component takes a station id straight off the route's last stop, so
    // an id shape that doesn't match the facilities keys would fail silently
    // as a missing line rather than an error.
    const missing = STATIONS.filter(
      (s: { id: string }) => s.id !== "sabarmati-railway-station" && exitGuidanceFor(s.id) === null
    );
    expect(missing.map((s: { id: string }) => s.id)).toEqual([]);
  });
});
