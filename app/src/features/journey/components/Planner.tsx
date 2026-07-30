import { useState, useMemo, useEffect } from "react";
import { ArrowUpDown, ArrowRight, MapPin, History, Clock, ChevronDown, X } from "lucide-react";
import { StationInput } from "./StationInput";
import { STATIONS, estimateLine, nextDepartureFromStation, formatDuration, walkMinsForKm } from "../engine/journeyEngine";
import type { PlaceNode } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useWalkSpeed, useDefaultDeparture } from "../hooks/usePreferences";
import { GeocodingService } from "../../../services/GeocodingService";

import { LineBadge } from "../../../components/LineBadge";
import { LocationNotice } from "../../../components/LocationNotice";
import type { LocStatus } from "../../../App";

import { fuzzySearch } from "../utils/fuzzySearch";
import { formatModeList, stationModes, stationSearchKeywords } from "../stationFacilities";
import { useLiveQuery } from "dexie-react-hooks";
import { listRecentTrips, removeRecentTrip, type RecentTrip } from "../../../data/db";
import { syncNow } from "../../../services/syncEngine";

interface PlannerProps {
  onPlan: (sourceId: string | PlaceNode, destId: string | PlaceNode, timeConfig?: { queryTime?: Date, arriveBy?: boolean }) => void;
  nearest: any;
  locStatus: LocStatus;
  onRetryLocation: () => void;
  prefillSource?: any;
  prefillDest?: any;
}

