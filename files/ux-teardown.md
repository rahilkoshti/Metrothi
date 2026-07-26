# Metrothi — UX/UI Teardown

**Date:** 2026-07-26 · **Branch:** `develop` · **Reviewed:** running app at 375×812, light + dark, location denied (the default state for most first-time users), plus source.

---

## Read this first

Metrothi has no free trial. So I retargeted the funnel to the real conversion event:

> **A stranger opens this in a browser, believes the numbers, uses it to catch one train, and installs it to their home screen.**

Everything below is graded against that. "Would I trust this app with a train I can't afford to miss?" is the only question that matters. Right now, three separate things answer *no* before the user reaches the platform.

**Verification note:** every factual claim here (contrast ratios, DOM sizes, missing handlers, negative values) was measured in the running app or grepped from source, and is cited. Aesthetic calls are flagged as opinion. One thing I initially suspected — that the Plan Route FAB was unclickable — turned out to be a browser-harness coordinate artifact, not an app bug. It is **not** in the list below.

---

# Pass 1 — The designer teardown

I've spent an hour in this thing. Here's what I see.

## The good news, briefly

The bones are genuinely strong. Map-as-canvas with a contextual sheet is the right architecture — it's what Citymapper spent years converging on. `DraggableSheet` is properly built: real velocity-based flick detection, correct scroll/drag handoff, pre-paint position seeding so it doesn't flash at `y=0`. Someone who cares wrote that file. The `SearchBar` idle/active shared-geometry trick — one pill, two states, identical x-offset so nothing jumps on open — is a detail most teams never get to. The journey engine is real: distance-based fares from actual slabs, interchange waits, stranding detection.

That's the frustrating part. The engineering is a B+. The product surface is a D, and the gap is almost entirely in **trust, contrast, and finishing**.

## 1. The app tells you it's fake

Start a journey. The live screen renders a badge that says **`SIMULATED`**, next to two controls labelled **`Simulate`** and **`+5 min`**. Open Settings and the footer reads **"Phase 1 — all features simulated, no auth."**

This is the single most expensive design decision in the product. You built a real timetable engine, hand-transcribed from GMRC, and then stapled a sign to the front of it that says *don't believe me*. A rider deciding whether to run for a train does not parse the epistemology of "simulated from timetable." They read "fake" and close the tab.

The honesty instinct is right — you *should* disclose that there's no real-time feed. But disclosure belongs in one calm line in About ("Times from the published GMRC timetable — no live vehicle feed"), not as a badge on the live journey screen and not as debug controls shipped to production.

`Simulate` and `+5 min` are developer scaffolding. They are in the user's face, in the thumb zone, next to `End`.

## 2. Orange is doing two contradictory jobs, and losing both

`--c-accent: #f97316`. Measured against its own foregrounds:

| Usage | Ratio | Verdict |
|---|---|---|
| **`Start Journey`** — white on orange, 15px | **2.80:1** | ❌ Fails AA (needs 4.5:1) |
| `View Route Options`, `From here`, FAB | **7.49:1** | ✅ Black on orange |

So the *most important button in the entire product* — the one that converts a planner into a rider — is the only accent button that fails contrast, and it looks different from every other accent button in the app. `--c-accent-fg` is `#ffffff` and is never redefined for dark theme either, so it fails identically in both.

Pick one. It should be black-on-orange, because `#f97316` is a light-ish orange and white will never work on it.

## 3. The light theme is the default, and it's the broken one

`ThemeContext` defaults to `light` and **never reads `prefers-color-scheme`**. A user whose phone is in dark mode gets a full-brightness white app. That's a bad first half-second.

It's also the theme where the color system falls apart. Measured:

