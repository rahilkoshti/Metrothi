import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Read through Vite rather than `node:fs`: the app tsconfig's `types` is
// `["vite/client"]` with no node types, so `readFileSync`/`__dirname` compile
// under vitest but fail `tsc -b` — which is the typecheck gate (CLAUDE.md).
// `?raw` is declared by vite/client and resolves relative to this file.
import analyticsSql from '../../../supabase/analytics.sql?raw';

/**
 * The analytics queue fails the way the sync store does — silently (PRD §5.8).
 *
 * A name the server rejects blocks every event behind it forever. An eviction
 * that drops the newest instead of the oldest quietly keeps the least useful
 * half of the queue. A drain that deletes before the insert succeeds loses
 * exactly the events a rider generated underground, which are the ones this
 * whole design exists to keep. None of those throw.
 */

// Imported per-test: `db.ts` builds its Dexie instance at module load, so a
// clean IndexedDB needs a clean module registry. Same reason as `db.test.ts`.
async function fresh() {
  vi.resetModules();
  const dbMod = await import('../data/db');
  await dbMod.db.delete();
  await dbMod.db.open();
  return dbMod;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('the event allowlist', () => {
  /**
   * The client's names and the Postgres `check` constraint must agree.
   *
   * This is the assertion that earns its keep. `name` is constrained server-side,
   * so a name only the client knows is rejected — and because events are sent in
   * batches, one such name fails the whole batch it travels in and every event
   * queued behind it. The SQL is parsed rather than restated so this can't drift
   * with the thing it is checking.
   */
  it('matches the check constraint in supabase/analytics.sql', async () => {
    const { EVENT_NAMES } = await import('./analytics');

    const clause = /events_name_allowlist check \(\s*name in \(([\s\S]*?)\)\s*\)/.exec(analyticsSql);
    expect(clause, 'could not find the allowlist constraint in analytics.sql').not.toBeNull();

    const fromSql = [...clause![1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    expect(fromSql.length).toBeGreaterThan(0);
    expect([...fromSql].sort()).toEqual([...EVENT_NAMES].sort());
  });

  /**
   * The opposite failure to the one above, and quieter.
   *
   * A name can be allowlisted here and in Postgres and simply never emitted —
   * at which point a dashboard row reads zero and looks like a finding rather
   * than a gap. TypeScript catches a *misspelt* name at a call site, because
   * `track` takes `EventName`; nothing catches a name with no call site at all.
   *
   * The rule is "referenced somewhere other than its own declaration", not
   * "appears in a `track('…')` literal". The stricter version was written first
   * and failed the moment the plan events moved behind `planAnalytics.ts` and
   * started being emitted through a variable — a real refactor it had no
   * business blocking. The looser rule still catches the failure that matters
   * (a name nothing anywhere mentions) and cannot be satisfied by the allowlist
   * alone, which is why the array is cut out of the corpus below.
   */
  it('every allowlisted name is referenced outside the allowlist itself', async () => {
    const { EVENT_NAMES } = await import('./analytics');
    const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

    const code = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .map(([, text]) => text as string)
      .join('\n')
      // Without this the declaration would satisfy the assertion about itself.
      .replace(/export const EVENT_NAMES = \[[\s\S]*?\] as const;/, '');

    const unwired = EVENT_NAMES.filter(name => !code.includes(`'${name}'`));
    expect(unwired, 'allowlisted but never referenced').toEqual([]);
  });
});

describe('track()', () => {
  it('is a synchronous no-op when Supabase is unconfigured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { db } = await fresh();
    const { track, isAnalyticsConfigured } = await import('./analytics');

    expect(isAnalyticsConfigured).toBe(false);
    expect(track('app_open')).toBeUndefined();

    // Nothing queued, and nothing to await — the point is that a build with no
    // backend accumulates no events rather than filling IndexedDB with rows
    // that have nowhere to go.
    await Promise.resolve();
    expect(await db.events.count()).toBe(0);
  });

  it('queues an event without the caller awaiting anything', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db } = await fresh();
    const { track } = await import('./analytics');

    track('journey_planned', {
      fromStation: 'vastral-gam',
      toStation: 'motera',
      props: { transfers: 1, fareRupees: 20 },
    });

    await vi.waitFor(async () => expect(await db.events.count()).toBe(1));
    const [row] = await db.events.toArray();
    expect(row.name).toBe('journey_planned');
    expect(row.fromStation).toBe('vastral-gam');
    expect(row.props).toEqual({ transfers: 1, fareRupees: 20 });
    // The drain stamps the device id; the queued row carries only the session.
    expect(row).not.toHaveProperty('deviceId');
    expect(row.sessionId).toEqual(expect.any(String));
  });

  it('never rejects when the queue write fails', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db } = await fresh();
    const { track } = await import('./analytics');

    // A closed database is the realistic version of this: teardown, private
    // mode, or a quota error mid-session. `track()` sits on the line after the
    // thing it measures and must never take it down.
    db.close();
    expect(() => track('app_open')).not.toThrow();
    await new Promise(r => setTimeout(r, 10));
  });
});

