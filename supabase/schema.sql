-- Metrothi — user data schema (PRD §5.7)
--
-- Run this once against your Supabase project: Dashboard → SQL Editor → paste →
-- Run. It is idempotent, so re-running it is safe.
--
-- Four tables mirroring the Dexie tables in app/src/data/db.ts. Every row is
-- owned by exactly one user and row-level security is the *only* thing that
-- keeps them apart: the client ships the anon key, which is public by design, so
-- any authenticated user could otherwise select every row in these tables.
-- If you add a table here, it needs `enable row level security` and its four
-- policies in the same commit, or it is world-readable.
--
-- Conventions that match the client:
--   * `id` is the client-side primary key (station id, journey key, pref name).
--     Primary key is (user_id, id) so two users can save the same station and
--     an upsert from the client is a plain `on conflict` — no read-then-write.
--   * `updated_at` is epoch milliseconds as `bigint`, NOT `timestamptz`. It is
--     compared against Date.now() from the browser for last-write-wins, and
--     converting on every comparison invites an off-by-1000 that silently makes
--     the wrong side win. Kept as the same unit the client generates.
--   * `deleted_at` is a tombstone. Deletes are never `delete from`, because a
--     missing row can't be told apart from one the client hasn't pulled yet.

-- ─── saved_stations ──────────────────────────────────────────────────────────

create table if not exists public.saved_stations (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  id         text   not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

-- ─── saved_journeys ──────────────────────────────────────────────────────────

create table if not exists public.saved_journeys (
  user_id     uuid   not null references auth.users (id) on delete cascade,
  id          text   not null,
  source_id   text,
  dest_id     text,
  source_name text,
  dest_name   text,
  saved_at    bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint,
  primary key (user_id, id)
);

-- ─── recent_trips ────────────────────────────────────────────────────────────
-- `source`/`dest` are jsonb: a trip endpoint is either a station or a resolved
-- PlaceNode (§4.2), and normalising two shapes into columns would buy nothing —
-- the client round-trips them opaquely and never queries inside them.

create table if not exists public.recent_trips (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  id         text   not null,
  source     jsonb,
  dest       jsonb,
  saved_at   bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

-- ─── user_prefs ──────────────────────────────────────────────────────────────

create table if not exists public.user_prefs (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  id         text   not null,
  value      text   not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

-- ─── Pull indices ────────────────────────────────────────────────────────────
-- Every pull is "my rows changed since cursor", so the index is (user_id,
-- updated_at) in that order.

create index if not exists saved_stations_pull_idx on public.saved_stations (user_id, updated_at);
create index if not exists saved_journeys_pull_idx on public.saved_journeys (user_id, updated_at);
create index if not exists recent_trips_pull_idx   on public.recent_trips   (user_id, updated_at);
create index if not exists user_prefs_pull_idx     on public.user_prefs     (user_id, updated_at);

-- ─── Row-level security ──────────────────────────────────────────────────────
-- `to authenticated` matters: without it these policies are also evaluated for
-- the `anon` role, where auth.uid() is null. That yields no rows today, but it
-- means an accidental `using (true)` later would expose data to unauthenticated
-- callers as well as signed-in ones.
--
-- The `with check` on update is what stops a user reassigning a row to someone
-- else's user_id; `using` alone only governs which rows they may target.

alter table public.saved_stations enable row level security;
alter table public.saved_journeys enable row level security;
alter table public.recent_trips   enable row level security;
alter table public.user_prefs     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['saved_stations', 'saved_journeys', 'recent_trips', 'user_prefs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end
$$;

-- ─── Verification ────────────────────────────────────────────────────────────
-- Expect 4 rows, rls_enabled = true, policy_count = 4 on each. A table showing
-- rls_enabled = false or policy_count < 4 is readable by every signed-in user.

select
  c.relname                as table_name,
  c.relrowsecurity         as rls_enabled,
  count(p.policyname)      as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
where n.nspname = 'public'
  and c.relname in ('saved_stations', 'saved_journeys', 'recent_trips', 'user_prefs')
group by c.relname, c.relrowsecurity
order by c.relname;
