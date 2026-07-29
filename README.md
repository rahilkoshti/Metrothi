# Metrothi 🚇

<p align="center">
  <img src="./files/ahmedabad-metro-map.png" alt="Ahmedabad Metro Map" height="200" />
</p>

Metrothi is the ultimate, fully-functional companion application for the Ahmedabad Metro system. Built for speed and utility: open it, and within two seconds you know **which station to walk to, when the next train actually leaves, and exactly how to get where you're going** — including what ticket works, where to change lines, and whether the trip is even possible right now.

## 🚀 Features

- **Blazing Fast Routing:** Offline-capable journey planning using a deterministic ordered-array engine.
- **Honest Live Estimates:** Simulates live departures from actual GMRC timetables (no fake vehicle tracking).
- **Multimodal Ready:** Architecture supports geolocation resolving (search for "Stadium", route to "Motera Stadium").
- **Local-First:** Works entirely in airplane mode. The transit graph and timetables are bundled at build time and precached by the service worker; user data lives in `localStorage`.

---

## 🤖 For AI Assistants (How to Work with This Repo)

Welcome! If you are an AI assistant helping build or maintain Metrothi, here is your quick-start guide to the repository structure and rules. We rely heavily on agentic workflows, so please adhere strictly to these constraints.

### 1. The Master Reference: `files/Metrothi-PRD.md`
This is the single most important document in the project. 
**Before making any architectural, structural, or feature scope decisions, you MUST read `files/Metrothi-PRD.md`.** 
- It contains the complete product vision, scope (what we are *not* building), and the phased roadmap.
- Any new features or changes to the architecture must be documented there *first* before code is written.

### 2. Key Architectural Rules
- **Engine/UI Separation:** The core routing logic lives in `app/src/features/journey/engine/journeyEngine.ts`. This file is pure TypeScript with **zero React imports**. UI components (in `components/`) only call functions from this engine and render the results.
- **Design System:** Light and dark are both first-class — light is the default. All colors must use the CSS custom properties defined in `index.css` (e.g., `var(--c-bg)`, `var(--c-text)`, `var(--c-card)`, `var(--c-accent)` / `var(--c-accent-fg)`) rather than hardcoded hex values, so the theme toggle works. The four line colors (`LINE_COLORS`) are the exception — they map to real-world signage and stay fixed across themes.
- **No Real-time API (yet):** GMRC does not provide a live vehicle feed. We simulate "live" data using the static timetable logic inside `journeyEngine.ts`. **Never fake real-time tracking.**
- **Local-first Storage:** Transit data is bundled JSON, precached by the service worker — **Dexie never holds the transit graph.** User data (saved stations, saved journeys, recent trips, preferences) lives in Dexie/IndexedDB via `app/src/data/db.ts`, and syncs to Supabase when signed in. Writes go **local first**: the UI renders the Dexie write and never waits on the network. Deletes are `deletedAt` tombstones, never row removals — a removed row is indistinguishable from one the server hasn't sent yet, so hard deletes would resurrect everything you unfavourited on the next pull. The app must stay **fully usable with no account, no network, and no Supabase project configured**; if `VITE_SUPABASE_URL` is unset the client is `null` and every sync path no-ops. See PRD §5.2 and §5.7.
- **Theme has a `localStorage` mirror on purpose:** it's the one value read before React mounts, and an async IndexedDB read there is a visible flash of the wrong theme on every cold start. Dexie stays the source of truth; `metrothi-theme` is a synchronous paint hint allowed to be stale for one frame. **Don't "clean this up" into a single source** — and don't copy the pattern for anything that isn't needed at first paint.
- **Ride time is not `totalMins`:** `totalMins` on a journey option is the platform wait *plus* the ride. Any figure presented as the trip's own duration must use `rideMinsOf()` instead, which starts at boarding. Getting this wrong bills an 8-minute hop as a two-hour journey when the app is opened before service starts. See PRD §5.5.
- **No stand-in station photos:** `stationImages.ts` only maps stations that have actually been photographed, and `stationImage()` returns `null` otherwise. **Never add a placeholder or a per-line fallback** — in a wayfinding app a photo of the wrong station is worse than no photo. Callers handle the miss by closing up the layout.
- **Station facts are GMRC's or they don't ship:** `data/stationFacilities.json` (per-station structure, open gates, lift→gate mapping, and multi-modal interchange for the 10 stations that have one) and `data/passengerInfo.json` (network-wide facilities, do's & don'ts, prohibited items, safety kit, customer care, official links) are scraped straight from gujaratmetrorail.com and carry a `_meta.rule` saying so. GMRC publishes **no** per-station toilet, Wi-Fi, ATM, feeder-bus-route or gate-landmark data — leave those absent rather than sourcing them from a wiki or a blog, the same way `stationImages.ts` refuses a stand-in photo. A missing `multiModal` means "GMRC lists no built interchange here", never "nothing nearby", so don't render it as a negative. Regenerate with `node scripts/fetch-station-facilities.mjs`; it fails loudly if either source page changes shape, and warns if a station's cited Entry-Exit isn't one of its operational gates. **Where this data is going is already specified** — Station Info tab in PRD §4.4.1, settings reference pages in §4.5.1, last-mile arrival guidance in §4.2, the data layer in §5.6, phased in §8. Read those before building against these files.
- **Shared departure rows:** Both departure lists (the home sheet's board and the station page's full-day schedule) render through `features/journey/components/DepartureRow.tsx`. They were hand-rolled separately once and drifted; don't fork it again.

### 3. Log What You Don't Fix: `DISCREPANCIES.md`
When you spot a bug or inconsistency that is **out of scope for the task you're on**, do not fix it inline and do not silently drop it — append it to `DISCREPANCIES.md` at the repo root, with the file path, line number, and enough context to act on later. Move an entry to the "Resolved / Fixed" section when it's actually fixed.

---

## 🛠 Tech Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** TailwindCSS + Vanilla CSS (Custom Design Tokens)
- **Routing:** React Router v7
- **Mapping:** React Leaflet
- **Animations:** Framer Motion
- **Local store:** Dexie (IndexedDB) — user data only
- **Backend (optional):** Supabase — auth + sync, lazily loaded and never on the boot path

## 📦 Getting Started

To run the application locally on your machine:

```bash
# Navigate to the frontend directory
cd app

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Visit `http://localhost:5173` in your browser to view the application.

### Optional: account sync

**Skip this and everything still works.** Without it the app runs local-only: your saved stations, journeys, recent trips and theme live in IndexedDB on that device, and the YOU screen says sync isn't configured instead of offering a sign-in that can't work. The Supabase SDK isn't even downloaded.

To enable it:

1. Create a Supabase project, then copy `app/.env.example` to `app/.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Settings → API**. Use the **anon / publishable** key — never `service_role`, which bypasses every RLS policy and would be inlined into the client bundle by Vite.
2. Run [`supabase/schema.sql`](supabase/schema.sql) once against the project (Dashboard → SQL Editor). It creates the four tables and their row-level-security policies, and ends with a query that should report `rls_enabled = true` and `policy_count = 4` for each. **RLS is the only thing separating one user's rows from another's** — the anon key is public by design.

Sign in from the YOU screen. Data you created before signing in is merged into the account, not discarded.

## 📝 License

This project is licensed under the MIT License.
