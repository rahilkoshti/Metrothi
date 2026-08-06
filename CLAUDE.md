# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no root `package.json` — everything runs from `app/`.

```bash
cd app && npm install
```

| Task | Command |
|---|---|
| Dev server (port 5173) | `npm run dev` |
| Build (also the typecheck gate — runs `tsc -b` first) | `npm run build` |
| Lint | `npm run lint` (oxlint, then `scripts/check-design-tokens.mjs`) |
| Tests, once | `npm test` |
| Tests, watch | `npm run test:watch` |
| Preview a production build | `npm run preview` |

Run a single test file or a single case:

```bash
npm test -- src/features/journey/engine/fareEngine.test.ts
```

```bash
npm test -- -t "name of the test case"
```

CI (`.github/workflows/ci.yml`) runs `lint`, `test`, then `build` from `app/` on Node 22. There is no separate typecheck script — `npm run build` is it.

Data regeneration scripts run from the **repo root**, not `app/`:

```bash
node scripts/fetch-station-facilities.mjs
```

`scripts/fetch-tracks.mjs` rebuilds `tracks.json` from OpenStreetMap Overpass. Both are one-off/occasional and deliberately fail loudly when the upstream source changes shape.

For the browser preview tools, `.claude/launch.json` already defines `dev` and `preview` configurations.

## Two documents that govern changes

**`files/Metrothi-PRD.md` is the master reference.** Read it before any architectural, structural, or feature-scope decision. It holds the product vision, explicit non-goals, and the phased roadmap. New features and architecture changes get documented there *first*, then coded. Commit messages and code comments cite it by section (`§5.7`, `§4.4.1`) — those references are live and worth following.

**`DISCREPANCIES.md` at the repo root is where out-of-scope findings go.** When you spot a bug or inconsistency that isn't part of the task you're on, don't fix it inline and don't drop it — append an entry with file path, line number, and enough context to act on later. Entries are grouped by area and dated against `develop`. Move one to the resolved section when it's actually fixed.

## Architecture

### Engine / UI separation

`app/src/features/journey/engine/journeyEngine.ts` is the core: routing, timetable simulation, live departures, active-train projection. It is pure TypeScript with **zero React imports**, and it imports its data (`data/stations.json`, `data/tracks.json`) directly at module scope. Components call exported functions and render results — they never re-derive transit logic. `fareEngine.ts` sits beside it on the same terms.

Routing uses a deterministic ordered-array approach over the station list rather than a general graph search; stations carry `order` per line and interchanges carry `secondLine`/`secondLineOrder`.

### Data layers — three distinct stores, do not mix them

1. **Bundled transit data** (`app/src/data/*.json`) — stations, tracks, timetable, fares, station facilities, passenger info. Imported at build time, ships inside the precached JS, read-only. **Never put this in Dexie.**
2. **Dexie / IndexedDB** (`app/src/data/db.ts`) — *user* data only: saved stations, saved journeys, recent trips (capped at 5), preferences.
3. **Supabase** (optional) — the sync target for layer 2, nothing else.

Every scraped data file carries a `_meta` block with its source URL, `lastVerified`/`scrapedOn` date, and a `rule` string stating the sourcing policy. `features/info/provenance.ts` surfaces those dates in the app.

### Local-first sync (PRD §5.3, §5.7)

The flow is Dexie first, network second, always:

