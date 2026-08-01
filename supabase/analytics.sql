-- Metrothi — product analytics schema (PRD §5.8)
--
-- Run this once against your Supabase project: Dashboard → SQL Editor → paste →
-- Run. It is idempotent, so re-running it is safe. It is independent of
-- `schema.sql` and can be run before, after, or without it.
--
-- ─── Why this is a separate file ─────────────────────────────────────────────
--
-- `schema.sql` states a rule: a table added there needs `enable row level
-- security` and its four policies in the same commit, or it is world-readable.
-- This table deliberately has ONE policy, and the exception is the whole point
-- (§5.8). Keeping it here means nobody reads the four-policy loop over there and
-- "fixes" this table into a readable one.
--
-- The contract is the inverse of `schema.sql`'s:
--
--   schema.sql   user data     read + write own rows        needs auth.uid()
--   analytics.sql events        write only, read by nobody   has no user_id
--
-- ─── The two things that break this if you change them ───────────────────────
--
--   1. Adding a `select` policy. With RLS on and no select policy, PostgREST
--      returns zero rows to `anon` and `authenticated` alike. That is what makes
--      it safe to ship the anon key with insert rights: the key buys append and
--      nothing else. A select policy turns every rider's queue into every
--      rider's readable history, and nothing will error to tell you.
--   2. Dropping `security_invoker` from the views. A view over an RLS table runs
--      as its OWNER by default, which is `postgres`, which bypasses RLS. A view
--      declared without it hands back exactly the rows the missing select policy
--      was there to withhold. This is (1) again, wearing a different hat.
--
-- Reads happen in the SQL editor or via `service_role` server-side, both of
-- which bypass RLS by design. There is no in-app admin route (§8.2 phase F).

-- ─── events ──────────────────────────────────────────────────────────────────
--
-- Append-only. No tombstone, no `updated_at`, no last-write-wins — none of those
-- mean anything for a fact that already happened, which is why this table is
-- outside `SyncTable` and outside `syncOutbox` on the client (§5.8).
--
--   * `id` is a uuid the CLIENT generates when the event fires, not a server
--     identity column. The local queue is at-least-once, so a batch that was
--     delivered but whose acknowledgement was lost gets replayed; the insert is
--     `on conflict (id) do nothing` and the replay costs a no-op. A server-side
--     identity column would turn every one of those into a duplicate row.
--   * `at` is epoch ms as `bigint` from the browser — same unit and same reason
--     as `schema.sql`'s `updated_at`. `received_at` is the server clock. Both
--     exist because neither is sufficient: `at` is the only one that preserves
--     ordering for events queued underground and drained twenty minutes later,
--     and `received_at` is the only one that is monotonic and safe to build a
--     time series on. Group by `received_at`; order within a device by `at`.
--   * There is NO `user_id`, and it is not an oversight. See §5.8.

create table if not exists public.events (
  id           uuid        not null primary key,
  device_id    uuid        not null,
  session_id   uuid        not null,
  name         text        not null,
  at           bigint      not null,
  received_at  timestamptz not null default now(),
  from_station text,
  to_station   text,
  app_version  text,
  props        jsonb       not null default '{}'::jsonb
);

-- ─── The allowlist ───────────────────────────────────────────────────────────
-- `name` is constrained so that adding an event is a migration someone reads,
-- not a string someone types. An unrecognised name is rejected at insert; the
-- client drops the row rather than retrying it forever (a poisoned queue entry
-- that never drains is worse than a lost event).
--
-- Each name and what it is for:
--   app_open           sessions, and the denominator for everything below
--   journey_planned    the core action. from/to + props{transfers, fareRupees,
--                      rideMins, offline}
--   journey_started    §4.2 state machine entered
--   journey_completed  reached ARRIVED
--   journey_abandoned  props{atState} — where riders drop out of the machine
--   plan_impossible    §7.3. A route the engine could not complete (last train
--                      gone at the transfer). Cannot be caught by tests; this is
--                      the only way it is ever observed.
--   fare_unavailable   §7.5. Distance unresolved, so the app showed nothing
--                      rather than a guess. Should be ~zero; isn't necessarily.
--   place_resolved     §7.4, as props{matched: bool}. NEVER the query text.
--   station_viewed     from_station only
--   language_changed   props{to}
--   install_prompted / installed   §7.1 installability, actually observed

alter table public.events drop constraint if exists events_name_allowlist;
alter table public.events add constraint events_name_allowlist check (
  name in (
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
    'installed'
  )
);

-- ─── Shape limits ────────────────────────────────────────────────────────────
-- The anon key is public and this table accepts inserts from it, so the table
-- itself has to be the thing that refuses junk. Station ids are the bundled 53,
-- so 64 chars is generous; `props` is a small bag of numbers and enums, never
-- free text (§5.8), so 1 KB is generous too. Neither limit is a security
-- boundary — they cap the blast radius of a bug or a bored stranger.

alter table public.events drop constraint if exists events_shape;
alter table public.events add constraint events_shape check (
  length(name)                    <= 64
  and (from_station is null or length(from_station) <= 64)
  and (to_station   is null or length(to_station)   <= 64)
  and (app_version  is null or length(app_version)  <= 32)
  and jsonb_typeof(props) = 'object'
  and length(props::text)         <= 1024
);

-- ─── Indices ─────────────────────────────────────────────────────────────────
-- Every dashboard query is "this event, over this window", and the purge is
-- "everything older than X" — both served by (received_at). The pair index
-- backs the origin→destination rollup, which is the one query that scans a
-- whole event name at once.

create index if not exists events_recent_idx on public.events (received_at desc);
create index if not exists events_name_time_idx on public.events (name, received_at desc);
create index if not exists events_pair_idx on public.events (from_station, to_station)
  where name = 'journey_planned';

