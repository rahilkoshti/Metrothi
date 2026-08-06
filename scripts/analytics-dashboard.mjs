#!/usr/bin/env node
/**
 * Metrothi — analytics-dashboard.mjs
 * ---------------------------------------------------------------------------
 * Reads `public.events` and writes (or serves) one self-contained HTML page you
 * can read without knowing any SQL.
 *
 * Run from the repo root:  node scripts/analytics-dashboard.mjs --serve
 *
 * No dependencies. Node 18+ (uses global fetch).
 *
 * ─── Why this is a local script and not an /admin route ─────────────────────
 *
 * PRD §8.2 phase F declines an in-app admin page, and this does not reverse
 * that. The reason it declines one is specific: a page inside the app reads
 * with the public anon key, so it would need a `select` policy on
 * `public.events` — and §5.8's whole security posture is that no such policy
 * exists, because adding one turns every rider's queue into every rider's
 * readable history for anyone who opens devtools.
 *
 * `analytics.sql`'s own header names the sanctioned way to read: "in the SQL
 * editor or via `service_role` server-side, both of which bypass RLS by
 * design." This is the second one, run from your machine. Nothing is deployed,
 * no policy changes, and there is no URL for anyone else to find.
 *
 * ─── The key ────────────────────────────────────────────────────────────────
 *
 * `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS completely — it can read and write
 * every table, ignoring every policy. Three rules, and CLAUDE.md states the
 * first two as repo law:
 *
 *   1. It must NEVER carry a `VITE_` prefix. Vite inlines those into client JS,
 *      which would publish it to every rider.
 *   2. It must NEVER be committed. The repo-root `.gitignore` already ignores
 *      `.env*`, which is why the file below goes there and not in `app/`.
 *   3. It is not needed to run, build, or deploy the app. Only this script.
 *
 * Put it in a repo-root `.env.local`:
 *
 *   SUPABASE_URL=https://<your-project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<the service_role key>
 *
 * Dashboard → Project Settings → API Keys → `service_role`. The URL is not a
 * secret (it already ships in the client); the key is the whole ballgame.
 *
 * ─── --serve, and why the page cannot just fetch for itself ─────────────────
 *
 * The written file is a SNAPSHOT. It is frozen at the moment it was written and
 * has no way to update itself, which reads as a broken dashboard once the
 * numbers on it are a few days old.
 *
 * The obvious fix — let the page fetch its own data — cannot work, and the
 * reason is the same one that makes this a script in the first place: `events`
 * is readable only by `service_role`, and that key bypasses RLS on every table
 * in the project. A page that holds it is a page that publishes it to anyone
 * who opens devtools or looks in the network tab.
 *
 * `--serve` resolves it the same way the rest of this file does: the key stays
 * in Node. The server binds to 127.0.0.1 only, re-queries on every request, and
 * hands back finished HTML. The browser receives aggregate numbers and never a
 * credential. Refresh and the date ranges are plain links and one `<form
 * method="get">` — there is no script tag on the page and nothing polls.
 *
 * This is not the /admin route §8.2 phase F declines. Nothing is deployed, no
 * policy changes, it is reachable only from this machine, and it stops when you
 * press Ctrl+C.
 *
 * ─── Where the numbers come from ────────────────────────────────────────────
 *
 * Raw `events` rows for the selected window, aggregated here in Node rather
 * than by the four rollup views in `analytics.sql`. Those views are fixed at
 * "group by day, all time"; an arbitrary from–to window is not expressible
 * through them without a new view per question. They remain the right thing for
 * the SQL editor and are left in place.
 *
 * Two timestamps, and they are not interchangeable (`analytics.sql` says the
 * same thing at the table):
 *
 *   received_at  server clock, monotonic. Every window filter and the daily
 *                series use it — it is the only one safe to build a time series
 *                on, because `at` comes from a browser whose clock may be wrong.
 *   at           client clock, when the event actually happened. The 24-hour
 *                chart uses it and must: this app's riders are underground, so
 *                events queue and drain later. An "app opened by hour" chart
 *                built on received_at would be a chart of when riders surfaced.
 *
 * ─── Output ─────────────────────────────────────────────────────────────────
 *
 * Writes `analytics-dashboard.html` at the repo root and opens it. That file is
 * gitignored: it contains rider aggregates, and the whole point of the 90-day
 * purge (§5.8) is that this data does not accumulate anywhere forever.
 *
 * Flags:  --serve         run a local server instead of writing a file, so the
 *                         numbers are live and the date ranges are clickable
 *         --port <n>      port for --serve (default 7799; steps up if taken)
 *         --range <key>   today | 7d | 30d | 365d | all   (default 30d)
 *         --from <date>   custom window start, YYYY-MM-DD (IST), inclusive
 *         --to <date>     custom window end, YYYY-MM-DD (IST), inclusive
 *         --no-open       don't launch a browser
 *         --out <path>    write somewhere else
 *         --probe         check that a RIDER can insert, and exit. The dashboard
 *                         reads with `service_role`, which bypasses grants and
 *                         RLS — so it renders a healthy empty page even when
 *                         every rider's drain is being rejected. Writes nothing.
 * ---------------------------------------------------------------------------
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const STATIONS_JSON = join(REPO_ROOT, 'app/src/data/stations.json');

const argv = process.argv.slice(2);
const flag = name => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const NO_OPEN = argv.includes('--no-open');
const SERVE = argv.includes('--serve');
const OUT = flag('--out') ? resolve(flag('--out')) : join(REPO_ROOT, 'analytics-dashboard.html');
const PORT = (() => {
  const n = Number(flag('--port') ?? 7799);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 7799;
})();

// ─── Credentials ─────────────────────────────────────────────────────────────
// Real env vars win, then a repo-root `.env.local`, then `.env`. `app/.env.local`
// is read for the URL only — that is where `VITE_SUPABASE_URL` already lives,
// and re-typing the project URL in two files is how they drift apart. The key is
// never read from anywhere under `app/`: nothing in that directory should be
// able to hold it, and looking there would suggest otherwise.

/** Minimal dotenv: `KEY=value`, `#` comments, optional surrounding quotes. */
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const rootEnv = { ...parseEnvFile(join(REPO_ROOT, '.env')), ...parseEnvFile(join(REPO_ROOT, '.env.local')) };
const appEnv = { ...parseEnvFile(join(REPO_ROOT, 'app/.env')), ...parseEnvFile(join(REPO_ROOT, 'app/.env.local')) };

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  rootEnv.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  rootEnv.VITE_SUPABASE_URL ||
  appEnv.VITE_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || rootEnv.SUPABASE_SERVICE_ROLE_KEY || '';

