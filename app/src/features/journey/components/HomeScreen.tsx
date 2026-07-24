import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LocateFixed, ChevronUp, Compass, X, MapPin, Footprints, ArrowRight } from 'lucide-react';
import {
  STATION_BY_ID,
  formatDuration,
  walkMinsForKm,
  estimateLine,
  planJourney,
  LINE_PATHS,
  type StationRecord,
  type PlaceNode,
} from '../engine/journeyEngine';
import { routeLegSlices } from '../../map/geometry/trackGeometry';
import { useNow } from '../hooks/useNow';
import { LineBadge } from '../../../components/LineBadge';
import { LINE_NAMES, LINE_COLORS } from '../constants';
import { LocationNotice } from '../../../components/LocationNotice';
import { DraggableSheet, type SheetSnap } from '../../../components/DraggableSheet';
import { LineStatusPills } from './LineStatusPills';
import { HomeSearch } from './HomeSearch';
import { SearchBar } from './SearchBar';
import { StationDetailBody } from './StationDetail';
import { Planner } from './Planner';
import { JourneySummary } from './journeySheet/JourneySummary';
import { RouteTimeline } from './journeySheet/RouteTimeline';
import { AllTrainsList } from './journeySheet/AllTrainsList';
import { LiveJourneySummary } from './journeySheet/LiveJourneySummary';
import type { useJourneySession } from '../hooks/useJourneySession';
import type { LocStatus } from '../../../App';

// Leaflet is heavy and now sits on the first-paint path, so it stays split out.
const HomeMap = lazy(() => import('../../map/components/HomeMap').then((m) => ({ default: m.HomeMap })));

// Height of the sheet's peek state — the grab handle, the name row, and the
// single chip row beneath it (line, distance, walk time). Sized to fit exactly
// that so the body's action buttons stay below the fold when collapsed.
const COLLAPSED_H = 118;
// Peek height for the planned-route header (title + chips row).
const PLAN_COLLAPSED_H = 104;
// Peek height for the live-journey summary header.
const LIVE_COLLAPSED_H = 96;

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
  /** The active plan result (null when nothing is planned). */
  result?: any;
  /** True once the user taps Start Journey. */
  activeJourney?: boolean;
  /** Live journey session (only meaningful when activeJourney). */
  session?: ReturnType<typeof useJourneySession>;
  /** Start the currently selected departure. */
  onStartJourney?: (idx: number, currentResult: any) => void;
  /** Clear the planned route and return to the station sheet. */
  onClearResult?: () => void;
  /** Open the full-screen live journey view. */
  onMaximizeLive?: () => void;
}

