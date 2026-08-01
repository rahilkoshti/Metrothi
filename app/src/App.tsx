import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomeScreen } from './features/journey/components/HomeScreen';
import { LocationService, type LocationErrorKind } from './services/LocationService';
import { STATIONS, haversineKm, planJourney, STATION_BY_ID } from './features/journey/engine/journeyEngine';
import { StationDetail } from './features/journey/components/StationDetail';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useJourneySession } from './features/journey/hooks/useJourneySession';
import { InfoPageFallback } from './features/info/InfoPageFallback';
import { YouScreenFallback } from './features/journey/components/YouScreenFallback';
import { ScrollReset } from './components/ScrollReset';
import { Insights } from './components/Insights';
import { LanguageSync } from './i18n/useLanguage';
import { recordRecentTrip, migrateFromLocalStorage } from './data/db';
import { syncNow } from './services/syncEngine';

// The reference pages (§4.5.1) carry ~19 KB of GMRC prose in the two JSON files
// their topic registry imports. None of it is needed to draw a map or plan a
// journey, so the whole route is split out and fetched on first visit — after
// which the service worker has it precached and it works offline like the rest
// (§5.6).
const InfoPage = lazy(() => import('./features/info/InfoPage'));

// The settings screen goes the same way, for the same reason one route down.
// Nothing on YOU is needed to draw a map or plan a journey, and it carries the
// topic catalog, the provenance mapping, the account card and a 53-station
// `<select>` behind it.
//
// Measured over the build both ways, counting **every** file `index.html`
// loads and not just the entry chunk: 641,102 raw / 198,719 gzip against
// 662,652 / 204,171, so **5.32 KB gzip (21.0 KB raw) off every cold start**.
// The entry chunk alone appears to drop 9.8 KB, and that figure is wrong —
// splitting this route also lifts `jsx-runtime` and `preload-helper` out into
// their own files, which `index.html` still fetches at boot. Anyone re-measuring
// this should sum the boot files, not read the `index-*.js` line.
//
// Named export, so the module is unwrapped to a default here rather than given
// a default export it has no other use for.
const YouScreen = lazy(() =>
  import('./features/journey/components/YouScreen').then((m) => ({ default: m.YouScreen })),
);

// "locating" and "granted" plus the three ways a location request can fail.
// Kept distinct because each failure needs different wording and a different
// fix from the user — a denial is a settings change, a timeout is worth a retry.
export type LocStatus = "locating" | "granted" | LocationErrorKind;