| Token / usage | On | Ratio | Verdict |
|---|---|---|---|
| `Live` status text `#22c55e` | light pill | **2.07:1** | ❌ Illegible |
| Yellow line `#EAB308` as text | white | **1.92:1** | ❌ Illegible |
| `CURRENT_TEXT.yellow` `#CA8A04` | white | **2.94:1** | ❌ Still fails |
| Service-warning chip `#f0997b` | white card | **2.20:1** | ❌ Illegible |
| `LocationNotice` title `yellow-600` | light | **2.94:1** | ❌ Fails |
| `--c-text-4` `#71717a` (used at 9–11px everywhere) | light bg | **4.40:1** | ❌ Fails AA |

The `CURRENT_TEXT` one is telling. There's a comment in `LiveJourneyScreen.tsx:22` that says *"raw line yellow (#EAB308) fails on the light background, so it gets a darker stand-in."* The problem was correctly diagnosed and then fixed by eye rather than by measurement — `#CA8A04` is still nearly 2× short. That's the pattern across the whole palette: someone's taste caught the issue, nobody ran the numbers.

`--c-text-4` is the worst of it because it's load-bearing. It's the color of every eyebrow label, every "44m ago", every secondary time. At 9–11px and 4.4:1 it is the *default* state of most of the small type in the app.

## 4. Dark mode has no dividers

`--c-border: #1f1f1f` on `--c-card: #1a1a1a` = **1.06:1**. That is not a low-contrast border. That is *not a border*. Every `borderBottom` separating departure rows, every `RowDivider` in Settings, every card edge — invisible. Dark mode renders as undifferentiated slabs of near-black with floating text.

`--c-border-2: #2a2a2a` on `--c-bg: #0f0f0f` = 1.34:1. Same story for the sheet's own outline and the grab handle.

## 5. Nothing respects the notch

`index.html` sets `viewport-fit=cover` — which explicitly opts the app *into* drawing under the notch and home indicator. There is then **zero** `env(safe-area-inset-*)` anywhere in the codebase (grepped: one hit, the meta tag itself).

Measured live: `Start Journey` renders at y=749–803 in an 812px viewport. **9px of clearance.** On any modern iPhone the home indicator sits directly on top of the primary CTA. The collapsed sheet peek (118px) has the same problem — the distance/walk-time chips are in the gesture bar.

This is a two-line fix that's currently making the app feel broken on exactly the devices it's designed for.

## 6. Number treatment is unfinished

The brief says: *"This app is full of times, distances, counts, and countdowns... Tabular, legible, well-hierarchied numerals are a huge part of feeling trustworthy."* Correct. Here's what actually renders, all on screen at once:

```
3min          19 min        3 mins left
1h 04m        46M AGO       ~450m        every 12 min
```

Six formats. No space / space / space+plural. Lowercase `min` and uppercase `M AGO`. `1h 04m` mixes zero-padded and non-padded in one string. `~450m` uses no space while `12 min` does.

`tabular-nums` is applied inconsistently — present on the departure clock times, absent on `formatDuration` output in several places, so countdowns visibly jitter as digits change width.

## 7. The map is a background, not a character

The brief explicitly asks for the map to be "a character." Right now it's a stock CARTO `light_all` / `dark_all` raster tile with colored polylines on top. It looks like every Leaflet demo ever built. The Vignelli-style station labels in `index.css` are the one piece of real point-of-view in the whole map, and they're fighting an off-the-shelf basemap underneath.

Station markers measure **12×12 to 22×22px** — tap targets on the primary interaction surface, at roughly a quarter of the 44px minimum.

## 8. Settings is a room full of doors that don't open

`YouScreen.tsx` has **eight** rows rendered as `<button>` with `cursor: pointer`, a hover state, and a `›` chevron. It has **two** `onClick` handlers in the entire file — the theme toggle and the back button. The `Row` component doesn't even accept an `onClick` prop.

Sign in · Walking speed · Default departure station · Saved places · Saved journeys · Past trips · Report a timetable issue · Suggest a feature — **all dead.** Every one has full affordance and zero function.

Six of them are badged `Phase 4` or `Phase 5`. That's internal roadmap vocabulary on a user-facing screen. Nobody outside your repo knows what Phase 4 means or when it arrives.

