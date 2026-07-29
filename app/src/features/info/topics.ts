import {
  Ticket,
  Store,
  Timer,
  IndianRupee,
  TriangleAlert,
  Scale,
  RotateCcw,
  Check,
  Ban,
  Dog,
  Luggage,
  Building2,
  Accessibility,
  Sparkles,
  TramFront,
  Train,
  Signpost,
  Headset,
  ListChecks,
  MapPin,
  Globe,
  AtSign,
  type LucideIcon,
} from "lucide-react";
import passengerInfo from "../../data/passengerInfo.json";
import metroInfo from "../../data/metroInfo.json";
import { ALL_TOPICS, type TopicEntry, type TopicSlug } from "./catalog";
import type { Block } from "./blocks";

/**
 * Every reference page's content, built from the two JSON files (§5.6) rather
 * than typed out again. This module is the reason `/you/:topic` is lazy: the
 * imports above are ~19 KB of prose that a map-first app must not boot with.
 *
 * The rule the whole file follows: **only facts GMRC states appear**, and where
 * two of their fields are joined into one sentence the join adds no claim. What
 * is *ordered* differently from the source is called out at the topic.
 */

export interface TopicSection {
  label: string;
  icon: LucideIcon;
  blocks: Block[];
}

export interface Topic extends TopicEntry {
  sections: TopicSection[];
  /** The GMRC page this was transcribed from, for the footer link. */
  source: string;
}

const LINKS = passengerInfo.officialLinks;

// ─── Fares & ticket rules ────────────────────────────────────────────────────

/** "₹50 + maximum fare", "₹10 / hour per person, max ₹50", "Difference of fare only". */
function penaltyAmount(p: {
  amountRs: number | null;
  plus?: string;
  per?: string;
  maxRs?: number;
  note?: string;
}): string {
  // Three of the seven penalties have no rupee figure at all — GMRC states a
  // rule instead ("difference of fare only"). Rendering those as ₹0, or as a
  // guessed number, would be inventing a fine.
  if (p.amountRs === null) {
    const note = p.note ?? "See GMRC";
    return note.charAt(0).toUpperCase() + note.slice(1);
  }
  let out = `₹${p.amountRs}`;
  if (p.per) out += ` / ${p.per}`;
  if (p.maxRs) out += `, max ₹${p.maxRs}`;
  if (p.plus) out += ` + ${p.plus}`;
  return out;
}

