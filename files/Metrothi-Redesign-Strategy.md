# Metrothi — UI/UX Redesign Strategy

**Status:** Strategy document. **No code changes are made by this document.**
**Date:** 2026-08-03 · **Branch:** `develop` @ `5e3d0c5` · **Scope:** the entire client surface, audited from source.
**Method:** every screen, route, overlay, sheet and reusable component read in full from `app/src`. Every contrast
ratio in this document is **computed** from the literal values in the code, not estimated. Counts (type sizes,
colour literals, touch targets) are grepped, not sampled.

## How this document relates to the two that already exist

| Document | Owns | Relationship to this one |
|---|---|---|
| `files/Metrothi-PRD.md` | *What* is built. Product vision, scope, non-goals. | **Wins on conflict.** Nothing here changes a feature or a workflow. |
| `CLAUDE.md` | *How* it is built. Boot budget, data layering, i18n invariants. | **Wins on conflict.** Several invariants constrain the redesign; §18 lists them. |
| `files/Metrothi-Design-Guide.md` | The HIG, distilled (Part I), and a target design derived from the app's **data** (Part II). | **Normative reference.** Part I is the argument layer; I cite it rather than restate it. |
| **This document** | The **diff**: what is actually built, measured against that target, with a costed plan to close it. | The missing third piece. |

The Design Guide states its own method explicitly: *"Part II is a redesign plan for Metrothi derived from the app's
data, not from its current design."* It deliberately never audited the implementation. That audit is this document.
Where the Guide proposed a target (a type ladder, a semantic ramp, three elevations), I treat it as the brief and
report how far the code is from it — and where measurement showed the Guide's own proposal was insufficient, I say so
and supply corrected values.

---

# 1. Executive Summary

Metrothi is a well-engineered application wearing an unfinished interface. The gap is not carelessness — the source is
among the most carefully reasoned I have read, with load-bearing comments explaining *why* each non-obvious decision
was made. The gap has a single, specific, structural cause:

> **The design token layer stops at 14 colours. There is no type scale, no spacing scale, no elevation scale, no
> semantic status palette, no touch-target primitive, and no button component.**

Everything downstream follows from that. Forty-one components each make locally reasonable decisions with no shared
vocabulary to make them in, and the aggregate is:

| Symptom | Measured |
|---|---|
| Distinct type sizes rendered | **16** (9, 10, 11, 12, 12.5, 13, 14, 15, 16, 17, 18, 20, 22, 24, 32, 36 px) |
| Instances of type below the HIG's 11 pt floor | **24** across 14 files |
| The app's single most-used type size | **11 px**, 59 instances — its de facto body size |
| Hard-coded colour literals in components | **63** (38 hex + 25 `rgba()`) across 10 files |
| Distinct box-shadow literals | **6**, plus `shadow-2xl` and an arbitrary accent glow |
| Duplicate line-colour maps | **4** where 2 would do; two of them disagree on yellow |
| Components implementing "a chip" | **3** · "a row" **3** · "a section label" **2** · "a segmented control" **3** |
| Contrast pairs tested / failing | **32 tested, 26 fail** |
| `env(safe-area-inset-*)` declarations | **0**, with `viewport-fit=cover` opted in |
| `prefers-reduced-motion` / `prefers-contrast` handling | **0** |
| `role="dialog"` / focus traps on 4 full-screen overlays | **0** |
| `aria-live` regions on a continuously-updating live journey | **0** |

Three findings deserve to be read before anything else.

**1. The failures cluster precisely where the tokens ran out.** Where a token exists — `--c-text`, `--c-card`,
`--c-accent-fg` — the app is consistent and correct. `--c-accent-fg` was recently fixed to `#000` (7.49:1) and every
consumer inherited the fix for free. Where no token exists — status colours, type sizes, elevation, touch targets —
the app is chaotic. This is a **coverage** problem, not a taste problem, and it means the fix is systematic rather
than a 41-file rewrite.

**2. The light theme is the untested one, and it is the default.** Of the 26 failing contrast pairs, 19 fail only in
light. The status palette (`#22c55e`, `#eab308`, `#f59e0b`, `#f87171`, `#c084fc`) works on near-black and collapses on
near-white — it was authored in dark mode. `ThemeContext.tsx:35` then defaults to `'light'` and never reads
`prefers-color-scheme`, so a rider whose phone is in dark mode gets the app's least-tested surface on first paint.

**3. Colour is being asked to carry semantics the line palette already owns.** Blue/Red/Yellow/Violet are fixed by
GMRC signage and cannot move (`CLAUDE.md`). The app then overloads the same hues: `LiveJourneyScreen.tsx:32` paints
the "waiting for train" state in `#EAB308` — byte-identical to the Yellow Line. Red means both "Red Line" and "error".
The Design Guide predicted this collision (§II.6.4); the code committed it.

**The recommendation is not a visual redesign.** The application's architecture — map-as-canvas, one contextual sheet
with three faces, no tab bar — is correct and should not be touched. What it needs is a **foundation retrofit**: build
the missing token layer, then propagate. Phase 0 changes nothing visible and unblocks everything else. Phases 1–2
close every safety and accessibility defect. Only Phase 3 onward is aesthetic.

Estimated total: **34–48 working days** across design and engineering (§17), of which the first 13 carry
roughly 80% of the user-visible benefit.

---

# 2. Overall Design Assessment

## What kind of product is this, and what should it feel like?

The Design Guide names the emotional target as **confidence** — *"the specific relief of knowing you will make your
train"* (§I.1.8). I agree, and I want to sharpen it, because "confidence" alone under-specifies the visual work.

Metrothi is read in three postures, and only one of them is comfortable:

1. **Standing on a platform, one hand, 2–4 seconds, possibly in direct Ahmedabad daylight.** The rider wants one
   number. This is 80% of sessions and it is the posture the current design serves *worst* — because at 11px, with a
   status colour at 2.07:1, the answer is present but not legible at arm's length.
2. **Moving — walking to the station, riding, changing lines.** The rider wants one instruction. The live journey is
   the app's best-designed surface for this and still puts its countdown at 15px.
3. **Seated, at leisure — fare rules, prohibited items, lost and found.** A different mode entirely. It currently uses
   the same 13px UI typography at a 768px measure (≈110 characters), which serves neither scanning nor reading.

A design that works in posture 1 works everywhere. A design that works in posture 3 fails in posture 1. **The current
design is calibrated for posture 3 and used in posture 1.** That single sentence explains the type scale, the density,
and most of the hierarchy problems.

## The verdict

| Dimension | Grade | Note |
|---|---|---|
| Information architecture | **A−** | Genuinely excellent. Map-first, one sheet, three modes, no tab bar. Do not touch. |
| Engineering craft | **A** | Gesture handoff, pre-paint seeding, boot-budget discipline, i18n rigour. Exceptional. |
| Interaction model | **B+** | The sheet is properly built. Undermined by touch targets and missing feedback. |
| Component discipline | **C−** | No shared primitives for the things used most. Four parallel systems. |
| Typography | **D** | 16 sizes, no scale, body set ~1.5 steps too small, 24 instances below any floor. |
| Colour system | **D** | 14 tokens covering ~30% of what the app colours. 63 literals. 26 contrast failures. |
| Accessibility | **D−** | Below the legal floor in several places, and structurally absent (no dialogs, no live regions, no focus visibility). |
| Motion | **B** | One shared spring, framer-motion throughout, dead classes removed. No reduced-motion support. |
| Copy & voice | **B−** | Careful and honest. Capitalisation unruled; two labels still committee-speak; emoji in the settings header. |

**Composite: the app is a B+ product inside a D+ interface.** That ratio is the opportunity — the expensive half is
already done.

---

# 3. Strengths

These are real, they are rare, and the redesign must **preserve** them. Listing them is not politeness; several are
constraints on what follows.

**S1 — The architecture is right, and it was arrived at deliberately.** Map-as-canvas with one contextual sheet is
what Citymapper converged on after years. `App.tsx:176` keeps the map and sheet mounted through planning and the live
journey rather than navigating, so there is no page transition to design and no state to restore. This is the correct
answer and it is already built.

**S2 — `DraggableSheet` is a genuinely good component.** Velocity-based flick detection (`DraggableSheet.tsx:187`),
correct scroll/drag handoff with an 8px threshold (`:272`), `touch-action` switched per snap with the reasoning written
down (`:258`), and pre-paint position seeding so it never flashes at `y=0` (`:151`). Most teams never reach this.

**S3 — The content-fitted mid snap.** `midContentHeight` (`:98`) rests the sheet at the *end of a content block*
rather than an arbitrary fraction, so the fold never lands mid-row. This is a subtle, expensive detail done correctly.

**S4 — `SearchBar`'s shared-geometry trick.** One pill, two variants, identical 40px icon slots so the placeholder and
the input start at the same x-offset and nothing jumps on open (`SearchBar.tsx:9–20`). Keep this pattern; extend it.

**S5 — Honest data handling as a design stance.** Absence is never rendered as a negative (`ConnectionsBlock` returns
`null` on 43 stations rather than printing "No connections"). Fares show nothing rather than a guess. No stand-in
station photos. This is HIG principle 3 executed better than most shipping apps manage.

**S6 — The i18n discipline is exemplary.** Four whole keys for four sentence shapes (`LiveJourneyScreen.tsx:522–533`)
rather than fragments concatenated — because Hindi and Gujarati put the verb last. React-free modules emit *keys plus
proper nouns*, never sentences. `StationInput` was rebuilt to take a discriminator instead of reading a translated
label back (`StationInput.tsx:4–15`). This is a class of bug most teams ship for years.

**S7 — `FactPrimitives.tsx` is a design system nucleus that already works.** `SectionLabel`, `FactChip`, `FactNote`,
`StatTile` — four primitives, shared between the station Info tab and the reference pages, with `cardBg` passed so the
same block inverts correctly on the sheet. **This file is the model for everything §8 proposes.**

**S8 — `DepartureRow` is correctly shared.** Both departure lists render through it (`CLAUDE.md` records that they
were hand-rolled separately once and drifted). The `primary` prop switching which figure takes the large slot is the
right abstraction.

**S9 — Real progress since the 2026-07-26 teardown.** Verified fixed: negative departure times (`JourneySummary.tsx:50`
now renders "Now"), the accent CTA's contrast (`--c-accent-fg: #000`, 7.49:1), debug controls gated behind
`import.meta.env.DEV`, the eight dead settings rows (`Row` now derives interactivity from `onClick`/`href` rather than
a `tappable` flag), place-result quality in `HomeSearch`, and the duplicated boarding clock. The team acts on findings.

---

# 4. Weaknesses

Ranked by severity. Each is expanded with evidence in §9–§15.

**W1 — No type system.** 16 distinct sizes, no scale, no tokens, expressed two different ways (`text-[14px]` and
`text-sm` both appear). The most-used size is 11px. 24 instances are at 9–10px, including form labels
(`StationInput.tsx:41`), the `SIMULATED` disclosure (`LiveJourneyScreen.tsx:446`), every settings section header
(`settingsRows.tsx:16`) and every line's service status (`StationDetail.tsx:231–249`).

**W2 — No semantic colour layer.** 63 literals. Status colours are raw Tailwind palette values applied directly
(`text-green-500`, `text-yellow-500`, `text-red-400`, `text-purple-400`), which bypasses the theme system entirely and
fails in light mode by 2–3×.

**W3 — Contrast is below the legal floor in 26 measured pairs**, including safety-relevant signals: line service
status, tight-connection warnings, and the next-train figure on the Yellow Line.

**W4 — Touch targets.** Station markers are **12×12px** on the app's primary interaction surface
(`HomeMap.tsx:43`, an 8px dot plus 2px stroke). Line-status pills ~28px. At least eleven 36px (`w-9 h-9`) icon buttons,
including a bookmark toggle that silently changes saved state. The 44px minimum is met in exactly five places, all
added ad hoc.

**W5 — Safe areas are opted into and then ignored.** `index.html:6` sets `viewport-fit=cover`. `env(safe-area-inset-*)`
appears **zero times** in `src`. The sheet's collapsed peek, the primary CTA, the FAB and the floating search row are
all positioned against the raw viewport edge, so on any notched device they draw into the home indicator and the status
bar. This is the single cheapest high-impact fix in the document.

**W6 — Four parallel component systems.** Three chips, three rows, three segmented controls, two section labels, two
switches, five input treatments — and **no `Button` component at all**. Every one of the 49 `<button>` elements styles
itself.

**W7 — Elevation is ad hoc.** Six shadow literals plus `shadow-2xl`. The three pieces of floating chrome that sit on
the same plane over the map — FAB, recentre, search pill — use three different treatments (`HomeScreen.tsx:728`,
`:748`, `SearchBar.tsx:15`). The HIG's two-layer model (§I.4) is the app's actual architecture and is expressed
inconsistently.

**W8 — Accessibility is structurally absent, not merely imperfect.** No `role="dialog"` or focus trap on four
full-screen overlays; no Escape dismissal on any of them; no `aria-live` on a continuously-updating live journey; the
focus indicator on every settings row is a 1.04:1 background change (i.e. invisible); the two main text inputs set
`outline-none` with no replacement; a `role="button"` div nested inside a `<button>` in the planner
(`Planner.tsx:416–425`) with no key handler.