## 9. Small stuff that reads as "unfinished"

- `🌙 Dark mode` / `☀️ Light mode` — emoji, in an app that otherwise uses lucide throughout. Off-brand.
- The Planner is a full-screen white takeover that **throws the map away entirely**, with its only exit a small `X` in the top-**right** — the hardest corner to reach one-handed on a large phone. The brief asks for spatial and thumb-reachable; this is neither.
- `LINE_BADGE_BG` and `LINE_COLORS` in `constants.ts` are byte-identical objects with different names.
- `attributionControl={false}` on CARTO tiles with no attribution rendered anywhere. That's a licensing obligation, not a style choice.

---

# Pass 2 — First-time user, clicking through

Fresh browser. No location permission. Here's my run, in order, with the moments I'd have left.

**0:00 — Open.** Map, search bar, four line pills. Genuinely nice. Blue/Red/Yellow say `Live` with a pulsing dot; Violet says `In 15 min`. I like this immediately — I can see the system is awake. *(Though I can barely read the green `Live` text: 2.07:1.)*

**0:04 — The sheet says `DEFAULT STATION`.** Not "your location is off" — "DEFAULT STATION," in 10px caps. I don't know what that means. Is it *my* default? Did I set it? Below it, `Old High Court` with an `INTERCHANGE` tag. I have no idea if this is near me or a random guess. **First wobble.**

**0:09 — I drag the sheet up.** Now there's a yellow banner: *"Location access is blocked — showing default station."* Good, that's the answer — but it was hidden below the fold, four seconds after I needed it. The banner is also only readable at 2.94:1.

**0:12 — The departure board.** This is where I nearly leave.

The first five rows are trains that **already left**: `06:34 AM — 46M AGO`, `06:50 AM — 30M AGO`, `07:10 AM — 10M AGO`. Struck through, greyed, but they're the first thing in the list and they occupy the top of the panel. I opened a transit app and the first thing it showed me is history.

I scroll. It keeps going. `08:22`, `09:14`, `11:38`, `01:26 PM`, `04:50 PM`, `08:14 PM`... Measured: **9,524px of content in a 360px window** — about 26 screens of train times, the entire operating day, for a station I didn't choose. There are **two** of these boards stacked (Old High Court is an interchange), 9,524px and 9,808px. Total page weight: **~4,000 DOM nodes and 333 buttons** on the home screen at rest.

There's an auto-scroll that's *supposed* to park me at the next train, but it lands me with two departed trains still above the fold, so the impression stands.

And there are **four** rows labelled `· NEXT` — two directions × two lines. Four "next trains." Which one is mine? I don't know, and nothing tells me.

> **What I want here is one number.** "Next train: 8 min, toward Thaltej Gam." Everything else is a disclosure.

**0:30 — Tap Plan Route.** Full-screen white panel. Map gone. `Where to?` — nice headline. From is pre-filled `Old High Court` (the station I never confirmed). Close button is top-right; I'm holding the phone in my right hand and can't reach it.

**0:38 — I type "Motera."** The dropdown gives me:

```
STATIONS
  Motera Stadium                        [R]
PLACES
  Motera Stadium, Sabarmati             Select to find nearest station
  Motera- chandkheda road, Sabarmati    Select to find nearest station
  Motera Stadium Road, Asarva Taluka    Select to find nearest station
  Motera Stadium Exit Road, Sabarmati   Select to find nearest station
  Motera Stadium Entry Road, Sabarmati  Select to find nearest station
```

Six options. Five are unfiltered geocoder noise for the *same place*, and every one has the identical, meaningless subtitle "Select to find nearest station." There is a real metro station literally called Motera Stadium and it's competing for attention with "Motera Stadium Exit Road."

Nobody wants the Exit Road. **Second serious wobble** — this is the moment the app stops feeling curated and starts feeling like a wrapper around an API.

