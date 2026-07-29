# Known Discrepancies / Deferred Fixes

Running list of code issues spotted but deliberately not fixed yet. Add to this
whenever something is found mid-task but is out of scope for that task. Remove
an entry once it's fixed.

Line references are checked against `develop` on the date in each entry — treat
an older date as "roughly here", not exact.

---

## Engine (`app/src/features/journey/engine/journeyEngine.ts`)

- [ ] `INTERCHANGE_BUFFER_MINS` (line 261) is a flat 3-minute transfer penalty
      for every interchange, applied at `journeyEngine.ts:829`. PRD §5.1 calls
      this out explicitly: "Must be upgraded to per-station walking matrixes
      before v2.0 launch."

## Map rendering (`app/src/features/map/components/HomeMap.tsx`, `map/geometry/trackGeometry.ts`)

_(no open entries)_

## Home station sheet (`HomeScreen.tsx`, `components/DraggableSheet.tsx`, `components/stationSheet/*`)

_(no open entries)_

## Design tokens

_(no open entries)_

## Station detail (`app/src/features/journey/components/StationDetail.tsx`)

_(no open entries)_

## Settings / You screen (`app/src/features/journey/components/YouScreen.tsx`)

_(no open entries)_

## Reference pages (`app/src/features/info/topics.ts`)

Found in the 2026-07-29 source-fidelity audit of all eight topics, which was
prompted by the QR-ticket claim fixed the same day. The three real §7.6 problems
it turned up were fixed then; these three are cosmetic or structural, and are
here rather than fixed inline to keep that change reviewable.

- [ ] **The Metro Rail (O&M) Act citation is attached to one of three statutory
      lists.** `prohibitedSections` prints "Under the Metro Rail (O&M) Act,
      2002." only in the **Offensive materials** section (`topics.ts:294`), but
      all three lists are the Act's — Dangerous materials and Pets & live
      animals both open with the same "No person shall take or cause to be
      taken on the metro railway" statutory phrasing. Not a false claim, just
      unevenly sourced: a rider reading the pets rule cannot see it is law.
      Fix is either one citation per section or one for the page.

- [ ] **The trilingual-poster note renders only under "Don't".**
      `conductSections` puts "GMRC publishes this as a poster in Gujarati,
      Hindi and English…" in the Don't section alone (`topics.ts:233`), though
      the poster carries both columns. Worth more than cosmetics: that note is
      what marks this topic as **unblocked for localization** (§6.7), so its
      placement is the thing a future translator reads to know the Do column is
      equally available.

- [ ] **`.replace()` string surgery on lost-and-found data is silently
      wording-dependent.** `l.office.replace("Lost & Found office, ", "")` and
      `l.officeHours.replace(" hrs", "")` (`topics.ts:434-435`) both match
      today's strings exactly and are correct now. A re-scrape that rewords
      either field makes the replace a no-op and the row reads "Office: Lost &
      Found office, Apparel Park Depot" under a label that already says Office.
      Trim in the JSON, or assert the shape.

**The pattern behind all of these, worth keeping:** every problem the audit
found lived in a **composed** string — one the app builds out of GMRC fields
rather than printing verbatim — and `topics.test.ts` had no assertion of that
kind. It checks structure (non-empty blocks, well-formed URLs, correct counts),
which is why a sentence contradicting the quote printed beside it survived a
green suite. Two targeted tests were added on 2026-07-29; a general "no composed
sentence contradicts its source" check is not expressible, so new composed
prose needs its own assertion each time.

## Route-change scroll position (`App.tsx`, `StationDetail.tsx`)

_(no open entries)_

## Bundle splitting

- [ ] **A named JSON import does not tree-shake per key.** `import { _meta }
      from "./x.json"` reads as if it pulls one key, but Vite emits one module
      per JSON file: any boot-path module touching a file drags the whole thing
      into the main chunk. Verified in build output — an `import { officialApp }
      from "passengerInfo.json"` in `features/info/catalog.ts` put all 12 KB of
      do's-and-don'ts prose in `index.js` and left the lazy `InfoPage` chunk
      with none of it. Worked around by copying three URLs into `catalog.ts`
      under a test that asserts they still match the JSON. A real fix would
      split the handful of boot-needed constants into their own small file at
      scrape time, so nothing is copied and nothing over-imports.

## PWA / offline deviations

- [ ] **Dexie deliberately not implemented.** PRD §5.2/§5.3 originally mandated
      Dexie.js (IndexedDB) for the transit graph, schedules, and user data. The
      PWA/offline work (2026-07-22) instead relies on the transit graph being
      bundled JSON precached by the service worker, and keeps user data in
      `localStorage`. This satisfies the airplane-mode launch criterion (§6.2)
      without Dexie. PRD §5.2/§5.3 have been amended to match. Revisit only if
      saved-journey data outgrows localStorage's ~5 MB budget.
      *(Kept as a recorded decision, not a bug — nothing to fix.)*