function faresSections(): TopicSection[] {
  const m = metroInfo;
  const dim = m.luggage.maxDimensionsCm;
  return [
    {
      label: "What you can pay with",
      icon: Ticket,
      blocks: [
        { kind: "list", marker: "bullet", items: m.fareMedia },
        { kind: "chips", items: m.fareProducts },
      ],
    },
    {
      label: "Where to buy",
      icon: Store,
      blocks: [
        {
          kind: "list",
          marker: "bullet",
          // Joined, never re-cased: "UPI" and "POS" are GMRC's acronyms and
          // lowercasing them to make the sentence flow turns them into words.
          items: [
            `${m.purchase.atStation.where} — ${m.purchase.atStation.payBy.join(", ")}.`,
            `${m.purchase.online.where} — ${m.purchase.online.payBy.join(", ")}.`,
            // The card, not just the tickets. `purchase` covers ticket media
            // only, but NCMC is the one medium that works across phases, so
            // the planner's cross-phase note now tells riders where to get one
            // — and a page titled "Where to buy" that omits it sends the
            // reader who followed that advice here to nothing. "GMRC also
            // lists" keeps the hedge: the station-sales claim appears on the
            // MMI page alone, while fare-rules and the NCMC page describe it
            // as bank-issued (metroInfo `cards.ncmc.alsoAtStationsNote`).
            `NCMC cards — ${m.cards.ncmc.purchase} GMRC also lists them as available at every station.`,
          ],
        },
        { kind: "note", text: m.purchase.online.note },
      ],
    },
    {
      label: "How long a ticket lasts",
      icon: Timer,
      blocks: [
        {
          kind: "keyValue",
          rows: [
            { label: "Paper QR ticket, from issue", value: `${m.ticketValidity.paperQrMins} min` },
            { label: "Mobile QR ticket, from issue", value: `${m.ticketValidity.mobileQrMins} min` },
            {
              label: "Inside the paid area, exiting the same station",
              value: `${m.timeInPaidArea.sameStationExitMins} min`,
            },
            {
              label: "Inside the paid area, exiting another station",
              value: `${m.timeInPaidArea.otherStationExitMins} min`,
            },
          ],
        },
        { kind: "note", text: "Staying longer than the last two is penalised — see below." },
      ],
    },
    {
      label: "Discounts & concessions",
      icon: IndianRupee,
      blocks: [
        {
          kind: "keyValue",
          rows: [
            { label: "Contactless Smart Card (CSC)", value: `${m.discounts.smartCardPct}% off` },
            { label: "NCMC", value: `${m.discounts.ncmcPct}% off` },
            {
              label: `Children under ${m.concessions.childrenFree.maxHeightFeet} feet, with an adult`,
              value: `${m.concessions.childrenFree.maxChildrenPerAdult} free`,
            },
          ],
        },
        {
          kind: "note",
          // The discount is real and confirmed, but Metrothi shows token fares
          // and never applies it (metroInfo `discounts.note`, fareEngine). Say
          // so here rather than letting a rider expect a discounted figure.
          text: "GMRC deducts the card discount when you exit, so it is not included in the fares Metrothi shows — those are token fares.",
        },
      ],
    },
    {
      label: "Ahmedabad ↔ Gandhinagar",
      icon: TriangleAlert,
      blocks: [
        {
          kind: "prose",
          tone: "warn",
          // "or a QR ticket" used to be here. GMRC's quote below restricts
          // tokens and CSC and says nothing about QR — reading permission out
          // of that silence is the inference §7.6 exists to prevent, and it
          // contradicted the journey planner's cross-phase card, which says
          // NCMC only (confirmed against fare-rules, DISCREPANCIES 2026-07-20).
          text: "Tokens and Smart Cards (CSC) are valid only within Phase 1. To cross between Phase 1 and Phase 2 you need an NCMC card.",
        },
        { kind: "note", text: m.phaseRestriction.quote },
      ],
    },
    {
      label: "If something goes wrong",
      icon: Scale,
      blocks: [
        { kind: "list", marker: "bullet", items: m.ticketConditions },
        {
          kind: "keyValue",
          rows: m.penalties.map((p) => ({ label: p.reason, value: penaltyAmount(p) })),
        },
      ],
    },
    {
      label: "Refunds",
      icon: RotateCcw,
      blocks: [
        {
          kind: "list",
          marker: "bullet",
          items: [
            m.refunds.quote,
            `Not refundable: ${m.refunds.nonRefundable.join(", ")}.`,
            m.refunds.smartCard,
            m.refunds.ncmc,
          ],
        },
      ],
    },
    {
      label: "Luggage",
      icon: Luggage,
      blocks: [
        {
          kind: "keyValue",
          rows: [
            { label: "Maximum weight", value: `${m.luggage.maxWeightKg} kg` },
            { label: "Maximum size", value: `${dim.length} × ${dim.width} × ${dim.height} cm` },
          ],
        },
      ],
    },
  ];
}

// ─── Do's & don'ts ───────────────────────────────────────────────────────────

function conductSections(): TopicSection[] {
  return [
    {
      label: "Do",
      icon: Check,
      blocks: [{ kind: "list", marker: "do", items: passengerInfo.dosAndDonts.dos }],
    },
    {
      label: "Don't",
      icon: Ban,
      blocks: [
        { kind: "list", marker: "dont", items: passengerInfo.dosAndDonts.donts },
        {
          kind: "note",
          // Sets up §6.7: the Gujarati and Hindi columns of this same poster are
          // the authoritative translations, so this topic is unblocked for
          // localization in a way the English-only GMRC pages are not.
          text: "GMRC publishes this as a poster in Gujarati, Hindi and English. The English column is transcribed here.",
        },
      ],
    },
  ];
}

// ─── Prohibited items ────────────────────────────────────────────────────────

/**
 * **Deliberately not in GMRC's order.** Their page follows the statute:
 * dangerous materials, then offensive materials, then live animals. The
 * question a rider actually arrives with is "can I bring my dog" or "is my
 * suitcase too big", so those two come first and the statutory lists follow.
 * Reordering the presentation alters no fact; every string is still theirs.
 *
 * The luggage limit comes from `metroInfo.json`, not this page — "can I bring
 * this" includes size, and the limit otherwise exists only as item 3 of a
 * nine-item conduct list where nobody would look for it.
 */
