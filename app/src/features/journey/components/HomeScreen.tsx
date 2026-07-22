import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LocateFixed, ChevronUp } from 'lucide-react';
import {
  STATION_BY_ID,
  upcomingStationDepartures,
  formatDuration,
  walkMinsForKm,
  type StationRecord,
  type PlaceNode,
} from '../engine/journeyEngine';
import { useNow } from '../hooks/useNow';
import { LineBadge } from '../../../components/LineBadge';
import { LocationNotice } from '../../../components/LocationNotice';
import { DraggableSheet, type SheetSnap } from '../../../components/DraggableSheet';
import { LineStatusPills } from './LineStatusPills';
import { HomeSearch } from './HomeSearch';
import { StationDetailBody } from './StationDetail';
import type { LocStatus } from '../../../App';

// Leaflet is heavy and now sits on the first-paint path, so it stays split out.
const HomeMap = lazy(() => import('../../map/components/HomeMap').then((m) => ({ default: m.HomeMap })));

// Height of the sheet's peek state — the grab handle plus one header row.
const COLLAPSED_H = 112;

/** Soonest departure from this station across both directions of a line. */
function NextTrainChip({ stationId, line }: { stationId: string; line: string }) {
  const now = useNow();
  const mins = useMemo(() => {
    const dirs = upcomingStationDepartures(stationId, line, now, 1);
    const waits = dirs.flatMap((d: any) => d.departures.map((dep: any) => dep.waitMins));
    return waits.length ? Math.min(...waits) : null;
  }, [stationId, line, now]);

  if (mins == null) return null;

  return (
    <div
      className="shrink-0 flex flex-col items-center rounded-xl px-2.5 py-1.5"
      style={{ background: 'var(--c-card)' }}
    >
      <span className="text-[15px] font-bold leading-none tabular-nums" style={{ color: 'var(--c-text)' }}>
        {mins === 0 ? 'Due' : formatDuration(mins)}
      </span>
      <span
        className="text-[9px] font-bold uppercase tracking-widest mt-1 leading-none"
        style={{ color: 'var(--c-text-4)' }}
      >
        Next
      </span>
    </div>
  );
}

interface HomeScreenProps {
  coords: { lat: number; lng: number } | null;
  nearest: any;
  locStatus: LocStatus;
  onRetryLocation: () => void;
}