---

## Resolved / Fixed

- **[Fixed 2026-07-29]** Three findings from the source-fidelity audit of all
  eight reference topics (the audit's remaining three are open above).
  - **Customer care invented a scope and contradicted its own source.** The
    General Correspondence note read "Anything that is not about a journey —
    tenders, media, recruitment — goes here, not to passenger care." Those three
    examples are on no GMRC page, and GMRC routes non-operational queries to the
    **registered office**, not to that line — so the invented sentence
    contradicted `customerCare.scope`, printed two sections above it on the same
    page. Now states only what GMRC states, and says plainly that the general
    line's scope is unpublished.
  - **A build rule was printed to riders as page copy.** `facilities.note`
    ended "…so do not render these as a per-station amenity list" — an
    instruction to whoever builds the page, rendered verbatim on
    `/you/facilities`. The field was doing two jobs; the internal half moved to
    `_rule`, matching this file's convention that underscore-prefixed keys stay
    out of the UI. The caveat itself was kept — it is the reason the list is not
    per-station, and dropping it would overclaim.
  - **The facilities blurb asserted what its own note retracts.** "What every
    station offers" (`catalog.ts`) claims universal availability directly above
    a note saying GMRC does not state which stations have which. Now "What the
    network offers".

- **[Fixed 2026-07-29]** The fares page's "Where to buy" section covered ticket
  media only, so after §8 phase 6 the planner was sending cross-phase riders to
  a page that said nothing about the NCMC it told them to get. The section now
  carries `cards.ncmc.purchase` plus GMRC's station-sales line, with the same
  single-source hedge the planner's aside uses. Regression-tested.

- **[Fixed 2026-07-29]** The Fares & ticket rules page (`features/info/topics.ts`,
  "Ahmedabad ↔ Gandhinagar") claimed crossing between phases needs "an NCMC card
  **or a QR ticket**". GMRC's quote printed directly beneath it restricts only
  tokens and CSC and says nothing about QR — the page was reading permission out
  of that silence, which is the inference §7.6 exists to prevent. It also
  contradicted the journey planner's cross-phase card, whose NCMC-only rule was
  confirmed against the fare-rules page on 2026-07-20 (entry below). Introduced
  by phase 2, found while writing phase 6; the page now matches the engine.
  Worth generalising: phase 2 rendered GMRC's quote *next to* prose composed
  from it, and the composition drifted from the quote in a way nothing tested.

- **[Fixed 2026-07-29]** The cross-phase ticket card told riders "only an NCMC
  card works" and stopped — PRD §8 phase 6. Our own `metroInfo.cards.ncmc`
  describes NCMC as bank-issued, so the card read as a dead end at exactly the
  moment a visitor (§2) can't act on it; GMRC's MMI page says stations sell
  them. `TicketInfo` gained `where: string | null`, populated on the cross-phase
  branch only and asserted on both the normal and after-last-train paths (the
  latter builds its own `PlanResult` and could have dropped it silently).
  §8 scoped this as "fold in `metroInfo.purchase`", which turned out to be the
  wrong source — that section is about buying *tickets*, and its online half is
  the GMRC app, which sells QR tickets that aren't valid across phases. Strings
  are copied into the engine rather than imported, so `metroInfo.json` stays off
  the boot path (see the phase-2 bundle note).

- **[Fixed 2026-07-29]** A journey now says how to leave the station it ends at
  — PRD §8 phase 3. `features/journey/exitGuidance.ts` reduces the phase-1
  facilities data to the two facts that are a decision when the doors open
  (step-free exit gates; each connection with the Entry-Exit it uses), and one
  `<ExitGuidance>` renders it on both surfaces — `RouteTimeline`'s destination
  row and `LiveJourneyScreen`'s final stop — so the two cannot drift.
  Deviations from §4.2 as written, each deliberate and now in the PRD: it
  renders for the **whole ride, not only the Arrived state** (you want to know
  which exit to walk toward while still on the train); GMRC's connection
  wording is **verbatim minus the "Entry-Exit 5 – " prefix**, since the gate is
  printed beside it and rewriting the rest would be invention; and PDEU's
  parking is **not** treated as a way onward. The surface is `RouteTimeline`,
  not `JourneySummary` as §8 listed — the destination row lives there.
  8 tests in `exitGuidance.test.ts` cover what would otherwise fail silently as
  plausible text: the prefix regex against every published spelling across all
  9 stations with a connection, Ranip's two-gate pairing, Mahatma Mandir's
  gate-less connection, and that **every** station a journey can end at
  resolves (only `sabarmati-railway-station`, which GMRC does not list, returns
  null). Verified live at 375 and 320px by planning Old High Court → Sabarmati
  and starting the journey: both surfaces read "Step-free exit at Gates 2, 3 &
  5" over "Gate 3 · Lift and Skywalk connecting BRTS", zero horizontal overflow
  at either width, no console errors. **Known extreme:** Mahatma Mandir's
  connection is 200 characters and wraps to eight lines (121px) at 320px — kept
  rather than clamped, since a clamp with no "more" affordance would hide the
  useful half, and it is 1 station of 53. `tsc -b --noEmit` clean, suite
  287/287 (was 279).

- **[Fixed 2026-07-29]** Route changes now reset scroll, for every route rather
  than for `/you/:topic` alone. `components/ScrollReset.tsx` is mounted once
  inside `<main>`, keyed on `useLocation().pathname`, and `InfoPage`'s local
  copy is deleted rather than left to duplicate it. It keeps the
  nearest-scrollable-**ancestor** walk — `<main>` carries `overflow-y: auto` but
  never scrolls, so the reset has to find the document instead; measured live at
  `main.scrollHeight === main.clientHeight` while the document stood at 2633px
  on `/you`. The walk stopping at an *ancestor* is what keeps it off the
  scrollers a screen owns inside itself, notably `StationDetail`'s schedule
  list, which parks the next departure at the top on mount.
  **One deliberate addition beyond the entry as written:** it skips `POP`
  (`useNavigationType`). The browser restores the offset itself on back/forward
  for same-document entries, and resetting anyway would mean coming back from a
  topic page dumped you at the top of a YOU screen you had scrolled — verified
  live, back from `/you/safety` restored 1200px exactly. The component renders
  a `display: none` anchor rather than `null` because *which* element owns the
  scroll must be walked to, not guessed.
  Verified live at 375×812 against this session's own dev server: PUSH from
  `/you` at 1200px → `/you/safety` lands at 0; the **second** visit
  (`/you/lost-and-found`, chunk already fetched, so no Suspense fallback to mask
  a no-op — the case that actually failed before) also lands at 0 with a 1205px
  document, so it is a real reset and not a clamp; back restores; `/` still
  mounts the map with no console errors. `tsc -b --noEmit` clean, oxlint clean
  (5 pre-existing warnings, none in the new file), suite 279/279.

- **[Fixed 2026-07-29]** The reference content is reachable — PRD §8 phase 2.
  `passengerInfo.json` and the non-fare half of `metroInfo.json` had **zero
  consumers**: a repo-wide search for either name returned one hit, a comment in
  `fareEngine.ts`. Both now render through one generic `InfoPage` over a block
  model (`features/info/`), reached from two new YOU sections at
  **eight routes** `/you/:topic` plus one direct store link. Deviations from
  §4.5.1 as written, each deliberate:
  - **"Official GMRC app" is a row, not a page.** It holds two store URLs and a
    sentence; a page would be a dead end showing you a button to press. The row
    opens the right store per platform and says which in its second line.
  - **Prohibited items is reordered** — pets and luggage before the statutory
    dangerous/offensive lists. GMRC's order is the Metro Rail (O&M) Act's; the
    question riders arrive with is "can I bring my dog". No fact is altered and
    each `exception` stays attached to the rule it qualifies (organ transplant,
    sniffer dogs — the genuinely useful half).
  - **`metroInfo.luggage` appears on the prohibited page**, not just under
    fares: "can I bring this" includes size, and the limit otherwise existed
    only as item 3 of a nine-item conduct list.
  - **No `numbered` list marker.** Every GMRC list turned out to be a set of
    rules, not a sequence — including lost & found's, which reads like a
    procedure and isn't. Numbering a set invents an order.
  - **Reading typography** (14px medium, `--c-text-2`, relaxed leading) is the
    one place this feature departs from the app's 9–14px bold uppercase
    dashboard voice, which is right for a countdown and wrong for fourteen
    consecutive sentences of rules.
  Three defects were found and fixed *during* verification, none of which
  static checks would have caught: acronyms lowercased by a `.join().toLowerCase()`
  ("cash, upi, pos"); four facility chips clipped inside their card at 320px
  (`FactChip` gained `wrap`, gate chips keep `nowrap`); and the scroll-position
  bug now logged as its own open entry above — `<main>` carries
  `overflow-y: auto` but never scrolls, so the obvious reset was a no-op that
  the Suspense fallback masked on first visit and not after. Verified live at
  375 and 320px in both themes: all eight pages, `tel:`/`mailto:`/external
  hrefs, the unknown-slug redirect, zero console errors, and no regression on
  the Station Info tab that now imports the lifted `FactPrimitives`.
  `tsc -b --noEmit` clean, oxlint clean, suite 279/279 (was 239 — `topics.test.ts`
  adds 40, including guards on the copied URLs and the shared scrape date).
  Bundle: main chunk 550.48 → 540.46 kB, reference prose entirely in the 34 kB
  lazy `InfoPage` chunk, confirmed by grepping the built files rather than
  assumed.

- **[Fixed 2026-07-29]** About & Data reads its dates from the data files'
  own `_meta` (`features/info/provenance.ts`), so they stop needing a manual
  edit each time a file is regenerated. It is a written-out five-line mapping,
  not a generic reader: the files disagree on the field name — `effectiveFrom`
  (timetable), `scrapedOn` (fares, facilities), `lastVerified` (stations),
  `generated` (tracks). The two hand-maintained reference files dated
  themselves in *prose* inside `_meta.source` ("Official GMRC pages, scraped
  2026-07-28"); both gained a real `scrapedOn` field rather than having that
  English parsed. The **Fares row was also wrong, not just stale** — it claimed
  "Estimates only — not sourced from GMRC" long after `fareEngine` was rebuilt
  on real GMRC distance data (see the 2026-07-20 entry below), so it understated
  our own accuracy; it now reads "Read from GMRC 20.07.2026 · charged on
  distance, not stops" and links to the source page.

- **[Fixed 2026-07-29]** `YouScreen`'s `Row` had **no click handler at all** —
  `tappable` drew a button, a hover state and a chevron over an empty
  `onClick`-shaped gap in the props, so every "tappable" row on that screen was
  a dead press. Interactivity is now derived from `onClick`/`href` rather than
  declared, which also means the nine Phase-4/5 stub rows stop pretending: they
  keep their badge and lose the affordance. `href` covers `tel:`, `mailto:` and
  external, and only the last opens a new tab.

- **[Fixed 2026-07-28]** Station Info tab now renders the physical station data
  (PRD §8 phase 1), and its stale doc-comment — which asserted no amenity data
  exists — is rewritten to name both of the tab's sources and point at §4.4.1.
  Three new blocks in `StationInfoPanel`, all fed by
  `features/journey/stationFacilities.ts`: **Entrances** (a chip per open gate,
  GMRC's numbering verbatim so it matches the signage, and deliberately no
  "6 of 8" denominator — GMRC publishes the operational gates, not the built
  ones); **Step-free access** ("Step-free entry at Gates 1, 4, 7 & 8" over a
  lift→gate row per lift, stated positively only); and **Connections** on the
  10 stations with a `multiModal`, as a mode chip row over GMRC's verbatim
  `connections[].text`, each tied to the Entry-Exit it uses. `structure`
  joined the Station Overview tiles as a full-width fifth tile (`StatTile`
  gained a `wide` prop) rather than orphaning one in the 2-column grid.
  **One deliberate step beyond the three specified blocks:** `pdeu` is the only
  station with `amenities` but no interchange (`modes` and `connections` both
  empty), so keying the block off `modes` alone would have hidden its one
  published fact. The block renders when there is *anything* to say, showing
  the amenity chip and `summary`, plus `sourceNote` in fine print since that
  fact came from an image caption. `plannedAmenities` is **not** rendered —
  planned isn't built. All 43 stations without `multiModal` and
  `sabarmati-railway-station` (`stationFacilities()` → `null`, so all three
  blocks and the structure tile close up) render no placeholder and no
  negative. Verified data-side across all 54 stations via a throwaway vitest
  file (since deleted): 53 listed, 10 Connections blocks, every station has at
  least one gate and one lift so no block can render empty, and every gate
  cited by a lift or a connection is one of that station's open gates.
  `tsc -b --noEmit` clean, oxlint clean, suite still 239/239. **Not checked
  live in-app** — the Browser pane again denied localhost navigation to this
  session's dev server, same as the two entries below.

- **[Fixed 2026-07-28]** Station sheet's fitted mid snap capped at ~60% of
  viewport, resolving the map-strip-too-thin item that used to sit in the
  "Home station sheet" section above. It was floored at
  `Math.round(h * 0.12)` in `DraggableSheet.pointsFor` (`DraggableSheet.tsx:98`)
  — free to grow to 88% of the screen, measured live at 715px of an 812px
  viewport on a 4-card interchange, leaving only a 97px map strip once the
  search pill and line-status strip claimed their share, crowding out the
  floating controls. Floor raised to `Math.round(h * 0.4)`, capping the sheet
  at ~60% (~325px of map on the same viewport) — chosen over the two
  alternatives considered (moving the controls into the header; overlapping
  the sheet Material-FAB style) because it's the only one that also restores
  the bare map the tap-to-collapse gesture needs, rather than just
  rearranging controls around an oversized sheet. Trade-off: a 4-card
  interchange's departures now scroll within the mid snap instead of all
  fitting above the fold — same as any other overflow, and the full snap
  already exists for "see everything." `tsc -b --noEmit` clean; confirmed
  working live by the user at 375×812.

- **[Fixed 2026-07-28]** Recenter button (and the pan-to-selected-station
  nudge) no longer assume the sheet is always at its mid snap. `HomeScreen`'s
  `sheetInset` — fed to `HomeMap` as `bottomInset` for both the
  `home-recenter` listener and `PanTo` — was computed from a fixed `midRatio`
  approximation that never read the sheet's actual `snap` state, so
  recentering shifted the map by the same amount whether the sheet was
  collapsed, mid, or fitted extra-tall on an interchange. Replaced with
  `sheetEdge`, the value `DraggableSheet`'s `onRestEdgeChange` already
  measures live for the floating-control fit check — the sheet's real rest
  height at whatever snap and header-wrap state it's actually in.
  `tsc -b --noEmit` clean, full suite 239/239; not yet checked live in-app —
  the Browser pane could not reach this session's dev server (localhost
  navigation denied), so verify by selecting a station at collapsed vs. mid
  and confirming recenter shifts the map by a different amount each time.

- **[Fixed 2026-07-28]** Click-and-drag no longer highlights text across the
  app (sheet, cards, map chrome) on desktop. Added `user-select: none` (plus
  `-webkit-user-select` and `-webkit-touch-callout: none` for Safari/iOS) to
  `html, body` in `index.css`, re-enabled on `input`/`textarea` so the search
  boxes keep normal text selection and editing. `tsc -b --noEmit` clean; not
  yet checked live in-app for the same reason as above.

- **[Fixed 2026-07-28]** Accent foreground unified to black across all accent
  CTAs, resolving the token-vs-hardcode split. `--c-accent-fg` was `#ffffff`
  while three CTAs (`HomeScreen.tsx` Plan-route FAB, `Planner.tsx` primary CTA,
  `StationDetail.tsx` "From here") hardcoded `color: '#000'` directly instead
  of using the token — so the same accent button rendered black-on-orange in
  some places and white-on-orange in others (`StationSheetActions.tsx`,
  `JourneySummary.tsx`, `ErrorBoundary.tsx`, plus several `--c-accent-fg`
  reads in `Planner.tsx` and `AllTrainsList.tsx`, all already using the
  token). **Went with black, not a mechanical "just use the token" rename**:
  the two aren't equivalent for contrast — black on `#f97316` is ~7.6:1, white
  is ~2.8:1, failing WCAG AA even for large text/UI components. So the token
  itself was the thing that was wrong. Changed `--c-accent-fg` to `#000000`
  in `index.css` (accent colour doesn't change between themes, so neither
  does its foreground — no dark-mode override needed) and pointed the three
  hardcoded spots at `var(--c-accent-fg)` instead of `'#000'`, so all six-plus
  accent CTAs now render identically and pass contrast. Verified live: the
  Plan-route FAB, "Start Journey", and "From here" all compute to
  `rgb(0, 0, 0)` on `rgb(249, 115, 22)`; the Planner's CTA uses the identical
  one-line pattern and reads the same token, unverified live only because the
  planner overlay's ref map kept going stale under browser automation — not a
  reason to doubt it. `tsc -b --noEmit` clean; suite still 239/239 (CSS-only).

- **[Fixed 2026-07-28]** "View all →" no longer routes away from the sheet.
  `UpcomingTrains` navigated to `/stations/:id` for the full-day schedule, but
  the sheet's own full snap already renders the identical schedule
  (`StationDetailBody`, `showHero={false} showActions={false}`) — two routes to
  one piece of content, and only one kept the map mounted. `UpcomingTrains` now
  takes an `onViewAll` callback instead of calling `useNavigate` itself;
  `HomeScreen` wires it to `setSnap('full')`. The standalone `/stations/:id`
  route is untouched — it still exists for deep links, "From here"/"To here"
  hand-off, and its hero/phase/position-on-line info the sheet doesn't show —
  this only changes what the in-sheet "View all" button does. Verified live:
  clicking it expands the sheet to the full day's schedule (Blue Line, Red
  Line, etc.) while `location.pathname` stays `/` and the map stays mounted
  underneath. `tsc -b --noEmit` clean; no other call sites of `UpcomingTrains`
  existed to update.