- A mutation writes to Dexie **and appends to `syncOutbox` in the same transaction**, so a write can never be persisted-but-unqueued. The UI renders the local write and never awaits the network.
- `services/syncEngine.ts` drains the outbox on sign-in, on reconnect, and after each mutation: push (upsert on `(user_id, id)`), then pull rows changed since the cursor, then reconcile.
- Conflict resolution is **last-write-wins per row on `updatedAt`** — not CRDTs, not per-field merge.
- **Deletes are `deletedAt` tombstones, never row removals.** A locally-absent row is indistinguishable from one the server hasn't sent yet, so hard deletes would resurrect everything the rider unfavourited on the next pull. Reads filter tombstones out; the tombstone is the thing that syncs.
- Client and Postgres row shapes differ by more than case (client PKs are `stationId`/`key`/`name`, remote is always `id`), so `syncEngine.ts` maps them explicitly per table via `SPECS`.
- **RLS is the security boundary**, not the client. `supabase/schema.sql` defines four tables with policies restricting every operation to `auth.uid() = user_id`. The bundled key is the anon/publishable one, which is public by design. A `service_role` key must never appear in the repo or in any `VITE_`-prefixed variable — Vite inlines those into client JS.

### The load-bearing invariant

**The app must stay fully usable with no account, no network, and no Supabase project configured at all.** If `VITE_SUPABASE_URL` is unset, `getSupabase()` resolves to `null`, every sync path no-ops, and the only visible difference is the account row saying so. Signing in is an upgrade, never a requirement. Anonymous data created before sign-in is *merged* into the account, not discarded; signing out keeps local data.

### Boot-path budget

This is a map-first app, so the first frame is protected deliberately and in several places at once. Before adding an import, check which side of the boundary you're on:

- `services/supabase.ts` imports `createSupabaseClient.ts` **dynamically**; that file is the only module that statically imports `@supabase/supabase-js`, and it exists purely to give the split chunk a recognisable name. `isSupabaseConfigured` is a plain synchronous boolean so the UI can decide whether to offer sign-in without pulling in the SDK.
- **Both `/you` routes are `lazy()`** — `/you/:topic` because its topic registry pulls in ~19 KB of GMRC prose, and `/you` itself because nothing on the settings screen is needed to draw a map or plan a journey (measured at 5.32 KB gzip off every cold start). Each has its own statically-imported fallback (`YouScreenFallback`, `InfoPageFallback`) that draws the screen's real furniture rather than a spinner, so nothing jumps when the chunk lands. **When measuring a split, sum every JS file `index.html` loads, not the `index-*.js` line** — splitting a route also lifts shared modules like `jsx-runtime` out into their own boot-loaded files, so the entry chunk always appears to drop further than the payload does.
- `features/info/catalog.ts` (what topics exist) is split from `features/info/topics.ts` (their content — the lazy topic chunk) on purpose. `topics.test.ts` asserts every slug in the former resolves in the latter. Neither is on the boot path any more, but catalog still copies its three URLs rather than importing them: a JSON import is all-or-nothing per file, so it would spill the prose into the settings chunk instead of the main one — a smaller cost and the same mistake.
- `features/info/provenance.ts` may only read JSON something else already pulls in. Same all-or-nothing rule: touching `passengerInfo.json` from there would drag the reference prose out of the topic chunk.
- `migrateFromLocalStorage()` and recent-trip writes in `App.tsx` are fired without `await` — an IndexedDB read on the boot path is exactly what this app can't afford. Readers are `useLiveQuery` and re-render when rows land.

**Theme is the one exception, and it is intentional.** It is written to Dexie *and* mirrored to a single `localStorage` key (`metrothi-theme`), read by an inline script in `index.html` before React mounts. An async read there is a visible flash of the wrong theme on every cold start. Dexie stays the source of truth; the mirror is a paint hint allowed to be stale for one frame. **Don't consolidate this into one source, and don't copy the pattern for anything not needed at first paint.**

The mirror holds the **preference** (`system` | `light` | `dark`), not the resolved theme, because `system` can't be reconstructed from a resolved value — the inline script has to know whether to consult `prefers-color-scheme` or honour an explicit choice, and it has to know before it can paint. `system` is the default and the OS wins unless the rider said otherwise. A missing Dexie row means the rider never chose, so a stale `light`/`dark` in the mirror from before this existed is corrected to `system` on hydrate — one frame late, which is exactly what the hint is allowed to be wrong by.

### Shell and routing

