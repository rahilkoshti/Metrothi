import { describe, it, expect } from "vitest";
import { fuzzySearch } from "./fuzzySearch";
import { STATIONS } from "../engine/journeyEngine";
import { stationSearchKeywords } from "../stationFacilities";

/**
 * The keyword aliases (§4.4) are invisible by construction, which is exactly
 * what makes them worth asserting: the failure mode isn't an error, it's a
 * station quietly outranking the one you typed the name of. The ranking rule
 * these lock down is the whole contract — aliases add results, never reorder
 * them.
 */

const SEARCHABLE = STATIONS.filter((s) => s.operational !== false);
const search = (q: string) =>
  fuzzySearch(q, SEARCHABLE, (s) => s.name, (s) => stationSearchKeywords(s.id)).map((s) => s.id);

describe("fuzzySearch names", () => {
  it("ranks exact over prefix over substring over subsequence", () => {
    expect(search("apmc")[0]).toBe("apmc");
    expect(search("sabar")[0]).toBe("sabarmati");
    expect(search("ohc")).toContain("old-high-court");
  });

  it("returns the head of the list for an empty or blank query", () => {
    expect(search("")).toHaveLength(6);
    expect(search("   ")).toEqual(search(""));
  });

  it("finds nothing for a query that matches nothing", () => {
    expect(search("zzzz")).toEqual([]);
  });
});

describe("mode keywords", () => {
  it("resolves a mode word to the stations that connect to it", () => {
    // The gap this closes: none of these stations has "railway" in its name.
    const railway = search("railway");
    expect(railway).toEqual(
      expect.arrayContaining(["kalupur", "gandhigram", "aec", "mahatma-mandir"])
    );
    expect(search("brts")).toEqual(
      expect.arrayContaining(["gujarat-university", "vadaj", "ranip", "aec", "sabarmati"])
    );
    // "bus" is the word a rider uses for both bus modes, so it spans them.
    const bus = search("bus");
    expect(bus).toContain("apmc");
    expect(bus).toContain("vadaj");
  });

  it("never lets a keyword outrank a station named that", () => {
    // "Sabarmati" connects to BRTS; "bus" must not float it over a name match,
    // and a name match must stay first even when other rows match by keyword.
    expect(search("gandhigram")[0]).toBe("gandhigram");
    expect(search("rail")[0]).not.toBe("gujarat-university");

    const named = fuzzySearch(
      "sabarmati",
      SEARCHABLE,
      (s) => s.name,
      () => ["sabarmati"] // every station claims the query as a keyword
    );
    expect(named[0].id).toBe("sabarmati");
  });

  it("does not match a keyword by scattered subsequence", () => {
    // "brs" is a subsequence of "BRTS". If keywords matched that loosely, every
    // three-letter query would drag the interchange stations in.
    expect(search("brs")).not.toContain("vadaj");
  });

  it("puts the station actually called that first", () => {
    // Kalupur Railway Station matches "railway" by name, so it outranks the
    // three stations that merely connect to Indian Railways.
    expect(search("railway")[0]).toBe("kalupur");
  });

  it("adds nothing when no keyword function is passed", () => {
    expect(fuzzySearch("brts", SEARCHABLE, (s) => s.name)).toEqual([]);
  });
});
