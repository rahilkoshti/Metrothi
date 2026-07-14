# Metrothi

Metrothi is the app the Ahmedabad Metro should have shipped: open it, and within two seconds you know **which station to walk to, when the next train actually leaves, and exactly how to get where you're going** — including what ticket works, where to change lines, and whether the trip is even possible right now.

## For AI Assistants (How to Work with This Repo)

Welcome! If you are an AI assistant helping build or maintain Metrothi, here is your quick-start guide to the repository structure and rules.

### 1. The Master Reference: `files/Metrothi-PRD.md`

This is the single most important document in the project. 
**Before making any architectural, structural, or feature scope decisions, you MUST read `files/Metrothi-PRD.md`.** 
- It contains the complete product vision, scope (what we are *not* building), and the phased roadmap.
- Any new features or changes to the architecture must be documented there *first* before code is written.

### 2. Tech Stack
- **Frontend Framework:** React + Vite
- **Language:** TypeScript (`.tsx` / `.ts`)
- **Styling:** Vanilla CSS (`index.css` for design tokens and custom properties) with TailwindCSS utility classes for layout.
- **Routing:** React Router v6

### 3. Project Structure

The project is structured using a feature-first approach.

```text
r:\Metrothi
├── app/                  # The main frontend application folder
│   ├── src/
│   │   ├── assets/       # Static assets (currently empty)
│   │   ├── components/   # Shared UI components across the app
│   │   ├── contexts/     # React Contexts (e.g., ThemeContext.tsx)
│   │   ├── data/         # Static JSON data (fares, stations, timetable)
│   │   ├── features/     # Feature-first modules
│   │   │   ├── journey/  # The core journey planning feature
│   │   │   │   ├── components/ # UI screens (Dashboard, Planner, ResultsScreen, etc.)
│   │   │   │   └── engine/     # Pure TS journey logic (journeyEngine.ts)
│   │   │   └── map/      # Interactive network map feature
│   │   │       └── components/ # UI screens (MapScreen, MapPreview)
│   │   ├── services/     # External integrations (e.g., LocationService.ts)
│   │   ├── App.tsx       # Main app shell & routing
│   │   ├── index.css     # Global CSS and design tokens (Light/Dark mode vars)
│   │   └── main.tsx      # React entry point
│   └── package.json      # Dependencies and scripts
├── files/
│   ├── Metrothi-PRD.md   # Product Requirements Document (The Source of Truth)
│   └── phase_plan.md     # Phase-by-phase development roadmap
└── README.md             # This file
```

### 4. Key Architectural Rules

- **Engine/UI Separation:** The core routing logic lives in `app/src/features/journey/engine/journeyEngine.ts`. This file is pure TypeScript with **zero React imports**. UI components (in `components/`) only call functions from this engine and render the results.
- **Design System:** The app uses a dark editorial aesthetic. All colors should use the CSS custom properties defined in `index.css` (e.g., `var(--c-bg)`, `var(--c-text)`, `var(--c-card)`) rather than hardcoded hex values to support the Light/Dark mode toggle.
- **No Real-time API (yet):** GMRC does not provide a live vehicle feed. We simulate "live" data using the static timetable logic inside `journeyEngine.ts`. **Never fake real-time tracking.**
- **Local-first:** The core features must function fully offline once the app is loaded and static data is cached.

### 5. Project Status & Roadmap

**Phase 1 & 2 are complete.** We have built out all the core flows, including:
- The contextual **Dashboard**
- **Journey Planner** with live estimates and feasibility checks
- **Journey Mode** (`LiveJourneyScreen`) state machine prototyping
- **Station Directory** & Details
- **Interactive Map** with on-map routing, Location FAB, and Bottom Sheets

For a detailed breakdown of what comes next (Phase 3 Engine Hardening, Local Storage, Auth, etc.), please refer to `files/phase_plan.md` or the `Metrothi-PRD.md`.

### 6. Running the App Locally

Navigate to the `app` directory and start the Vite dev server:

```bash
cd app
npm install
npm run dev
```
