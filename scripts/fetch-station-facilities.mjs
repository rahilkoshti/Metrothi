#!/usr/bin/env node
/**
 * Metrothi — fetch-station-facilities.mjs
 * ---------------------------------------------------------------------------
 * One-off dev script. Scrapes the two GMRC pages that publish anything *per
 * station* and merges them into:
 *
 *   app/src/data/stationFacilities.json
 *
 * Run from the repo root:  node scripts/fetch-station-facilities.mjs
 *
 * No dependencies. Node 18+ (uses global fetch).
 *
 * Source 1 — the entry/exit-gate page (GATE_URL):
 *   - whether the station is Elevated or Underground
 *   - which numbered street-level gates are open
 *   - which lift serves which gate (their "Facilities for Divyangjan")
 *
 * Source 2 — the Multi Modal Integration page (MMI_URL):
 *   - which stations physically connect to BRTS / GSRTC / Indian Railways /
 *     the high-speed rail stations, and through which entry-exit
 *
 * Still NOT published per station anywhere on gujaratmetrorail.com: toilets,
 * Wi-Fi, ATMs, feeder-bus routes, and gate landmarks (the gate table numbers
 * gates but never says which road each opens onto). Following the precedent
 * set by stations.json's `_meta.knownDataIssues`, those stay absent rather
 * than being guessed at from third-party sources.
 *
 * The gate page is three tables (East-West / North-South / Phase-2) of merged
 * `rowspan` cells, so the parser below expands rowspans before reading rows.
 * Station names on GMRC differ from ours ("Kalupur Metro Station", "Koba
 * Gaam", "S P Stadium") and differ again between the two pages ("Vadaj Metro
 * Station" vs "Vadaj", "Kalupur Rly. Station"), so both mappings are written
 * out explicitly: a silent fuzzy match would quietly attach one station's
 * gates or interchange to another.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const STATIONS_JSON = join(REPO_ROOT, 'app/src/data/stations.json');
const OUT_JSON = join(REPO_ROOT, 'app/src/data/stationFacilities.json');

const GATE_URL =
  'https://www.gujaratmetrorail.com/ahmedabad/information-of-entry-exit-gate-at-entrance/';
/** Both MMI tabs (#mmiahd1 Phase-1, #mmiahd2 Phase-2) ship in this one document. */
const MMI_URL = 'https://www.gujaratmetrorail.com/mmi-2/';

/** GMRC's station name (exactly as printed) -> our stations.json id. */
const NAME_TO_ID = {
  // East-West corridor (Line 1 / blue)
  'Vastral Gam': 'vastral-gam',
  'Nirant Cross Road': 'nirant-cross-road',
  Vastral: 'vastral',
  'Rabari Colony': 'rabari-colony',
  Amraiwadi: 'amraivadi',
  'Apparel Park': 'apparel-park',
  'Kankaria East': 'kankaria-east',
  'Kalupur Metro Station': 'kalupur',
  Gheekanta: 'gheekanta',
  Shahpur: 'shahpur',
  'Old High Court': 'old-high-court',
  'S P Stadium': 'sp-stadium',
  'Commerce Six Road': 'commerce-six-road',
  'Gujarat University': 'gujarat-university',
  'Gurukul Road': 'gurukul-road',
  'Doordarshan Kendra': 'doordarshan-kendra',
  Thaltej: 'thaltej',
  'Thaltej Gam': 'thaltej-gam',

  // North-South corridor (Line 2 / red)
  APMC: 'apmc',
  'Jivraj Park': 'jivraj-park',
  'Rajiv Nagar Metro Station': 'rajivnagar',
  Shreyas: 'shreyas',
  Paldi: 'paldi',
  'Gandhigram Metro Station': 'gandhigram',
  'Usmanpura Metro Station': 'usmanpura',
  'Vijay Nagar Metro Station': 'vijaynagar',
  'Vadaj Metro Station': 'vadaj',
  Ranip: 'ranip',
  AEC: 'aec',
  'Sabarmati Metro Station': 'sabarmati',
  'Motera Stadium': 'motera-stadium',

  // Phase 2 — GMRC lists Lines 3 and 4 as one continuous table
  'Koteshwar Road': 'koteshwar-road',
  'Vishwakarma College': 'vishwakarma-college',
  'Tapovan Circle': 'tapovan-circle',
  'Narmada Canal': 'narmada-canal',
  'Koba Circle': 'koba-circle',
  'Juna Koba': 'juna-koba',
  'Koba Gaam': 'koba-gam',
  GNLU: 'gnlu',
  Raysan: 'raysan',
  Randesan: 'randesan',
  'Dholakuva Circle': 'dholakuva-circle',
  Infocity: 'infocity',
  'Sector-1': 'sector-1',
  'Sector-10A': 'sector-10a',
  Sachivalaya: 'sachivalaya',
  PDEU: 'pdeu',
  'GIFT City': 'gift-city',
  Akshardham: 'akshardham',
  'Juna Sachivalaya': 'juna-sachivalaya',
  'Sector-16': 'sector-16',
  'Sector-24': 'sector-24',
  'Mahatma Mandir': 'mahatma-mandir',
};