function MainApp() {
  const [result, setResult] = useState<any>(null);
  const [activeJourney, setActiveJourney] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>("locating");

  const navigate = useNavigate();
  const location = useLocation();

  const journeySession = useJourneySession(activeJourney ? result : null);

  const requestLocation = useCallback(() => {
    setLocStatus("locating");
    LocationService.getCurrentPosition(
      (pos) => { setCoords(pos); setLocStatus("granted"); },
      (kind) => { setCoords(null); setLocStatus(kind); }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const nearest = useMemo(() => {
    if (!coords) return null;
    let best = null, bestDist = Infinity;
    for (const s of STATIONS) {
      if (s.lat == null || s.lng == null) continue;
      const d = haversineKm(coords, { lat: s.lat, lng: s.lng });
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best ? { ...best, distanceKm: bestDist } : null;
  }, [coords]);

  const locFailed = locStatus === "denied" || locStatus === "unavailable" || locStatus === "timeout";
  const nearestOrFallback = nearest || (locFailed ? { ...STATION_BY_ID["old-high-court"], distanceKm: null } : null);

  function handlePlan(source: any, dest: any, config?: any) {
    const srcArg = source.isPlace ? source : (source.id || source);
    const destArg = dest.isPlace ? dest : (dest.id || dest);
    
    // Local write, not awaited: planning must not wait on IndexedDB, and a
    // failed history write is never a reason to fail the journey the rider
    // actually asked for. Eviction to 5 and the sync queue are handled inside
    // `recordRecentTrip` (§5.7).
    const key = `${source.id || source.name}->${dest.id || dest.name}`;
    void recordRecentTrip({ key, source, dest })
      .then(() => syncNow())
      .catch(() => { /* history is best-effort */ });

    // `config` already carries the rider's pace (§8.1 phase E) — merged in by
    // `HomeScreen`, which is the only caller and holds the preference anyway.
    // The shell doesn't subscribe to it: a `prefs` observer here would re-render
    // the whole route tree, map included, for a value it only forwards.
    const r = planJourney(srcArg, destArg, config);
    setResult(r);
    setActiveJourney(false);
    // No route navigation needed — the planned route renders in HomeScreen's
    // sheet and on its map. Ensure we're on "/" so the map is mounted.
    if (location.pathname !== "/") navigate("/");
  }
  function handleBack() { setResult(null); setActiveJourney(false); }

  // No tab bar — --nav-h is always 0.
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-h', '0px');
  }, []);

  // Import pre-Dexie `localStorage` data once (§5.7). Deliberately not awaited
  // before first paint: an IndexedDB read on the boot path is exactly what a
  // map-first app can't afford, and every reader is a `useLiveQuery` that
  // re-renders the moment the rows land.
  useEffect(() => {
    void migrateFromLocalStorage().catch(() => { /* nothing to recover; local data is untouched */ });
  }, []);

  // The map + sheet stay mounted through planning and live journeys, so
  // HomeScreen always hosts them and reflects journey state in its sheet — the
  // live journey now lives inside the sheet too, expanding in place rather than
  // taking over the screen.
  const homeProps = {
    coords,
    nearest: nearestOrFallback,
    locStatus,
    onRetryLocation: requestLocation,
    onPlan: handlePlan,
    result,
    activeJourney,
    session: journeySession,
    onStartJourney: (_idx: number, currentResult: any) => {
      setResult(currentResult);
      setActiveJourney(true);
    },
    onClearResult: handleBack,
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col transition-colors duration-300"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'var(--font-app)' }}
    >
      <div className="w-full flex-1 relative flex flex-col">
        <main className="flex-1 overflow-y-auto">
          {/* Sits inside <main> so its walk up the tree passes the two elements
              that could own the page scroll. */}
          <ScrollReset />
          {/* Applies the stored language once IndexedDB is read, and again when
              one syncs down from another device. A leaf for the same reason
              ScrollReset is: its `useLiveQuery` must not re-render the route
              tree, and i18next notifies the text components itself (§6.1). */}
          <LanguageSync />
          {/* This used to be wrapped in `animate-in fade-in duration-300`,
              which generated no CSS — the project is on Tailwind v4 with no
              animate plugin, so the fade never happened for anyone. It is
              deleted rather than reimplemented, because neither reading of it
              is something we want: as written it sits outside `<Routes>` and
              would fade the whole app in once at boot, delaying the first frame
              on the boot path §5.6 exists to protect; and a real per-route
              transition needs `AnimatePresence` keyed on the path, which would
              unmount `HomeScreen` on every navigation and tear down the map and
              sheet this shell keeps mounted on purpose (§4.1). */}
          <Routes>
            <Route path="/" element={<HomeScreen {...homeProps} />} />
            <Route path="/stations/:id" element={<StationDetail />} />
            <Route
              path="/you"
              element={
                <Suspense fallback={<YouScreenFallback />}>
                  <YouScreen />
                </Suspense>
              }
            />
            <Route
              path="/you/:topic"
              element={
                <Suspense fallback={<InfoPageFallback />}>
                  <InfoPage />
                </Suspense>
              }
            />
            <Route path="*" element={<HomeScreen {...homeProps} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          {/* A leaf, for the reason ScrollReset and LanguageSync are: it reads
              the location to attribute a route (§8.2 phase A) and must not
              re-render the route tree — map included — to do it. */}
          <Insights />
          <MainApp />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
