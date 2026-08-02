import {
  enqueueEvent,
  listEventsToDrain,
  dropEvents,
  clearEvents,
  getMeta,
  setMeta,
  getPref,
  META_DEVICE_ID,
  type QueuedEvent,
} from '../data/db';
import { isSupabaseConfigured, getSupabase } from './supabase';
import { PREF_ANALYTICS, readAnalyticsEnabled } from '../data/preferences';

/**
 * Product analytics (PRD §5.8).
 *
 * The shape is `services/syncEngine.ts` turned one way round: queue locally,
 * push, delete what was accepted — no pull, no cursor, no reconcile. The reason
 * it exists at all rather than a hosted SDK is that every hosted SDK fires a
 * beacon and drops it when the network is gone, and this app's riders are
 * underground; the sessions worth measuring are exactly the ones that would
 * never arrive.
 *
 * On the boot path deliberately, and cheap enough to be: this module imports
 * `db.ts` and the *synchronous* half of `supabase.ts`, both of which are already
 * there. It never imports `@supabase/supabase-js` — `getSupabase()` fetches that
 * chunk on demand, and only ever from `drain()`, which runs long after the first
 * frame.
 */

// ─── The allowlist ───────────────────────────────────────────────────────────

/**
 * The event names this app may emit.
 *
 * **This list is mirrored by a `check` constraint in `supabase/analytics.sql`,
 * and `analytics.test.ts` asserts the two agree.** They have to: an event whose
 * name Postgres rejects fails the whole batch it travels in, so one typo here
 * would stop every event on the device from ever draining. The test parses the
 * SQL rather than restating the list, so the assertion can't drift with it.
 *
 * Each name is a question from §7 rather than an interesting-sounding metric —
 * `plan_impossible` and `fare_unavailable` in particular are §7.3 and §7.5
 * failing in the field, which nothing else in the system can report.
 */