function prohibitedSections(): TopicSection[] {
  const p = passengerInfo.prohibitedItems;
  const dim = metroInfo.luggage.maxDimensionsCm;
  return [
    {
      label: "Pets & live animals",
      icon: Dog,
      blocks: [
        { kind: "prose", text: p.liveAnimals.rule },
        { kind: "note", text: p.liveAnimals.exception },
      ],
    },
    {
      label: "Luggage",
      icon: Luggage,
      blocks: [
        {
          kind: "keyValue",
          rows: [
            { label: "Maximum weight", value: `${metroInfo.luggage.maxWeightKg} kg` },
            { label: "Maximum size", value: `${dim.length} × ${dim.width} × ${dim.height} cm` },
          ],
        },
        { kind: "note", text: "Luggage exceeding that weight and/or those dimensions is not allowed." },
      ],
    },
    {
      label: "Dangerous materials",
      icon: TriangleAlert,
      blocks: [
        { kind: "prose", text: p.dangerous.heading },
        { kind: "list", marker: "bullet", items: p.dangerous.items },
      ],
    },
    {
      label: "Offensive materials",
      icon: Ban,
      blocks: [
        { kind: "prose", text: p.offensive.heading },
        { kind: "list", marker: "bullet", items: p.offensive.items },
        { kind: "note", text: p.offensive.exception },
        { kind: "note", text: `Under the ${p.legalBasis}.` },
      ],
    },
  ];
}

// ─── Facilities & accessibility ──────────────────────────────────────────────

function facilitiesSections(): TopicSection[] {
  const f = passengerInfo.facilities;
  return [
    {
      label: "At stations",
      icon: Sparkles,
      blocks: [{ kind: "chips", items: f.general }],
    },
    {
      label: "Accessibility",
      icon: Accessibility,
      blocks: [
        { kind: "chips", items: f.accessibility },
        { kind: "note", text: f.note },
        {
          // The one per-station accessibility fact GMRC does publish is which
          // gate each lift serves — that lives on the Station Info tab (§4.4.1).
          // Pointed at in words rather than as a link, because there is no
          // single station to link to and picking one would be arbitrary.
          kind: "note",
          text: "Which gates have a lift is published per station — open any station and see its Station Info tab.",
        },
      ],
    },
  ];
}

// ─── Safety & emergency ──────────────────────────────────────────────────────

/**
 * Grouped by *where the thing is*, because "on the platform" and "in the train"
 * are how you would look for it — not listed flat in GMRC's order.
 *
 * There is deliberately no emergency shortcut anywhere else in the app (§4.5.1):
 * the platform has a stop plunger, the train has an alarm and the station has a
 * helpline, and an app that inserts itself between a rider and those is worse
 * than one that stays out of the way. This content is read before it is needed.
 */
function safetySections(): TopicSection[] {
  const groups: { key: string; label: string; icon: LucideIcon }[] = [
    { key: "platform", label: "On the platform", icon: Signpost },
    { key: "station", label: "In the station", icon: Building2 },
    { key: "train", label: "In the train", icon: Train },
    { key: "station-and-train", label: "Station and train", icon: TramFront },
  ];
  return groups
    .map(({ key, label, icon }) => ({
      label,
      icon,
      blocks: [
        {
          kind: "definitions" as const,
          items: passengerInfo.emergencyFacilities
            .filter((e) => e.location === key)
            .map((e) => ({ term: e.name, description: e.description })),
        },
      ],
    }))
    .filter((section) => section.blocks[0].items.length > 0);
}

// ─── Customer care ───────────────────────────────────────────────────────────

function contactSections(): TopicSection[] {
  const c = passengerInfo.contact;
  const office = c.registeredOffice;
  return [
    {
      label: c.customerCare.label,
      icon: Headset,
      blocks: [
        {
          kind: "actions",
          items: [
            { kind: "tel", label: "Call customer care", value: c.customerCare.phone },
            { kind: "mailto", label: "Email customer care", value: c.customerCare.email },
          ],
        },
        { kind: "note", text: c.customerCare.scope },
      ],
    },
    {
      label: "Ways to reach them",
      icon: ListChecks,
      blocks: [{ kind: "list", marker: "bullet", items: c.customerCare.channels }],
    },
    {
      label: c.general.label,
      icon: AtSign,
      blocks: [
        {
          kind: "actions",
          items: [
            { kind: "tel", label: "Call the general line", value: c.general.phone },
            { kind: "mailto", label: "Email general enquiries", value: c.general.email },
          ],
        },
        {
          kind: "note",
          // This used to read "Anything that is not about a journey — tenders,
          // media, recruitment — goes here, not to passenger care." Both halves
          // were wrong. Those three examples are on no GMRC page; and GMRC
          // routes non-operational queries to the **registered office**, which
          // is a different thing from this line — so the invented sentence
          // contradicted `customerCare.scope`, printed two sections above it.
          // GMRC states no scope for the general line, so neither do we.
          text: "GMRC does not say what this line covers. It states only that non-operational queries go to the registered office, below.",
        },
      ],
    },
    {
      label: "Registered office",
      icon: Building2,
      blocks: [
        {
          kind: "definitions",
          items: [
            { term: office.operator, description: office.ownership },
            { term: "Address", description: office.address },
            { term: "CIN", description: office.cin },
          ],
        },
      ],
    },
  ];
}

