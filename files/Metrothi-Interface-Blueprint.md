# Metrothi — Interface Blueprint

### A UI/UX redesign strategy, measured against the running application

**Status:** Strategy document. **No code is changed by this document.**
**Date:** 2026-08-03 · **Branch:** `develop` @ `5e3d0c5` · **Viewport of record:** 375 × 812 @ 2× (also checked at 360)
**Method:** every route, overlay, sheet and reusable component read in full from `app/src`, **and then instrumented in
a running dev build**. Every number in this document is either a search count over `app/src` or a value read out of the
live DOM/CSSOM. Nothing here is estimated. §20 documents how to reproduce each measurement.

---

## How this document relates to the three that already exist

| Document | Owns | Relationship to this one |
|---|---|---|
| `files/Metrothi-PRD.md` | *What* is built — product vision, scope, explicit non-goals, roadmap. | **Wins on conflict.** Nothing here changes a feature, a workflow or a route. |
| `CLAUDE.md` | *How* it is built — boot budget, data layering, i18n invariants, the rules that look like bugs and aren't. | **Wins on conflict.** §18 lists every invariant this plan is fenced by. |
| `files/Metrothi-Design-Guide.md` | The HIG distilled (Part I) and a target design derived from the app's **data** (Part II). | **Normative reference.** I cite its principles rather than restate them. |
| `files/Metrothi-Redesign-Strategy.md` | The **source-derived** audit: what is built, measured against that target, from reading the code. | **Companion, not replacement.** It closes by naming three things it did not do. This document does two of them. |
| **This document** | The **instrumented** audit and the **build specification**: what the app actually renders on a device, and the exact token file, component contracts and acceptance tests that fix it. | The layer that turns a plan into a diff. |

The Redesign Strategy states plainly: *"I did not measure the running app… A device pass at 360px in both themes,
both orientations and all three languages should precede Phase 2."* and *"I did not evaluate the Figma iOS 27 UI Kit."*
This document is that pass. Where a measurement confirms a source-derived claim I say so briefly and move on; where the
running app disagrees with what the source implies, that disagreement is the finding.

**On the Apple kit.** `files/apple-ios-27-ui-kit_assets_2026-06-23_v13.zip` was opened and enumerated before it was
removed from the repo: 31 entries, all raster assets — `Color Pickers/Light/iPhone.png`, `Edit Menu/Dark/…`,
15 files under `Keyboard/Light/`, 11 under `Examples/Keyboard/`, `System/Lock Screen Widgets/…`, and a single
`Shape.svg`. There is not one measurable artboard, type ramp or spacing token in it. Design Guide Appendix B was
right: it cannot inform this work, and no recommendation below depends on it. **Every HIG value cited here comes from
Design Guide Part I.** The kit is not a blocker and should not be treated as one.

---

# 1. Executive Summary

Metrothi's interface is not badly designed. It is **undesigned in exactly one dimension: it has no shared vocabulary.**
Every screen was drawn well, individually, by someone with taste — and each one invented its own type sizes, spacing,
radii, press feedback and muted grey while doing it. The result reads as slightly-off rather than wrong, which is the
hardest failure mode to fix by looking, and the easiest to fix by counting.

So I counted.

