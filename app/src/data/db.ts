import Dexie, { type Table } from 'dexie';

/**
 * User data store (PRD §5.7).
 *
 * Holds *user* data only — saved stations, saved journeys, recent trips and
 * preferences. The transit graph and timetables are bundled JSON precached by
 * the service worker and are deliberately **not** in here (§5.2): they're
 * read-only build output, so putting them in IndexedDB would buy a migration
 * and an async read in exchange for nothing.
 *
 * Two rules the rest of the app depends on:
 *
 * 1. **Local write first.** Every mutation lands in Dexie and the UI renders
 *    that. Sync is a consequence, never a precondition — nothing here fails or
 *    blocks because the network is down or no account exists.
 * 2. **Deletes are tombstones.** Rows are marked `deletedAt` and filtered out
 *    of reads, never removed. A row that's locally *gone* is indistinguishable
 *    from one the server has and we haven't pulled yet, so hard deletes would
 *    resurrect every station you ever unfavourited on the next pull. The
 *    tombstone is the thing that syncs.
 */

/** Tables that participate in sync. `meta` and `syncOutbox` deliberately don't. */
export type SyncTable = 'savedStations' | 'savedJourneys' | 'recentTrips' | 'prefs';

/** Fields every syncable row carries. */
interface Synced {
  /** Epoch ms of the last local mutation. The only input to conflict resolution. */
  updatedAt: number;
  /** Epoch ms of deletion, or `null` for a live row. See the tombstone rule above. */
  deletedAt: number | null;
}

export interface SavedStation extends Synced {
  stationId: string;
}

export interface SavedJourney extends Synced {
  /** `${sourceId}->${destId}` — stable, so the same journey saved twice is one row. */
  key: string;
  sourceId?: string;
  destId?: string;
  sourceName?: string;
  destName?: string;
  savedAt: number;
}

/**
 * One end of a recent trip: a station record or a resolved `PlaceNode` (§4.2).
 *
 * Kept structural rather than a union of the two real types. A stored trip is
 * replayed straight back into the planner, which accepts either, and the fields
 * the UI actually reads are `name` and `id`. The index signature is what lets an
 * unchanged station object round-trip through IndexedDB — narrowing it to the
 * known keys would quietly drop everything else on the way out.
 */
export interface TripEndpoint {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  isPlace?: boolean;
  [extra: string]: unknown;
}

export interface RecentTrip extends Synced {
  /** `${sourceId|name}->${destId|name}` — places have no id, hence the fallback. */
  key: string;
  source: TripEndpoint | null;
  dest: TripEndpoint | null;
  savedAt: number;
}

export interface Pref extends Synced {
  name: string;
  value: string;
}

/**
 * A row that needs pushing.
 *
 * Intentionally records only *which* row, not what changed: the drain reads the
 * current row out of Dexie at push time. That makes an entry idempotent (the
 * push is an upsert) and self-coalescing — the compound primary key means
 * queueing the same row five times leaves one entry, so a rider toggling a
 * favourite on a flaky connection doesn't build a queue of five conflicting
 * intents. Whether it's an upsert or a delete is derived from `deletedAt`.
 */
export interface OutboxEntry {
  table: SyncTable;
  rowId: string;
  queuedAt: number;
}

/** Internal bookkeeping: migration flag, pull cursor, last synced user. */
export interface MetaRow {
  key: string;
  value: string;
}

export class MetrothiDB extends Dexie {
  savedStations!: Table<SavedStation, string>;
  savedJourneys!: Table<SavedJourney, string>;
  recentTrips!: Table<RecentTrip, string>;
  prefs!: Table<Pref, string>;
  syncOutbox!: Table<OutboxEntry, [SyncTable, string]>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('metrothi');
    this.version(1).stores({
      savedStations: 'stationId, updatedAt, deletedAt',
      savedJourneys: 'key, updatedAt, deletedAt, savedAt',
      recentTrips: 'key, updatedAt, deletedAt, savedAt',
      prefs: 'name, updatedAt, deletedAt',
      // Compound primary key, so re-queueing a row overwrites rather than appends.
      syncOutbox: '[table+rowId], queuedAt',
      meta: 'key',
    });
  }
}

export const db = new MetrothiDB();

/** The primary-key field for each syncable table, so generic code can address rows. */
export const PRIMARY_KEY: Record<SyncTable, string> = {
  savedStations: 'stationId',
  savedJourneys: 'key',
  recentTrips: 'key',
  prefs: 'name',
};

export const SYNC_TABLES: SyncTable[] = ['savedStations', 'savedJourneys', 'recentTrips', 'prefs'];

/** The id of a row in `table`, whatever that table calls its key. */
export function rowIdOf(table: SyncTable, row: Record<string, unknown>): string {
  return String(row[PRIMARY_KEY[table]]);
}

/**
 * Mark a row as needing a push.
 *
 * **Must be called inside the same transaction as the data write.** A write
 * that commits without its outbox entry is a change that exists locally and can
 * never reach the server — silent, and only discovered on a new device.
 */