// Fail loudly with the fix, the way the other scripts in here do.
if (!SUPABASE_URL || !SERVICE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  // Windows Explorer hides known extensions, so "New > Text Document" renamed to
  // `.env.local` is silently saved as `.env.local.txt` and looks correct in the
  // file list. `.gitignore`'s `.env*` still covers it, so the key is not exposed
  // — it is just never read. Worth naming outright: the contents look fine and
  // the error above would otherwise send you back to re-check a correct file.
  const strays = ['.env.local.txt', '.env.txt', 'env.local', '.env.local.env'].filter(f =>
    existsSync(join(REPO_ROOT, f)),
  );
  if (strays.length) {
    console.error(`
  Found ${strays.map(s => `"${s}"`).join(' and ')} at the repo root, but the file must be
  named exactly  .env.local  with no extension.

  Windows Explorer hides known file extensions, so a file that displays as
  ".env.local" can really be ".env.local.txt". Rename it in PowerShell:

    Rename-Item "${strays[0]}" ".env.local"

  (Your key was never exposed — .gitignore's \`.env*\` matches either name.)
`);
    process.exit(1);
  }

  console.error(`
  Missing ${missing.join(' and ')}.

  Create a file called  .env.local  at the repo root (NOT inside app/) with:

    SUPABASE_URL=https://<your-project-ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=<paste the service_role key>

  Find both under: Supabase Dashboard -> Project Settings -> API Keys.
  Use the key labelled  service_role , not  anon .

  That file is already gitignored. Never prefix the key with VITE_ and never
  commit it -- it bypasses every row-level security policy in the project.
`);
  process.exit(1);
}

if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || rootEnv.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`
  Refusing to run: VITE_SUPABASE_SERVICE_ROLE_KEY is set.

  Vite inlines every VITE_-prefixed variable into the client bundle, so that
  name would publish a key that bypasses all row-level security to every
  visitor. Rename it to SUPABASE_SERVICE_ROLE_KEY, and rotate the key in the
  Supabase dashboard if it was ever built into a deploy.
`);
  process.exit(1);
}

// ─── Probe ───────────────────────────────────────────────────────────────────
//
// `--probe` answers the one question the dashboard cannot: can a RIDER's browser
// actually insert? The dashboard reads with `service_role`, which bypasses both
// RLS and table grants — so it renders a perfectly healthy empty page while every
// rider's drain is being rejected. That is exactly how this went unnoticed once.
//
// It posts with the ANON key (the one the app ships) and a name deliberately
// outside the allowlist, so a working table answers `23514` and stores nothing.
// Nothing is ever written by this check.
//
//   23514  reachable, grants + RLS correct   -> healthy
//   42501  permission denied                 -> the INSERT grant is missing
//   401/404 on the route                     -> table not exposed / key wrong

async function probe() {
  const anon = appEnv.VITE_SUPABASE_ANON_KEY || rootEnv.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anon) {
    console.error('\n  --probe needs VITE_SUPABASE_ANON_KEY (it lives in app/.env.local).\n');
    process.exit(1);
  }
  const zero = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const headers = {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  };
  const probeRow = {
    id: zero(0),
    device_id: zero(1),
    session_id: zero(2),
    name: '__probe_not_in_allowlist__',
    at: Date.now(),
    props: {},
  };

  const call = async (path, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let code = '';
    try { code = JSON.parse(text).code ?? ''; } catch { /* not JSON */ }
    return { status: res.status, code, text };
  };

  // The write path the app actually uses.
  const rpc = await call('rpc/record_events', { rows: [probeRow] });

  if (rpc.code === '23514') {
    // The function is reachable and the allowlist rejected the probe name, so
    // nothing was written. Now confirm the table itself is still shut: a
    // readable `events` is the one failure §5.8 cannot tolerate, and it would
    // not show up anywhere else.
    const readable = await (async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id&limit=1`, { headers });
      return res.ok;
    })();
    if (readable) {
      console.error(`
  SECURITY — riders can READ public.events.

  The queue drains, but the anon key can also read every event back. §5.8's
  whole posture is that it cannot. In the SQL editor:

    revoke all on public.events from anon, authenticated;
`);
      return 1;
    }
    console.log('\n  OK — riders can record events, and cannot read them back. (Nothing written.)\n');
    return 0;
  }

  if (rpc.status === 404 || rpc.code === 'PGRST202') {
    console.error(`
  BROKEN — public.record_events does not exist.

  The client inserts through that function, not the table. Re-run
  supabase/analytics.sql in the SQL editor, then:

    notify pgrst, 'reload schema';
`);
    return 1;
  }

  if (rpc.code === '42501') {
    console.error(`
  BROKEN — permission denied calling record_events.

  Fix in the SQL editor:

    grant execute on function public.record_events(jsonb) to anon, authenticated;
`);
    return 1;
  }

  console.error(`\n  UNEXPECTED — ${rpc.status}\n  ${rpc.text.slice(0, 300)}\n`);
  return 1;
}

if (argv.includes('--probe')) process.exit(await probe());

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function q(path, attempt = 0) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    // Reaching Supabase fails transiently often enough to be worth one retry —
    // a connect timeout otherwise surfaces as a bare `TypeError: fetch failed`
    // stack, which reads as a broken dashboard rather than a slow network.
    // `--serve` needs this more than the one-shot mode does: an unhandled
    // rejection there would take the server down mid-session.
    if (attempt === 0) return q(path, 1);
    const code = err?.cause?.code ?? err?.message ?? 'unknown';
    // The hint has to match the code or it sends you to check the wrong thing:
    // ENOTFOUND is DNS never resolving the host, which is a different fault from
    // a host that resolves and then refuses or hangs.
    const hint =
      code === 'ENOTFOUND'
        ? '  The hostname did not resolve. Check the connection and that SUPABASE_URL is spelt right.'
        : code === 'ECONNREFUSED'
          ? '  The host refused the connection. Check SUPABASE_URL points at the project and not a stale port.'
          : '  The host resolved but did not answer in time. Check the connection, or that the\n' +
            '  project is not paused in the Supabase dashboard.';
    throw new Error(`GET ${path} -> could not reach ${SUPABASE_URL}\n  ${code}\n${hint}`);
  }
  const body = await res.text();
  if (!res.ok) {
    // 404 on `events` means analytics.sql was never run against this project;
    // 401 means the key is the anon one. Both are worth saying outright rather
    // than surfacing as "undefined is not a function" three frames later.
    const hint =
      res.status === 404
        ? '\n  That table does not exist. Run supabase/analytics.sql in the SQL editor first.'
        : res.status === 401 || res.status === 403
          ? '\n  The key was rejected. Check you copied service_role and not anon.'
          : '';
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}\n  ${body}${hint}`);
  }
  return JSON.parse(body);
}