| What | Measured | What a designed system looks like |
|---|---|---|
| Distinct font-size declarations across `app/src` | **21** (14 arbitrary `text-[Npx]` + 7 Tailwind named) | 8–10 named roles |
| Distinct rendered px sizes | **16** — 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 17, 18, 20, 22, 24, 32, 36 | ≤ 10 |
| Most-used size in the entire app | **11px**, 59 occurrences | 15–17px body |
| Distinct type combos on one route (`/`) | **20** (size × weight × leading × case) | ≤ 8 |
| Distinct gap steps | **11** (2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28 px) | 6 |
| Distinct corner radii | **7** (2, 8, 12, 16, 22, 24, 9999) | 4 + pill |
| Colour literals hardcoded in `.tsx`, outside the token layer | **24** distinct hex values | 0 |
| Distinct press-feedback treatments | **8** (4 scale values, 2 opacity, 2 background) | 1 |
| Distinct `z-index` values | **9** (10, 20, 30, 40, 50, 600, 900, 1000, 1200) | 5 named layers |
| Contrast failures on `/` (unique colour × size × weight classes) | **15** light, **6** dark | 0 |
| Touch targets under 44 × 44 on `/` | **15 classes** of 450 interactive elements | 0 |
| `<h1>` elements on `/` | **0** (one heading total on the app's front door) | 1 |
| Modal surfaces with `role="dialog"` / `aria-modal` / focus trap / Escape | **0 of 3** | 3 of 3 |
| `env(safe-area-inset-*)` declarations, with `viewport-fit=cover` set | **0** | ≥ 4 |
| `prefers-reduced-motion` handling | **0** | 1 global |

Read as a set, these say one thing: **the app has design decisions but no design system.** Nobody made 21 type sizes
on purpose. They accumulated because there was no ladder to reach for, so each component author picked the number that
looked right in the box they were in — and each one *was* right, in that box.

The eight worst consequences, in the order a rider meets them:

1. **The app is set roughly one and a half steps too small.** 11px is the modal size. HIG's floor for iOS body text is
   17pt; Metrothi's most common text is 11px semibold in a muted grey that measures **4.40:1** — failing AA by 0.10,
   in the one app category people use while walking, in sunlight, holding a bag. (§12.1)
2. **The muted grey `--c-text-4` is the only text token that is identical in both themes** (`#71717a`), and it fails in
   both — 4.40:1 on light, 3.97:1 on dark. It is used for timings, service notes, and "End of service". (§8.4)
3. **Status colour is the least legible thing on screen.** The chips whose entire job is to warn measure **1.60:1**
   (`text-yellow-500` service status), **1.74:1**, and **2.00:1** (the alert `Chip`'s hardcoded `#f0997b`). The one
   piece of UI designed to be noticed is the one you can't read. (§12.1, and `DISCREPANCIES.md` already logs the cause)
4. **`--c-accent` is used as text on white and measures 2.80:1.** "View all" and the "Nearest station" eyebrow are both
   below AA. The token comment in `index.css:22` correctly reasons about accent *as a fill*; nobody wrote the rule for
   accent *as ink*. (§8.4)
5. **Three full-screen modal surfaces are plain `<div>`s.** The search overlay, the planner, and `TrainRouteSheet` have
   no `role="dialog"`, no `aria-modal`, no focus trap, no Escape handler. The planner does not move focus at all — after
   opening it, `document.activeElement` is still `BODY`. (§12.3)
6. **The map's own targets are 12–22px.** Station markers render at 8/12/14/16px plus stroke. Selecting a station — the
   primary gesture on a map-first app — is a sub-quarter-target tap. (§12.2)
7. **`viewport-fit=cover` is set and no `env()` is read anywhere.** On any device with a home indicator, the sheet's
   bottom content and the recentre button sit in the gesture zone. This is one CSS line and it has never been written.
   (§12.2)
8. **`font-black` (900) is used on `LineBadge`, and Space Grotesk is loaded at 300–700.** Every line letter in the app —
   the single most-repeated glyph in the product — is synthetically emboldened by the browser. Meanwhile `wght@300` is
   requested in the render-blocking font link and used **zero** times. (§8.3)

None of this requires touching a workflow, a route, the engine, the sync layer, or the boot budget. **The entire fix is
a token layer, six component contracts, and a mechanical sweep** — and about 40% of it is a find-and-replace that a
test can enforce forever after.

**The one thing I would change about the plan, not the app:** stop treating this as a redesign. It is a
*consolidation*. The design already exists in the code, in twenty near-identical variants. The work is choosing one of
each.

---

# 2. Overall Design Assessment

## What kind of product is this?

A **wayfinding instrument**, used one-handed, in motion, under time pressure, by someone who has already decided what
they want. It is not a browsing app, a content app, or a habit app. Every screen is answering exactly one question:

| Surface | The question | The answer's half-life |
|---|---|---|
| Home / station mode | *When is my next train, and from where?* | 60 seconds |
| Home / plan mode | *When do I leave, and when do I arrive?* | 15 seconds |
| Home / live mode | *What do I do next?* | until the next stop |
| `/stations/:id` | *What is this place like?* | permanent |
| `/you/:topic` | *What are the rules?* | permanent |
| `/you` | *Change something about the app.* | rare |

This split is the single most important fact about the product, and the current interface **does not encode it
anywhere**. The reference pages (`/you/fares`, 3,759px tall, 2 interactive elements) are typeset in nearly the same
ladder as the live journey countdown. A document and an instrument should not look alike.

## The verdict

**Architecture: excellent, do not touch.** Map-as-canvas with one persistent sheet in three modes, nothing unmounting
across planning and the live journey, no tab bar. This is the hardest thing in the product and it is already right.
`DraggableSheet`'s content-fitted mid snap — measuring the block that should end at the fold rather than guessing a
fraction — is better than what most shipped transit apps do.

**Information design: strong, occasionally over-compressed.** `JourneySummary` correctly makes "leave in" the one
large figure and refuses to repeat arrival in the header above. `LiveJourneySummary`'s three bands answer three
different questions in 80px. `DepartureRow` is shared by both departure lists so they cannot drift. Someone has
thought hard about what *not* to show.

**Visual system: absent.** Not bad — absent. There is a token layer in `index.css` with 16 custom properties, and
then 24 hardcoded hex values in `.tsx` files that route around it, plus Tailwind palette utilities (`text-yellow-500`,
`text-green-500`, `text-red-400`) that emit `oklch()` — so a single component can carry three colour spaces at once.

**Craft: high per-component, low per-app.** Read any one file and the reasoning is impeccable and documented. Read two
and they disagree about what 11px means.

---

# 3. Strengths

These are load-bearing. Every recommendation below is designed to preserve them.

1. **The shell.** `App.tsx` holds four routes and one `MainApp`; planning does not navigate. The map and sheet survive
   the entire planning → live → arrival arc. Nothing in this document unmounts anything.
2. **Sheet mechanics.** Three snaps, flick-velocity detection, gesture handoff that only claims the drag once the
   content scroller is at the top, `touch-action` switched per snap, and a peek that is `Math.max(constant, headerH)`
   so a wrapped Gujarati header can never be sliced at the fold. This is genuinely hard and it is correct.
3. **Honesty as a design principle.** `_meta` provenance surfaced in the UI; the "Simulated" tag on the live journey;
   `stationImage()` returning `null` rather than a stand-in; blocks that close up rather than printing "None". Very
   few apps refuse to fill a gap. This is the brand.
4. **Shared primitives where it counted.** `DepartureRow`, `settingsRows`, `FactPrimitives`, `blocks.tsx`, `SearchBar`'s
   single pill in two states, `sheetMotion.SPRING`. Each exists specifically because two copies had drifted.
5. **i18n discipline.** Whole keys per sentence shape rather than concatenated fragments; React-free modules returning
   a key plus proper nouns; `locales.test.ts` asserting key parity and plural resolution. This is stricter than most
   commercial apps and it constrains the redesign in useful ways.
6. **Boot-path protection.** Both `/you` routes lazy with real furniture as fallback; the theme mirrored to
   `localStorage` for the pre-mount script; `migrateFromLocalStorage()` deliberately un-awaited. Measured, documented,
   and defended in comments.
7. **The reference-page block model.** Nine topics through one renderer, blocks holding strings and never JSX, so the
   Hindi/Gujarati arrays can slot in later. `blocks.tsx`'s `Body` component is the only place in the app that gets
   reading typography right (14px medium, `leading-relaxed`, `--c-text-2`) — and it says so in a comment that
   explicitly notes the rest of the app is wrong.

---

# 4. Weaknesses

1. **No type ladder.** 21 declarations, 16 rendered sizes, five sizes (10–14) doing all the work.
2. **No spacing scale.** 11 gap steps; padding classes spread across `p-1` … `p-8` with `.5` variants throughout.
3. **No semantic colour ramp.** Success/danger exist as tokens; *warning* does not, so it is hardcoded four different
   ways in four files.
4. **No elevation system.** `boxShadow` appears as five distinct literal strings; cards variously carry a border, a
   shadow, both, or neither, chosen per file.
5. **No interaction-state system.** 8 press treatments, 5 hover declarations in the whole app, no defined pressed /
   selected / disabled / focus vocabulary.
6. **No feedback layer.** Zero toasts, zero snackbars, zero alerts, zero dialogs. Confirmation is a two-tap label swap
   (`DataSection`); "Copied" is a 1,500ms icon change inside a button; a failed sync is a sentence in a settings row a
   rider is not looking at.
7. **No modality semantics.** Three overlays, none announced, none trapped, none dismissible by keyboard.
8. **No responsive contract above 375px.** `--layout-max-width: 768px` is applied in 8 files and *not* applied in
   `HomeSearch`, `DraggableSheet`, `LineStatusPills` or the sheet header — so on a tablet the station directory and the
   sheet header run edge-to-edge while the body inside the same sheet is capped.
9. **No per-route document identity.** `<title>`, `<link rel=canonical>` and every `og:*` tag are fixed to the site
   root in `index.html`. `/stations/vastral-gam` reports the home page's title — verified in the running app. Browser
   tabs, share sheets, back-stack labels and screen-reader page announcements are all wrong on three of four routes.
10. **Emphasis is spent on chrome.** The three largest figures on the station page are `36px` (station name), `24px`
    (line badge letter) and `22px` (departure countdown). The badge letter — a redundant identifier, since the line's
    name and colour both appear beside it — outranks the one number the rider came for.

---

# 5. Global UX Problems

Each is stated with the measurement that proves it and the surface it is worst on.

### G1 — Text is set ~1.5 steps below the platform floor, and the floor is 9px

**Measured:** 18 occurrences of `text-[9px]`, 6 of `text-[10px]`, 59 of `text-[11px]`. `SectionHeader` in
`settingsRows.tsx:16` — the label that titles every settings section — is **9px bold uppercase**. `RouteTimeline`'s
"Route" heading and `AllTrainsList`'s "All trains today" heading are also 9px. `StationDetail`'s first/last-train
column labels are 9px.

**Why it hurts:** Design Guide §I.2 records iOS's minimum as 11pt and its *default* body as 17pt. At 9px uppercase
with `tracking-widest`, letterforms in Space Grotesk lose their distinguishing features entirely; in Devanagari and
Gujarati the matras collide. This is the app's own section-labelling convention, so it is not one screen — it is the
structural voice of the product, set below the platform minimum.

**Severity: critical.** It is simultaneously the legibility problem, the hierarchy problem (nothing has room to be
*smaller* than a heading, so headings can't recede) and the i18n problem.

### G2 — There is no warning colour, so warnings are four different colours

**Measured, all four in the running app:**

| Surface | Declaration | Rendered contrast |
|---|---|---|
| `HomeScreen.tsx:79–80` alert `Chip` | `color:'#f0997b'`, `border:'rgba(216,90,48,0.35)'` | **2.00 : 1** |
| `StationDetail.tsx:243` line status | `text-yellow-500` → `oklch(0.795 0.184 86.047)` | **1.74 : 1** |
| `LineStatusPills.tsx:19` pill tone | `'#eab308'` | **1.60 : 1** |
| `LocationNotice.tsx:38–52` | `text-yellow-600` on `rgba(250,204,21,0.08)` | **2.84 : 1** |
| `JourneySummary.tsx:54`, `AllTrainsList.tsx:68` "tight" | `'#f59e0b'` | (on card) |

Five surfaces, five colours, four colour *spaces* (`oklch`, hex, hex-with-alpha, Tailwind utility), and the best of
them is 2.84:1. `DISCREPANCIES.md` already logs the first row and correctly diagnoses it as "needs semantic tokens".
The entry understates the scope: this is the whole warning channel.

**Severity: critical.** These are the states where the app tells a rider that the thing they are about to do will not
work.

### G3 — Opacity is doing semantic work, and it is ambiguous

**Measured:** `opacity: departed ? 0.55 : 1` (`DepartureRow.tsx:80`), `opacity: !optFeasible ? 0.4 : isTight ? 0.6 : 1`
(`AllTrainsList.tsx:47`), `opacity-50` / `opacity-40` on passed stops (`LiveJourneyScreen.tsx:115, 293, 326, 394`),
`opacity: 0.5` on disabled rows (`settingsRows.tsx:81`), `opacity: 0.6` on a busy button (`AccountCard.tsx:144`),
`disabled:opacity-30` on swap (`Planner.tsx:252`).

Seven different opacities express five different meanings: *departed*, *infeasible*, *tight*, *passed*, *disabled*,
*busy*. `JourneySummary.tsx:178–180` contains the correct rule in a comment — *"Difference is carried by colour, not
opacity: a dimmed cell reads as disabled, and both of these are still selectable"* — and that rule is applied in
exactly one component.

**Severity: major.** Dimming also multiplies every contrast failure by the opacity: `--c-text-4` at 4.40:1 inside a
`0.55` row is **≈2.5:1**.

### G4 — Interaction feedback is eight different things and hover barely exists

**Measured press treatments:** `active:scale-95` (13), `active:scale-[0.98]` (8), `active:scale-[0.99]` (1),
`active:scale-90` (1), `active:opacity-70` (2), `active:opacity-60` (2), `active:bg-black/5` (1), `active:bg-white/5` (1).

**Measured hover treatments:** five declarations in the entire application —
`hover:bg-[var(--c-card-alt)]` (`settingsRows.tsx:76`, `blocks.tsx:250`), `hover:scale-110` (`Planner.tsx:252`),
`hover:bg-black/5` and `hover:bg-white/10` (`Planner.tsx:421`).

So: the FAB shrinks to 90%, a settings row to 95%, a primary CTA to 98%, a sign-in button to 99% — and a departure card
doesn't shrink at all, it fades to 70%. On a pointer device, 445 of 450 interactive elements on `/` have no hover state.

**Severity: major.** Not because any one value is wrong, but because a press that feels different every time reads as
unfinished.

### G5 — There is no feedback layer at all

No toast, snackbar, alert, dialog, or banner primitive exists. Consequences:

- Saving a station: the bookmark widens into a pill. No confirmation off-screen.
- Removing a recent trip (`Planner.tsx:420`): the row vanishes. No undo, no confirmation. Destructive, silent,
  irreversible — and implemented on a `<div role="button">` nested inside a `<button>`, which is invalid HTML.
- "Clear local data" (`AccountCard.tsx:254`): a two-tap label swap on the row itself. Better than `window.confirm()`,
  but the second tap gives no completion signal at all.
- Share fallback (`LiveJourneyScreen.tsx:248`): `setJustShared(true)` for 1,500ms swaps an icon inside the button the
  rider just moved their thumb off.
- Sync failure: one sentence, in a settings row, on a lazy route.

**Severity: major.** Every one of these is a moment where the app did something and didn't say so.

### G6 — Loading is three unrelated ideas

1. **Skeletons that draw real furniture** — `YouScreenFallback`, `InfoPageFallback`. Excellent, and the right pattern.
2. **A centred text string** — `HomeScreen.tsx:668`, `"Loading map…"` at `text-sm` in `--c-text-4` on `--c-card-alt`.
3. **`animate-pulse` grey blocks** — `HomeScreen.tsx:578–579`, for the station header before `nearest` lands.
4. **A spinner** — `SearchBar.tsx:83`, `Loader2` with `animate-spin`.
5. **A pulsing word** — `Planner.tsx:305`, `"Searching…"` with `animate-pulse text-blue-500`.

Five treatments. The two good ones are on the two routes a rider almost never cold-loads (the service worker precaches
them); the three ad-hoc ones are on the map-first path that matters.

**Severity: moderate.**

### G7 — The platform's accessibility preferences are ignored

**Measured:** zero occurrences of `prefers-reduced-motion` or `useReducedMotion` in `app/src`. Zero occurrences of
`env(safe-area-inset-*)`, with `viewport-fit=cover` set in `index.html:6`. No `font-size` relative units anywhere — every
size is an absolute px, so iOS/Android text-size settings and browser zoom do nothing to the app's own type.

Meanwhile the app runs, continuously: `journey-glow-pulse` (1.6s infinite), `animate-ping` on running line pills,
`animate-pulse` on live dots and the state pill, a 1s linear glow-head transition, `train-glide` transitions on every
active train marker, and spring physics on two sheets.

**Severity: critical** for `env()` (it is a layout bug on the majority of target devices) and reduced motion (WCAG
2.3.3 / HIG §I.7); **major** for dynamic type.

### G8 — Modality is invisible to anything but a sighted mouse

**Measured in the running app.**

| Surface | `role` | `aria-modal` | Focus on open | Escape | Focus trap |
|---|---|---|---|---|---|
| `HomeSearch` (z-1200) | `null` | `null` | ✅ input | ❌ | ❌ |
| Planner overlay (z-1000) | `null` | `null` | ❌ **`BODY`** | ❌ | ❌ |
| `TrainRouteSheet` (z-50, portaled) | `null` | `null` | ❌ | ❌ | ❌ |
| `DraggableSheet` at `full` | `null` | — | ❌ | ❌ | ❌ |

All four cover the screen. None announces itself. Tabbing from the search overlay walks straight into the 450
interactive elements of the home screen behind it.

**Severity: critical.**

### G9 — The front door has no document structure

**Measured on `/`:** `<h1>` count **0**. Total headings **1** (`<h2>Upcoming Trains</h2>`). No `<nav>`, `<header>`,
`<footer>`, or `<section>`. The station name — 22px bold, the largest text on screen, the subject of the entire
surface — is a `<div>`.

Additionally, `LineStatusPills.tsx:55–56` renders `<button role="listitem">`. **`role="listitem"` replaces the implicit
button role**, so a screen reader announces four list items with no indication they are pressable — the accessible name
is even written as an instruction ("Blue Line: In 1h 34m. View stations") that the semantics then contradict.

**Severity: major.**

### G10 — The eye has no path, because everything is bold

**Measured weights across `app/src`:** `font-bold` 102, `font-semibold` 69, `font-medium` 26, `font-normal` 1,
`font-black` 1. Of ~200 weight declarations, **86% are 600 or 700**.

When almost everything is semibold, weight stops being a hierarchy channel and hierarchy has to be carried by size —
but the sizes are 11, 12, 13, 14 (a 3px total range for most of the app), so hierarchy falls back to *colour*, and the
colour ramp has four steps of which the bottom one fails contrast. That is the whole causal chain of "weak visual
hierarchy" in one paragraph.

---

# 6. Design Principles

Seven rules. Every recommendation in this document is derived from one of them, and each is written so that a
disagreement can be settled by pointing at it.

### P1 — One surface, one question, answered without a tap

Each surface has a single question (§2). Anything that does not help answer it moves down, out, or into a disclosure.
Corollary: **the answer is the largest thing on the surface.** Today, on the station page, that is the line badge's
letter.

### P2 — Legibility floor before aesthetic ceiling

**No text below 12px. No text below 4.5:1 (3:1 for ≥18.66px bold). No touch target below 44 × 44.** These are floors,
not goals; a design that needs to break one is the wrong design. This is the only principle that overrides taste, and
it overrides it absolutely — this app is used walking, outdoors, one-handed.

### P3 — Colour is the last channel, never the only one

Every state must be legible with colour removed. Departed = struck through *and* dimmed *and* labelled. Selected =
filled *and* `aria-pressed`. Warning = icon *and* word *and* tone. Line identity = colour *and* letter *and* name.
(Design Guide §I.3, inclusive colour: ~1 in 12 men in the target population has a colour-vision deficiency, and the
Red and Violet lines are adjacent in the exact confusion axis.)

### P4 — One definition, many consumers

If two components need the same value, it lives in one place and both read it. This is already the project's instinct —
`DepartureRow`, `settingsRows`, `sheetMotion` all exist for this reason, each with a comment explaining which fork it
prevented. The token layer is the same instinct applied to numbers instead of markup.

### P5 — Absence is not a negative, and silence is not confidence

Preserve the app's refusal to placehold. Extend it: where the app *is* uncertain (simulated departures, a stale sync, a
guessed nearest station), say so once, quietly, at the point of use — never in a settings page, never twice.

### P6 — The floating layer is one material

Anything over the map — search pill, line pills, recentre, FAB, sheet — is the same material: one blur, one border,
one shadow, one radius family. Today there are four blur values (`18px`, `16px`, `20px`, none) and five shadow strings.

### P7 — Motion explains geometry, or it doesn't happen

A sheet rising, a leg expanding, a list dropping from under a search bar — these describe where something came from.
A fade for its own sake does not. And every one of them must have a zero-motion equivalent that still explains the same
geometry through position, not animation.

---

# 7. Proposed Design Language

## 7.1 Positioning

**"A transit instrument, not a transit app."** The nearest reference points are a departure board and a wristwatch
complication, not a content app. Concretely, that means:

- **Numbers are the hero.** Countdowns, clock times and fares get the largest type, tabular figures, and the tightest
  leading. Everything else supports them.
- **Chrome recedes to hairlines.** Borders over shadows; one shadow, reserved for the floating layer.
- **Colour is scarce and means something.** One accent, one success, one danger, one warning, four line colours. No
  decorative colour anywhere.
- **Space, not rules, does the grouping.** The app currently separates with borders and cards; it should separate with
  whitespace and use borders only where a rule genuinely divides (a list, a table).

## 7.2 Three voices, one system

The measurement in §2 gives the design its structure. The system has one type ramp with **three registers**:

| Register | Where | Character |
|---|---|---|
| **Instrument** | Home sheet (all three modes), `DepartureRow`, `LiveJourneySummary`, `JourneySummary`, countdowns | Tight leading, tabular numerals, high weight contrast, generous size |
| **Structure** | `/you`, `/stations/:id` info tab, `SavedData`, `AccountCard`, search rows | Comfortable leading, 56px row rhythm, weight carries hierarchy |
| **Document** | `/you/:topic`, GMRC prose, `blocks.tsx` | Relaxed leading, measure capped, 400/500 weights, generous paragraph spacing |

The **Document** register already exists and is already right (`blocks.tsx:62–68`). The other two do not exist. This is
not three type scales — it is one scale with three defined slices, which is why it can be enforced by a test.

## 7.3 What stays exactly as it is

Stated up front so no one re-litigates it during implementation:

- The four `LINE_COLORS`. They are real-world signage.
- Space Grotesk, first in the stack in every language.
- Orange `#f97316` as the accent **fill**, with black foreground (`index.css:22–25` reasons this out correctly).
- The map's Vignelli tooltip treatment.
- Light as the default theme.
- The shell, the routes, the three sheet modes, the absence of a tab bar.
- Every i18n invariant in `CLAUDE.md`.

## 7.4 The one decision the product owner must make

**Does the app adopt a bottom action bar for the live journey?** Today the live journey's controls (End / Save / Share)
sit in a horizontally-scrolling pill row inside the sheet body — reachable only at mid or full snap. At the collapsed
peek (80px), a rider mid-journey can see their instruction but cannot end the journey without first expanding the
sheet. Every alternative costs something: a persistent bar eats 64px of map, a swipe-to-end is undiscoverable, an
overflow menu adds a tap. I recommend **End** promoted to the collapsed bar as a 44px icon button and Save/Share left
in the body, but this is a product call, not a design one.

---

# 8. Design System Specification

Everything in this section is a literal value, ready to be pasted. Nothing is illustrative.

## 8.1 Grid and layout

| Token | Value | Rationale |
|---|---|---|
| Base unit | **4px** | Every spacing, radius and size value is a multiple. |
| Screen gutter | **20px** (`--sp-5`) | Already the dominant choice (`px-5`, 18 uses) — but `px-4` has 41. Standardise on 20 for content, 16 for dense scrollers only. |
| Content max width | **768px** (`--layout-max-width`, unchanged) | Must be applied in `HomeSearch`, `DraggableSheet`, `LineStatusPills`, and the sheet header — currently absent from all four. |
| Row minimum height | **56px** | 44px target + 6px vertical breathing each side. |
| Card inner padding | **16px** | One value. Currently 12, 14, 16, 20 depending on file. |
| Section gap | **24px** | Between labelled groups. |
| Block gap | **12px** | Between cards inside a group. |
| Safe area | `padding-bottom: max(20px, env(safe-area-inset-bottom))` on the sheet body, the planner, `/you`, and `/you/:topic`; `env(safe-area-inset-top)` on both sticky bars. | **Currently zero declarations.** |

## 8.2 Spacing scale

**Allowed:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
**Banned:** `2, 6, 10, 14, 18, 28` and every `.5` Tailwind variant. Measured today: 11 distinct gap steps including
2, 6, 10, 14 and 28.

```css
--sp-1:  4px;   --sp-2:  8px;   --sp-3: 12px;   --sp-4: 16px;
--sp-5: 20px;   --sp-6: 24px;   --sp-8: 32px;   --sp-10: 40px;
--sp-12: 48px;  --sp-16: 64px;
```

Three exceptions, and only three: the 3px live-progress rail (`LiveJourneySummary`), the 1px hairlines, and
`RAIL_W: 14` in `LiveJourneyScreen` (a drawn object, not layout — though it should move to 16 when convenient).

## 8.3 Typography

### The ladder

One scale, eleven roles. **Floor is 12px.** Leading is stated absolutely so two components cannot render the same size
at two leadings — which happens today at 11px (15.125 and 16.5), 12px (16 and 18), 13px (17.875 and 19.5) and 14px
(20 and 21), all verified in the running app.

| Role | Size / Leading | Weight | Tracking | Replaces today |
|---|---|---|---|---|
| `--t-display` | 34 / 40 | 700 | −0.02em | `text-4xl` (36) — page titles, station hero |
| `--t-hero` | 28 / 32 | 700 | −0.02em | `text-[32px]` — the "Leave in" figure |
| `--t-title-1` | 22 / 28 | 700 | −0.01em | `text-[22px]` — station name in sheet, big countdowns |
| `--t-title-2` | 20 / 26 | 700 | −0.01em | `text-[20px]`, `text-[17px]` — section heads, `UpcomingTrains` |
| `--t-headline` | 17 / 22 | 600 | 0 | `text-[14px]`/`text-[15px]` row titles |
| `--t-body` | 16 / 24 | 400/500 | 0 | `text-[14px]` reference prose |
| `--t-callout` | 15 / 20 | 500/600 | 0 | `text-[13px]` secondary rows |
| `--t-subhead` | 14 / 20 | 500/600 | 0 | `text-[12px]`, `text-[12.5px]` metadata |
| `--t-footnote` | 13 / 18 | 500 | 0 | `text-[11px]` fine print |
| `--t-caption` | 12 / 16 | 600 | +0.06em, UPPERCASE | **`text-[9px]` and `text-[10px]` eyebrows** |
| `--t-numeral` | inherits size | 700 | `tabular-nums`, `font-feature-settings:'tnum' 1` | every countdown, clock, fare |

**Sixteen rendered sizes become eleven roles, and the floor rises from 9px to 12px.**

### Weights

**Loaded and used: 400, 500, 600, 700.** Two changes to `index.html`:

- **Drop `300`** from the Google Fonts request. It is fetched on the render-blocking path and used **zero** times.
- **Never request 900.** `LineBadge.tsx:18` uses `font-black`; Space Grotesk ships 300–700, so every line letter in the
  app is browser-synthesised faux-bold. Change to `font-bold` (700). Verified in the running DOM as `12px/900`.

### Weight discipline

Today 86% of weight declarations are 600 or 700. Target distribution:

- **700** — numerals, the one hero figure per surface, page titles. Nothing else.
- **600** — row titles, section captions, button labels.
- **500** — metadata, secondary lines, all supporting text.
- **400** — reference prose only.

### Per-script leading

Devanagari and Gujarati need more. Add to `index.css`:

```css
:root[lang="hi"], :root[lang="gu"] { --leading-scale: 1.15; }
```

and apply it to `--t-body`, `--t-callout`, `--t-subhead`, `--t-footnote`. Latin keeps 1.0. (Design Guide §I.2 and the
`--font-app` fallback-per-glyph note in `index.css:38–44`.)

### The measure

`blocks.tsx` already caps prose at `--layout-max-width` (768px), which at 16px body is ~90 characters — too wide.
Reference pages should cap at **65ch**, which at 16px is ~600px. Everything else keeps 768px.

## 8.4 Colour system

### What changes and why

Three token changes are load-bearing; the rest is consolidation.

**1. `--c-text-4` must become theme-aware.** It is currently `#71717a` in *both* themes — the only text token that
doesn't change — and it fails in both. Measured: **4.40:1** on `--c-bg` light, **3.97:1** on `--c-bg` dark.

```css
:root                    { --c-text-4: #6b6b74; }  /* 4.77:1 on #f4f4f5 ✓ */
:root[data-theme="dark"] { --c-text-4: #7d7d86; }  /* 4.70:1 on #0f0f0f ✓ */
```

**2. Accent needs a separate ink token.** `--c-accent` (`#f97316`) as *text* on white measures **2.80:1**. It is used
that way for "View all" (`UpcomingTrains.tsx:79`) and the "Nearest station" eyebrow (`HomeScreen.tsx:487`), among
others. The existing comment at `index.css:22–25` reasons correctly about accent as a *fill* and simply never
considered it as ink.

```css
:root                    { --c-accent-ink: #c2410c; }  /* 4.68:1 on #f4f4f5, 5.18:1 on #ffffff ✓ */
:root[data-theme="dark"] { --c-accent-ink: #f97316; }  /* 6.84:1 on #0f0f0f — unchanged, already passes */
```

`--c-accent` remains the fill; `--c-accent-fg` (black) remains its foreground. Neither changes.

**3. A warning channel must exist.** This is the fix `DISCREPANCIES.md` already asks for, sized to the real problem
(§G2 — five surfaces, five colours).

```css
:root {
  --c-warn:        #b45309;                   /* 4.9:1 on --c-bg  */
  --c-warn-bg:     rgba(180, 83, 9, 0.08);
  --c-warn-border: rgba(180, 83, 9, 0.28);
}
:root[data-theme="dark"] {
  --c-warn:        #fbbf24;                   /* 10.4:1 on --c-bg */
  --c-warn-bg:     rgba(251, 191, 36, 0.10);
  --c-warn-border: rgba(251, 191, 36, 0.26);
}
```

### The complete token file

```css
:root {
  /* Surfaces — four levels, never five */
  --c-bg:        #f4f4f5;   /* page / inset-inside-sheet          */
  --c-card:      #ffffff;   /* raised surface, sheet body         */
  --c-card-alt:  #fafafa;   /* inset inside a card                */
  --c-blur:      rgba(244, 244, 245, 0.96);  /* floating material */

  /* Borders — two only */
  --c-border:    #e4e4e7;   /* hairline between rows              */
  --c-border-2:  #d4d4d8;   /* container edge, grab handle        */

  /* Ink — four levels, all ≥ 4.5:1 on --c-bg */
  --c-text:      #18181b;   /* 15.9:1  primary                    */
  --c-text-2:    #3f3f46;   /*  9.8:1  secondary                  */
  --c-text-3:    #52525b;   /*  7.0:1  tertiary / captions        */
  --c-text-4:    #6b6b74;   /*  4.8:1  quaternary — WAS #71717a   */

  /* Accent */
  --c-accent:     #f97316;  /* fill only                          */
  --c-accent-fg:  #000000;  /* on accent fill — 7.6:1             */
  --c-accent-ink: #c2410c;  /* accent AS TEXT — new               */

  /* Status */
  --c-success:      #15803d;
  --c-success-bg:   rgba(21, 128, 61, 0.08);
  --c-danger:       #dc2626;
  --c-danger-bg:    rgba(220, 38, 38, 0.08);
  --c-warn:         #b45309;
  --c-warn-bg:      rgba(180, 83, 9, 0.08);
  --c-warn-border:  rgba(180, 83, 9, 0.28);
  --c-info:         #1d4ed8;
  --c-info-bg:      rgba(29, 78, 216, 0.08);

  /* Focus ring — new, see §12.3 */
  --c-focus:        #1d4ed8;
}

:root[data-theme="dark"] {
  --c-bg:        #0f0f0f;
  --c-card:      #1a1a1a;
  --c-card-alt:  #222222;
  --c-blur:      rgba(15, 15, 15, 0.96);
  --c-border:    #262626;   /* WAS #1f1f1f — 1.28:1 on --c-card, invisible */
  --c-border-2:  #333338;   /* WAS #2a2a2a                                 */
  --c-text:      #ffffff;
  --c-text-2:    #d4d4d8;
  --c-text-3:    #a1a1aa;
  --c-text-4:    #7d7d86;
  --c-accent-ink:#f97316;
  --c-success:   #4ade80;   --c-success-bg: rgba(74, 222, 128, 0.10);
  --c-danger:    #f87171;   --c-danger-bg:  rgba(248, 113, 113, 0.10);
  --c-warn:      #fbbf24;   --c-warn-bg:    rgba(251, 191, 36, 0.10);
                            --c-warn-border:rgba(251, 191, 36, 0.26);
  --c-info:      #60a5fa;   --c-info-bg:    rgba(96, 165, 250, 0.10);
  --c-focus:     #60a5fa;
}
```

### Line colours — the one honest compromise

`CLAUDE.md` fixes `LINE_COLORS` to signage, and that rule stands. But the *filled badge* is not signage — it is a UI
control the app invented. Measured: white on `#3b82f6` = **3.68:1**, and the letters `A`/`V` in `--c-accent`-adjacent
tints on their own backgrounds measure **2.93** and **2.94**.

Two defensible options:

- **(a) Recommended.** Add `LINE_BADGE_BG` as a *darkened-for-badge-only* pair — `blue #2563eb` (white = 5.17:1),
  `red #dc2626` (white = 4.83:1), `violet #7e22ce`, `yellow` unchanged with black text. The map polyline, the dot and
  the rail keep the exact signage `LINE_COLORS`. The badge is a label about the line, not a reproduction of it.
- **(b) Fallback.** Keep the signage fill and treat the letter as a **non-text graphical object** (3:1 required, which
  it passes at 3.68). This is defensible *only* because the letter is fully redundant — colour, shape and the adjacent
  line name each carry the same information. If (b) is chosen, the badge must never appear without its line name in
  text nearby.

I recommend **(a)**, and it is a two-line change to `constants.ts`. There is no third option where a 12px glyph at
3.68:1 is acceptable as text.

### The hard rule

**No colour literal in a `.tsx` file, ever, except `constants.ts`.** Measured today: 24 distinct hex values across
components. And no Tailwind palette utility for colour (`text-yellow-500`, `bg-green-500`, `text-red-400`) — Tailwind
v4 emits these as `oklch()`, which is why `StationDetail.tsx` currently renders one status row in `oklch` and the one
below it in hex. `locales.test.ts` proves this kind of rule can be enforced by test; §16 Phase 1 adds `tokens.test.ts`
to do the same job here.

## 8.5 Elevation and materials — exactly three

Measured today: five distinct `boxShadow` strings, plus cards that variously carry border-only, shadow-only, both, or
neither.

| Level | Name | Light | Dark | Used by |
|---|---|---|---|---|
| 0 | **Content** | `--c-bg`, no border, no shadow | same | page background, inset blocks inside cards |
| 1 | **Raised** | `--c-card` + `1px solid --c-border` | `--c-card` + `1px solid --c-border` | every card, every row group, `DepartureRow`, `SectionCard`, `StatTile` |
| 2 | **Floating** | `--c-blur` + `blur(18px)` + `1px solid --c-border-2` + `0 4px 18px rgba(0,0,0,0.18)` | same, `rgba(0,0,0,0.45)` | search pill, line pills, recentre, FAB |
| 3 | **Over** | `--c-card` + `0 -8px 32px rgba(0,0,0,0.24)` + `1px solid --c-border` | same, `rgba(0,0,0,0.55)` | `DraggableSheet`, `TrainRouteSheet`, both full-screen overlays |

```css
--elev-float: 0 4px 18px rgba(0, 0, 0, 0.18);
--elev-over:  0 -8px 32px rgba(0, 0, 0, 0.24);
--blur-float: 18px;
```

**One blur value.** Today: 18px (`SearchBar`, recentre), 16px (`LineStatusPills`), 20px (both sticky bars), none
elsewhere. **No shadow at level 1.** A card that is both bordered and shadowed reads as two materials at once.

### Named z-layers

Nine magic numbers become five names:

```css
--z-map-chrome: 600;   /* search pill, line pills, FAB, recentre */
--z-sheet:      900;   /* DraggableSheet                          */
--z-overlay:   1000;   /* planner                                 */
--z-search:    1200;   /* HomeSearch                              */
--z-modal:     1400;   /* TrainRouteSheet — currently 40/50,      */
                       /* which is why it must be portaled to body */
```

`TrainRouteSheet` sitting at `z-50` while the sheet that contains it sits at `z-900` is why it needs
`createPortal(…, document.body)` (`LiveJourneyScreen.tsx:605`). With a real ladder the portal becomes an
implementation detail rather than a load-bearing workaround.

## 8.6 Corner radius — philosophy and scale

**Philosophy: radius is a function of the box's size, and nested corners are concentric.** An inner radius equals the
outer radius minus the padding between them, so a 16px card with 16px padding holds an 8px chip without the corners
fighting.

| Token | Value | Applies to |
|---|---|---|
| `--r-xs` | 6px | inline tags, `FactChip` |
| `--r-sm` | 10px | small controls, `<select>`, segmented cells, inputs |
| `--r-md` | 14px | buttons, `DepartureRow`, inset blocks |
| `--r-lg` | 20px | cards, `SectionCard`, `StatTile`, `AccountCard` |
| `--r-xl` | 28px | sheet tops (`DraggableSheet`, `TrainRouteSheet`) |
| `--r-pill` | 9999px | pills, chips, circular icon buttons, avatars |

Today: 2, 8, 12, 16, 22, 24 and full. `rounded-t-[22px]` on `DraggableSheet` and `rounded-t-3xl` (24px) on
`TrainRouteSheet` are the same gesture at two radii, 2px apart — nobody chose that.

## 8.7 Icon system

**Measured:** 14 distinct `size` values (10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26) and 5 distinct
`strokeWidth` values (2.2, 2.4, 2.5, 2.6, 3).

**Proposed: four sizes, one stroke.**

| Token | Size | Stroke | Use |
|---|---|---|---|
| `--icon-sm` | 16 | 1.75 | inline with text, row leading glyphs, chips |
| `--icon-md` | 20 | 1.75 | control glyphs, icon buttons, sticky-bar back |
| `--icon-lg` | 24 | 1.75 | primary actions, FAB |
| `--icon-xl` | 28 | 1.75 | empty-state and error illustrations only |

Stroke 1.75 rather than 2+: lucide's default is 2, and the app's drift to 2.4–3 is a compensation for icons being drawn
too *small* — at 16px and above with correct contrast, a heavier stroke reads as blur. Fix the size, and the stroke
comes back down.

**Rule: an icon smaller than its adjacent text is decoration and should be deleted.** Today `ExitGuidance` pairs
`size={11}` icons with 11px text and `RouteTimeline` pairs `size={11}` with 11px — both become 16px icons with 13px
text.

## 8.8 Button hierarchy

Five roles. Every button in the app is one of these.

| Role | Fill | Ink | Height | Radius | Type | Where |
|---|---|---|---|---|---|---|
| **Primary** | `--c-accent` | `--c-accent-fg` | 52 | `--r-md` | `--t-headline` 700 | Start Journey, View Route Options, From here, Sign in. **One per surface.** |
| **Secondary** | `--c-card` + `1px --c-border-2` | `--c-text` | 52 | `--r-md` | `--t-headline` 600 | To here, Retry, secondary sheet actions |
| **Tertiary** | none | `--c-accent-ink` | 44 min | `--r-sm` | `--t-callout` 600 | View all, toggle sign-up/in, text links |
| **Icon** | `--c-bg` or floating | `--c-text-2` | **44 × 44** (glyph 20) | `--r-pill` | — | back, close, save, swap, recentre, walking directions |
| **Destructive** | `--c-danger-bg` + `1px` at 0.25α | `--c-danger` | 52 | `--r-md` | `--t-headline` 600 | End journey, Clear local data |

**Every `w-9 h-9` (36 × 36) icon button becomes 44 × 44 with a 20px glyph.** Measured: 10 occurrences across 7 files.
The visual circle may stay 36px if the *hit area* is 44 — use `padding` or an `::after` extension, not a bigger circle,
so the visual density is preserved.

**States, defined once for all five roles:**

| State | Treatment |
|---|---|
| Rest | as above |
| Hover (pointer only) | fill lightens/darkens 4%; **no scale** |
| Pressed | `transform: scale(0.97)`, `120ms cubic-bezier(0.2, 0, 0.2, 1)` — **one value, everywhere** |
| Focus-visible | `outline: 2px solid var(--c-focus); outline-offset: 2px` — **one value, everywhere** |
| Disabled | fill → `--c-card-alt`, ink → `--c-text-4`, `cursor: not-allowed`, **no opacity change** |
| Busy | label swaps to a verb (`Signing in…`), control stays full contrast, `aria-busy="true"` |

Note `scale(0.97)` replaces four values (0.90, 0.95, 0.98, 0.99). Note also that "disabled" stops using opacity — per
P3 and G3, and because `disabled:opacity-30` on the swap button (`Planner.tsx:252`) currently renders it at roughly
1.3:1.

## 8.9 Component philosophy

1. **A component owns its geometry; a caller owns its content.** `StatTile`'s `cardBg` prop (`FactPrimitives.tsx:70`)
   is the correct pattern for surface inversion and should be the *only* one — no component reads `surface` and
   branches on colour internally.
2. **No `variant` prop that serves two unrelated designs.** The `settingsRows.tsx:160–173` comment refusing to fold
   `ThemeToggle` into `Switch` is exactly right and should be the standing rule.
3. **Interactivity is derived, never declared.** Already the rule (`settingsRows.tsx:30–35`); extend it to every
   component.
4. **A component that renders nothing when it has nothing renders `null`, not a placeholder.** Already the rule
   (`ExitGuidance`, `ConnectionsBlock`, `stationImage`). Keep it.

## 8.10 Motion

| Token | Value | Use |
|---|---|---|
| `--motion-press` | 120ms `cubic-bezier(0.2, 0, 0.2, 1)` | every press |
| `--motion-state` | 200ms `cubic-bezier(0.2, 0, 0.2, 1)` | colour, opacity, small position |
| `--motion-enter` | 260ms `cubic-bezier(0.16, 1, 0.3, 1)` | overlays, disclosure |
| `SPRING` | `{stiffness: 420, damping: 42, mass: 0.9}` | sheets only — unchanged, already shared |

Measured today: `duration-200` ×11, `duration-300` ×5, `duration-500` ×7, `duration-1000` ×1, plus inline
`transition: 'transform 0.2s'` and `0.25s ease` in CSS. The 500ms transitions on passed-stop opacity in
`LiveJourneyScreen` are the outlier — half a second is a *narrative* duration, and this is a state change.

### Reduced motion — mandatory, currently absent

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .journey-glow-halo { animation: none; opacity: 0.5; }
}
```

plus `useReducedMotion()` from framer-motion in `DraggableSheet` and `TrainRouteSheet`, switching `SPRING` to
`{duration: 0}`. The sheets must still *arrive* at the right position — reduced motion removes the tween, not the
geometry (P7).

## 8.11 Voice and copy standard

Already good; three rules to make it consistent.

1. **Never say "Loading".** Say what is loading, or show its shape. `"Loading map…"` becomes the map's own skeleton.
2. **State the fact, then the consequence, then the fix — in that order, one sentence each.** `LocationNotice` already
   does this (title / hint / retry) and is the model.
3. **Numbers never abbreviate their unit inconsistently.** Today: `"2h 29m"`, `"12m"`, `"5 mins"`, `"18 min"`,
   `"10min"` all appear. `formatDuration` is the single source (`CLAUDE.md` correctly notes localising it is §6.6
   phase 4) — but `LiveJourneyScreen.tsx:27`'s local `fmtMins` and the raw `${leg.travelMins}min` at line 369 bypass it.
   One formatter, twelve call sites, no local copies.

## 8.12 Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| < 360px | Everything must survive. Chip rows wrap; the sheet header grows and the peek grows with it (already correct). |
| 360–767px | The design target. Single column, 20px gutters. |
| ≥ 768px | Content caps at `--layout-max-width` and centres — **including `HomeSearch`, the sheet header, `LineStatusPills` and `DraggableSheet`, which currently do not cap.** The sheet itself caps and centres over the map. |
| ≥ 1024px | No new layout. This is a phone app rendered large; a two-pane desktop layout is out of scope and should stay out. |
| Landscape < 500px tall | The sheet's `mid` snap must not exceed 60% of viewport height (`DraggableSheet.tsx:100` already caps at 60% — verify against a 375 × 320 viewport). |

---

# 9. Component Audit

Every reusable component, with its single most important defect and the fix. **Sev**: C = critical, M = major,
m = moderate, p = polish.

## 9.1 The four parallel systems

Before the table: there are four *independent* implementations of "a small labelled thing", and they should be two.

| System | Files | Renders |
|---|---|---|
| `Chip` (home) | `HomeScreen.tsx:72` | pill, 12px semibold, `--c-bg` fill, border, tone=alert |
| `Chip` (search) | `HomeSearch.tsx:500` | pill, 13px semibold, `--c-card` fill, 44px min-height, `active` state |
| `FactChip` | `FactPrimitives.tsx:27` | **rounded-lg**, 11px bold **uppercase**, border or accent fill |
| `LineBadge` | `LineBadge.tsx` | circle, 5 sizes, `font-black` |

Three of these are the same component with different opinions. **Consolidate to `Chip` (one implementation, props:
`tone` ∈ plain | accent | warn | success, `size` ∈ sm | md, `interactive` derived) and keep `LineBadge` separate** —
it is a distinct object (a circular identifier), not a chip.

Similarly, there are two `SectionLabel` implementations: `FactPrimitives.tsx:15` (11px, icon required) and
`HomeSearch.tsx:537` (10px, icon optional), plus `settingsRows.tsx:13`'s `SectionHeader` (9px, no icon) and
`AllTrainsList.tsx:24` / `RouteTimeline.tsx:25` inline `<h3>`s at 9px. **Four implementations of a section label.**
One survives: `SectionLabel` at `--t-caption` (12/16, 600, uppercase, `+0.06em`), icon optional.

## 9.2 Component-by-component

| Component | File | Defect | Sev | Fix |
|---|---|---|---|---|
| `DraggableSheet` | `components/DraggableSheet.tsx` | No `role`/`aria-modal` at `full`; no Escape; no safe-area padding; radius 22px (off-scale); shadow literal | M | Add `--r-xl`, `--elev-over`, `env()` bottom pad, `aria-expanded` on the grab handle, Escape → step down one snap |
| `SearchBar` | `journey/components/SearchBar.tsx` | Idle "button" is 237 × **40** — under target; blur 18px is correct but not tokenised; `<input>` at 16px is the one correct body size in the app | m | 44px min-height on the tappable span; tokens |
| `DepartureRow` | `journey/components/DepartureRow.tsx` | `opacity: 0.55` when departed compounds every contrast failure; primary figure 20/22px is right, subtitle 12px `--c-text-4` is not; `text-[14px]` title should be `--t-headline` | M | Strike-through + `--c-text-4` (no opacity); title → 17px; subtitle → 13px |
| `LineBadge` | `components/LineBadge.tsx` | `font-black` = faux bold (900 not loaded); white-on-blue 3.68:1; `xs` = 20px, below any target if made tappable | C | `font-bold`; `LINE_BADGE_BG` per §8.4; document that it is never interactive |
| `Chip` (home) | `journey/components/HomeScreen.tsx:72` | `alert` tone hardcodes `#f0997b` (2.00:1) and `rgba(216,90,48,0.35)`; already in `DISCREPANCIES.md` | C | Consolidate; use `--c-warn` |
| `Chip` (search) | `journey/components/HomeSearch.tsx:500` | Duplicate of the above with different metrics | m | Delete, use consolidated `Chip` |
| `FactChip` | `components/FactPrimitives.tsx:27` | 11px uppercase; `rounded-lg` where every other chip is a pill | m | `--t-caption`, `--r-pill` |
| `SectionLabel` ×4 | 4 files | Four implementations at 9/10/11px | M | One, at `--t-caption` |
| `StatTile` | `components/FactPrimitives.tsx:67` | `text-lg` (18px) value over a 10px uppercase label — the label is below the floor | M | Value `--t-title-2`, label `--t-caption` |
| `FactNote` | `components/FactPrimitives.tsx:58` | 11px `--c-text-4` = 4.40:1 | M | `--t-footnote`, `--c-text-3` |
| `Row` (settings) | `journey/components/settingsRows.tsx:44` | 14px label / 11px value; `focus-visible:outline-none` replaced with a background tint that is 1.03:1 against the card in dark | M | 17/13; real focus ring |
| `SectionHeader` | `journey/components/settingsRows.tsx:13` | **9px** | C | `--t-caption` |
| `SectionCard` | `journey/components/settingsRows.tsx:213` | Correct (border, no shadow, `--r-lg` after rename) | — | tokens only |
| `Switch` | `journey/components/settingsRows.tsx:174` | 44 × **26** — target too short; knob `#fff` hardcoded in the off state | M | 44 × 44 hit area around a 44 × 26 track; `--c-card` |
| `ExpandableRow` | `journey/components/settingsRows.tsx:124` | No `aria-expanded`; disclosure is not announced | M | `aria-expanded` + `aria-controls` |
| `ThemeToggle` | `journey/components/YouScreen.tsx:70` | 88 × **26**; knob colours hardcoded `#000`/`#fff` | M | 44px hit height; tokens |
| `LanguagePicker` | `journey/components/YouScreen.tsx:124` | Correct — 44px min, `lang` per button, `aria-pressed`. Model for segmented controls. | — | Promote to a shared `SegmentedControl` |
| `LocationNotice` | `components/LocationNotice.tsx` | Entire component hardcodes `rgba(250,204,21,…)` and `text-yellow-600` (2.84:1); has the app's only `role="status"` | C | `--c-warn*`; keep `role="status"` |
| `AccountCard` | `account/AccountCard.tsx` | Sign-in inputs are 40px tall; errors are not `aria-live`; `AuthForm` appears with no motion or focus move | M | 52px inputs; `role="alert"` on the error; focus the email field on expand |
| `JourneySummary` | `journeySheet/JourneySummary.tsx` | Best-composed component in the app. Defects: `#f59e0b` literal ×3; picker cells `py-2.5` → ~38px tall; ticket note at 11px `--c-text-4` | M | `--c-warn`; 44px cells; `--t-footnote` / `--c-text-3` |
| `AllTrainsList` | `journeySheet/AllTrainsList.tsx` | `opacity: 0.4` for infeasible + `0.6` for tight; `rgba(255,255,255,0.7)` on selected assumes a light foreground on the orange fill (which uses **black** ink) — so the selected row's subtitle is white-on-orange ≈ 2.3:1 | C | Colour not opacity; `rgba(0,0,0,0.65)` on selected |
| `RouteTimeline` | `journeySheet/RouteTimeline.tsx` | 9px heading; `LINE_DOT_BG`/`LINE_TRACK_BG` are Tailwind class strings, so line colour lives in three maps | M | `--t-caption`; collapse to one `LINE_COLORS` read |
| `LiveJourneySummary` | `journeySheet/LiveJourneySummary.tsx` | Instruction 15px, countdown 15px, label 9px; the *one* number that matters is the same size as the sentence beside it | C | Instruction `--t-headline`, countdown `--t-title-1` numeral, label `--t-caption` |
| `LiveJourneyScreen` | `journey/components/LiveJourneyScreen.tsx` | `STATE_PILL` hardcodes 9 colour pairs (`#3B82F6`, `#EAB308`, `#22C55E`, `#052e14`, `#111`); local `fmtMins` bypasses `formatDuration`; dev-only pills ship in the row's scroll logic | M | Map to `--c-info` / `--c-warn` / `--c-success`; delete `fmtMins` |
| `ActionPill` | `journey/components/LiveJourneyScreen.tsx:43` | `rgba(239,68,68,…)` and `#EF4444` literals; height ~40px | M | `--c-danger-bg`; 44px |
| `RailCell` / `ConnectorRow` | same file | `rgba(255,255,255,0.92)` dot assumes a dark rail — on `yellow` (`#EAB308`) the dot is 1.1:1 | m | Use `--c-card` for the dot, or black on yellow |
| `ExitGuidance` | `journey/components/ExitGuidance.tsx` | 11px `--c-text-4` with 11px icons — the app's most important safety content is its least legible | M | `--t-footnote`, `--c-text-3`, 16px icons |
| `StationSheetActions` | `stationSheet/StationSheetActions.tsx` | Single primary CTA, correct. `py-3.5` = 50px | p | 52px |
| `UpcomingTrains` | `stationSheet/UpcomingTrains.tsx` | "View all" is 63.8 × **19.5** and `--c-accent` at 2.80:1; `text-green-500` hardcoded live dot | C | Tertiary button spec; `--c-accent-ink`; `--c-success` |
| `TabButton` | `journey/components/StationDetail.tsx:265` | 43.5px in the sheet (44 on the page); `aria-pressed` used where `role="tab"` + `aria-selected` belongs | M | 48px; real tab semantics |
| `AttributeCard` | `journey/components/StationDetail.tsx:292` | 13px title / 11px description in `--c-text-4` | M | `--t-callout` / `--t-footnote` |
| `LineScheduleCard` | `journey/components/StationDetail.tsx:160` | Four status branches, four hardcoded Tailwind colour utilities at **9px** | C | `--c-*` tokens at `--t-caption` |
| `MergedTrainList` | `journey/components/StationDetail.tsx:50` | `maxHeight: 360` scroller nested inside the sheet's scroller → two scroll regions, no scroll-chaining guard | M | `overscroll-contain`, or lift the cap |
| `TrainRouteSheet` | `journey/components/TrainRouteSheet.tsx` | z-40/50 under a z-900 sheet (hence the portal); no `role="dialog"`; close button 32 × 32; `rounded-t-3xl` vs the other sheet's 22px | M | `--z-modal`, dialog semantics, 44px close, `--r-xl` |
| `StationInput` | `journey/components/StationInput.tsx` | Label at **9px**; input 17px is correct; clear button measured **27 × 27** | C | `--t-caption`; 44px clear |
| `Planner` suggestions | `journey/components/Planner.tsx:262` | `text-neutral-500`, `bg-neutral-50 dark:bg-neutral-800/50`, `text-blue-500`, `text-red-500` — the one component that still uses raw Tailwind palette utilities and `dark:` variants | M | Tokens throughout |
| `Row` (search) | `journey/components/HomeSearch.tsx:78` | Eyebrow 11px / title 15px / meta 11px `--c-text-4`; directions button 40 × 40 | M | 13 / 17 / 13; 44px |
| `blocks.tsx` | `info/blocks.tsx` | **The best-typeset file in the app** (`Body`: 14px/relaxed/`--c-text-2`). Only defects: `SourceLinkBlock` hardcodes an English string (line 277) and is 34px tall; `#22c55e`/`#f87171`/`#f59e0b` literals in `Marker`/`ProseBlock` | m | `--t-body` at 16; tokens; 44px link |
| `InfoPage` | `info/InfoPage.tsx` | Back button 36 × 36; page has no `<title>`; blurb 13px | M | 44px; per-route title (§11) |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | Correct, minimal, tokenised. Button is 36px tall. | p | 52px |
| `YouScreenFallback` / `InfoPageFallback` | 2 files | **Correct.** Real furniture, right margins, `aria-hidden`. The model for every other loading state. | — | — |
| `Countdown` | `journey/components/Countdown.tsx` | **Unused** — no import site found. Also hardcodes `h/m/s` suffixes outside `formatDuration`. | p | Delete or adopt |
| `Insights` / `ScrollReset` / `LanguageSync` | 3 files | Correct leaf pattern, no UI | — | — |

## 9.3 Components that must be created

Six. None adds a feature; each replaces something currently hand-rolled or absent.

| New component | Replaces | Why |
|---|---|---|
| `Toast` | nothing (G5) | Save/remove/copy/sync confirmation. `role="status"`, bottom-anchored above the safe area, 4s, one at a time, dismissible. |
| `Dialog` | nothing (G5, G8) | Wraps the planner, `HomeSearch` and `TrainRouteSheet`: `role="dialog"`, `aria-modal`, focus trap, Escape, focus restore. **One implementation, three consumers.** |
| `Button` | ~60 hand-rolled `<button className=…>` | The five roles of §8.8 with one press, one focus ring, one disabled treatment. |
| `SegmentedControl` | `LanguagePicker`, `Planner`'s now/depart/arrive, `TabButton` pair, `JourneySummary`'s picker | Four segmented controls, four implementations, four heights (44 / 38 / 44 / 38). |
| `EmptyState` | 5 ad-hoc strings | `search.emptyHint`, `journey.noMoreTrains`, `noMoreTrainsFrom`, `savedPlacesEmpty`, `nothingFound` are five different layouts for the same idea. Icon + line + optional action. |
| `Skeleton` | 3 ad-hoc treatments | Generalises what `YouScreenFallback` already does correctly. |

---

# 10. Screen-by-Screen Audit

Each screen: what it does, what is measurably wrong, why it hurts, what to do, and what it costs.
**Difficulty**: ○ trivial (tokens/find-replace) · ◐ moderate (component change) · ● hard (layout/behaviour).

---

## 10.1 `/` — Home, station mode

**The app's front door.** Map + floating chrome + sheet at `mid`.

**Measured (375 × 812, light, cold):** 450 interactive elements · 1,590 text-bearing elements · 20 distinct type
combos · 15 contrast-failure classes · 15 sub-44px target classes · 0 `<h1>` · 1 heading total · sheet content
1,617px in a 699px window at `full`.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| H1 | Station markers render at 8–16px + stroke (measured 12 × 12 to 22 × 22) | C | Selecting a station is the primary map gesture and it is a quarter-size target | Keep the drawn glyph; give the `divIcon` a 44 × 44 transparent hit box (`iconSize` up, `iconAnchor` centred) | ◐ |
| H2 | Line status pills measured **30.5px** tall, and are `<button role="listitem">` | C | Under target *and* stripped of button semantics for AT | 44px min-height; drop `role="listitem"`, wrap in `<ul><li>` or use `role="group"` | ○ |
| H3 | Station name is a `<div>`; page has no `<h1>` | M | The subject of the screen is unnavigable by heading | `<h1>` on the station name, visually unchanged | ○ |
| H4 | "Nearest station" eyebrow is 10px `--c-accent` = **2.80:1** | C | The one label that tells you the app guessed | `--t-caption` + `--c-accent-ink` | ○ |
| H5 | Alert `Chip` at **2.00:1** | C | Service-closed warnings are unreadable | `--c-warn` | ○ |
| H6 | Walking-directions and save buttons measured **36 × 36** | M | Two of three header actions under target | 44 hit area, 36 visual | ○ |
| H7 | "View all" measured **63.8 × 19.5** at 2.80:1 | C | The affordance that opens the full schedule | Tertiary button spec | ○ |
| H8 | FAB and recentre hide by `opacity: 0` when they don't fit (`HomeScreen.tsx:729, 749`) | M | Correct instinct, wrong mechanism: the elements stay in the a11y tree and the transition is invisible-but-focusable for 200ms | `visibility: hidden` + `aria-hidden`, or conditional render | ○ |
| H9 | Sheet header tap toggles `collapsed→mid→full` but the header is not a button and carries no `aria-expanded` | M | An undiscoverable, unannounced control on the app's main surface | `role="button"`, `aria-expanded`, `tabIndex` (`LiveJourneySummary` already does this correctly — copy it) | ○ |
| H10 | `"Loading map…"` centred text at `--c-text-4` | m | Cold-start impression of a map-first app | Map skeleton (grey tile grid + route strokes) | ◐ |
| H11 | No `env(safe-area-inset-bottom)` on the sheet body or the recentre button (measured `bottom: 17px`) | C | On a home-indicator device the recentre button is in the swipe-up zone | `max(16px, env(...))` | ○ |
| H12 | Chip row can reach 6 chips (line + distance + walk + interchange + 3 modes) at 12px | m | The peek grows to accommodate, which is correct, but the row is noise at the resting snap | Cap at 3 chips at `collapsed`; reveal the rest at `mid` | ◐ |
| H13 | `--layout-max-width` not applied to the sheet or its header | m | At 768px+ the header runs edge-to-edge over a capped body | Apply | ○ |

---

## 10.2 `/` — Home, plan mode

Header (route + chips + close) over `JourneySummary` → `RouteTimeline` → `AllTrainsList`.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| P1 | Header route names at 16px, `--c-text-3` for source and `--c-text` for dest | m | The asymmetry is deliberate and good, but 16px bold truncated to ~120px each means both usually ellipsise | Stack on two lines at `--t-headline` when either would truncate | ◐ |
| P2 | Departure picker cells measured ~38px tall | M | Four side-by-side targets, all under minimum, all changing the whole screen | 44px | ○ |
| P3 | `AllTrainsList` selected row uses `rgba(255,255,255,0.7)` subtitles on the orange fill whose ink is **black** | C | Selected row's arrival time is ~2.3:1 | `rgba(0,0,0,0.65)` | ○ |
| P4 | Infeasible rows at `opacity: 0.4`, tight at `0.6` | M | Two meanings, one channel, both illegible | Strike-through + `--c-text-4` for infeasible; `--c-warn` border + label for tight | ○ |
| P5 | "Route" and "All trains today" headings at **9px** | C | The section structure of the results is below the legibility floor | `--t-caption` | ○ |
| P6 | Ticket note (`JourneySummary.tsx:218–228`) at 11px `--c-text-4` | M | The one line that tells you which ticket to buy on a cross-phase trip | `--t-footnote`, `--c-text-3`, `--c-info-bg` card | ○ |
| P7 | `'#f59e0b'` appears three times for "tight" | M | Warning colour off-token | `--c-warn` | ○ |
| P8 | Start Journey measured 333 × **49** at y 621–670 | p | Just under the 52px spec | 52px | ○ |

**What is already right and must survive:** the one-hero-one-support layout; `rideMinsOf` never `totalMins`; arrival
not repeated in the header; the meridiem printed only when it changes.

---

## 10.3 `/` — Home, live mode

Collapsed peek (80px) is `LiveJourneySummary`; the body is `LiveJourneyScreen`.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| L1 | Instruction 15px and countdown 15px — same size | C | "Get off at the next stop" and "2 min" compete; the number should win instantly at arm's length | Instruction `--t-headline` (17), countdown `--t-title-1` (22) numeral | ○ |
| L2 | Countdown label at **9px** | C | Below floor | `--t-caption` | ○ |
| L3 | The peek carries no way to end the journey | M | §7.4 — the only exit requires expanding the sheet mid-ride | Add a 44px End icon button to band 2 (product decision) | ◐ |
| L4 | Countdown is not `aria-live` | M | A blind rider gets no announcement when the instruction changes | `aria-live="polite"` on band 2, `aria-atomic` | ○ |
| L5 | `STATE_PILL` hardcodes 9 colour pairs | M | Journey state is the app's most semantic colour use and it is entirely off-token | Map to `--c-info` / `--c-warn` / `--c-success` | ○ |
| L6 | Passed stops fade at `opacity-50`/`opacity-40` over **500ms** | M | Compounds contrast; half a second is narrative time for a state change | `--c-text-4` + strike; `--motion-state` | ○ |
| L7 | Action pills scroll horizontally, competing with the sheet's vertical drag (the code comment at line 486 says exactly this) | M | The comment identifies the cause (dev-only pills) but the row is still a scroller in production with 3 items | Fixed 3-up grid; delete the scroller | ◐ |
| L8 | `fmtMins` (line 27) bypasses `formatDuration`; `${leg.travelMins}min` at line 369 bypasses both | m | Three duration formats on one screen | One formatter | ○ |
| L9 | `journey-glow-pulse` runs at 1.6s infinite with no reduced-motion escape | M | WCAG 2.3.3 | §8.10 media query | ○ |
| L10 | `ExitGuidance` — the arrival safety content — is 11px `--c-text-4` | M | Least legible presentation of the most consequential content | `--t-footnote`, `--c-text-3` | ○ |

---

## 10.4 Search overlay (`HomeSearch`)

**Measured:** 119 interactive elements · scroll height **3,780px** · 8 sub-44px target classes · **0 headings** ·
`role: null` · focus correctly moves to the input · **no Escape, no trap**.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| S1 | No `role="dialog"` / `aria-modal` / focus trap / Escape | C | Tab walks into the 450 elements behind it | `Dialog` wrapper (§9.3) | ◐ |
| S2 | A 3,780px flat directory of 54 stations with no headings and no index | M | Finding a station by browsing means a long scroll with no landmarks; the line-group headers are `<div>`s | `<h2>` per line group; sticky group headers; A–Z rail or a persistent line index | ● |
| S3 | Row: eyebrow 11px / title 15px / meta 11px `--c-text-4` | M | Three sizes within 4px; the meta line carries the *reason a row matched* and is the least legible part | 13 / 17 / 13, meta in `--c-text-3` | ○ |
| S4 | Directions button 40 × 40; back and settings 40 × 40; line pills 30px | M | Every secondary control under target | 44 | ○ |
| S5 | Landmark search shows a spinner in the pill but the list below shows nothing for 400ms | m | Reads as "no results" during the debounce | Three skeleton rows under a "Landmarks" label | ◐ |
| S6 | Facet chips are a horizontal scroller with no scroll affordance | m | Two of four facets are off-screen at 375px with no cue | Edge fade + `aria-label` on the scroller | ○ |
| S7 | Empty hint is one 12px sentence in `--c-text-4` | m | The empty state of the app's main search | `EmptyState` component | ◐ |

---

## 10.5 Planner overlay

**Measured:** `role: null` · `aria-modal: null` · **`document.activeElement` is `BODY` on open** · CTA "View Route
Options" at y **551–607** of an 812px viewport with 756px of content · 5 sub-44px target classes including a **27 × 27**
clear button and a 36 × 36 swap.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| N1 | Focus is not moved on open | C | A keyboard/AT user opens the planner and is nowhere | Focus the first empty field; `Dialog` wrapper | ○ |
| N2 | Primary CTA floats mid-screen | M | `mt-auto` inside a non-full-height flex column. On a 900px viewport it drifts further from the thumb; on a short landscape it collides with the recents list | Pin to the bottom with `env(safe-area-inset-bottom)`; scroll content above it | ◐ |
| N3 | Field labels ("From"/"To") at **9px** | C | Below floor, and they are the only thing distinguishing two identical inputs | `--t-caption` | ○ |
| N4 | Clear button **27 × 27** | C | Smallest target in the app | 44 | ○ |
| N5 | Swap button overlays the field rows at `right-4 top-1/2`, 36 × 36 | M | Overlaps the destination input's text at long station names; under target | 44px, in its own gutter column | ◐ |
| N6 | Remove-recent-trip is `<div role="button" tabIndex={0}>` **nested inside a `<button>`** (`Planner.tsx:416–425`) | C | Invalid HTML; the inner control is unreachable by keyboard in practice and its click bubbles | Sibling `<button>`, not a child; add undo (§9.3 `Toast`) |◐|
| N7 | Five status notices (running / before-first / after-last / bus-only / same-station) in five different card treatments and five colours, three from raw Tailwind | M | The most state-dense block in the app has no shared shape | One `Notice` shape: `--c-*-bg` + `--c-*` + icon + one sentence | ◐ |
| N8 | Suggestion dropdown uses `bg-neutral-50 dark:bg-neutral-800/50` and `text-neutral-500` | M | The only surviving `dark:` variants in the app; bypasses the token layer entirely | Tokens | ○ |
| N9 | `datetime-local` input inherits the browser's chrome | m | Unavoidable and correct — but it is 44px and unlabelled | `aria-label`; keep native | ○ |
| N10 | Title "Where to?" is 36px `text-4xl` while the whole overlay has 9 text elements | p | Correct: this is the one screen that should breathe | keep | — |

---

## 10.6 `/stations/:id` — Station page

**Measured:** 16 type combos · 457 text elements · 115 interactive · page height 989px · back button 36 × 36 ·
`<title>` is the **home page's title**.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| T1 | No per-route `<title>` / `canonical` / `og:*` | M | Share sheet, tab, back-stack and screen-reader announcement all say "Metrothi — Ahmedabad Metro Route, Map, Timings & Fare Planner" | `useDocumentTitle(station.name)`; per-route canonical | ◐ |
| T2 | Hero: 36px name + `xl` (56px) line badges + three uppercase tags + line names + "stop N of M" | M | Five competing elements before any content; the badges are 56px circles carrying one letter each | Name at `--t-display`; badges at `md`; tags → one chip row | ◐ |
| T3 | Four line-status branches at **9px** in four Tailwind palette colours | C | Below floor and off-token | `--t-caption` + tokens | ○ |
| T4 | `TabButton` measured 43.5px in the sheet; uses `aria-pressed` not tab semantics | M | Under target; AT hears two toggle buttons, not a tab set | 48px; `role="tablist"`/`tab`/`tabpanel` | ◐ |
| T5 | `MergedTrainList` is a `maxHeight: 360` scroller *inside* the page scroller (and inside the sheet's scroller on `/`) | M | Nested scroll with no `overscroll-contain`; on the sheet that's a third scroll region competing with the drag | `overscroll-contain`; consider removing the cap on the page | ◐ |
| T6 | First/last-train column labels at **9px**; `StatTile` labels at 10px | C | Below floor | `--t-caption` | ○ |
| T7 | `AttributeCard` 13/11 with an 18px accent icon | M | The icon outweighs its own title | 15/13, 16px icon | ○ |
| T8 | Back button 36 × 36; sticky bar has no `env(safe-area-inset-top)` | M | Under target; on a notched device the bar sits under the status bar | 44; `env()` | ○ |
| T9 | "Not found" state uses `text-yellow-400` (`StationDetail.tsx:810`) — the only surviving raw yellow, on a link | m | Off-token, low contrast | `--c-accent-ink` | ○ |
| T10 | Info tab renders 5 sections with no scroll landmarks over ~1,600px | m | No way to jump to Entrances or Connections | Sticky sub-labels, or collapse to disclosure groups | ◐ |

---

## 10.7 `/you` — Settings

**Measured:** 73 text elements · 22 interactive · **12 type combos** for 73 elements · 4 contrast failures (all 4.40) ·
4 sub-44 targets · type sizes 9, 10, 11, 12, 13, 14, 16, 36 — **nothing between 16 and 36**.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| Y1 | `SectionHeader` at **9px** — nine times on this screen | C | The entire IA of the settings screen is below the legibility floor | `--t-caption` | ○ |
| Y2 | Row 14px label / 11px value | M | The value line carries the actual setting state ("Brisk · 5.5 km/h", "Not synced") | 17 / 13 | ○ |
| Y3 | `ThemeToggle` 88 × **26**; `Switch` 44 × **26**; `<select>` 120 × **29** | M | Three of the four controls on the screen are under target | 44px hit heights | ○ |
| Y4 | Eight sections in a flat list, ordered by history not by frequency | M | "Riding the metro" (reference prose) sits above Preferences, Saved and History — the comment at `YouScreen.tsx:276–281` argues this, and it was right when those were stubs. They are real now. | Reorder: Account · Preferences · Saved · History · Appearance+Language · Riding the metro · Help · Data · About · Feedback | ○ |
| Y5 | Three "Feedback" rows, two of which have **no handler** | M | `you.reportTimetable` and `you.suggestFeature` render as plain rows with no affordance — correct per the `Row` contract, but they read as broken | Give them `mailto:` targets or remove them | ○ |
| Y6 | Version string is hardcoded (`YouScreen.tsx:360`) while `VITE_APP_VERSION` exists | m | Already in `DISCREPANCIES.md` | Render the env var | ○ |
| Y7 | Nothing between 16px and 36px | M | The title floats with no relationship to anything below it | `--t-display` 34 + `--t-title-2` 20 section heads creates the missing rung | ○ |
| Y8 | No `env(safe-area-inset-bottom)`; `pb-28` (112px) is a guess | m | Over-pads on flat devices, under-pads on some | `max(48px, env(...))` | ○ |

---

## 10.8 `/you/:topic` — Reference pages

**Measured (`/you/fares`):** page height **3,759px** · 76 text elements · **2 interactive elements** · 10 type combos ·
3 contrast failures at 4.40 · back button 36 × 36 · `<title>` is the home page's.

This is the app's **Document** register and the only place it exists. `blocks.tsx:56–68` gets it right and says so.

| # | Problem | Sev | Why it hurts | Fix | Diff |
|---|---|---|---|---|---|
| R1 | Body is 14px; measure is 768px | M | ~90 characters at 14px is a wall, and 3,759px of it | `--t-body` (16/24); cap at 65ch | ○ |
| R2 | 3,759px with no navigation, no progress, no section index | M | Nine sections, no way to reach one | Sticky section label; optional in-page ToC | ◐ |
| R3 | Section labels at 11px uppercase, two different leadings (15.125 and 16.5) measured on the same page | M | The same role rendered two ways | `--t-caption`, one leading | ○ |
| R4 | `FactNote` and `SourceLinkBlock` at 4.40:1 | M | Provenance — the app's stated principle — is the least legible thing on the page | `--c-text-3` | ○ |
| R5 | `SourceLinkBlock` hardcodes "Read the original on gujaratmetrorail.com" (`blocks.tsx:277`) | m | The one un-keyed UI string in the feature; violates the project's own i18n rule | Bundle key with the domain interpolated | ○ |
| R6 | Back button 36 × 36; no `env(safe-area-inset-top)` | M | As T8 | 44; `env()` | ○ |
| R7 | No per-route `<title>` | M | As T1 — and these are the pages most likely to be shared as links | `useDocumentTitle(topic.title)` | ◐ |

---

## 10.9 `TrainRouteSheet`

| # | Problem | Sev | Fix | Diff |
|---|---|---|---|---|
| K1 | `z-40`/`z-50` under a `z-900` sheet; survives only via `createPortal` | M | `--z-modal: 1400`; keep the portal as an implementation detail | ○ |
| K2 | No `role="dialog"` / `aria-modal` / focus trap / Escape; backdrop click is the only dismissal | C | `Dialog` wrapper | ◐ |
| K3 | Close button 32 × 32 | C | 44 | ○ |
| K4 | `rounded-t-3xl` (24px) vs `DraggableSheet`'s 22px | p | `--r-xl` (28) for both | ○ |
| K5 | `setTimeout(…, 150)` then `scrollIntoView({behavior:'smooth'})` on mount | m | Racy and unreduced-motion-aware; use the same measured-offset scroll `MergedTrainList` uses | ○ |
| K6 | Station rows: 14px name / 14px time, past stops struck through **and** dimmed **and** recoloured | m | Three channels for one state; keep strike + colour, drop the opacity | ○ |

---

## 10.10 Onboarding

**There is none, and that is correct.** The app is usable with no account, no network and no Supabase project
(`CLAUDE.md`'s load-bearing invariant). Do not add an onboarding flow.

What is missing is **first-run orientation at the point of use**, which is different:

- The location permission is requested on mount (`App.tsx:70`) with no priming. HIG §I.2/§I.3 (Agency): ask *after*
  showing why. Recommendation: request on first interaction with the map or the planner, not on boot; until then show
  the default station with `LocationNotice` already visible.
- The sheet's drag affordance is a 36 × 4px grab handle. A single first-run "bounce" of the sheet from `collapsed` to
  `mid` (which already happens — `snap` initialises to `'mid'`) is enough; no coach mark.
- The "Simulated" tag (`LiveJourneyScreen.tsx:446`) is 9px uppercase in `--c-text-4` inside a border. This is the
  app's most important honesty disclosure and it is currently its quietest text. Raise to `--t-caption` in
  `--c-warn-bg`/`--c-warn`.

---

# 11. Navigation Audit

**The model is right.** Four routes, one persistent shell, no tab bar (`--nav-h` always `0px`), planning as a mode
rather than a destination. Nothing here changes it.

| # | Problem | Sev | Detail | Fix |
|---|---|---|---|---|
| V1 | No per-route document identity | M | `<title>`, `canonical` and every `og:*` tag are fixed to the site root. Verified: `/stations/vastral-gam` and `/you/fares` both report the home title. | `useDocumentTitle()` hook; per-route `<link rel=canonical>`; keep `index.html` as the fallback |
| V2 | Back means three different things | M | `navigate(-1)` on `/stations/:id`, `/you`, `/you/:topic`; `onClearResult` in plan mode; `onClose` in overlays; browser back does nothing to any overlay | Overlays should push a history entry so hardware/browser back closes them. This is the single biggest navigation defect on Android. |
| V3 | Three ways into the planner | m | The FAB, `home-plan-trip` `CustomEvent`, and router `state.planTrip` from `/stations/:id` | Fine as an implementation; but the event path means the planner cannot be deep-linked or restored |
| V4 | The sheet's snap is not in history | m | Expanding to `full` then pressing back leaves the route | Optional: treat `full` as a history state |
| V5 | No breadcrumb from `/stations/:id` back to a search | m | Back returns to whatever was there, which after a deep link is nothing | If `history.length === 1`, back navigates to `/` |
| V6 | `index.html`'s BreadcrumbList JSON-LD advertises `/go`, `/map`, `/stations` — **none of which exist** | M | Structured data claiming four routes when there are four *different* ones | Correct to `/`, `/stations/:id`, `/you`, `/you/:topic` |
| V7 | The search overlay is the station directory | p | Correct and deliberate — the directory doubles as the empty state. Keep. | — |

---

# 12. Accessibility Audit

All figures measured in the running application at 375 × 812 unless stated. Contrast is computed from the composited
effective background (walking the ancestor chain and compositing every alpha), not from the declared token — so a
0.08-alpha tint over a card is evaluated as what the eye actually receives.

## 12.1 Contrast

**Route `/`, light theme — 15 unique failure classes:**

| Ratio | Needs | Foreground | Effective background | Size / weight | Where |
|---|---|---|---|---|---|
| **1.60** | 4.5 | `#eab308` | `#ebebec` | 11 / 600 | `LineStatusPills` status text |
| **1.74** | 4.5 | `oklch(0.795 0.184 86.047)` (`text-yellow-500`) | `#f4f4f5` | 9 / 700 | `LineScheduleCard` "Starts in…" |
| **2.00** | 4.5 | `#f0997b` | `#f4f4f5` | 12 / 600 | `HomeScreen` alert `Chip` |
| **2.80** | 4.5 | `#f97316` | `#ffffff` | 10 / 700 | "Nearest station" eyebrow |
| **2.80** | 4.5 | `#f97316` | `#ffffff` | 13 / 600 | "View all" |
| **2.84** | 4.5 | `oklch(0.681 0.162 75.834)` (`text-yellow-600`) | `#fffbed` | 12 / 700 | `LocationNotice` title |
| **2.84** | 4.5 | same | same | 11 / 700 | `LocationNotice` retry |
| **2.93** | 4.5 | `#ef4444` | `#f3dedf` | 15 / 700 | `DepartureRow` initial glyph (red) |
| **2.94** | 4.5 | `#3b82f6` | `#dde6f5` | 15 / 700 | `DepartureRow` initial glyph (blue) |
| **3.68** | 4.5 | `#ffffff` | `#3b82f6` | 12 / 900 | `LineBadge` letter |
| **3.68** | 4.5 | `#3b82f6` | `#ffffff` | 12 / 700 | `DepartureRow` "Next ·" |
| **3.76** | 4.5 | `#ef4444` | `#ffffff` | 12 / 700 | `DepartureRow` "Next ·" |
| **4.40** | 4.5 | `#71717a` | `#f4f4f5` | 12 / 600 | separators |
| **4.40** | 4.5 | `#71717a` | `#f4f4f5` | 11 / 600 | "Every ~10 min · both directions" |
| **4.40** | 4.5 | `#71717a` | `#f4f4f5` | 11 / 700 | "End of service" |

**Route `/`, dark theme — 6 unique failure classes:** 3.60 (`#71717a` on `#1a1a1a`), 3.68 (`#ffffff` on `#3b82f6`),
3.97 ×2 (`#71717a` on `#0f0f0f`), 4.10 and 4.11 (line glyphs on their tints).

**Route `/you` — 4 classes**, all `#71717a` on `#f4f4f5` at 4.40.
**Route `/you/fares` — 3 classes**, all the same.

**The shape of the problem:** three causes account for all 15.

1. `--c-text-4` (#71717a) is 0.10 short of AA and is used everywhere → §8.4 token change fixes 6 of 15 outright.
2. `--c-accent` used as ink → `--c-accent-ink` fixes 2.
3. No warning token → `--c-warn` fixes 4.

The remaining 3 are the line-colour glyphs, addressed in §8.4's `LINE_BADGE_BG` decision.

**Dark mode has a second, non-text problem:** `--c-border` is `#1f1f1f` against `--c-card` `#1a1a1a` — **1.03:1**. Every
row divider, card edge and separator in dark mode is invisible. `--c-border-2` at `#2a2a2a` is 1.28:1. Both must lift
(§8.4 proposes `#262626` / `#333338`).

## 12.2 Touch targets

HIG minimum: **44 × 44 pt**. Measured on `/`: 450 interactive elements, 15 distinct under-minimum classes.

| Element | Measured | Where |
|---|---|---|
| Station marker (plain) | **12 × 12** | `HomeMap.stationMarkerIcon`, `size: 8` + `stroke: 2` |
| Station marker (interchange) | **16 × 16** | `size: 12` + stroke |
| Station marker (terminal) | **18 × 22** | `size: 14` + 4 + stroke |
| Station marker (selected) | **22 × 22** | `size: 16` + stroke 3 |
| Line status pill | **115 × 30.5** | `LineStatusPills` |
| Walking directions | **36 × 36** | `HomeScreen` header |
| Save station | **36 × 36** | `HomeScreen` header |
| "View all" | **63.8 × 19.5** | `UpcomingTrains` |
| Schedule / Station Info tabs | **162.5 × 43.5** | `TabButton` in sheet |
| Search idle target | **237 × 40** | `SearchBar` |
| Settings / close icon buttons | **40 × 40** | `SearchBar`, planner, `/you` |
| Clear origin | **27 × 27** | `StationInput` |
| Swap | **36 × 36** | `Planner` |
| Theme toggle | **88 × 26** | `YouScreen` |
| Usage-data switch | **44 × 26** | `settingsRows.Switch` |
| Default-departure `<select>` | **120 × 29** | `PreferencesSection` |
| Back (station page, info page) | **36 × 36** | both sticky bars |
| Close (`TrainRouteSheet`) | **32 × 32** | portaled sheet |

**Every one of these can be fixed without changing a single visual dimension** — extend the hit area with padding or a
pseudo-element and keep the drawn circle at 36px. The map markers are the exception and need the `divIcon` box grown.

## 12.3 Structure, semantics and focus

| Finding | Measured | Severity |
|---|---|---|
| `<h1>` on `/` | **0**; one heading total on the app's primary route | M |
| Landmarks | `<main>` only. No `<nav>`, `<header>`, `<footer>`, `<section>` anywhere | M |
| Modal semantics | 0 of 3 overlays have `role="dialog"` or `aria-modal`; 0 have a focus trap; 0 handle Escape | C |
| Focus on open | Search: ✅ input. Planner: ❌ `BODY`. `TrainRouteSheet`: ❌ | C |
| Focus restore on close | None of the three restore focus to the trigger | M |
| Focus ring | 5 declarations app-wide; 4 of them are `focus-visible:outline-none` replaced by a background tint that in dark mode is **1.03:1** against the card | C |
| `aria-live` | **0**. The live-journey countdown, the sync status, the search result count and every removal are silent | M |
| `role="status"` | **1** (`LocationNotice`) | — |
| `role="listitem"` on `<button>` | `LineStatusPills.tsx:55` — **replaces** the button role | M |
| Nested interactive | `Planner.tsx:416` — `<div role="button">` inside `<button>`; invalid | C |
| Tabs | `TabButton` uses `aria-pressed`, not `role="tab"`/`aria-selected`/`tabpanel` | M |
| Disclosure | `ExpandableRow` has no `aria-expanded`/`aria-controls` | M |
| Dynamic type | Every size is absolute `px`. iOS/Android text-size settings and browser zoom do not scale the app's own type | M |
| Reduced motion | **0** declarations, against 6 continuously-running animations | C |
| Safe areas | **0** `env()` declarations with `viewport-fit=cover` set | C |
| Images | 12 `<img>`, all with `alt=""` — all decorative station photos, and correctly so | ✅ |
| Accessible names | 0 buttons without an accessible name | ✅ |
| Language | `lang` set on `<html>` and per-button in `LanguagePicker` | ✅ |
| Switch semantics | `role="switch"` + `aria-checked` on `Switch`, `aria-pressed` on toggles, `role="radio"` in the pace picker | ✅ |

**The focus ring is worth calling out separately.** Four of the five focus declarations in the app *remove* the
browser's outline and substitute `background: var(--c-card-alt)`. In light that is `#fafafa` on `#ffffff` — 1.02:1. In
dark it is `#222222` on `#1a1a1a` — 1.03:1. **Keyboard focus is effectively invisible everywhere in this application.**
One `:focus-visible` rule in `index.css` using `--c-focus` fixes all of it.

## 12.4 What is already right

Worth protecting during the sweep: every button has an accessible name; `aria-pressed` and `role="switch"` are used
correctly where they appear; `aria-label` sentences are whole strings, never built from translated fragments
(`StationInput`, `LiveJourneySummary` both carry comments explaining why); the language picker labels each option in
its own script with its own `lang`; decorative images are correctly `alt=""`; `.select-text` deliberately re-enables
selection on copyable content.

---

# 13. Interaction Audit

| # | Area | Finding | Sev | Fix |
|---|---|---|---|---|
| I1 | Press feedback | 8 treatments (§G4) | M | One: `scale(0.97)` / 120ms |
| I2 | Hover | 5 declarations app-wide; 445 of 450 elements on `/` have none | M | One hover rule on `Button` and `Row`, pointer-only (`@media (hover: hover)`) |
| I3 | Focus | Invisible (§12.3) | C | One `:focus-visible` rule |
| I4 | Disabled | `opacity` 0.3 / 0.5 / 0.6 across three components | M | Colour, not opacity |
| I5 | Selected | `JourneySummary` picker uses fill + shadow; `AllTrainsList` uses fill; `TabButton` uses fill; facet `Chip` uses fill + border. Four selected treatments. | m | One: accent fill + `--c-accent-fg` + `aria-pressed`/`aria-selected` |
| I6 | Gestures | Sheet drag is excellent. But: horizontal scrollers appear in 4 places (`LineStatusPills`, facet chips, quick chips, live action pills) and three of them sit inside the vertically-dragging sheet | M | Delete the live action-pill scroller (3 items fit); keep the others but add edge affordances |
| I7 | Scroll | Three nested scroll regions on the station sheet at `full`: page → sheet content → `MergedTrainList` (`maxHeight: 360`). Only the sheet has `overscroll-contain`. | M | `overscroll-contain` on all; consider removing the 360 cap |
| I8 | Transitions | 4 durations + 2 inline CSS durations; 500ms used for state changes | m | Three tokens (§8.10) |
| I9 | Optimistic updates | Already correct everywhere — Dexie write is never awaited, `useLiveQuery` re-renders on the tombstone. **This is the app's best-kept UX secret and it is completely invisible** because there is no confirmation layer | M | `Toast` makes the existing local-first speed *legible* |
| I10 | Error handling | `ErrorBoundary` for crashes ✅. Geocoding failure → an inline red line in the dropdown ✅. Sync failure → a settings row nobody reads ❌. Failed sign-in → inline ✅. | m | Route sync errors to `Toast` |
| I11 | Success feedback | Save: icon fill change. Copy: 1,500ms icon swap. Remove: silence. Clear data: silence. | M | `Toast` |
| I12 | Undo | None anywhere. Two destructive actions (remove recent trip, clear local data) are irreversible and silent. | M | Undo in the `Toast` for removals; keep the two-tap for clear-data |
| I13 | Discoverability | The sheet header's tap-to-expand is not signalled at all in station and plan modes (`LiveJourneySummary` correctly shows a chevron) | M | Chevron in all three headers |
| I14 | Loading | 5 treatments (§G6) | m | Skeletons everywhere; delete the spinner and the pulsing word |
| I15 | Simulate / +5 min | `import.meta.env.DEV`-gated, correctly, with an excellent comment. But they are still the reason the row is a scroller in production. | m | Grid the production row at 3 |

---

# 14. Visual Hierarchy Audit

## The mechanism that failed

Hierarchy needs three channels: **size**, **weight**, **colour**. Metrothi has effectively lost all three:

- **Size** — 16 rendered sizes, but 11/12/13/14 carry the app. A 3px range cannot express three levels.
- **Weight** — 86% of declarations are 600 or 700. Nothing recedes.
- **Colour** — four ink levels, of which the fourth fails contrast and is therefore used *as if* it were a fifth.

With all three saturated, the only channel left is **position**, and position alone cannot say "this is the answer".

## Per-surface: what is largest vs. what matters

| Surface | Largest element | What the rider came for | Aligned? |
|---|---|---|---|
| Home / station | Station name, 22px | The next departure countdown, 20px | ✗ — near-tie |
| Home / plan | "Leave in" figure, 32px | The same | ✅ |
| Home / live (peek) | Instruction 15px = countdown 15px | The countdown | ✗ — tie |
| `/stations/:id` | Station name 36px, line badge letter **24px** | The next train, 22px | ✗ — the badge outranks the train |
| `/you` | Title 36px | The setting you came to change, 14px | ✗ — 22px gap to nothing |
| `/you/:topic` | Title 36px | The rules, 14px | ✗ |
| Search | Row titles 15px | The row you want | ✅ (list, no hero needed) |

**Four of seven surfaces make the wrong thing biggest.** In every case the fix is the same shape: the *answer* takes
`--t-hero` or `--t-title-1`, the *subject* takes `--t-title-2`, and everything else drops to `--t-headline` or below.

## The 24px line badge

`LineBadge size="xl"` is 56 × 56 with a 24px letter, rendered up to twice in the station hero. It carries one bit of
information that the adjacent line name, the adjacent colour, and the schedule card below all repeat. It is the second
largest text in the app.

**Recommendation:** the `xl` variant is deleted. The hero uses `md` (28px) badges beside the name. This is the single
highest-leverage hierarchy change in the document and it costs one prop.

## Focal-point rule to adopt

> **Every surface has exactly one element at `--t-hero` or above, and it is the answer to that surface's question
> (§2). If two elements compete, one of them is not the answer.**

Testable: a lint rule or a visual-regression check counting elements above a size threshold per screen.

---

# 15. Information Architecture Audit

| # | Finding | Sev | Recommendation |
|---|---|---|---|
| A1 | **The three registers are undeclared** (§7.2). Reference prose and a live countdown are typeset within 3px of each other. | M | Adopt the three registers; they are the IA made visible |
| A2 | **`/you` mixes four unrelated kinds of thing**: the account, app preferences, the rider's stored data, and GMRC reference content. The reference content sits *above* preferences. | M | Reorder per Y4. The GMRC topics are arguably a fifth route, not a settings section — but that is a PRD change and out of scope here. |
| A3 | **The search overlay is three surfaces in one**: recent/saved shortcuts, a 54-station directory, and live search results. It works, but the directory (3,780px) dominates. | m | Keep the union; add group headings and an index so the directory is navigable rather than scrollable |
| A4 | **Station page has two tabs and the wrong one is default.** `Schedule` opens first, and on the home sheet the schedule is *already* shown above (`UpcomingTrains`), so expanding to `full` shows the same content twice before the info tab. | M | On the sheet, default to `info`; on the page keep `schedule` |
| A5 | **Twelve computed values are never surfaced.** The engine calculates `isTight`, `warnings`, `initialWaitMins`, `bufferMins`, `currentFrequencyMins`, `resumesInMins`, per-leg `travelMins`, `strandedAtLine`, `totalStops` per leg, and provenance dates — several render in only one of the three places they'd be useful. | m | Deliberately last (Phase 4). Adding content before fixing legibility makes things worse. |
| A6 | **The live journey duplicates the plan.** `RouteTimeline` and `LiveJourneyScreen`'s rail are two renderings of the same stop list with different geometry, type and colour. | m | Not a merge — they answer different questions — but they should share a `StopRow` primitive |
| A7 | **Provenance is scattered.** The `_meta` dates appear in `/you` → About & Data; the "Simulated" tag appears in the live journey; `sourceNote` appears in station connections; `SourceLinkBlock` appears per reference page. Four voices for one principle. | m | One `Provenance` component, four call sites, one visual treatment |
| A8 | **Reading order is broken on the station sheet header.** DOM order is: photo → eyebrow → name → walk button → save button → chips. A screen reader hears "Nearest station, Old High Court, walking directions, save, Blue Line, 400 m, 6 min walk". The actions interrupt the identity. | M | Move the action group after the chip row in DOM, position it visually with grid |

---

# 16. Prioritised Roadmap

Four phases. **Phase 1 changes no layout** — it is entirely tokens and attributes, and it fixes every legal and safety
defect. Phases are sequential because each depends on the previous one's vocabulary.

---

## Phase 1 — Critical: the legibility, safety and semantics floor

*Nothing here changes a layout, a workflow or a component's shape. All of it is enforceable by test afterwards.*

| # | Item | Why Phase 1 | Files |
|---|---|---|---|
| 1.1 | Add the full token file (§8.4): `--c-text-4` theme-aware, `--c-accent-ink`, `--c-warn*`, `--c-info*`, `--c-focus`, dark `--c-border` lift | Fixes 12 of 15 contrast failures on `/` with zero visual restructuring | `index.css` |
| 1.2 | Replace all 24 hardcoded hex literals and every Tailwind palette colour utility with tokens | Removes the second and third colour spaces; makes 1.1 actually take effect | 18 `.tsx` files |
| 1.3 | Raise every `text-[9px]` and `text-[10px]` to `--t-caption` (12px) | 24 occurrences below the platform floor | 11 files |
| 1.4 | Every interactive element to a 44 × 44 minimum hit area (visual size unchanged) | 15 classes on `/` alone; one of them is 27 × 27 | 14 files + `HomeMap` |
| 1.5 | `env(safe-area-inset-*)` on both sticky bars, the sheet body, the planner, `/you`, `/you/:topic` | A layout bug on every notched device; one line each | 6 files |
| 1.6 | Global `:focus-visible` ring using `--c-focus`; remove the four `focus-visible:outline-none` substitutions | Keyboard focus is currently invisible app-wide | `index.css` + 4 files |
| 1.7 | `prefers-reduced-motion` media query + `useReducedMotion()` in both sheets | WCAG 2.3.3; 6 continuously-running animations | `index.css`, 2 files |
| 1.8 | Fix `<button role="listitem">`; fix the `<div role="button">` nested in a `<button>` | Both strip or invalidate semantics | 2 files |
| 1.9 | `<h1>` on `/`; `<h1>`/`<h2>` structure on every route | The front door has no heading | 4 files |
| 1.10 | `font-black` → `font-bold` on `LineBadge`; drop `wght@300` from the font request | Faux bold on the most-repeated glyph; an unused weight on the render-blocking path | `LineBadge.tsx`, `index.html` |
| 1.11 | `tokens.test.ts` — asserts no hex literal outside `constants.ts`, no `text-[<12px]`, no Tailwind colour utility | Makes 1.1–1.3 permanent, the way `locales.test.ts` does for i18n | new |

**Exit criteria:** zero contrast failures on all four routes in both themes (re-run §20's probe); zero targets under
44px; `axe` clean for colour-contrast, target-size, heading-order and nested-interactive rules.

---

## Phase 2 — Major UX: the questions the app answers badly

*Now the vocabulary exists. This phase spends it on hierarchy and the missing feedback layer.*

| # | Item | Why Phase 2 | Depends on |
|---|---|---|---|
| 2.1 | Apply the type ladder (§8.3) across all four routes | 21 declarations → 11 roles. This is the change a user actually *sees*. | 1.3 |
| 2.2 | Build `Dialog` (§9.3) and wrap the planner, `HomeSearch`, `TrainRouteSheet` | Three critical a11y defects, one component | 1.6 |
| 2.3 | Build `Toast`; wire save / remove / copy / clear-data / sync-error, with undo on removals | The app has no way of confirming anything it does | — |
| 2.4 | Fix the four wrong focal points (§14): delete `LineBadge size="xl"`; raise the live countdown above its instruction; raise the station-sheet departure above the station name | The single highest-leverage hierarchy change | 2.1 |
| 2.5 | Per-route `<title>` + `canonical`; fix the BreadcrumbList JSON-LD | Three of four routes report the wrong identity | — |
| 2.6 | Overlays push a history entry so hardware back closes them | The biggest navigation defect on Android | — |
| 2.7 | Fix reading order in the station sheet header (A8) | Actions interrupt identity for AT users | 2.1 |
| 2.8 | `aria-live` on the live countdown; `role="tab"` on `TabButton`; `aria-expanded` on `ExpandableRow` and the sheet headers | Completes the semantics started in 1.8/1.9 | 1.8 |
| 2.9 | Reorder `/you` (Y4); give or remove the two handler-less Feedback rows | The settings screen's IA predates its own features | — |

**Exit criteria:** every surface has exactly one element at `--t-hero`+; all three overlays trap focus and close on
Escape and on hardware back; every mutation produces a visible confirmation.

---

## Phase 3 — Polish: consistency and the design system proper

| # | Item | Why Phase 3 |
|---|---|---|
| 3.1 | Spacing scale (§8.2): 11 gap steps → 6; standardise the gutter at 20px | Invisible individually, decisive in aggregate |
| 3.2 | Radius scale (§8.6): 7 → 5 + pill; concentric nesting | ditto |
| 3.3 | Elevation (§8.5): 5 shadow strings → 2 tokens; 4 blur values → 1; named z-layers | ditto |
| 3.4 | Build `Button`; migrate ~60 hand-rolled buttons to the five roles | One press, one focus, one disabled — everywhere |
| 3.5 | Build `SegmentedControl`; migrate 4 implementations | Four controls, four heights, one idea |
| 3.6 | Consolidate `Chip` ×2 + `FactChip`, and `SectionLabel` ×4 | Six components become two |
| 3.7 | Icon system: 14 sizes → 4, 5 strokes → 1 | Removes the "icons look wrong" class of complaint entirely |
| 3.8 | Skeletons everywhere; delete the spinner, the pulsing word and the "Loading map…" string | Generalises the one loading pattern that is already right |
| 3.9 | `EmptyState`; migrate 5 ad-hoc empties | — |
| 3.10 | Apply `--layout-max-width` to `HomeSearch`, the sheet, the sheet header, `LineStatusPills` | The only real responsive defect |
| 3.11 | `overscroll-contain` on all three nested scrollers; grid the live action row | Removes gesture competition inside the sheet |
| 3.12 | Delete `Countdown.tsx` (unused) and `fmtMins`; one duration formatter | Two forks of a single-source rule |

**Exit criteria:** ≤ 6 gap values, ≤ 5 radii, 2 shadow tokens, 4 icon sizes, 1 press treatment, 1 focus treatment,
measured by re-running §20's probe.

---

## Phase 4 — Delight and refinement

Everything here is earned only after Phases 1–3. Each item is optional, and each is defensible as *not* shipping.

| # | Item | Rationale |
|---|---|---|
| 4.1 | Surface the twelve unsurfaced engine values (A5) | They are already computed; adding them before legibility is fixed makes screens worse, which is why this is last |
| 4.2 | Station-directory index (A–Z rail or sticky line index) over the 3,780px list | A real navigation improvement, but only worth building once rows are legible |
| 4.3 | Shared `StopRow` primitive between `RouteTimeline` and the live rail | Prevents the fork that already exists in miniature |
| 4.4 | Map skeleton (tile grid + route strokes) replacing the text fallback | Cold-start impression |
| 4.5 | One `Provenance` component, four call sites (A7) | Makes the app's stated principle look like one decision |
| 4.6 | Reference-page in-page ToC / reading progress | 3,759px pages |
| 4.7 | Per-script leading (`--leading-scale`) for hi/gu | Real, but it needs a native-reader review, not a designer's judgement |
| 4.8 | Live-journey "End" promoted to the collapsed bar | Blocked on §7.4's product decision |
| 4.9 | Dynamic-type support (rem-based ladder honouring OS text size) | The right end state, but it invalidates every fixed height in the app and must not be attempted before Phase 3 |

---

# 17. Estimated Design Effort

Design + front-end engineering, one pair. Assumes the person doing the work has read this document and `CLAUDE.md`.

| Phase | Design | Engineering | QA / device pass | Total | Can ship independently? |
|---|---|---|---|---|---|
| **1 — Floor** | 2 d (token decisions, contrast verification) | 5 d (tokens, sweep, hit areas, `env()`, focus, semantics, test) | 2 d (2 themes × 3 languages × 3 viewports) | **9 d** | ✅ Yes — and it should ship alone |
| **2 — Major UX** | 5 d (type ladder applied per surface, `Dialog`/`Toast` design) | 8 d | 3 d | **16 d** | ✅ Yes |
| **3 — Polish** | 4 d (scales, component specs) | 9 d (mostly mechanical + 3 new components) | 3 d | **16 d** | ✅ Yes |
| **4 — Delight** | 4 d | 7 d | 2 d | **13 d** | Item by item |
| | | | | **54 d ≈ 11 weeks** | |

**Notes on the estimate:**

- Phase 1 is 60% mechanical. If `tokens.test.ts` is written *first*, the sweep becomes "make the test pass".
- The QA line is not padding. Three languages × two themes × three viewports = 18 combinations, and the i18n
  invariants in `CLAUDE.md` mean a Gujarati wrap can move a sheet's peek height.
- Phase 3's 9 engineering days are almost entirely find-and-replace across 40 files. It is the least risky phase and
  the easiest to descope.
- **Excluded:** any work on the engine, the sync layer, the data files, or the PWA config. This plan touches
  presentation only.

---

# 18. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **The type ladder breaks the sheet's peek geometry.** `COLLAPSED_H: 118`, `PLAN_COLLAPSED_H: 104`, `LIVE_COLLAPSED_H: 80` and `TOP_CHROME_H: 128` are tuned to current type sizes. Raising 11px→13px and 15px→17px will grow every header. | **High** | Medium | `DraggableSheet` already computes `Math.max(collapsedHeight, headerH)` and reports `onRestEdgeChange` — the mechanism is correct. Re-derive the four constants after 2.1 and re-verify at 360px in Gujarati. |
| R2 | **Boot-path regression.** Any new import in `HomeScreen`, `App`, or `index.css` costs first paint. | Medium | High | New components (`Toast`, `Dialog`, `Button`) must be tree-shakeable and must not pull into `/you`'s split. Re-measure per `CLAUDE.md`'s rule: **sum every JS file `index.html` loads**, not the `index-*.js` line. |
| R3 | **i18n breakage.** Larger type + longer Indic strings = more wrapping in fixed-height rows. | **High** | Medium | Every fixed height becomes a `min-height`. `locales.test.ts` stays green but cannot catch layout; the Phase QA pass must include all three languages. |
| R4 | **Line-colour change is rejected.** §8.4 option (a) darkens the *badge* fill, which someone will read as changing signage. | Medium | Low | The decision is documented with both options and their consequences. If (a) is rejected, (b) is a valid AA path — but the badge must then never appear without its line name. |
| R5 | **Theme mirror desync.** The `localStorage` paint hint and Dexie can disagree; the 0.25s `background` transition on `html, body, #root` then cross-fades the whole page. | Low | Low | Verified reproducible under artificial desync. Not a bug today, but the transition should be dropped from `html` (keep it on `#root`) so a disagreement resolves in one frame. |
| R6 | **Scope creep into features.** "While we're in here" is how a consolidation becomes a rewrite. | **High** | High | The PRD wins on conflict. Anything not in this document's tables goes to `DISCREPANCIES.md`, per the project's own rule. |
| R7 | **Dynamic type (4.9) attempted too early.** Converting to rem invalidates every fixed height including the sheet constants. | Medium | High | Explicitly Phase 4, explicitly after the spacing and radius scales land. |
| R8 | **The 44px sweep visually inflates dense surfaces.** Naively resizing controls to 44 makes the sheet header and the settings rows look bloated. | Medium | Medium | Extend hit areas with padding/pseudo-elements; keep drawn dimensions. Stated in 1.4 and §8.8. |
| R9 | **No visual regression net.** There are no screenshot tests, and the preview pane cannot produce frames (§20). | Medium | Medium | Add the §20 probe as a Playwright assertion (contrast, target size, type-combo count) rather than pixel diffs. Cheaper, more durable, and catches what actually regressed. |

## Invariants this plan must not break

Restated from `CLAUDE.md` so they are visible to anyone working from this document alone:

1. The app stays fully usable with no account, no network and no Supabase project.
2. Dexie holds user data only; bundled transit JSON is never written to it.
3. Deletes are tombstones. Reads filter them.
4. `rideMinsOf()`, never `totalMins`, for anything presented as trip duration.
5. No fabricated real-time data. "Live" is simulated and must say so.
6. GMRC-sourced facts only; absence renders as absence, never as a negative.
7. No stand-in station photos.
8. UI strings through `t()`; station/line names, GMRC's wording and mode labels stay English in all three languages.
9. A React-free module returns a bundle key plus proper nouns, never a sentence.
10. One whole key per sentence shape; never a base sentence with fragments appended.
11. Colours from custom properties. `LINE_COLORS` are the documented exception.
12. Both `/you` routes stay lazy; the theme's `localStorage` mirror stays.
13. Animation is framer-motion. Tailwind `animate-in` utilities generate nothing in this project.
14. Both departure lists render through `DepartureRow`.

---

# 19. Final Recommendations

**1. Ship Phase 1 by itself, this week.** Nine days, no layout change, no workflow change, no visual risk — and it
closes every accessibility defect that would matter in an audit, a store review, or a court. It is also the only phase
whose value does not depend on any other phase landing.

**2. Write `tokens.test.ts` before writing any token.** This project has already proved the pattern works:
`locales.test.ts` is why the i18n rules held for months across three languages. The same test — no hex outside
`constants.ts`, no type below 12px, no Tailwind colour utility, no gap outside the scale — is what stops the 21 type
sizes coming back. Without it, Phase 3 is a treadmill.

**3. Treat this as consolidation, not redesign.** Say it in the commit messages. The instinct that produced 21 type
sizes is the same instinct that produced `DepartureRow` and `settingsRows` — the difference is that components had a
place to be shared and numbers didn't. Give the numbers a place.

**4. Fix `--c-text-4` first, and alone, and measure it.** One token, two values, six contrast failures resolved, and
it is the single most-used text colour in the app. It is the cheapest legible improvement available and it should not
wait behind anything.

**5. Delete `LineBadge size="xl"`.** One prop removal, and the station page's hierarchy inverts back to correct. It is
the highest ratio of impact to diff in this entire document.

**6. Build `Dialog` once and use it three times.** The planner, the search overlay and `TrainRouteSheet` have three
independent implementations of "cover the screen" and three independent omissions of dialog semantics. One component
closes all three, and `TrainRouteSheet`'s `createPortal` stops being load-bearing.

**7. Add the feedback layer before adding any content.** The app's local-first architecture is genuinely fast — every
mutation is a Dexie write that never awaits the network — and a rider cannot tell, because nothing ever confirms
anything. `Toast` is the component that makes work already done become visible.

**8. Do a real device pass, in Gujarati, at 360px, in sunlight.** Every number in this document came from a headless
Chromium at 375 × 812. That is enough to prove the defects and to specify the fixes; it is not enough to sign off the
result. The preview pane cannot even composite a frame (§20), so nobody has yet *looked* at this app under the
conditions it was built for.

**9. Do not touch the architecture.** Map-as-canvas, one sheet, three modes, no tab bar, nothing unmounting, engine
free of React, three data layers that never mix. Every recommendation above works inside it, and the ones that
couldn't were dropped.

---

# 20. Method — how every number here was obtained

So that any of it can be challenged, re-run, or turned into a regression test.

**Environment.** `npm --prefix app run dev` on `develop` @ `5e3d0c5`; headless Chromium via the in-app browser pane;
viewport forced to 375 × 812 @ dpr 2; light theme default, dark forced by `localStorage['metrothi-theme']='dark'` +
reload so the boot script applies it before React mounts.

**Counts over source** (`21` type sizes, `24` hex literals, `11` gap steps, `8` press treatments, `9` z-indexes,
`14` icon sizes, `10` × `w-9 h-9`, `102/69/26/1/1` weights, `0` × `env(`, `0` × `prefers-reduced-motion`) are
ripgrep counts over `app/src`, excluding `*.test.ts`.

**Contrast** is computed in-page, not from source. For each element with a direct text child and a non-zero rect:
resolve `getComputedStyle(el).color` and every ancestor's `backgroundColor` through a 1 × 1 canvas drawn twice — once
over `#ffffff`, once over `#000000` — so `oklch()`, `color()` and alpha all resolve to straight RGBA
(`a = 1 − (w.r − b.r)/255`). Composite the ancestor chain from `#root` inward, then apply WCAG 2.x relative luminance.
Threshold 3.0 for ≥ 24px or ≥ 18.66px-bold, else 4.5. Results deduplicated by `color|fontSize|fontWeight`, which is
why the tables count *classes*, not instances. Leaflet panes are excluded: map labels rely on a text-shadow halo, not
a background, and would report as false failures.

**Two artefacts of the harness, and how they were controlled for.** (a) The preview tab reports
`document.visibilityState === 'hidden'`, so `requestAnimationFrame` never fires — framer-motion's `y` motion value
stays at 0 and the sheet renders at its `full` snap regardless of the `snap` prop. Sheet *positions* therefore could
not be measured; everything else could. (b) `html, body, #root { transition: background 0.25s }` never completes for
the same reason, so toggling `data-theme` in-page leaves a stale root background. Both theme datasets were therefore
captured on a **fresh page load** with the theme already committed to `localStorage`, never by toggling in-page. Two
independent runs of the dark pass agreed exactly (6 failure classes, identical ratios).

**Touch targets** are `getBoundingClientRect()` over
`button, a, input, select, [role=button], [role=switch], [role=radio]` within `#root`, deduplicated by
`accessibleName|w×h`.

**Semantics** (`role`, `aria-modal`, `document.activeElement`, heading counts, landmark counts, `alt` coverage) are
read from the live DOM immediately after opening each surface — the search overlay by clicking its trigger, the
planner by dispatching the `home-plan-trip` `CustomEvent` its host listens for.

**Suggested regression test.** The contrast probe, the target-size probe and the type-combo counter are ~60 lines
together and run in any Playwright context. Asserting *"zero contrast failures, zero sub-44px targets, ≤ 8 type combos
per route, in both themes"* is a stronger and far more durable net than screenshot diffing, and it is what would have
prevented every finding in §12.

---

*Prepared 2026-08-03 against `develop` @ `5e3d0c5`. Every contrast ratio, element count, rect and computed style in
this document was read out of the running application; every source count was obtained by search across `app/src`
excluding tests. Nothing is estimated, and §20 is sufficient to reproduce all of it.*