export function queueForSync(table: SyncTable, rowId: string) {
  return db.syncOutbox.put({ table, rowId, queuedAt: Date.now() });
}

// ─── Meta helpers ────────────────────────────────────────────────────────────

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  return db.meta.put({ key, value });
}

export const META_MIGRATED = 'migratedFromLocalStorage';
export const META_PULL_CURSOR = 'lastPullAt';
export const META_SYNCED_USER = 'lastSyncedUserId';

// ─── Saved stations ──────────────────────────────────────────────────────────

/** Live favourite ids. Tombstoned rows are filtered out, never returned. */
export async function listSavedStationIds(): Promise<string[]> {
  const rows = await db.savedStations.toArray();
  return rows.filter(r => r.deletedAt == null).map(r => r.stationId);
}

export async function toggleSavedStation(stationId: string): Promise<void> {
  await db.transaction('rw', db.savedStations, db.syncOutbox, async () => {
    const existing = await db.savedStations.get(stationId);
    const now = Date.now();
    // Absent and tombstoned both mean "not saved", so both toggle *on*.
    const wasSaved = existing != null && existing.deletedAt == null;
    await db.savedStations.put({
      stationId,
      updatedAt: now,
      deletedAt: wasSaved ? now : null,
    });
    await queueForSync('savedStations', stationId);
  });
}

// ─── Saved journeys ──────────────────────────────────────────────────────────

export async function listSavedJourneys(): Promise<SavedJourney[]> {
  const rows = await db.savedJourneys.toArray();
  return rows.filter(r => r.deletedAt == null).sort((a, b) => b.savedAt - a.savedAt);
}

export async function isJourneySaved(key: string): Promise<boolean> {
  const row = await db.savedJourneys.get(key);
  return row != null && row.deletedAt == null;
}

export async function toggleSavedJourney(
  journey: Omit<SavedJourney, 'updatedAt' | 'deletedAt' | 'savedAt'>,
): Promise<boolean> {
  let nowSaved = false;
  await db.transaction('rw', db.savedJourneys, db.syncOutbox, async () => {
    const existing = await db.savedJourneys.get(journey.key);
    const now = Date.now();
    const wasSaved = existing != null && existing.deletedAt == null;
    nowSaved = !wasSaved;
    await db.savedJourneys.put({
      ...journey,
      savedAt: wasSaved ? (existing?.savedAt ?? now) : now,
      updatedAt: now,
      deletedAt: wasSaved ? now : null,
    });
    await queueForSync('savedJourneys', journey.key);
  });
  return nowSaved;
}

// ─── Recent trips ────────────────────────────────────────────────────────────

/** How many recent trips survive. Matches the pre-Dexie localStorage behaviour. */
export const RECENT_TRIP_LIMIT = 5;

export async function listRecentTrips(): Promise<RecentTrip[]> {
  const rows = await db.recentTrips.toArray();
  return rows
    .filter(r => r.deletedAt == null)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, RECENT_TRIP_LIMIT);
}

/**
 * Record a planned trip, most-recent-first, capped at {@link RECENT_TRIP_LIMIT}.
 *
 * Eviction tombstones the loser rather than deleting it, so the cap applies on
 * every device instead of the evicted trip being pulled straight back.
 */
export async function recordRecentTrip(
  trip: Omit<RecentTrip, 'updatedAt' | 'deletedAt' | 'savedAt'>,
): Promise<void> {
  await db.transaction('rw', db.recentTrips, db.syncOutbox, async () => {
    const now = Date.now();
    await db.recentTrips.put({ ...trip, savedAt: now, updatedAt: now, deletedAt: null });
    await queueForSync('recentTrips', trip.key);

    const live = (await db.recentTrips.toArray())
      .filter(r => r.deletedAt == null)
      .sort((a, b) => b.savedAt - a.savedAt);
    for (const stale of live.slice(RECENT_TRIP_LIMIT)) {
      await db.recentTrips.put({ ...stale, updatedAt: now, deletedAt: now });
      await queueForSync('recentTrips', stale.key);
    }
  });
}

export async function removeRecentTrip(key: string): Promise<void> {
  await db.transaction('rw', db.recentTrips, db.syncOutbox, async () => {
    const existing = await db.recentTrips.get(key);
    if (!existing) return;
    const now = Date.now();
    await db.recentTrips.put({ ...existing, updatedAt: now, deletedAt: now });
    await queueForSync('recentTrips', key);
  });
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getPref(name: string): Promise<string | null> {
  const row = await db.prefs.get(name);
  return row && row.deletedAt == null ? row.value : null;
}

export async function setPref(name: string, value: string): Promise<void> {
  await db.transaction('rw', db.prefs, db.syncOutbox, async () => {
    await db.prefs.put({ name, value, updatedAt: Date.now(), deletedAt: null });
    await queueForSync('prefs', name);
  });
}

// ─── localStorage migration ──────────────────────────────────────────────────

/** The keys user data lived in before Dexie. Read once, then left alone. */
const LEGACY_KEYS = {
  savedStations: 'metrothi-saved-stations',
  savedJourneys: 'metrothi-saved-journeys',
  recentTrips: 'metrothi-recent-trips',
  theme: 'metrothi-theme',
} as const;

/** A legacy trip endpoint, or null if the blob held something that isn't an object. */
function asEndpoint(value: unknown): TripEndpoint | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TripEndpoint)
    : null;
}