**0:52 — Pick the station, tap `View Route Options`.** (Weak, committee-sounding label. It's a verb-noun-noun. "Find trains" or just "Go.")

**0:55 — The results sheet. This is where I would actually leave.**

The `UPCOMING TRAINS` row shows four departures. The first one — **selected by default, highlighted in orange** — reads:

> **07:22 AM**
> **in -1 min**

**Negative one minute.** And the entire summary above it is computed from that train: `FARE ₹15`, `JOURNEY 19 min`, `ARRIVAL 07:42 AM`. The `ALL TRAINS TODAY` list repeats it: `LEAVE IN -1 MIN`.

I am being offered, as the recommended plan, a train I have already missed, with an arrival time that is arithmetically impossible.

There's a real signal buried in there — `leaveInMins` subtracts your walking time from the departure, so "-1" honestly means *you'd have to have left a minute ago*. That's genuinely useful information. But rendered as a raw negative integer, pre-selected as the default, it reads as a broken app. A rider who books this misses their train.

*(Related: the `JOURNEY` stat is labelled "total" but is actually now→arrival, so it shows 19 min for the departed train and 31 min for the next one — same 8-stop ride. The metric changes meaning per option.)*

**1:10 — The route timeline.** Mostly good — I can see every stop. But:

- `Old High Court` / "Walk 1 min to Old High Court" / `Old High Court` — origin name three times in a row. Same at the destination.
- "Walk 1 min to Old High Court" — **the app doesn't know where I am.** It told me so itself, 60 seconds ago. It's inventing a one-minute walk from a location it explicitly failed to obtain.
- `Sabarmati Railway StationSOON` — missing separator, renders as one word. Also: my route passes through a station that isn't open yet, and nothing explains what that means for me. Do I ride through it? Does it stop?

**1:25 — `Start Journey`.** Orange button, white text, 2.8:1, and its bottom edge is 9px from the viewport floor — under the home indicator on my phone.

**1:27 — Live journey.** Header says **`SIMULATED`**. Below: `End` `Save` `Share` `Simulate` `+5 min`.

*Simulated.* After all that — after the fare slabs and the interchange math and the stop-by-stop timeline — the app labels its own output fake and hands me a fast-forward button.

Other copy in the same view: *"Walk 1 min to Old High Court, then wait up to 0 mins."* Wait up to zero minutes. And the boarding time `07:24 AM` appears twice, ~30px apart, on the same row.

**1:40 — Settings, to see if I can turn the simulation off.** Eight rows with chevrons. I tap `Default departure station` — nothing. `Saved journeys` — nothing. `Report a timetable issue` — nothing. All eight are dead. Six say `Phase 4` / `Phase 5`. The footer says *"Phase 1 — all features simulated, no auth."*

**1:50 — I close the tab.** I never installed it.

---

# The fix list

Ordered by impact on that one conversion event. Each item is scoped to be independently implementable.

---

## 🔴 CRITICAL — the app is losing users on these

### C1. Never surface a negative departure time; never pre-select a missed train
**Where:** `app/src/features/journey/engine/journeyEngine.ts:1068`, `app/src/features/journey/components/journeySheet/JourneySummary.tsx`, `AllTrainsList.tsx`
**Evidence:** Live app — default-selected option chip reads `in -1 min` with `background: rgb(249,115,22)` (selected). `ALL TRAINS TODAY` shows `LEAVE IN -1 MIN`. Root cause: `leaveInMins: Math.round((leaveTimeMs - actualNow.getTime()) / 60000)` where `leaveTimeMs = departTimeMs - sourceWalkMins*60000`, with no floor and no filter.

**Fix:**
1. In `planJourney`, default `selectedOptionIdx` to the first option with `leaveInMins >= 0`, not index 0.
2. Add a formatter that never prints a negative: `leaveInMins <= 0` → `"Leave now"`; if `departTimeMs` itself has passed → drop the option entirely.
3. Render still-catchable-but-tight options (`leaveInMins < 0` but train hasn't departed) in a distinct "tight connection" style — greyed, not selectable as the default — rather than as a raw negative.
4. Recompute the `FARE / JOURNEY / ARRIVAL` summary from the newly-defaulted option.

### C2. Cut the departure board from the whole day to the next few trains
**Where:** `app/src/features/journey/components/StationDetail.tsx:22-177` (`MergedTrainList`), `fullDayStationSchedule`
**Evidence:** Measured live — two scrollers of **9,524px** and **9,808px** content inside 360px viewports. Home screen at rest: **3,960–4,192 DOM nodes, 333 buttons**. First five rows are departed trains (`46M AGO`, `30M AGO`, `10M AGO`). Four separate rows labelled `· NEXT`.

**Fix:**
1. Default the list to **next 4–6 upcoming departures per direction**. Add an explicit "Full timetable →" affordance for the rest.
2. Do not render departed trains by default. At most, collapse them to a single tappable "3 earlier trains" row.
3. Disambiguate the four `NEXT` labels — group by direction with a clear heading (`→ Thaltej Gam` / `→ Vastral Gam`), and per line when interchange.
4. Lead the collapsed sheet with **one** number: next train, minutes, direction.

*This is also the single biggest perf win available — it removes ~90% of the home screen's DOM.*

### C3. Remove `SIMULATED` badge and debug controls from the live journey
**Where:** `app/src/features/journey/components/LiveJourneyScreen.tsx` (`SIMULATED` badge, `Simulate` toggle, `+5 min` / `fastForward`, `useAutoPlay`), `YouScreen.tsx:242`
**Evidence:** Live sheet text: `SIMULATED · 19 min · End · Save · Share · Simulate · +5 min`. Settings footer: `Phase 1 — all features simulated, no auth`.

**Fix:**
1. Delete the `SIMULATED` badge from the live header.
2. Gate `Simulate` / `+5 min` behind `import.meta.env.DEV`.
3. Delete the "Phase 1 — all features simulated" footer line.
4. Keep honest disclosure, calmly worded, in **one** place — the existing About row: *"Times from the published GMRC timetable. No live vehicle feed."* Consider one subtle "Scheduled" chip on the live screen if you want it visible; it must not read as "fake."

### C4. Fix the primary CTA's contrast
**Where:** `app/src/features/journey/components/journeySheet/JourneySummary.tsx:106`, `app/src/index.css:22`
**Evidence:** Measured on the live button — `color: rgb(255,255,255)` on `rgb(249,115,22)` at 15px = **2.80:1** (AA needs 4.5:1). Every other accent CTA in the app uses `#000` = **7.49:1**.

**Fix:** Set `--c-accent-fg: #000000` in `:root` (and confirm for `[data-theme="dark"]`), then replace the hardcoded `'#000'` in `HomeScreen.tsx` (FAB), `Planner.tsx:445`, `StationDetail.tsx:324` with `var(--c-accent-fg)` so all accent buttons derive from one token.

### C5. Add safe-area insets
**Where:** `app/src/index.css`, `HomeScreen.tsx` (`COLLAPSED_H`/`PLAN_COLLAPSED_H`/`LIVE_COLLAPSED_H`, FAB + recentre `bottom`), `DraggableSheet.tsx`
**Evidence:** `viewport-fit=cover` set in `index.html:6`; **zero** `env(safe-area-inset-*)` in the codebase (grep). `Start Journey` measured at y=749–803 in an 812px viewport — 9px clearance.

**Fix:**
1. `--sat/--sar/--sab/--sal: env(safe-area-inset-*, 0px)` in `:root`.
2. Add `padding-bottom: var(--sab)` to the sheet's scroll content and to the live-journey action row.
3. Add `var(--sab)` into the three collapsed-height constants and into the FAB / recentre `bottom` offsets.
4. Add `padding-top: var(--sat)` to the floating search row.

### C6. Make the eight dead Settings rows work or remove them
**Where:** `app/src/features/journey/components/YouScreen.tsx`
**Evidence:** 8 rows rendered `tappable` (→ `<button>`, `cursor:pointer`, hover state, `›` chevron). File contains exactly **2** `onClick` handlers (lines 81, 130) — theme toggle and back. `Row` accepts no `onClick` prop; lines 45–46 are empty where it was removed.

**Fix:** For each of Sign in / Walking speed / Default departure station / Saved places / Saved journeys / Past trips / Report a timetable issue / Suggest a feature — either wire it, or render it non-tappable with no chevron and a plain "Coming soon" treatment. A chevron is a promise.
*Cheapest real wins: **Default departure station** (fixes the whole location-denied path) and the two feedback rows (`mailto:`).*

---

## 🟠 HIGH IMPACT — these are what separate "works" from "trustworthy"

### H1. Fix the light-theme color system
**Where:** `app/src/index.css:9-24`, `constants.ts`, `LineStatusPills.tsx:11-19`, `LiveJourneyScreen.tsx:23-25`, `LocationNotice.tsx`, `HomeScreen.tsx:60`
**Evidence (measured):** `Live` green `#22c55e` **2.07:1** · yellow line as text `#EAB308` **1.92:1** · `CURRENT_TEXT.yellow` `#CA8A04` **2.94:1** · alert chip `#f0997b` **2.20:1** · `yellow-600` **2.94:1** · `--c-text-4` `#71717a` **4.40:1** (used at 9–11px).

**Fix:** Introduce an explicit "on-light / on-dark" pair for every semantic color (`--c-live`, `--c-warn`, `--c-alert`) and for each line color used *as text*, and validate each at ≥4.5:1. Darken `--c-text-4` to ~`#5c5c66` in light. Keep raw line hex for fills/badges only — never for text on a light surface.
*Note: `LiveJourneyScreen.tsx:22` already documents this exact problem; the stand-in just wasn't measured.*

### H2. Fix dark-theme borders
**Where:** `app/src/index.css:26-37`
**Evidence:** `--c-border` `#1f1f1f` on `--c-card` `#1a1a1a` = **1.06:1**. `--c-border-2` `#2a2a2a` on `--c-bg` `#0f0f0f` = **1.34:1**.
**Fix:** Raise to ~`#2e2e2e` (card-adjacent) and ~`#3a3a3a` (bg-adjacent), targeting ≥1.5:1 for decorative separators, and verify the sheet outline and grab handle read as distinct edges.

### H3. Respect `prefers-color-scheme` on first run
**Where:** `app/src/contexts/ThemeContext.tsx:16-23`, `index.html` pre-paint script
**Evidence:** Falls back to `'light'` unconditionally; `prefers-color-scheme` appears nowhere.
**Fix:** When no stored preference exists, read `window.matchMedia('(prefers-color-scheme: dark)')`. Mirror the same logic in the pre-paint inline script so there's no flash. An explicit user toggle still wins.

### H4. Dedupe and rank place-search results
**Where:** `app/src/services/GeocodingService.ts`, `Planner.tsx:262-295`, `HomeSearch.tsx:304-334`
**Evidence:** Query `"Motera"` returns 1 station + **5** near-identical Photon results (`Motera Stadium, Sabarmati` / `Motera- chandkheda road` / `Motera Stadium Road` / `...Exit Road` / `...Entry Road`), all with the identical subtitle `"Select to find nearest station"`.
**Fix:**
1. Dedupe by normalized name and by proximity (collapse results within ~150m).
2. Suppress any place whose nearest station is one already shown as a station match — that's the same answer twice.
3. Cap places at 3.
4. Replace the constant subtitle with the actual differentiator: `Nearest: Motera Stadium · 400 m · 5 min walk`.

### H5. Don't fabricate walk times when location is unknown
**Where:** `journeyEngine.ts` (`sourceWalkMins`), `RouteTimeline.tsx`, `LiveJourneyScreen.tsx`
**Evidence:** With location denied, the route still renders `Walk 1 min to Old High Court` and `Walk 1 min to Motera Stadium`, and that walk feeds `leaveTimeMs` (see C1).
**Fix:** When `locStatus !== 'granted'`, suppress the origin walk leg and label the start `From Old High Court` (with a "change" affordance). Don't subtract a fictional walk from departure math.

### H6. Rework the location-denied first impression
**Where:** `HomeScreen.tsx:338`, `LocationNotice.tsx`, `App.tsx:49`
**Evidence:** Collapsed sheet shows only `DEFAULT STATION` + station name. The explanatory `LocationNotice` is in the sheet **body** — invisible until the user drags up.
**Fix:** Surface it in the collapsed peek. Replace `DEFAULT STATION` with plain language plus an action — `Location off · Set your station` — tappable straight into station selection. Right now the app's most confusing state is also its most common one for new users.

### H7. Give the map a point of view, and real tap targets
**Where:** `app/src/features/map/components/HomeMap.tsx:304-320`
**Evidence:** Stock CARTO `light_all`/`dark_all` rasters. Station markers measured at **12×12 – 22×22px** (44px is the minimum). 62 controls under 44px in at least one dimension across the app.
**Fix:**
1. Add invisible ~44px hit areas around station markers (keep the visual dot small).
2. Commit to a styled basemap — a custom vector style, or at minimum a consistent desaturation/tint that makes the four line colors the only saturated thing on screen. The Vignelli label treatment in `index.css:73-89` is the strongest visual idea in the app; build the map around it instead of stranding it on a stock tile.

### H8. Add map attribution
**Where:** `HomeMap.tsx:307`
**Evidence:** `attributionControl={false}` with CARTO basemap tiles; grep finds no `OpenStreetMap` / `CARTO` / `©` string anywhere in `src/`.
**Fix:** Restore attribution (a small custom-styled control is fine — it doesn't have to be Leaflet's default chrome). CARTO's ToS and OSM's ODbL both require it. This is a compliance item, not a design preference.

### H9. Unify number formatting
**Where:** `journeyEngine.ts` (`formatDuration`), plus every consumer
**Evidence:** Simultaneously on screen: `3min`, `19 min`, `3 mins left`, `1h 04m`, `46M AGO`, `~450m`, `every 12 min`.
**Fix:** One `formatDuration(mins, {style})` returning a consistent shape — `8 min`, `1h 04m`, `3 min left`, `46 min ago`. Never uppercase a unit via `uppercase` on a duration string. Apply `tabular-nums` to **every** element rendering a live-changing number so countdowns don't jitter.

### H10. Keep the map visible while planning
**Where:** `HomeScreen.tsx:567-598` (planner overlay)
**Evidence:** Planner is `fixed inset-0 z-[1000]` with an opaque `var(--c-bg)` — the map is fully occluded. Its only exit is a 40×40 `X` in the **top-right**.
**Fix:** Promote the planner into the existing `DraggableSheet` at `full` snap, matching the plan/live states, so the map survives and the same drag-down gesture dismisses it. If it must stay an overlay, move the dismiss control to the bottom or make the top drag-to-dismiss.

### H11. Label the planner inputs
**Where:** `app/src/features/journey/components/StationInput.tsx:23-33`
**Evidence:** The `FROM`/`TO` text is a plain `<div>` — no `<label htmlFor>`, no `id`, no `aria-label`. Screen readers get only the placeholder.
**Fix:** Add `id` + `<label htmlFor>` (or `aria-label`). While there: `enterKeyHint="search"`, `autoComplete="off"`, `autoCorrect="off"` — the mobile keyboard currently shows a generic Return key on a search field.

---

## 🟢 NICE TO HAVE — polish, consistency, and the "someone made this" layer

### N1. Copy pass on the failure and edge states
- `"Walk 1 min to Old High Court, then wait up to 0 mins"` → drop the clause when the wait is 0.
- `View Route Options` → `Find trains` (matches the voice of `Where to?` and `Start Journey`).
- `DEFAULT STATION` → see H6.
- `"Select to find nearest station"` → see H4.
- `Route Not Possible` → warmer and more actionable: *"No trains left today on the Red Line — try tomorrow morning."*

### N2. Fix `Sabarmati Railway StationSOON`
**Where:** `RouteTimeline.tsx`
Missing separator/space renders the name and its `SOON` badge as one word. Also add a one-line explanation of what an unopened station on your route means for the rider.

### N3. De-duplicate the route timeline endpoints
**Where:** `RouteTimeline.tsx`
Currently: `Old High Court` → `Walk 1 min to Old High Court` → `Old High Court` → `BOARD`. Same triple at the destination. Collapse to one node per place.

### N4. De-duplicate the boarding clock time
**Where:** `LiveJourneyScreen.tsx:323-340`
`departClock` renders twice on the same row — once right-aligned, once inside the schedule button — ~30px apart. Keep one.

### N5. Clarify the `JOURNEY / total` stat
**Where:** `JourneySummary.tsx:84-88`
It shows now→arrival, not ride duration, so the same 8-stop trip reads `19 min` / `31 min` / `43 min` across options. Either relabel (`Arrive in`) or show ride duration.

### N6. Drop the roadmap jargon
**Where:** `YouScreen.tsx`
`Phase 4` / `Phase 5` badges are internal vocabulary. If C6 keeps any of these rows visible, say `Coming soon` or nothing.

### N7. Replace the emoji in Settings
**Where:** `YouScreen.tsx:125`
`🌙 Dark mode` / `☀️ Light mode` — the app uses lucide everywhere else. Use `Moon`/`Sun` (already imported).

### N8. Collapse the duplicate color maps
**Where:** `constants.ts:1-7`
`LINE_BADGE_BG` and `LINE_COLORS` are identical. Keep one.

### N9. Watch the nested-scroller gesture stack
**Where:** `StationDetail.tsx:75` (`maxHeight: 360`) inside `DraggableSheet.tsx:157-184`
At `full` snap the sheet's content becomes `overflowY: auto`, putting a 360px inner scroller inside an outer scroller inside a drag gesture. `DraggableSheet` handles the outer handoff well, but the inner board has no `overscroll-behavior: contain` — a flick that ends at the board's boundary will chain unpredictably. Largely mooted if C2 lands (the board stops needing its own scroller).

### N10. Self-host the font
**Where:** `index.html:60-62`
Space Grotesk loads from Google Fonts as a render-blocking external stylesheet. `vite.config.ts` runtime-caches it, so repeat offline visits work — but the **first** load blocks paint on a third-party origin, and a first-visit-then-underground user gets a fallback face. Self-host the woff2 and it's precached by the existing `globPatterns` (which already includes `woff2`).

### N11. Give the recentre button a resting purpose
**Where:** `HomeScreen.tsx:523-539`
Both the FAB and recentre fade to `opacity: 0` the moment the sheet leaves `collapsed`. That's correct for the FAB but means there's no way to recentre while reading station detail — a common want.

---

## Suggested order

1. **C1 → C2 → C3** — the three trust killers. These are why a first-time user leaves. Do them first, in this order.
2. **C4 + C5** — one afternoon, fixes the CTA and every notched device.
3. **C6** — decide the story on Settings; deleting is a legitimate answer and takes ten minutes.
4. **H1 + H2 + H3** — the color system. Do them together as one pass with a contrast checker open, not by eye.
5. **H4 → H6** — the search and location paths, the two remaining "this feels unfinished" moments.
6. Everything else as capacity allows.

**C1, C2, and C3 alone** move this from "a demo I'd close" to "an app I'd trust for a train." They're also the three cheapest items on the list.