describe('the queue cap', () => {
  it('evicts the oldest events, not the newest', async () => {
    const { db, enqueueEvent, EVENT_QUEUE_LIMIT } = await fresh();

    // Two past the cap, with `at` ascending so "oldest" is unambiguous.
    for (let i = 0; i < EVENT_QUEUE_LIMIT + 2; i++) {
      await enqueueEvent({
        id: `e${String(i).padStart(4, '0')}`,
        sessionId: 's',
        name: 'app_open',
        at: 1_000 + i,
        props: {},
      });
    }

    expect(await db.events.count()).toBe(EVENT_QUEUE_LIMIT);
    const remaining = await db.events.orderBy('at').toArray();
    // The two oldest are gone and the newest survived — the other way round
    // would keep a week-old queue and throw away what just happened.
    expect(remaining[0].id).toBe('e0002');
    expect(remaining[remaining.length - 1].id).toBe(`e${String(EVENT_QUEUE_LIMIT + 1).padStart(4, '0')}`);
  });
});

describe('the drain', () => {
  async function seed(count: number) {
    const mod = await fresh();
    for (let i = 0; i < count; i++) {
      await mod.enqueueEvent({
        id: `e${i}`, sessionId: 's', name: 'app_open', at: 1_000 + i, props: {},
      });
    }
    return mod;
  }

  /** A Supabase stand-in whose `rpc` resolves to whatever the test wants. */
  function stubClient(result: { error: { code?: string } | null }) {
    const rpc = vi.fn().mockResolvedValue(result);
    vi.doMock('./supabase', () => ({
      isSupabaseConfigured: true,
      getSupabase: () =>
        Promise.resolve({
          rpc,
          // Deliberately explodes rather than returning a chainable stub. The
          // dedupe this drain needs (`on conflict do nothing`) is PostgREST's
          // `resolution=ignore-duplicates`, and that mode requires `select` on
          // `events` — which §5.8 forbids, so a direct table write can never
          // both dedupe and stay unreadable. Reverting to `.from('events')`
          // has to fail here, not silently against a live project.
          from: () => {
            throw new Error(
              'analytics must insert through the record_events RPC, not .from("events") — §5.8',
            );
          },
        }),
    }));
    return rpc;
  }

  it('keeps every event when the insert fails, and retries next time', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db } = await seed(3);
    stubClient({ error: { code: '08006' } }); // connection failure
    const { drainEvents } = await import('./analytics');

    await drainEvents();

    // The whole point of the local queue: a failed send is a delay, never a
    // loss. Deleting here would discard exactly the events queued underground.
    expect(await db.events.count()).toBe(3);
  });

  it('drops a batch Postgres will never accept, so it cannot poison the queue', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db } = await seed(3);
    stubClient({ error: { code: '23514' } }); // check-constraint violation
    const { drainEvents } = await import('./analytics');

    await drainEvents();

    // A name outside the allowlist or an oversized `props` is rejected forever.
    // Retrying it would block every later event behind it for the life of the
    // install, which is a worse outcome than losing the batch.
    expect(await db.events.count()).toBe(0);
  });

  it('deletes only what was sent, and stamps a stable device id', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db, getMeta, META_DEVICE_ID } = await seed(2);
    const rpc = stubClient({ error: null });
    const { drainEvents } = await import('./analytics');

    await drainEvents();
    expect(await db.events.count()).toBe(0);

    // `rpc(name, params)` — the rows travel as one jsonb argument, which is what
    // lets the whole batch dedupe inside a `security definer` function instead
    // of needing table privileges out here.
    expect(rpc.mock.calls[0][0]).toBe('record_events');
    const rows = (rpc.mock.calls[0][1] as { rows: Array<Record<string, unknown>> }).rows;
    expect(rows).toHaveLength(2);
    // Snake-cased for Postgres, and carrying a device id the queued row never had.
    expect(rows[0].device_id).toEqual(expect.any(String));
    expect(rows[0].from_station).toBeNull();

    // Persisted, so the id survives a reload rather than fragmenting every
    // session into a separate "device".
    expect(await getMeta(META_DEVICE_ID)).toBe(rows[0].device_id);
  });

  it('sends nothing and clears the queue when the rider has opted out', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { db, setPref } = await seed(3);
    const rpc = stubClient({ error: null });
    const { ANALYTICS_OFF, PREF_ANALYTICS } = await import('../data/preferences');
    await setPref(PREF_ANALYTICS, ANALYTICS_OFF);
    const { drainEvents } = await import('./analytics');

    await drainEvents();

    // Checked against the stored pref rather than the in-memory cache, so an
    // opt-out made in another tab or synced from another device still stops it.
    expect(rpc).not.toHaveBeenCalled();
    expect(await db.events.count()).toBe(0);
  });
});

describe('readAnalyticsEnabled', () => {
  it('treats only an explicit "off" as off', async () => {
    const { readAnalyticsEnabled, ANALYTICS_OFF } = await import('../data/preferences');
    expect(readAnalyticsEnabled(ANALYTICS_OFF)).toBe(false);
    // Unset, and a value from a build that offers more than two states, both
    // stay on: a failed read must not be indistinguishable from a rider's
    // explicit choice.
    expect(readAnalyticsEnabled(null)).toBe(true);
    expect(readAnalyticsEnabled('on')).toBe(true);
    expect(readAnalyticsEnabled('sampled')).toBe(true);
  });
});