export function Planner({ onPlan, nearest, locStatus, onRetryLocation, prefillSource, prefillDest: prefillDestProp }: PlannerProps) {
  const prefillSourceId = prefillSource;
  const prefillDestId = prefillDestProp;

  const [source, setSource] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [sourceIsAuto, setSourceIsAuto] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceNode[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const online = useOnlineStatus();

  const [timeMode, setTimeMode] = useState<'now' | 'depart' | 'arrive'>('now');
  const [timeExpanded, setTimeExpanded] = useState(false);
  const [timeStr, setTimeStr] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  // Live from Dexie (§5.7), so planning a trip on the home sheet updates this
  // list without the planner having to be remounted to notice.
  const recentTrips = useLiveQuery(listRecentTrips, [], [] as RecentTrip[]);
  const { walkSpeedKmh } = useWalkSpeed();

  // A default departure station outranks GPS but not an explicit "From here"
  // (§8.1 phase E). The hook resolves the id and reads an unknown one as unset,
  // so a stale pref synced from a build with different data can't land here as
  // an empty source field.
  const { defaultDeparture } = useDefaultDeparture();

  function fillFromTrip(trip: any) {
    if (trip.source) { setSource(trip.source); setSourceQuery(trip.source.name ?? ''); setSourceIsAuto(false); }
    if (trip.dest) { setDestination(trip.dest); setDestQuery(trip.dest.name ?? ''); }
    setActiveField(null);
  }

  function removeTrip(e: React.MouseEvent, key: string) {
    e.stopPropagation();
    // No local filtered copy to keep in step — `useLiveQuery` re-renders off the
    // tombstone the write leaves behind.
    void removeRecentTrip(key).then(() => syncNow());
  }

  // Reset focusedIndex when query or active field changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [sourceQuery, destQuery, activeField]);

  useEffect(() => {
    if (prefillSourceId) {
      const stn = STATIONS.find(s => s.id === prefillSourceId);
      if (stn) { setSource(stn); setSourceQuery(stn.name); setSourceIsAuto(false); }
    } else if (defaultDeparture && sourceIsAuto) {
      // The rider said where they usually start, so don't wait on GPS or
      // overwrite their answer when it arrives.
      setSource(defaultDeparture); setSourceQuery(defaultDeparture.name);
    } else if (nearest && sourceIsAuto) {
      setSource(nearest); setSourceQuery(nearest.name);
    }
    if (prefillDestId) {
      if (typeof prefillDestId === 'string') {
        const stn = STATIONS.find(s => s.id === prefillDestId);
        if (stn) { setDestination(stn); setDestQuery(stn.name); }
      } else {
        setDestination(prefillDestId); setDestQuery(prefillDestId.name);
      }
    }
  }, [nearest, sourceIsAuto, prefillSourceId, prefillDestId, defaultDeparture]);

  const activeQuery = activeField === "source" ? sourceQuery : activeField === "destination" ? destQuery : "";
  const results = useMemo(() => {
    if (!activeField || !activeQuery.trim()) return [];
    // Modes ride along as hidden keywords (§4.4): "railway" is how a visitor
    // names Kalupur as a destination before they know it's called Kalupur.
    return fuzzySearch(
      activeQuery,
      STATIONS.filter(s => s.operational !== false),
      s => s.name,
      s => stationSearchKeywords(s.id),
    );
  }, [activeField, activeQuery]);

  useEffect(() => {
    if (!activeField || activeQuery.trim().length < 3) {
      setPlaces([]);
      setPlacesError(null);
      return;
    }
    // Place lookup needs the network; station search above works offline. Skip
    // the doomed fetch when offline and surface the reason immediately.
    if (!online) {
      setPlaces([]);
      setPlacesError(
        "You're offline — place search needs a connection. Metro stations still search normally above."
      );
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      setPlacesError(null);
      try {
        const res = await GeocodingService.searchPlaces(activeQuery);
        setPlaces(res);
      } catch (e) {
        setPlaces([]);
        setPlacesError("Place search is unavailable right now");
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [activeQuery, activeField, online]);

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
  const showSuggestions = !!activeField && (results.length > 0 || places.length > 0 || !!placesError);

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
    if (destination && !destination.isPlace && destination.id !== source.id) {
      return nextDepartureFromStation(source.id, destination.id, now);
    }
    return estimateLine(source.line, now);
  }, [source, destination, now]);

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pt-6 flex flex-col" onClick={() => setActiveField(null)}>
      <div className="mb-7">
        <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>Journey Planner</div>
        <h1 className="text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--c-text)' }}>Where to?</h1>
      </div>

      <div
        className="relative rounded-2xl p-2 mb-5 z-20"
        style={{ background: 'var(--c-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex px-1">
          {/* Connector rail: origin dot → dotted line → destination pin. Two
              equal-height halves keep each node centred on its input row. */}
          <div className="shrink-0 w-8 flex flex-col self-stretch" aria-hidden="true">
            <div className="flex-1 relative flex items-center justify-center">
              <span className="absolute left-1/2 -translate-x-1/2 top-1/2 bottom-0 border-l-2 border-dotted" style={{ borderColor: 'var(--c-border-2)' }} />
              <span className="relative w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--c-accent)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-accent-fg)' }} />
              </span>
            </div>
            <div style={{ height: '1px' }} />
            <div className="flex-1 relative flex items-center justify-center">
              <span className="absolute left-1/2 -translate-x-1/2 top-0 bottom-1/2 border-l-2 border-dotted" style={{ borderColor: 'var(--c-border-2)' }} />
              <MapPin size={18} strokeWidth={2.5} className="relative text-red-500 fill-red-500/15" />
            </div>
          </div>

          <div className="flex-1 min-w-0 px-1">
            <StationInput
              label="From" value={sourceQuery} isAuto={sourceIsAuto} hideIcon
              onFocus={() => setActiveField("source")}
              onChange={(v) => { setSourceQuery(v); setSourceIsAuto(false); setActiveField("source"); if (source && v !== source.name) setSource(null); }}
              onClear={() => { setSourceQuery(""); setSource(null); setSourceIsAuto(false); setActiveField("source"); }}
              onKeyDown={handleKeyDown}
            />
            <div style={{ height: '1px', background: 'var(--c-border)' }} />
            <StationInput
              label="To" value={destQuery} hideIcon
              onFocus={() => setActiveField("destination")}
              onChange={(v) => { setDestQuery(v); setActiveField("destination"); if (destination && v !== destination.name) setDestination(null); }}
              onClear={() => { setDestQuery(""); setDestination(null); setActiveField("destination"); }}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <button
          onClick={handleSwap}
          disabled={!source && !destination}
          aria-label="Swap"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-110 active:scale-95"
          style={{ background: 'var(--c-card-alt)', color: 'var(--c-text-2)' }}
        >
          <ArrowUpDown size={16} strokeWidth={2.5} />
        </button>

        {showSuggestions && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+8px)] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[60vh] overflow-y-auto"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
          >
            {results.length > 0 && (
              <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">Stations</div>
            )}
            {results.map((s: any, idx: number) => {
              const isFocused = idx === focusedIndex;
              const modes = stationModes(s.id);
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
                  <span className="flex flex-col min-w-0 pr-3">
                    <span className="text-[15px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>{s.name}</span>
                    {/* Says why a row that matches no part of the typed name is
                        in the list — without it, "bus" returning Vadaj is noise. */}
                    {modes.length > 0 && (
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--c-text-4)' }}>
                        {formatModeList(modes)}
                      </span>
                    )}
                  </span>
                  <LineBadge line={s.line} />
                </button>
              );
            })}

            {activeQuery.length >= 3 && (
              <div className="px-4 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">
                <span>Places</span>
                {isSearchingPlaces && <span className="animate-pulse text-blue-500">Searching...</span>}
              </div>
            )}
            {placesError ? (
              <div className="px-4 py-3 text-[13px] text-red-500 font-medium">
                {placesError}
              </div>
            ) : places.map((p, idx) => {
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
        {/* An auto-filled source came from exactly one of two places, and the
            notices differ accordingly. The distance and the retry prompt both
            describe the *nearest* station, so with a default departure station
            set they'd attach the wrong distance to a station the rider chose,
            and a location failure is no longer something to retry (§8.1 phase
            E). Nested rather than three flat conditions so that "one of these,
            never both" is the shape of the code and not a rule to remember. */}
        {sourceIsAuto && (defaultDeparture ? (
          <div className="text-xs font-medium px-1" style={{ color: 'var(--c-text-3)' }}>
            Your default departure station
          </div>
        ) : (
          <>
            <LocationNotice status={locStatus} onRetry={onRetryLocation} compact />
            {nearest?.distanceKm != null && (
              <div className="text-xs font-medium flex items-center gap-2 px-1" style={{ color: 'var(--c-text-3)' }}>
                <span>~{Math.round(nearest.distanceKm * 1000)}m away</span>
                <span>·</span>
                <span>{formatDuration(walkMinsForKm(nearest.distanceKm, walkSpeedKmh))} walk</span>
              </div>
            )}
          </>
        ))}
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

      {!showSuggestions && recentTrips.length > 0 && (
        <div className="mb-6 -mx-1">
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1 px-2" style={{ color: 'var(--c-text-3)' }}>Recent</div>
          {recentTrips.map((trip) => (
            <button
              key={trip.key}
              onClick={() => fillFromTrip(trip)}
              className="flex items-center gap-3 w-full px-2 py-3 text-left rounded-xl transition-colors active:bg-black/5 dark:active:bg-white/5"
            >
              <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--c-card-alt)' }}>
                <History size={16} style={{ color: 'var(--c-text-3)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>{trip.dest?.name ?? 'Trip'}</div>
                <div className="text-[12px] truncate" style={{ color: 'var(--c-text-3)' }}>from {trip.source?.name ?? '—'}</div>
              </div>
              <div
                role="button"
                tabIndex={0}
                aria-label="Remove recent trip"
                onClick={(e) => removeTrip(e, trip.key)}
                className="shrink-0 w-9 h-9 -mr-1 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: 'var(--c-text-3)' }}
              >
                <X size={16} strokeWidth={2.5} />
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 relative z-10">
        <button
          onClick={() => setTimeExpanded(v => !v)}
          className="inline-flex items-center gap-2 px-4 rounded-full min-h-[44px] text-[14px] font-semibold transition-colors"
          style={{ background: 'var(--c-card)', color: 'var(--c-text)' }}
        >
          <Clock size={16} style={{ color: 'var(--c-text-3)' }} />
          <span>
            {timeMode === 'now'
              ? 'Leave now'
              : `${timeMode === 'depart' ? 'Depart' : 'Arrive'} ${new Date(timeStr).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
          </span>
          <ChevronDown size={16} style={{ color: 'var(--c-text-3)', transform: timeExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {timeExpanded && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1 mb-3 p-1 rounded-xl" style={{ background: 'var(--c-card)' }}>
              {(['now', 'depart', 'arrive'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setTimeMode(mode);
                    if (mode !== 'now') {
                      const d = new Date();
                      const pad = (n: number) => String(n).padStart(2, '0');
                      setTimeStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                    }
                  }}
                  className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200"
                  style={{
                    background: timeMode === mode ? 'var(--c-accent)' : 'transparent',
                    color: timeMode === mode ? 'var(--c-accent-fg)' : 'var(--c-text-3)',
                    boxShadow: timeMode === mode ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {mode === 'now' ? 'Leave Now' : mode === 'depart' ? 'Depart At' : 'Arrive By'}
                </button>
              ))}
            </div>
            {timeMode !== 'now' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <input
                  type="datetime-local"
                  value={timeStr}
                  onChange={e => setTimeStr(e.target.value)}
                  className="w-full border-none rounded-xl px-4 py-3 text-[15px] font-semibold transition-shadow duration-200 focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--c-card)',
                    color: 'var(--c-text)',
                    outlineColor: 'var(--c-accent)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto relative z-10">
        <button
          disabled={!canPlan}
          onClick={() => {
            if (!canPlan) return;
            const targetTime = timeMode === 'now' ? undefined : new Date(timeStr);
            const timeConfig = {
              queryTime: targetTime,
              arriveBy: timeMode === 'arrive'
            };
            onPlan(source, destination, timeConfig);
          }}
          className="w-full py-4 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          style={canPlan
            ? { background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }
            : { background: 'var(--c-card)', color: 'var(--c-text-4)', cursor: 'not-allowed' }
          }
        >
          View Route Options <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
