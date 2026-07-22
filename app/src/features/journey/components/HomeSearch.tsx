import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X, MapPin, Navigation, History, Star, Loader2 } from 'lucide-react';
import {
  STATIONS,
  haversineKm,
  walkMinsForKm,
  formatDuration,
  type StationRecord,
  type PlaceNode,
} from '../engine/journeyEngine';
import { GeocodingService } from '../../../services/GeocodingService';
import { fuzzySearch } from '../utils/fuzzySearch';
import { LineBadge } from '../../../components/LineBadge';
import { LINE_BADGE_BG, LINE_NAMES } from '../constants';

const SEARCHABLE = STATIONS.filter((s) => s.operational !== false);

const LINE_ORDER = ['blue', 'red', 'yellow', 'violet'] as const;

// Grouped once — STATIONS is static. Interchanges sit under their primary line
// only, matching how the Stations tab groups them.
const STATIONS_BY_LINE: Record<string, StationRecord[]> = (() => {
  const groups: Record<string, StationRecord[]> = {};
  for (const s of STATIONS) (groups[s.line] ??= []).push(s);
  return groups;
})();

function nearestStationTo(p: { lat: number; lng: number }) {
  let best: StationRecord | null = null;
  let bestKm = Infinity;
  for (const s of SEARCHABLE) {
    if (s.lat == null || s.lng == null) continue;
    const d = haversineKm(p, { lat: s.lat, lng: s.lng });
    if (d < bestKm) {
      bestKm = d;
      best = s;
    }
  }
  return best ? { station: best, km: bestKm } : null;
}

