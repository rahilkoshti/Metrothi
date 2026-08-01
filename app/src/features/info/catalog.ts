import {
  Ticket,
  ThumbsUp,
  Ban,
  Accessibility,
  LifeBuoy,
  Headset,
  PackageSearch,
  Smartphone,
  Globe,
  type LucideIcon,
} from "lucide-react";

/**
 * What reference pages exist, for the rows on the YOU screen (§4.5.1).
 *
 * Deliberately separate from `topics.ts`, and deliberately importing no JSON:
 * this module is reached from the YOU screen, which lists the topics, while
 * `topics.ts` — which pulls in 19 KB of reference prose — is reached only from
 * the `/you/:topic` chunk one route below (§4.6). Anything that needs the
 * *content* of a topic belongs there; this file knows only that a topic exists
 * and what its row says. `topics.test.ts` holds the two in sync by asserting
 * every slug here resolves to a built topic.
 */

export type TopicSlug =
  | "fares"
  | "conduct"
  | "prohibited"
  | "facilities"
  | "safety"
  | "contact"
  | "lost-and-found"
  | "links";

export interface TopicEntry {
  slug: TopicSlug;
  /** The page's own H1, and the sticky header's title. */
  title: string;
  /** The row's second line — what question this page answers. */
  blurb: string;
  icon: LucideIcon;
}

/** "Riding the metro" — how the system works, read before you travel. */
export const RIDING_TOPICS: TopicEntry[] = [
  {
    slug: "fares",
    title: "Fares & ticket rules",
    blurb: "What to buy, where, and how long it lasts",
    icon: Ticket,
  },
  {
    slug: "conduct",
    title: "Do's & don'ts",
    blurb: "GMRC's rules for passengers",
    icon: ThumbsUp,
  },
  {
    slug: "prohibited",
    title: "Prohibited items",
    blurb: "Pets, luggage limits and banned goods",
    icon: Ban,
  },
  {
    slug: "facilities",
    title: "Facilities & accessibility",
    // Not "What every station offers": GMRC does not state which stations have
    // which, and the page's own note says so — the blurb was asserting the
    // thing the note retracts (§7.6).
    blurb: "What the network offers",
    icon: Accessibility,
  },
  {
    slug: "safety",
    title: "Safety & emergency",
    blurb: "Where the alarms and equipment are",
    icon: LifeBuoy,
  },
];

/** "Help & contact" — who to reach, and where the official sources are. */
export const HELP_TOPICS: TopicEntry[] = [
  {
    slug: "contact",
    title: "Customer care",
    blurb: "Call or email GMRC about your journey",
    icon: Headset,
  },
  {
    slug: "lost-and-found",
    title: "Lost & found",
    blurb: "Left something on a train or at a station",
    icon: PackageSearch,
  },
  {
    slug: "links",
    title: "GMRC on the web",
    blurb: "Official pages and social accounts",
    icon: Globe,
  },
];

export const ALL_TOPICS: TopicEntry[] = [...RIDING_TOPICS, ...HELP_TOPICS];

/**
 * The official GMRC app is the one "Help & contact" row that is **not** a page.
 * It holds two store URLs and a sentence; a page here would be a dead end that
 * shows you a button you then have to press. The row acts directly, and its
 * second line names the store it is about to open.
 *
 * Metrothi does not and will not sell tickets (§3), so naming the app that does
 * is the honest move rather than dead-ending the user.
 *
 * **The three URLs below are copied from `passengerInfo.json`, not imported.**
 * A named JSON import looks like it would tree-shake to just these keys — it
 * does not. Vite emits one module per JSON file, so a single named import here
 * drags all 12 KB of reference prose into whatever chunk this module lands in
 * and leaves the topic chunk with none of it. That chunk used to be the boot
 * bundle; since `/you` went lazy it is the settings screen's own, which is a
 * smaller cost and the same mistake — a list of rows that links to those pages
 * has no more use for their text than the map does. Verified in the build
 * output, not assumed.
 *
 * `topics.test.ts` asserts these three still match the JSON, so the copy cannot
 * silently drift from the source of record.
 */
export const OFFICIAL_APP = {
  title: "Official GMRC app",
  blurb: "The only place to buy mobile QR tickets",
  icon: Smartphone,
  ios: "https://apps.apple.com/in/app/ahmedabad-metro-official-app/id6670203895",
  android:
    "https://play.google.com/store/apps/details?id=com.gujaratmetrorail.gmrcamddigitalticketing",
} as const;

/**
 * GMRC's own feedback form. Kept next to the Feedback rows on the YOU screen
 * rather than on a page: complaints about *the metro* go to GMRC, reports about
 * *Metrothi* come to us, and the split only works if the GMRC one is one tap
 * and visibly outbound (§4.5.1). Copied, and guarded by a test, for the same
 * bundle reason as the store links above.
 */
export const GMRC_FEEDBACK_URL = "https://www.gujaratmetrorail.com/ahmedabad/feedback/";

/**
 * Which store link the row should open. Everything not iOS gets Play.
 *
 * Returns the store's name, not the sentence around it — the row's own words
 * ("Opens …") are Metrothi's and come from the bundle, while "Google Play" and
 * "the App Store" are proper nouns that stay as they are in every language.
 */
export function officialAppStore(): { href: string; store: string } {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS
    ? { href: OFFICIAL_APP.ios, store: "the App Store" }
    : { href: OFFICIAL_APP.android, store: "Google Play" };
}
