import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The store's failure modes are all silent, which is what these assertions are
 * for. A migration that isn't idempotent duplicates or resurrects a rider's
 * data on the second boot; a delete that removes the row instead of tombstoning
 * it comes back on the next pull; a write that skips the outbox is a change that
 * exists on this phone and can never reach another one. None of those throw —
 * they just quietly produce the wrong favourites list a week later.
 */

// Node has no localStorage, and the migration's whole job is reading it.
function installLocalStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  });
  return store;
}

// Imported dynamically per-test: db.ts constructs its Dexie instance at module
// load, so a fresh IndexedDB needs a fresh module registry.
async function freshDb() {
  vi.resetModules();
  const mod = await import('./db');
  await mod.db.delete();
  await mod.db.open();
  return mod;
}

beforeEach(() => {
  installLocalStorage();
});

describe('migrateFromLocalStorage', () => {
  it('imports all four legacy keys', async () => {
    installLocalStorage({
      'metrothi-saved-stations': JSON.stringify(['motera-stadium', 'gnlu']),
      'metrothi-saved-journeys': JSON.stringify([
        { key: 'a->b', sourceId: 'a', destId: 'b', sourceName: 'A', destName: 'B', savedAt: 1000 },
      ]),
      'metrothi-recent-trips': JSON.stringify([
        { key: 'a->b', source: { id: 'a', name: 'A' }, dest: { id: 'b', name: 'B' }, savedAt: 2000 },
      ]),
      'metrothi-theme': 'dark',
    });
    const db = await freshDb();

    expect(await db.migrateFromLocalStorage()).toBe(true);
    expect((await db.listSavedStationIds()).sort()).toEqual(['gnlu', 'motera-stadium']);
    expect(await db.listSavedJourneys()).toHaveLength(1);
    expect(await db.listRecentTrips()).toHaveLength(1);
    expect(await db.getPref('theme')).toBe('dark');
  });

  it('preserves legacy savedAt as updatedAt rather than stamping "now"', async () => {
    // Stamping now() would let a stale local blob beat a genuinely newer row on
    // another device under last-write-wins.
    installLocalStorage({
      'metrothi-saved-journeys': JSON.stringify([{ key: 'a->b', savedAt: 1000 }]),
    });
    const db = await freshDb();
    await db.migrateFromLocalStorage();

    const row = await db.db.savedJourneys.get('a->b');
    expect(row?.updatedAt).toBe(1000);
  });

  it('is idempotent — a second run imports nothing', async () => {
    installLocalStorage({ 'metrothi-saved-stations': JSON.stringify(['gnlu']) });
    const db = await freshDb();

    expect(await db.migrateFromLocalStorage()).toBe(true);
    await db.toggleSavedStation('gnlu'); // rider unfavourites it after migrating
    expect(await db.listSavedStationIds()).toEqual([]);

    // The second run must not resurrect it.
    expect(await db.migrateFromLocalStorage()).toBe(false);
    expect(await db.listSavedStationIds()).toEqual([]);
  });

  it('survives a corrupt legacy blob', async () => {
    installLocalStorage({
      'metrothi-saved-stations': '{not json',
      'metrothi-recent-trips': JSON.stringify(['a string, not a trip']),
    });
    const db = await freshDb();

    await expect(db.migrateFromLocalStorage()).resolves.toBe(true);
    expect(await db.listSavedStationIds()).toEqual([]);
    expect(await db.listRecentTrips()).toEqual([]);
  });

  it('leaves the legacy keys in place', async () => {
    // An older cached build still reads them; the migration is a copy, not a move.
    const store = installLocalStorage({ 'metrothi-saved-stations': JSON.stringify(['gnlu']) });
    const db = await freshDb();
    await db.migrateFromLocalStorage();
    expect(store.get('metrothi-saved-stations')).toBe(JSON.stringify(['gnlu']));
  });
});

