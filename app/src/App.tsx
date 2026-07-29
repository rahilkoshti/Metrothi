import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomeScreen } from './features/journey/components/HomeScreen';
import { LocationService, type LocationErrorKind } from './services/LocationService';
import { STATIONS, haversineKm, planJourney, STATION_BY_ID } from './features/journey/engine/journeyEngine';
import { StationDetail } from './features/journey/components/StationDetail';
import { YouScreen } from './features/journey/components/YouScreen';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useJourneySession } from './features/journey/hooks/useJourneySession';
import { InfoPageFallback } from './features/info/InfoPageFallback';
import { ScrollReset } from './components/ScrollReset';
import { recordRecentTrip, migrateFromLocalStorage } from './data/db';
import { syncNow } from './services/syncEngine';

// The reference pages (§4.5.1) carry ~19 KB of GMRC prose in the two JSON files
// their topic registry imports. None of it is needed to draw a map or plan a
// journey, so the whole route is split out and fetched on first visit — after
// which the service worker has it precached and it works offline like the rest
// (§5.6).
const InfoPage = lazy(() => import('./features/info/InfoPage'));

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
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div className="w-full flex-1 relative flex flex-col">
        <main className="flex-1 overflow-y-auto">
          {/* Sits inside <main> so its walk up the tree passes the two elements
              that could own the page scroll. */}
          <ScrollReset />
          <div className="animate-in fade-in duration-300">
            <Routes>
              <Route path="/" element={<HomeScreen {...homeProps} />} />
              <Route path="/stations/:id" element={<StationDetail />} />
              <Route path="/you" element={<YouScreen />} />
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
          </div>
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
          <MainApp />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