export function HomeScreen({
  coords,
  nearest,
  locStatus,
  onRetryLocation,
  onPlan,
  result = null,
  activeJourney = false,
  session,
  onStartJourney,
  onClearResult,
  onMaximizeLive,
}: HomeScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [snap, setSnap] = useState<SheetSnap>('collapsed');
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lng: number } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [prefillDest, setPrefillDest] = useState<any>(null);
  const [prefillSource, setPrefillSource] = useState<any>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);

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

  // The standalone /stations/:id page can't fire the event above — no HomeScreen
  // is mounted there — so its "From here"/"To here" buttons navigate home with
  // the intent in router state. Consume it once on mount and open the planner,
  // then clear the state so a refresh or back-nav doesn't reopen it.
  useEffect(() => {
    const planTrip = (location.state as { planTrip?: { source?: string; dest?: string } } | null)?.planTrip;
    if (!planTrip) return;
    setSearchOpen(false);
    setPrefillSource(planTrip.source ?? null);
    setPrefillDest(planTrip.dest ?? null);
    setPlannerOpen(true);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const station: StationRecord | undefined = selectedId ? STATION_BY_ID[selectedId] : undefined;
  const isNearest = !!station && station.id === nearest?.id;
  const locFailed = locStatus !== 'granted' && locStatus !== 'locating';

  // ── Journey mode ────────────────────────────────────────────────────────────
  // 'live'  — a journey is underway (sheet shows the live summary).
  // 'plan'  — a route is planned but not started (sheet shows the results).
  // 'station' — default: nearest / selected station detail.
  const journeyMode: 'station' | 'plan' | 'live' = activeJourney ? 'live' : result ? 'plan' : 'station';

  // Keep the plan's clocks live while it sits on screen, mirroring the old
  // ResultsScreen recompute. Recomputes every 15s and whenever the route changes.
  const now = useNow(15000);
  const plan = useMemo(() => {
    if (!result) return null;
    return (
      planJourney(
        result.sourcePlace || result.sourceStation,
        result.destPlace || result.destStation,
        { queryTime: result.queryTime, actualNow: now, arriveBy: result.arriveBy }
      ) || result
    );
  }, [result, now]);

  // Stable id for the current route — drives the map's one-shot fit and the
  // sheet's snap/selection resets, without refiring on the 15s clock tick.
  const routeKey = result ? `${result.sourceStation?.id}->${result.destStation?.id}@${result.queryTime}` : null;

  const options: any[] = plan?.options ?? [];
  const activeOption = options[selectedOptionIdx] ?? plan;

  // Reset the selected departure and pop the sheet to mid whenever a new route
  // is planned. Return to the collapsed station peek when the route is cleared.
  const prevRouteKey = useRef<string | null>(null);
  useEffect(() => {
    if (routeKey && routeKey !== prevRouteKey.current) {
      setSelectedOptionIdx(0);
      setSnap('mid');
    } else if (!routeKey && prevRouteKey.current) {
      setSnap('collapsed');
    }
    prevRouteKey.current = routeKey;
  }, [routeKey]);

  // Collapse the sheet to the live peek when a journey starts.
  const prevActive = useRef(false);
  useEffect(() => {
    if (activeJourney && !prevActive.current) setSnap('collapsed');
    prevActive.current = activeJourney;
  }, [activeJourney]);

  // Map route geometry, derived from the live plan so it tracks recomputes.
  const routeLegs = useMemo(() => {
    if (!plan?.stops || plan.stops.length < 2) return null;
    return routeLegSlices(plan.stops) as { line: string; coords: [number, number][] }[];
  }, [plan]);

  const routeEndpoints = useMemo(() => {
    if (!plan?.stops?.length) return null;
    const first = plan.stops[0];
    const last = plan.stops[plan.stops.length - 1];
    const origin: [number, number] | null = first?.lat != null && first?.lng != null ? [first.lat, first.lng] : null;
    const dest: [number, number] | null = last?.lat != null && last?.lng != null ? [last.lat, last.lng] : null;
    const sp = plan.sourcePlace;
    const dp = plan.destPlace;
    const originWalk = sp && origin ? [[sp.lat, sp.lng], origin] as [number, number][] : null;
    const destWalk = dp && dest ? [dest, [dp.lat, dp.lng]] as [number, number][] : null;
    return { origin, dest, originWalk, destWalk };
  }, [plan]);

  const routeBottomPad = Math.round((containerRef.current?.clientHeight ?? window.innerHeight) * 0.46);

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
    if (journeyMode === 'station') setSnap('mid');
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

  const collapsedHeight =
    journeyMode === 'plan' ? PLAN_COLLAPSED_H : journeyMode === 'live' ? LIVE_COLLAPSED_H : COLLAPSED_H;

  // ── Sheet header per mode ─────────────────────────────────────────────────────
  let sheetHeader: ReactNode;
  if (journeyMode === 'live' && session && result) {
    sheetHeader = (
      <LiveJourneySummary result={result} session={session} onMaximize={() => onMaximizeLive?.()} />
    );
  } else if (journeyMode === 'plan' && plan) {
    sheetHeader = (
      <div className="flex items-start gap-3 px-4 pb-3">
        <div
          className="flex-1 min-w-0"
          onClick={() => setSnap(snap === 'full' ? 'mid' : snap === 'mid' ? 'full' : 'mid')}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[16px] font-bold truncate" style={{ color: 'var(--c-text-3)' }}>{plan.source.name}</span>
            <ArrowRight size={14} className="shrink-0" style={{ color: 'var(--c-text-4)' }} />
            <span className="text-[16px] font-bold truncate" style={{ color: 'var(--c-text)' }}>{plan.dest.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Chip>{plan.totalStops} stops</Chip>
            {plan.numTransfers > 0 && <Chip>{plan.numTransfers} transfer{plan.numTransfers > 1 ? 's' : ''}</Chip>}
            {activeOption?.arriveClockTime && <Chip>arrive {activeOption.arriveClockTime}</Chip>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClearResult?.(); }}
          aria-label="Clear route"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'var(--c-card)' }}
        >
          <X size={17} style={{ color: 'var(--c-text)' }} />
        </button>
      </div>
    );
  } else {
    sheetHeader = station ? (
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
    );
  }

  // ── Sheet body per mode ───────────────────────────────────────────────────────
  let sheetBody: ReactNode;
  if (journeyMode === 'live' && result) {
    sheetBody = (
      <div className="px-5 pt-2 pb-6">
        <button
          onClick={() => onMaximizeLive?.()}
          className="w-full py-3.5 rounded-xl font-bold text-[14px] active:scale-[0.98] transition-transform"
          style={{ background: 'var(--c-card)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
        >
          Open full journey view
        </button>
      </div>
    );
  } else if (journeyMode === 'plan' && plan) {
    sheetBody = (
      <>
        <JourneySummary
          result={plan}
          active={activeOption}
          options={options}
          selected={selectedOptionIdx}
          onSelect={setSelectedOptionIdx}
          onStart={() => onStartJourney?.(selectedOptionIdx, plan)}
        />
        <div className="px-5 pb-8 flex flex-col gap-6">
          <RouteTimeline result={plan} active={activeOption} />
          <AllTrainsList
            options={options}
            selected={selectedOptionIdx}
            onSelect={setSelectedOptionIdx}
            sourceName={plan.source.name}
          />
        </div>
      </>
    );
  } else {
    sheetBody = (
      <>
        {locFailed && (
          <div className="px-5 pt-4">
            <LocationNotice status={locStatus} onRetry={onRetryLocation} />
          </div>
        )}
        {station && <StationDetailBody stationId={station.id} showHero={false} />}
        <div style={{ height: 24 }} />
      </>
    );
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
          routeLegs={routeLegs}
          routeKey={routeKey}
          routeEndpoints={routeEndpoints}
          routeBottomPad={routeBottomPad}
        />
      </Suspense>

      {/* Floating chrome — search then live line status, over the map. The
          search row stays put at every snap; the sheet rises to just under it
          and covers the status pills. */}
      <div className="absolute top-0 inset-x-0 z-[600] pt-3 flex flex-col gap-2 pointer-events-none">
        <div ref={searchRowRef} className="px-4 pointer-events-auto">
          <SearchBar
            variant="idle"
            placeholder="Search stations and landmarks"
            onOpen={() => setSearchOpen(true)}
            onSettings={() => navigate('/you')}
          />
        </div>
        {journeyMode === 'station' && (
          <div className="pointer-events-auto">
            <LineStatusPills
              onSelectLine={(line) => {
                setFocusLine(line);
                setSearchOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Plan Route FAB — only in the default station mode. */}
      {journeyMode === 'station' && (
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
      )}

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

      {/* Sheet — station detail, planned route, or live journey depending on
          journeyMode. Rendered directly — no full-bleed wrapper, or it would
          sit over the map and swallow every pan, zoom and marker tap. */}
      <DraggableSheet
        className="z-[900]"
        snap={snap}
        onSnapChange={setSnap}
        collapsedHeight={collapsedHeight}
        midRatio={0.42}
        topInset={topInset}
        header={sheetHeader}
      >
        {sheetBody}
      </DraggableSheet>

      {searchOpen && (
        <HomeSearch
          focusLine={focusLine}
          nearestId={nearest?.id ?? null}
          onClose={() => { setSearchOpen(false); setFocusLine(null); }}
          onSettings={() => navigate('/you')}
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
