import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Compass, X, MapPin, Bookmark, ArrowRight, Footprints } from 'lucide-react';
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
import { LINE_NAMES, LINE_COLOR } from '../constants';
import { stationImage } from '../stationImages';
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
import { StationSheetActions, openWalkingDirections } from './stationSheet/StationSheetActions';
import { NextDepartureHero } from './stationSheet/NextDepartureHero';
import { UpcomingTrains } from './stationSheet/UpcomingTrains';
import { useSavedStations } from '../hooks/useSavedStations';
import { useWalkSpeed } from '../hooks/usePreferences';
import type { useJourneySession } from '../hooks/useJourneySession';
import type { LocStatus } from '../../../App';

// Leaflet is heavy and now sits on the first-paint path, so it stays split out.
const HomeMap = lazy(() => import('../../map/components/HomeMap').then((m) => ({ default: m.HomeMap })));

// Floor for the station peek — the grab handle, the station eyebrow, and the
// countdown with its direction under it. A floor rather than a target: the
// header measures itself and `DraggableSheet`'s `Math.max` takes whichever is
// larger, so a service-status chip appearing, or a Gujarati direction wrapping,
// takes the peek with it instead of being sliced off at the fold.
const COLLAPSED_H = 118;
// Peek height for the planned-route header (title + chips row).
const PLAN_COLLAPSED_H = 104;
// Floor for the live-journey peek — deliberately *below* the summary's own
// height rather than tuned to it, so `DraggableSheet`'s `Math.max` always
// resolves to the header and the peek is the header exactly. The previous 96
// sat above it and the sheet spent every live journey showing 26px of a body
// that is only legible whole: the destination heading, sliced in half at the
// fold. The bar's shortest form is the arrived states, which drop their third
// band; this stays under that.
const LIVE_COLLAPSED_H = 80;

// Vertical space the floating chrome (search pill, then the line-status strip)
// claims at the top of the map. Floating controls have to clear it, or they'd
// sit underneath the pills and quietly eat taps meant for them.
const TOP_CHROME_H = 128;

/** Format distance in km or meters based on value. */
function useFormatDistance() {
  const { t } = useTranslation();
  return (km: number): string =>
    km < 1
      ? t('common.distanceMetres', { value: Math.round(km * 1000) })
      : t('common.distanceKm', { value: km.toFixed(1) });
}

/** A pill chip used across the sheet header. `alert` tints it for a
 *  service-status warning. */
function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'alert' }) {
  const alert = tone === 'alert';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-footnote tabular-nums whitespace-nowrap"
      /* The alert tone was a hand-mixed #f0997b on --c-bg: 2.00:1, and fixed
         across themes, so degraded service was announced in the one state it
         could not be read in. */
      style={{
        background: alert ? 'var(--c-warn-bg)' : 'var(--c-bg)',
        color: alert ? 'var(--c-warn)' : 'var(--c-text-2)',
        border: `1px solid ${alert ? 'var(--c-warn-border)' : 'var(--c-border)'}`,
      }}
    >
      {children}
    </span>
  );
}

/** Line chip — the line's name and why it isn't running.
 *
 *  Renders **nothing at all when the line is running**, which is the state it
 *  is in for most of the day: "Blue Line" beside a countdown whose own badge
 *  already says Blue Line is a chip spent on a fact nobody asked for, and this
 *  row had up to seven of those. What is left is only the exception — service
 *  ended, not started yet, bus only — which is worth a whole chip precisely
 *  because it is rare.
 *
 *  Isolated in its own component so the per-minute tick doesn't re-render the
 *  whole screen. */
