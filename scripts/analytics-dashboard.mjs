#!/usr/bin/env node
/**
 * Metrothi — analytics-dashboard.mjs
 * ---------------------------------------------------------------------------
 * Reads the four rollup views from `supabase/analytics.sql` and writes one
 * self-contained HTML page you can read without knowing any SQL.
 *
 * Run from the repo root:  node scripts/analytics-dashboard.mjs
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
 * ─── Output ─────────────────────────────────────────────────────────────────
 *
 * Writes `analytics-dashboard.html` at the repo root and opens it. That file is
 * gitignored: it contains rider aggregates, and the whole point of the 90-day
 * purge (§5.8) is that this data does not accumulate anywhere forever.
 *
 * Flags:  --no-open      write the file, don't launch a browser
 *         --out <path>   write somewhere else
 *         --probe        check that a RIDER can insert, and exit. The dashboard
 *                        reads with `service_role`, which bypasses grants and
 *                        RLS — so it renders a healthy empty page even when
 *                        every rider's drain is being rejected. Writes nothing.
 * ---------------------------------------------------------------------------
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const STATIONS_JSON = join(REPO_ROOT, 'app/src/data/stations.json');

const argv = process.argv.slice(2);
const NO_OPEN = argv.includes('--no-open');
const OUT = (() => {
  const i = argv.indexOf('--out');
  return i !== -1 && argv[i + 1]
    ? resolve(argv[i + 1])
    : join(REPO_ROOT, 'analytics-dashboard.html');
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

async function q(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });
  const body = await res.text();
  if (!res.ok) {
    // 404 on a view name means analytics.sql was never run against this project;
    // 401 means the key is the anon one. Both are worth saying outright rather
    // than surfacing as "undefined is not a function" three frames later.
    const hint =
      res.status === 404
        ? '\n  That view does not exist. Run supabase/analytics.sql in the SQL editor first.'
        : res.status === 401 || res.status === 403
          ? '\n  The key was rejected. Check you copied service_role and not anon.'
          : '';
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}\n  ${body}${hint}`);
  }
  return JSON.parse(body);
}

const STATION_NAME = new Map(
  JSON.parse(readFileSync(STATIONS_JSON, 'utf8')).stations.map(s => [s.id, s.name]),
);
/** Unknown ids are shown raw rather than hidden — a station id the app emits but
 *  stations.json doesn't have is a real bug and should be visible, not blank. */
const stationName = id => STATION_NAME.get(id) ?? id ?? '—';

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
};
const label = n => EVENT_LABEL[n] ?? n;

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