- **[Fixed 2026-07-28]** Sheet surface now uses `--c-card`, not `--c-bg`. The
  design reference shows a white sheet with grey inset chips and cards;
  `DraggableSheet` had it backwards — sheet at `--c-bg` (#f4f4f5 light) with
  white cards, the same contrast, inverted. Flipping the sheet's own background
  to `--c-card` (`DraggableSheet.tsx`) meant every direct child that read
  `--c-card` as "the card colour" would go white-on-white, so all of them
  flipped to `--c-bg` instead, becoming the grey inset content the reference
  shows: `HomeScreen`'s `Chip` and its three sheet-header icon buttons (clear
  route, walking directions, save), `UpcomingTrains`'s empty-state card,
  `JourneySummary`, `AllTrainsList`, `RouteTimeline`, and four pill/chip spots
  in `LiveJourneyScreen` — all confirmed used only inside `DraggableSheet`, so
  none of this touches anything outside the sheet.
  Two components don't get that blanket treatment because they're **shared
  with the standalone `/stations/:id` page**, which sits on the grey `--c-bg`
  page background and still wants a white card there:
  - `DepartureRow` gained an `inset?: boolean` prop (default off). `UpcomingTrains`
    passes it (rows sit directly on the sheet); the full-day schedule's rows
    (`MergedTrainList`) don't, because they already sit inside an
    explicitly-grey scroller regardless of the ambient surface.
  - `StationDetailBody` / `LineScheduleCard` gained a `surface?: 'page' |
    'sheet'` prop (default `'page'`), so the schedule card is grey inside the
    home sheet's full snap but stays white on the standalone page. `HomeScreen`
    is the only caller that passes `surface="sheet"`.
  Verified live in both themes via the app's real theme toggle (not a forced
  `data-theme` attribute, which the ThemeContext fights): sheet/inset pairs are
  `#fff`/`#f4f4f5` (light) and `#1a1a1a`/`#0f0f0f` (dark) in all three sheet
  modes, while the standalone page's schedule card stays `#fff`/`#1a1a1a`
  against its grey page background, unchanged in both themes. `tsc -b --noEmit`
  clean; full suite still 239/239 (CSS-only elsewhere, so untested by design).

