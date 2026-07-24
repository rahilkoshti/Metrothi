import { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomeScreen } from './features/journey/components/HomeScreen';
import { LiveJourneyScreen } from './features/journey/components/LiveJourneyScreen';
import { LocationService, type LocationErrorKind } from './services/LocationService';
import { STATIONS, haversineKm, planJourney, STATION_BY_ID } from './features/journey/engine/journeyEngine';
import { StationDetail } from './features/journey/components/StationDetail';
import { YouScreen } from './features/journey/components/YouScreen';
import { ThemeProvider } from './contexts/ThemeContext';
import { useJourneySession } from './features/journey/hooks/useJourneySession';

// "locating" and "granted" plus the three ways a location request can fail.
// Kept distinct because each failure needs different wording and a different
// fix from the user — a denial is a settings change, a timeout is worth a retry.
export type LocStatus = "locating" | "granted" | LocationErrorKind;

function MainApp() {
  const [result, setResult] = useState<any>(null);
  const [activeJourney, setActiveJourney] = useState(false);
  const [activeJourneyOptionIdx, setActiveJourneyOptionIdx] = useState(0);
  const [isJourneyMinimized, setIsJourneyMinimized] = useState(false);
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
    
    try {
      const arr = JSON.parse(localStorage.getItem("metrothi-recent-trips") || "[]");
      const key = `${source.id || source.name}->${dest.id || dest.name}`;
      const next = [
        { key, source, dest, savedAt: Date.now() },
        ...arr.filter((j: any) => j.key !== key)
      ].slice(0, 5);
      localStorage.setItem("metrothi-recent-trips", JSON.stringify(next));
    } catch { /* ignore */ }

    const r = planJourney(srcArg, destArg, config);
    setResult(r);
    setActiveJourney(false);
    setIsJourneyMinimized(false);
    // No route navigation needed — the planned route renders in HomeScreen's
    // sheet and on its map. Ensure we're on "/" so the map is mounted.
    if (location.pathname !== "/") navigate("/");
  }
  function handleBack() { setResult(null); setActiveJourney(false); setIsJourneyMinimized(false); }

  // No tab bar — --nav-h is always 0.
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-h', '0px');
  }, []);

  // The map + sheet stay mounted through planning and (minimized) live journeys,
  // so HomeScreen always hosts them and reflects journey state in its sheet.
  const homeProps = {
    coords,
    nearest: nearestOrFallback,
    locStatus,
    onRetryLocation: requestLocation,
    onPlan: handlePlan,
    result,
    activeJourney,
    session: journeySession,
    onStartJourney: (idx: number, currentResult: any) => {
      setResult(currentResult);
      setActiveJourney(true);
      setActiveJourneyOptionIdx(idx);
      // Land on the sheet's live summary over the map; the user expands it to
      // open the full-screen live view.
      setIsJourneyMinimized(true);
    },
    onClearResult: handleBack,
    onMaximizeLive: () => setIsJourneyMinimized(false),
  };

  // The rich live view overlays the still-mounted map when maximized.
  const showLive = activeJourney && !isJourneyMinimized;

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col transition-colors duration-300"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div className="w-full flex-1 relative flex flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="animate-in fade-in duration-300">
            <Routes>
              <Route path="/" element={<HomeScreen {...homeProps} />} />
              <Route path="/stations/:id" element={<StationDetail />} />
              <Route path="/you" element={<YouScreen />} />
              <Route path="*" element={<HomeScreen {...homeProps} />} />
            </Routes>
          </div>
        </main>
      </div>

      {showLive && result && (
        <div className="fixed inset-0 z-[1200] overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
          <LiveJourneyScreen
            result={result}
            activeOptionIdx={activeJourneyOptionIdx}
            onEnd={() => { setActiveJourney(false); setResult(null); setIsJourneyMinimized(false); }}
            onMinimize={() => setIsJourneyMinimized(true)}
            session={journeySession}
          />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <MainApp />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
