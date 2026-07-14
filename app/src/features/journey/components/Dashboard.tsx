import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, AlertTriangle, ArrowRight } from "lucide-react";
import { STATIONS, estimateLine, upcomingStationDepartures, formatDuration, walkMinsForKm, clockTimeAfter } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";

import { LineBadge } from "../../../components/LineBadge";
import { LINE_BADGE_BG, LINE_NAMES } from "../constants";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>
          {locStatus === "denied" ? "Default station" : "Nearest station"}
        </span>
        {nearest.distanceKm != null && (
          <span className="text-[10px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
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
            <div className="text-[10px] font-semibold mt-1 uppercase tracking-wide" style={{ color: 'var(--c-text-3)' }}>Bus only - trains resume soon</div>
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
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--c-text-3)' }}>Route</span>
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
        style={{ background: '#FACC15', color: '#000' }}
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
}

export function Dashboard({ nearest, locStatus, onPlanFromHere }: DashboardProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(STATIONS.filter((s: any) => s.name.toLowerCase().includes(q)).slice(0, 6));
  }, [query]);

  function handlePickStation(station: any) {
    setQuery(""); setResults([]); setIsFocused(false);
    navigate(`/stations/${station.id}`);
  }

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pt-10 pb-8">
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>{greeting()}</div>
        <h1 className="text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--c-text)' }}>Find a station</h1>
      </div>

      <div className="relative mb-7 z-20">
        <div
          className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-200 ${isFocused ? 'ring-1 ring-yellow-400' : ''}`}
          style={{ background: 'var(--c-card)' }}
        >
          <Search size={18} style={{ color: isFocused ? '#FACC15' : 'var(--c-text-3)' }} />
          <input
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search stations"
            placeholder="Search all stations…"
            className="border-none outline-none w-full text-[16px] font-medium bg-transparent"
            style={{ color: 'var(--c-text)' }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="p-1 rounded-full transition-colors shrink-0" style={{ color: 'var(--c-text-3)' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {results.length > 0 && isFocused && (
          <div
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
          >
            {results.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => handlePickStation(s)}
                className="flex items-center justify-between w-full p-4 text-left transition-colors"
                style={{ borderBottom: idx !== results.length - 1 ? '1px solid var(--c-border)' : 'none' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--c-card-alt)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold" style={{ color: 'var(--c-text)' }}>{s.name}</span>
                  {s.operational === false && (
                    <span className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wide">Opening Soon</span>
                  )}
                </div>
                <LineBadge line={s.line} size="xs" />
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
        {["Your commute", "Recent trips"].map((label) => (
          <div key={label} className="rounded-xl p-4 opacity-40" style={{ background: 'var(--c-card)', border: '1px dashed var(--c-border-2)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>{label}</div>
            <div className="text-xs" style={{ color: 'var(--c-text-4)' }}>Phase 4</div>
          </div>
        ))}
      </div>
    </div>
  );
}
