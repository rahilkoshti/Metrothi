import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Sync correctness, against an in-memory stand-in for Supabase.
 *
 * Every failure this covers loses a rider's data silently rather than throwing:
 * a pull that overwrites an unpushed local change, a pull that queues what it
 * just received and ping-pongs forever, a tombstone that gets resurrected
 * because the delete never reached the server. The last-write-wins comparison is
 * two `>=` characters, and getting either backwards means the older edit wins on
 * every device.
 */

interface Row { [key: string]: unknown }

/** Postgres stand-in: table → composite key → row. */
function makeServer() {
  const tables = new Map<string, Map<string, Row>>();
  const keyOf = (r: Row) => `${r.user_id}:${r.id}`;
  /** Records pushes so a test can assert a sync didn't write anything back. */
  const upserts: { table: string; rows: Row[] }[] = [];

  const write = (table: string, rows: Row[]) => {
    const t = tables.get(table) ?? new Map<string, Row>();
    for (const r of rows) t.set(keyOf(r), r);
    tables.set(table, t);
  };
  const rowsOf = (table: string): Row[] => [...(tables.get(table)?.values() ?? [])];

  return {
    tables,
    upserts,
    seed: write,
    rows: rowsOf,
    /**
     * @param beforePull runs inside the pull's fetch, before it resolves — the
     *   only way to model a rider tapping something mid-round-trip.
     */
    client(session: { user: { id: string } } | null, beforePull?: () => Promise<void>) {
      return {
        auth: {
          getSession: async () => ({ data: { session } }),
        },
        from(table: string) {
          const filters: { gt?: number } = {};
          const chain = {
            upsert(rows: Row[]) {
              upserts.push({ table, rows });
              write(table, rows);
              return Promise.resolve({ error: null });
            },
            select() { return chain; },
            eq() { return chain; },
            gt(_col: string, value: number) { filters.gt = value; return chain; },
            async order() {
              if (beforePull) await beforePull();
              const data = rowsOf(table)
                .filter(r => filters.gt === undefined || Number(r.updated_at) > filters.gt)
                .sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
              return { data, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
}

const USER = 'user-1';

async function setup(session: { user: { id: string } } | null = { user: { id: USER } }) {
  const server = makeServer();
  vi.resetModules();
  vi.doMock('./supabase', () => ({
    isSupabaseConfigured: true,
    getSupabase: async () => server.client(session),
  }));
  const db = await import('../data/db');
  await db.db.delete();
  await db.db.open();
  const sync = await import('./syncEngine');
  return { server, db, sync };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  });
});

describe('push', () => {
  it('sends queued rows and clears the outbox', async () => {
    const { server, db, sync } = await setup();
    await db.toggleSavedStation('gnlu');

    const status = await sync.syncNow();

    expect(status.state).toBe('idle');
    expect(server.rows('saved_stations')).toEqual([
      { user_id: USER, id: 'gnlu', updated_at: expect.any(Number), deleted_at: null },
    ]);
    expect(await db.db.syncOutbox.count()).toBe(0);
  });

  it('pushes a tombstone as deleted_at, not as a missing row', async () => {
    const { server, db, sync } = await setup();
    await db.toggleSavedStation('gnlu');
    await db.toggleSavedStation('gnlu');

    await sync.syncNow();

    expect(server.rows('saved_stations')[0].deleted_at).toBeTypeOf('number');
  });

  it('maps every table to its remote column names', async () => {
    const { server, db, sync } = await setup();
    await db.toggleSavedJourney({ key: 'a->b', sourceId: 'a', destId: 'b', sourceName: 'A', destName: 'B' });
    await db.recordRecentTrip({ key: 'a->b', source: { name: 'A' }, dest: { name: 'B' } });
    await db.setPref('theme', 'dark');

    await sync.syncNow();

    expect(server.rows('saved_journeys')[0]).toMatchObject({ id: 'a->b', source_id: 'a', dest_name: 'B' });
    expect(server.rows('recent_trips')[0]).toMatchObject({ id: 'a->b', source: { name: 'A' } });
    expect(server.rows('user_prefs')[0]).toMatchObject({ id: 'theme', value: 'dark' });
  });
});

describe('pull', () => {
  it('applies a server row that does not exist locally', async () => {
    const { server, db, sync } = await setup();
    server.seed('saved_stations', [
      { user_id: USER, id: 'motera-stadium', updated_at: 5000, deleted_at: null },
    ]);

    await sync.syncNow();

    expect(await db.listSavedStationIds()).toEqual(['motera-stadium']);
  });

  it('applies a server tombstone, removing the station locally', async () => {
    const { server, db, sync } = await setup();
    await db.toggleSavedStation('gnlu');
    await sync.syncNow();
    // Same row unfavourited on another device, later.
    server.seed('saved_stations', [
      { user_id: USER, id: 'gnlu', updated_at: Date.now() + 10_000, deleted_at: Date.now() + 10_000 },
    ]);

    await sync.syncNow();

    expect(await db.listSavedStationIds()).toEqual([]);
  });

  it('does not queue what it just pulled', async () => {
    // Queueing a pulled row pushes it straight back, and every sync thereafter
    // ping-pongs the same row forever.
    const { server, db, sync } = await setup();
    server.seed('saved_stations', [
      { user_id: USER, id: 'motera-stadium', updated_at: 5000, deleted_at: null },
    ]);

    await sync.syncNow();

    expect(await db.db.syncOutbox.count()).toBe(0);
    expect(server.upserts).toHaveLength(0);
  });

  it('keeps the newer local row when the server copy is older', async () => {
    const { server, db, sync } = await setup();
    server.seed('saved_stations', [
      { user_id: USER, id: 'gnlu', updated_at: 1000, deleted_at: 1000 },
    ]);
    await db.toggleSavedStation('gnlu'); // local favourite, now() ≫ 1000
    await sync.syncNow();

    expect(await db.listSavedStationIds()).toEqual(['gnlu']);
  });

  it('takes the server row when it is newer', async () => {
    const { server, db, sync } = await setup();
    await db.setPref('theme', 'light');
    await sync.syncNow();
    server.seed('user_prefs', [
      { user_id: USER, id: 'theme', value: 'dark', updated_at: Date.now() + 10_000, deleted_at: null },
    ]);

    await sync.syncNow();

    expect(await db.getPref('theme')).toBe('dark');
  });

  it('does not clobber a row the rider changed while the pull was in flight', async () => {
    // The real race the pending-outbox guard exists for: the fetch is a network
    // round-trip, and a tap during it produces a local row newer than anything
    // in the response. Applying the response over it would silently discard the
    // rider's action — and it would look like the star "didn't take".
    const server = makeServer();
    vi.resetModules();
    // One-shot: the hook is attached to every table's fetch, and a toggle that
    // fired once per table would just flip the favourite back off.
    let mutate: () => Promise<void> = async () => {};
    let fired = false;
    vi.doMock('./supabase', () => ({
      isSupabaseConfigured: true,
      getSupabase: async () => server.client({ user: { id: USER } }, async () => {
        if (fired) return;
        fired = true;
        await mutate();
      }),
    }));
    const db = await import('../data/db');
    await db.db.delete();
    await db.db.open();
    const sync = await import('./syncEngine');

    // Another device unfavourited it, far in the future so LWW would normally win.
    const future = Date.now() + 10_000;
    server.seed('saved_stations', [
      { user_id: USER, id: 'gnlu', updated_at: future, deleted_at: future },
    ]);
    mutate = () => db.toggleSavedStation('gnlu');

    await sync.syncNow();

    // The rider's tap survives, and stays queued so it reaches the server next
    // drain — where its own timestamp decides the winner.
    expect(await db.listSavedStationIds()).toEqual(['gnlu']);
    expect(await db.db.syncOutbox.count()).toBe(1);
  });
});

describe('guards', () => {
  it('reports signed-out and touches nothing when there is no session', async () => {
    const { server, db, sync } = await setup(null);
    await db.toggleSavedStation('gnlu');

    const status = await sync.syncNow();

    expect(status.state).toBe('signed-out');
    expect(server.upserts).toHaveLength(0);
    // The write stays queued for whenever the rider does sign in.
    expect(await db.db.syncOutbox.count()).toBe(1);
  });

  it('reports disabled when Supabase is not configured', async () => {
    vi.resetModules();
    vi.doMock('./supabase', () => ({ isSupabaseConfigured: false, getSupabase: async () => null }));
    const dbMod = await import('../data/db');
    await dbMod.db.delete();
    await dbMod.db.open();
    const sync = await import('./syncEngine');

    expect((await sync.syncNow()).state).toBe('disabled');
  });

  it('surfaces a push failure as error and keeps the row queued', async () => {
    const server = makeServer();
    vi.resetModules();
    const client = server.client({ user: { id: USER } });
    const brokenFrom = () => ({
      upsert: () => Promise.resolve({ error: { message: 'network down' } }),
      select() { return this; }, eq() { return this; }, gt() { return this; },
      order: () => Promise.resolve({ data: [], error: null }),
    });
    vi.doMock('./supabase', () => ({
      isSupabaseConfigured: true,
      getSupabase: async () => ({ ...client, from: brokenFrom }),
    }));
    const db = await import('../data/db');
    await db.db.delete();
    await db.db.open();
    const sync = await import('./syncEngine');

    await db.toggleSavedStation('gnlu');
    const status = await sync.syncNow();

    expect(status.state).toBe('error');
    expect(status.error).toContain('network down');
    // A failed drain must never drop a write to make progress.
    expect(await db.db.syncOutbox.count()).toBe(1);
    // And the favourite is still there for the rider.
    expect(await db.listSavedStationIds()).toEqual(['gnlu']);
  });

  it('coalesces overlapping calls into one run', async () => {
    const { server, db, sync } = await setup();
    await db.toggleSavedStation('gnlu');

    await Promise.all([sync.syncNow(), sync.syncNow(), sync.syncNow()]);

    // Three concurrent drains would push the same entry three times and race on
    // deleting it.
    expect(server.upserts).toHaveLength(1);
  });
});