// ─── Lost & found ────────────────────────────────────────────────────────────

function lostAndFoundSections(): TopicSection[] {
  const l = passengerInfo.lostAndFound;
  return [
    {
      label: "Where to go",
      icon: MapPin,
      blocks: [
        {
          kind: "keyValue",
          rows: [
            { label: "Office", value: l.office.replace("Lost & Found office, ", "") },
            { label: "Open", value: l.officeHours.replace(" hrs", "") },
          ],
        },
        {
          kind: "actions",
          items: [
            { kind: "tel", label: "Call the Lost & Found cell", value: l.phone },
            { kind: "mailto", label: "Email the Lost & Found cell", value: l.email },
            { kind: "external", label: "See items GMRC has found", value: l.listingUrl },
          ],
        },
        {
          // GMRC's found-items list changes weekly, so it is not bundled — the
          // link above opens the current one (§5.6).
          kind: "note",
          text: "The list of found items changes every week, so Metrothi does not carry a copy — the link opens GMRC's own.",
        },
      ],
    },
    {
      // Not "How to claim", and not numbered: GMRC publishes four *rules*, not
      // four steps. One is about reporting, one about claiming, one about
      // perishables and one about disposal — numbering them would invent a
      // sequence, and the last already states the six-month deadline, so this
      // section adds no note of its own repeating it.
      label: "Reporting & claiming",
      icon: ListChecks,
      blocks: [{ kind: "list", marker: "bullet", items: l.howToReport }],
    },
  ];
}

// ─── GMRC on the web ─────────────────────────────────────────────────────────

/** GMRC's link keys, as the page titles they actually are. */
const LINK_LABELS: Record<keyof typeof LINKS, string> = {
  home: "Ahmedabad Metro home",
  routeAndFares: "Route & fares",
  fareRules: "Fare rules",
  smartCards: "Smart cards",
  ncmc: "National Common Mobility Card (NCMC)",
  facilities: "Facilities for passengers",
  entryExitGates: "Entry & exit gates at each station",
  dosAndDonts: "Do's & don'ts",
  safetyAndSecurity: "Safety & security",
  lostAndFound: "Lost & found",
  customerCare: "Customer care",
  contactUs: "Contact us",
};

const SOCIAL_LABELS: Record<keyof typeof passengerInfo.social, string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

function linksSections(): TopicSection[] {
  return [
    {
      label: "Official pages",
      icon: Globe,
      blocks: [
        {
          kind: "linkList",
          items: (Object.keys(LINKS) as (keyof typeof LINKS)[]).map((key) => ({
            label: LINK_LABELS[key],
            href: LINKS[key],
          })),
        },
      ],
    },
    {
      label: "GMRC on social",
      icon: Sparkles,
      blocks: [
        {
          kind: "linkList",
          items: (Object.keys(passengerInfo.social) as (keyof typeof passengerInfo.social)[]).map(
            (key) => ({ label: SOCIAL_LABELS[key], href: passengerInfo.social[key] })
          ),
        },
      ],
    },
  ];
}

// ─── Registry ────────────────────────────────────────────────────────────────

const BUILDERS: Record<TopicSlug, { sections: () => TopicSection[]; source: string }> = {
  fares: { sections: faresSections, source: LINKS.fareRules },
  conduct: { sections: conductSections, source: LINKS.dosAndDonts },
  prohibited: { sections: prohibitedSections, source: LINKS.dosAndDonts },
  facilities: { sections: facilitiesSections, source: LINKS.facilities },
  safety: { sections: safetySections, source: LINKS.safetyAndSecurity },
  contact: { sections: contactSections, source: LINKS.customerCare },
  "lost-and-found": { sections: lostAndFoundSections, source: LINKS.lostAndFound },
  links: { sections: linksSections, source: LINKS.home },
};

/**
 * The topic behind a URL slug, or null when there is no such page — an unknown
 * slug is a stale link, and `InfoPage` sends it back to the YOU screen rather
 * than rendering an error.
 *
 * Sections are built on call rather than at module scope so a page costs only
 * its own construction, not all eight.
 */
export function getTopic(slug: string | undefined): Topic | null {
  const entry = ALL_TOPICS.find((t) => t.slug === slug);
  if (!entry) return null;
  const builder = BUILDERS[entry.slug];
  return { ...entry, sections: builder.sections(), source: builder.source };
}