- **[Fixed 2026-07-28]** Failing test: "distance-weighted segment times >
  segment time shares are proportional to inter-station distance"
  (`journeyEngine.test.ts:265`). **Not an engine bug — the test's expectation
  used the wrong distance metric.** `travelMinsBetween` weights each segment by
  along-track distance (`tracks.json`'s `stationKm`, the real curved
  alignment), but the test computed its "expected" ratio from `haversineKm`
  (straight-line distance between the station pins). For the two segments
  compared (`sp-stadium`↔`commerce-six-road` vs `rabari-colony`↔`amraivadi`),
  those two distance metrics disagree because the actual track curves —
  confirmed by recomputing both: the along-track ratio is exactly
  `1.2019970314397526` (what the engine produces) while the haversine ratio is
  `1.1985712552604897` (what the test expected), a `3.4e-3` gap that has
  nothing to do with float precision. Fixed by having the test read the same
  `stationKm` table the engine uses instead of haversine. All 239 tests now
  pass (`npx vitest run`); `tsc -b --noEmit` clean.

- **[Fixed 2026-07-27]** Duplicate place suggestions. Typing "vastral" rendered
  three character-for-character identical rows ("Nearest to Vastral, Rabari
  Colony → Vastral"), separable only by walk distance (14 m / 2 m / 15 m).
  **The cause was not the one originally suspected** — neither the in-flight
  GeocodingService change nor the removed `proxy/geocode-worker` was involved;
  Photon is called directly and answers correctly. The duplicates are upstream:
  OSM maps that one place as three objects (`N9655564690`, `W1198140892`,
  `N6432742907`, all within ~15 m, all `type: house`) carrying identical
  `name` + `suburb`, and `searchViaPhoton` turned each into its own `PlaceNode`
  keyed `place_${lat}_${lng}` — distinct ids, colliding labels, no dedupe.
  `dedupePlaces` now collapses them in two passes: exact rendered-label match
  (the common case), plus same-base-name within 50 m (`SAME_PLACE_KM`), which
  catches one object tagged `suburb` and its twin tagged only `district`
  rendering as two strings for one doorway. Because Photon applies `limit`
  server-side *before* dedupe, the request over-fetches (`FETCH_LIMIT = 15`) and
  trims to `MAX_RESULTS = 5` after — otherwise filtering would have shrunk
  "vastral" from 5 rows to 3.
  Verified against the live API through the real module: "vastral" still returns
  5 rows, the duplicates replaced by genuine places (Vastral Bus Depot, Vastral
  Lake Park); "vastral gam" collapses 3 → 1. Checked for over-merging across
  sabarmati / ashram road / iim ahmedabad / gandhinagar / law garden — all still
  return 5 distinct results, and `IIM Overbridge, Vastrapur` vs `IIM Overbridge,
  Panjrapole` correctly survive as separate rows despite sharing a base name.
  The other half of the original report — "five identical *Old High Court,
  Usmanpura* rows for Vastral Gam" — no longer reproduces at all; that was a
  separate fault (a stale cache hit, or a race showing the previous query's
  results) and had already gone.

- **[Obsolete 2026-07-27]** "Full-viewport screens still hardcode an 80px
  tab-bar offset" no longer applies: **the tab bar is gone.** `App.tsx:74–76`
  now pins `--nav-h` to `0px` with the comment "No tab bar", and a repo-wide
  search finds no remaining `80px`, no `100vh`, and no `MapFallback` — the
  component the entry named. Retired without code changes; nothing to fix.

- **[Obsolete 2026-07-27]** "Sub-44px touch targets in shared components" —
  all three named targets are gone or fixed. `LocationNotice`'s Retry button
  carries `min-h-[44px]` (`LocationNotice.tsx:53`); `StationDetail`'s direction
  tabs no longer exist, the schedule having become one merged time-sorted list
  (`StationDetail.tsx:20`, `:141`); and the `App.tsx` tab-bar links went with
  the tab bar. Retired without code changes.

- **[Partly fixed 2026-07-27]** Floating map controls no longer pinned to the
  collapsed peek. `DraggableSheet` gained `onRestEdgeChange`, which reports how
  tall the sheet stands at its current *snap* (`height - snapY[snap]`) — fired
  per settled snap, not per frame, and accounting for a header that outgrows
  `collapsedHeight`, which the caller cannot compute from its own constants.
  `HomeScreen` anchors the Plan-route FAB and Recentre button to that instead of
  `COLLAPSED_H`, so they follow the sheet at every snap. They now hide only when
  they genuinely don't fit (`controlFits`, `TOP_CHROME_H = 128`) rather than
  whenever `snap !== 'collapsed'`. Verified live: at an 812px viewport both are
  on-screen with `pointerEvents: auto`; shrinking to 600px flips both to `none`.
  The map's `bottomInset` still uses the separate `sheetInset`, which
  deliberately tracks the *mid* inset regardless of snap. **Still open:** on a
  4-card interchange the mid snap leaves no room at all — see the open entry
  above.

- **[Fixed 2026-07-27]** Station-to-station journeys no longer render phantom
  "Walk 1 min" rows. `HomeScreen`'s 15s recompute passed the `sourceStation` /
  `destStation` *object* back into `planJourney`; the engine treats any
  non-string input as a place, so it ran `findNearestStation` and re-tagged each
  station as a place ~0 km from itself. Now passes `.id`
  (`HomeScreen.tsx:234-235`). `App.tsx handlePlan` was already correct
  (`source.isPlace ? source : source.id`), so only the recompute was affected.
  Guarded by three tests in `journeyEngine.test.ts` — a station-id plan has no
  place and no walk, the same holds across the recompute round-trip, and a place
  source still walks so the guard isn't vacuous.

- **[Fixed 2026-07-25]** Dead-code components removed. `MapScreen` and
  `StationsDirectory` were imported nowhere; deleted both, plus
  `StationBottomSheet` (used only by `MapScreen`, so orphaned by its removal).
  `LiveTrainsLayer` was kept — it's shared with `HomeMap`. Stale `MapScreen`
  references in a `HomeMap` comment and a PWA-section note were also cleaned up.

- **[Fixed 2026-07-25]** `StationDetail` SEO page's "From here"/"To here"
  buttons now work. `StationDetailBody` gained an optional `onPlanIntent` — the
  home sheet still falls back to the `home-plan-trip` event, while the standalone
  `/stations/:id` page passes a handler that navigates to `/` with the plan
  intent in router state (`{ planTrip: { source | dest } }`). `HomeScreen` reads
  that state once on mount, opens the planner with the prefill, then clears the
  state (`replace`) so a refresh/back-nav doesn't reopen it.

- **[Found 2026-07-25, not fixed]** Dead `animate-in` / `fade-in` /
  `slide-in-from-top-*` classes across the app (e.g. the `HomeSearch` overlay
  root, `Planner.tsx` dropdown, other overlays). The project is on **Tailwind v4
  with no `tailwindcss-animate` / `tw-animate-css`**, so these utilities generate
  **no CSS** (`getComputedStyle` → `animation-name: none`) and the intended
  entrance animations simply don't happen for real users. Fix options: add
  `tw-animate-css` and `@import` it, or replace with framer-motion /
  hand-written `@keyframes`. (The search-suggestions entrance was done with
  framer-motion instead.) Out of scope for the UI-parity search work.

- **[Added 2026-07-23]** Home-map viewport is now fenced to the metro area. Set
  `maxBounds` (network box padded ~25%), `maxBoundsViscosity: 1.0` (hard fence —
  the drag stops solid at the edge, no bounce-back), `minZoom: 11` (zoom-out
  locked to the whole-network view) and `maxZoom: 18` (free close-up within the
  box). Verified live: zoom-out clamps 3→11, zoom-in clamps 25→18, a pan toward
  Mumbai keeps the centre inside the bounds.

- **[Fixed 2026-07-23]** Home-map station markers floated off the line. Once the
  polylines switched from station chords to real OSM track geometry (commit
  468c12f), markers still rendered at raw `stations.json` coords and drifted up
  to ~52m off the drawn track. Markers now snap to the track via
  `stationPointOnTrack()` (projection stored as `stationKm`), verified on-screen
  to <1px. Terminal markers additionally rotate perpendicular to the track using
  `trackScreenAngleAtStation()` (exact vs Web Mercator; see the open caveat above
  re: Leaflet's drawn-line simplification).

- **[Fixed 2026-07-23]** Live train markers now indicate direction of travel.
  The old marker was a colour dot with a static, non-directional train glyph.
  Each train now renders a white arrowhead rotated to its on-screen heading
  (`trainHeadingDeg()`, from two track points straddling the train's progress in
  the from→to direction). Verified: arrows lie along the track and point forward
  — across a 4s window all 17 trains' arrows matched actual movement direction to
  within ~10°, none reversed.

- **[Fixed 2026-07-23]** `LiveTrainsLayer` never actually rendered. `onAdd`
  attached its SVG group via `map._renderer._svg`, but Leaflet 1.9's SVG
  renderer has no `_svg` property (the `<svg>` is `_container`, its content group
  is `_rootGroup`), so the group was never inserted and no trains appeared. Now
  attaches to the renderer's `_rootGroup` (via `map.getRenderer(this)`), the same
  coordinate space as the vector polylines. Also fixed a listener leak: `onAdd`
  and `onRemove` passed separate `() => this.render()` closures to `on`/`off`, so
  the `move zoom` handler was never detached — now a single stored `onMapMove`
  reference is used for both.

- **[Fixed 2026-07-23]** Three TypeScript build errors in the in-flight
  map/home WIP cleared, restoring a clean `tsc -b --noEmit`:
  - `HomeScreen.tsx` — the service-status message was built from an object
    literal that read `status.minsUntilFirst` on every variant; replaced with a
    `switch` that narrows the union, so only `before-first-train` reads it.
  - `HomeMap.tsx` — removed the unused value-imported `ReactNode`.
  - `LiveTrainsLayer.tsx` — `TrainRenderer.onRemove` now returns `this` to match
    Leaflet's `Layer.onRemove` signature.

- **[Fixed 2026-07-21]** `TS6133: 'walkMinsForKm' is declared but its value is
  never read` in `useJourneySession.ts` broke `npm run build`. The in-flight
  edits replaced that call with `result.sourceWalkMins` and left the import
  behind; import removed.

- **[Fixed 2026-07-20]** `LINE_META` run-time denominators for red and yellow lines corrected (red: 35 / 14, yellow: 43 / 20) to match actual segment counts.
- **[Fixed 2026-07-20]** `computeStopTimeline` now correctly divides `travelMins` over `len - 1` segments for post-interchange legs instead of `len - 2`.
- **[Fixed 2026-07-20]** Walk estimate correctly uses `result.sourceWalkMins` if available, instead of blindly falling back to `DEFAULT_WALK_MINS`.
- **[Fixed 2026-07-20]** Journey progress state no longer resets on minimize/maximize; `useJourneySession` was lifted up to `MainApp` in `App.tsx`.
- **[Fixed 2026-07-20]** Fare calculation rebuilt on real GMRC distance data (`fareEngine.ts`) instead of the guessed station-count slabs in the old `fares.json`; see PRD §5.4.
- **[Fixed 2026-07-20]** Cross-phase ticket rule ("only NCMC works between Phase 1 and Phase 2") and the CSC/NCMC 10% discount are now confirmed against GMRC's `fare-rules` page and recorded in `app/src/data/metroInfo.json`. The discount is display-only and intentionally not applied to any fare.

---

## Template for new entries

```
## <area> (`path/to/file.ts`)

- [ ] <what's wrong> — <where/how to fix it>
```
