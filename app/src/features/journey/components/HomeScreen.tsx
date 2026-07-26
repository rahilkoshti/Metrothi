import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LocateFixed, Compass, X, MapPin, Clock, Star, ArrowRight } from 'lucide-react';
import {
  STATION_BY_ID,
  formatDuration,
  walkMinsForKm,
  estimateLine,
  planJourney,
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
import { LiveJourneyScreen } from './LiveJourneyScreen';
import { StationSheetActions } from './stationSheet/StationSheetActions';
import { UpcomingTrains } from './stationSheet/UpcomingTrains';
import { useSavedStations } from '../hooks/useSavedStations';
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
  /** Clear the planned route (or end the live journey) and return to the station sheet. */
  onClearResult?: () => void;
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
}: HomeScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSaved, toggle: toggleSaved } = useSavedStations();
  // Opens at the mid snap: the station sheet is the screen's primary content,
  // so its actions and next departures should be readable without a drag.
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lng: number } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [prefillDest, setPrefillDest] = useState<any>(null);
  const [prefillSource, setPrefillSource] = useState<any>(null);
  const [selectedDepartMs, setSelectedDepartMs] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // Wraps everything the station sheet shows above the fold at its mid snap.
  const stationBlockRef = useRef<HTMLDivElement>(null);

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
        { queryTime: result.queryTime, actualNow: now, arriveBy: result.arriveBy, isLeaveNow: result.isLeaveNow }
      ) || result
    );
  }, [result, now]);

  // Stable id for the current route — drives the map's one-shot fit and the
  // sheet's snap/selection resets, without refiring on the 15s clock tick.
  const routeKey = result ? `${result.sourceStation?.id}->${result.destStation?.id}@${result.queryTime}` : null;

  const options: any[] = plan?.options ?? [];

  // The departure is held as its timestamp, not as an index: the option list is
  // rebuilt on every 15s tick and loses its head as trains pull out, so an index
  // would quietly slide onto a different train. A live journey resolves against
  // the frozen result it was started from.
  const selectionOptions: any[] = journeyMode === 'live' ? (result?.options ?? []) : options;
  const selectedOptionIdx = useMemo(() => {
    const fallback = (journeyMode === 'live' ? result : plan)?.recommendedOptionIdx ?? 0;
    if (selectedDepartMs == null) return fallback;
    const i = selectionOptions.findIndex((o: any) => o.departTimeMs === selectedDepartMs);
    return i >= 0 ? i : fallback;
  }, [selectionOptions, selectedDepartMs, journeyMode, result, plan]);
  const selectOption = (idx: number) => setSelectedDepartMs(options[idx]?.departTimeMs ?? null);

  const activeOption = selectionOptions[selectedOptionIdx] ?? plan;

  // Reset the selected departure and pop the sheet to mid whenever a new route
  // is planned. Return to the collapsed station peek when the route is cleared.
  const prevRouteKey = useRef<string | null>(null);
  useEffect(() => {
    if (routeKey && routeKey !== prevRouteKey.current) {
      setSelectedDepartMs(null);
      setSnap('mid');
    } else if (!routeKey && prevRouteKey.current) {
      // Clearing a route returns to the station sheet at its resting snap.
      setSnap('mid');
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

  // The station sheet rests lower than the route sheets: its mid snap is tuned
  // so the fold lands just under the departures preview, leaving more map.
  const midRatio = journeyMode === 'station' ? 0.48 : 0.42;

  // The station sheet's mid snap fits its own content instead of a fixed
  // fraction: it rests exactly at the end of the departures block, so an
  // interchange's four cards all fit and "Today's Schedule" stays below the
  // fold. Measured rather than derived from constants because the card count,
  // the chip row's wrapping and the location notice all move it.
  const [stationBlockH, setStationBlockH] = useState(0);
  useLayoutEffect(() => {
    const el = stationBlockRef.current;
    if (journeyMode !== 'station' || !el) {
      setStationBlockH(0);
      return;
    }
    const measure = () => setStationBlockH(el.offsetHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [journeyMode, station, locFailed]);

  // How much of the viewport the sheet covers at rest. The map nudges its centre
  // up by half of this, so it has to track the resting snap — feeding it the
  // collapsed peek would frame the nearest station against the sheet's edge.
  const containerH = containerRef.current?.clientHeight ?? window.innerHeight;
  const sheetInset =
    journeyMode === 'station' && stationBlockH > 0
      ? Math.min(Math.round(containerH * 0.88), COLLAPSED_H + stationBlockH)
      : Math.round(containerH * (1 - midRatio));

  // ── Sheet header per mode ─────────────────────────────────────────────────────
  let sheetHeader: ReactNode;
  if (journeyMode === 'live' && session && result) {
    sheetHeader = (
      <LiveJourneySummary
        result={result}
        session={session}
        onMaximize={() => setSnap(snap === 'collapsed' ? 'full' : 'collapsed')}
      />
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
        // A tap opens the sheet up a step rather than dismissing it; only the
        // handle drag and a tap on the map collapse it. Same ladder the planned
        // route's header uses.
        onClick={() => setSnap(snap === 'full' ? 'mid' : snap === 'mid' ? 'full' : 'mid')}
      >
        {/* Top row: line badge, name, favourite toggle */}
        <div className="flex items-center gap-3">
          <LineBadge line={station.line} size="lg" />
          <div className="flex-1 min-w-0">
            {/* Label only — an inline Interchange tag here wraps to a second
                line on a 375px screen and shoves the chip row below the
                collapsed fold. It lives in the chip row instead. */}
            <div
              className="text-[10px] font-bold uppercase tracking-widest truncate"
              style={{ color: 'var(--c-accent)' }}
            >
              {isNearest ? (locFailed ? 'Default station' : 'Nearest station') : 'Station'}
            </div>
            <div className="text-[22px] font-bold truncate leading-tight" style={{ color: 'var(--c-text)' }}>
              {station.name}
            </div>
          </div>
          {/* Stops the tap from also toggling the sheet snap. */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSaved(station.id); }}
            aria-pressed={isSaved(station.id)}
            aria-label={isSaved(station.id) ? 'Remove from favourites' : 'Add to favourites'}
            className="shrink-0 h-9 px-3 rounded-full flex items-center gap-1.5 text-[13px] font-semibold transition-transform active:scale-95"
            style={{
              background: 'var(--c-card)',
              border: '1px solid var(--c-border)',
              color: isSaved(station.id) ? 'var(--c-accent)' : 'var(--c-text-2)',
            }}
          >
            <Star size={15} strokeWidth={2.2} fill={isSaved(station.id) ? 'currentColor' : 'none'} />
            {isSaved(station.id) ? 'Saved' : 'Favorite'}
          </button>
        </div>

        {/* Chip row. Proximity (line, distance, walk) stays visible at every
            snap; expanding appends the structural chips and a status chip for
            when the line isn't running. */}
        <div className="flex items-center gap-2 flex-wrap">
          <Chip>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LINE_COLORS[station.line] }} />
            {LINE_NAMES[station.line] ?? station.line}
          </Chip>

          {isNearest && nearest?.distanceKm != null && (
            <>
              <Chip>
                <MapPin size={12} strokeWidth={2.4} style={{ color: 'var(--c-text-4)' }} />
                {formatDistance(nearest.distanceKm)}
              </Chip>
              <Chip>
                <Clock size={12} strokeWidth={2.4} style={{ color: 'var(--c-text-4)' }} />
                {formatDuration(walkMinsForKm(nearest.distanceKm))} walk
              </Chip>
            </>
          )}

          {snap !== 'collapsed' && (
            <>
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
  if (journeyMode === 'live' && result && session) {
    sheetBody = (
      <LiveJourneyScreen
        result={result}
        activeOptionIdx={selectedOptionIdx}
        session={session}
        onEnd={() => onClearResult?.()}
      />
    );
  } else if (journeyMode === 'plan' && plan) {
    sheetBody = (
      <>
        <JourneySummary
          result={plan}
          active={activeOption}
          options={options}
          selected={selectedOptionIdx}
          onSelect={selectOption}
          onStart={() => onStartJourney?.(selectedOptionIdx, plan)}
        />
        <div className="px-5 pb-8 flex flex-col gap-6">
          <RouteTimeline result={plan} active={activeOption} />
          <AllTrainsList
            options={options}
            selected={selectedOptionIdx}
            onSelect={selectOption}
            sourceName={plan.source.name}
          />
        </div>
      </>
    );
  } else {
    sheetBody = (
      <>
        {/* Everything down to the last departure card. The sheet's mid snap is
            sized to this block's height, so its bottom edge is the fold. */}
        <div ref={stationBlockRef}>
          {locFailed && (
            <div className="px-5 pt-4">
              <LocationNotice status={locStatus} onRetry={onRetryLocation} />
            </div>
          )}
          {station && (
            <div className="p-5 pb-4 max-w-[var(--layout-max-width)] mx-auto flex flex-col gap-6">
              <StationSheetActions
                stationId={station.id}
                isNearest={isNearest}
                coords={coords}
                onExpand={() => setSnap('full')}
              />
              <UpcomingTrains stationId={station.id} />
            </div>
          )}
        </div>
        {/* The full day's schedule continues below the preview; its own action
            pair is suppressed since the sheet supplies one above. */}
        {station && <StationDetailBody stationId={station.id} showHero={false} showActions={false} />}
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
          bottomInset={sheetInset}
          selectedStationId={selectedId}
          onSelectStation={selectStation}
          onMapTap={() => setSnap('collapsed')}
          panTo={panTo}
          routeLegs={routeLegs}
          routeKey={routeKey}
          routeEndpoints={routeEndpoints}
          routeBottomPad={routeBottomPad}
        />
      </Suspense>

      {/* Floating chrome — search then live line status, over the map. The
          sheet sits at z-[900] above this, so at its full snap it rises over
          the whole map and covers both the status pills and the search row. */}
      <div className="absolute top-0 inset-x-0 z-[600] pt-3 flex flex-col gap-2 pointer-events-none">
        <div className="px-4 pointer-events-auto">
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
        midRatio={midRatio}
        midContentHeight={journeyMode === 'station' && stationBlockH > 0 ? stationBlockH : undefined}
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