**W9 — The reference pages use UI typography.** Species C content (fare rules, prohibited items) renders at 13–14px
across a 768px measure — ≈110 characters per line, against a 45–75 optimum.

**W10 — Two search surfaces have diverged.** `HomeSearch` shows place results with their nearest station, distance and
walk time. `Planner` still shows every place with the constant subtitle *"Select to find nearest station"*
(`en.json: planner.placeHint`). Same query, two answers, one of them the one the teardown flagged.

---

# 5. Global UX Problems

Cross-cutting issues that no single screen owns.

### G1 — The app is set roughly 1.5 steps too small, everywhere

The HIG's iOS body size is 17pt with an 11pt floor, and the ladder is *dense between 13 and 22* precisely so hierarchy
can be expressed inside a row without going below legibility (Design Guide §I.2). Metrothi's ladder lives between 9 and
15px. When your entire range is 6px wide, you have no room for three levels of importance — which is why the app reads
as flat even though the developer clearly intended hierarchy. **This is the root cause of "weak visual hierarchy",
not a separate problem.**

### G2 — Emphasis is spent on the wrong things

Count what is currently rendered in `uppercase tracking-widest` — the app's most emphatic treatment: section labels,
eyebrows, "FIRST"/"LAST", "DEFAULT STATION", `SIMULATED`, "NEXT", stat-tile labels, the SOON badge. Almost all of it is
**metadata**. Meanwhile the countdown that answers "should I run?" is 15px in `LiveJourneySummary.tsx:116`, and the
next-train figure is 20–22px. The loudest typography in the app is on the least important content.

### G3 — Opacity is used as a semantic channel

`opacity: 0.55` on departed rows (`DepartureRow.tsx:80`), `0.4`/`0.6` on infeasible and tight journey options
(`AllTrainsList.tsx:47`), `opacity-50`/`opacity-40` throughout the live timeline. Opacity multiplies *both* foreground
and background toward the surface, so it reduces contrast on already-marginal text. A tight connection — a safety
signal — is currently communicated by being 40% harder to read. Per HIG Colour, this also means the state is conveyed
by a single non-textual channel.

### G4 — Interaction feedback is inconsistent and mostly absent

`active:scale-95`, `active:scale-[0.98]`, `active:scale-90`, `active:opacity-70`, `active:opacity-60`, and nothing at
all all appear. There is no hover state on touch-relevant controls, no `:focus-visible` on most, and no pressed state
on the largest targets (the departure cards). The HIG is blunt: *"Without a press state, a button can feel
unresponsive"* (§I.10).

### G5 — There are no toasts, no snackbars, no alerts, and no dialogs

Share success is a 1.5s inline label swap (`LiveJourneyScreen.tsx:249`). Destructive confirmation is a two-tap label
change (`AccountCard.tsx:244`) — actually a *good* pattern, but it is the only one, and it is invisible to a screen
reader because nothing announces the state change. Sync failures, offline transitions, and save confirmations have no
surface at all.

### G6 — Loading states are three different things

A centred text string for the map (`HomeScreen.tsx:668`), a spinner in the search pill (`SearchBar.tsx:83`), two
purpose-built skeleton fallbacks that draw the real furniture (`YouScreenFallback`, `InfoPageFallback` — these are
excellent), and a two-bar pulse in the sheet header (`HomeScreen.tsx:578`). The two good ones should be the pattern.

### G7 — Nothing responds to user preferences the platform already exposes

No `prefers-color-scheme` (theme defaults to light regardless of OS), no `prefers-reduced-motion` (four always-on
infinite animations: `animate-ping`, three `animate-pulse` clusters, and a 1.6s CSS keyframe glow), no
`prefers-contrast`. The HIG's position is that ignoring the system preference makes people *"think your app is
broken"* (§I.3).

### G8 — The disclosure of simulation is now too quiet

The teardown correctly killed the `SIMULATED` badge. What replaced it is a 9px, `--c-text-4`, bordered chip
(`LiveJourneyScreen.tsx:446`) — 4.83:1 at 9px, below the 11pt floor, in the least-read corner of the screen. The
pendulum has swung from "shouting that it's fake" to "technically disclosed". PRD principle 1 asks for honesty; the
right answer is one calm, legible line at a readable size, not a whisper.

---

# 6. Design Principles

Six principles. Each is a decision rule that resolves a real conflict in this codebase — not a slogan.

### P1 — One question per surface, answered without a tap

Every screen has exactly one Species A fact (Design Guide §II.2). It gets the largest type, the highest contrast, and
the top-left position. Everything else is subordinate by construction. *Resolves:* the flat chip rows, the 15px
countdown, the four competing "NEXT" labels.

### P2 — Legibility floor before aesthetic ceiling

Nothing that answers "should I run?" is below **17px** or **7:1**. Nothing at all is below **12px** or **4.5:1**. This
is stricter than the HIG on purpose — Ahmedabad daylight on an open platform is the design condition (Design Guide
§II.6.2–3). *Resolves:* 24 sub-floor instances, 26 contrast failures.

### P3 — Colour is the last channel, never the only one

The four line colours are spent. Every semantic state must carry a glyph or a word *before* it carries a hue, and
status hues must be chosen not to collide with the line palette. *Resolves:* the yellow "waiting" pill, opacity-as-state,
the green "Live" text.

### P4 — One definition, many consumers

If two components render the same idea, they share a module. `FactPrimitives.tsx` and `DepartureRow.tsx` already prove
this works here. *Resolves:* three chips, three rows, two section labels, four line-colour maps.

### P5 — Absence is not a negative, and uncertainty is not silence

Already the product's stance on GMRC data; extend it to the app's own confidence. `knownDataIssues` exists in the data
and is invisible in the UI. Provenance should be reachable *from the fact it qualifies*. *Resolves:* G8, and the
Design Guide's open question 4.

### P6 — The floating layer is one material

Search pill, status strip, FAB, recentre and the sheet all sit on the same plane over the map. They get **one**
treatment, defined once. *Resolves:* six shadow literals, three floating-chrome treatments.

---

# 7. Proposed Design Language

## 7.1 Positioning

The home-screen brief asks for *"a small, opinionated, hand-built indie app… not another generic transit dashboard"*
and *"the map is a character, not a background."* That ambition is correct and currently unmet: the app is a stock
CARTO raster with coloured polylines, and its one genuine point of view — the Vignelli-style station labels in
`index.css:122–133` — is stranded on a basemap that fights it.

**The proposed language: engineered clarity.** Not decorative, not minimal-for-its-own-sake. The reference points are
transit signage systems (Vignelli's NYC diagram, Calvert/Kinneir's British Rail) and instrument design — objects whose
entire aesthetic derives from being readable at speed under bad conditions. This is a language the app is already
half-speaking; it just hasn't been made explicit.

Four commitments:

**1. Numerals are the hero.** This app is times, distances, counts and countdowns. Tabular figures everywhere a number
changes, one dominant figure per view, and the unit set smaller and lighter than the value. Space Grotesk's numerals
are geometric and even — an asset the current design under-uses by setting them at 11–20px.

**2. The map commits to muted.** Per HIG Maps (§I.11), the *muted* emphasis style exists exactly for
"information-rich content you want to stand out against the map." Four line colours, station marks, live trains and a
route path is that case. Desaturate the basemap so the network is the only saturated thing on screen, and build the
Vignelli label treatment into that world rather than on top of a competing one.

**3. The floating layer is honest glass, not Liquid Glass.** Per Design Guide §I.13: take the two-layer *structure*,
not the material. One token pair — `--surface-float` + `--border-float` + `--shadow-float` + `--blur-float` — five
consumers. A CSS imitation of Liquid Glass costs real paint time on the mid-range Android that is this app's median
device, and reads as a knock-off.

**4. Line colour is identity, never status.** Line colours fill badges, tracks, and dots. Status uses a separate,
deliberately non-colliding palette (§8.4). A rider must never have to work out whether yellow means "Yellow Line" or
"warning."

## 7.2 What stays exactly as it is

- The four `LINE_COLORS` hex values — they map to physical signage (`CLAUDE.md`).
- The map-first architecture, the single sheet, the three snaps, the absence of a tab bar.
- Space Grotesk as `var(--font-app)`, first in the stack in every language.
- `lucide-react` as the only icon source.
- framer-motion as the only animation library; `SPRING` in `sheetMotion.ts` as the only sheet curve.
- Every honesty rule: no fabricated real-time, no stand-in photos, no absence rendered as a negative.

## 7.3 The one open question the product owner must answer

**Station photography.** One station of 54 has a photo (`stationImages.ts`). A 40px circular image that appears 1.8% of
the time, carries `alt=""`, and shifts the header layout when present is a liability with no informational return. Two
defensible answers: complete the coverage and design the slot properly, or remove the slot. **My recommendation: remove
it now, reinstate it if and when coverage exceeds ~50%.** The header is the app's highest-value real estate and it is
currently reserving space for a decoration.

---

# 8. Design System Specification

This is the buildable spec. Everything in it is either derived from the Design Guide's target or computed and verified
below. **All values are authored as CSS custom properties in `index.css`, in `rem`, so browser base-size settings
scale the app** (the web's only Dynamic Type analogue — Design Guide §I.13).

## 8.1 Grid & layout

- **Base unit: 4px.** Layout rhythm on **8px**.
- **Design/test viewport: 360px** (not 393 — the median device here is a mid-range Android, Design Guide §II.6.5).
- **Content inset: 20px** at ≤400px, 24px above.
- **Measure cap:** `--layout-max-width: 768px` for UI; **`--measure-read: 34rem` (≈68 characters) for reference prose.**
  The current 768px measure on 13px text is the Species C failure in §4/W9.
- **Safe areas (new, required):**
  ```
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  ```
  Consumed by: the floating chrome's top padding, the three collapsed-height constants
  (`COLLAPSED_H`/`PLAN_COLLAPSED_H`/`LIVE_COLLAPSED_H`), the FAB and recentre `bottom` offsets, the sheet's scroll
  content, the live-journey action row, and the map attribution (§8.11).

## 8.2 Spacing scale

| Token | px | Use |
|---|---|---|
| `--sp-1` | 4 | Icon-to-label, chip internal |
| `--sp-2` | 8 | Related items in a row |
| `--sp-3` | 12 | **Minimum gap between adjacent interactive elements** (HIG §I.8) |
| `--sp-4` | 16 | Row internal padding, card padding (compact) |
| `--sp-5` | 20 | Card padding (default), screen inset |
| `--sp-6` | 24 | Between grouped blocks; padding around unbezeled controls (HIG §I.8) |
| `--sp-8` | 32 | Between sections |
| `--sp-12` | 48 | Between major regions |

Retire: `gap-2.5`, `gap-3.5`, `p-3.5`, `py-2.5`, `pt-1`, `mt-1.5`, `mb-7` and the other ~15 half-step values currently
in use. They are the "inconsistent spacing" symptom and they exist only because there was no scale to snap to.

## 8.3 Typography

Two ladders, because the app has two reading modes. Derived from the HIG's iOS ladder, floored per Design Guide
§II.6.3, authored in `rem` against a 16px root.

### UI ladder (Species A & B)

| Token | px | rem | Line | Weight | Tracking | Used for |
|---|---|---|---|---|---|---|
| `--t-hero` | 40 | 2.5 | 44 | 700 | −0.02em | **The one countdown per view.** Nothing else. |
| `--t-title-1` | 28 | 1.75 | 34 | 700 | −0.02em | Station name (page), planner headline |
| `--t-title-2` | 22 | 1.375 | 28 | 700 | −0.01em | Station name (sheet), section headings |
| `--t-title-3` | 20 | 1.25 | 25 | 600 | 0 | Departure clock times, large figures |
| `--t-headline` | 17 | 1.0625 | 22 | 600 | 0 | Row titles, primary labels, **live instruction** |
| `--t-body` | 17 | 1.0625 | 22 | 400 | 0 | Body copy |
| `--t-callout` | 16 | 1 | 21 | 400 | 0 | Secondary rows, input text |
| `--t-subhead` | 15 | 0.9375 | 20 | 500 | 0 | Chip text, metadata, station names in lists |
| `--t-footnote` | 13 | 0.8125 | 18 | 500 | 0 | Captions, provenance, hints |
| `--t-caption` | 12 | 0.75 | 16 | 600 | 0.04em | **Smallest permitted.** Eyebrows, labels. |

**Ten sizes replacing sixteen. Nothing below 12px. Species A never below 17px.**

The 9px and 10px tiers are **retired outright**. Their 24 call sites map as follows:

| Current | Where | Becomes |
|---|---|---|
| 9px uppercase | `settingsRows.tsx:16` section headers | `--t-caption` (12) |
| 9px uppercase | `StationDetail.tsx:231–249` line service status | `--t-footnote` (13), **and a glyph** |
| 9px uppercase | `StationDetail.tsx:584,592` FIRST/LAST | `--t-caption` (12) |
| 9px | `StationInput.tsx:41` FROM/TO field labels | `--t-caption` (12) + real `<label>` |
| 9px | `LiveJourneyScreen.tsx:446` SIMULATED | `--t-footnote` (13) — see §9/C11 |
| 9px | `LiveJourneySummary.tsx:120` countdown label | `--t-caption` (12) |
| 9px | `JourneySummary.tsx:204` picker meridiem | `--t-caption` (12) |
| 9px | `AllTrainsList.tsx:24`, `RouteTimeline.tsx:25` headings | `--t-caption` (12) |
| 10px | `HomeScreen.tsx:486` station eyebrow | `--t-caption` (12) |
| 10px | `FactPrimitives.tsx:87` StatTile label | `--t-caption` (12) |
| 10px | `HomeSearch.tsx:542` section label | delete — use the shared primitive |
| 10px | `YouScreen.tsx:183,207` maker credit | `--t-caption` (12) |

### Reference ladder (Species C — `/you/:topic`, station Info tab)

| Token | px | Line | Use |
|---|---|---|---|
| `--tr-title` | 28 | 34 | Topic title |
| `--tr-body` | 17 | 28 | Prose. Measure capped at `--measure-read`. |
| `--tr-label` | 13 | 18 | Key in a key/value row |
| Paragraph spacing | 1em | | |

Reading, not scanning. This is the one place a comfortable column beats density.

### Per-script leading

Devanagari and Gujarati have taller ascenders and descenders than Latin and need more leading at the same optical size
(Design Guide §II.6.7). Apply a **1.15× line-height multiplier** on the UI ladder under `:root[lang="hi"]` and
`:root[lang="gu"]` — the same mechanism `index.css:50–51` already uses for the font stack.

### Weight discipline

Space Grotesk 400/500/600/700 only. `index.html:60` currently requests `wght@300` — a Light weight the HIG explicitly
warns against (§I.2) and which nothing uses. **Drop 300 from the font request** (a free payload win on the boot path).

## 8.4 Colour system

Every value gets a light variant, a dark variant, and — new — a high-contrast variant behind `prefers-contrast: more`.
**Every ratio below is computed against the surface it actually sits on.**

### Backgrounds

| Token | Light | Dark | Role |
|---|---|---|---|
| `--c-bg` | `#f4f4f5` | `#0f0f0f` | Base view |
| `--c-bg-2` | `#ebebed` | `#161616` | Grouped content |
| `--c-card` | `#ffffff` | `#1a1a1a` | Card / sheet |
| `--c-card-alt` | `#fafafa` | `#222222` | Inset within a card |
| **`--c-elevated`** *(new)* | `#ffffff` | `#242424` | **Sheets, overlays, popovers.** Per HIG §I.3, dark mode has base *and elevated* sets; the sheet currently shares the page's card colour, flattening the depth it is trying to express. |

### Labels — four levels

| Token | Light | on card | on bg | Dark | on card | on bg |
|---|---|---|---|---|---|---|
| `--c-text` | `#18181b` | 16.7 | 15.2 | `#ffffff` | 15.8 | 18.9 |
| `--c-text-2` | `#3f3f46` | 10.8 | 9.8 | `#d4d4d8` | 11.0 | 13.2 |
| `--c-text-3` | `#52525b` | **7.73** | **7.03** | `#a1a1aa` | **6.79** | **7.48** |
| `--c-text-4` | **`#5b5b66`** ⚠ | **6.70** | **6.10** | **`#8f8f9c`** ⚠ | **5.45** | **6.00** |

⚠ **`--c-text-4` must change.** Current `#71717a` measures **4.40:1 on `--c-bg` in light** and **3.60:1 on `--c-card`
in dark** — both failures — and it is the app's most load-bearing secondary colour (every eyebrow, every "44m ago",
every unit label). The proposed values clear 5.45:1 everywhere. This one token fixes more failing text than any other
single change.

