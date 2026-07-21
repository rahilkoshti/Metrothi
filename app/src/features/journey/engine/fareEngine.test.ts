import { describe, it, expect } from "vitest";
import { planJourney } from "./journeyEngine";
import { fareForRoute } from "./fareEngine";
import fixture from "./__fixtures__/gmrc-fare-samples.json";

// These are real fares pulled from GMRC's own endpoint. They are the ground
// truth for the fare engine: if a change breaks one, the change is wrong.
describe("fares match GMRC", () => {
  const samples = fixture.samples as { from: string; to: string; fare: number; gmrcKm: number }[];

  it("has a meaningful number of samples", () => {
    expect(samples.length).toBeGreaterThan(150);
  });

  it.each(samples.map((s) => [s.from, s.to, s.fare, s.gmrcKm] as const))(
    "%s -> %s is ₹%i (%skm)",
    (from, to, fare) => {
      const plan = planJourney(from, to);
      expect(plan).not.toBeNull();
      expect(plan!.fare).toBe(fare);
    },
  );

  // The route the rider takes is what gets charged, so the fare has to come off
  // the full station sequence rather than the endpoints alone.
  it("charges the travelled route, not the straight-line endpoints", () => {
    const viaInterchange = fareForRoute(["gandhigram", "old-high-court", "usmanpura"]);
    expect(viaInterchange).toBe(5);
  });
});
