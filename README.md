# Metrothi 🚇

<p align="center">
  <img src="./files/ahmedabad-metro-map.png" alt="Ahmedabad Metro Map" height="200" />
</p>

Metrothi is the ultimate, fully-functional companion application for the Ahmedabad Metro system. Built for speed and utility: open it, and within two seconds you know **which station to walk to, when the next train actually leaves, and exactly how to get where you're going** — including what ticket works, where to change lines, and whether the trip is even possible right now.

## 🚀 Features

- **Blazing Fast Routing:** Offline-capable journey planning using a deterministic ordered-array engine.
- **Honest Live Estimates:** Simulates live departures from actual GMRC timetables (no fake vehicle tracking).
- **Multimodal Ready:** Architecture supports geolocation resolving (search for "Stadium", route to "Motera Stadium").
- **Local-First:** Designed to work entirely in airplane mode using PWA technologies and IndexedDB caching.

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
- **Design System:** The app uses a dark editorial aesthetic. All colors should use the CSS custom properties defined in `index.css` (e.g., `var(--c-bg)`, `var(--c-text)`, `var(--c-card)`) rather than hardcoded hex values to support the Light/Dark mode toggle.
- **No Real-time API (yet):** GMRC does not provide a live vehicle feed. We simulate "live" data using the static timetable logic inside `journeyEngine.ts`. **Never fake real-time tracking.**
- **Local-first Sync Strategy:** All data must be written to IndexedDB (Dexie) first for immediate UI response, then synced to Supabase if the user is authenticated.

---

## 🛠 Tech Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** TailwindCSS + Vanilla CSS (Custom Design Tokens)
- **Routing:** React Router v7
- **Mapping:** React Leaflet
- **Animations:** Framer Motion

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

## 📝 License

This project is licensed under the MIT License.