### Borders

| Token | Light | ratio | Dark | ratio | Target |
|---|---|---|---|---|---|
| `--c-border` (divider on card) | `#e4e4e7` | 1.27 | **`#3a3a42`** ⚠ | **1.54** | ≥1.5 |
| `--c-border-2` (edge on bg) | `#d4d4d8` | 1.48 | **`#3f3f46`** ⚠ | **1.84** | ≥1.5 |
| `--c-border-focus` *(new)* | `#f97316` | — | `#f97316` | — | 3:1 vs both surfaces |

⚠ Current dark values are **`#1f1f1f` on `#1a1a1a` = 1.06:1** and **`#2a2a2a` on `#0f0f0f` = 1.34:1**. 1.06:1 is not a
low-contrast border — it is *not a border*. Every departure-row separator, every settings divider and every card edge
is invisible in dark mode, which is why dark renders as undifferentiated slabs.

### Status palette — chosen to **not** collide with the line palette

This is the missing layer. Every value verified ≥4.5:1 on **both** `--c-card` and `--c-bg`, in **both** themes.

| Token | Light | on card / bg | Dark | on card / bg | Replaces |
|---|---|---|---|---|---|
| `--c-good` | `#047857` | **5.48 / 4.99** | `#34d399` | **9.05 / 9.97** | `text-green-500` (2.28), `#22c55e` (2.07) |
| `--c-warn` | `#b45309` | **5.02 / 4.57** | `#fbbf24` | **10.43 / 11.48** | `#f59e0b` (1.95), `text-yellow-500` (1.92), `yellow-600` (2.59) |
| `--c-error` | `#b91c1c` | **6.47 / 5.89** | `#fca5a5` | **9.17 / 10.10** | `text-red-400` (2.77), `#EF4444` (3.76) |
| `--c-info` | `#7e22ce` | **6.98 / 6.35** | `#d8b4fe` | **9.85 / 10.84** | `text-purple-400` (2.64) |

Each ships with a matching `-bg` (8% tint) and `-border` (22% tint) derived from the same hue, so the tinted alert
blocks stop being hard-coded `rgba()`.

**Note on `--c-error`:** the existing `--c-danger` (`#dc2626`, 4.83 on card) is retained for *destructive actions* but
measures 4.39 on `--c-bg` — a marginal fail. Either raise it to `#b91c1c` or restrict it to card surfaces only.
Recommend the former; there is no reason to run two reds.

### Line colours — three maps, not four

Currently: `LINE_BADGE_BG` and `LINE_COLORS` are **byte-identical**; `LINE_DOT_BG` and `LINE_TRACK_BG` are **also
byte-identical** and are Tailwind class strings whose yellow (`bg-yellow-400` = `#facc15`) **disagrees with
`LINE_COLORS.yellow` (`#EAB308`)**. The app renders two different yellows for the same line depending on which
component you are looking at.

Replace with three:

| Map | Purpose | Values |
|---|---|---|
| `LINE_COLOR` | Fills: badges, tracks, dots, map polylines. Fixed across themes. | blue `#3B82F6` · red `#EF4444` · yellow `#EAB308` · violet `#A855F7` |
| `LINE_ON_SURFACE` | The line colour **as text or a small glyph**. Theme-aware. | **Light:** `#1d4ed8` (6.70) · `#b91c1c` (6.47) · `#854d0e` (6.85) · `#7e22ce` (6.98)<br>**Dark:** `#60a5fa` (6.85) · `#f87171` (6.29) · `#facc15` (11.36) · `#c084fc` (6.59) |
| `LINE_LETTER` | B / R / Y / V — the non-colour channel. Unchanged. | |

Delete `LINE_BADGE_BG`, `LINE_DOT_BG`, `LINE_TRACK_BG`. The existing `LINE_TEXT` becomes `LINE_ON_SURFACE` — its
current yellow (`#CA8A04`) measures **2.94:1**, so the comment claiming it fixes the problem is describing an
intention, not an outcome.

### One-line fix worth calling out

`LineBadge.tsx:19` uses `color: line === 'yellow' ? '#000' : '#fff'`. Measured against all four fills:

| Line | white | black |
|---|---|---|
| blue `#3B82F6` | **3.68 ✗** | 5.71 ✓ |
| red `#EF4444` | **3.76 ✗** | 5.58 ✓ |
| yellow `#EAB308` | 1.92 ✗ | 10.95 ✓ |
| violet `#A855F7` | **3.96 ✗** | 5.31 ✓ |

**Black wins on all four.** Deleting the conditional simultaneously fixes three failures and removes a special case.

### The hard rule

**No component may declare a colour literal.** Current violations: 63, in `HomeScreen.tsx`, `LiveJourneyScreen.tsx`,
`LiveJourneySummary.tsx`, `JourneySummary.tsx`, `AllTrainsList.tsx`, `LineStatusPills.tsx`, `YouScreen.tsx`,
`StationDetail.tsx`, `Planner.tsx`, `HomeMap.tsx`, `blocks.tsx`. Enforce with a lint rule in Phase 0 so it cannot
regress.

## 8.5 Elevation & materials — exactly three

Per HIG §I.4 and Design Guide §II.7.3.

| Level | Definition | Consumers |
|---|---|---|
| **1 — Content** | Flat on `--c-bg`. No shadow. | Page bodies |
| **2 — Grouped** | `--c-card` on `--c-bg`. 1px `--c-border`. **No shadow.** | Cards, rows, departure cards, section cards |
| **3 — Floating** | `--surface-float` + `blur(18px)` + 1px `--border-float` + `--shadow-float` | **Search pill, line-status strip, FAB, recentre, sheet.** One definition, five consumers. |

```
--surface-float: var(--c-blur);
--border-float:  var(--c-border-2);
--shadow-float:  0 4px 18px rgb(0 0 0 / 0.22);
--blur-float:    blur(18px);
```

Over the map (bright, arbitrary content) level 3 additionally takes the HIG's dimming treatment — a 35% dark scrim
behind the material (§I.4).

**Plus one new token: `--scroll-edge`.** A short gradient strip where sheet content scrolls beneath the floating search
pill and status strip. Per HIG §I.10 this is exactly what the effect exists for, it is cheap, and the app currently has
none — content slides under the pills with no visual separation. **One per view.**

Retire: `shadow-2xl`, `shadow-[0_4px_20px_rgba(249,115,22,0.3)]`, and all six `boxShadow` literals.

## 8.6 Corner radius — philosophy and scale

The current usage is already disciplined and only needs codifying. Radius encodes **size**, not decoration:

| Token | px | Applies to |
|---|---|---|
| `--r-sm` | 8 | Chips, small pills, badges |
| `--r-md` | 12 | Buttons, inputs, segmented cells |
| `--r-lg` | 16 | Cards, rows, tiles |
| `--r-xl` | 22 | Sheet top, full-bleed panels |
| `--r-full` | 999 | Circular controls, status pills |

**Concentricity rule (HIG §I.12):** an inner radius equals the outer radius minus the gap between them. A 16px card
with 12px padding takes 4px inner radii on its children. This is currently unobserved and is why nested cards look
slightly wrong — a `rounded-2xl` block inside a `rounded-2xl` card with 16px padding should be `rounded-lg`, not
`rounded-2xl`.

## 8.7 Icon system

`lucide-react`, per Design Guide §II.7.6:

- **Sizes: 16 / 20 / 24 only.** Currently 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24 are all in use.
- **Stroke weight: 2.0 for 20 and 24, 2.2 for 16.** Currently 2, 2.2, 2.4, 2.5, 2.6, 3 all appear.
- **Match icon weight to adjacent text weight.**
- **Optical centring**, not geometric.
- **Every icon-only control carries an `aria-label`.** Mostly done; audit the remainder.
- **Filled variants reserved for selection** (bookmark saved, tab active).
- **Icons scale with the text-size preference** (HIG §I.2).
- **No emoji in the interface.** `you.darkModeBanner` / `you.lightModeBanner` currently carry 🌙 and ☀️ *inside the
  translation bundle*, so the emoji now render in all three languages. Replace with the `Moon`/`Sun` lucide icons
  already imported in that file.

## 8.8 Button hierarchy

**There is currently no `Button` component.** All 49 buttons style themselves. Introduce four roles, one component:

| Role | Fill | Label | Height | Use |
|---|---|---|---|---|
| **Primary** | `--c-accent` bg, `--c-accent-fg` text | `--t-headline` 600 | 52 | **One per view.** Start Journey, Find trains. |
| **Secondary** | `--c-card` bg, 1px `--c-border-2`, `--c-text` | `--t-headline` 600 | 52 | To here, From here |
| **Tertiary** | transparent, `--c-accent` text | `--t-callout` 600 | 44 | View all, inline links |
| **Destructive** | `--c-error-bg`, `--c-error` text | `--t-headline` 600 | 52 | End journey, Clear data |

Rules, from HIG §I.10:
- **Hit region ≥44×44px, always**, padded invisibly where the visual is smaller.
- **Always a press state.** One shared token: `transform: scale(0.97)` + 120ms.
- **One or two prominent buttons per view.**
- **Distinguish by style, not size** — never place two differently-sized buttons adjacent.
- **Never assign Primary to a destructive action.**
- **Labels start with a verb, sentence case** (see §8.10).
- **Full-width primary buttons are permitted** — a deliberate deviation from HIG §I.5, justified in Design Guide
  §II.6.1: this app's primary action is pressed one-handed while walking.

## 8.9 Motion

- **One spring for sheets** — `SPRING` in `sheetMotion.ts`, already shared. Keep.
- **One ease for entrances** — `cubic-bezier(0.25, 0.8, 0.25, 1)`, 240ms.
- **One duration for state changes** — 200ms.
- **One press response** — `scale(0.97)`, 120ms.
- **Maximum for a content update: 2s** (HIG §I.12). Typical 200–320ms.
- **framer-motion only.** Tailwind's `animate-in` utilities generate no CSS in this project.
- **Never a lateral offset on a page root** — `<main>`'s `overflow-y: auto` makes `overflow-x` compute to `auto`, so a
  16px offset becomes real horizontal scroll. Already documented at `StationDetail.tsx:820`; keep it documented.