function LineChip({ line }: { line: string }) {
  const { t } = useTranslation();
  const now = useNow();
  const status = estimateLine(line, now);

  let note: string | null;
  switch (status.status) {
    case 'running':
      note = null;
      break;
    case 'before-first-train':
      // `formatDuration` still returns "12 min" / "1h 05m" in every language —
      // it lives in the engine, which stays React-free, and localising it is
      // §6.6 phase 4's job across all twelve of its call sites.
      note = t('line.startsIn', { duration: formatDuration(status.minsUntilFirst) });
      break;
    case 'after-last-train':
      note = t('line.serviceEnded');
      break;
    case 'bus-only':
      note = t('line.busOnly');
      break;
    default:
      note = t('line.unavailable');
  }

  if (!note) return null;

  return (
    <Chip tone="alert">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LINE_COLOR[line] }} />
      <span style={{ color: 'var(--c-text-2)' }}>{LINE_NAMES[line] ?? line}</span>
      <span style={{ color: 'var(--c-text-4)' }}>·</span>
      {note}
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
  const { t } = useTranslation();
  const formatDistance = useFormatDistance();
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
  // True once the sheet has actually finished rising over the whole screen —
  // reported from the sheet's live position, not its snap, so the map stays
  // painted for the entire drag or spring.
  const [sheetCovers, setSheetCovers] = useState(false);
  // How tall the sheet stands at its current snap. The floating controls ride
  // above this instead of the collapsed peek, so they stay reachable wherever
  // the sheet rests. Reported by the sheet because the real peek can exceed
  // COLLAPSED_H when the header wraps.
  const [sheetEdge, setSheetEdge] = useState(COLLAPSED_H);

  const containerRef = useRef<HTMLDivElement>(null);
  // Wraps everything the sheet shows above the fold at its mid snap. Only one
  // body is mounted at a time, so the station sheet and the live journey share
  // the ref rather than each carrying their own.
  const midBlockRef = useRef<HTMLDivElement>(null);

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
  // Decorative: the station's name sits right beside it, so the photo carries
  // no information a screen reader needs and is labelled empty below.
  const photo = stationImage(station?.id);
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
  // The rider's pace (§8.1 phase E). In the dependency list on purpose: changing
  // it on the YOU screen should move the walk legs of a plan already on screen,
  // not wait for the next 15s tick to notice.
  const { walkSpeedKmh } = useWalkSpeed();
  const plan = useMemo(() => {
    if (!result) return null;
    return (
      planJourney(
        // Pass the station *id* when there's no real place: the engine treats any
        // non-string input as a place and runs findNearestStation on it, which
        // would re-tag the station as a place with a ~0 km walk and add a phantom
        // "Walk 1 min" row to the timeline.
        result.sourcePlace || result.sourceStation.id,
        result.destPlace || result.destStation.id,
        { queryTime: result.queryTime, actualNow: now, arriveBy: result.arriveBy, isLeaveNow: result.isLeaveNow, walkSpeedKmh }
      ) || result
    );
  }, [result, now, walkSpeedKmh]);

  // Stable id for the current route — drives the map's one-shot fit and the
  // sheet's snap/selection resets, without refiring on the 15s clock tick.
  const routeKey = result ? `${result.sourceStation?.id}->${result.destStation?.id}@${result.queryTime}` : null;

  // Memoised so the identity only changes when the plan behind it does — a bare
  // `?? []` mints a new array every render and silently defeats the useMemo below.
  const options: any[] = useMemo(() => plan?.options ?? [], [plan]);

  // The departure is held as its timestamp, not as an index: the option list is
  // rebuilt on every 15s tick and loses its head as trains pull out, so an index
  // would quietly slide onto a different train. A live journey resolves against
  // the frozen result it was started from.
  const selectionOptions: any[] = useMemo(
    () => (journeyMode === 'live' ? (result?.options ?? []) : options),
    [journeyMode, result, options]
  );
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

  // The planner is a *task*, so it takes the sheet whole — and the sheet is
  // where it belongs rather than the full-screen opaque takeover it used to be:
  // that discarded the map the rider was looking at and put its only exit in a
  // 40px `X` in the top-right, the hardest corner to reach one-handed. As a
  // sheet mode it matches plan and live, the map survives underneath, and the
  // dismissal a thumb actually reaches — dragging it back down — is the same
  // gesture that dismisses everything else here.
  useEffect(() => {
    if (plannerOpen) setSnap('full');
  }, [plannerOpen]);

  // Any snap below full while the planner is up *is* the dismissal. The sheet
  // has already animated to wherever the drag ended, so the snap is honoured
  // rather than overridden — the planner simply stops being what the sheet
  // holds, and the station header springs back into the peek behind it.
  const handleSnapChange = (next: SheetSnap) => {
    setSnap(next);
    if (plannerOpen && next !== 'full') closePlanner(true);
  };

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

  // Nothing of the map is on screen: the raised sheet and the search overlay
  // are each opaque and full-bleed. While that holds, the map is hidden
  // outright — no paint, no compositing — and its live-train ticker is stopped.
  // Leaflet keeps its size through `visibility`, so there's nothing to restore
  // on the way back.
  //
  // The planner is no longer named here, and that is the point of moving it
  // into the sheet: it hides the map by *covering* it, which `sheetCovers`
  // reports from the sheet's live position — so the first pixel of a drag-down
  // dismissal already has a map behind it.
  const mapHidden = sheetCovers || searchOpen;

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

  /**
   * Dismiss the planner.
   *
   * `viaDrag` when the sheet has already been carried to a snap the rider
   * chose. Every other route in — the close control, Escape — leaves the sheet
   * standing at `full`, and without putting it back the planner would vanish
   * and be replaced by the station sheet expanded over the whole map: the
   * rider asked to leave and got a different screen at the same size.
   */
  function closePlanner(viaDrag = false) {
    setPlannerOpen(false);
    setPrefillSource(null);
    setPrefillDest(null);
    if (!viaDrag) setSnap('mid');
  }

  function handlePlanFromModal(source: any, dest: any, config?: any) {
    setPlannerOpen(false);
    setPrefillSource(null);
    setPrefillDest(null);
    // The rider's pace rides along with every plan (§8.1 phase E). Merged here
    // rather than read inside the engine, which stays free of the store — and
    // here rather than in the shell, which would then observe `prefs` on the
    // boot path for a value only this path uses.
    onPlan(source, dest, { ...config, walkSpeedKmh });
  }

  const collapsedHeight =
    journeyMode === 'plan' ? PLAN_COLLAPSED_H : journeyMode === 'live' ? LIVE_COLLAPSED_H : COLLAPSED_H;

  // The station sheet rests lower than the route sheets: its mid snap is tuned
  // so the fold lands just under the departures preview, leaving more map.
  const midRatio = journeyMode === 'station' ? 0.48 : 0.42;

  // Two of the three modes fit their mid snap to their own content instead of a
  // fixed fraction, so the fold lands on a boundary rather than part-way through
  // a row: the station sheet rests at the end of the departures block, and the
  // live journey at the end of its controls. Measured rather than derived from
  // constants because the card count, the chip row's wrapping, the location
  // notice and the action row's scroll all move it.
  const [midBlockH, setMidBlockH] = useState(0);
  useLayoutEffect(() => {
    const el = midBlockRef.current;
    if (journeyMode === 'plan' || !el) {
      setMidBlockH(0);
      return;
    }
    const measure = () => setMidBlockH(el.offsetHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
    // `plannerOpen` is in here because the planner replaces the sheet body
    // entirely: without it this keeps observing the block it measured before,
    // which is detached by the time the planner closes and a fresh one mounts.
  }, [journeyMode, station, locFailed, plannerOpen]);

  const containerH = containerRef.current?.clientHeight ?? window.innerHeight;

  // Whether a floating control of a given size still fits in the map strip the
  // sheet leaves exposed. The station sheet's mid snap fits its content, so on a
  // big interchange it can stand ~715px of an 812px viewport and there is simply
  // nowhere on-screen to put a 56px FAB. Hide rather than park it off-screen or
  // under the search pill.
  const controlFits = (gap: number, size: number) =>
    snap !== 'full' && containerH - (sheetEdge + gap + size) >= TOP_CHROME_H;
  const fabFits = controlFits(72, 56);
  const recentreFits = controlFits(16, 44);

  // ── Sheet header per mode ─────────────────────────────────────────────────────
  let sheetHeader: ReactNode;
  if (plannerOpen) {
    // The planner's own title, hoisted out of its body so it stays put while
    // the form scrolls — and so the close control sits beside it rather than
    // floating over a screen it isn't part of.
    sheetHeader = (
      <div className="flex items-start gap-3 px-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="text-caption uppercase" style={{ color: 'var(--c-text-3)' }}>
            {t('planner.eyebrow')}
          </div>
          <h2 className="text-title-2" style={{ color: 'var(--c-text)' }}>
            {t('planner.title')}
          </h2>
        </div>
        <button
          /* Wrapped, not passed: a bare `onClick={closePlanner}` hands the
             MouseEvent to `viaDrag`, where it is truthy — and the sheet would
             be left standing at full. */
          onClick={() => closePlanner()}
          aria-label={t('home.closePlanner')}
          className="hit-44 shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-[0.97] transition-transform"
          style={{ background: 'var(--c-bg)' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={20} strokeWidth={2} style={{ color: 'var(--c-text)' }} />
        </button>
      </div>
    );
  } else if (journeyMode === 'live' && session && result) {
    sheetHeader = (
      <LiveJourneySummary
        result={result}
        session={session}
        snap={snap}
        // The same ladder the other two headers use: a tap opens the sheet a
        // step, it never dismisses it. Mid was previously unreachable by tap —
        // this jumped straight to full — which left the snap with no way in but
        // a drag, and nothing sized to rest at.
        onMaximize={() => setSnap(snap === 'full' ? 'mid' : snap === 'mid' ? 'full' : 'mid')}
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
          {/* Static facts about the route only. The chosen departure's times —
              arrival included — belong to the summary below, which re-derives
              them when you switch trains; carrying arrival here as well printed
              the same clock time twice, one above the other. */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Chip>{t('common.stops', { count: plan.totalStops })}</Chip>
            {plan.numTransfers > 0 && <Chip>{t('common.transfers', { count: plan.numTransfers })}</Chip>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClearResult?.(); }}
          aria-label={t('home.clearRoute')}
          className="hit-44 shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-[0.97] transition-transform"
          style={{ background: 'var(--c-bg)' }}
        >
          <X size={20} strokeWidth={2} style={{ color: 'var(--c-text)' }} />
        </button>
      </div>
    );
  } else {
    sheetHeader = station ? (
      <div
        /* A grid rather than a column of flex rows, so the two action buttons
           can sit visually in the top row while coming *last* in source. Read
           in DOM order the old markup announced "Nearest station, Old High
           Court, walking directions, save, next train in 4 minutes, 400 m,
           6 min walk" — the actions interrupting the subject before any of its
           facts. Nothing moves on screen: the actions are placed back into the
           top-right cell by `row-start-1 col-start-2` below.

           Rows are auto-placed, deliberately not numbered: the chip row carries
           `empty:hidden` and is a grid item only when it has chips, so an
           explicit third row would keep spending its 12px gap on the days it
           renders nothing. `minmax(0,1fr)` rather than `1fr` because a grid
           track's automatic minimum is its content, which would stop the
           station name truncating. */
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 pb-3"
        // A tap opens the sheet up a step rather than dismissing it; only the
        // handle drag and a tap on the map collapse it. Same ladder the planned
        // route's header uses.
        onClick={() => setSnap(snap === 'full' ? 'mid' : snap === 'mid' ? 'full' : 'mid')}
      >
        {/* Top row: the station's *identity*, as an eyebrow. It used to be the
            headline — a 10px label over the name at 22px, with the departure
            arriving third, under a seven-chip row. The rider standing on that
            platform already knows which station they are in; the map behind
            this sheet is telling them. What they do not know is whether to run,
            so the two have swapped places (§16/2.1). */}
        <div className="min-w-0 flex items-center gap-3">
          {/* Shown only for stations we actually have a photo of; the row just
              closes up for the rest rather than falling back to a stand-in.
              Sized to the name block beside it so the collapsed peek height
              stays put. */}
          {photo && (
            <img
              src={photo}
              alt=""
              width={40}
              height={40}
              // Deliberately not lazy: it's above the fold in the sheet's
              // resting header, and 18 KB deferred just buys a visible pop-in.
              decoding="async"
              className="w-10 h-10 rounded-full object-cover shrink-0"
              style={{ border: '1px solid var(--c-border)' }}
            />
          )}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 text-caption">
            <span className="uppercase shrink-0" style={{ color: 'var(--c-text-3)' }}>
              {isNearest ? t(locFailed ? 'home.defaultStation' : 'home.nearestStation') : t('home.station')}
            </span>
            <span aria-hidden="true" style={{ color: 'var(--c-text-4)' }}>·</span>
            <span className="truncate" style={{ color: 'var(--c-text)' }}>{station.name}</span>
          </div>
        </div>

        {/* The headline: when the next train is, and which way it goes. */}
        <div className="col-span-2">
          <NextDepartureHero stationId={station.id} />
        </div>

        {/* Chip row — what is left of it. Seven equal-weight chips is the
            absence of a hierarchy decision, and it wrapped to two lines at
            360px. Split by species instead:
              · the line chip renders only when the line *isn't* running, and
                the departure's own badge carries line identity the rest of the
                time;
              · distance and walk time answer one question — "how far is it" —
                so they are one chip, not two;
              · interchange and the connecting modes moved out entirely rather
                than below the fold. They are already rendered, properly and
                with GMRC's own wording, by the Station Info tab a tap away
                (§4.4.1) — a chip repeating them here was the third place the
                app said the same thing.
            Most of the day this row holds nothing, and `empty:hidden` is what
            keeps it from spending a 12px flex gap on that — rather than
            hoisting `estimateLine` up here to find out, which would put the
            per-minute tick back on the whole screen. */}
        <div className="col-span-2 flex items-center gap-2 flex-wrap empty:hidden">
          <LineChip line={station.line} />
          {isNearest && nearest?.distanceKm != null && (
            <Chip>
              <MapPin size={12} strokeWidth={2.4} aria-hidden="true" style={{ color: 'var(--c-text-4)' }} />
              {formatDistance(nearest.distanceKm)}
              <span aria-hidden="true" style={{ color: 'var(--c-text-4)' }}>·</span>
              {t('common.walk', { duration: formatDuration(walkMinsForKm(nearest.distanceKm, walkSpeedKmh)) })}
            </Chip>
          )}
        </div>

        {/* The two actions — last in source, placed back into the top row's
            right-hand cell. Each stops propagation so the tap doesn't also
            toggle the sheet snap; the wrapper is `self-center` because the grid
            stretches items by default and these are 36px against a 40px photo. */}
        <div className="row-start-1 col-start-2 self-center shrink-0 flex items-center gap-2">
          {/* Walking directions — only at the nearest station, where the walk is
              actually the next thing you do. Google Maps owns the street-level
              leg, so it stays a quiet icon beside the bookmark rather than
              competing with Start Journey below. */}
          {isNearest && (
            <button
              onClick={(e) => { e.stopPropagation(); openWalkingDirections(station.id, coords); }}
              aria-label={t('home.walkingDirections', { station: station.name })}
              className="hit-44 shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-[0.97]"
              style={{
                background: 'var(--c-bg)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text-2)',
              }}
            >
              <Footprints size={16} strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSaved(station.id); }}
            aria-pressed={isSaved(station.id)}
            aria-label={t(isSaved(station.id) ? 'home.unsaveStation' : 'home.saveStation')}
            /* Unsaved is a bare bookmark — the icon alone reads as "save", so the
               square icon button keeps the header uncluttered. Saved widens into
               a labelled pill to confirm the state. */
            className={`shrink-0 h-9 rounded-full flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-transform active:scale-95 ${
              isSaved(station.id) ? 'px-3' : 'w-9'
            }`}
            style={{
              background: 'var(--c-bg)',
              border: '1px solid var(--c-border)',
              color: isSaved(station.id) ? 'var(--c-accent)' : 'var(--c-text-2)',
            }}
          >
            <Bookmark size={15} strokeWidth={2.2} fill={isSaved(station.id) ? 'currentColor' : 'none'} />
            {isSaved(station.id) && t('common.saved')}
          </button>
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
  if (plannerOpen) {
    sheetBody = (
      <Planner
        onPlan={handlePlanFromModal}
        nearest={nearest}
        locStatus={locStatus}
        onRetryLocation={onRetryLocation}
        prefillSource={prefillSource}
        prefillDest={prefillDest}
      />
    );
  } else if (journeyMode === 'live' && result && session) {
    sheetBody = (
      <LiveJourneyScreen
        result={result}
        activeOptionIdx={selectedOptionIdx}
        session={session}
        midBlockRef={midBlockRef}
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
        <div ref={midBlockRef}>
          {locFailed && (
            <div className="px-5 pt-4">
              <LocationNotice status={locStatus} onRetry={onRetryLocation} />
            </div>
          )}
          {station && (
            <div className="p-5 pb-4 max-w-[var(--layout-max-width)] mx-auto flex flex-col gap-6">
              <UpcomingTrains stationId={station.id} onViewAll={() => setSnap('full')} />
              <StationSheetActions stationId={station.id} isNearest={isNearest} />
            </div>
          )}
        </div>
        {/* The full day's schedule continues below the preview; its own action
            pair is suppressed since the sheet supplies one above. */}
        {station && <StationDetailBody stationId={station.id} showHero={false} showActions={false} surface="sheet" />}
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
      {/* Wrapper carries the hide toggle so the map itself never unmounts —
          remounting Leaflet would drop the user's pan and zoom. Its background
          matches the sheet's, so the strip under the sheet's rounded top
          corners stays seamless while the map is hidden. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--c-bg)',
          visibility: mapHidden ? 'hidden' : 'visible',
          // Lifts the map's attribution control clear of the sheet's resting
          // edge. Published as a custom property rather than a prop because
          // the consumer is Leaflet's own control container, which this tree
          // doesn't render — see `.leaflet-bottom.leaflet-left` in index.css.
          '--map-attrib-bottom': `${sheetEdge}px`,
        } as React.CSSProperties}
        aria-hidden={mapHidden}
      >
        <Suspense
          fallback={
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'var(--c-card-alt)', color: 'var(--c-text-4)' }}
            >
              <span className="text-sm tracking-wide">{t('home.loadingMap')}</span>
            </div>
          }
        >
          <HomeMap
            coords={coords}
            nearest={nearest}
            bottomInset={sheetEdge}
            selectedStationId={selectedId}
            onSelectStation={selectStation}
            onMapTap={() => setSnap('collapsed')}
            panTo={panTo}
            routeLegs={routeLegs}
            routeKey={routeKey}
            routeEndpoints={routeEndpoints}
            routeBottomPad={routeBottomPad}
            paused={mapHidden}
          />
        </Suspense>
      </div>

      {/* Floating chrome — search then live line status, over the map. The
          sheet sits at z-[900] above this, so at its full snap it rises over
          the whole map and covers both the status pills and the search row. */}
      <div
        className="absolute top-0 inset-x-0 z-[600] flex flex-col gap-2 pointer-events-none"
        /* `viewport-fit=cover` is opted into in index.html, so without this the
           search pill draws underneath the status bar and the notch. */
        style={{ paddingTop: 'calc(var(--sat) + var(--sp-3))' }}
      >
        <div className="px-4 pointer-events-auto">
          <SearchBar
            variant="idle"
            placeholder={t('home.searchPlaceholder')}
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

      {/* Floating map controls — they ride on the sheet's resting edge rather
          than the collapsed peek, so they stay above it at every snap. Only the
          full snap hides them, and there they'd be off-screen anyway: the sheet
          covers the map, so there is nothing left to recentre or plan against. */}

      {/* Plan Route FAB — only in the default station mode. */}
      {journeyMode === 'station' && (
        <button
          onClick={() => { setPrefillSource(null); setPrefillDest(null); setPlannerOpen(true); }}
          aria-label={t('home.planRoute')}
          className="absolute right-4 z-[600] w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-[0.97]"
          style={{
            bottom: `calc(${sheetEdge + 72}px + var(--sab))`,
            background: 'var(--c-accent)',
            color: 'var(--c-accent-fg)',
            boxShadow: 'var(--shadow-float)',
            opacity: fabFits ? 1 : 0,
            pointerEvents: fabFits ? 'auto' : 'none',
          }}
        >
          <Compass size={24} strokeWidth={2.2} />
        </button>
      )}

      {/* Recentre */}
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('home-recenter'))}
        aria-label={t('home.recentreMap')}
        /* Same material as the search pill, the status strip and the sheet.
           These three pieces of chrome sit on one plane over the map and had
           grown three unrelated treatments — a shadow-2xl, a hand-rolled
           0 6px 24px, and a blur — so they read as unrelated objects. */
        className="hit-44 absolute right-4 z-[600] w-11 h-11 rounded-full flex items-center justify-center transition-opacity duration-200 active:scale-[0.97]"
        style={{
          bottom: `calc(${sheetEdge + 16}px + var(--sab))`,
          background: 'var(--surface-float)',
          backdropFilter: 'var(--blur-float)',
          WebkitBackdropFilter: 'var(--blur-float)',
          border: '1px solid var(--border-float)',
          boxShadow: 'var(--shadow-float)',
          opacity: recentreFits ? 1 : 0,
          pointerEvents: recentreFits ? 'auto' : 'none',
        }}
      >
        <LocateFixed size={20} strokeWidth={2} style={{ color: 'var(--c-text)' }} />
      </button>

      {/* Sheet — station detail, planned route, or live journey depending on
          journeyMode. Rendered directly — no full-bleed wrapper, or it would
          sit over the map and swallow every pan, zoom and marker tap. */}
      <DraggableSheet
        className="z-[900]"
        snap={snap}
        onSnapChange={handleSnapChange}
        collapsedHeight={collapsedHeight}
        midRatio={midRatio}
        midContentHeight={plannerOpen || midBlockH === 0 ? undefined : midBlockH}
        header={sheetHeader}
        onCoverageChange={setSheetCovers}
        onRestEdgeChange={setSheetEdge}
        // A task, not a surface: while it holds the planner the sheet is a
        // dialog and everything behind it stops being reachable by Tab.
        modal={plannerOpen ? { label: t('planner.title'), onDismiss: () => closePlanner() } : undefined}
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

    </div>
  );
}
