// Only files that are already in the boot bundle may be read here — this module
// is imported by `YouScreen`. A JSON import is all-or-nothing whatever its
// form: Vite emits one module per file, so touching `passengerInfo.json` or
// `metroInfo.json` from this side would pull all 19 KB of reference prose out
// of the lazy `/you/:topic` chunk and into the main one (§5.6). The three below
// are boot-critical anyway — the timetable and fares drive the sheet, and
// `stationFacilities` drives the Station Info tab.
import { _meta as timetableMeta } from "../../data/timetable.json";
import { _meta as faresMeta } from "../../data/fares.json";
import { _meta as facilitiesMeta } from "../../data/stationFacilities.json";

/** One "where did this come from, and how old is it" line for About & Data. */
export interface Provenance {
  key: string;
  label: string;
  /** Rendered as the row's second line. */
  detail: string;
  /** Present only where the source is a page a rider can actually open. */
  href?: string;
}

/** "2026-05-18" → "18.05.2026", the format GMRC prints on the timetable. */
function asGmrcDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * The five data files each carry a `_meta`, but they were written at different
 * times and none of them agree on what the date field is called — `effectiveFrom`
 * on the timetable, `scrapedOn` on fares, `lastVerified` on stations, `generated`
 * on tracks, and nothing at all on the two hand-maintained reference files, whose
 * date is prose inside `_meta.source`. So this is a written-out mapping rather
 * than a generic reader: five explicit lines beat a clever parser over five
 * shapes, and when a sixth file arrives the compiler asks about it here.
 *
 * The point is that these rows stop needing a manual edit when a file is
 * regenerated — which is the whole reason the dates are in the data (§1: the
 * rider can see how old our facts are).
 */
export function dataProvenance(): Provenance[] {
  return [
    {
      key: "timetable",
      label: "Timetable",
      // The source is a poster JPEG and a PDF, so there's no page to link.
      detail: `Effective ${asGmrcDate(timetableMeta.effectiveFrom)} · hand-transcribed from GMRC`,
    },
    {
      key: "fares",
      label: "Fares",
      detail: `Read from GMRC ${asGmrcDate(faresMeta.scrapedOn)} · charged on distance, not stops`,
      href: "https://www.gujaratmetrorail.com/ahmedabad/route-and-fares/",
    },
    {
      key: "reference",
      // One row for two files. It dates off `stationFacilities.json` — the
      // generated one, so the one that actually moves — and `topics.test.ts`
      // asserts `passengerInfo.json` still carries the same date. If they ever
      // diverge, that test fails and this becomes two rows rather than a
      // silently-wrong single one.
      label: "Station & passenger info",
      detail: `Scraped ${asGmrcDate(facilitiesMeta.scrapedOn)} · gates, lifts, conduct, contacts`,
      href: "https://www.gujaratmetrorail.com/ahmedabad/",
    },
    {
      key: "live",
      label: "Live estimates",
      detail: "Simulated from the timetable — no real-time feed",
    },
  ];
}