- **`prefers-reduced-motion` (new, currently absent):** shorten springs, drop y-offsets to fades, stop the four
  infinite animations (`animate-ping` on the live dot, three `animate-pulse` clusters, `journey-glow-pulse`), **but
  keep gesture tracking** — the HIG itself lists finger-tracked animation as a *reduced-motion technique*
  (Design Guide §II.6.6). The sheet must still follow the thumb.

## 8.10 Voice & copy standard

Derived from HIG §I.9 and the product's own honesty stance.

- **Voice:** plain, factual, unhurried. A colleague who knows the network, not a brand.
- **Never "we".** "Unable to load", not "We're having trouble loading."
- **"You" and "your"** for the rider.
- **Capitalisation — pick once, hold everywhere.** Currently unruled: "Start Journey" / "Route Not Possible" /
  "View Route Options" / "Upcoming Trains" (Title) sit beside "Leave in" / "View all" / "Default station" (sentence)
  and "tight connection" (lower). **Proposed: sentence case everywhere except proper nouns.** It is more legible at
  small sizes, translates better, and is what GMRC's own material uses.
- **Verbs on buttons.** `planner.submit` is currently *"View Route Options"* — a verb-noun-noun that sounds like a
  committee. **→ "Find trains".** It matches the voice of "Where to?" and "Start journey".
- **Errors name the fix.** `journey.strandedExplain` already does this well ("Pick a different departure below").
  `journey.routeNotPossible` — "Route Not Possible" — does not; it should lead with the computable answer: *"Last Blue
  Line train has gone. First train tomorrow is 05:45."*
- **`planner.placeHint`** — *"Select to find nearest station"*, printed identically under every place result — must be
  replaced with the actual differentiator, exactly as `HomeSearch` already does: *"Motera Stadium · 400 m · 5 min walk"*.
- **Never state an absence as a negative.** Already observed; keep.
- **Say when a figure is simulated**, once, calmly, legibly, attached to the fact it qualifies.
- **No interjections, no humour, no exclamation marks, no emoji.**
- **A line with optional parts gets one whole key per shape** (`CLAUDE.md`) — never a base sentence with fragments
  appended.

## 8.11 Layout & responsive behaviour

- **Breakpoints: 360 / 400 / 768.** Below 400 is the design target; 768 caps the reading measure.
- **Portrait is primary; landscape must not break.** Untested currently.
- **The sheet's mid snap is content-fitted** — keep this; it is better than a fraction.
- **Map attribution** must sit **above the sheet's lowest resting position** (HIG §I.11, ~7px side / 10px vertical
  padding, plus `--sab`). It is currently absent entirely (§12/A9).
- **Every layout must survive 200% text** without truncating a Species A fact (HIG §I.8). Currently untested and
  unlikely to pass — the four-cell departure picker (`JourneySummary.tsx:167`) is a fixed `grid-cols-4` of clock times
  and will overflow first.

---

# 9. Component Audit

Severity: **S1** blocks safe use · **S2** materially harms usability or accessibility · **S3** consistency/polish.

## 9.1 The four parallel systems

| Idea | Implementations | Divergence | Standard |
|---|---|---|---|
| **Chip** | `HomeScreen.Chip` (12px, no min-height, hard-coded alert tone) · `HomeSearch.Chip` (13px, `min-h-44` ✓) · `FactPrimitives.FactChip` (11px uppercase, accent tone) | Three sizes, three heights, three tone systems | **One `Chip`**: `--t-subhead`, 32px visual / 44px hit, tones `default` `accent` `warn` `good` from tokens |
| **Row** | `settingsRows.Row` (14px, 52px, icon tile, chevron) · `HomeSearch.Row` (badge/eyebrow/title/meta + directions affordance) · `DepartureRow` (departure-specific) | Three list idioms across four screens | **One `ListRow`** with slots (`leading`, `title`, `meta`, `trailing`); `DepartureRow` composes it |
| **Section label** | `FactPrimitives.SectionLabel` (11px, `LucideIcon`) · `HomeSearch.SectionLabel` (10px, `ReactNode`) — **same name, different file** | 10 vs 11px, incompatible icon props | **Delete the local one.** Widen the shared one's icon prop. |
| **Segmented control** | `LanguagePicker` (44px ✓) · `Planner` timeMode (11px uppercase, ~34px) · `JourneySummary` picker (`grid-cols-4`, ~38px) | Three heights, three type sizes, three selected treatments | **One `Segmented`**, 44px cells, `--t-subhead`, accent fill + `--c-accent-fg` |
| **Switch** | `settingsRows.Switch` (44×26, `role="switch"` ✓) · `YouScreen.ThemeToggle` (sun + 44×26 track + moon, no role, hard-coded `#F59E0B`/`#000`/`#fff`) | Two switches, one accessible | See §9.3/C7 — the theme control should become a **three-way segmented** anyway |

**S2** for all five. This is `CLAUDE.md`'s own "don't fork it again" rule, applied to five more components.

## 9.2 Missing components

| Component | Status | Impact |
|---|---|---|
| **`Button`** | **Does not exist.** 49 bespoke buttons. | **S2.** Root cause of inconsistent button styles, press states and touch targets. |
| **`Dialog` / `Alert`** | Does not exist. No `role="dialog"`, no `aria-modal`, no focus trap, no Escape. | **S2.** Four full-screen overlays are invisible as modals to assistive tech. |
| **`Toast` / `Snackbar`** | Does not exist. | **S3.** No surface for sync results, offline transitions, save confirmations. |
| **`Skeleton`** | Two good bespoke ones (`YouScreenFallback`, `InfoPageFallback`); three other loading idioms. | **S3.** Promote the good pattern to a primitive. |
| **`EmptyState`** | Four ad-hoc empties, none offering a next action. | **S3.** HIG §I.9: *"An empty screen can be daunting if it isn't obvious what to do next."* |
| **`Field` / `Label`** | Does not exist. Five input treatments; two with no visible focus ring. | **S2.** See §12/A5. |

## 9.3 Component-by-component findings