function readLegacyArray(key: string): unknown[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * One-time import of the four pre-Dexie `localStorage` keys.
 *
 * Idempotent via a `meta` flag, and the legacy keys are **not** deleted: a user
 * who opens an older cached build of the app afterwards still finds their data
 * where that build looks for it. They're stale from this point on, and only
 * `metrothi-theme` is still written (as the first-paint mirror, see
 * `ThemeContext`).
 *
 * Rows are imported with `updatedAt` taken from the legacy `savedAt` where one
 * exists rather than "now", so a sync against a device that already has newer
 * versions of these rows doesn't let stale local data win the LWW comparison.
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (await getMeta(META_MIGRATED)) return false;

  const now = Date.now();
  const stationIds = readLegacyArray(LEGACY_KEYS.savedStations)
    .filter((id): id is string => typeof id === 'string');
  const journeys = readLegacyArray(LEGACY_KEYS.savedJourneys) as Array<Record<string, unknown>>;
  const trips = readLegacyArray(LEGACY_KEYS.recentTrips) as Array<Record<string, unknown>>;
  let theme: string | null = null;
  try {
    theme = localStorage.getItem(LEGACY_KEYS.theme);
  } catch { /* private mode — nothing to migrate */ }

  await db.transaction('rw', [db.savedStations, db.savedJourneys, db.recentTrips, db.prefs, db.meta], async () => {
    // Re-check inside the transaction: two tabs booting at once both pass the
    // check above, and only one of them should do the import.
    if (await getMeta(META_MIGRATED)) return;

    // `add` rather than `put` throughout — if a row somehow already exists it's
    // newer than a legacy blob by definition, and must not be overwritten.
    for (const stationId of stationIds) {
      await db.savedStations.add({ stationId, updatedAt: now, deletedAt: null }).catch(() => {});
    }
    for (const j of journeys) {
      if (typeof j.key !== 'string') continue;
      const savedAt = typeof j.savedAt === 'number' ? j.savedAt : now;
      await db.savedJourneys.add({
        key: j.key,
        sourceId: typeof j.sourceId === 'string' ? j.sourceId : undefined,
        destId: typeof j.destId === 'string' ? j.destId : undefined,
        sourceName: typeof j.sourceName === 'string' ? j.sourceName : undefined,
        destName: typeof j.destName === 'string' ? j.destName : undefined,
        savedAt,
        updatedAt: savedAt,
        deletedAt: null,
      }).catch(() => {});
    }
    for (const t of trips) {
      if (typeof t.key !== 'string') continue;
      const savedAt = typeof t.savedAt === 'number' ? t.savedAt : now;
      await db.recentTrips.add({
        key: t.key,
        source: asEndpoint(t.source),
        dest: asEndpoint(t.dest),
        savedAt,
        updatedAt: savedAt,
        deletedAt: null,
      }).catch(() => {});
    }
    if (theme === 'dark' || theme === 'light') {
      await db.prefs.add({ name: 'theme', value: theme, updatedAt: now, deletedAt: null }).catch(() => {});
    }

    await setMeta(META_MIGRATED, String(now));
  });

  return true;
}

/**
 * Queue every live local row for push.
 *
 * Used on sign-in: a rider who used the app anonymously for a month has local
 * rows the server has never seen, and discarding them would punish exactly the
 * local-first behaviour the app encourages (§5.7). Tombstones are queued too —
 * an unfavourite made while signed out is just as much a change as a favourite.
 */
export async function enqueueFullResync(): Promise<number> {
  let queued = 0;
  await db.transaction('rw', [db.savedStations, db.savedJourneys, db.recentTrips, db.prefs, db.syncOutbox], async () => {
    for (const table of SYNC_TABLES) {
      const rows = await (db[table] as unknown as Table<Record<string, unknown>, string>).toArray();
      for (const row of rows) {
        await queueForSync(table, rowIdOf(table, row));
        queued++;
      }
    }
  });
  return queued;
}

/**
 * Wipe local user data (the YOU screen's "Clear local data").
 *
 * Drops rows outright instead of tombstoning, and clears the outbox and pull
 * cursor with them — this is "forget this device", not "delete my account", so
 * it must not push a wave of deletes to the server and wipe the rider's other
 * phone. The migration flag stays set so the legacy `localStorage` keys aren't
 * re-imported straight back.
 */
export async function clearLocalUserData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.savedStations, db.savedJourneys, db.recentTrips, db.prefs, db.syncOutbox, db.meta],
    async () => {
      await Promise.all([
        db.savedStations.clear(),
        db.savedJourneys.clear(),
        db.recentTrips.clear(),
        db.prefs.clear(),
        db.syncOutbox.clear(),
      ]);
      await db.meta.delete(META_PULL_CURSOR);
      await db.meta.delete(META_SYNCED_USER);
    },
  );
}