/** PostgREST caps a response at 1000 rows, so anything real needs paging. */
const PAGE = 1000;
/** A backstop, not a product decision — 90-day retention keeps the real number
 *  far below this. If it ever trips, the page says so rather than quietly
 *  charting a subset (see `truncated` in the header). */
const MAX_ROWS = 200_000;

const COLUMNS = 'device_id,session_id,name,at,received_at,from_station,to_station,props';

/**
 * Every event in the window, oldest first.
 *
 * Filtered on `received_at` — see the header. `at` would let a device with a
 * wrong clock drop rows out of every window, or park them all in one.
 */
async function loadEvents({ startMs, endMs }) {
  const filters = [`select=${COLUMNS}`, 'order=received_at.asc'];
  if (startMs != null) filters.push(`received_at=gte.${new Date(startMs).toISOString()}`);
  if (endMs != null) filters.push(`received_at=lt.${new Date(endMs).toISOString()}`);

  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await q(`events?${filters.join('&')}&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE || rows.length >= MAX_ROWS) {
      return { rows, truncated: rows.length >= MAX_ROWS && page.length === PAGE };
    }
  }
}

// ─── Time, in IST ────────────────────────────────────────────────────────────
//
// India has one timezone and no DST, so a fixed offset is exact rather than an
// approximation — which is why this needs no library. Every date on this page is
// IST, matching the `at time zone 'Asia/Kolkata'` the views in analytics.sql use.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = n => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for the IST day an instant falls in. */
function istDayKey(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Hour 0–23 of the IST day an instant falls in. */
function istHour(ms) {
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

/** UTC instant of IST midnight starting the day `YYYY-MM-DD`. */
function istMidnightMs(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
}

const RANGES = {
  today: { label: 'Today', days: 1 },
  '7d': { label: 'Last week', days: 7 },
  '30d': { label: 'Last month', days: 30 },
  '365d': { label: 'Last year', days: 365 },
  all: { label: 'All time', days: null },
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn `?range=`/`?from=`/`?to=` into an absolute window.
 *
 * `to` is inclusive of its whole day — a rider picking 1st to 1st means that
 * day, not a zero-width window — so the end is midnight of the day *after*.
 */
function resolveWindow({ range, from, to }, nowMs) {
  const todayKey = istDayKey(nowMs);

  if (ISO_DAY.test(from ?? '') || ISO_DAY.test(to ?? '')) {
    const startKey = ISO_DAY.test(from ?? '') ? from : null;
    const endKey = ISO_DAY.test(to ?? '') ? to : todayKey;
    // Backwards input is a slip, not an error page. Swapping is what the rider
    // meant and an empty dashboard is not.
    const [a, b] = startKey && startKey > endKey ? [endKey, startKey] : [startKey, endKey];
    return {
      key: 'custom',
      label: a ? `${a} to ${b}` : `Up to ${b}`,
      from: a,
      to: b,
      startMs: a ? istMidnightMs(a) : null,
      endMs: istMidnightMs(b) + DAY_MS,
    };
  }

  const key = RANGES[range] ? range : '30d';
  const spec = RANGES[key];
  if (spec.days == null) return { key, label: spec.label, startMs: null, endMs: null };

  // Whole IST days, counting today as one of them: "last week" is today plus the
  // six before it, not a rolling 168 hours. A rolling window makes "today" a
  // partial day that silently shrinks the comparison every hour.
  const startMs = istMidnightMs(todayKey) - (spec.days - 1) * DAY_MS;
  return { key, label: spec.label, startMs, endMs: null };
}

// ─── Stations ────────────────────────────────────────────────────────────────

const STATIONS = JSON.parse(readFileSync(STATIONS_JSON, 'utf8')).stations;
const STATION_BY_ID = new Map(STATIONS.map(s => [s.id, s]));
/** Unknown ids are shown raw rather than hidden — a station id the app emits but
 *  stations.json doesn't have is a real bug and should be visible, not blank. */
const stationName = id => STATION_BY_ID.get(id)?.name ?? id ?? '—';

// Signage hex, mirrored from `app/src/features/journey/constants.ts`. Copied
// rather than imported for the reason that file is exempt from the design-token
// check: these map to physical GMRC signage and are fixed across themes. This
// page is plain HTML with no build step and cannot import a `.ts` module.
const LINE_COLOR = { blue: '#3B82F6', red: '#EF4444', yellow: '#EAB308', violet: '#A855F7' };

// ─── Formatting helpers ──────────────────────────────────────────────────────

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const num = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN'));
const pct = (a, b) => (!b ? '—' : `${Math.round((a / b) * 100)}%`);

const EVENT_LABEL = {
  app_open: 'App opened',
  journey_planned: 'Journey planned',
  journey_started: 'Journey started',
  journey_completed: 'Journey completed',
  journey_abandoned: 'Journey abandoned',
  plan_impossible: 'Plan impossible',
  fare_unavailable: 'Fare unavailable',
  place_resolved: 'Place searched',
  station_viewed: 'Station viewed',
  language_changed: 'Language changed',
  install_prompted: 'Install offered',
  installed: 'Installed',
  signed_in: 'Signed in',
  nearby_resolved: 'Nearby station resolved',
  train_viewed: 'Train schedule viewed',
  topic_viewed: 'Reference topic viewed',
};
const label = n => EVENT_LABEL[n] ?? n;

const LANGUAGE_LABEL = { en: 'English', hi: 'हिन्दी Hindi', gu: 'ગુજરાતી Gujarati' };

/** `/you/:topic` slugs, from `app/src/features/info/catalog.ts`. */
const TOPIC_LABEL = {
  fares: 'Fares & tickets',
  conduct: 'Conduct',
  prohibited: 'Prohibited items',
  facilities: 'Station facilities',
  safety: 'Safety',
  contact: 'Contact GMRC',
  'lost-and-found': 'Lost & found',
  links: 'Official links',
};

function table(headers, rows, empty) {
  if (!rows.length) return `<p class="empty">${esc(empty)}</p>`;
  return `<div class="scroll"><table>
    <thead><tr>${headers.map(h => `<th${h.right ? ' class="r"' : ''}>${esc(h.label ?? h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        r =>
          `<tr>${r
            .map(c => `<td${c && c.right ? ' class="r"' : ''}>${c && c.html ? c.html : esc(c && c.v !== undefined ? c.v : c)}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody>
  </table></div>`;
}

/** Pure-CSS bars. No script tag: this page is also opened from the filesystem. */
function barChart(points, { accent = 'var(--accent)' } = {}) {
  if (!points.length) return `<p class="empty">Nothing recorded yet.</p>`;
  const max = Math.max(...points.map(p => p.value), 1);
  return `<div class="chart">${points
    .map(
      p => `<div class="bar" title="${esc(p.label)}: ${num(p.value)}">
        <div class="fill" style="height:${Math.max((p.value / max) * 100, p.value > 0 ? 2 : 0)}%;background:${accent}"></div>
        <span class="tick">${esc(p.tick)}</span>
      </div>`,
    )
    .join('')}</div>`;
}

/** Horizontal ranked bars — for anything where the label matters more than the
 *  shape of a series, which is most of the "most X" panels below. */
function rankedBars(rows, empty) {
  if (!rows.length) return `<p class="empty">${esc(empty)}</p>`;
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="ranked">${rows
    .map(
      r => `<div class="rrow">
        <div class="rname" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="rtrack"><div class="rfill" style="width:${Math.max((r.value / max) * 100, 1.5)}%;background:${r.color ?? 'var(--accent)'}"></div></div>
        <div class="rval">${num(r.value)}${r.suffix ? `<span class="rsub"> ${esc(r.suffix)}</span>` : ''}</div>
      </div>`,
    )
    .join('')}</div>`;
}

// ─── The station map ─────────────────────────────────────────────────────────
//
// This is the "location count of users, area-wise within Ahmedabad" panel, and
// what it plots is STATION activity — not device coordinates. §5.8 forbids
// sending a coordinate at all (`analytics.ts`: "never a coordinate, a
// place-search query, a resolved POI name, or free text of any kind"), and the
// 90-day purge is justified in `analytics.sql` against exactly the risk that a
// stable device id plus locations becomes a commute history.
//
// So the geography here is the network's, joined to counts the app already
// records: the lat/lng comes from the bundled `stations.json`, and the weight
// from `from_station` / `to_station`. At 53 points across the city that answers
// "which areas are riders in" without collecting anything new.

function stationMap(weights) {
  const pts = STATIONS.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!pts.length) return `<p class="empty">No station coordinates available.</p>`;

  const lats = pts.map(s => s.lat);
  const lngs = pts.map(s => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // A degree of longitude is shorter than a degree of latitude by cos(lat), and
  // at 23°N that is a 92% squeeze. Without it the network leans noticeably —
  // Ahmedabad's lines are long north–south, which is the axis that would stretch.
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * cosLat;
  const spanY = maxLat - minLat;

  const PADDING = 34;
  const W = 700;
  const H = Math.round(((W - PADDING * 2) * spanY) / spanX) + PADDING * 2;

  const px = s => PADDING + ((s.lng - minLng) * cosLat * (W - PADDING * 2)) / spanX;
  const py = s => PADDING + ((maxLat - s.lat) * (H - PADDING * 2)) / spanY;

  // One polyline per line, stations in running order. Interchanges belong to two
  // lines and carry `secondLine`/`secondLineOrder` for the other one, so each
  // line has to ask for its own order rather than read `order` blindly — without
  // that an interchange lands at the wrong index and the line doubles back.
  const paths = Object.keys(LINE_COLOR)
    .map(line => {
      const on = pts
        .map(s =>
          s.line === line
            ? { s, order: s.order }
            : s.secondLine === line
              ? { s, order: s.secondLineOrder }
              : null,
        )
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
      if (on.length < 2) return '';
      const d = on.map(({ s }) => `${px(s).toFixed(1)},${py(s).toFixed(1)}`).join(' ');
      return `<polyline points="${d}" fill="none" stroke="${LINE_COLOR[line]}" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>`;
    })
    .join('');

  const max = Math.max(...pts.map(s => weights.get(s.id) ?? 0), 1);
  const dots = pts
    .map(s => {
      const v = weights.get(s.id) ?? 0;
      // Area, not radius, scales with the count — a radius-linear bubble reads
      // as roughly the square of what it represents.
      const r = v > 0 ? 3.5 + 15 * Math.sqrt(v / max) : 2.4;
      const colour = LINE_COLOR[s.line] ?? '#71717a';
      return `<g><circle cx="${px(s).toFixed(1)}" cy="${py(s).toFixed(1)}" r="${r.toFixed(1)}"
        fill="${colour}" fill-opacity="${v > 0 ? 0.42 : 0.9}" stroke="${colour}"
        stroke-width="${v > 0 ? 1.6 : 0}"/><title>${esc(s.name)}: ${num(v)}</title></g>`;
    })
    .join('');

  // The busiest few get a name. All 53 would be unreadable at this size, and the
  // rest are one hover away.
  const named = [...pts]
    .filter(s => (weights.get(s.id) ?? 0) > 0)
    .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0))
    .slice(0, 6)
    .map(s => {
      const x = px(s), y = py(s);
      const flip = x > W * 0.72;
      return `<text x="${(flip ? x - 12 : x + 12).toFixed(1)}" y="${(y + 4).toFixed(1)}"
        text-anchor="${flip ? 'end' : 'start'}" class="maplabel">${esc(s.name)}</text>`;
    })
    .join('');

  return `<div class="scroll"><svg viewBox="0 0 ${W} ${H}" class="map" role="img"
    aria-label="Ahmedabad metro network with station activity">${paths}${dots}${named}</svg></div>`;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

const inc = (map, k, by = 1) => map.set(k, (map.get(k) ?? 0) + by);
const topN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

/** Everything the page needs, in one pass over the window's rows. */
function aggregate(rows, win, nowMs) {
  const byName = new Map();
  const devices = new Set();
  const sessions = new Set();
  const devicesByName = new Map(); // name -> Set(device)
  const perDay = new Map();
  const openHours = new Array(24).fill(0);
  const abandonState = new Map();
  const pairs = new Map(); // "from>to" -> {plans, rideSum, rideN, fareSum, fareN}
  const stationViews = new Map();
  const nearby = new Map();
  const trains = new Map(); // "station|line|hour" -> count
  const topics = new Map();
  const languages = new Map();
  const stationWeight = new Map(); // for the map: every station touch
  const queryLengths = [];
  let searchMatched = 0, searchFailed = 0, searchTotal = 0;

  for (const r of rows) {
    const name = r.name;
    const props = r.props ?? {};
    inc(byName, name);
    if (r.device_id) devices.add(r.device_id);
    if (r.session_id) sessions.add(r.session_id);
    if (!devicesByName.has(name)) devicesByName.set(name, new Set());
    if (r.device_id) devicesByName.get(name).add(r.device_id);

    const recvMs = Date.parse(r.received_at);
    if (Number.isFinite(recvMs)) inc(perDay, istDayKey(recvMs));

    // Every station an event touches, for the map's weights.
    if (r.from_station) inc(stationWeight, r.from_station);
    if (r.to_station) inc(stationWeight, r.to_station);

    switch (name) {
      case 'app_open': {
        // `at`, not `received_at` — see the header. A rider who plans a trip on
        // a platform at 08:40 and surfaces at 09:10 belongs in the 8 o'clock bar.
        const atMs = Number(r.at);
        if (Number.isFinite(atMs) && atMs > 0) openHours[istHour(atMs)] += 1;
        break;
      }
      case 'journey_planned': {
        if (r.from_station && r.to_station) {
          const k = `${r.from_station} ${r.to_station}`;
          const cur = pairs.get(k) ?? { plans: 0, rideSum: 0, rideN: 0, fareSum: 0, fareN: 0 };
          cur.plans += 1;
          const ride = Number(props.rideMins);
          if (Number.isFinite(ride)) { cur.rideSum += ride; cur.rideN += 1; }
          const fare = Number(props.fareRupees);
          if (Number.isFinite(fare)) { cur.fareSum += fare; cur.fareN += 1; }
          pairs.set(k, cur);
        }
        break;
      }
      case 'journey_abandoned':
        inc(abandonState, String(props.atState ?? 'unknown'));
        break;
      case 'station_viewed':
        if (r.from_station) inc(stationViews, r.from_station);
        break;
      case 'nearby_resolved':
        if (r.from_station) inc(nearby, r.from_station);
        break;
      case 'train_viewed':
        inc(trains, `${r.from_station ?? '—'} ${props.line ?? '—'} ${props.hour ?? '—'}`);
        break;
      case 'topic_viewed':
        inc(topics, String(props.topic ?? 'unknown'));
        break;
      case 'language_changed':
        inc(languages, String(props.to ?? 'unknown'));
        break;
      case 'place_resolved': {
        searchTotal += 1;
        if (props.matched) searchMatched += 1;
        else searchFailed += 1;
        const len = Number(props.queryLength);
        if (Number.isFinite(len) && len > 0) queryLengths.push(len);
        break;
      }
      default:
        break;
    }
  }

  const count = n => byName.get(n) ?? 0;
  const deviceCount = n => devicesByName.get(n)?.size ?? 0;

  // The daily series covers every day in the window that has data. An all-time
  // window with a two-week gap should show the gap, so days are filled in
  // between the first and last observed rather than only where rows exist.
  const dayKeys = [...perDay.keys()].sort();
  const series = [];
  if (dayKeys.length) {
    const first = istMidnightMs(dayKeys[0]);
    const last = istMidnightMs(dayKeys[dayKeys.length - 1]);
    for (let t = first; t <= last; t += DAY_MS) {
      const k = istDayKey(t);
      series.push({ label: k, value: perDay.get(k) ?? 0, tick: k.slice(5) });
    }
  }

  return {
    win,
    nowMs,
    rowCount: rows.length,
    byName,
    namesSorted: [...byName.entries()].sort((a, b) => b[1] - a[1]),
    deviceCountByName: new Map([...devicesByName].map(([n, set]) => [n, set.size])),
    totalEvents: rows.length,
    totalUsers: devices.size,
    totalSessions: sessions.size,
    signIns: count('signed_in'),
    signInDevices: deviceCount('signed_in'),
    funnel: {
      opened: deviceCount('app_open'),
      planned: deviceCount('journey_planned'),
      started: deviceCount('journey_started'),
      completed: deviceCount('journey_completed'),
    },
    journeys: {
      planned: count('journey_planned'),
      started: count('journey_started'),
      completed: count('journey_completed'),
      abandoned: count('journey_abandoned'),
    },
    problems: count('plan_impossible') + count('fare_unavailable'),
    impossible: count('plan_impossible'),
    missingFares: count('fare_unavailable'),
    installs: count('installed'),
    installPrompts: count('install_prompted'),
    series: series.slice(-90),
    openHours,
    abandonState: [...abandonState.entries()].sort((a, b) => b[1] - a[1]),
    pairs: [...pairs.entries()]
      .sort((a, b) => b[1].plans - a[1].plans)
      .slice(0, 20)
      .map(([k, v]) => {
        const [from, to] = k.split(' ');
        return {
          from, to,
          plans: v.plans,
          avgRide: v.rideN ? v.rideSum / v.rideN : null,
          avgFare: v.fareN ? v.fareSum / v.fareN : null,
        };
      }),
    stationViews: topN(stationViews, 12),
    nearby: topN(nearby, 12),
    trains: topN(trains, 12).map(([k, v]) => {
      const [station, line, hour] = k.split(' ');
      return { station, line, hour, count: v };
    }),
    topics: topN(topics, 10),
    languages: [...languages.entries()].sort((a, b) => b[1] - a[1]),
    stationWeight,
    search: {
      total: searchTotal,
      matched: searchMatched,
      failed: searchFailed,
      medianLength: queryLengths.length
        ? [...queryLengths].sort((a, b) => a - b)[Math.floor(queryLengths.length / 2)]
        : null,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * `live` is true only when this page is being served over http by `--serve`.
 * It gates the Refresh link and the range controls, and the gate is not
 * cosmetic: on a `file://` page those are links to a server that isn't there.
 */
function buildHtml(a, { live = false } = {}) {
  const generated = new Date(a.nowMs).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const healthy = a.problems === 0;
  const f = a.funnel;

  const rangeLinks = Object.entries(RANGES)
    .map(
      ([key, spec]) =>
        `<a class="rangebtn${a.win.key === key ? ' on' : ''}" href="/?range=${key}">${esc(spec.label)}</a>`,
    )
    .join('');

  // Retention is 90 days (§5.8), so "last year" cannot mean a year. Saying so
  // where the button is, rather than letting an honest-looking 90-day number sit
  // under a label that claims 365.
  const retentionWarning =
    a.win.key === '365d' || (a.win.key === 'custom' && a.win.from && a.win.from < istDayKey(a.nowMs - 90 * DAY_MS));

  const searchNote = `Query text is deliberately not recorded (§5.8) — <code>place_resolved</code> carries
    <code>{matched, queryLength}</code> and nothing else, because "GIFT City Club at 08:30" on a stable
    device id identifies a person in a way a station pair does not. What follows is whether search
    <em>worked</em>; the "most searched station" question is answered by the two panels above it.`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Metrothi analytics</title>
<style>
  :root{--bg:#f4f4f5;--card:#fff;--text:#18181b;--muted:#71717a;--line:#e4e4e7;
        --accent:#f97316;--ok:#16a34a;--bad:#dc2626;--okbg:#f0fdf4;--badbg:#fef2f2;
        --info:#0ea5e9}
  @media (prefers-color-scheme:dark){
    :root{--bg:#0f0f0f;--card:#18181b;--text:#fafafa;--muted:#a1a1aa;--line:#27272a;
          --okbg:#052e16;--badbg:#450a0a}
  }
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px 64px;background:var(--bg);color:var(--text);
       font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:980px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
  h2{font-size:17px;margin:0 0 14px;letter-spacing:-.01em}
  h3{font-size:13px;margin:18px 0 10px;color:var(--muted);font-weight:600;
     text-transform:uppercase;letter-spacing:.06em}
  .sub{color:var(--muted);font-size:13px;margin:0 0 20px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;
        padding:20px;margin-bottom:18px}
  .top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
  .refresh{flex:none;display:inline-block;font-size:13.5px;color:var(--text);background:var(--card);
    border:1px solid var(--line);border-radius:10px;padding:10px 17px;cursor:pointer;
    text-decoration:none;line-height:1}
  .refresh:hover{border-color:var(--accent);color:var(--accent)}
  .ranges{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:18px}
  .rangebtn{font-size:13.5px;text-decoration:none;color:var(--text);background:var(--card);
    border:1px solid var(--line);border-radius:999px;padding:8px 15px;line-height:1}
  .rangebtn:hover{border-color:var(--accent)}
  .rangebtn.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
  .custom{display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap}
  .custom input{font:inherit;font-size:13px;color:var(--text);background:var(--card);
    border:1px solid var(--line);border-radius:9px;padding:7px 10px}
  .custom button{font:inherit;font-size:13px;background:var(--card);color:var(--text);
    border:1px solid var(--line);border-radius:9px;padding:8px 14px;cursor:pointer}
  .custom button:hover{border-color:var(--accent);color:var(--accent)}
  .custom label{font-size:12.5px;color:var(--muted)}
  .banner{display:flex;gap:14px;align-items:flex-start;border-radius:14px;padding:18px 20px;
          margin-bottom:18px;border:1px solid var(--line)}
  .banner.ok{background:var(--okbg);border-color:var(--ok)}
  .banner.bad{background:var(--badbg);border-color:var(--bad)}
  .banner .dot{width:11px;height:11px;border-radius:50%;margin-top:6px;flex:none}
  .banner.ok .dot{background:var(--ok)} .banner.bad .dot{background:var(--bad)}
  .banner b{display:block;font-size:16px;margin-bottom:2px}
  .banner p{margin:0;color:var(--muted);font-size:13.5px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .kpi .n{font-size:27px;font-weight:600;letter-spacing:-.02em}
  .kpi .l{color:var(--muted);font-size:12.5px;margin-top:2px}
  .kpi .x{color:var(--muted);font-size:11.5px;margin-top:5px}
  .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--muted);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  tbody tr:last-child td{border-bottom:0}
  td.r,th.r{text-align:right}
  .scroll{overflow-x:auto}
  .empty{color:var(--muted);font-size:14px;margin:0;padding:8px 0}
  .chart{display:flex;align-items:flex-end;gap:4px;height:150px;padding-top:8px}
  .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
       height:100%;min-width:8px}
  .fill{width:100%;background:var(--accent);border-radius:3px 3px 0 0;min-height:2px}
  .tick{font-size:9px;color:var(--muted);margin-top:5px;white-space:nowrap}
  .fstep{display:flex;align-items:center;gap:12px;margin-bottom:9px}
  .fstep .name{width:100px;font-size:13.5px;flex:none}
  .fstep .track{flex:1;background:var(--bg);border-radius:6px;height:26px;overflow:hidden}
  .fstep .fillx{height:100%;background:var(--accent);border-radius:6px}
  .fstep .val{width:110px;text-align:right;font-size:13px;color:var(--muted);flex:none}
  .ranked .rrow{display:flex;align-items:center;gap:10px;margin-bottom:7px}
  .ranked .rname{width:170px;flex:none;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ranked .rtrack{flex:1;background:var(--bg);border-radius:5px;height:19px;overflow:hidden}
  .ranked .rfill{height:100%;border-radius:5px}
  .ranked .rval{width:96px;text-align:right;font-size:12.5px;color:var(--muted);flex:none}
  .ranked .rsub{font-size:11px;opacity:.8}
  /* Sized from its height, not its width. Ahmedabad's network is roughly 1.5x
     taller than it is wide, so a full-bleed map is over 1300px tall on a desktop
     and pushes every other panel below the fold. Fixing the height and letting
     the SVG's default preserveAspectRatio centre it keeps the geography honest
     and the page readable. (No backticks in here: this whole page is one JS
     template literal, and a stray one ends it mid-stylesheet.) */
  .map{display:block;margin:0 auto;height:600px;width:auto;max-width:100%}
  .maplabel{font-size:10.5px;fill:var(--muted);font-family:inherit}
  .note{color:var(--muted);font-size:12.5px;margin:12px 0 0;line-height:1.5}
  .warn{border-left:3px solid var(--accent);padding-left:12px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;
       background:var(--bg);padding:1px 5px;border-radius:5px}
  a{color:var(--accent)}
</style></head><body><div class="wrap">

<div class="top">
  <div>
    <h1>Metrothi analytics</h1>
    <p class="sub">${live ? 'Read live from Supabase' : 'Generated'} ${esc(generated)} IST
       · <b>${esc(a.win.label)}</b> · ${num(a.totalEvents)} events
       · raw rows are purged after 90 days (PRD §5.8)</p>
  </div>
  ${
    // A link, not a fetch: GET / re-runs the query server-side and returns a
    // whole new page, so there is still no script tag here and nothing polls.
    live ? `<a class="refresh" href="/?range=${esc(a.win.key)}">Refresh</a>` : ''
  }
</div>

${
  live
    ? `<div class="ranges">
        ${rangeLinks}
        <form class="custom" method="get" action="/">
          <label for="from">From</label>
          <input type="date" id="from" name="from" value="${esc(a.win.from ?? '')}">
          <label for="to">To</label>
          <input type="date" id="to" name="to" value="${esc(a.win.to ?? '')}">
          <button type="submit">Apply</button>
        </form>
      </div>`
    : ''
}

${
  retentionWarning
    ? `<div class="card"><p class="note warn" style="margin:0"><b>This window is longer than the data can be.</b>
       Raw rows are deleted after 90 days by <code>purge_old_events()</code> (§5.8), so anything
       before ${esc(istDayKey(a.nowMs - 90 * DAY_MS))} does not exist to be counted. The numbers below are
       real; the window label is aspirational. For a longer trend, snapshot <code>events_daily</code>
       into a table on the same schedule — it has no device id in it.</p></div>`
    : ''
}

${
  a.truncated
    ? `<div class="card"><p class="note warn" style="margin:0"><b>Row cap reached.</b> Only the first
       ${num(MAX_ROWS)} events in this window were read, so every number below is a floor, not a total.
       Narrow the date range.</p></div>`
    : ''
}

<div class="banner ${healthy ? 'ok' : 'bad'}">
  <div class="dot"></div>
  <div>
    <b>${healthy ? 'No accuracy problems recorded' : `${num(a.problems)} accuracy problem${a.problems === 1 ? '' : 's'} recorded`}</b>
    <p>${
      healthy
        ? 'No rider has been shown an impossible route or a missing fare in this window. This is the number that matters most — nothing else in the system reports it.'
        : `${num(a.impossible)} impossible route${a.impossible === 1 ? '' : 's'} and ${num(a.missingFares)} missing fare${a.missingFares === 1 ? '' : 's'} reached real riders. These are data bugs, not usage numbers.`
    }</p>
  </div>
</div>

<div class="kpis">
  <div class="kpi"><div class="n">${num(a.totalUsers)}</div><div class="l">Total users</div>
    <div class="x">Distinct devices. A device, not a person — the id is resettable and there is no account behind it.</div></div>
  <div class="kpi"><div class="n">${num(a.signIns)}</div><div class="l">Sign-ins</div>
    <div class="x">${num(a.signInDevices)} device${a.signInDevices === 1 ? '' : 's'}. Session restores are not counted.</div></div>
  <div class="kpi"><div class="n">${num(a.journeys.planned)}</div><div class="l">Journeys planned</div></div>
  <div class="kpi"><div class="n">${num(a.journeys.started)}</div><div class="l">Journeys started</div></div>
  <div class="kpi"><div class="n">${num(a.journeys.completed)}</div><div class="l">Journeys finished</div></div>
  <div class="kpi"><div class="n">${num(a.totalSessions)}</div><div class="l">Sessions</div>
    <div class="x">One per app launch.</div></div>
</div>

<div class="card">
  <h2>Where riders are, by station</h2>
  ${stationMap(a.stationWeight)}
  <p class="note"><b>Station-level, not GPS.</b> The app never sends a coordinate (§5.8), so this plots
     the stations riders planned from, travelled to, viewed and were placed nearest to — joined to the
     network geography in <code>stations.json</code>. Bubble area is that station's share of all station
     activity in this window; colour is its line. Hover any dot for the count.</p>
</div>

<div class="cols">
  <div class="card">
    <h2>Rider funnel</h2>
    ${[
      ['Opened', f.opened],
      ['Planned', f.planned],
      ['Started', f.started],
      ['Finished', f.completed],
    ]
      .map(
        ([name, v]) => `<div class="fstep">
          <div class="name">${esc(name)}</div>
          <div class="track"><div class="fillx" style="width:${f.opened ? Math.max((v / f.opened) * 100, v > 0 ? 1.5 : 0) : 0}%"></div></div>
          <div class="val">${num(v)} · ${pct(v, f.opened)}</div>
        </div>`,
      )
      .join('')}
    <p class="note">Distinct devices at each stage in this window. Read it as relative drop-off, not
       as a headcount of people.</p>
  </div>

  <div class="card">
    <h2>Where riders drop out</h2>
    ${rankedBars(
      a.abandonState.map(([state, v]) => ({ label: state, value: v, color: 'var(--bad)' })),
      'No journey was abandoned in this window.',
    )}
    <p class="note">The §4.2 state a live journey was in when the rider left it, from
       <code>journey_abandoned.props.atState</code>. <b>Which</b> state, not how long in — elapsed time
       is not recorded on the event, so "on average when" can only be answered as a stage today.</p>
  </div>
</div>

<div class="card">
  <h2>When the app is opened</h2>
  ${barChart(
    a.openHours.map((value, h) => ({ label: `${pad(h)}:00 IST`, value, tick: h % 3 === 0 ? pad(h) : '' })),
    { accent: 'var(--info)' },
  )}
  <p class="note">Hour of the day in IST, from <code>app_open</code>. Built on the event's own
     <code>at</code> (the rider's clock when it happened) and deliberately not <code>received_at</code>:
     this app queues events underground and drains them on the surface, so a server-time chart would
     show when riders got signal back rather than when they opened the app.</p>
</div>

<div class="card">
  <h2>Activity by day</h2>
  ${barChart(a.series)}
</div>

<div class="cols">
  <div class="card">
    <h2>Most-planned journeys</h2>
    ${table(
      ['From', 'To', { label: 'Plans', right: true }, { label: 'Avg ride', right: true }, { label: 'Avg fare', right: true }],
      a.pairs.map(p => [
        stationName(p.from),
        stationName(p.to),
        { v: num(p.plans), right: true },
        { v: p.avgRide == null ? '—' : `${p.avgRide.toFixed(1)} min`, right: true },
        { v: p.avgFare == null ? '—' : `₹${p.avgFare.toFixed(1)}`, right: true },
      ]),
      'No journeys planned in this window.',
    )}
  </div>

  <div class="card">
    <h2>Most-viewed stations</h2>
    ${rankedBars(
      a.stationViews.map(([id, v]) => ({
        label: stationName(id),
        value: v,
        color: LINE_COLOR[STATION_BY_ID.get(id)?.line] ?? 'var(--accent)',
      })),
      'No station pages opened in this window.',
    )}
    <p class="note">Station pages opened, from <code>station_viewed</code>.</p>
  </div>
</div>

<div class="cols">
  <div class="card">
    <h2>Most common nearby station</h2>
    ${rankedBars(
      a.nearby.map(([id, v]) => ({
        label: stationName(id),
        value: v,
        color: LINE_COLOR[STATION_BY_ID.get(id)?.line] ?? 'var(--accent)',
      })),
      'No nearby station resolved in this window.',
    )}
    <p class="note">Which station geolocation put riders closest to. Emitted only when location actually
       succeeded — the Old High Court fallback shown to riders who denied or lost location is never
       counted, or it would top this list by construction.</p>
  </div>

  <div class="card">
    <h2>Most-viewed train schedules</h2>
    ${rankedBars(
      a.trains.map(t => ({
        label: `${stationName(t.station)} · ${t.hour === '—' ? '—' : `${pad(t.hour)}:00`}`,
        value: t.count,
        color: LINE_COLOR[t.line] ?? 'var(--accent)',
        suffix: t.line === '—' ? '' : t.line,
      })),
      'No train schedule opened in this window.',
    )}
    <p class="note">A station, a line and a departure hour is what identifies a train. From
       <code>train_viewed</code> in <code>TrainRouteSheet</code>, so both the station page and the live
       journey are counted the same way.</p>
  </div>
</div>

<div class="cols">
  <div class="card">
    <h2>Reference topics opened</h2>
    ${rankedBars(
      a.topics.map(([slug, v]) => ({ label: TOPIC_LABEL[slug] ?? slug, value: v })),
      'No reference topic opened in this window.',
    )}
    <p class="note">Which <code>/you/:topic</code> pages riders read. Vercel Analytics also has these as
       paths under the <code>/you/:topic</code> route, measured on a beacon rather than a durable queue.</p>
  </div>

  <div class="card">
    <h2>Language</h2>
    ${rankedBars(
      a.languages.map(([code, v]) => ({ label: LANGUAGE_LABEL[code] ?? code, value: v })),
      'Nobody changed language in this window.',
    )}
    <p class="note warn"><b>This is switches, not riders.</b> <code>language_changed</code> fires when
       someone <em>changes</em> language, so every rider who stays on the default is invisible here and
       English is under-counted by most of the user base. A true distribution needs the current language
       stamped on <code>app_open</code>; that is a client change, not a dashboard one.</p>
  </div>
</div>

<div class="card">
  <h2>Search</h2>
  <div class="cols">
    <div>
      ${rankedBars(
        [
          { label: 'Found a place', value: a.search.matched, color: 'var(--ok)' },
          { label: 'Found nothing', value: a.search.failed, color: 'var(--bad)' },
        ],
        'Nobody searched in this window.',
      )}
    </div>
    <div>
      <div class="kpis" style="margin:0">
        <div class="kpi"><div class="n">${a.search.total ? pct(a.search.matched, a.search.total) : '—'}</div>
          <div class="l">Match rate</div></div>
        <div class="kpi"><div class="n">${a.search.medianLength == null ? '—' : num(a.search.medianLength)}</div>
          <div class="l">Median query length</div></div>
      </div>
    </div>
  </div>
  <p class="note">${searchNote}</p>
</div>

<div class="card">
  <h2>Every event in this window</h2>
  ${table(
    ['Event', { label: 'Count', right: true }, { label: 'Devices', right: true }],
    a.namesSorted.map(([n, c]) => [
      label(n),
      { v: num(c), right: true },
      { v: num(a.deviceCountByName.get(n) ?? 0), right: true },
    ]),
    'Nothing recorded in this window. If the app has been used, check that VITE_SUPABASE_URL is set in the Vercel production environment.',
  )}
</div>

${
  live
    ? ''
    : `<p class="note warn"><b>This page is a snapshot, not a live view.</b> The numbers above are
     frozen at ${esc(generated)} IST for <b>${esc(a.win.label)}</b> and will not change on their own,
     and the date controls are not on it because there is no server behind them. Run
     <code>node scripts/analytics-dashboard.mjs --serve</code> for a page with working ranges and a
     Refresh link.</p>`
}

<p class="note">
  Traffic, referrers, devices and page-speed live in <b>Vercel → Analytics / Speed Insights</b>,
  not here. That half is beacon-based and under-counts riders who were underground; this half is
  a durable queue that drains when they surface (PRD §5.8).
  <br><br>
  <b>What this cannot tell you, by design:</b> who any rider is (there is no <code>user_id</code> on
  this table and sign-ins are counted without one), where they physically were (no coordinate is ever
  sent — the map above is station-level), and what they typed (search is recorded as matched/not and a
  length). Those are §5.8's deliberate omissions, not gaps to be filled in later.
</p>

</div></body></html>`;

  return html;
}

/** The console summary the one-shot mode has always printed. */
function summarise(a) {
  return (
    `  Metrothi analytics — ${a.totalEvents.toLocaleString('en-IN')} events, ` +
    `${a.totalUsers.toLocaleString('en-IN')} devices (${a.win.label})\n` +
    (a.problems === 0
      ? '  Accuracy: OK — no impossible plans, no missing fares.'
      : `  Accuracy: ${a.problems} PROBLEM(S) recorded. Open the page and check the banner.`)
  );
}

/** Fetch + aggregate, the pair every mode needs. */
async function report(params) {
  const nowMs = Date.now();
  const win = resolveWindow(params, nowMs);
  const { rows, truncated } = await loadEvents(win);
  return { ...aggregate(rows, win, nowMs), truncated };
}

/** Opening a browser is a convenience, never the point. The target is printed. */
function openExternally(target) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* printed above */
  }
}

// ─── --serve ─────────────────────────────────────────────────────────────────

/**
 * `127.0.0.1`, never `0.0.0.0`, and it is the single most important line here.
 * This process holds a key that bypasses row-level security on every table in
 * the project; binding to all interfaces would put an unauthenticated read of
 * rider aggregates on the local network, which on a café or office wifi is a
 * different thing entirely from "a page on my machine".
 */
function serveDashboard() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' }).end('GET only');
      return;
    }
    // Browsers ask for this unprompted; answering 404 puts a red line in the
    // console of a page that is working fine.
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname !== '/') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    try {
      const a = await report({
        range: url.searchParams.get('range'),
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
      });
      // `no-store`: the whole point is that Refresh re-queries. A cached page
      // would hand back the snapshot problem through a different door.
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(buildHtml(a, { live: true }));
      console.log(`  ${new Date().toLocaleTimeString('en-IN')} — ${a.win.label}, ${a.totalEvents} events`);
    } catch (err) {
      // A failed query must not take the server down: the next Refresh may well
      // succeed, and a dead server is a worse answer than a page saying why.
      console.error(`\n  Query failed:\n  ${err.message}\n`);
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`<!doctype html><meta charset="utf-8">
<title>Metrothi analytics — error</title>
<style>body{margin:0;padding:48px 24px;background:#0f0f0f;color:#fafafa;
  font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
 .wrap{max-width:720px;margin:0 auto} h1{font-size:22px;margin:0 0 12px}
 pre{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;
  overflow-x:auto;font-size:13px;color:#fca5a5;white-space:pre-wrap}
 button{font:inherit;font-size:14px;background:#18181b;color:#fafafa;border:1px solid #27272a;
  border-radius:10px;padding:10px 18px;cursor:pointer;margin-top:20px}</style>
<div class="wrap"><h1>Could not read from Supabase</h1>
<pre>${esc(err.message)}</pre>
<form method="get" action="/"><button type="submit">Try again</button></form>
<p style="color:#a1a1aa;font-size:13px">The server is still running. Nothing was written.</p>
</div>`);
    }
  });

  // A port collision should step aside rather than crash — 7799 is arbitrary and
  // nothing about this page cares which port it is on.
  let port = PORT;
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && port < PORT + 20) {
      server.listen(++port, '127.0.0.1');
      return;
    }
    console.error(`\n  Could not start the server: ${err.message}\n`);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`\n  Metrothi analytics — live at ${url}`);
    console.log('  Every load re-queries Supabase. Ctrl+C to stop.\n');
    if (!NO_OPEN) openExternally(url);
  });
}

// ─── Run ─────────────────────────────────────────────────────────────────────

if (SERVE) {
  serveDashboard();
} else {
  const a = await report({ range: flag('--range'), from: flag('--from'), to: flag('--to') });
  writeFileSync(OUT, buildHtml(a), 'utf8');
  console.log(`\n${summarise(a)}`);
  console.log(`\n  Wrote ${OUT}`);
  console.log('  This file is a snapshot. For live ranges: node scripts/analytics-dashboard.mjs --serve\n');
  if (!NO_OPEN) openExternally(OUT);
}
