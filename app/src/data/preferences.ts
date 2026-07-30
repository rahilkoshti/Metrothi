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
 */

/** Pref row names. These are the primary keys in the `prefs` table — never rename one. */
export const PREF_WALK_SPEED = 'walkSpeedKmh';
export const PREF_DEFAULT_DEPARTURE = 'defaultDepartureStationId';

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
  { kmh: 4, label: 'Relaxed', detail: '4 km/h — allow a little more time' },
  { kmh: 5, label: 'Normal', detail: '5 km/h — the default estimate' },
  { kmh: 6, label: 'Brisk', detail: '6 km/h — walking with purpose' },
] as const;

export const DEFAULT_WALK_SPEED_KMH = 5;

/** The stored walk speed, or the default if it's unset or not one of the presets. */
export function readWalkSpeed(raw: string | null): number {
  const kmh = Number(raw);
  return WALK_SPEED_PRESETS.some(p => p.kmh === kmh) ? kmh : DEFAULT_WALK_SPEED_KMH;
}

/** The preset label for a speed, for the settings row's summary line. */
export function walkSpeedLabel(kmh: number): string {
  const preset = WALK_SPEED_PRESETS.find(p => p.kmh === kmh);
  return preset ? `${preset.label} (${preset.kmh} km/h)` : `${kmh} km/h`;
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
