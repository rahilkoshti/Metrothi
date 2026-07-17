#!/usr/bin/env node
/**
 * Metrothi — fetch-tracks.mjs
 * ---------------------------------------------------------------------------
 * One-off dev script. Downloads real GMRC track geometry from OpenStreetMap
 * (via Overpass), routes along the rail graph between your stations in order,
 * and emits:
 *
 *   app/src/data/tracks.json      — per-line track polyline + station measures
 *   app/src/data/tracks-report.txt — snap report (flags bad station coords)
 *
 * Run from the repo root:  node scripts/fetch-tracks.mjs
 *
 * No dependencies. Node 18+ (uses global fetch).
 *
 * Strategy (relation-independent, works even if OSM has no route relations
 * for Phase 2):
 *   1. Fetch ALL railway=subway|light_rail ways in the Ahmedabad–Gandhinagar
 *      bbox, with their nodes.
 *   2. Build an undirected graph from shared node IDs.
 *   3. For each line, Dijkstra along the graph between consecutive stations
 *      (in official order), concatenate the paths into one polyline.
 *   4. Simplify (Douglas–Peucker, ~5 m), compute cumulative km, project every
 *      station onto the polyline to get its km "measure".
 *   5. Report any station whose coords sit > 120 m from the track (this will
 *      catch Vastral), and suggest corrected coords from OSM station nodes.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const STATIONS_JSON = join(REPO_ROOT, 'app/src/data/stations.json');
const OUT_TRACKS = join(REPO_ROOT, 'app/src/data/tracks.json');
const OUT_REPORT = join(REPO_ROOT, 'app/src/data/tracks-report.txt');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Ahmedabad–Gandhinagar bbox: south, west, north, east
const BBOX = '22.90,72.40,23.30,72.75';

// If OSM is missing Phase 2 track under railway=subway, set this to true to
// also pull ways still tagged railway=construction (pre-opening tagging).
const INCLUDE_CONSTRUCTION = false;

// Stations skipped as *routing waypoints* (traced through, measure computed
// afterwards by projection): known-bad coords, null coords, not operational.
// Keep 'vastral' here until its coordinate is fixed in stations.json.
const TRACE_SKIP = new Set(['vastral', 'sabarmati-railway-station']);

// Line paths in official station order. Interchange stations appear in both
// lines' paths (stations.json stores each station once, under one line, so
// the paths can't be derived from it alone — keep this in sync with the
// engine's LINE_PATHS).
const LINE_PATHS = {
  blue: ['vastral-gam','nirant-cross-road','vastral','rabari-colony','amraivadi','apparel-park','kankaria-east','kalupur','gheekanta','shahpur','old-high-court','sp-stadium','commerce-six-road','gujarat-university','gurukul-road','doordarshan-kendra','thaltej','thaltej-gam'],
  red: ['apmc','jivraj-park','rajivnagar','shreyas','paldi','gandhigram','old-high-court','usmanpura','vijaynagar','vadaj','ranip','sabarmati-railway-station','aec','sabarmati','motera-stadium'],
  yellow: ['motera-stadium','koteshwar-road','vishwakarma-college','tapovan-circle','narmada-canal','koba-circle','juna-koba','koba-gam','gnlu','raysan','randesan','dholakuva-circle','infocity','sector-1','sector-10a','sachivalaya','akshardham','juna-sachivalaya','sector-16','sector-24','mahatma-mandir'],
  violet: ['gnlu','pdeu','gift-city'],
};

// Simplification tolerance in metres, coordinate precision in decimals.
const SIMPLIFY_TOLERANCE_M = 5;
const COORD_DECIMALS = 6;
// Station further than this from its line's track gets flagged in the report.
const SNAP_WARN_M = 120;

// ─── Geo helpers ─────────────────────────────────────────────────────────────

const R = 6371000; // metres
const rad = (d) => (d * Math.PI) / 180;

function haversineM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Local equirectangular projection (fine at city scale) for point→segment math.
const REF_LAT = 23.1;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos(rad(REF_LAT));
const toXY = (p) => ({ x: p.lng * M_PER_DEG_LNG, y: p.lat * M_PER_DEG_LAT });

/** Distance (m) from point P to segment AB, plus the projection parameter t∈[0,1]. */
function pointToSegment(p, a, b) {
  const P = toXY(p), A = toXY(a), B = toXY(b);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = A.x + t * dx, qy = A.y + t * dy;
  return { distM: Math.hypot(P.x - qx, P.y - qy), t };
}

