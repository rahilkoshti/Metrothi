import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LocateFixed, ChevronUp, Compass, Settings, X, MapPin, Footprints } from 'lucide-react';
import {
  STATION_BY_ID,
  formatDuration,
  walkMinsForKm,
  estimateLine,
  LINE_PATHS,
  type StationRecord,
  type PlaceNode,
} from '../engine/journeyEngine';
import { useNow } from '../hooks/useNow';
import { LineBadge } from '../../../components/LineBadge';
import { LINE_NAMES, LINE_COLORS } from '../constants';
import { LocationNotice } from '../../../components/LocationNotice';
import { DraggableSheet, type SheetSnap } from '../../../components/DraggableSheet';
import { LineStatusPills } from './LineStatusPills';
import { HomeSearch } from './HomeSearch';
import { StationDetailBody } from './StationDetail';
import { Planner } from './Planner';
import type { LocStatus } from '../../../App';

// Leaflet is heavy and now sits on the first-paint path, so it stays split out.
const HomeMap = lazy(() => import('../../map/components/HomeMap').then((m) => ({ default: m.HomeMap })));

// Height of the sheet's peek state — the grab handle, the name row, and the
// single chip row beneath it (line, distance, walk time). Sized to fit exactly
// that so the body's action buttons stay below the fold when collapsed.
const COLLAPSED_H = 118;

/** Format distance in km or meters based on value. */
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** A pill chip used across the sheet header. `alert` tints it for a
 *  service-status warning. */
function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'alert' }) {
  const alert = tone === 'alert';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums whitespace-nowrap"
      style={{
        background: 'var(--c-card)',
        color: alert ? '#f0997b' : 'var(--c-text-2)',
        border: `1px solid ${alert ? 'rgba(216,90,48,0.35)' : 'var(--c-border)'}`,
      }}
    >
      {children}
    </span>
  );
}

/** Service-status chip — renders only when the line isn't running. Isolated in
 *  its own component so the per-minute tick doesn't re-render the whole screen. */
function StatusChip({ line }: { line: string }) {
  const now = useNow();
  const status = estimateLine(line, now);
  if (status.status === 'running') return null;

  let text: string;
  switch (status.status) {
    case 'before-first-train':
      text = `Starts in ${formatDuration(status.minsUntilFirst)}`;
      break;
    case 'after-last-train':
      text = 'Service ended';
      break;
    case 'bus-only':
      text = 'Bus only';
      break;
    default:
      text = 'Service unavailable';
  }

  return (
    <Chip tone="alert">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#d85a30' }} />
      {text}
    </Chip>
  );
}

interface HomeScreenProps {
  coords: { lat: number; lng: number } | null;
  nearest: any;
  locStatus: LocStatus;
  onRetryLocation: () => void;
  onPlan: (source: any, dest: any, config?: any) => void;
}