`App.tsx` holds a single `MainApp` with four routes (`/`, `/stations/:id`, `/you`, `/you/:topic`) wrapped in `AuthProvider` → `ThemeProvider` → `BrowserRouter`. Planning a journey does **not** navigate — the map and draggable sheet stay mounted throughout planning and the live journey, so `HomeScreen` hosts them and reflects journey state in its sheet. There is no tab bar (`--nav-h` is always `0px`).

PWA config lives in `vite.config.ts`: the built shell is precached (which is what makes airplane-mode planning work), with runtime caching for CARTO basemap tiles, Google Fonts, and Photon geocoding. `navigateFallback: '/index.html'` is what keeps deep links alive offline, since `vercel.json` rewrites are server-side only.

## Project-specific rules

These are all things that look like bugs or cleanup opportunities and are not.

- **Ride time is not `totalMins`.** `totalMins` on a journey option is platform wait *plus* ride. Anything presented as the trip's own duration must use `rideMinsOf()`, which starts at boarding. Getting this wrong bills an 8-minute hop as a two-hour journey when the app is opened before service starts (§5.5).
- **Never fake real-time tracking.** GMRC publishes no live vehicle feed. "Live" departures are simulated from the static timetable inside `journeyEngine.ts`.
- **GMRC-sourced facts only.** `stationFacilities.json`, `passengerInfo.json`, `metroInfo.json`, `fares.json`, and `stations.json` carry only what GMRC states. No wikis, blogs, or transit aggregators. GMRC publishes no per-station toilet, Wi-Fi, ATM, feeder-bus-route, or gate-landmark data — leave those absent. A missing `multiModal` (present on only 10 of 53 stations) means "GMRC lists no built interchange here", never "nothing nearby", so don't render it as a negative.
- **No stand-in station photos.** `stationImages.ts` maps only stations actually photographed; `stationImage()` returns `null` otherwise. In a wayfinding app a photo of the wrong station is worse than none. Callers close up the layout on a miss.
- **UI strings go through `t()`; GMRC's words and proper nouns do not.** `app/src/i18n/` holds three bundles (en/hi/gu) and `en` is the fallback, so a missing key renders English rather than throwing — which is why `locales/locales.test.ts` asserts key parity, orphaned keys, surviving `{{placeholders}}`, and i18next's own plural resolution per language. **Station names, line names, GMRC's verbatim connection wording, mode labels (BRTS, GSRTC…) and the reference-page titles stay English in every language** (§6.8, §6.7): the first two have no official Hindi/Gujarati source in the repo, and translating a row that opens an English page overpromises.
- **A React-free module may decide *which* sentence, never *what* it says.** `liveStatus.ts`, `exitGuidance.ts`, `preferences.ts` and `provenance.ts` are all off the React tree by design and must stay off i18next with it, so each returns a **bundle key plus the proper nouns to interpolate** and the one caller renders it. Their tests assert the data — gate numbers, a preset, a date — not the English sentence. A key that doesn't exist renders as the literal string `live.boardToward` and nothing throws, so anything emitting keys needs a test that looks every one of them up in `en.json` (`liveStatus.test.ts` enumerates all eleven state branches for exactly this).
- **Never derive behaviour or a composed sentence from a translated string.** `StationInput` did (`label === "From"`, `` `Clear ${label}` ``) and silently broke for every non-English rider without throwing. Two corollaries: **a line with optional parts gets one whole key per shape**, never a base sentence with fragments appended — English tolerates appending, Hindi and Gujarati put the verb last, so the clause lands mid-sentence (`live.walkTo` / `walkToThenWait` / `walkDurationTo` / `walkDurationToThenWait` is four keys for four shapes on purpose). And watch for `t` being shadowed: `SavedData`'s `trips.map(t => …)` did it, and the call inside would have been a runtime error rather than a missing translation.
- **The app typeface is `var(--font-app)`, not a literal.** Two screens set `fontFamily` inline, which no `[lang]` CSS rule can override, so the language switch runs through the token exactly as the colours do. Space Grotesk stays **first** in the stack in every language — fallback is per glyph, so Latin keeps the app's face and only Devanagari/Gujarati characters reach the Noto family. The Noto stylesheets are injected per language by `i18n/fonts.ts`, deliberately not added to `index.html`'s render-blocking `<link>` (measured: +1.46 KB gzip on every cold start for a script most riders can't read).
- **Durations, dates and the engine's warning sentences are still English in every language.** `formatDuration` lives in the React-free engine with twelve call sites; that's §6.6 phase 4, not an oversight, and it is not fixable by forking a second formatter.
- **No component declares a colour, a font size or a radius.** They all come from `index.css`, and `scripts/check-design-tokens.mjs` fails the lint if one reappears. This is the rule the interface audit found the app had no way to hold: 63 colour literals and 16 type sizes had accumulated because there was no shared vocabulary to decide in. Where a token existed the app was already correct; where none existed it was chaotic.
  - **Colour:** `var(--c-bg)`, `var(--c-text)`, `var(--c-card)`, `var(--c-accent)`, plus the status ramp (`--c-good` / `--c-warn` / `--c-error` / `--c-info`, each with an 8% `-bg` and a 22% `-border`). Every foreground clears 4.5:1 against every surface in **both** themes; the light values are deeper than a naive pass would give because each also has to survive its own tint. Light is the default and was historically the untested one — check it first.
  - **Type:** ten `text-*` tokens, `text-hero` down to `text-caption`, each carrying size, line-height, weight and tracking together so the four can't drift apart at the call site. Nothing below 12px; nothing answering "should I run?" below 17px. Migration off the old `text-[Npx]` sizes is *in progress* — `scripts/design-tokens-baseline.json` records what's left, ratchets downward, and fails the lint if a file gains a new one or if a fully-migrated file is left in the baseline.
  - **Radius:** `rounded-chip` / `control` / `card` / `sheet`. Named semantically rather than overriding Tailwind's `--radius-sm`, which would silently restyle every existing `rounded-*`.
- **Two files may hold colour literals, both listed in the check with the reason.** `features/journey/constants.ts`, because the four `LINE_COLOR` values map to physical GMRC signage and are fixed across themes; and `features/map/mapColors.ts`, because Leaflet writes them to SVG *presentation attributes*, which cannot resolve `var()`.
- **A line has two colours and they are not interchangeable.** `LINE_COLOR` is the signage hex and is only ever a **fill** — badges, polylines, rails, dots. `LINE_ON_SURFACE` is the theme-aware token used wherever the line has to be **read**, because three of the four signage colours fail against a light surface and the Yellow Line fails by a factor of two. Text on a line fill is `--c-on-line` (black on all four; white reaches only 3.68:1 on blue).
- **Status is never carried by hue alone.** Four hues are already spent on line identity, so every status pairs its colour with a glyph or a word (WCAG 1.4.1) — and status hues are chosen not to collide with the line palette. The live journey used to paint "waiting for train" in `#EAB308`, byte-identical to the Yellow Line.
- **44px is the floor for a hit region, not for a visual.** Where the drawn thing has to stay small — a station dot on the map, a switch, a status pill floating over the map — the visual keeps its size and `.hit-44` (in `index.css`) expands the target with an invisible `::after`. Adjacent controls still need 12px between them; growing a 36px button to 44 eats 4px a side.
- **`viewport-fit=cover` is opted into, so safe areas are the app's problem.** `--sat`/`--sar`/`--sab`/`--sal` are consumed by the floating chrome, the sheet, the FAB and recentre offsets, the sticky headers and the map attribution. `DraggableSheet` needs the inset as a *number* for its snap arithmetic — `useSafeArea.ts` measures it from a probe element, because `getComputedStyle().getPropertyValue('--sab')` returns the unresolved `env()` string on some engines.
- **The map attribution is a licensing obligation.** CARTO's terms and the OSM ODbL both require it; it is not a control to style away. It is positioned above the sheet's lowest resting edge via `--map-attrib-bottom`, which `HomeScreen` publishes from `sheetEdge`.
- **Animation is framer-motion, and Tailwind's `animate-in` utilities do not exist here.** The project is on Tailwind v4 with no `tailwindcss-animate` / `tw-animate-css`, so `animate-in` / `fade-in` / `slide-in-from-*` generate **no CSS** — eight of them sat in the codebase for months animating nothing. Entrances are `motion.div` with `initial` / `animate` / `transition`. Sheets rise on the shared `SPRING` in `components/sheetMotion.ts`, not a per-sheet copy. Note that a page-root entrance cannot start off its own box horizontally: `<main>` has `overflow-y: auto`, which makes its `overflow-x` compute to `auto`, so a 16px lateral offset becomes 16px of real horizontal scroll.
- **Both departure lists render through `features/journey/components/DepartureRow.tsx`** — the home sheet's board and the station page's full-day schedule. They were hand-rolled separately once and drifted. Don't fork it again. Both also read their departures from `hooks/useStationDepartures.ts`, which is the one scan: the sheet header leads with the soonest of them and the board lists every direction, and two passes over the same timetable is how two views start disagreeing about which train is next.
- **A modal surface uses `components/useDialog.ts`, and the sheet is only modal when it holds the planner.** `role="dialog"`, `aria-modal`, focus moved in / trapped / restored, and Escape closing the **topmost** layer — the stack is module-level because a `TrainRouteSheet` can open over a sheet that is itself a dialog, and one Escape should peel one layer. `useDialog` mints its own ref; `useDialogOn` takes one, which is what `DraggableSheet` needs since it owns its root element for measurement and dragging. Deliberately no `inert`/`aria-hidden` on siblings: these overlays render *inside* the tree they would have to hide, and the trap plus `aria-modal` is what the spec actually asks for.
- **The planner is a sheet mode, not an overlay, and its dismissal has two paths that must stay in step.** Dragging it below `full` is the dismissal, so the snap the rider landed on is honoured; the close button and Escape leave the sheet standing at `full` and have to put it back to `mid` themselves, or the planner vanishes and the station sheet appears expanded over the whole map. That is what `closePlanner(viaDrag)` is for — and why the button wires `onClick={() => closePlanner()}` rather than passing the function, which would hand the MouseEvent to `viaDrag` as a truthy value.
- **Reduced motion is one blanket CSS rule plus `MotionConfig reducedMotion="user"`, and the sheet's gesture is exempt on purpose.** Every decorative animation in the app is CSS, so a hand-maintained list of them goes stale the first time someone adds one; `MotionConfig` turns every framer entrance's transform into a snap and leaves opacity animating, which is the "slide becomes a fade" substitution without any component knowing. The sheet follows the thumb through a motion value rather than a transition, so it still tracks — the HIG lists finger-tracked animation as a reduced-motion *technique*. Only the spring it settles with is shortened (`DraggableSheet`'s `settle`).
- **A station board discloses; it never opens on history.** Six upcoming departures per direction, departed trains collapsed to one row, the rest behind "Full timetable". This is also what removed the 360px same-axis scroller nested inside the sheet's own scroller inside its drag, so don't reintroduce a `maxHeight` here. The auto-anchor scroll that used to hide the departed rows is gone with them: the next train is first by construction.

## Testing notes

Vitest runs with Vite's config (there is no separate test config); tests are colocated `*.test.ts` files. Anything touching Dexie imports `fake-indexeddb/auto` as its first line, and Node has no `localStorage`, so tests that exercise the migration stub it via `vi.stubGlobal`. The store's failure modes are all silent — a non-idempotent migration, a delete that removes instead of tombstoning, a write that skips the outbox — so `db.test.ts` exists to assert exactly those.
