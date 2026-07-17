import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, AlertTriangle, ArrowRight, MapPin, Star, History } from "lucide-react";
import { STATIONS, estimateLine, upcomingStationDepartures, formatDuration, walkMinsForKm, clockTimeAfter } from "../engine/journeyEngine";
import type { PlaceNode } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";
import { GeocodingService } from "../../../services/GeocodingService";

import { LineBadge } from "../../../components/LineBadge";
import { LINE_BADGE_BG, LINE_NAMES } from "../constants";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fuzzySearch(query: string, items: any[], keyFn: (item: any) => string) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return items.slice(0, 6);
  
  const scored = items.map(item => {
    const target = keyFn(item).toLowerCase();
    const targetNoSpace = target.replace(/\s+/g, "");
    let score = -1;
    if (target === query.toLowerCase()) score = 100;
    else if (target.startsWith(query.toLowerCase())) score = 80;
    else if (target.includes(query.toLowerCase())) score = 50;
    else {
      let qIdx = 0;
      for (let i = 0; i < targetNoSpace.length && qIdx < q.length; i++) {
        if (targetNoSpace[i] === q[qIdx]) {
          qIdx++;
          if (qIdx === q.length) break;
        }
      }
      if (qIdx === q.length) score = 10;
    }
    return { item, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item)
    .slice(0, 6);
}

function NearbyCard({ nearest, locStatus, onPlanFromHere, onOpenStation, onOpenTrain }: {
  nearest: any;
  locStatus: string;
  onPlanFromHere: () => void;
  onOpenStation: () => void;
  onOpenTrain: (line: string, destName: string) => void;
}) {
  const now = useNow();
  const status = useMemo(() => {
    if (!nearest) return null;
    return estimateLine(nearest.line, now);
  }, [nearest, now]);

  const schedule = useMemo(() => {
    if (!nearest) return [];
    return upcomingStationDepartures(nearest.id, nearest.line, now, 2);
  }, [nearest, now]);

  if (locStatus === "locating") {
    return (
      <div className="rounded-2xl p-5 mb-6 animate-pulse" style={{ background: 'var(--c-card)' }}>
        <div className="h-4 w-24 rounded mb-3" style={{ background: 'var(--c-card-alt)' }} />
        <div className="h-8 w-3/4 rounded" style={{ background: 'var(--c-card-alt)' }} />
      </div>
    );
  }

  if (!nearest) return null;

  return (
    <div
      className="rounded-2xl p-5 mb-6 relative overflow-hidden flex flex-col cursor-pointer active:opacity-80 transition-opacity"
      style={{ background: 'var(--c-card)' }}
      onClick={onOpenStation}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenStation()}
    >
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl z-20" style={{ background: LINE_BADGE_BG[nearest.line] }} />

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>
          {locStatus === "denied" ? "Default station" : "Nearest station"}
        </span>
        {nearest.distanceKm != null && (
          <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
            · {Math.round(nearest.distanceKm * 1000)}m · {formatDuration(walkMinsForKm(nearest.distanceKm))} walk
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight leading-none mb-2" style={{ color: 'var(--c-text)' }}>
            {nearest.name}
          </h2>
          <div className="flex items-center gap-2">
            <LineBadge line={nearest.line} size="md" />
            {nearest.secondLine && <LineBadge line={nearest.secondLine} size="md" />}
            {nearest.interchange && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: 'var(--c-text-3)', border: '1px solid var(--c-border-2)' }}>
                Interchange
              </span>
            )}
          </div>
        </div>

        {status?.status === "after-last-train" && (
          <div className="p-3 rounded-xl border" style={{ background: 'var(--c-card-alt)', borderColor: 'var(--c-border-2)' }}>
            <div className="text-sm font-bold" style={{ color: 'var(--c-text-3)' }}>Service ended for today</div>
          </div>
        )}
        
        {status?.status === "bus-only" && (
          <div className="p-3 rounded-xl border" style={{ background: 'var(--c-card-alt)', borderColor: 'var(--c-border-2)' }}>
            <div className="text-xl font-bold text-purple-400 leading-none">{formatDuration(status.resumesInMins!)}</div>
            <div className="text-[11px] font-semibold mt-1 uppercase tracking-wide" style={{ color: 'var(--c-text-3)' }}>Bus only - trains resume soon</div>
          </div>
        )}

        {(status?.status === "running" || status?.status === "before-first-train") && schedule.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            {schedule.map((dir, i) => (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className="flex justify-between items-center p-3 rounded-xl border cursor-pointer active:opacity-70 transition-opacity"
                style={{ background: 'var(--c-card-alt)', borderColor: 'var(--c-border-2)' }}
                onClick={(e) => { e.stopPropagation(); onOpenTrain(nearest.line, dir.destination); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenTrain(nearest.line, dir.destination); } }}
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--c-text-3)' }}>Route</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                    {nearest.name} <span className="opacity-50 mx-0.5">→</span> {dir.destination}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  {dir.departures.map((dep, j) => {
                    const isUpcoming = j === 0;
                    return (
                      <div
                        key={j}
                        className="flex flex-col items-center rounded-xl px-2.5 py-2"
                        style={isUpcoming ? {
                          background: LINE_BADGE_BG[nearest.line],
                          minWidth: 72,
                        } : {
                          border: '1px solid var(--c-border-2)',
                          minWidth: 58,
                          opacity: 0.75,
                        }}
                      >
                        <span
                          className="font-bold tabular-nums leading-none"
                          style={{
                            fontSize: isUpcoming ? 17 : 13,
                            color: isUpcoming
                              ? (nearest.line === 'yellow' ? '#000' : '#fff')
                              : 'var(--c-text-2)',
                          }}
                        >
                          {clockTimeAfter(now, dep.waitMins)}
                        </span>
                        <span
                          className="font-semibold tabular-nums mt-1 leading-none"
                          style={{
                            fontSize: isUpcoming ? 10 : 9,
                            color: isUpcoming
                              ? (nearest.line === 'yellow' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)')
                              : 'var(--c-text-4)',
                          }}
                        >
                          {dep.waitMins === 0 ? 'Due now' : `in ${formatDuration(dep.waitMins)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onPlanFromHere(); }}
        className="w-full py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
        style={{ background: 'var(--c-accent)', color: '#000' }}
      >
        Plan trip from here <ArrowRight size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ServiceStatusStrip() {
  const now = useNow();
  const lines = ["blue", "red", "yellow", "violet"];
  const degraded = lines
    .map((line) => ({ line, est: estimateLine(line, now) }))
    .filter(({ est }) => est.status !== "running");

  if (degraded.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {degraded.map(({ line, est }) => {
        let msg = "";
        if (est.status === "after-last-train") msg = "Service ended for today";
        else if (est.status === "before-first-train") msg = `Starts in ${formatDuration(est.minsUntilFirst!)}`;
        else if (est.status === "bus-only") msg = `Bus only — trains in ${formatDuration(est.resumesInMins!)}`;
        return (
          <div key={line} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--c-card)' }}>
            <AlertTriangle size={14} className="shrink-0 text-yellow-500" />
            <LineBadge line={line} size="xs" />
            <span className="text-xs font-semibold" style={{ color: 'var(--c-text-2)' }}>{LINE_NAMES[line]}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--c-text-3)' }}>{msg}</span>
          </div>
        );
      })}
    </div>
  );
}

interface DashboardProps {
  nearest: any;
  locStatus: string;
  onPlanFromHere: () => void;
  onPlan: (source: any, dest: any) => void;
}

export function Dashboard({ nearest, locStatus, onPlanFromHere, onPlan }: DashboardProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [places, setPlaces] = useState<PlaceNode[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Local storage state for Recents and Favorites
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);
  
  useEffect(() => {
    try {
      setRecentTrips(JSON.parse(localStorage.getItem("metrothi-recent-trips") || "[]"));
    } catch { /* ignore */ }
    try {
      setSavedJourneys(JSON.parse(localStorage.getItem("metrothi-saved-journeys") || "[]"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setPlaces([]); return; }
    setResults(fuzzySearch(query, STATIONS.filter((s: any) => s.operational !== false), (s: any) => s.name));
    
    if (query.trim().length >= 3) {
      const timer = setTimeout(async () => {
        try {
          const res = await GeocodingService.searchPlaces(query);
          setPlaces(res);
        } catch (e) {
          setPlaces([]);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setPlaces([]);
    }
  }, [query]);

  const combinedResults = useMemo(() => [...results, ...places], [results, places]);

  function handlePickDestination(item: any) {
    setQuery(""); setResults([]); setPlaces([]); setIsFocused(false);
    navigate(`/go`, { state: { prefillDest: item } });
  }

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pt-10 pb-8">
      <div className="mb-7">
        <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>{greeting()}</div>
        <h1 className="text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--c-text)' }}>Where to?</h1>
      </div>

      <div className="relative mb-7 z-20">
        <div
          className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-200 ${isFocused ? 'ring-1 ring-yellow-400' : ''}`}
          style={{ background: 'var(--c-card)' }}
        >
          <Search size={18} style={{ color: isFocused ? 'var(--c-accent)' : 'var(--c-text-3)' }} />
          <input
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search destination"
            placeholder="Search stations and places…"
            className="border-none outline-none w-full text-[16px] font-medium bg-transparent"
            style={{ color: 'var(--c-text)' }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setPlaces([]); }} className="p-1 rounded-full transition-colors shrink-0" style={{ color: 'var(--c-text-3)' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {combinedResults.length > 0 && isFocused && (
          <div
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
          >
            {combinedResults.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => handlePickDestination(s)}
                className="flex items-center gap-4 w-full p-4 text-left transition-colors hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)] focus-visible:outline-none"
                style={{ borderBottom: idx !== combinedResults.length - 1 ? '1px solid var(--c-border)' : 'none' }}
              >
                {s.isPlace ? (
                  <div className="w-6 flex justify-center"><MapPin size={18} style={{ color: 'var(--c-text-3)' }} /></div>
                ) : (
                  <div className="w-6 flex justify-center"><LineBadge line={s.line} size="xs" /></div>
                )}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[15px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>{s.name}</span>
                  {s.isPlace && (
                    <span className="text-[12px] truncate" style={{ color: 'var(--c-text-3)' }}>{s.address}</span>
                  )}
                  {s.operational === false && (
                    <span className="text-[11px] font-semibold text-yellow-600 uppercase tracking-wide">Opening Soon</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <NearbyCard
        nearest={nearest}
        locStatus={locStatus}
        onPlanFromHere={onPlanFromHere}
        onOpenStation={() => nearest && navigate(`/stations/${nearest.id}`)}
        onOpenTrain={(line, destName) => nearest && navigate(`/stations/${nearest.id}`, { state: { openLine: line, openDirDest: destName } })}
      />
      <ServiceStatusStrip />

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--c-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} style={{ color: 'var(--c-accent)' }} />
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Your commute</div>
          </div>
          {savedJourneys.length > 0 ? (
            <div className="flex flex-col gap-2">
              {savedJourneys.map(j => (
                <button
                  key={j.key}
                  onClick={() => onPlan(STATIONS.find(s => s.id === j.sourceId) || j.sourceId, STATIONS.find(s => s.id === j.destId) || j.destId)}
                  className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold truncate" style={{ color: 'var(--c-text)' }}>{j.destName || j.destId}</span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--c-text-3)' }}>from {j.sourceName || j.sourceId}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[12px] opacity-50" style={{ color: 'var(--c-text)' }}>No saved trips yet. Save a trip to see it here.</div>
          )}
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--c-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <History size={14} style={{ color: 'var(--c-text-3)' }} />
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Recent trips</div>
          </div>
          {recentTrips.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recentTrips.slice(0, 3).map(j => (
                <button
                  key={j.key}
                  onClick={() => onPlan(j.source, j.dest)}
                  className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold truncate" style={{ color: 'var(--c-text)' }}>{j.dest.name}</span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--c-text-3)' }}>from {j.source.name}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[12px] opacity-50" style={{ color: 'var(--c-text)' }}>Your recent trips will appear here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