function Row({
  onClick,
  onDirections,
  icon,
  eyebrow,
  title,
  meta,
  badge,
}: {
  onClick: () => void;
  onDirections?: () => void;
  icon?: React.ReactNode;
  eyebrow?: string;
  title: React.ReactNode;
  meta?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 transition-colors"
      style={{ borderBottom: '1px solid var(--c-border)' }}
    >
      {/* Padding lives on the button, not the row, so the whole row height is
          tappable rather than just the text block. */}
      <button
        onClick={onClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left py-3 min-h-[52px]"
      >
        <div className="w-7 flex justify-center shrink-0">{badge ?? icon}</div>
        <div className="flex flex-col min-w-0">
          {eyebrow && (
            <span
              className="text-[11px] font-semibold truncate"
              style={{ color: 'var(--c-text-3)' }}
            >
              {eyebrow}
            </span>
          )}
          <span className="text-[15px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
            {title}
          </span>
          {meta && (
            <span className="text-[11px] truncate" style={{ color: 'var(--c-text-4)' }}>
              {meta}
            </span>
          )}
        </div>
      </button>
      {onDirections && (
        <button
          onClick={onDirections}
          aria-label="Plan a trip here"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          style={{ background: 'var(--c-card)' }}
        >
          <Navigation size={14} style={{ color: 'var(--c-accent)' }} />
        </button>
      )}
    </div>
  );
}

export function HomeSearch({
  onClose,
  onSelectStation,
  onPlanTo,
}: {
  onClose: () => void;
  onSelectStation: (id: string) => void;
  onPlanTo: (item: StationRecord | PlaceNode) => void;
}) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceNode[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      setRecentTrips(JSON.parse(localStorage.getItem('metrothi-recent-trips') || '[]'));
    } catch { /* ignore */ }
    try {
      setSavedJourneys(JSON.parse(localStorage.getItem('metrothi-saved-journeys') || '[]'));
    } catch { /* ignore */ }
  }, []);

  const stationResults = useMemo(
    () => (query.trim() ? fuzzySearch(query, SEARCHABLE, (s) => s.name) : []),
    [query]
  );

  // Landmarks come from a network call, so they lag the local station list.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setPlaces([]);
      setLoadingPlaces(false);
      return;
    }
    setLoadingPlaces(true);
    const timer = setTimeout(async () => {
      try {
        setPlaces(await GeocodingService.searchPlaces(q));
      } catch {
        setPlaces([]);
      } finally {
        setLoadingPlaces(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const showEmptyState = !query.trim();

  return (
    <div
      className="absolute inset-0 z-[1200] flex flex-col animate-in fade-in duration-150"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Search bar */}
      <div className="shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div
          className="flex items-center gap-2 rounded-full px-2 py-2"
          style={{ background: 'var(--c-card)' }}
        >
          <button
            onClick={onClose}
            aria-label="Close search"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} style={{ color: 'var(--c-text)' }} />
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stations and landmarks"
            aria-label="Search stations and landmarks"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] font-medium py-2"
            style={{ color: 'var(--c-text)' }}
          />
          {loadingPlaces && <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--c-text-4)' }} />}
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            >
              <X size={16} style={{ color: 'var(--c-text-3)' }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {showEmptyState ? (
          <>
            {savedJourneys.length > 0 && (
              <>
                <SectionLabel icon={<Star size={12} style={{ color: 'var(--c-accent)' }} />} text="Saved" />
                {savedJourneys.map((j: any) => (
                  <Row
                    key={j.key}
                    icon={<Star size={16} style={{ color: 'var(--c-text-3)' }} />}
                    title={j.destName || j.destId}
                    meta={`from ${j.sourceName || j.sourceId}`}
                    onClick={() => onSelectStation(j.destId)}
                  />
                ))}
              </>
            )}
            {recentTrips.length > 0 && (
              <>
                <SectionLabel icon={<History size={12} style={{ color: 'var(--c-text-3)' }} />} text="Recent" />
                {recentTrips.map((j: any) => (
                  <Row
                    key={j.key}
                    icon={<History size={16} style={{ color: 'var(--c-text-3)' }} />}
                    title={j.dest?.name ?? 'Trip'}
                    meta={`from ${j.source?.name ?? ''}`}
                    onClick={() => onPlanTo(j.dest)}
                  />
                ))}
              </>
            )}
            {savedJourneys.length === 0 && recentTrips.length === 0 && (
              <p className="px-4 pt-5 text-[12px]" style={{ color: 'var(--c-text-4)' }}>
                Search any landmark to find the metro stop closest to it — or pick a station below.
              </p>
            )}
            <AllStations onSelectStation={onSelectStation} onPlanTo={onPlanTo} />
          </>
        ) : (
          <>
            {stationResults.length > 0 && <SectionLabel text="Stations" />}
            {stationResults.map((s) => (
              <Row
                key={s.id}
                badge={<LineBadge line={s.line} size="xs" />}
                title={s.name}
                meta={s.interchange ? 'Interchange' : undefined}
                onClick={() => onSelectStation(s.id)}
                onDirections={() => onPlanTo(s)}
              />
            ))}

            {places.length > 0 && <SectionLabel text="Landmarks" />}
            {places.map((p) => {
              const near = nearestStationTo(p);
              return (
                <Row
                  key={p.id}
                  icon={<MapPin size={16} style={{ color: 'var(--c-text-3)' }} />}
                  eyebrow={`Nearest to ${p.name}`}
                  title={
                    near ? (
                      <span className="flex items-center gap-2">
                        <LineBadge line={near.station.line} size="xs" />
                        <span className="truncate">{near.station.name}</span>
                      </span>
                    ) : (
                      p.name
                    )
                  }
                  meta={
                    near
                      ? `${
                          near.km < 1
                            ? `${Math.round(near.km * 1000)} m`
                            : `${near.km.toFixed(1)} km`
                        } · ${formatDuration(walkMinsForKm(near.km))} walk`
                      : 'No station nearby'
                  }
                  onClick={() => near && onSelectStation(near.station.id)}
                  onDirections={() => onPlanTo(p)}
                />
              );
            })}

            {stationResults.length === 0 && places.length === 0 && !loadingPlaces && (
              <p className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--c-text-4)' }}>
                Nothing found for “{query}”.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The full network, grouped by line — the same shape as the Stations tab, so
 * the overlay doubles as a browsable directory when there's nothing to search.
 */
function AllStations({
  onSelectStation,
  onPlanTo,
}: {
  onSelectStation: (id: string) => void;
  onPlanTo: (item: StationRecord) => void;
}) {
  return (
    <>
      <SectionLabel text="All stations" />
      {LINE_ORDER.map((line) => {
        const stns = STATIONS_BY_LINE[line];
        if (!stns?.length) return null;
        return (
          <div key={line}>
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <LineBadge line={line} size="md" />
              <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                {LINE_NAMES[line]}
              </span>
              <span className="text-xs font-bold ml-auto" style={{ color: 'var(--c-text-3)' }}>
                {stns.length}
              </span>
            </div>
            {stns.map((s) => {
              const meta = [
                `Ph.${s.phase}`,
                s.interchange ? 'Interchange' : null,
                s.operational === false ? 'Opening soon' : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Row
                  key={s.id}
                  badge={
                    <span
                      className="w-2.5 h-2.5 rounded-full block"
                      style={{ background: LINE_BADGE_BG[line], opacity: 0.7 }}
                    />
                  }
                  title={s.name}
                  meta={meta}
                  onClick={() => onSelectStation(s.id)}
                  onDirections={s.operational === false ? undefined : () => onPlanTo(s)}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function SectionLabel({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      {icon}
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--c-text-4)' }}
      >
        {text}
      </span>
    </div>
  );
}
