/**
 * The rider's preferences, and how a stored string becomes a usable value
 * (PRD §5.7, §8.1 phase E).
 *
 * The `prefs` table stores `string` values because that's what survives a round
 * trip through Postgres and back without a per-pref column, so every read has to
 * parse and every parse has to survive a value it doesn't recognise — a row
 * written by a newer build, or one that syncs down from a device running one.
 * Each `read*` below therefore falls back to the default rather than throwing or
 * trusting the string, which is also what makes an unset pref and a corrupt one
 * behave identically.
 *
 * Deliberately free of React and of the engine, so `db.ts` and the UI can both
 * use it and nothing here pulls a component tree onto the boot path. Theme is
 * absent on purpose: it needs a synchronous first-paint read and lives in
 * `ThemeContext` with its own `localStorage` mirror (§5.7).
 *
 * Language keeps a first-paint mirror too (`i18n/index.ts`) and is still *here*,
 * because unlike theme it has a preset list to parse a stored string against —
 * which is this module's whole job. Only the mirror lives elsewhere.
 */

/** Pref row names. These are the primary keys in the `prefs` table — never rename one. */
export const PREF_WALK_SPEED = 'walkSpeedKmh';
export const PREF_DEFAULT_DEPARTURE = 'defaultDepartureStationId';
export const PREF_LANGUAGE = 'language';
export const PREF_ANALYTICS = 'analytics';

// ─── Walking speed ───────────────────────────────────────────────────────────

/**
 * The three paces offered, in km/h.
 *
 * A fixed set rather than a free number: the walk figure is an estimate from a
 * straight-line distance to the station door, and offering 4.7 km/h would claim
 * a precision the input doesn't have. 5 km/h is the middle option and stays the
 * default, so an existing rider's estimates don't move when this ships.
 */
export const WALK_SPEED_PRESETS = [
  { kmh: 4, labelKey: 'you.paceRelaxed', detailKey: 'you.paceRelaxedDetail' },
  { kmh: 5, labelKey: 'you.paceNormal', detailKey: 'you.paceNormalDetail' },
  { kmh: 6, labelKey: 'you.paceBrisk', detailKey: 'you.paceBriskDetail' },
] as const;

export const DEFAULT_WALK_SPEED_KMH = 5;

/** The stored walk speed, or the default if it's unset or not one of the presets. */
export function readWalkSpeed(raw: string | null): number {
  const kmh = Number(raw);
  return WALK_SPEED_PRESETS.some(p => p.kmh === kmh) ? kmh : DEFAULT_WALK_SPEED_KMH;
}

/**
 * The preset behind a speed, or null for a speed we have no name for — which is
 * reachable, since a pref can sync down from a build offering a fourth pace.
 *
 * Returns the preset, not a rendered label. This module has to stay free of
 * React *and* of i18next (it is imported by `db.ts` and by the boot path), so
 * the row composes the sentence from `labelKey`; the previous version returned
 * "Normal (5 km/h)" and was English in every language.
 */
export function walkSpeedPreset(kmh: number): (typeof WALK_SPEED_PRESETS)[number] | null {
  return WALK_SPEED_PRESETS.find(p => p.kmh === kmh) ?? null;
}

// ─── Default departure station ───────────────────────────────────────────────

/**
 * The stored default departure station id, or `null` for "use GPS".
 *
 * Not validated against the station list here — that would drag `stations.json`
 * into every module that reads a pref. `useDefaultDeparture` resolves the id and
 * treats an unknown one as unset, which is also the right answer if a station is
 * renamed between builds on two synced devices.
 */
export function readDefaultDeparture(raw: string | null): string | null {
  return raw || null;
}

/** The sentinel written when the rider picks "Use my location" again. */
export const DEPARTURE_USE_GPS = '';

// ─── Language ────────────────────────────────────────────────────────────────

/**
 * The three languages offered (PRD §6).
 *
 * Each label is written in its own script, so the selector identifies itself to
 * a rider who cannot read the other two. All three are left-to-right, so
 * nothing here implies a layout mirror.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'gu', label: 'ગુજરાતી' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * The stored language, or English if it's unset or not one we ship.
 *
 * Also used on the way *out* of i18next, whose `language` can be a region
 * subtag (`hi-IN`) or a fallback chain entry we never wrote — so the same parse
 * guards the store and the library, and neither can put an unknown code in
 * front of the font rules or the selector.
 */
export function readLanguage(raw: string | null | undefined): LanguageCode {
  const code = (raw ?? '').split('-')[0];
  return LANGUAGES.some(l => l.code === code) ? (code as LanguageCode) : DEFAULT_LANGUAGE;
}

// ─── Analytics opt-out ───────────────────────────────────────────────────────

/**
 * The two stored values.
 *
 * `'on'` is written explicitly rather than deleting the row, so the choice
 * syncs as a choice: a pref that is merely absent on the other device is
 * indistinguishable from one that has not arrived yet (§5.7's tombstone
 * argument, in miniature). Only `'off'` is *read* as off — see below.
 */
export const ANALYTICS_ON = 'on';
export const ANALYTICS_OFF = 'off';

/**
 * Whether product analytics may run (PRD §5.8).
 *
 * **Opt-out, not opt-in, and only `'off'` counts as off.** Every other reading
 * of the parse rule at the top of this file would be wrong here: an unset pref,
 * a corrupt one, and one written by a newer build must not all silently mean
 * "no analytics", because that would make a failed read indistinguishable from
 * a rider's explicit choice — and the failure mode of *this* pref is the one
 * that matters legally, not just behaviourally.
 *
 * Being a `prefs` row rather than a `localStorage` flag means the choice syncs
 * (§5.7): turning it off on a phone turns it off on the tablet too, which is
 * the only reading of "off" a rider would accept.
 */
export function readAnalyticsEnabled(raw: string | null): boolean {
  return raw !== ANALYTICS_OFF;
}
