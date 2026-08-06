import { useState, useMemo, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowRight, MapPin, History, Clock, ChevronDown, X, Rss } from "lucide-react";
import { StationInput } from "./StationInput";
import { STATIONS, estimateLine, nextDepartureFromStation, formatDuration, walkMinsForKm } from "../engine/journeyEngine";
import type { PlaceNode } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useWalkSpeed, useDefaultDeparture } from "../hooks/usePreferences";
import { useNearestStationHint } from "../hooks/useNearestStationHint";
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
  const { t } = useTranslation();
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
  // Held as a reason, not a sentence: the effect that sets it runs on a query
  // and a network state, and storing translated prose there would either freeze
  // the message in the language it failed in or put `t` in the dependency list
  // and re-fire the search on every language change.
  const [placesError, setPlacesError] = useState<'offline' | 'unavailable' | null>(null);
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
  const nearestHint = useNearestStationHint();

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
      setPlacesError('offline');
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      setPlacesError(null);
      try {
        const res = await GeocodingService.searchPlaces(activeQuery);
        setPlaces(res);
      } catch {
        setPlaces([]);
        setPlacesError('unavailable');
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
    // No title block: the eyebrow and "Where to?" live in the sheet header now,
    // so they stay put while this form scrolls under them (§16/2.6).
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto flex flex-col" onClick={() => setActiveField(null)}>
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
              <MapPin size={20} strokeWidth={2} className="relative" style={{ color: 'var(--c-error)' }} />
            </div>
          </div>

          <div className="flex-1 min-w-0 px-1">
            <StationInput
              field="source" value={sourceQuery} isAuto={sourceIsAuto} hideIcon
              onFocus={() => setActiveField("source")}
              onChange={(v) => { setSourceQuery(v); setSourceIsAuto(false); setActiveField("source"); if (source && v !== source.name) setSource(null); }}
              onClear={() => { setSourceQuery(""); setSource(null); setSourceIsAuto(false); setActiveField("source"); }}
              onKeyDown={handleKeyDown}
            />
            <div style={{ height: '1px', background: 'var(--c-border)' }} />
            <StationInput
              field="dest" value={destQuery} hideIcon
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
          aria-label={t('planner.swap')}
          className="hit-44 absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 active:scale-[0.97]"
          style={{ background: 'var(--c-card-alt)', color: 'var(--c-text-2)' }}
        >
          <ArrowUpDown size={16} strokeWidth={2.5} />
        </button>

        {showSuggestions && (
          // Drops in from 8px above, matching the search overlay's own
          // suggestion list (`HomeSearch`), which is the one place in the app
          // where this entrance was already real.
          <motion.div
            className="absolute left-0 right-0 top-[calc(100%+8px)] rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[60vh] overflow-y-auto"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {results.length > 0 && (
              <div className="px-4 py-2 text-caption uppercase" style={{ color: 'var(--c-text-3)', background: 'var(--c-card-alt)' }}>{t('planner.stations')}</div>
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
              <div className="px-4 py-2 flex items-center justify-between text-caption uppercase" style={{ color: 'var(--c-text-3)', background: 'var(--c-card-alt)' }}>
                <span>{t('planner.places')}</span>
                {isSearchingPlaces && <span style={{ color: 'var(--c-info)' }}>{t('planner.searching')}</span>}
              </div>
            )}
            {placesError ? (
              <div className="px-4 py-3 text-footnote" style={{ color: 'var(--c-error)' }}>
                {t(placesError === 'offline' ? 'planner.placesOffline' : 'planner.placesUnavailable')}
              </div>
            ) : places.map((p, idx) => {
              const isFocused = (idx + results.length) === focusedIndex;
              // The same answer the search overlay gives, from the same engine
              // call the plan will make: which station this place puts you at,
              // and how far you then walk. What was here instead was
              // `planner.placeHint` — "Select to find nearest station" —
              // printed identically under every result, so twelve landmarks
              // arrived with twelve identical subtitles and nothing to choose
              // between them.
              const near = nearestHint(p);
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--c-info-bg)' }}>
                    <MapPin size={16} strokeWidth={2.2} style={{ color: 'var(--c-info)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* The place leads here where the station leads in the
                        overlay, and the difference is not drift: tapping a row
                        in the overlay selects the *station*, so the station is
                        what the row is offering. Tapping here fills the field
                        with the *place* — the engine resolves it on plan — so
                        naming the station first would misdescribe what the tap
                        does. Same two facts, ordered by what the row is for. */}
                    <div className="text-subhead truncate" style={{ color: 'var(--c-text)' }}>{p.name}</div>
                    {near.station && (
                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        <LineBadge line={near.station.line} size="xs" />
                        <span className="text-footnote truncate" style={{ color: 'var(--c-text-2)' }}>
                          {near.station.name}
                        </span>
                      </div>
                    )}
                    <div className="text-footnote truncate" style={{ color: 'var(--c-text-4)' }}>{near.meta}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
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
            {t('planner.defaultDeparture')}
          </div>
        ) : (
          <>
            <LocationNotice status={locStatus} onRetry={onRetryLocation} compact />
            {nearest?.distanceKm != null && (
              <div className="text-xs font-medium flex items-center gap-2 px-1" style={{ color: 'var(--c-text-3)' }}>
                <span>{t('planner.metresAway', { metres: Math.round(nearest.distanceKm * 1000) })}</span>
                <span>·</span>
                <span>{t('common.walk', { duration: formatDuration(walkMinsForKm(nearest.distanceKm, walkSpeedKmh)) })}</span>
              </div>
            )}
          </>
        ))}
        {sourceStatus?.status === "running" && (
          <div className="flex items-center gap-2 text-footnote p-3 rounded-card" style={{ background: 'var(--c-good-bg)', color: 'var(--c-good)' }}>
            <Rss size={14} strokeWidth={2.2} className="shrink-0" aria-hidden="true" />
            {/* `Trans` rather than two strings, so the bold duration can sit
                where each language puts it — Hindi and Gujarati both close the
                sentence after it, English opens with it. */}
            <Trans
              i18nKey="planner.nextTrainIn"
              values={{ duration: formatDuration(sourceStatus.waitMins!) }}
              components={{ b: <strong /> }}
            />
            <span className="ml-auto opacity-60">{t('planner.everyDuration', { duration: formatDuration(sourceStatus.currentFrequencyMins!) })}</span>
          </div>
        )}
        {sourceStatus?.status === "before-first-train" && (
          <div className="text-footnote p-3 rounded-card" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
            {t('planner.serviceStartsIn', { duration: formatDuration(sourceStatus.minsUntilFirst!) })}
          </div>
        )}
        {sourceStatus?.status === "after-last-train" && (
          <div className="text-footnote p-3 rounded-card" style={{ background: 'var(--c-card)', color: 'var(--c-text-3)' }}>
            {t('planner.serviceEndedToday')}
          </div>
        )}
        {sourceStatus?.status === "bus-only" && (
          <div className="text-footnote p-3 rounded-card" style={{ background: 'var(--c-info-bg)', color: 'var(--c-info)' }}>
            {t('planner.busOnlyResumes', { duration: formatDuration(sourceStatus.resumesInMins!) })}
          </div>
        )}
        {sameStation && (
          <div className="text-callout p-3 rounded-card text-center" style={{ background: 'var(--c-error-bg)', color: 'var(--c-error)' }}>
            {t('planner.sameStation')}
          </div>
        )}
      </div>

      {!showSuggestions && recentTrips.length > 0 && (
        <div className="mb-6 -mx-1">
          <div className="text-caption uppercase mb-1 px-2" style={{ color: 'var(--c-text-3)' }}>{t('common.recent')}</div>
          {/* Two sibling buttons, not one nested inside the other. The remove
              control used to be a `role="button"` div *inside* the row's
              <button> — interactive content cannot nest, and with only an
              onClick handler it did nothing at all for a keyboard or switch
              user, who could focus it and press Enter to no effect. */}
          {recentTrips.map((trip) => (
            <div key={trip.key} className="flex items-center gap-3 pr-1">
              <button
                onClick={() => fillFromTrip(trip)}
                className="flex items-center gap-3 flex-1 min-w-0 px-2 py-3 text-left rounded-control transition-opacity active:opacity-70"
              >
                <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--c-card-alt)' }}>
                  <History size={16} strokeWidth={2.2} style={{ color: 'var(--c-text-3)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-headline truncate" style={{ color: 'var(--c-text)' }}>{trip.dest?.name ?? t('common.trip')}</div>
                  <div className="text-footnote truncate" style={{ color: 'var(--c-text-3)' }}>{t('common.fromStation', { name: trip.source?.name ?? '—' })}</div>
                </div>
              </button>
              <button
                type="button"
                aria-label={t('planner.removeRecentTrip')}
                onClick={(e) => removeTrip(e, trip.key)}
                className="hit-44 shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-opacity active:opacity-70"
                style={{ color: 'var(--c-text-3)' }}
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
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
            {/* The date itself is still formatted in the *browser's* locale, not
                the app's. That's §6.6 phase 4's call to make along with the
                pending Western-vs-Indic numeral decision (§6.3); pre-empting it
                here would settle it for one label. */}
            {timeMode === 'now'
              ? t('planner.leaveNow')
              : t(timeMode === 'depart' ? 'planner.departAtTime' : 'planner.arriveByTime', {
                  time: new Date(timeStr).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                })}
          </span>
          <ChevronDown size={16} style={{ color: 'var(--c-text-3)', transform: timeExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {timeExpanded && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
                    boxShadow: 'none'
                  }}
                >
                  {t(mode === 'now' ? 'planner.modeNow' : mode === 'depart' ? 'planner.modeDepart' : 'planner.modeArrive')}
                </button>
              ))}
            </div>
            {timeMode !== 'now' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <input
                  type="datetime-local"
                  value={timeStr}
                  onChange={e => setTimeStr(e.target.value)}
                  className="w-full border-none rounded-control px-4 py-3 text-headline transition-shadow duration-200"
                  style={{
                    background: 'var(--c-card)',
                    color: 'var(--c-text)',
                    outlineColor: 'var(--c-accent)',
                    boxShadow: 'none'
                  }}
                />
              </motion.div>
            )}
          </motion.div>
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
          {t('planner.submit')} <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