export const EVENT_NAMES = [
  'app_open',
  'journey_planned',
  'journey_started',
  'journey_completed',
  'journey_abandoned',
  'plan_impossible',
  'fare_unavailable',
  'place_resolved',
  'station_viewed',
  'language_changed',
  'install_prompted',
  'installed',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * What may travel with an event.
 *
 * Station ids are the bundled 53 — a low-cardinality enum, safe in their own
 * columns. `props` is numbers and enums only. **Never a coordinate, a
 * place-search query, a resolved POI name, or free text of any kind** (§5.8):
 * §7.4's search criterion is recorded as `{ matched: true }` precisely because
 * "GIFT City Club" at 08:30 on a stable device id identifies a person in a way
 * a station pair does not.
 */
export interface EventFields {
  fromStation?: string;
  toStation?: string;
  props?: Record<string, string | number | boolean | null>;
}

// ─── Session and configuration ───────────────────────────────────────────────

/**
 * One id per app launch, in memory only.
 *
 * Deliberately not persisted: it ties the events of a single visit together
 * without contributing anything that outlives it. The cross-session id is
 * `deviceId`, which is persisted, resettable, and stamped at drain time.
 */
const sessionId = newId();

const appVersion = import.meta.env.VITE_APP_VERSION as string | undefined;

/**
 * Whether this build can send events at all.
 *
 * Synchronous, and true only when Supabase is configured — the `events` table
 * lives on that project, so with no backend there is nowhere to drain to and
 * queueing would be a leak with no exit. Mirrors `isSupabaseConfigured`'s own
 * reason for being a plain boolean: callers must be able to ask without
 * dragging in the SDK.
 */
export const isAnalyticsConfigured = isSupabaseConfigured;

/**
 * The rider's opt-out, cached because `track()` is synchronous.
 *
 * Starts enabled and is corrected by {@link hydrateAnalytics} once Dexie is
 * readable. That leaves a window of a few dozen milliseconds on a cold start in
 * which an opted-out rider's events are written locally — so hydration
 * *deletes* the queue when it finds the pref off, and `drain()` re-checks the
 * stored value rather than this cache. Nothing leaves the device on the
 * strength of a stale boolean.
 */
let enabled = true;

/**
 * Read the opt-out into the cache, clearing the queue if it is set.
 *
 * Fire-and-forget from the shell — an IndexedDB read is not something the boot
 * path can wait on (§5.6).
 */
export async function hydrateAnalytics(): Promise<void> {
  enabled = readAnalyticsEnabled(await getPref(PREF_ANALYTICS));
  if (!enabled) await clearEvents();
}

/** Apply a change made in the YOU screen without waiting for the next reload. */
export async function setAnalyticsEnabled(next: boolean): Promise<void> {
  enabled = next;
  if (!next) await clearEvents();
}

// ─── Recording ───────────────────────────────────────────────────────────────

function newId(): string {
  // `randomUUID` needs a secure context; a plain-HTTP LAN test build has none.
  // The id only has to be unique enough to dedupe a replay of the same row, so
  // a fallback is honest here rather than a reason to lose the event.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${rand()}-${rand()}-${rand()}-${rand()}`;
}

/**
 * Record that something happened.
 *
 * **Synchronous and total.** It returns before touching IndexedDB, never
 * rejects, and never throws — a caller must be able to put it on the line after
 * the thing it is measuring without wrapping it, and analytics failing is never
 * a reason for a journey to fail. The write is fired without `await` for the
 * same reason `recordRecentTrip` is in `App.tsx`.
 */
export function track(name: EventName, fields: EventFields = {}): void {
  if (!isAnalyticsConfigured || !enabled) return;
  const event: QueuedEvent = {
    id: newId(),
    sessionId,
    name,
    at: Date.now(),
    fromStation: fields.fromStation,
    toStation: fields.toStation,
    appVersion,
    props: fields.props ?? {},
  };
  void enqueueEvent(event).catch(() => {
    // A queue write that fails (quota, private mode, a closed db during
    // teardown) loses one event. That is the correct trade against surfacing an
    // error for something the rider did not ask for and cannot act on.
  });
}

/**
 * Record the session opening, at most once per app launch.
 *
 * Guarded at module scope rather than with a `useRef`, because the shell runs
 * under `StrictMode` (`main.tsx`) — effects mount, unmount and mount again in
 * development, and every remount would otherwise inflate the denominator that
 * every other event is measured against. Module scope is also exactly the
 * lifetime this event means: one per launch, the same one `sessionId` has.
 */
let appOpenTracked = false;

export function trackAppOpen(): void {
  if (appOpenTracked) return;
  appOpenTracked = true;
  track('app_open');
}

// ─── Draining ────────────────────────────────────────────────────────────────

/** How many events go in one insert. Small enough to stay well under any body limit. */
const BATCH = 100;

/**
 * The device's pseudonymous id, created on first use.
 *
 * Random, never derived from anything, and never joined to `auth.uid()` — the
 * `events` table has no `user_id` at all (§5.8). Reset by "Clear local data".
 */
async function deviceId(): Promise<string> {
  const existing = await getMeta(META_DEVICE_ID);
  if (existing) return existing;
  const created = newId();
  await setMeta(META_DEVICE_ID, created);
  return created;
}

/** Overlapping calls share one run, for the reason `syncNow()` does. */
let inFlight: Promise<void> | null = null;

export function drainEvents(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = drain().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function drain(): Promise<void> {
  if (!isAnalyticsConfigured) return;

  // The stored value, not the cached one: an opt-out made in another tab, or
  // one that synced down from another device, must stop the send even if this
  // tab has not noticed it yet.
  if (!readAnalyticsEnabled(await getPref(PREF_ANALYTICS))) {
    await clearEvents();
    return;
  }

  // Checked before `getSupabase()`, for the reason `syncEngine.run()` checks it
  // there: asking for the SDK chunk with no network is a guaranteed failure
  // that also nulls the memo and makes the next attempt re-fetch. `onLine` is
  // only trustworthy in the negative, so this skips work that is certain to
  // fail and lets everything else fall through to the try/catch.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const queued = await listEventsToDrain(BATCH);
  if (queued.length === 0) return;

  const client = await getSupabase();
  if (!client) return;

  const id = await deviceId();
  const rows = queued.map(e => ({
    id: e.id,
    device_id: id,
    session_id: e.sessionId,
    name: e.name,
    at: e.at,
    from_station: e.fromStation ?? null,
    to_station: e.toStation ?? null,
    app_version: e.appVersion ?? null,
    props: e.props,
  }));

  // `ignoreDuplicates` is `on conflict (id) do nothing` — the replay of an
  // acknowledged-but-unrecorded batch costs a no-op instead of a duplicate row.
  // No `.select()` chained, deliberately: v2 returns nothing by default, and
  // asking for the rows back would need a `select` policy the table does not
  // have and must not be given (§5.8).
  const { error } = await client
    .from('events')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  // Anything unsent stays queued and retries. The exception is a rejection the
  // server will never accept — a name outside the allowlist, a `props` blob
  // over the size cap — which would otherwise block every later event behind it
  // forever. Postgres reports those as a check-constraint violation (23514),
  // and the honest response is to drop the batch rather than poison the queue.
  if (error) {
    if (error.code === '23514') await dropEvents(queued.map(e => e.id));
    return;
  }

  await dropEvents(queued.map(e => e.id));

  // A full batch means there is probably more behind it. Drained on the next
  // trigger rather than looped here, so a device returning from a week offline
  // sends 100 events per wake-up instead of saturating a just-restored
  // connection the rider is trying to plan a journey on.
}

// ─── Triggers ────────────────────────────────────────────────────────────────

/** Periodic drain while the tab is open, for a session that never backgrounds. */
const DRAIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Wire the drains that happen without anyone asking. Returns a teardown.
 *
 * `hidden` is the important one: it is the last moment a mobile browser
 * reliably gives you before the tab is frozen or killed, and for this app it is
 * also the moment a rider puts the phone in a pocket and walks into a station.
 * `visible` is not used as a trigger — the interval and `online` cover coming
 * back, and draining on every tab focus would send a request for nothing.
 */
export function startAnalyticsTriggers(): () => void {
  if (!isAnalyticsConfigured) return () => {};

  const onOnline = () => { void drainEvents(); };
  window.addEventListener('online', onOnline);

  const onHidden = () => {
    if (document.visibilityState === 'hidden') void drainEvents();
  };
  document.addEventListener('visibilitychange', onHidden);

  const timer = setInterval(() => { void drainEvents(); }, DRAIN_INTERVAL_MS);

  // §7.1 installability, actually observed rather than inferred from a
  // DevTools check. `beforeinstallprompt` fires only where the browser judges
  // the app installable, so the two together say how often riders are offered
  // it and how often they take it. Neither listener changes behaviour — in
  // particular this does not call `preventDefault()`, so the browser's own
  // install UI is left exactly as it was.
  const onPrompt = () => { track('install_prompted'); };
  const onInstalled = () => { track('installed'); void drainEvents(); };
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    clearInterval(timer);
  };
}