/** Pure-CSS bars. No script tag: this page is opened from the filesystem. */
function barChart(points) {
  if (!points.length) return `<p class="empty">Nothing recorded yet.</p>`;
  const max = Math.max(...points.map(p => p.value), 1);
  return `<div class="chart">${points
    .map(
      p => `<div class="bar" title="${esc(p.label)}: ${num(p.value)}">
        <div class="fill" style="height:${Math.max((p.value / max) * 100, p.value > 0 ? 2 : 0)}%"></div>
        <span class="tick">${esc(p.tick)}</span>
      </div>`,
    )
    .join('')}</div>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const [accuracy, funnel, pairs, daily] = await Promise.all([
  q('accuracy_watch?select=*&order=day.desc&limit=90'),
  q('funnel_daily?select=*&order=day.desc&limit=90'),
  q('journeys_by_pair?select=*&order=plans.desc&limit=25'),
  q('events_daily?select=*&order=day.desc&limit=500'),
]);

const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);

const totalEvents = sum(daily, 'events');
const problems = sum(accuracy, 'impossible_plans') + sum(accuracy, 'missing_fares');
const days = new Set(daily.map(r => r.day)).size;

// All-time count per event name, from the daily rollup.
const byName = new Map();
for (const r of daily) byName.set(r.name, (byName.get(r.name) ?? 0) + Number(r.events ?? 0));
const namesSorted = [...byName.entries()].sort((a, b) => b[1] - a[1]);

// Events per day, oldest -> newest, last 30 days that have data.
const perDay = new Map();
for (const r of daily) perDay.set(r.day, (perDay.get(r.day) ?? 0) + Number(r.events ?? 0));
const chartPoints = [...perDay.entries()]
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .slice(-30)
  .map(([day, value]) => ({ label: day, value, tick: String(day).slice(5) }));

const funnelTotals = {
  opened: sum(funnel, 'opened'),
  planned: sum(funnel, 'planned'),
  started: sum(funnel, 'started'),
  completed: sum(funnel, 'completed'),
};

const healthy = problems === 0;
const generated = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Metrothi analytics</title>
<style>
  :root{--bg:#f4f4f5;--card:#fff;--text:#18181b;--muted:#71717a;--line:#e4e4e7;
        --accent:#f97316;--ok:#16a34a;--bad:#dc2626;--okbg:#f0fdf4;--badbg:#fef2f2}
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
  .sub{color:var(--muted);font-size:13px;margin:0 0 28px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;
        padding:20px;margin-bottom:18px}
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
  .note{color:var(--muted);font-size:12.5px;margin:12px 0 0;line-height:1.5}
  a{color:var(--accent)}
</style></head><body><div class="wrap">

<h1>Metrothi analytics</h1>
<p class="sub">Generated ${esc(generated)} IST · ${num(totalEvents)} events across ${num(days)} day${days === 1 ? '' : 's'}
   · raw rows are purged after 90 days (PRD §5.8)</p>

<div class="banner ${healthy ? 'ok' : 'bad'}">
  <div class="dot"></div>
  <div>
    <b>${healthy ? 'No accuracy problems recorded' : `${num(problems)} accuracy problem${problems === 1 ? '' : 's'} recorded`}</b>
    <p>${
      healthy
        ? 'No rider has been shown an impossible route or a missing fare. This is the number that matters most — nothing else in the system reports it.'
        : 'A rider was shown a route the engine could not complete, or a fare it could not resolve. These are data bugs that reached real people. See the table below for which days.'
    }</p>
  </div>
</div>

<div class="kpis">
  <div class="kpi"><div class="n">${num(totalEvents)}</div><div class="l">Events recorded</div></div>
  <div class="kpi"><div class="n">${num(byName.get('journey_planned') ?? 0)}</div><div class="l">Journeys planned</div></div>
  <div class="kpi"><div class="n">${num(byName.get('journey_completed') ?? 0)}</div><div class="l">Journeys completed</div></div>
  <div class="kpi"><div class="n">${num(byName.get('installed') ?? 0)}</div><div class="l">App installs</div></div>
</div>

<div class="card">
  <h2>Activity — last ${chartPoints.length} day${chartPoints.length === 1 ? '' : 's'} with data</h2>
  ${barChart(chartPoints)}
</div>

<div class="card">
  <h2>Accuracy watch</h2>
  ${table(
    ['Day', { label: 'Plans', right: true }, { label: 'Impossible', right: true }, { label: 'Missing fares', right: true }],
    accuracy.map(r => [
      r.day,
      { v: num(r.plans), right: true },
      { html: `<b style="color:${Number(r.impossible_plans) ? 'var(--bad)' : 'inherit'}">${num(r.impossible_plans)}</b>`, right: true },
      { html: `<b style="color:${Number(r.missing_fares) ? 'var(--bad)' : 'inherit'}">${num(r.missing_fares)}</b>`, right: true },
    ]),
    'No journeys planned yet.',
  )}
  <p class="note">Both columns should sit at zero. A non-zero day means the routing or fare
     engine produced something wrong for a real rider — §7.3 and §7.5 are accuracy claims that
     can only be falsified in the field.</p>
</div>

<div class="card">
  <h2>Rider funnel</h2>
  ${[
    ['Opened', funnelTotals.opened],
    ['Planned', funnelTotals.planned],
    ['Started', funnelTotals.started],
    ['Completed', funnelTotals.completed],
  ]
    .map(
      ([name, v]) => `<div class="fstep">
        <div class="name">${esc(name)}</div>
        <div class="track"><div class="fillx" style="width:${funnelTotals.opened ? Math.max((v / funnelTotals.opened) * 100, v > 0 ? 1.5 : 0) : 0}%"></div></div>
        <div class="val">${num(v)} · ${pct(v, funnelTotals.opened)}</div>
      </div>`,
    )
    .join('')}
  <p class="note">Counts are daily unique devices summed across days, so a rider who came back on
     Tuesday is counted once for Monday and once for Tuesday. Read these as relative drop-off
     between stages, not as a headcount of people.</p>
</div>

<div class="card">
  <h2>Most-planned journeys</h2>
  ${table(
    ['From', 'To', { label: 'Plans', right: true }, { label: 'Avg ride', right: true }, { label: 'Avg fare', right: true }],
    pairs.map(r => [
      stationName(r.from_station),
      stationName(r.to_station),
      { v: num(r.plans), right: true },
      { v: r.avg_ride_mins == null ? '—' : `${r.avg_ride_mins} min`, right: true },
      { v: r.avg_fare == null ? '—' : `₹${r.avg_fare}`, right: true },
    ]),
    'No journeys planned yet.',
  )}
</div>

<div class="card">
  <h2>Every event, all time</h2>
  ${table(
    ['Event', { label: 'Count', right: true }],
    namesSorted.map(([n, c]) => [label(n), { v: num(c), right: true }]),
    'Nothing recorded yet. If the app has been used, check that VITE_SUPABASE_URL is set in the Vercel production environment.',
  )}
</div>

<p class="note">
  Traffic, referrers, devices and page-speed live in <b>Vercel → Analytics / Speed Insights</b>,
  not here. That half is beacon-based and under-counts riders who were underground; this half is
  a durable queue that drains when they surface (PRD §5.8).
  <br><br>
  There is no <code>user_id</code> on any of this: events carry a resettable device id and never
  a signed-in identity, never GPS, and never search text.
</p>

</div></body></html>`;

writeFileSync(OUT, html, 'utf8');

console.log(`\n  Metrothi analytics — ${totalEvents.toLocaleString('en-IN')} events across ${days} day(s)`);
console.log(
  problems === 0
    ? '  Accuracy: OK — no impossible plans, no missing fares.'
    : `  Accuracy: ${problems} PROBLEM(S) recorded. Open the page and check the accuracy table.`,
);
console.log(`\n  Wrote ${OUT}\n`);

if (!NO_OPEN) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', OUT]]
      : process.platform === 'darwin'
        ? ['open', [OUT]]
        : ['xdg-open', [OUT]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Opening a browser is a convenience, never the point. The path is printed.
  }
}
