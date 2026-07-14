import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpDown, LocateFixed, ArrowRight, MapPin } from "lucide-react";
import { StationInput } from "./StationInput";
import { STATIONS, estimateLine, nextDepartureFromStation, formatDuration, walkMinsForKm } from "../engine/journeyEngine";
import type { PlaceNode } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";
import { GeocodingService } from "../../../services/GeocodingService";

import { LineBadge } from "../../../components/LineBadge";

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

interface PlannerProps {
  onPlan: (sourceId: string | PlaceNode, destId: string | PlaceNode) => void;
  nearest: any;
  locStatus: string;
}

export function Planner({ onPlan, nearest, locStatus }: PlannerProps) {
  const location = useLocation();
  const prefillSourceId = location.state?.prefillSource;
  const prefillDestId = location.state?.prefillDest;

  const [source, setSource] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [sourceIsAuto, setSourceIsAuto] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceNode[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Reset focusedIndex when query or active field changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [sourceQuery, destQuery, activeField]);

  useEffect(() => {
    if (prefillSourceId) {
      const stn = STATIONS.find(s => s.id === prefillSourceId);
      if (stn) { setSource(stn); setSourceQuery(stn.name); setSourceIsAuto(false); }
    } else if (nearest && sourceIsAuto) {
      setSource(nearest); setSourceQuery(nearest.name);
    }
    if (prefillDestId) {
      const stn = STATIONS.find(s => s.id === prefillDestId);
      if (stn) { setDestination(stn); setDestQuery(stn.name); }
    }
  }, [nearest, sourceIsAuto, prefillSourceId, prefillDestId]);

  const activeQuery = activeField === "source" ? sourceQuery : activeField === "destination" ? destQuery : "";
  const results = useMemo(() => {
    if (!activeField || !activeQuery.trim()) return [];
    return fuzzySearch(activeQuery, STATIONS.filter(s => s.operational !== false), s => s.name);
  }, [activeField, activeQuery]);

  useEffect(() => {
    if (!activeField || activeQuery.trim().length < 3) {
      setPlaces([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      const res = await GeocodingService.searchPlaces(activeQuery);
      setPlaces(res);
      setIsSearchingPlaces(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [activeQuery, activeField]);

  function pickResult(s: any) {
    if (activeField === "source") { setSource(s); setSourceQuery(s.name); setSourceIsAuto(false); }
    else { setDestination(s); setDestQuery(s.name); }
    setActiveField(null);
  }

  function handleSwap(e: React.MouseEvent) {
    e.stopPropagation();
    const s = source, d = destination, sq = sourceQuery, dq = destQuery;
    setSource(d); setDestination(s); setSourceQuery(dq); setDestQuery(sq); setSourceIsAuto(false);
  }

  const combinedResults = useMemo(() => [...results, ...places], [results, places]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!activeField || combinedResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, combinedResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < combinedResults.length) {
        pickResult(combinedResults[focusedIndex]);
      } else if (results.length > 0) {
        pickResult(results[0]);
      }
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  }

  const sameStation = source && destination && source.id === destination.id;
  const canPlan = source && destination && !sameStation;

  const now = useNow();
  const sourceStatus = useMemo(() => {
    if (!source || source.isPlace) return null;
    // Once a destination station is picked, prefer the direction-aware
    // estimate the planner itself will use, so this preview can't disagree
    // with the results screen.
    if (destination && !destination.isPlace && destination.id !== source.id) {
      return nextDepartureFromStation(source.id, destination.id, now);
    }
    return estimateLine(source.line, now);
  }, [source, destination, now]);

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pt-10 flex flex-col min-h-[calc(100vh-80px)]" onClick={() => setActiveField(null)}>
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>Journey Planner</div>
        <h1 className="text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--c-text)' }}>Where to?</h1>
      </div>

      <div
        className="relative rounded-2xl p-2 mb-5 z-20"
        style={{ background: 'var(--c-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2">
          <StationInput
            label="From" value={sourceQuery} isAuto={sourceIsAuto}
            onFocus={() => setActiveField("source")}
            onChange={(v) => { setSourceQuery(v); setSourceIsAuto(false); setActiveField("source"); if (source && v !== source.name) setSource(null); }}
            onClear={() => { setSourceQuery(""); setSource(null); setSourceIsAuto(false); setActiveField("source"); }}
            onKeyDown={handleKeyDown}
          />
          <div style={{ height: '1px', background: 'var(--c-border)', margin: '0 4px' }} />
          <StationInput
            label="To" value={destQuery}
            onFocus={() => setActiveField("destination")}
            onChange={(v) => { setDestQuery(v); setActiveField("destination"); if (destination && v !== destination.name) setDestination(null); }}
            onClear={() => { setDestQuery(""); setDestination(null); setActiveField("destination"); }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          onClick={handleSwap}
          disabled={!source && !destination}
          aria-label="Swap"
          className="absolute right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-110 active:scale-95"
          style={{ background: 'var(--c-card-alt)', color: 'var(--c-text-2)' }}
        >
          <ArrowUpDown size={16} strokeWidth={2.5} />
        </button>

        {activeField && (results.length > 0 || places.length > 0) && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+8px)] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[60vh] overflow-y-auto"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
          >
            {results.length > 0 && (
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">Stations</div>
            )}
            {results.map((s: any, idx: number) => {
              const isFocused = idx === focusedIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => pickResult(s)}
                  className="flex items-center justify-between w-full p-4 text-left transition-colors"
                  style={{ 
                    borderBottom: '1px solid var(--c-border)',
                    background: isFocused ? 'var(--c-card-alt)' : 'transparent'
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                >
                  <span className="text-[15px] font-semibold" style={{ color: 'var(--c-text)' }}>{s.name}</span>
                  <LineBadge line={s.line} />
                </button>
              );
            })}

            {activeQuery.length >= 3 && (
              <div className="px-4 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">
                <span>Places</span>
                {isSearchingPlaces && <span className="animate-pulse text-blue-500">Searching...</span>}
              </div>
            )}
            {places.map((p, idx) => {
              const isFocused = (idx + results.length) === focusedIndex;
              return (
                <button
                  key={p.id}
                  onClick={() => pickResult(p)}
                  className="flex items-center gap-3 w-full p-4 text-left transition-colors"
                  style={{ 
                    borderBottom: '1px solid var(--c-border)',
                    background: isFocused ? 'var(--c-card-alt)' : 'transparent'
                  }}
                  onMouseEnter={() => setFocusedIndex(idx + results.length)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>{p.name}</div>
                    <div className="text-[11px] text-neutral-500 truncate">Select to find nearest station</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2.5 mb-6 px-1">
        {locStatus === "denied" && sourceIsAuto && (
          <div className="flex items-center gap-2 text-xs font-semibold text-yellow-600 p-3 rounded-xl" style={{ background: 'rgba(250,204,21,0.08)' }}>
            <LocateFixed size={13} /> Location off — showing default station
          </div>
        )}
        {sourceIsAuto && nearest?.distanceKm != null && (
          <div className="text-xs font-medium flex items-center gap-2 px-1" style={{ color: 'var(--c-text-3)' }}>
            <span>~{Math.round(nearest.distanceKm * 1000)}m away</span>
            <span>·</span>
            <span>{formatDuration(walkMinsForKm(nearest.distanceKm))} walk</span>
          </div>
        )}
        {sourceStatus?.status === "running" && (
          <div className="flex items-center gap-2 text-xs font-semibold p-3 rounded-xl text-green-600" style={{ background: 'rgba(74,222,128,0.06)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Next train in <strong>{formatDuration(sourceStatus.waitMins!)}</strong>
            <span className="ml-auto opacity-60">every {formatDuration(sourceStatus.currentFrequencyMins!)}</span>
          </div>
        )}
        {sourceStatus?.status === "before-first-train" && (
          <div className="text-xs font-semibold p-3 rounded-xl" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
            Service starts in {formatDuration(sourceStatus.minsUntilFirst!)}
          </div>
        )}
        {sourceStatus?.status === "after-last-train" && (
          <div className="text-xs font-bold p-3 rounded-xl" style={{ background: 'var(--c-card)', color: 'var(--c-text-3)' }}>
            Service has ended for today
          </div>
        )}
        {sourceStatus?.status === "bus-only" && (
          <div className="text-xs font-semibold p-3 rounded-xl text-purple-400" style={{ background: 'rgba(168,85,247,0.06)' }}>
            Bus service only — trains resume in {formatDuration(sourceStatus.resumesInMins!)}
          </div>
        )}
        {sameStation && (
          <div className="text-sm font-semibold p-3 rounded-xl text-center text-red-400" style={{ background: 'rgba(239,68,68,0.06)' }}>
            Please select different stations
          </div>
        )}
      </div>

      <div className="mt-auto">
        <button
          disabled={!canPlan}
          onClick={() => canPlan && onPlan(source, destination)}
          className="w-full py-4 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          style={canPlan
            ? { background: '#FACC15', color: '#000' }
            : { background: 'var(--c-card)', color: 'var(--c-text-4)', cursor: 'not-allowed' }
          }
        >
          View Route Options <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