/** Douglas–Peucker in projected metres. coords: [{lat,lng}] */
function simplify(coords, toleranceM) {
  if (coords.length <= 2) return coords;
  const keep = new Array(coords.length).fill(false);
  keep[0] = keep[coords.length - 1] = true;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let maxD = -1, maxIdx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const { distM } = pointToSegment(coords[i], coords[i0], coords[i1]);
      if (distM > maxD) { maxD = distM; maxIdx = i; }
    }
    if (maxD > toleranceM) {
      keep[maxIdx] = true;
      stack.push([i0, maxIdx], [maxIdx, i1]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

// ─── Overpass fetch ──────────────────────────────────────────────────────────

async function overpass(query, label) {
  process.stdout.write(`Overpass: ${label} … `);
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const json = await res.json();
  console.log(`${json.elements.length} elements`);
  return json.elements;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRailWays() {
  const constructionClause = INCLUDE_CONSTRUCTION
    ? `way["railway"="construction"]["construction"~"^(subway|light_rail)$"](${BBOX});`
    : '';
  const query = `
    [out:json][timeout:180];
    (
      way["railway"~"^(subway|light_rail)$"](${BBOX});
      ${constructionClause}
    );
    out body;
    >;
    out skel qt;
  `;
  return overpass(query, 'rail ways + nodes');
}

async function fetchStationNodes() {
  const query = `
    [out:json][timeout:60];
    (
      node["railway"="station"]["station"="subway"](${BBOX});
      node["railway"="station"]["operator"~"Gujarat Metro|GMRC",i](${BBOX});
      node["public_transport"="station"]["subway"="yes"](${BBOX});
    );
    out body;
  `;
  return overpass(query, 'station nodes');
}

// ─── Graph build + Dijkstra ──────────────────────────────────────────────────

class MinHeap {
  constructor() { this.a = []; }
  push(item) { // item: [dist, nodeId]
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function buildGraph(elements) {
  const nodePos = new Map(); // id -> {lat,lng}
  const adj = new Map();     // id -> [{to, w}]
  for (const el of elements) {
    if (el.type === 'node') nodePos.set(el.id, { lat: el.lat, lng: el.lon });
  }
  let edgeCount = 0;
  for (const el of elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    for (let i = 0; i < el.nodes.length - 1; i++) {
      const a = el.nodes[i], b = el.nodes[i + 1];
      const pa = nodePos.get(a), pb = nodePos.get(b);
      if (!pa || !pb) continue;
      const w = haversineM(pa, pb);
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ to: b, w });
      adj.get(b).push({ to: a, w });
      edgeCount++;
    }
  }
  console.log(`Graph: ${nodePos.size} nodes, ${edgeCount} edges`);
  return { nodePos, adj };
}

function nearestGraphNode(graph, p) {
  let best = null, bestD = Infinity;
  for (const [id, pos] of graph.nodePos) {
    if (!graph.adj.has(id)) continue; // only nodes actually on rail ways
    const d = haversineM(p, pos);
    if (d < bestD) { bestD = d; best = id; }
  }
  return { id: best, distM: bestD };
}

function dijkstra(graph, startId, endId) {
  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const heap = new MinHeap();
  heap.push([0, startId]);
  const done = new Set();
  while (heap.size) {
    const [d, u] = heap.pop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === endId) break;
    for (const { to, w } of graph.adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        heap.push([nd, to]);
      }
    }
  }
  if (!done.has(endId)) return null;
  const path = [endId];
  let cur = endId;
  while (cur !== startId) { cur = prev.get(cur); path.push(cur); }
  return path.reverse();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const stationsFile = JSON.parse(readFileSync(STATIONS_JSON, 'utf8'));
  const stations = Object.fromEntries(stationsFile.stations.map((s) => [s.id, s]));

  const railElements = await fetchRailWays();
  await sleep(1500); // Overpass politeness
  const stationNodes = await fetchStationNodes();

  const graph = buildGraph(railElements);
  if (graph.nodePos.size === 0) {
    console.error(
      '\nNo rail ways found. Phase 2 may not be tagged railway=subway yet — ' +
      'set INCLUDE_CONSTRUCTION = true and re-run, or check the bbox.'
    );
    process.exit(1);
  }

  const report = [];
  const outLines = {};

  for (const [lineId, path] of Object.entries(LINE_PATHS)) {
    report.push(`\n═══ ${lineId.toUpperCase()} LINE ═══`);

    // Waypoints: stations we actually route through, in order.
    const waypoints = path
      .map((id) => ({ id, s: stations[id] }))
      .filter(({ id, s }) => {
        if (!s) { report.push(`  !! ${id}: not found in stations.json`); return false; }
        if (TRACE_SKIP.has(id)) { report.push(`  ~~ ${id}: skipped as waypoint (TRACE_SKIP)`); return false; }
        if (s.lat == null || s.lng == null) { report.push(`  ~~ ${id}: skipped (null coords)`); return false; }
        return true;
      });

    if (waypoints.length < 2) {
      report.push(`  !! Not enough usable waypoints — line skipped.`);
      continue;
    }

    // Snap each waypoint to its nearest rail-graph node.
    const snapped = waypoints.map(({ id, s }) => {
      const { id: nodeId, distM } = nearestGraphNode(graph, s);
      return { id, s, nodeId, snapDistM: distM };
    });

    // Route between consecutive waypoints, concatenate.
    const coords = [];
    for (let i = 0; i < snapped.length - 1; i++) {
      const a = snapped[i], b = snapped[i + 1];
      const nodePath = dijkstra(graph, a.nodeId, b.nodeId);
      if (!nodePath) {
        report.push(`  !! ${a.id} → ${b.id}: no rail path in OSM — using straight line. ` +
                    `Map this segment in OSM or accept the chord.`);
        const pa = graph.nodePos.get(a.nodeId), pb = graph.nodePos.get(b.nodeId);
        if (coords.length === 0) coords.push(pa);
        coords.push(pb);
        continue;
      }
      const seg = nodePath.map((n) => graph.nodePos.get(n));
      // Drop the joint node so segments don't duplicate it.
      const startIdx = coords.length === 0 ? 0 : 1;
      for (let k = startIdx; k < seg.length; k++) coords.push(seg[k]);
    }

    // Simplify + round.
    const simplified = simplify(coords, SIMPLIFY_TOLERANCE_M).map((p) => ({
      lat: +p.lat.toFixed(COORD_DECIMALS),
      lng: +p.lng.toFixed(COORD_DECIMALS),
    }));
    report.push(`  Track: ${coords.length} pts → ${simplified.length} after simplify`);

    // Cumulative km along the simplified polyline.
    const cumKm = [0];
    for (let i = 1; i < simplified.length; i++) {
      cumKm.push(cumKm[i - 1] + haversineM(simplified[i - 1], simplified[i]) / 1000);
    }
    const totalKm = cumKm[cumKm.length - 1];
    report.push(`  Length: ${totalKm.toFixed(2)} km`);

    // Project EVERY station on this line's path (including TRACE_SKIP ones)
    // onto the polyline to get its measure + offset.
    const stationKm = {};
    for (const id of path) {
      const s = stations[id];
      if (!s || s.lat == null || s.lng == null) { stationKm[id] = null; continue; }
      let bestD = Infinity, bestKm = 0;
      for (let i = 0; i < simplified.length - 1; i++) {
        const { distM, t } = pointToSegment(s, simplified[i], simplified[i + 1]);
        if (distM < bestD) {
          bestD = distM;
          bestKm = cumKm[i] + t * (cumKm[i + 1] - cumKm[i]);
        }
      }
      stationKm[id] = +bestKm.toFixed(4);
      const flag = bestD > SNAP_WARN_M ? '  !! BAD COORD?' : '';
      report.push(`  ${id.padEnd(28)} km=${bestKm.toFixed(2).padStart(6)}  offset=${Math.round(bestD)}m${flag}`);
      if (bestD > SNAP_WARN_M) {
        // Suggest a fix from OSM station nodes by fuzzy name match.
        const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = norm(s.name);
        const match = stationNodes.find((n) => {
          const nm = norm(n.tags?.name);
          return nm && (nm.includes(target) || target.includes(nm));
        });
        if (match) {
          report.push(`     → OSM suggests: lat ${match.lat}, lng ${match.lon} ` +
                      `(node ${match.id}, "${match.tags.name}") — update stations.json and re-run.`);
        } else {
          report.push(`     → No OSM station node matched "${s.name}" — verify manually against the GMRC route map.`);
        }
      }
    }

    // Monotonicity sanity check: measures must increase along the path.
    let prevKm = -1, monotonic = true;
    for (const id of path) {
      if (stationKm[id] == null) continue;
      if (stationKm[id] < prevKm - 0.05) { monotonic = false; report.push(`  !! Non-monotonic measure at ${id} — inspect the track trace.`); }
      prevKm = stationKm[id];
    }
    if (monotonic) report.push('  Measures monotonic ✓');

    outLines[lineId] = { coords: simplified.map((p) => [p.lat, p.lng]), stationKm, totalKm: +totalKm.toFixed(3) };
  }

  const out = {
    _meta: {
      source: 'OpenStreetMap via Overpass — © OpenStreetMap contributors (ODbL). Rail graph routed between GMRC station order.',
      generated: new Date().toISOString().slice(0, 10),
      generator: 'scripts/fetch-tracks.mjs',
      simplifyToleranceM: SIMPLIFY_TOLERANCE_M,
      note: 'coords are [lat,lng]. stationKm is the distance along the track at which each station sits; null = unknown coords. Re-run the script after fixing flagged stations.',
    },
    lines: outLines,
  };

  mkdirSync(dirname(OUT_TRACKS), { recursive: true });
  writeFileSync(OUT_TRACKS, JSON.stringify(out));
  writeFileSync(OUT_REPORT, report.join('\n') + '\n');

  const kb = (JSON.stringify(out).length / 1024).toFixed(1);
  console.log(`\nWrote ${OUT_TRACKS} (${kb} KB)`);
  console.log(`Wrote ${OUT_REPORT} — READ THIS before committing.`);
  console.log(report.filter((l) => l.includes('!!')).join('\n') || 'No warnings 🎉');
}

main().catch((err) => { console.error(err); process.exit(1); });