/**
 * The MMI page prints shorter station names than the gate page. Only the ones
 * that actually differ are listed; anything else falls through to NAME_TO_ID.
 */
const MMI_ALIASES = {
  Gandhigram: 'gandhigram',
  Vadaj: 'vadaj',
  Sabarmati: 'sabarmati',
  'Kalupur Rly. Station': 'kalupur',
};

/** GMRC's mode wording -> a stable token the UI can switch on. */
const MODE_TOKENS = {
  BRTS: 'brts',
  GSRTC: 'gsrtc',
  'Indian Railways': 'indian-railways',
  NHSRCL: 'high-speed-rail',
};

/**
 * Two per-station facts GMRC states only in the Phase-2 tab's prose and image
 * captions, not in any table — so there is nothing to parse. They are written
 * out here, and `assertStillOnPage` re-checks the wording on every run so a
 * silent edit upstream turns into a warning instead of stale app data.
 */
const MMI_PROSE = [
  {
    id: 'mahatma-mandir',
    // Phase-2 tab, "Infrastructure Facilitates for First & Last Mile Connectivity"
    mustContain: '335-metre-long foot over bridge equipped with travellators',
    summary: 'Integration with Indian Railways',
    modes: ['indian-railways'],
    connections: [
      {
        gate: null,
        text: 'Connected to Gandhinagar Capital Railway Station by a 335-metre foot over bridge with travellators, opening directly onto the railway platform. Also gives access to the Mahatma Mandir Convention Centre, The Leela Hotel and Dandi Kutir.',
      },
    ],
  },
  {
    id: 'pdeu',
    // Phase-2 tab, figcaption on the PDEU station rendering
    mustContain: 'Parking facility provided Future provision for Public Bicycle Sharing',
    summary: 'Parking facility provided',
    modes: [],
    connections: [],
    amenities: ['parking'],
    plannedAmenities: ['public-bicycle-sharing', 'bus-bay'],
    sourceNote:
      'From the caption on GMRC\'s architectural rendering of the station, not from a facilities table.',
  },
];

// ─── HTML helpers ────────────────────────────────────────────────────────────

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&#8211;': '-',
  '&ndash;': '-',
  '&#8212;': '--',
  '&mdash;': '--',
  '&#8217;': "'",
  '&rsquo;': "'",
  '&#8216;': "'",
  '&lsquo;': "'",
  '&quot;': '"',
  '&#8220;': '"',
  '&#8221;': '"',
  '&lt;': '<',
  '&gt;': '>',
};

