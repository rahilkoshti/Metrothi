import { describe, it, expect } from "vitest";
import { ALL_TOPICS, RIDING_TOPICS, HELP_TOPICS, OFFICIAL_APP, GMRC_FEEDBACK_URL } from "./catalog";
import { getTopic } from "./topics";
import { dataProvenance } from "./provenance";
import type { Block } from "./blocks";
// Free to import the whole files here — a test is not bundled. The app code is
// not: see the bundle note in `catalog.ts`.
import passengerInfo from "../../data/passengerInfo.json";
import facilities from "../../data/stationFacilities.json";
import en from "../../i18n/locales/en.json";

/** Dotted lookup into the bundle; `undefined` for a key that isn't there. */
function leafAt(obj: unknown, key: string): unknown {
  return key.split(".").reduce<any>((acc, part) => acc?.[part], obj);
}

/**
 * The registry is built by reading keys out of two JSON files, so it fails
 * silently: rename a key upstream and a page quietly renders one section
 * shorter, or a row leads to a topic that no longer exists. These assertions are
 * the thing that notices.
 */

function blocksOf(slug: string): Block[] {
  const topic = getTopic(slug);
  expect(topic, `no topic built for "${slug}"`).not.toBeNull();
  return topic!.sections.flatMap((s) => s.blocks);
}

