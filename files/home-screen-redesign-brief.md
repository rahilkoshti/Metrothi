# Design Brief — Reimagine the Metrothi Home Screen

**To:** the design/build agent
**From:** the Metrothi team
**Goal:** Throw out the current home screen and design a new one from scratch. Keep the *jobs it does*, reinvent *everything about how it looks and feels*. We want something that reads as a small, opinionated, hand-built indie app — minimal, confident, and distinctly styled — not another generic transit dashboard.

---

## 1. What Metrothi is

Metrothi is a mobile-first PWA for riding a 4-line metro system. It's offline-capable, installs to the home screen, and is used one-handed, on the move, often in a hurry and often underground with bad signal. The whole product lives on a phone screen.

The four lines are the spine of the brand:

| Line   | Color     | Letter |
|--------|-----------|--------|
| Blue   | `#3B82F6` | B |
| Red    | `#EF4444` | R |
| Yellow | `#EAB308` | Y |
| Violet | `#A855F7` | V |

Current brand accent is warm orange (`#F97316`). Current identity is an "M" monogram. **You may keep, evolve, or replace the accent and monogram** — the four line colors are the one thing that should stay recognizable, because riders map them to real-world signage.

The app supports **light and dark themes** via CSS variables (`--c-bg`, `--c-card`, `--c-text`, `--c-accent`, etc.). Both themes must be first-class — don't design one and tint the other.

---

## 2. The single most important idea

The home screen is a **live map with a draggable sheet over it**. The map is the canvas; the sheet is the interface. Nearly everything the user does happens by dragging that sheet up and down and tapping things inside it. This bottom-sheet-over-map pattern is the heart of the screen — **you have freedom to reinvent it, but respect that this screen must feel spatial and live, not like a list of menu items.**

The sheet is *contextual*: it shows one of three completely different faces depending on what the user is doing. Getting these three states and the transitions between them to feel effortless is the core design problem.

---

## 3. The three states of the home screen

### State A — "Station" (the default / resting state)
What the user sees when they open the app with nothing planned.

- **The map** fills the screen, centered on the user's location, with every station plotted and the four colored lines drawn as real track polylines.
- **A search bar** floats at the top: "Search stations and landmarks." Tapping it opens a full search overlay.
- **Live line-status pills** sit just under the search bar — one per line — each a glanceable chip: a colored dot (pulsing green "Live" when running, "In 12m" before first train, "Bus only", or "Closed") plus the line's short name. Tapping a pill jumps into search filtered to that line.
- **The sheet, collapsed**, shows the user's **nearest station**: line badge, station name, a "Nearest station" label (or "Default station" if location failed), plus chips for line, distance (e.g. "450 m"), and walk time (e.g. "6 min"). If it's an interchange, that's flagged.
- **Dragging the sheet up** reveals the full station detail: which phase of the network it's in, its position on the line ("Stop 7 of 23"), a service-status warning if the line isn't running, and a live, time-sorted **departure board** for both directions — the next train highlighted, departed trains greyed. Tapping a train opens its full stop-by-stop route.
- **A floating "Plan Route" button** (compass icon) and a **recenter button** hover over the map, visible only when the sheet is collapsed.

### State B — "Plan" (a route has been planned, not yet started)
The user searched a destination or used the planner. The sheet transforms into a **journey results view**.

- **Collapsed header:** origin → destination, with chips for total stops, number of transfers, and arrival time.
- **The map** dims everything except the planned route: colored line segments for each leg, dashed walking segments from the user to the origin station and from the destination station to the final place, fitted neatly into the visible area above the sheet.
- **Expanded body:** a journey summary with **multiple departure options** the user can flip between (each a real upcoming train), a **stop-by-stop route timeline** showing transfers and leg colors, and an "all trains" list. A prominent **"Start Journey"** action.
- An **X** clears the route and returns to State A.