describe('tombstones', () => {
  it('unfavouriting tombstones the row instead of deleting it', async () => {
    const db = await freshDb();
    await db.toggleSavedStation('gnlu');
    await db.toggleSavedStation('gnlu');

    expect(await db.listSavedStationIds()).toEqual([]);
    // The row must still exist, or a pull can't tell "deleted" from "not seen yet".
    const row = await db.db.savedStations.get('gnlu');
    expect(row).toBeDefined();
    expect(row?.deletedAt).toBeTypeOf('number');
  });

  it('re-favouriting clears the tombstone', async () => {
    const db = await freshDb();
    await db.toggleSavedStation('gnlu');
    await db.toggleSavedStation('gnlu');
    await db.toggleSavedStation('gnlu');

    expect(await db.listSavedStationIds()).toEqual(['gnlu']);
    expect((await db.db.savedStations.get('gnlu'))?.deletedAt).toBeNull();
  });

  it('removeRecentTrip tombstones and hides the trip', async () => {
    const db = await freshDb();
    await db.recordRecentTrip({ key: 'a->b', source: { name: 'A' }, dest: { name: 'B' } });
    await db.removeRecentTrip('a->b');

    expect(await db.listRecentTrips()).toEqual([]);
    expect((await db.db.recentTrips.get('a->b'))?.deletedAt).toBeTypeOf('number');
  });
});

describe('outbox', () => {
  it('every mutation queues its row', async () => {
    const db = await freshDb();
    await db.toggleSavedStation('gnlu');
    await db.setPref('theme', 'dark');
    await db.recordRecentTrip({ key: 'a->b', source: null, dest: null });

    const queued = (await db.db.syncOutbox.toArray()).map(e => `${e.table}:${e.rowId}`).sort();
    expect(queued).toEqual(['prefs:theme', 'recentTrips:a->b', 'savedStations:gnlu']);
  });

  it('coalesces repeated writes to one entry per row', async () => {
    // Otherwise a rider toggling a favourite on a flaky connection builds a
    // queue of conflicting intents for a single row.
    const db = await freshDb();
    for (let i = 0; i < 5; i++) await db.toggleSavedStation('gnlu');

    expect(await db.db.syncOutbox.count()).toBe(1);
  });

  it('enqueueFullResync queues live rows and tombstones alike', async () => {
    // A sign-out-era unfavourite is as much a change to push as a favourite.
    const db = await freshDb();
    await db.toggleSavedStation('gnlu');
    await db.toggleSavedStation('motera-stadium');
    await db.toggleSavedStation('motera-stadium'); // now a tombstone
    await db.db.syncOutbox.clear();

    expect(await db.enqueueFullResync()).toBe(2);
    expect(await db.db.syncOutbox.count()).toBe(2);
  });
});

describe('recent trips', () => {
  it('evicts past the limit by tombstoning, newest kept', async () => {
    const db = await freshDb();
    for (let i = 0; i < db.RECENT_TRIP_LIMIT + 2; i++) {
      await db.recordRecentTrip({ key: `t${i}`, source: null, dest: null });
      // recordRecentTrip orders by savedAt, which is Date.now() — without a gap
      // the whole batch can land in the same millisecond and order arbitrarily.
      await new Promise(r => setTimeout(r, 2));
    }

    const kept = await db.listRecentTrips();
    expect(kept).toHaveLength(db.RECENT_TRIP_LIMIT);
    expect(kept.map(t => t.key)).not.toContain('t0');
    expect(kept[0].key).toBe(`t${db.RECENT_TRIP_LIMIT + 1}`);
    // Evicted rows are tombstoned, not dropped, so the cap holds on every device.
    expect((await db.db.recentTrips.get('t0'))?.deletedAt).toBeTypeOf('number');
  });

  it('re-planning the same trip updates it in place', async () => {
    const db = await freshDb();
    await db.recordRecentTrip({ key: 'a->b', source: null, dest: null });
    await db.recordRecentTrip({ key: 'a->b', source: null, dest: null });

    expect(await db.db.recentTrips.count()).toBe(1);
  });
});

describe('clearLocalUserData', () => {
  it('drops rows outright and does not queue deletes', async () => {
    // "Forget this device", not "delete my account" — queueing tombstones here
    // would wipe the rider's other phone on the next sync.
    const db = await freshDb();
    await db.toggleSavedStation('gnlu');
    await db.setPref('theme', 'dark');

    await db.clearLocalUserData();

    expect(await db.listSavedStationIds()).toEqual([]);
    expect(await db.db.savedStations.count()).toBe(0);
    expect(await db.db.syncOutbox.count()).toBe(0);
    expect(await db.getPref('theme')).toBeNull();
  });

  it('keeps the migration flag so legacy data is not re-imported', async () => {
    installLocalStorage({ 'metrothi-saved-stations': JSON.stringify(['gnlu']) });
    const db = await freshDb();
    await db.migrateFromLocalStorage();
    await db.clearLocalUserData();

    expect(await db.migrateFromLocalStorage()).toBe(false);
    expect(await db.listSavedStationIds()).toEqual([]);
  });
});