-- ─── Row-level security ──────────────────────────────────────────────────────
-- ONE policy. Read the header before adding a second.
--
-- `to anon, authenticated` because the app must work with no account at all —
-- that is the load-bearing invariant (§5.3), and most riders will never sign in.
-- `with check (true)` because there is no `user_id` to compare against: the row
-- is not owned by anyone, which is the point.
--
-- The explicit revokes are belt-and-braces. RLS with no select policy already
-- returns zero rows, but a future `grant` or a policy added by hand has to get
-- past both.

alter table public.events enable row level security;

drop policy if exists events_insert_any on public.events;
create policy events_insert_any on public.events
  for insert to anon, authenticated
  with check (true);

revoke select, update, delete on public.events from anon, authenticated;
grant insert on public.events to anon, authenticated;

-- ─── Rollup views ────────────────────────────────────────────────────────────
-- `security_invoker = true` on every one of them. Without it the view runs as
-- its owner and bypasses the RLS above — see the header. Requires PG15+, which
-- every current Supabase project is on.
--
-- These are also revoked from the client roles: the views exist for the SQL
-- editor and for `service_role`, and a view reachable from the anon key would
-- re-expose in aggregate what the table refuses in detail.

create or replace view public.events_daily
  with (security_invoker = true) as
select
  (received_at at time zone 'Asia/Kolkata')::date as day,
  name,
  count(*)                    as events,
  count(distinct device_id)   as devices
from public.events
group by 1, 2
order by 1 desc, 3 desc;

-- Deliberately has no device_id and no timestamp finer than a date: this is the
-- one view that touches origin→destination pairs, and grouping is what keeps a
-- commute pattern from being a commute log.
create or replace view public.journeys_by_pair
  with (security_invoker = true) as
select
  from_station,
  to_station,
  count(*)                                   as plans,
  round(avg((props->>'rideMins')::numeric), 1) as avg_ride_mins,
  round(avg((props->>'fareRupees')::numeric), 1) as avg_fare
from public.events
where name = 'journey_planned'
  and from_station is not null
  and to_station is not null
group by 1, 2
order by 3 desc;

-- The §7.3 / §7.5 accuracy watch. Both columns should sit at zero. They are the
-- reason this table exists (§5.8) — a non-zero day is a data bug that reached a
-- rider, and nothing else in the system will report it.
create or replace view public.accuracy_watch
  with (security_invoker = true) as
select
  (received_at at time zone 'Asia/Kolkata')::date as day,
  count(*) filter (where name = 'plan_impossible')  as impossible_plans,
  count(*) filter (where name = 'fare_unavailable') as missing_fares,
  count(*) filter (where name = 'journey_planned')  as plans
from public.events
where name in ('plan_impossible', 'fare_unavailable', 'journey_planned')
group by 1
order by 1 desc;

-- Plan → start → complete, by day. `journey_abandoned` carries props{atState},
-- so the drop-out point is a group-by away when a day looks wrong.
create or replace view public.funnel_daily
  with (security_invoker = true) as
select
  (received_at at time zone 'Asia/Kolkata')::date as day,
  count(distinct device_id) filter (where name = 'app_open')          as opened,
  count(distinct device_id) filter (where name = 'journey_planned')   as planned,
  count(distinct device_id) filter (where name = 'journey_started')   as started,
  count(distinct device_id) filter (where name = 'journey_completed') as completed
from public.events
group by 1
order by 1 desc;

revoke select on public.events_daily, public.journeys_by_pair,
                 public.accuracy_watch, public.funnel_daily
  from anon, authenticated;

-- ─── Retention ───────────────────────────────────────────────────────────────
-- 90 days on raw rows. A stable device_id plus origin→destination pairs kept
-- forever is a commute history, and India's DPDP Act treats that as personal
-- data with or without a name attached. The purge is what makes a stable device
-- id defensible rather than merely convenient (§5.8).
--
-- The views above are computed on read, so they lose history at the same rate.
-- If a longer trend is wanted, snapshot `events_daily` into a real table on the
-- same schedule and let THAT be the thing kept — it has no device_id in it.

create or replace function public.purge_old_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.events where received_at < now() - interval '90 days';
$$;

revoke execute on function public.purge_old_events() from anon, authenticated;

-- Scheduling needs the `pg_cron` extension: Dashboard → Database → Extensions →
-- enable `pg_cron`, then run the block below. It is separated because enabling
-- an extension is a project-owner action, and a nightly job that silently never
-- ran is worse than one you know you haven't scheduled.
--
--   select cron.schedule(
--     'purge-old-events', '17 3 * * *', 'select public.purge_old_events()');
--
-- Verify with: select * from cron.job where jobname = 'purge-old-events';

-- ─── Verification ────────────────────────────────────────────────────────────
-- Expect exactly one row: rls_enabled = true, policy_count = 1, and
-- insert_only = true. Any other shape means the client can read this table.
--
-- policy_count = 0 is NOT safe-by-omission here — it would mean the insert
-- policy is missing and the client's drain fails silently against RLS.

select
  c.relname          as table_name,
  c.relrowsecurity   as rls_enabled,
  count(p.policyname) as policy_count,
  bool_and(p.cmd = 'INSERT') as insert_only
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
where n.nspname = 'public' and c.relname = 'events'
group by c.relname, c.relrowsecurity;

-- And that no view leaks past RLS. Expect four rows, all security_invoker = true.

select
  c.relname as view_name,
  coalesce((
    select option_value = 'true'
    from pg_options_to_table(c.reloptions)
    where option_name = 'security_invoker'
  ), false) as security_invoker
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in ('events_daily', 'journeys_by_pair', 'accuracy_watch', 'funnel_daily')
order by 1;