export function HomeScreen({ coords, nearest, locStatus, onRetryLocation, onPlan }: HomeScreenProps) {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<SheetSnap>('collapsed');
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lng: number } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [prefillDest, setPrefillDest] = useState<any>(null);
  const [prefillSource, setPrefillSource] = useState<any>(null);

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

  // The station sheet's "From here" / "To here" buttons open the planner via
  // this event rather than navigating — the planner is an overlay, and the map
  // stays mounted beneath. Mirrors the 'home-recenter' event the recentre
  // button uses. The detail seeds the source or the destination.
  useEffect(() => {
    const openPlanner = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      setSearchOpen(false);
      setPrefillSource(detail.source ?? null);
      setPrefillDest(detail.dest ?? null);
      setPlannerOpen(true);
    };
    document.addEventListener('home-plan-trip', openPlanner);
    return () => document.removeEventListener('home-plan-trip', openPlanner);
  }, []);

  const station: StationRecord | undefined = selectedId ? STATION_BY_ID[selectedId] : undefined;
  const isNearest = !!station && station.id === nearest?.id;
  const locFailed = locStatus !== 'granted' && locStatus !== 'locating';

  // Position of the selected station along its line, for the "Stop N of M" chip.
  const stopPos = useMemo(() => {
    if (!station) return null;
    const path = LINE_PATHS[station.line];
    if (!path) return null;
    const idx = path.indexOf(station.id);
    if (idx === -1) return null;
    return { idx, total: path.length - 1 };
  }, [station]);

  function selectStation(id: string) {
    const s = STATION_BY_ID[id];
    setSelectedId(id);
    setSearchOpen(false);
    setSnap('mid');
    if (s?.lat != null && s?.lng != null) setPanTo({ lat: s.lat, lng: s.lng });
  }

  function planTo(item: StationRecord | PlaceNode) {
    setSearchOpen(false);
    setPrefillSource(null);
    setPrefillDest(item);
    setPlannerOpen(true);
  }

  function handlePlanFromModal(source: any, dest: any, config?: any) {
    setPlannerOpen(false);
    setPrefillSource(null);
    setPrefillDest(null);
    onPlan(source, dest, config);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh' }}
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
        <div ref={searchRowRef} className="px-4 pointer-events-auto flex gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 flex items-center gap-3 rounded-full px-4 py-3 text-left active:scale-[0.99] transition-transform"
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
          <button
            onClick={() => navigate('/you')}
            aria-label="Settings"
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              background: 'var(--c-blur)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--c-border-2)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
            }}
          >
            <Settings size={18} style={{ color: 'var(--c-text-3)' }} />
          </button>
        </div>
        <div className="pointer-events-auto">
          <LineStatusPills
            onSelectLine={(line) => {
              setFocusLine(line);
              setSearchOpen(true);
            }}
          />
        </div>
      </div>

      {/* Plan Route FAB */}
      <button
        onClick={() => { setPrefillSource(null); setPrefillDest(null); setPlannerOpen(true); }}
        aria-label="Plan route"
        className="absolute right-4 z-[600] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-90"
        style={{
          bottom: COLLAPSED_H + 72,
          background: 'var(--c-accent)',
          color: '#000',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          opacity: snap === 'collapsed' ? 1 : 0,
          pointerEvents: snap === 'collapsed' ? 'auto' : 'none',
        }}
      >
        <Compass size={24} strokeWidth={2.2} />
      </button>

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
              className="flex flex-col gap-3 px-4 pb-3"
              onClick={() => setSnap(snap === 'collapsed' ? 'full' : 'collapsed')}
            >
              {/* Top row: line badge, name, chevron */}
              <div className="flex items-center gap-3">
                <LineBadge line={station.line} size="lg" />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                    style={{ color: 'var(--c-text-4)' }}
                  >
                    {isNearest ? (locFailed ? 'Default station' : 'Nearest station') : 'Station'}
                    {station.interchange && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--c-card)', color: 'var(--c-text)' }}
                      >
                        Interchange
                      </span>
                    )}
                  </div>
                  <div className="text-[19px] font-bold truncate leading-tight" style={{ color: 'var(--c-text)' }}>
                    {station.name}
                  </div>
                </div>
                <ChevronUp
                  size={16}
                  className="shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--c-text-4)',
                    transform: snap === 'collapsed' ? 'none' : 'rotate(180deg)',
                  }}
                />
              </div>

              {/* Chip row. Collapsed shows proximity (line, distance, walk);
                  expanded shows structure (line, phase, stop) plus a status
                  chip when the line isn't running. */}
              <div className="flex items-center gap-2 flex-wrap">
                <Chip>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LINE_COLORS[station.line] }} />
                  {LINE_NAMES[station.line] ?? station.line}
                </Chip>

                {snap === 'collapsed'
                  ? isNearest && nearest?.distanceKm != null && (
                      <>
                        <Chip>
                          <MapPin size={12} strokeWidth={2.4} style={{ color: 'var(--c-text-4)' }} />
                          {formatDistance(nearest.distanceKm)}
                        </Chip>
                        <Chip>
                          <Footprints size={12} strokeWidth={2.4} style={{ color: 'var(--c-text-4)' }} />
                          {formatDuration(walkMinsForKm(nearest.distanceKm))}
                        </Chip>
                      </>
                    )
                  : (
                      <>
                        {station.phase != null && <Chip>Phase {station.phase}</Chip>}
                        {stopPos && <Chip>Stop {stopPos.idx + 1} of {stopPos.total + 1}</Chip>}
                        {station.interchange && <Chip>Interchange</Chip>}
                        <StatusChip line={station.line} />
                      </>
                    )}
              </div>
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
        {station && <StationDetailBody stationId={station.id} showHero={false} />}
        <div style={{ height: 24 }} />
      </DraggableSheet>

      {searchOpen && (
        <HomeSearch
          focusLine={focusLine}
          onClose={() => { setSearchOpen(false); setFocusLine(null); }}
          onSelectStation={selectStation}
          onPlanTo={planTo}
        />
      )}

      {/* Planner modal overlay */}
      {plannerOpen && (
        <div
          className="fixed inset-0 z-[1000] flex flex-col"
          style={{
            background: 'var(--c-bg)',
          }}
        >
          {/* Close button */}
          <div className="flex items-center justify-end px-4 pt-4 pb-0">
            <button
              onClick={() => { setPlannerOpen(false); setPrefillSource(null); setPrefillDest(null); }}
              aria-label="Close planner"
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                background: 'var(--c-card)',
              }}
            >
              <X size={20} style={{ color: 'var(--c-text)' }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Planner
              onPlan={handlePlanFromModal}
              nearest={nearest}
              locStatus={locStatus}
              onRetryLocation={onRetryLocation}
              prefillSource={prefillSource}
              prefillDest={prefillDest}
            />
          </div>
        </div>
      )}
    </div>
  );
}