| # | Component | Sev | Finding | Fix |
|---|---|---|---|---|
| C1 | `LineBadge` | **S1** | White foreground fails on **three of four** line fills (blue 3.68, red 3.76, violet 3.96). | Delete the conditional; use `#000` on all four (5.31–10.95). |
| C2 | `DepartureRow` | **S1** | Imports `LINE_COLORS`, not `LINE_TEXT`, for the highlighted **next-train figure**. On the Yellow Line that is `#EAB308` at 22px on white = **1.92:1**. The most important number on the board is unreadable. | Use `LINE_ON_SURFACE`. |
| C3 | `DepartureRow` | S2 | `opacity: 0.55` on departed rows dims text already at 4.83:1 to ~2.9:1. | Use `--c-text-4` + strikethrough; drop the opacity. |
| C4 | `HomeScreen.Chip` | **S1** | Alert tone hard-codes `#f0997b` on `--c-bg` = **2.00:1**, and `rgba(216,90,48,0.35)`. Does not adapt to theme. | `--c-warn` / `--c-warn-bg` / `--c-warn-border`. |
| C5 | `JourneySummary` | **S1** | Tight-connection amber `#f59e0b` = **1.95:1** in light, used in four places including the explanatory sentence. A safety signal. | `--c-warn` (5.02). |
| C6 | `JourneySummary` | **S1** | The infeasible card uses `text-red-400` / `text-red-300/70` on `rgba(239,68,68,0.08)` — authored for dark, **2.77:1 or worse** in light. This is the "you cannot make this trip" state. | `--c-error` / `--c-error-bg`. |
| C7 | `AllTrainsList` | **S1** | Selected card sets text to `--c-accent-fg` (#000) **and** its subtitle to `rgba(255,255,255,0.7)` = **2.05:1** on the same orange. Two opposite foregrounds in one card. Also `text-black/60` = 3.87. | All foregrounds → `--c-accent-fg`; secondary at 75% of it. |
| C8 | `LineStatusPills` | **S1** | Status colours hard-coded: green **2.07**, yellow **1.74**, violet **3.60** in light. This is the **first thing a new user sees**. | `--c-good` / `--c-warn` / `--c-info`, plus a glyph per state. |
| C9 | `LineStatusPills` | S2 | ~28px tall; `animate-ping` unguarded. | 44px hit area; guard with `prefers-reduced-motion`. |
| C10 | `LiveJourneyScreen.STATE_PILL` | **S1** | All six states hard-coded. `#fff` on `#3B82F6` = **3.68**. Worse: `WAITING_FOR_TRAIN` and `TRANSFERRING` are painted `#EAB308` — **byte-identical to the Yellow Line**. | Status tokens; `#000` foregrounds; states never reuse a line hue. |
| C11 | `LiveJourneyScreen` | S2 | `SIMULATED` at 9px `--c-text-4`. Disclosure that cannot be read is not disclosure. | `--t-footnote` (13), `--c-text-3`, phrased as a fact: *"Times from the GMRC timetable"*. |
| C12 | `LiveJourneyScreen` | S2 | Local `fmtMins` produces "5 mins"; the engine's `formatDuration` produces "5 min"; two more sites print `12min` and `3m`. **Four formats, one screen.** | One formatter, one shape. |
| C13 | `LiveJourneyScreen.ActionPill` | S2 | ~36px tall. Danger tone hard-codes `#EF4444` (3.35 on card) while `--c-danger` exists unused. | 44px; `--c-error`. |
| C14 | `LiveJourneySummary` | S2 | The live instruction is `--t-subhead`-sized (15px) and its countdown 15px — the **Species A fact of the whole app**, below the 17px floor. `TONE.alert` = `--c-accent` = 2.80:1. | Instruction `--t-headline` (17); countdown `--t-hero` (40) or `--t-title-1`; tone → `--c-warn`. |
| C15 | `RouteTimeline` | S2 | Uses `LINE_DOT_BG`/`LINE_TRACK_BG` — renders yellow as `#facc15` while every other surface uses `#EAB308`. `SOON` badge is `yellow-700` on `yellow-900` border: **3.89:1 in dark**, border invisible. | Single `LINE_COLOR` map; `--c-warn` for SOON. |
| C16 | `StationDetail.LineScheduleCard` | **S1** | Four service statuses at **9px**: green **2.28**, yellow **1.92**, red **2.77**, violet **2.64**. Raw Tailwind classes bypass the token layer. | `--t-footnote`, status tokens, glyph per state. |
| C17 | `StationDetail.TabButton` | S2 | ~40px. `aria-pressed` on what is semantically a tab set — no `role="tablist"`/`"tab"`/`"tabpanel"`, no arrow-key navigation. | 44px; real tab semantics. |
| C18 | `StationDetail.MergedTrainList` | S2 | Renders the **entire operating day** in a 360px inner scroller, departed trains first. Same-axis nested scrolling inside the sheet's drag — which HIG §I.10 says never to do. | Default to next 6 + "Full timetable"; collapse departed to one row. |
| C19 | `settingsRows.Row` | S2 | Focus indicator is `--c-card-alt` on `--c-card` = **1.04:1** — effectively invisible. Applies to every settings row. | 2px `--c-border-focus` ring at ≥3:1. |
| C20 | `settingsRows.SectionHeader` | S3 | 9px — every section title on the settings screen. | `--t-caption` (12). |
| C21 | `settingsRows.Switch` | S3 | 26px tall (44 wide). | 44px hit area. |
| C22 | `StationInput` | **S2** | No `<label htmlFor>`, no `id`, no `aria-label`; the visible FROM/TO is a 9px `<div>`. Screen readers get only the placeholder. No `enterKeyHint`, `autoComplete`, `autoCorrect`, `inputMode`. `outline-none` with no replacement. | Real label association; input attributes; visible focus ring. |
| C23 | `SearchBar` | S3 | `outline-none` on the input with no focus replacement. Three separate targets inside one pill leave dead gaps. | Focus ring; widen the tap surfaces. |
| C24 | `Planner` | **S2** | `role="button"` `tabIndex={0}` div **nested inside a `<button>`** (invalid HTML, nested interactive content) with `onClick` only — Enter/Space do nothing for keyboard users. | Move the remove control out of the button; use a real `<button>`. |
| C25 | `Planner` | S2 | Seven raw Tailwind palette colours (`red-500`, `blue-500`, `neutral-500`, `green-600`, `purple-400`, `red-400`, `neutral-50/800`), several failing. Swap button 36px. | Tokens; 44px. |
| C26 | `Planner` | S2 | Place results still carry the constant subtitle `planner.placeHint`; `HomeSearch` fixed this. **Two search surfaces, two answers.** | Port `HomeSearch`'s nearest-station treatment. |
| C27 | `LocationNotice` | **S1** | `text-yellow-600` on an 8% yellow tint = **2.59:1**. This is the app's most common first-run state. | `--c-warn` (5.02). |
| C28 | `FactPrimitives.StatTile` | S3 | Label at 10px; value at `text-lg` (18px) — a *stat tile* whose figure is barely larger than body. | Label `--t-caption`; value `--t-title-3` (20). |
| C29 | `DraggableSheet` | S3 | Grab handle is a `<div>` — not tappable to cycle snaps, not exposed to assistive tech. HIG §I.10: *"they can also tap it to cycle through the detents… it also works with VoiceOver."* | `<button>` with `aria-label` and snap cycling. |
| C30 | `DraggableSheet` | S3 | `boxShadow` and `border` hard-coded rather than the floating tokens. No `--c-elevated` in dark. | Level-3 tokens. |
| C31 | `HomeSearch` | S3 | Local `SectionLabel` (10px) shadows the shared one (11px). | Delete; use shared. |
| C32 | `blocks.tsx` / `InfoPage` | S2 | Species C prose at 13–14px across a 768px measure ≈110 characters. | Reference ladder + `--measure-read`. |
| C33 | `Insights` / `Countdown` | — | Clean. No findings. | — |

---

# 10. Screen-by-Screen Audit

## 10.1 HOME `/` — station mode (the app's front door)

**Primary question:** *When is my next train, and which one is mine?*

**Current observations.** Full-bleed CARTO raster; floating search pill and four line-status pills at the top; FAB and
recentre riding on the sheet's resting edge (a good detail — they track the sheet rather than a constant); sheet opens
at **mid**, showing an eyebrow, the station name at 22px, up to seven chips, then `UpcomingTrains`, then actions, with
the full-day board below the fold.

| # | Problem | Sev | Why it hurts | Fix | Difficulty |
|---|---|---|---|---|---|
| H1 | The header leads with **station identity**, not the departure. Eyebrow (10px, `--c-accent`, **2.80:1**) → name (22px) → chip row → *then* departures. | S2 | The rider's question is "when is my train", and it is third. HIG §I.5: most important items near the top. | **Invert.** Countdown becomes the headline (`--t-hero`); station name becomes the eyebrow at `--t-caption`. Design Guide §II.3.1. | Medium |
| H2 | Up to **seven equal-weight chips** — line, distance, walk, interchange, and up to three modes. | S2 | A flat row is the absence of a hierarchy decision. Wraps to two lines at 360px. | Split by species: merge distance+walk into one; move interchange and modes below the fold; a *running* line spends no chip at all. | Low |
| H3 | Alert chip **2.00:1** (`#f0997b`). | **S1** | Degraded service is unreadable in the state it matters. | `--c-warn`. | Low |
| H4 | Line-status pills: green **2.07**, yellow **1.74**, violet **3.60**; ~28px targets. | **S1** | First impression, primary status surface. | Status tokens + glyph; 44px. | Low |
| H5 | **No safe-area insets anywhere.** Floating chrome uses `pt-3`; FAB `bottom: sheetEdge + 72`; collapsed peek is a raw constant. | **S1** | `viewport-fit=cover` is opted in, so on notched devices the search pill sits under the status bar and the sheet's peek content sits in the home-indicator gesture area. | Add the four tokens; consume in six places. | **Low — highest ratio in the document.** |
| H6 | Three different treatments for chrome on the same plane: FAB `0 6px 24px/0.35`; recentre `--c-blur` + `blur(18px)` + border + `0 4px 18px/0.22`; pill a third. | S3 | The two-layer model is the app's architecture and reads as three unrelated objects. | Level-3 token. | Low |
| H7 | Station markers **12×12px** (8px dot + 2px stroke); interchange 16; selected 20. | **S2** | 27% of the 44px minimum, on the primary interaction surface. | Invisible 44px hit area; keep the visual dot small. | Medium |
| H8 | Stock CARTO `light_all`/`dark_all` under four saturated line colours. | S3 | The basemap competes with the network. The Vignelli labels — the app's one real visual idea — are stranded. | Muted emphasis style (HIG §I.11); desaturate so the lines are the only saturated thing. | Medium–High |
| H9 | `attributionControl={false}`, no attribution string anywhere in `src`. | **S1 (legal)** | CARTO ToS and OSM ODbL both require it. Not a style choice. | Custom-styled control, above the sheet's lowest rest (HIG §I.11). | Low |
| H10 | 36px bookmark and walking-directions buttons. | S2 | A mis-tap silently changes saved state. | 44px. | Low |
| H11 | No scroll edge effect where sheet content passes under the pills. | S3 | Content slides under floating chrome with no separation. | `--scroll-edge`, one per view. | Low |
| H12 | Photo slot renders for 1 of 54 stations, `alt=""`, shifts the header. | S3 | Layout liability, no informational return. | Remove pending coverage (§7.3). | Low |
| H13 | `structure` (elevated/underground) and `currentFrequencyMins` are computed and only shown elsewhere / never. | S3 | "Do I go up or down" is wayfinding you want *before* arriving; "every 8 min right now" ≠ the daily average. | Surface both. Design Guide §II.4. | Low |

**Dependencies:** H1 depends on Phase 0 type tokens. H7 depends on nothing. H8 is the only item with real cost.

## 10.2 HOME — plan mode

**Primary question:** *When do I leave, and can I actually do this?*

The hero is right: `leaveInMins` at 32px with "Now" replacing any non-positive value — the teardown's C1 is genuinely
fixed. Findings are about the surrounding material.

| # | Problem | Sev | Fix |
|---|---|---|---|
| P1 | Tight-connection amber **1.95:1**, in four places including the explanatory line. | **S1** | `--c-warn`. |
| P2 | Infeasible card authored for dark; **2.77:1 or worse** in light. | **S1** | `--c-error` / `--c-error-bg`. |
| P3 | Selected `AllTrainsList` card mixes `#000` and `rgba(255,255,255,0.7)` (**2.05:1**) on the same orange. | **S1** | Single foreground token. |
| P4 | `grid-cols-4` departure picker with a **9px** meridiem; fixed columns will overflow at 200% text. | S2 | `--t-caption` floor; wrap or scroll above a threshold. |
| P5 | Hero is 32px — off-ladder, and below `--t-hero`. | S3 | `--t-hero` (40). |
| P6 | The ticket-note row always renders its `Info` icon even when `ticketInfo.note` is empty (it only has content on cross-phase trips). | S2 | Render the whole row conditionally. |
| P7 | Infeasible state says "Route Not Possible" and names the stranding line, but does not propose the computable fix. `options[]` already holds the last feasible departure today and the first tomorrow. | S2 | *"Last Blue Line train has gone. First train tomorrow is 05:45."* HIG §I.9. |
| P8 | `bufferMins` per leg is computed and never shown. | S3 | "You have 4 minutes to change at Old High Court" is Species A — buffer *is* the anxiety. |
| P9 | `routeKm()` exists; the fare is charged on it and shown without it. | S3 | "12.4 km · ₹25" makes the fare explicable rather than magic. |
| P10 | Walk legs summed into "Includes N walking"; `sourceWalkMins` and `destWalkMins` answer different questions. | S3 | Split, or at minimum stop implying interchangeability. |

## 10.3 HOME — live mode

**Primary question:** *What do I do right now?* The specification here is HIG §I.12 (Live Activities): large,
medium-weight-or-heavier, one fact, height that changes with content.

| # | Problem | Sev | Fix |
|---|---|---|---|
| L1 | Instruction 15px, countdown 15px, countdown label **9px**. Against §I.12's "use large, heavier-weight text… key information legible at a glance." | **S2** | Instruction `--t-headline` (17, 600); countdown `--t-title-1`/`--t-hero`; label `--t-caption`. |
| L2 | `STATE_PILL` hard-codes six colours; `#fff` on `#3B82F6` = **3.68**; waiting/transferring painted the Yellow Line's exact hex. | **S1** | Status tokens; `#000` foregrounds; no line hue as a state. |
| L3 | Four duration formats on one screen: `5 mins`, `12min`, `3m`, `19 min`. | S2 | One formatter. |
| L4 | `ActionPill` ~36px; danger `#EF4444` (3.35) while `--c-danger` sits unused. | S2 | 44px; token. |
| L5 | **No `aria-live` region.** A continuously-updating instruction is silent to screen readers. | **S2** | `aria-live="polite"` on the instruction; `assertive` on transfer prompts. |
| L6 | Four always-on animations (`animate-pulse` dot, `journey-glow-pulse` halo) with no reduced-motion guard. | S2 | Guard all. |
| L7 | `stopTimeline[]` — a predicted arrival offset for **every** remaining stop — is computed and unused. | S3 | This is the largest piece of unused signal in the app: a real progress rail with per-stop ETAs. |
| L8 | `elapsedMins` unused. | S3 | "18 min in, 11 to go" beats either half. |
| L9 | The 3px progress rail is the only progress indicator and is not exposed to AT. | S3 | `role="progressbar"` with `aria-valuenow`. |
| L10 | `LIVE_COLLAPSED_H` is a fixed floor. §I.12 says size to content and animate the change. | S3 | Already partly achieved via `Math.max`; make it explicit. |

## 10.4 Search overlay (`HomeSearch`)

The app's best-improved surface. Recents, saved journeys, a browsable line directory, a connection facet, and place
results that name their nearest station with distance and walk time.

| # | Problem | Sev | Fix |
|---|---|---|---|
| S1 | Not a modal to assistive tech: no `role="dialog"`, no `aria-modal`, no focus trap, **no Escape dismissal**. Background remains reachable by tab. | **S2** | Dialog primitive. |
| S2 | Local `SectionLabel` at 10px shadows the shared 11px one. | S3 | Delete. |
| S3 | Facet chips read as content chips; HIG §I.10 wants a visually distinct scope bar. | S3 | Distinguish scope from content. |
| S4 | No-results state is one grey line with no next action. | S3 | Offer the nearest station or the line browser. |
| S5 | Result categories are section labels only; row shape does not distinguish station from landmark. | S3 | Stronger categorisation. |

## 10.5 Planner overlay

| # | Problem | Sev | Fix |
|---|---|---|---|
| N1 | Still a **full-screen opaque takeover** that discards the map, dismissed by a 40px `X` in the **top-right** — the hardest corner to reach one-handed. | **S2** | Promote into `DraggableSheet` at `full`, matching plan and live modes, so the map survives and drag-down dismisses. Failing that, move dismissal to the bottom. |
| N2 | Inputs unlabelled (C22). | **S2** | Real labels. |
| N3 | Nested interactive element with no key handler (C24). | **S2** | Restructure. |
| N4 | Seven raw palette colours; 36px swap button. | S2 | Tokens; 44px. |
| N5 | Diverged from `HomeSearch` on place results (C26). | S2 | Port the fix. |
| N6 | CTA reads "View Route Options". | S3 | "Find trains". |
| N7 | Disabled CTA is `--c-text-4` on `--c-card` — the state is signalled by low contrast alone. | S3 | Distinct disabled token + `aria-disabled`. |

## 10.6 `/stations/:id` — station page

| # | Problem | Sev | Fix |
|---|---|---|---|
| T1 | Four service statuses at 9px, **1.92–2.77:1** (C16). | **S1** | Tokens + `--t-footnote` + glyph. |
| T2 | Whole-day board in a 360px nested same-axis scroller, departed trains first (C18). | S2 | Next 6 + disclosure. |
| T3 | Tabs are `aria-pressed` buttons, not a tab set; ~40px (C17). | S2 | Real semantics, 44px. |
| T4 | Sticky header has no `--sat`; back button 36px. | S2 | Insets; 44px. |
| T5 | Deep-linking auto-opens a modal train sheet on mount. | S3 | HIG modality: present modally only with clear benefit. Consider inline highlight instead. |
| T6 | `goBack` on the not-found state is `text-yellow-400` — **~1.7:1** on `--c-bg`. | **S1** | Token. |
| T7 | Info tab is Species C rendered in UI typography. | S2 | Reference ladder. |
| T8 | `gmrcName`, `multiModal.summary` / `amenities` / `plannedAmenities` / `sourceNote`, and `knownDataIssues` are all in the data and unrendered. Three stations have named, specific caveats — including one whose coordinate is known to be wrong. | S3 | Surface. A wayfinding app that knows its pin is unreliable and doesn't say so fails PRD principle 1. `plannedAmenities` needs explicit future tense. |
| T9 | First/last train shown per direction with no headline span. | S3 | "05:45 – 22:20" above the detail (HIG §I.10, charting). |

## 10.7 `/you` — settings

Transformed since the teardown: rows are real, `Row` derives interactivity from its handlers, "Phase 4" badges are
gone. Remaining findings are mostly cosmetic — with two exceptions.

| # | Problem | Sev | Fix |
|---|---|---|---|
| Y1 | **"Report a timetable issue" and "Suggest a feature" have no `onClick` and no `href`.** They render as inert rows. | **S2** | Honest, but a settings screen listing two things it will not do is worse than not listing them. Wire both to `mailto:` — the cheapest real win in the app. |
| Y2 | Theme is a two-way toggle with **no System option**, and `ThemeContext.tsx:35` never reads `prefers-color-scheme`. | **S2** | HIG §I.3 and §I.10 both require respecting the system preference. Three-way segmented: System / Light / Dark, defaulting to System. Mirror in the pre-paint script so there is no flash. |
| Y3 | 🌙 / ☀️ emoji, now **inside the translation bundle** so they render in all three languages, as the first line of text on the screen. | S3 | `Moon` / `Sun`, already imported. |
| Y4 | Every section header is **9px**. | S3 | `--t-caption`. |
| Y5 | Focus indicator on every row is **1.04:1** (C19). | **S2** | Real ring. |
| Y6 | Theme toggle's hit area is 26px tall. | S3 | Moot once Y2 lands. |
| Y7 | No `--sat`; `pt-8` fixed. | S2 | Insets. |
| Y8 | "v0.1.0-prototype" is user-facing. | S3 | Version alone; "prototype" undercuts the trust the rest of the screen builds. |
| Y9 | No text-size preference — the web's only Dynamic Type analogue, and the one place duplicating a "system" setting is justified (Design Guide §I.13). | S3 | Ship it, or accept browser zoom as the only path to the HIG's 200% target. **Product decision.** |

## 10.8 `/you/:topic` — reference pages

| # | Problem | Sev | Fix |
|---|---|---|---|
| R1 | 13–14px prose across 768px ≈110 characters. | S2 | `--tr-body` (17/28), `--measure-read` (≈68ch). |
| R2 | Back button 36px; no `--sat` on the sticky bar. | S2 | 44px; insets. |
| R3 | `select-text` opt-out is correct and well-reasoned. | — | Keep. |

## 10.9 `TrainRouteSheet` (portaled modal)

| # | Problem | Sev | Fix |
|---|---|---|---|
| M1 | Three 9px labels. | S3 | `--t-caption`. |
| M2 | No `role="dialog"`, no focus trap, no Escape. | S2 | Dialog primitive. |
| M3 | Second sheet over the draggable sheet — HIG §I.10: *"Display only one sheet at a time."* | S3 | Acceptable given it is portaled to `body` and the sheet beneath is a surface rather than a task, but verify the back path is unambiguous. |

## 10.10 Onboarding

**There is none, and that is correct.** HIG §I.10: *"Ideally people understand the app by experiencing it… prefer a
collection of context-specific tips over a single onboarding flow."* The app opens straight to a map with the nearest
station. Location permission is requested on mount (`App.tsx:70`) rather than explained first — the one deviation, and
a defensible one given the app degrades gracefully. **Do not add an onboarding flow.** The `LocationNotice` is the
contextual tip pattern already; it just needs to be legible (C27) and to appear in the collapsed peek rather than
below the fold.

---

# 11. Navigation Audit

**The navigation model is correct and should not change.** Four routes, no tab bar, one sheet with three faces, the
map never unmounting. This is the hardest thing in the app to get right and it is right.

| # | Finding | Sev | Recommendation |
|---|---|---|---|
| V1 | **Four full-screen surfaces are dismissed four different ways.** Search: back-arrow top-left. Planner: `X` top-right. Sheet at full: drag down or tap the map. TrainRouteSheet: its own control. | S2 | One dismissal grammar. Overlays that are *tasks* (planner) dismiss by drag-down + a bottom-reachable control. Overlays that are *places* (search) keep the back arrow, top-left. |
| V2 | **No overlay responds to Escape.** The single Escape handler in the codebase closes the planner's suggestion list, not the planner. | S2 | Escape closes the topmost layer, always. |
| V3 | **No focus management on any overlay.** Focus is not moved in, not trapped, not restored on close. | **S2** | Standard dialog behaviour. |
| V4 | Reaching a station page has two destinations with different chrome: the home sheet (`StationDetailBody`, `surface="sheet"`) and `/stations/:id` (`surface="page"`). Correctly *shared*, but the sheet has no way to reach the page and the page has no map. | S3 | Acceptable. Consider a "Open full page" affordance from the sheet for share/deep-link parity. |
| V5 | The `/stations/:id` → home "plan trip" path uses router state consumed once on mount (`HomeScreen.tsx:219`), while the in-app path uses a DOM `CustomEvent`. Two mechanisms for one intent. | S3 | Works, and the reason is documented. Low priority; unify if the shell is ever refactored. |
| V6 | The FAB and recentre correctly ride the sheet's *resting edge* and hide when they cannot fit. | — | Excellent. Keep. |
| V7 | `--nav-h` is set to `0px` on every mount for a nav bar that does not exist. | S3 | Harmless vestige; remove when convenient. |

---

# 12. Accessibility Audit

Measured against WCAG 2.2 AA and HIG §I.8. **This section contains the document's most serious findings.**

## 12.1 Contrast — 26 of 32 tested pairs fail

| Surface | Ratio | Need | Where |
|---|---|---|---|
| Line-status pill, yellow | **1.74** | 4.5 | `LineStatusPills.tsx:19` |
| Yellow-line next-train figure | **1.92** | 3.0 | `DepartureRow.tsx:141` |
| Station-page service status, yellow | **1.92** | 4.5 | `StationDetail.tsx:242` |
| Tight-connection amber | **1.95** | 4.5 | `JourneySummary.tsx:53,81,107,186` |
| Alert chip | **2.00** | 4.5 | `HomeScreen.tsx:79` |
| Selected-option subtitle (white/70 on accent) | **2.05** | 4.5 | `AllTrainsList.tsx:57,68` |
| Line-status pill, green | **2.07** | 4.5 | `LineStatusPills.tsx:14` |
| Station-page "Live" green | **2.28** | 4.5 | `StationDetail.tsx:231` |
| `LocationNotice` | **2.59** | 4.5 | `LocationNotice.tsx:38,40,51` |
| Station-page "Bus only" violet | **2.64** | 4.5 | `StationDetail.tsx:247` |
| Station-page "Service ended" red | **2.77** | 4.5 | `StationDetail.tsx:237` |
| Station eyebrow (accent on white) | **2.80** | 4.5 | `HomeScreen.tsx:487` |
| `LINE_TEXT.yellow` — *the existing "fix"* | **2.94** | 4.5 | `constants.ts:14` |
| Line-status pill, violet | **3.60** | 4.5 | `LineStatusPills.tsx:23` |
| `--c-text-4` in **dark** on card | **3.60** | 4.5 | `index.css:63` |
| `STATE_PILL` white on blue | **3.68** | 4.5 | `LiveJourneyScreen.tsx:30–31` |
| `LineBadge` white on blue / red / violet | **3.68 / 3.76 / 3.96** | 4.5 | `LineBadge.tsx:19` |
| `AllTrainsList` black/60 on accent | **3.87** | 4.5 | `AllTrainsList.tsx:80` |
| `RouteTimeline` SOON in **dark** | **3.89** | 4.5 | `RouteTimeline.tsx:99` |
| `--c-text-4` in light on `--c-bg` | **4.40** | 4.5 | `index.css:20` |
| Dark divider `--c-border` on card | **1.06** | 1.5 | `index.css:57` |
| Dark grab handle `--c-border-2` on bg | **1.34** | 1.5 | `index.css:58` |
| Focus ring, light / dark | **1.04 / 1.09** | 3.0 | `settingsRows.tsx:76` |

§8.4's palette clears every one of these. **19 of the 26 are light-theme-only failures.**

## 12.2 Touch targets — HIG minimum 44×44px

| Control | Size | Where |
|---|---|---|
| **Station markers (regular)** | **12×12** | `HomeMap.tsx:43` |
| Station markers (interchange / terminal / selected) | 16 / 18 / 20 | same |
| Line-status pills | ~28 tall | `LineStatusPills.tsx:59` |
| Theme toggle | 26 tall | `YouScreen.tsx:86` |
| `Switch` | 26 tall | `settingsRows.tsx:192` |
| Bookmark, walking directions, plan-clear, back ×3, swap, recent-remove, avatar | **36** (`w-9 h-9`) ×~11 | multiple |
| `ActionPill` (End / Save / Share) | ~36 | `LiveJourneyScreen.tsx:51` |
| `TabButton` | ~40 | `StationDetail.tsx:280` |
| Planner close | 40 | `HomeScreen.tsx:797` |
| SearchBar icon slots | 40 (in a 56 pill) | `SearchBar.tsx:19` |

Met correctly in five places only — `HomeSearch.Chip`, `LocationNotice` retry, `LanguagePicker`, the planner's time
button, and the FAB (56). Those five show the intent existed; it was just never systematised.

**Also required (HIG §I.8):** ≥12px between adjacent interactive elements. The live-journey action row and the sheet
header's icon pair are both tighter than that today.

## 12.3 Structure and semantics

| # | Finding | Sev |
|---|---|---|
| A1 | **No `role="dialog"`, no `aria-modal`, no focus trap** on four full-screen overlays. Background content stays in the tab order. | **S2** |
| A2 | **No Escape dismissal** on any overlay. | **S2** |
| A3 | **No `aria-live` regions.** One `role="status"` exists (`LocationNotice`). The live journey updates continuously and announces nothing. | **S2** |
| A4 | **Focus indicator is effectively invisible** on every settings row (1.04:1) and absent on the two main text inputs (`outline-none`, no replacement). WCAG 2.4.7. | **S2** |
| A5 | **Planner inputs have no programmatic label.** WCAG 1.3.1 / 4.1.2. | **S2** |
| A6 | **Nested interactive content**: `role="button"` div inside `<button>`, with `onClick` only — not keyboard-operable. WCAG 2.1.1 / 4.1.2. | **S2** |
| A7 | Station-detail tabs use `aria-pressed`, not tab semantics; no arrow-key navigation; panels lack `role="tabpanel"`/`aria-labelledby`. | S3 |
| A8 | The sheet's grab handle is a `<div>` — not tappable to cycle snaps, invisible to AT. HIG §I.10 names this as the accessible resize path. | S3 |
| A9 | **Map attribution absent** — an OSM/CARTO licensing obligation, not a design choice. | **S1 (legal)** |
| A10 | `prefers-reduced-motion` unhandled; four infinite animations. HIG §I.7 / WCAG 2.3.3. | S2 |
| A11 | `prefers-contrast` unhandled; no high-contrast variants. | S3 |
| A12 | No text-size preference and untested at 200% zoom (HIG's own vision target). The `grid-cols-4` picker is the likeliest first break. | S3 |
| A13 | Status conveyed by **colour alone** in the line-status pills, service badges and `STATE_PILL`. WCAG 1.4.1. | S2 |
| A14 | The four `LINE_LETTER` values (B/R/Y/V) are the correct non-colour channel and are **used in `LineBadge` but not in the status pills**, where they would solve A13 for free. | S3 |

## 12.4 What is already right

`aria-label` on icon-only controls is broadly present and correctly *whole strings per state* rather than composed
fragments. `aria-pressed` / `aria-expanded` are used. `role="switch"` with `aria-checked` on the analytics toggle.
`lang` on each language-picker button so the right font and screen-reader voice are selected. `aria-hidden` on the map
wrapper when covered. Decorative images carry `alt=""`. **The i18n-driven accessibility thinking is genuinely good —
what is missing is the structural layer above it.**

---

# 13. Interaction Audit

| # | Area | Finding | Sev | Fix |
|---|---|---|---|---|
| I1 | Press feedback | Six different treatments (`scale-95`, `scale-[0.98]`, `scale-90`, `opacity-70`, `opacity-60`, none). The largest targets — departure cards — have the weakest. | S3 | One token: `scale(0.97)` / 120ms. |
| I2 | Gesture handoff | Correctly built: 8px threshold, direction-aware at full snap, `touch-action` switched per snap. | — | Keep. |
| I3 | Nested scrolling | The station board is a 360px same-axis scroller inside the sheet's scroller inside a drag. `overscroll-contain` is on the outer, not the inner. HIG §I.10: *"Never nest same-axis scroll views."* | S2 | Largely dissolves if the board defaults to 6 rows (C18). |
| I4 | Sheet snap by tap | Header tap cycles collapsed → mid → full, consistently across all three modes. | — | Good, and recently fixed. |
| I5 | Grab handle | Not tappable, not exposed to AT. | S3 | See A8. |
| I6 | Map tap | Collapses the sheet — discoverable only by accident. | S3 | Acceptable; ensure the handle remains the primary affordance. |
| I7 | Loading | Four idioms. The two skeleton fallbacks that draw real furniture are the right pattern. | S3 | Promote to a primitive. |
| I8 | Optimistic updates | Already correct throughout — every mutation writes to Dexie and renders locally without awaiting the network. **This is the app's best perceived-performance asset.** | — | Keep; make it visible (§16/PP3). |
| I9 | Success feedback | Share is a 1.5s inline swap; saves have none. HIG: *"confirm significant completions only"* — but a *save* is one. | S3 | Toast primitive. |
| I10 | Error handling | `ErrorBoundary` exists. Geocoding failures surface a reason. Sync failures surface nothing. | S3 | Surface sync state. |
| I11 | Auto-scroll | The board anchors the first upcoming train, jumping on mount and smoothing thereafter — a well-judged detail. | — | Keep. |
| I12 | Auto-opening modal | Deep-linking opens a train sheet on mount. | S3 | Reconsider (T5). |
| I13 | Time-boxed UI | `justShared` auto-clears after 1.5s. HIG §I.8 warns against timed elements for cognitive accessibility, but a *confirmation* is the acceptable case. | — | Fine. |
| I14 | Reduced motion | Unhandled; four infinite animations. | S2 | Guard, keeping gesture tracking. |

---

# 14. Visual Hierarchy Audit

| Surface | Intended primary | Actually loudest | Verdict |
|---|---|---|---|
| Home / station sheet | Next departure + countdown | **Station name (22px)** — the countdown is third, below a 7-chip row | ❌ Inverted |
| Plan results | `leaveInMins` | ✅ 32px hero, correctly dominant | ✅ Correct |
| Live journey | Current instruction + countdown | **Nothing** — instruction and countdown are both 15px, the same size as a chip | ❌ Flat |
| Station page | Next train each way | **Station name (36px)**, then a 2×2 stat grid, then departures | ❌ Inverted |
| Departure row | The time figure | ✅ 20–22px, correctly dominant | ✅ Correct |
| Settings | Nothing (browsing) | Section headers at 9px uppercase vs 14px row labels | ⚠ Labels louder than headers |
| Reference pages | The prose | 36px title over 13px body — a 2.8× jump then a cliff | ⚠ No mid-tier |

**Three systemic causes:**

1. **The range is too narrow.** 9→22px for 95% of the UI. Three levels of importance cannot be expressed in a 13px
   span. `--t-hero` at 40 creates the headroom that makes hierarchy possible.
2. **Emphasis is spent on metadata.** `uppercase tracking-widest` — the app's loudest treatment — is applied almost
   exclusively to labels, eyebrows and section headers (§5/G2).
3. **Colour cannot help.** Every accent-coloured emphasis in light theme sits at 2.0–2.9:1, so the one channel that
   could carry hierarchy without size is unavailable.

Fix 1 and 3 and the hierarchy largely resolves itself without moving anything.

---

# 15. Information Architecture Audit

**The IA is the strongest part of the product and needs almost no change.** Findings are about *density* and
*ordering within* surfaces, not structure.

| # | Finding | Sev | Recommendation |
|---|---|---|---|
| IA1 | Home sheet ordering: identity → chips → departures. | S2 | Invert (H1). This is the single highest-value IA change. |
| IA2 | The station board renders the **entire operating day** by default. | S2 | Progressive disclosure: 6 upcoming + "Full timetable". HIG §I.5. |
| IA3 | Departed trains lead the board. | S2 | Collapse to one "N earlier trains" row. |
| IA4 | Multiple rows labelled "NEXT" — one per direction per line, up to four at an interchange, with nothing saying which is the rider's. | S2 | Group by direction with `headingName` as the heading — the name actually printed on the platform. |
| IA5 | Twelve computed values are never surfaced: `stopTimeline`, `currentFrequencyMins`, `bufferMins`, `routeKm`, `knownDataIssues`, `multiModal.summary`/`amenities`/`plannedAmenities`, `elapsedMins`, `structure` (on the sheet), `gmrcName`, `noTrainWindow`. **None requires new data.** | S3 | Design Guide §II.4 ranks them. Take the top four. |
| IA6 | Reference content is correctly one level deep (`/you/:topic`) behind a catalog. | — | Keep. |
| IA7 | Settings ordering puts reference topics above preferences — deliberate and correct (a rider wants fare rules more often than walking pace). | — | Keep. |
| IA8 | Two feedback destinations correctly separated (Metrothi's error vs GMRC's service). | — | Keep — but wire them (Y1). |
| IA9 | Provenance lives only in About. | S3 | Reachable *from the fact it qualifies* (P5). **Product decision** — Design Guide open question 4. |
| IA10 | Search scope is not displayed; results are categorised by label only. | S3 | Scope bar. |

---

# 16. Prioritised Roadmap

Sequenced so each phase is independently shippable and earlier phases de-risk later ones.

## Phase 1 — Critical: correctness, safety, and the law

*Nothing here is aesthetic. Each item is a defect that either misinforms a rider, excludes one, or creates legal
exposure.*

| # | Item | Why Phase 1 | Depends on |
|---|---|---|---|
| 1.1 | **Token foundation** — full type ladder, spacing, radius, elevation, semantic status palette, safe-area vars, all in `rem`. *No visible change.* | Everything else in this phase consumes it. Doing it first means each fix lands once. | — |
| 1.2 | **Safe-area insets** — 4 tokens, ~6 consumers. | `viewport-fit=cover` is opted in with zero insets: the app draws under the notch and home indicator on the exact device class it targets. Highest impact-to-effort ratio in this document. | 1.1 |
| 1.3 | **Contrast remediation** — all 26 failing pairs. | Line service status, tight connections and the Yellow Line's next-train figure are safety information currently rendered at 1.7–2.9:1. | 1.1 |
| 1.4 | **`LineBadge` foreground → `#000`** on all four lines. | Fixes three failures and removes a special case. One line of code. | 1.1 |
| 1.5 | **Map attribution.** | OSM ODbL and CARTO ToS obligation. Not a design preference. | — |
| 1.6 | **Touch targets to 44px**, station markers first. | 12×12px targets on the primary interaction surface. | 1.1 |
| 1.7 | **Status never colour-alone** — glyph or word alongside every hue. | WCAG 1.4.1, and it resolves the yellow line/warning collision. | 1.3 |
| 1.8 | **Focus visibility** — real ring, everywhere. | WCAG 2.4.7; currently 1.04:1. | 1.1 |
| 1.9 | **Planner input labels + the nested-interactive fix.** | WCAG 1.3.1 / 2.1.1 / 4.1.2. | — |
| 1.10 | **`prefers-color-scheme` on first run** + System/Light/Dark. | The app ships its least-tested theme by default and ignores the OS. HIG §I.3. | 1.1 |
| 1.11 | **Wire the two dead feedback rows** to `mailto:`. | A settings screen that lists two things it will not do. Ten minutes. | — |

## Phase 2 — Major UX: the questions the app answers badly

| # | Item | Why Phase 2 | Depends on |
|---|---|---|---|
| 2.1 | **Invert the home sheet header** — departure first, station as eyebrow. | The primary question is answered third. Highest-value IA change. | 1.1, 1.3 |
| 2.2 | **Cut the board to 6 upcoming + disclosure**; collapse departed; group by direction. | Removes the "here is 26 screens of history" first impression, kills the nested same-axis scroller, and is also the largest DOM reduction available. | — |
| 2.3 | **Live journey to §I.12 legibility** — instruction 17/600, countdown at hero scale. | The app's most safety-relevant surface is set at chip size. | 1.1 |
| 2.4 | **`aria-live` on the live journey.** | Continuous updates, currently silent. | — |
| 2.5 | **Dialog primitive** — `role="dialog"`, focus trap, Escape, restore — applied to all four overlays. | Four full-screen surfaces are non-modal to AT and keyboard-inescapable. | — |
| 2.6 | **Planner into the sheet** at `full`; dismissal reachable one-handed. | Discards the map and puts its only exit in the hardest corner. | 2.5 |
| 2.7 | **`prefers-reduced-motion`** — guard four infinite animations, keep gesture tracking. | WCAG 2.3.3. | 1.1 |
| 2.8 | **One duration formatter.** | Four formats on one screen. | — |
| 2.9 | **Infeasible states propose the computable fix.** | The answer is already in `options[]`. | — |
| 2.10 | **Reference typography** — `--tr-*` + `--measure-read`. | Species C at ≈110 characters. | 1.1 |
| 2.11 | **Port `HomeSearch`'s place treatment into `Planner`.** | Same query, two answers. | — |

## Phase 3 — Polish: consistency and the design system

| # | Item | Why Phase 3 |
|---|---|---|
| 3.1 | **`Button` primitive**, four roles; migrate all 49. | Consistency compounds; nothing is broken without it. |
| 3.2 | **Collapse 3 chips → 1, 3 rows → 1, 2 section labels → 1, 3 segmented → 1.** | Same. |
| 3.3 | **Collapse 4 line-colour maps → 3**, resolving the two yellows. | Same. |
| 3.4 | **Elevation: one floating material, five consumers.** | Three treatments on one plane. |
| 3.5 | **Scroll edge effect** under the floating chrome. | Cheap; HIG §I.10. |
| 3.6 | **Icon discipline** — 3 sizes, 2 stroke weights. | Currently 13 sizes, 6 weights. |
| 3.7 | **Copy pass** — sentence case throughout, "Find trains", `placeHint`, drop "prototype", remove emoji. | |
| 3.8 | **Spacing scale**; retire ~15 half-step values. | |
| 3.9 | **Real tab semantics** on the station page. | |
| 3.10 | **Toast / EmptyState / Skeleton primitives.** | |
| 3.11 | **Concentric radius rule.** | |
| 3.12 | **Grab handle tappable + AT-exposed.** | |
| 3.13 | **Decide the photo slot** (§7.3). | Product decision. |
| 3.14 | **Test at 200% zoom and 360px**; fix what breaks. | HIG's own vision target. |

## Phase 4 — Delight and refinement

| # | Item | Why last |
|---|---|---|
| 4.1 | **Muted map style** — desaturate the basemap so the four line colours are the only saturated thing; build the Vignelli labels into that world. | The largest aesthetic win and the largest cost. Nothing depends on it. |
| 4.2 | **`stopTimeline[]` → a real progress rail** with per-stop ETAs. | The biggest piece of unused signal in the app. Genuine delight, zero new data. |
| 4.3 | **Surface `currentFrequencyMins`** — "Trains every 8 min right now." | Headline-summary pattern, HIG §I.10. |
| 4.4 | **`bufferMins` on transfers** — "4 minutes to change at Old High Court." | Buffer is the anxiety. |
| 4.5 | **`routeKm` beside the fare** — "12.4 km · ₹25." | Makes the number explicable. |
| 4.6 | **`knownDataIssues` on affected stations.** | Maximally honest; mildly alarming. **Product decision.** |
| 4.7 | **Provenance from the fact, not just About.** | **Product decision** — Design Guide open question 4. |
| 4.8 | **Text-size preference.** | **Product decision** (Y9). |
| 4.9 | **`prefers-contrast: more` variants.** | |
| 4.10 | **Per-script leading for `hi`/`gu`.** | Verify the ladder in all three languages. |
| 4.11 | **Motion polish** — one entrance ease, one state duration, one press response. | |

---

# 17. Estimated Design Effort

Working days. "Design" is specification, tokens, comps and review; "Build" assumes a developer already fluent in this
codebase.

| Phase | Design | Build | Elapsed | Notes |
|---|---|---|---|---|
| **1 — Critical** | 4 | 9–12 | ~3 weeks | 1.1 is 2 design + 2 build; 1.3 is 1 + 3 (mechanical once tokens land); 1.2 is 0.5 + 1. |
| **2 — Major UX** | 6 | 11–15 | ~4 weeks | 2.1 and 2.2 are the largest single items (2 + 3 each). 2.5 is a genuine primitive. |
| **3 — Polish** | 5 | 8–12 | ~3 weeks | Mostly mechanical migration; parallelisable across components. |
| **4 — Delight** | 5 | 6–9 | ~3 weeks | 4.1 dominates (3 + 4). Everything else is small and independent. |
| **Total** | **20** | **34–48** | **~13 weeks** | Sequential, single developer. Phases 3 and 4 parallelise well. |

**If the budget is one sprint:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.11 — roughly **6 design + 8 build days** — closes every
safety and legal defect and every contrast failure. That is the recommended minimum, and it is the sprint with the
highest return in the entire plan.

**If the budget is two sprints:** add 1.6–1.10 and 2.1–2.3. This closes the accessibility floor and fixes the two
inverted hierarchies. After this the app is defensibly "production ready"; everything beyond is refinement.

---

# 18. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Type-scale change breaks the sheet's content-fitted snaps.** `midContentHeight` measures real DOM; raising body text from 11 to 15–17px grows every block, and `pointsFor` caps `mid` at 60% of viewport. | **High** | Medium | The cap already handles overflow gracefully. Re-verify all three modes at 360px after 1.1, and re-tune `COLLAPSED_H` / `PLAN_COLLAPSED_H` / `LIVE_COLLAPSED_H` — which must change anyway for safe areas (1.2). Sequence 1.1 and 1.2 together. |
| R2 | **Boot-path regression.** `CLAUDE.md` protects the first frame explicitly; a token layer or new CSS could add weight. | Medium | **High** | Tokens are CSS custom properties — a few hundred bytes, no JS. Measure by **summing every JS file `index.html` loads**, not the `index-*.js` line. Dropping `wght@300` from the font request is a net win. |
| R3 | **Larger type breaks Hindi/Gujarati layouts first.** Indic strings run longer and the ladder is tuned for Latin. | **High** | Medium | Per-script leading (4.10) is currently last; **move it into Phase 1 as a verification step**. `locales.test.ts` already asserts key parity — extend the manual pass to all three languages at 360px. |
| R4 | **Contrast fixes are perceived as "washing out the brand."** Deepening green/amber/red/violet for light mode makes them less vivid. | Medium | Low | The line colours — the actual brand — do not move. Status colours were never brand. Show the measured before/after. |
| R5 | **Cutting the departure board loses power users** who scan the full timetable. | Low | Medium | It is disclosure, not deletion. "Full timetable" is one tap, and the auto-anchor behaviour is preserved. |
| R6 | **Moving the planner into the sheet fights the existing gesture stack.** | Medium | Medium | The sheet already hosts two other full-height modes. Prototype behind a flag; the fallback (move dismissal to bottom-reachable) is cheap and captures most of the benefit. |
| R7 | **Scope creep into feature work.** Twelve unsurfaced data values are tempting. | **High** | Medium | They are Phase 4 for a reason. Phases 1–2 add **no new content**. Hold the line. |
| R8 | **Four decisions belong to the product owner**, not the designer: station photography, provenance prominence, `knownDataIssues` visibility, text-size preference. | Certain | Low | Flagged inline (§7.3, Y9, 4.6, 4.7). Resolve before Phase 3. |
| R9 | **A muted basemap could reduce legibility** of street context riders use for the last-mile walk. | Medium | Medium | Test at the zoom levels the walking leg actually uses. Desaturate rather than flatten; keep road hierarchy. |
| R10 | **Regression.** Nothing today prevents the 63rd colour literal becoming the 64th. | **High** | Medium | **Add lint rules in Phase 0**: no hex/`rgba` in `.tsx`, no `text-[Npx]`, no raw Tailwind palette colour utilities. This is what makes the work stick. |

## Invariants the redesign must not break

From `CLAUDE.md` and the PRD. Each looks like a bug or a cleanup opportunity and is not:

- **Ride time is not `totalMins`.** Anything presented as trip duration uses `rideMinsOf()`.
- **Never fake real-time.** No live vehicle feed exists; "live" is simulated and must be labelled — legibly, once.
- **GMRC-sourced facts only. Absence is never a negative.**
- **No stand-in station photos.**
- **The app must stay fully usable with no account, no network, and no Supabase project.**
- **The boot path is protected.** A redesign that adds entry-chunk weight is a regression regardless of appearance.
- **UI strings go through `t()`; GMRC's words and proper nouns do not.** Never compose a sentence from fragments.
- **Theme's `localStorage` paint hint is deliberate.** Do not consolidate it into one source; do not copy the pattern.
- **Both departure lists render through `DepartureRow`.** Do not fork it.
- **Tailwind's `animate-*` entrance utilities generate no CSS here.** Entrances are framer-motion.
- **Never a lateral offset on a page root** — it produces real horizontal scroll.

---

# 19. Final Recommendations

**1. Build the token layer first, and change nothing visible while doing it.** Phase 1.1 is the whole strategy in one
item. The evidence is unambiguous: where a token exists the app is correct and consistent; where none exists it is
chaotic. `--c-accent-fg` proved this — one token changed, every consumer fixed. Ten more tokens fix most of this
document.

**2. Do the safe-area fix this week, regardless of everything else.** Four CSS variables, six consumers, half a day.
The app currently draws under the home indicator on the exact devices it was designed for. There is no cheaper credible
improvement available.

**3. Stop treating light as the theme you get for free.** Nineteen of twenty-six contrast failures are light-only,
because the status palette was authored on near-black. Light is the default and is shipped to every rider whose OS
preference is never read. Fix the palette *and* read `prefers-color-scheme`; either alone leaves the problem half-solved.

**4. Give the app a hero size.** One token — `--t-hero` at 40px — creates the headroom that makes every other
hierarchy problem solvable. The app is currently trying to express three levels of importance inside a 13px range and
failing for arithmetic reasons, not aesthetic ones.

**5. Take colour out of the semantic layer.** Four hues are spent on line identity and cannot move. Every status must
lead with a glyph or a word. This simultaneously fixes WCAG 1.4.1, resolves the Yellow-Line-versus-warning collision,
and makes the app legible in the sunlight it is actually used in.

**6. Ship the two `mailto:` links.** Ten minutes, and it removes the only remaining place where the interface promises
something it does not do.

**7. Add the lint rules.** No hex in `.tsx`, no `text-[Npx]`, no raw palette utilities. Without them this document
describes a state the codebase will drift out of within two months. With them, the tokens are load-bearing and the
next contributor inherits the system rather than re-deriving it.

**8. Do not redesign the architecture.** Map-as-canvas, one sheet, three modes, no tab bar, nothing unmounting. It is
the hardest part of this product and it is already right. Every recommendation above works inside it.

---

## What I did not do

- **I did not measure the running app.** Every layout claim here is derived from source. The 2026-07-26 teardown's
  live measurements (DOM node counts, the 9px CTA clearance, marker sizes in the browser) are consistent with what the
  source says, but I have re-derived rather than re-cited them: marker sizes come from `HomeMap.tsx:43`, the safe-area
  finding from `viewport-fit=cover` plus zero `env()` declarations. A device pass at 360px in both themes, both
  orientations and all three languages should precede Phase 2.
- **I did not evaluate the Figma iOS 27 UI Kit.** Design Guide Appendix B establishes it needs Figma desktop plus a
  Dev Mode seat, and the zip in `files/` is an asset bundle, not a measurable artboard set. The HIG values in §8 come
  from Part I's tables. If the kit becomes available, re-verify §8.3 and §8.8 against it — and substitute Space
  Grotesk before judging any spacing, since a mockup set in SF will not hold its metrics when built.
- **I did not propose feature changes.** Per the brief and the PRD, workflows, navigation and product logic are
  unchanged. The twelve unsurfaced data values in §15/IA5 are the one place I recommend adding content, they are all
  already computed, and they are deliberately last.

---

*Prepared 2026-08-03 against `develop` @ `5e3d0c5`. All contrast ratios computed from the literal values in source
using the WCAG 2.x relative-luminance formula. All counts obtained by search across `app/src`, excluding test files.*

---

# Appendix C — Execution log

## Phase 1, executed 2026-08-04

All of §16 Phase 1 (1.1–1.11) is built, plus the Phase 0 lint rules from §19.7 and the per-script leading that R3
recommended moving forward. Verified with `npm run lint`, `npm test` (424 passing) and `npm run build`, and measured in
the running app at the 360px design viewport in both themes.

**Boot-path cost (R2):** render-blocking CSS 7.60 → 8.07 kB gzip; entry JS 164.56 → 165.06 kB gzip. Roughly +0.96 kB
gzip total, against which `wght@300` came off the Google Fonts request.

### Corrections to this document

Five values specified in §8 do not hold when measured against tokens this same document introduces. They were
recomputed during implementation and the corrected values are what shipped.

| § | Specified | Measured | Shipped | Why |
|---|---|---|---|---|
| 8.4 | `--c-warn` light `#b45309` | **4.22** on `--c-bg-2` | `#92400e` | The 8% tint the same section mandates darkens the surface enough to pull a token chosen against plain white back under 4.5:1. Every status colour has to clear on *its own tint*, not just on the plain surface. |
| 8.4 | `--c-good` light `#047857` | **4.16** on its own tint over `--c-bg-2` | `#065f46` | Same. |
| 8.4 | `--c-border-focus` `#f97316`, "3:1 vs both surfaces" | **2.55** on light `--c-bg` | light `#c2410c`, dark `#f97316` | The claim is true in dark and false in light. The ring has to be theme-aware. |
| 8.4 | `--c-border` dark `#3a3a42` | **1.38** on `--c-elevated` | `#42424b` | Specified against `--c-card` only, but the same section introduces a lighter `--c-elevated` for sheets — where the border then disappears again. |
| 8.4 | (not specified) | `--c-accent` as text is **2.80** | new `--c-accent-text` `#b23a0a` | §12.1 lists the accent eyebrow as a failure but §8.4 gives no replacement token. The accent is a *fill* colour; it needs a separate value to be legible as a foreground. |

After these, every foreground token clears **4.5:1 against every surface in both themes** (worst case 4.86 dark /
5.04 light), the focus ring clears 3:1, and both borders clear 1.5:1 — verified in the browser rather than from source.

### Deliberately deferred

- **The type-ladder migration.** §8.3's ten tokens exist and the 9px/10px tier is retired from the sites §8.3 names,
  but **125 `text-[Npx]` call sites across 20 files remain** — that is Phase 2–3 work, and R1 is right that it moves
  the sheet's measured snap points. `scripts/design-tokens-baseline.json` records the remaining count per file, only
  ever shrinks, and fails the lint if a file gains a new one or if a fully-migrated file is left in the baseline. A
  rule that can't be switched on is not a rule; a ratchet is.
- **`--scroll-edge`** is defined (§8.5) and not yet consumed — that is 3.5.
- **`prefers-reduced-motion`** is 2.7. Two of the four always-on animations are gone as a side effect of the status
  work (the state pill's pulsing dot and the "Live" service-status pulse both became glyphs), but the guard itself
  is not written.

### One decision left to the product owner

`FEEDBACK_EMAIL` in `features/info/catalog.ts` is set to the repository's git author address. It is the only plausible
destination in the repo, but 1.11 puts a personal address into a shipped, public artefact — change the constant if
that is not the intent.

---

## Phase 2, executed 2026-08-04

All of §16 Phase 2 (2.1–2.11) is built. Verified with `npm run lint`, `npm test` (433 passing, up from 424) and
`npm run build`, and measured in the running app at the 360px design viewport in both themes — the device pass §"What
I did not do" asked for before Phase 2 was folded into the work rather than run ahead of it.

| # | What shipped |
|---|---|
| 2.1 | The station sheet header is inverted. `stationSheet/NextDepartureHero.tsx` puts the countdown at `--t-hero` with its direction and clock beneath; the station name and its qualifier become one 12px eyebrow row. The seven-chip row is down to two, conditionally: the line chip renders **only when the line isn't running**, and distance + walk are one chip. Interchange and the connecting modes came out entirely — the Info tab already renders them with GMRC's own wording. |
| 2.2 | `StationDetail.MergedTrainList` is replaced by `DirectionBoard`: one board per direction, headed by the terminus; departed trains collapse to one "N earlier trains" row; six upcoming, then "Full timetable". Both disclosures are 44px. The 360px nested scroller is gone. `UpcomingTrains` groups by line at an interchange and drops the repeated "Next ·" prefix. |
| 2.3 | Live instruction at `--t-headline`, countdown at `--t-hero` as a numeral with `journey.minUnit` beside it. All 18 arbitrary type sizes in `LiveJourneyScreen` migrated onto the ladder. |
| 2.4 | `aria-live` on the live instruction — `assertive` on the two `alert`-tone states, `polite` otherwise — and `role="progressbar"` on the 3px rail. |
| 2.5 | `components/useDialog.ts`: `role="dialog"`, `aria-modal`, focus in / trapped / restored, Escape closing the **topmost** layer via a module-level stack. Applied to `HomeSearch`, `TrainRouteSheet`, and the sheet when it holds the planner. |
| 2.6 | The planner is a sheet mode at `full` rather than a `fixed inset-0` takeover. The map survives underneath, drag-down dismisses, and its title moved into the sheet header. |
| 2.7 | One blanket `prefers-reduced-motion` rule in `index.css` for every CSS animation, `MotionConfig reducedMotion="user"` for every framer entrance, and a `duration: 0` settle in `DraggableSheet`. Gesture tracking is untouched, deliberately. |
| 2.8 | `fmtMins` deleted; `formatDuration` is the one formatter. The live journey printed "5 mins", "12min", "3m" and "19 min" on one screen. |
| 2.9 | `features/journey/strandedAdvice.ts` — React-free, key-plus-values, its own test — names the soonest departure that gets through, or failing that the stranding line's first train tomorrow. Three whole keys, one per shape. |
| 2.10 | Reference pages on the `--tr-*` ladder at `--measure-read`. Measured at an 820px viewport: the column caps at 544px and prose runs **52 characters** a line against the ≈110 it was. |
| 2.11 | `findNearestStation` exported from the engine and shared through `hooks/useNearestStationHint.ts`. `planner.placeHint` is deleted from all three bundles. |

**Boot-path cost:** entry JS 165.06 → 166.71 kB gzip, render-blocking CSS 8.07 → 8.32 kB — roughly **+1.9 kB gzip**,
all of it new statically-imported modules. Comparable to the Phase 1 figures because no split changed: the entry-chunk
line is only misleading when a route moves, and none did.

### Two things Phase 2 changed its mind about

**IA4's grouping applies to two boards, not one.** §15 reads as one finding about the home sheet's up-to-four "NEXT"
rows, and §16/2.2 folds "group by direction" into the station page's board. Both are real and they want different
groupings: the station page has one line and two directions, so it groups by **direction**; the home sheet has up to
two lines and four rows, so it groups by **line**, which is the axis a first initial and a hue were failing to carry.
Both shipped.

**The auto-anchor scroll (§13/I11, "a well-judged detail") is deleted rather than preserved,** and R5's mitigation
("the auto-anchor behaviour is preserved") no longer applies. It existed to hide the departed trains the list opened
on. With six upcoming departures first and the departed ones behind a disclosure, the next train is at the top by
construction — a scroll that lands you somewhere is strictly worse than a list that starts there.

### One Phase 1 defect found and fixed in passing

`StationDetail.tsx:847` set the not-found screen's only exit to `var(--c-accent-strong)`, a token that does not exist.
An undefined custom property silently inherits, so 1.3's fix for T6 landed as "whatever colour the paragraph above
happens to be". Now `--c-accent-text`.

### Deliberately deferred

- **The type-ladder migration** is down from 125 arbitrary sizes to **88**, across 16 files rather than 20 —
  `LiveJourneyScreen`, `InfoPage`, `blocks.tsx` and `UpcomingTrains` are fully migrated and out of the baseline. The
  rest is Phase 3.
- **`--scroll-edge`** is still defined and unconsumed; that is 3.5.
- **§10.2/P6** (the ticket-note row rendering an icon for an empty note) and the 200%-zoom test of the `grid-cols-4`
  picker are recorded in `DISCREPANCIES.md` rather than fixed — neither is in the Phase 2 roadmap.
