import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Dashboard } from './features/journey/components/Dashboard';
import { Planner } from './features/journey/components/Planner';
import { ResultsScreen } from './features/journey/components/ResultsScreen';
import { LiveJourneyScreen } from './features/journey/components/LiveJourneyScreen';
import { MinimizedJourneyBar } from './features/journey/components/MinimizedJourneyBar';
import { LocationService } from './services/LocationService';
import { STATIONS, haversineKm, planJourney, STATION_BY_ID } from './features/journey/engine/journeyEngine';
import { StationsDirectory } from './features/journey/components/StationsDirectory';
import { StationDetail } from './features/journey/components/StationDetail';
import { YouScreen } from './features/journey/components/YouScreen';
import { MapScreen } from './features/map/components/MapScreen';
import { ThemeProvider } from './contexts/ThemeContext';
import { Home, Compass, Map as MapIcon, Navigation, User } from 'lucide-react';

function MainApp() {
  const [result, setResult] = useState<any>(null);
  const [activeJourney, setActiveJourney] = useState(false);
  const [activeJourneyOptionIdx, setActiveJourneyOptionIdx] = useState(0);
  const [isJourneyMinimized, setIsJourneyMinimized] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState("locating");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    LocationService.getCurrentPosition(
      (pos) => { setCoords(pos); setLocStatus("granted"); },
      () => setLocStatus("denied")
    );
  }, []);

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

  const nearestOrFallback = nearest || (locStatus === "denied" ? { ...STATION_BY_ID["old-high-court"], distanceKm: null } : null);

  function handlePlan(source: any, dest: any, config?: any) {
    // If the object passed has an 'id' and 'isPlace' is false/undefined, we could pass it or pass its ID.
    // We updated journeyEngine to accept the full object if it's a PlaceNode, or the string ID if it's a station.
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
    if (location.pathname !== "/go") navigate("/go");
  }
  function handlePlanFromHere() { setResult(null); setActiveJourney(false); setIsJourneyMinimized(false); navigate("/go"); }
  function handleBack() { setResult(null); setActiveJourney(false); setIsJourneyMinimized(false); }

  const showTabBar = !result || (activeJourney && isJourneyMinimized);

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/go", label: "Go", icon: Compass },
    { path: "/map", label: "Map", icon: MapIcon },
    { path: "/stations", label: "Stations", icon: Navigation },
    { path: "/you", label: "You", icon: User },
  ];

  return (
    <div
      className="min-h-screen w-full flex flex-col transition-colors duration-300"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div className="w-full flex-1 relative flex flex-col">
        <main className={`flex-1 overflow-y-auto ${showTabBar ? 'pb-20' : ''}`}>
        {result ? (
          activeJourney ? (
            !isJourneyMinimized ? (
              <LiveJourneyScreen 
                result={result} 
                activeOptionIdx={activeJourneyOptionIdx}
                onEnd={() => { setActiveJourney(false); setResult(null); setIsJourneyMinimized(false); }} 
                onMinimize={() => setIsJourneyMinimized(true)}
              />
            ) : (
              <>
                <div className="animate-in fade-in duration-300">
                  <Routes>
                    <Route path="/" element={<Dashboard nearest={nearestOrFallback} locStatus={locStatus} onPlanFromHere={handlePlanFromHere} onPlan={handlePlan} />} />
                    <Route path="/go" element={<Planner onPlan={handlePlan} nearest={nearestOrFallback} locStatus={locStatus} />} />
                    <Route path="/map" element={<MapScreen coords={coords} nearest={nearestOrFallback} />} />
                    <Route path="/stations" element={<StationsDirectory />} />
                    <Route path="/stations/:id" element={<StationDetail />} />
                    <Route path="/you" element={<YouScreen />} />
                  </Routes>
                </div>
                <MinimizedJourneyBar result={result} onMaximize={() => setIsJourneyMinimized(false)} />
              </>
            )
          ) : (
            <ResultsScreen result={result} onBack={handleBack} onStartJourney={(idx, currentResult) => { setResult(currentResult); setActiveJourney(true); setActiveJourneyOptionIdx(idx); setIsJourneyMinimized(false); }} />
          )
        ) : (
          <div className="animate-in fade-in duration-300">
            <Routes>
              <Route path="/" element={
                <Dashboard nearest={nearestOrFallback} locStatus={locStatus} onPlanFromHere={handlePlanFromHere} onPlan={handlePlan} />
              } />
              <Route path="/go" element={
                <Planner onPlan={handlePlan} nearest={nearestOrFallback} locStatus={locStatus} />
              } />
              <Route path="/map" element={<MapScreen coords={coords} nearest={nearestOrFallback} />} />
              <Route path="/stations" element={<StationsDirectory />} />
              <Route path="/stations/:id" element={<StationDetail />} />
              <Route path="/you" element={<YouScreen />} />
            </Routes>
          </div>
        )}
      </main>

      {showTabBar && (
        <nav
          className="fixed bottom-0 w-full border-t z-50 pb-[env(safe-area-inset-bottom)] transition-colors duration-300"
          style={{ 
            background: 'var(--c-blur)', 
            borderColor: 'var(--c-border)', 
            backdropFilter: 'blur(20px)' 
          }}
        >
          <div className="flex justify-around items-end px-2 pt-3 pb-4 mx-auto" style={{ maxWidth: 'var(--layout-max-width)' }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center gap-1.5 flex-1 relative group transition-all duration-200"
                >
                  {isActive && (
                    <span className="absolute -top-3 w-8 h-0.5 bg-yellow-400 rounded-b-full" />
                  )}
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="transition-all duration-200"
                    color={isActive ? 'var(--c-accent)' : 'var(--c-text-4)'}
                  />
                  <span
                    className="text-[11px] leading-none font-semibold tracking-wide transition-all duration-200"
                    style={{ color: isActive ? 'var(--c-accent)' : 'var(--c-text-4)' }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      </div>
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