export function HomeScreen({ coords, nearest, locStatus, onRetryLocation }: HomeScreenProps) {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<SheetSnap>('collapsed');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lng: number } | null>(null);

  // How far short of the top the sheet stops when fully open: just below the
  // search row. Measured rather than hardcoded so it survives font scaling and
  // safe-area insets.
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const [topInset, setTopInset] = useState(68);

  useLayoutEffect(() => {
    const row = searchRowRef.current;
    const box = containerRef.current;
    if (!row || !box) return;
    const measure = () =>
      setTopInset(
        Math.round(row.getBoundingClientRect().bottom - box.getBoundingClientRect().top + 8)
      );
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(box);
    measure();
    return () => ro.disconnect();
  }, []);

  // The nearest station lands asynchronously; adopt it until the user picks.
  useEffect(() => {
    if (!selectedId && nearest?.id) setSelectedId(nearest.id);
  }, [nearest, selectedId]);

  const station: StationRecord | undefined = selectedId ? STATION_BY_ID[selectedId] : undefined;
  const isNearest = !!station && station.id === nearest?.id;
  const locFailed = locStatus !== 'granted' && locStatus !== 'locating';

  function selectStation(id: string) {
    const s = STATION_BY_ID[id];
    setSelectedId(id);
    setSearchOpen(false);
    setSnap('mid');
    if (s?.lat != null && s?.lng != null) setPanTo({ lat: s.lat, lng: s.lng });
  }

  function planTo(item: StationRecord | PlaceNode) {
    setSearchOpen(false);
    navigate('/go', { state: { prefillDest: item } });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      // --nav-h is measured from the real tab bar (App.tsx) and includes the
      // home-indicator inset; the 80px fallback only applies before first paint.
      style={{ height: 'calc(100dvh - var(--nav-h, 80px))' }}
    >
      <Suspense
        fallback={
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--c-card-alt)', color: 'var(--c-text-4)' }}
          >
            <span className="text-sm tracking-wide">Loading map…</span>
          </div>
        }
      >
        <HomeMap
          coords={coords}
          nearest={nearest}
          bottomInset={COLLAPSED_H}
          selectedStationId={selectedId}
          onSelectStation={selectStation}
          panTo={panTo}
        />
      </Suspense>

      {/* Floating chrome — search then live line status, over the map. The
          search row stays put at every snap; the sheet rises to just under it
          and covers the status pills. */}
      <div className="absolute top-0 inset-x-0 z-[600] pt-3 flex flex-col gap-2 pointer-events-none">
        <div ref={searchRowRef} className="px-4 pointer-events-auto">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 rounded-full px-4 py-3 text-left active:scale-[0.99] transition-transform"
            style={{
              background: 'var(--c-blur)',
              backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--c-border-2)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
            }}
          >
            <Search size={17} style={{ color: 'var(--c-text-3)' }} />
            <span className="text-[15px] font-medium" style={{ color: 'var(--c-text-3)' }}>
              Search stations and landmarks
            </span>
          </button>
        </div>
        <div className="pointer-events-auto">
          <LineStatusPills />
        </div>
      </div>

      {/* Recentre */}
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('home-recenter'))}
        aria-label="Recentre map"
        className="absolute right-4 z-[600] w-11 h-11 rounded-full flex items-center justify-center transition-opacity duration-200 active:scale-95"
        style={{
          bottom: COLLAPSED_H + 16,
          background: 'var(--c-blur)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid var(--c-border-2)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
          opacity: snap === 'collapsed' ? 1 : 0,
          pointerEvents: snap === 'collapsed' ? 'auto' : 'none',
        }}
      >
        <LocateFixed size={19} style={{ color: 'var(--c-text)' }} />
      </button>

      {/* Station sheet. Rendered directly — no full-bleed wrapper, or it would
          sit over the map and swallow every pan, zoom and marker tap. */}
      <DraggableSheet
        className="z-[900]"
        snap={snap}
        onSnapChange={setSnap}
        collapsedHeight={COLLAPSED_H}
        midRatio={0.42}
        topInset={topInset}
        header={
          station ? (
            <div
              className="px-4 pb-3 flex items-center gap-3"
              onClick={() => setSnap(snap === 'collapsed' ? 'full' : 'collapsed')}
            >
              <div className="flex flex-col gap-1 shrink-0">
                <LineBadge line={station.line} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--c-text-4)' }}
                >
                  {isNearest ? (locFailed ? 'Default station' : 'Nearest station') : 'Station'}
                  {isNearest && nearest?.distanceKm != null && (
                    <>
                      {' · '}
                      {Math.round(nearest.distanceKm * 1000)}m ·{' '}
                      {formatDuration(walkMinsForKm(nearest.distanceKm))} walk
                    </>
                  )}
                </div>
                <div className="text-[19px] font-bold truncate leading-tight" style={{ color: 'var(--c-text)' }}>
                  {station.name}
                </div>
              </div>
              <NextTrainChip stationId={station.id} line={station.line} />
              <ChevronUp
                size={16}
                className="shrink-0 transition-transform duration-200"
                style={{
                  color: 'var(--c-text-4)',
                  transform: snap === 'collapsed' ? 'none' : 'rotate(180deg)',
                }}
              />
            </div>
          ) : (
            <div className="px-4 pb-3">
              <div className="h-4 w-24 rounded mb-2 animate-pulse" style={{ background: 'var(--c-card-alt)' }} />
              <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--c-card-alt)' }} />
            </div>
          )
        }
      >
        {locFailed && (
          <div className="px-5 pt-4">
            <LocationNotice status={locStatus} onRetry={onRetryLocation} />
          </div>
        )}
        {station && <StationDetailBody stationId={station.id} />}
        <div style={{ height: 24 }} />
      </DraggableSheet>

      {searchOpen && (
        <HomeSearch
          onClose={() => setSearchOpen(false)}
          onSelectStation={selectStation}
          onPlanTo={planTo}
        />
      )}
    </div>
  );
}