/** Cell text, with <br> preserved as \n so multi-line cells stay separable. */
function cellText(html) {
  let s = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Parse one <table> into a dense grid, expanding rowspan/colspan so every
 * logical row has the same columns. GMRC merges the Sr.No./Name/Type/Lifts
 * cells across a station's gate rows, so without this the 2nd..nth gate row
 * of every station arrives as a single orphaned "Gate No. 3" cell.
 */
function parseTable(tableHtml) {
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const grid = [];
  /** pending[colIndex] = { text, remaining } carried down from a rowspan */
  const pending = [];

  for (const tr of rows) {
    const cells = tr.match(/<t[hd]\b[\s\S]*?<\/t[hd]>/gi) || [];
    if (!cells.length) continue;

    const out = [];
    let col = 0;
    const take = () => {
      while (pending[col] && pending[col].remaining > 0) {
        out[col] = pending[col].text;
        pending[col].remaining -= 1;
        col += 1;
      }
    };

    take();
    for (const cell of cells) {
      const rowspan = Number((cell.match(/rowspan="(\d+)"/i) || [])[1] || 1);
      const colspan = Number((cell.match(/colspan="(\d+)"/i) || [])[1] || 1);
      const text = cellText(cell);
      for (let c = 0; c < colspan; c += 1) {
        out[col] = text;
        if (rowspan > 1) pending[col] = { text, remaining: rowspan - 1 };
        col += 1;
      }
      take();
    }
    grid.push(out.map((c) => c ?? ''));
  }
  return grid;
}

// ─── Field parsers ───────────────────────────────────────────────────────────

/** "Gate No. 3" / "Gate No.3" -> 3 */
function gateNumber(text) {
  const m = text.match(/Gate\s*No\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * "- Lift No. 01 near Gate No. 01\n- Lift No. 04 near Gate No. 01 & 02"
 *   -> [{ lift: 1, gates: [1] }, { lift: 4, gates: [1, 2] }]
 */
function parseLifts(text) {
  const lifts = [];
  for (const line of text.split('\n')) {
    const m = line.match(/Lift\s*No\.?\s*(\d+)\s*near\s*Gate\s*No\.?\s*([\d\s&and,]+)/i);
    if (!m) continue;
    const gates = (m[2].match(/\d+/g) || []).map(Number);
    if (gates.length) lifts.push({ lift: Number(m[1]), gates });
  }
  return lifts;
}

/** "Old High Court\n(Interchange Station)" -> "Old High Court" */
function stationName(text) {
  return text.split('\n')[0].trim();
}

/** "Entry-Exit 3 - Lift and Skywalk connecting to BRTS" -> 3 (null if unstated) */
function entryExitNumber(text) {
  const m = text.match(/Entry[\s-]*Exit\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * "Integration with BRTS, Indian Railways and NHSRCL"
 *   -> ['brts', 'indian-railways', 'high-speed-rail']
 * Unrecognised wording is returned so the caller can warn rather than drop it.
 */
function parseModes(summary) {
  const body = summary.replace(/^\s*Integration\s+with\s+/i, '');
  const modes = [];
  const unknown = [];
  for (const raw of body.split(/,|\band\b/i)) {
    const name = raw.trim();
    if (!name) continue;
    const token = MODE_TOKENS[name];
    if (token) modes.push(token);
    else unknown.push(name);
  }
  return { modes, unknown };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function get(url, label) {
  console.log(`Fetching ${url}`);
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching the ${label} page`);
  return res.text();
}

async function main() {
  const html = await get(GATE_URL, 'gate');
  const mmiHtml = await get(MMI_URL, 'MMI');

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  if (tables.length !== 3) {
    throw new Error(
      `Expected 3 tables (East-West, North-South, Phase-2), found ${tables.length}. ` +
        `GMRC changed the page layout — re-read it before trusting this script.`
    );
  }

  const stations = {};
  const warnings = [];

  for (const [tableIndex, tableHtml] of tables.entries()) {
    const grid = parseTable(tableHtml);
    // Row 0 is the header ("Sr. No. | Station Name | Type of Station | ...").
    for (const row of grid.slice(1)) {
      const [, nameCell = '', typeCell = '', gateCell = '', liftCell = ''] = row;
      const gmrcName = stationName(nameCell);
      if (!gmrcName) continue;

      const id = NAME_TO_ID[gmrcName];
      if (!id) {
        warnings.push(`Unmapped GMRC station name in table ${tableIndex + 1}: "${gmrcName}"`);
        continue;
      }

      const entry = (stations[id] ??= {
        gmrcName,
        structure: /underground/i.test(typeCell) ? 'underground' : 'elevated',
        interchange: /interchange/i.test(nameCell),
        gates: [],
        lifts: parseLifts(liftCell),
      });

      const gate = gateNumber(gateCell);
      if (gate !== null && !entry.gates.includes(gate)) entry.gates.push(gate);
    }
  }

  for (const entry of Object.values(stations)) entry.gates.sort((a, b) => a - b);

  // ── Multi Modal Integration ────────────────────────────────────────────────
  // The Phase-1 tab carries the only per-station interchange table GMRC
  // publishes. The Phase-2 tab is prose (see MMI_PROSE) plus a network-wide
  // design standard, which is recorded in _meta rather than claimed per station.
  const mmiTables = mmiHtml.match(/<table[\s\S]*?<\/table>/gi) || [];
  if (mmiTables.length !== 1) {
    throw new Error(
      `Expected 1 table on the MMI page (Phase-1 integration), found ${mmiTables.length}. ` +
        `GMRC changed the page — re-read it before trusting this script.`
    );
  }

  let mmiCount = 0;
  for (const row of parseTable(mmiTables[0]).slice(1)) {
    const [nameCell = '', detailCell = ''] = row;
    const mmiName = stationName(nameCell);
    if (!mmiName) continue;

    const id = MMI_ALIASES[mmiName] ?? NAME_TO_ID[mmiName];
    if (!id) {
      warnings.push(`Unmapped station name on the MMI page: "${mmiName}"`);
      continue;
    }
    if (!stations[id]) {
      warnings.push(`MMI lists "${mmiName}" but the gate page does not — no station to attach it to`);
      continue;
    }

    // Cell 2 is "<summary><br><connection><br><connection>…".
    const [summary = '', ...details] = detailCell.split('\n');
    const { modes, unknown } = parseModes(summary);
    for (const u of unknown) {
      warnings.push(`Unrecognised transport mode "${u}" for ${id} — add it to MODE_TOKENS`);
    }

    const connections = details.map((text) => ({ gate: entryExitNumber(text), text }));

    // Every Entry-Exit the MMI page cites should be a gate the gate page lists
    // as open. If it isn't, the two pages disagree or this row hit the wrong
    // station — either way, don't let it ship silently.
    for (const { gate } of connections) {
      if (gate !== null && !stations[id].gates.includes(gate)) {
        warnings.push(
          `${id}: MMI cites Entry-Exit ${gate} but the gate page lists only ` +
            `${stations[id].gates.join(', ')} as operational`
        );
      }
    }

    stations[id].multiModal = { summary, modes, connections };
    mmiCount += 1;
  }

  for (const prose of MMI_PROSE) {
    if (!mmiHtml.includes(prose.mustContain)) {
      warnings.push(
        `MMI_PROSE for "${prose.id}" no longer matches the page (looked for "${prose.mustContain}") — ` +
          `re-read the Phase-2 tab and update the entry`
      );
      continue;
    }
    if (!stations[prose.id]) {
      warnings.push(`MMI_PROSE targets unknown station "${prose.id}"`);
      continue;
    }
    const { id, mustContain, ...multiModal } = prose;
    stations[id].multiModal = multiModal;
    mmiCount += 1;
  }

  // Cross-check against stations.json so a rename on either side is loud.
  const known = JSON.parse(readFileSync(STATIONS_JSON, 'utf8')).stations;
  const knownIds = new Set(known.map((s) => s.id));
  for (const id of Object.keys(stations)) {
    if (!knownIds.has(id)) warnings.push(`NAME_TO_ID maps to unknown station id "${id}"`);
  }
  const missing = known.filter((s) => !stations[s.id]).map((s) => s.id);

  const out = {
    _meta: {
      sources: {
        gatesAndLifts: GATE_URL,
        multiModal: `${MMI_URL}#mmiahd1 (Phase-1 table) and #mmiahd2 (Phase-2 prose)`,
      },
      scrapedOn: new Date().toISOString().slice(0, 10),
      generatedBy: 'scripts/fetch-station-facilities.mjs',
      rule:
        'Only per-station facts GMRC publishes appear here: station structure, ' +
        'which numbered gates are operational, which lift serves which gate, and ' +
        'which stations physically connect to another transport mode. GMRC does ' +
        'not publish gate landmarks, toilets, Wi-Fi, ATMs or feeder-bus routes ' +
        'per station, so none is recorded — and none should be filled in from ' +
        'third-party sources.',
      liftNote:
        "GMRC's lift numbering is per-station and not sequential with the gate " +
        'numbers (e.g. Paldi has Lift 06 at Gate 02). The numbers are reproduced ' +
        'as printed so signage in the station matches the app.',
      multiModalNote:
        '`multiModal` is present only on the stations GMRC names — absence means ' +
        '"GMRC lists no built interchange here", not "no bus stops nearby". ' +
        '`connections[].gate` is the Entry-Exit number the transfer uses, so it ' +
        'lines up with `gates` and `lifts`; null where GMRC does not state one.',
      modes: {
        brts: 'Ahmedabad BRTS (Janmarg)',
        gsrtc: 'Gujarat State Road Transport Corporation buses',
        'indian-railways': 'Indian Railways',
        'high-speed-rail': 'NHSRCL — Mumbai–Ahmedabad high-speed rail (under construction)',
      },
      phase2Standard:
        'GMRC states this for Phase-2 as a whole, not per station, so it is not ' +
        'copied onto individual stations: "All Ahmedabad Phase II stations are ' +
        'universally accessible, at grade integration through footpaths, cycle ' +
        'track, PBS, drop-off bays, bus bays, and parking facilities." Every ' +
        'Phase-2 station is also designed with pedestrian crossings via entry/exit ' +
        'foot over bridges, pick-up and drop-off areas, dedicated GSRTC and city ' +
        'bus bays, bicycle and two-wheeler parking, and auto-rickshaw space.',
      coverage: `${Object.keys(stations).length} of ${known.length} stations`,
      notCovered: missing,
      multiModalCoverage: `${mmiCount} stations with a published interchange`,
      networkWideFacilities:
        'Facilities offered across the network (escalators, drinking water, ' +
        'wheelchairs, tactile paths…) are not per-station and live in ' +
        'app/src/data/passengerInfo.json.',
    },
    stations,
  };

  writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');

  console.log(`\nWrote ${OUT_JSON}`);
  console.log(`  ${Object.keys(stations).length} stations`);
  console.log(`  ${mmiCount} with multi-modal integration`);
  if (missing.length) console.log(`  not on GMRC's page: ${missing.join(', ')}`);
  if (warnings.length) {
    console.log('\nWARNINGS — read these before committing:');
    for (const w of warnings) console.log(`  ! ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