### State C — "Live" (a journey is underway)
The user tapped Start Journey. The sheet becomes a **live trip companion**.

- **Collapsed:** a compact live summary — where they are in the trip, next action, time/stops remaining, tappable to expand.
- **The map** shows trains gliding along the track in real time; the route is the focus.
- **Expanded:** the live journey screen — progress through stops, transfer prompts, countdowns, "you're arriving" cues. An action to end the journey.

**Transitions between states matter enormously.** When a route is planned the sheet should pop to mid-height; when a journey starts it should collapse to its live peek; clearing returns to the resting station peek. These are the moments the app feels alive — treat them as designed animations, not state swaps.

---

## 4. Everything that must survive (functional inventory)

The redesign can move, merge, restyle, or reinvent the presentation of any of these — but every capability below must still be reachable from the home screen:

1. **Live map** with user location, all stations, all four colored lines.
2. **Search** for stations and landmarks (opens a full overlay).
3. **Nearest-station awareness** with distance + walk time, and a graceful **fallback + retry** when location permission is denied or unavailable.
4. **Per-line live service status**, glanceable, tappable.
5. **Station detail**: line, interchange flag, position on line, network phase, and a **live departure board** for both directions with per-train route detail.
6. **Trip planning**: pick origin + destination (station or landmark), see options.
7. **Journey results**: multiple departure choices, transfers, stop-by-stop timeline, arrival time, start action.
8. **Live journey**: real-time progress, transfer guidance, countdowns, end action.
9. **Recenter map** control.
10. **Entry to the "You"/settings screen** (currently a gear on the search bar).
11. **Light/dark theme**, both fully designed.
12. **Offline resilience** — it will be used underground; don't lean on animations or assets that break without signal, and don't hide critical info behind network calls.

---

## 5. What we want it to *feel* like

This is where you have the most freedom. Push it.

- **Minimal, indie, distinctly styled.** Think of the apps people screenshot because they have a *point of view* — a specific typeface, a confident grid, restrained color used with intent, one or two signature interactions. Not Material, not stock iOS, not a template.
- **Opinionated over comprehensive.** It's fine to make the common path (open app → glance at nearest station → go) feel almost magical, and let power features live one layer deeper.
- **Calm, then precise.** At rest it should feel quiet and spacious. In a live journey it should feel exact and reassuring — the rider is trusting it to not miss a stop.
- **The map is a character, not a background.** Consider how the base map, the line colors, the station marks, the trains, and the dimming during a trip all read as one coherent visual world. A custom, styled map aesthetic would go a long way toward "stands out."
- **Motion with meaning.** Sheet drags, state transitions, the pulsing live dot, trains gliding — motion should communicate state, never decorate. (Note: heavy always-on animation makes the screen hard to screenshot/verify and can cost battery — use it deliberately.)
- **Typography and number treatment.** This app is full of times, distances, counts, and countdowns. Tabular, legible, well-hierarchied numerals are a huge part of feeling trustworthy and "designed."

---

## 6. Constraints & practical notes

- **Mobile-first, one-handed, thumb-reachable.** Primary actions live in the lower half of the screen. Assume small screens and safe-area insets (notches, home indicators).
- **Tech reality:** React + Tailwind, Leaflet for the map, framer-motion is the established animation/gesture library, `lucide-react` for icons. Theme is driven by CSS variables. You don't have to honor the current component structure, but staying within this stack keeps it buildable.
- **Accessibility:** legible contrast in both themes, real hit targets, labels for icon-only controls, and don't encode meaning in color alone (line color + letter/name together).
- **The four line colors are load-bearing.** Everything else — accent, monogram, map style, type, layout, the very shape of the sheet — is yours to reimagine.

---

## 7. Deliverable

A reimagined home screen covering all three states (Station / Plan / Live) and the transitions between them, with the resting Station state as the hero. Show light and dark. Make it look like *someone* made it — a small team with taste and a strong opinion, not a committee. Surprise us.