describe("topic catalog ↔ registry", () => {
  it("every row on the YOU screen resolves to a real page", () => {
    // `catalog.ts` (boot bundle) and `topics.ts` (lazy chunk) are deliberately
    // separate modules; this is what keeps them in sync.
    for (const entry of ALL_TOPICS) {
      expect(getTopic(entry.slug), entry.slug).not.toBeNull();
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = ALL_TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers the nine rows of PRD §4.5.1 — eight pages plus the app link", () => {
    expect(RIDING_TOPICS).toHaveLength(5);
    expect(HELP_TOPICS).toHaveLength(3);
    expect(OFFICIAL_APP.ios).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(OFFICIAL_APP.android).toMatch(/^https:\/\/play\.google\.com\//);
    expect(GMRC_FEEDBACK_URL).toMatch(/^https:\/\/www\.gujaratmetrorail\.com\//);
  });

  it("keeps the three URLs copied into the boot bundle in step with the JSON", () => {
    // `catalog.ts` cannot import `passengerInfo.json` without dragging all of it
    // out of the lazy chunk, so it holds copies. This is what stops them
    // drifting from the source of record.
    expect(OFFICIAL_APP.ios).toBe(passengerInfo.officialApp.ios);
    expect(OFFICIAL_APP.android).toBe(passengerInfo.officialApp.android);
    expect(GMRC_FEEDBACK_URL).toBe(passengerInfo.contact.feedbackUrl);
  });

  it("returns null for an unknown slug rather than throwing", () => {
    // `InfoPage` redirects on null; a throw would surface as a blank screen.
    expect(getTopic("not-a-topic")).toBeNull();
    expect(getTopic(undefined)).toBeNull();
  });
});

describe("every page has content", () => {
  it.each(ALL_TOPICS.map((t) => t.slug))("%s renders sections and blocks", (slug) => {
    const topic = getTopic(slug)!;
    expect(topic.sections.length).toBeGreaterThan(0);
    for (const section of topic.sections) {
      expect(section.label, `${slug}: empty section label`).not.toBe("");
      expect(section.blocks.length, `${slug}/${section.label}: no blocks`).toBeGreaterThan(0);
    }
  });

  it.each(ALL_TOPICS.map((t) => t.slug))("%s has no empty block", (slug) => {
    for (const block of blocksOf(slug)) {
      switch (block.kind) {
        case "list":
        case "chips":
          expect(block.items.length, `${slug}: empty ${block.kind}`).toBeGreaterThan(0);
          break;
        case "keyValue":
          expect(block.rows.length, `${slug}: empty keyValue`).toBeGreaterThan(0);
          break;
        case "definitions":
        case "actions":
        case "linkList":
          expect(block.items.length, `${slug}: empty ${block.kind}`).toBeGreaterThan(0);
          break;
        case "prose":
        case "note":
          expect(block.text.trim(), `${slug}: empty ${block.kind}`).not.toBe("");
          break;
        case "sourceLink":
          expect(block.href).toMatch(/^https:\/\//);
          break;
      }
    }
  });

  it.each(ALL_TOPICS.map((t) => t.slug))("%s links back to its GMRC source", (slug) => {
    expect(getTopic(slug)!.source).toMatch(/^https:\/\/www\.gujaratmetrorail\.com\//);
  });
});

describe("actions and links are dialable, mailable, openable", () => {
  it("every action carries a well-formed value for its kind", () => {
    for (const entry of ALL_TOPICS) {
      for (const block of blocksOf(entry.slug)) {
        if (block.kind !== "actions") continue;
        for (const action of block.items) {
          expect(action.label.trim()).not.toBe("");
          if (action.kind === "tel") {
            // Digits, spaces and dashes only — anything else won't dial.
            expect(action.value, entry.slug).toMatch(/^[+\d][\d\s-]+$/);
          } else if (action.kind === "mailto") {
            expect(action.value, entry.slug).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
          } else {
            expect(action.value, entry.slug).toMatch(/^https:\/\//);
          }
        }
      }
    }
  });

  it("every link in a link list has a label and an https target", () => {
    for (const entry of ALL_TOPICS) {
      for (const block of blocksOf(entry.slug)) {
        if (block.kind !== "linkList") continue;
        for (const link of block.items) {
          expect(link.label.trim(), entry.slug).not.toBe("");
          expect(link.href, `${entry.slug}: ${link.label}`).toMatch(/^https:\/\//);
        }
      }
    }
  });
});

describe("fares page — the numbers GMRC actually publishes", () => {
  const rows = () =>
    blocksOf("fares").flatMap((b) => (b.kind === "keyValue" ? b.rows : []));

  it("never renders a rupee figure GMRC does not state", () => {
    // Three of the seven penalties have `amountRs: null` and a rule instead.
    // "₹null", "₹0" or a guessed number would be inventing a fine.
    for (const row of rows()) {
      expect(row.value, row.label).not.toMatch(/₹\s*(null|undefined|NaN|0\b)/);
    }
    expect(rows().map((r) => r.value)).toContain("Difference of fare only");
  });

  it("prices the penalties GMRC does state", () => {
    const byLabel = new Map(rows().map((r) => [r.label, r.value]));
    expect(byLabel.get("Taking a token out of the system")).toBe("₹200");
    expect(byLabel.get("Travelling without a ticket")).toBe("₹50 + maximum fare");
    expect(byLabel.get("Overstaying in the paid area")).toBe("₹10 / hour per person, max ₹50");
  });

  it("answers where to get the card a cross-phase trip needs", () => {
    // The planner's cross-phase note sends riders here for the NCMC (§8 phase
    // 6). "Where to buy" covered ticket media only, so the page the advice
    // points at had nothing to say about the card.
    const bullets = blocksOf("fares").flatMap((b) => (b.kind === "list" ? b.items : []));
    expect(bullets.some((i) => /NCMC/.test(i) && /station/i.test(i))).toBe(true);
  });

  it("carries the cross-phase restriction as a warning", () => {
    const warnings = blocksOf("fares").filter((b) => b.kind === "prose" && b.tone === "warn");
    expect(warnings).toHaveLength(1);
    // The engine's own ticket note says the same thing on a cross-phase trip
    // (journeyEngine `getTicketOptions`); the two must not disagree.
    expect(warnings[0]).toMatchObject({ text: expect.stringContaining("NCMC") });
  });
});

describe("prohibited items — reordered for the rider, not the statute", () => {
  it("answers the pets question before the statutory lists", () => {
    const labels = getTopic("prohibited")!.sections.map((s) => s.label);
    expect(labels.indexOf("Pets & live animals")).toBeLessThan(labels.indexOf("Dangerous materials"));
    expect(labels.indexOf("Luggage")).toBeLessThan(labels.indexOf("Offensive materials"));
  });

  it("keeps each exception attached to the rule it qualifies", () => {
    // The exceptions (organ transplant, sniffer dogs) are the useful content —
    // they must not drift to the bottom of the page as a general footnote.
    const sections = getTopic("prohibited")!.sections;
    const animals = sections.find((s) => s.label === "Pets & live animals")!;
    expect(animals.blocks.some((b) => b.kind === "note" && b.text.includes("sniffer dog"))).toBe(true);
    const offensive = sections.find((s) => s.label === "Offensive materials")!;
    expect(offensive.blocks.some((b) => b.kind === "note" && b.text.includes("transplant"))).toBe(true);
  });
});

describe("no page prints an instruction meant for whoever builds it", () => {
  // `facilities.note` used to end "...so do not render these as a per-station
  // amenity list" — a rule for the developer, shipped as passenger-facing copy.
  // The JSON now keeps that half under `_rule`; this is what notices if a
  // future scrape folds a build rule back into a rendered field.
  it.each(ALL_TOPICS.map((t) => t.slug))("%s reads as copy, not as a directive", (slug) => {
    for (const block of blocksOf(slug)) {
      const text =
        block.kind === "note" || block.kind === "prose"
          ? block.text
          : block.kind === "list"
          ? block.items.join(" ")
          : "";
      expect(text, slug).not.toMatch(/\bdo not render\b|\bdo not display\b|\bnot recorded here\b/i);
    }
  });

  it("keeps the facilities caveat without the build rule", () => {
    const notes = blocksOf("facilities").flatMap((b) => (b.kind === "note" ? [b.text] : []));
    // The caveat itself must survive — it is the reason these are not shown
    // per station, and dropping it would overclaim rather than underclaim.
    expect(notes.some((t) => /does not state which stations/i.test(t))).toBe(true);
  });
});

describe("safety page — grouped by where the thing is", () => {
  it("groups all eleven items and drops no location", () => {
    const sections = getTopic("safety")!.sections;
    const total = sections.reduce(
      (n, s) => n + s.blocks.reduce((m, b) => m + (b.kind === "definitions" ? b.items.length : 0), 0),
      0
    );
    expect(total).toBe(11);
    expect(sections.map((s) => s.label)).toEqual([
      "On the platform",
      "In the station",
      "In the train",
      "Station and train",
    ]);
  });
});

describe("provenance", () => {
  it("reads a real date out of every dated file", () => {
    for (const row of dataProvenance()) {
      if (row.date === undefined) continue;
      // DD.MM.YYYY, GMRC's own format — and read from the file, so regenerating
      // one updates this screen without an edit here. A missing `_meta` field
      // would land as "undefined.undefined.undefined" rather than throwing.
      expect(row.date, row.key).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    }
  });

  it("dates the timetable and the reference data from their own _meta", () => {
    const byKey = new Map(dataProvenance().map((r) => [r.key, r]));
    expect(byKey.get("timetable")?.date).toBeDefined();
    expect(byKey.get("reference")?.date).toBeDefined();
  });

  it("names a real bundle key for every row, and asks for a date only where it has one", () => {
    // The rows carry keys rather than sentences now (§6.2), so a typo renders
    // "about.timetableDetial" on the settings screen and nothing throws. The
    // second half catches the opposite slip: a `{{date}}` in the English string
    // with no `date` on the row prints a sentence with a hole in it.
    for (const row of dataProvenance()) {
      const label = leafAt(en, row.labelKey);
      const detail = leafAt(en, row.detailKey);
      expect(label, row.labelKey).toBeTypeOf("string");
      expect(detail, row.detailKey).toBeTypeOf("string");
      expect(String(detail).includes("{{date}}"), row.detailKey).toBe(row.date !== undefined);
    }
  });

  it("dates the reference row off a scrape both its files share", () => {
    // The row covers two files but can only read one of them from the boot
    // bundle. That is honest only while the two agree.
    expect(passengerInfo._meta.scrapedOn).toBe(facilities._meta.scrapedOn);
  });
});
