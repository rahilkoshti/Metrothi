import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, Navigation, History, Star } from 'lucide-react';
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
import {
  MODE_LABELS,
  TRANSPORT_MODES,
  formatModeList,
  stationModes,
  stationSearchKeywords,
  stationsWithMode,
  type TransportMode,
} from '../stationFacilities';
import { LineBadge } from '../../../components/LineBadge';
import { LineStatusPills } from './LineStatusPills';
import { SearchBar } from './SearchBar';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listRecentTrips,
  listSavedJourneys,
  type RecentTrip,
  type SavedJourney,
} from '../../../data/db';
import { LINE_BADGE_BG, LINE_NAMES } from '../constants';
import { useWalkSpeed } from '../hooks/usePreferences';
import { track } from '../../../services/analytics';

const SEARCHABLE = STATIONS.filter((s) => s.operational !== false);

const LINE_ORDER = ['blue', 'red', 'yellow', 'violet'] as const;

// The stations behind each facet chip, resolved once — the facilities data is
// static. Modes with nothing behind them would render a dead chip, so they're
// dropped here rather than checked at render.
const CONNECTION_FACETS = TRANSPORT_MODES.map((mode) => ({
  mode,
  ids: new Set(stationsWithMode(mode)),
})).filter((f) => f.ids.size > 0);

/** "Ph.1 · Interchange · BRTS" — a station row's subtitle, minus what's absent. */
function stationMeta(s: StationRecord, parts: (string | null)[]) {
  const modes = stationModes(s.id);
  return [...parts, modes.length ? formatModeList(modes) : null].filter(Boolean).join(' · ');
}

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
  const { t } = useTranslation();
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
        {/* Line badges keep their own shape; bare glyph icons get a circular
            grey container so Recent/Saved/Landmark rows read like the Maps
            reference. */}
        {badge ? (
          <div className="w-9 flex justify-center shrink-0">{badge}</div>
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-card-alt)' }}
          >
            {icon}
          </div>
        )}
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
          aria-label={t('search.planTripHere')}
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
  onSettings,
  onSelectStation,
  onPlanTo,
  focusLine,
  nearestId,
}: {
  onClose: () => void;
  onSettings: () => void;
  onSelectStation: (id: string) => void;
  onPlanTo: (item: StationRecord | PlaceNode) => void;
  focusLine?: string | null;
  nearestId?: string | null;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceNode[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);

  // Scroll a target into view by moving ONLY the inner scroller — never
  // `scrollIntoView`, which walks up and scrolls ancestors (and the document),
  // shoving the fixed overlay's own header off-screen.
  const scrollToEl = (el: HTMLElement | null | undefined) => {
    const scroller = scrollerRef.current;
    if (!scroller || !el) return;
    scroller.scrollTop +=
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  };
  const scrollToLine = (line: string) =>
    scrollToEl(scrollerRef.current?.querySelector<HTMLElement>(`[data-line-group="${line}"]`));

  // Live from Dexie (§5.7) rather than read once on mount, so a journey saved on
  // the live-journey sheet shows up here without a remount.
  const recentTrips = useLiveQuery(listRecentTrips, [], [] as RecentTrip[]);
  const savedJourneys = useLiveQuery(listSavedJourneys, [], [] as SavedJourney[]);
  const { walkSpeedKmh } = useWalkSpeed();

  useEffect(() => {
    // When arriving from a line pill we're browsing that line's stations, so
    // don't steal focus into the input (and pop the keyboard) — the scroll to
    // the line group is the point.
    if (!focusLine) inputRef.current?.focus();
  }, []);

  const stationResults = useMemo(
    () =>
      query.trim()
        ? fuzzySearch(query, SEARCHABLE, (s) => s.name, (s) => stationSearchKeywords(s.id))
        : [],
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
        const found = await GeocodingService.searchPlaces(q);
        setPlaces(found);
        // §7.4, recorded as a boolean and nothing else. The query text is the
        // single most identifying thing a rider types into this app — "GIFT
        // City Club" at 08:30 on a stable device id is a person — so what
        // leaves is whether the geocoder resolved it, never what it was
        // (§5.8). `q.length` is a coarse bucket, not the string.
        track('place_resolved', { props: { matched: found.length > 0, queryLength: q.length } });
      } catch {
        setPlaces([]);
        track('place_resolved', { props: { matched: false, failed: true } });
      } finally {
        setLoadingPlaces(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const showEmptyState = !query.trim();

  return (
    <motion.div
      className="fixed inset-0 z-[1200] flex flex-col"
      style={{ background: 'var(--c-bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Search bar — the exact same shared pill as the home screen, in its
          'active' state, so nothing about its shape changes when the overlay
          opens. */}
      <div className="shrink-0 pt-3 pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="px-4">
          <SearchBar
            variant="active"
            placeholder={t('home.searchPlaceholder')}
            value={query}
            onChange={setQuery}
            onClose={onClose}
            onSettings={onSettings}
            loading={loadingPlaces}
            inputRef={inputRef}
          />
        </div>

        {/* Quick actions — mirror the home screen: live line-status pills first
            (right under the search bar), then the metro quick-chips. Only
            meaningful when browsing. */}
        {showEmptyState && (
          <div className="pt-2 flex flex-col gap-2">
            <LineStatusPills onSelectLine={scrollToLine} />
            {(nearestId || savedJourneys.length > 0) && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
                {nearestId && (
                  <Chip
                    icon={<Navigation size={14} style={{ color: 'var(--c-accent)' }} />}
                    label={t('home.nearestStation')}
                    onClick={() => onSelectStation(nearestId)}
                  />
                )}
                {savedJourneys.length > 0 && (
                  <Chip
                    icon={<Star size={14} style={{ color: 'var(--c-accent)' }} />}
                    label={t('common.saved')}
                    onClick={() => scrollToEl(savedRef.current)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto overscroll-contain">
        {showEmptyState ? (
          <>
            {savedJourneys.length > 0 && (
              <div ref={savedRef}>
                <SectionLabel icon={<Star size={12} style={{ color: 'var(--c-accent)' }} />} text={t('common.saved')} />
                {savedJourneys.map((j: any) => (
                  <Row
                    key={j.key}
                    icon={<Star size={16} style={{ color: 'var(--c-text-3)' }} />}
                    title={j.destName || j.destId}
                    meta={t('common.fromStation', { name: j.sourceName || j.sourceId })}
                    onClick={() => onSelectStation(j.destId)}
                  />
                ))}
              </div>
            )}
            {recentTrips.length > 0 && (
              <>
                <SectionLabel icon={<History size={12} style={{ color: 'var(--c-text-3)' }} />} text={t('common.recent')} />
                {recentTrips.map((j: any) => (
                  <Row
                    key={j.key}
                    icon={<History size={16} style={{ color: 'var(--c-text-3)' }} />}
                    title={j.dest?.name ?? t('common.trip')}
                    meta={t('common.fromStation', { name: j.source?.name ?? '' })}
                    onClick={() => onPlanTo(j.dest)}
                  />
                ))}
              </>
            )}
            {savedJourneys.length === 0 && recentTrips.length === 0 && (
              <p className="px-4 pt-5 text-[12px]" style={{ color: 'var(--c-text-4)' }}>
                {t('search.emptyHint')}
              </p>
            )}
            <AllStations onSelectStation={onSelectStation} onPlanTo={onPlanTo} focusLine={focusLine} />
          </>
        ) : (
          // Suggestions slide down out from under the search bar as they appear.
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {stationResults.length > 0 && <SectionLabel text={t('search.stations')} />}
            {stationResults.map((s) => (
              <Row
                key={s.id}
                badge={<LineBadge line={s.line} size="xs" />}
                title={s.name}
                // The connection is what explains a row that matched no part of
                // the name — "bus" returning Vadaj only reads as an answer once
                // the row says BRTS.
                meta={stationMeta(s, [s.interchange ? t('home.interchange') : null])}
                onClick={() => onSelectStation(s.id)}
                onDirections={() => onPlanTo(s)}
              />
            ))}

            {places.length > 0 && <SectionLabel text={t('search.landmarks')} />}
            {places.map((p) => {
              const near = nearestStationTo(p);
              return (
                <Row
                  key={p.id}
                  icon={<MapPin size={16} style={{ color: 'var(--c-text-3)' }} />}
                  eyebrow={t('search.nearestTo', { place: p.name })}
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
                      ? [
                          near.km < 1
                            ? t('common.distanceMetres', { value: Math.round(near.km * 1000) })
                            : t('common.distanceKm', { value: near.km.toFixed(1) }),
                          t('common.walk', { duration: formatDuration(walkMinsForKm(near.km, walkSpeedKmh)) }),
                        ].join(' · ')
                      : t('search.noStationNearby')
                  }
                  onClick={() => near && onSelectStation(near.station.id)}
                  onDirections={() => onPlanTo(p)}
                />
              );
            })}

            {stationResults.length === 0 && places.length === 0 && !loadingPlaces && (
              <p className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--c-text-4)' }}>
                {t('search.nothingFound', { query })}
              </p>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * The full network, grouped by line — the same shape as the Stations tab, so
 * the overlay doubles as a browsable directory when there's nothing to search.
 *
 * The connection facet (§4.4) filters it to the stations GMRC names as an
 * interchange with another mode, which is the one question the directory
 * couldn't answer before: where do I pick up the BRTS. It's single-select —
 * "BRTS and railways" has no useful reading, and every combination of two modes
 * here is at most one station.
 */
function AllStations({
  onSelectStation,
  onPlanTo,
  focusLine,
}: {
  onSelectStation: (id: string) => void;
  onPlanTo: (item: StationRecord) => void;
  focusLine?: string | null;
}) {
  const { t } = useTranslation();
  const focusRef = useRef<HTMLDivElement>(null);
  const [facet, setFacet] = useState<TransportMode | null>(null);
  const facetIds = facet ? CONNECTION_FACETS.find((f) => f.mode === facet)?.ids : null;

  // Jump the tapped line's group to the top of the directory. Runs in a layout
  // effect, before paint, so the list is already parked at the right line when
  // the overlay first shows — no visible scroll. Instant, not smooth: the
  // overlay is appearing fresh, so there's no jump to soften.
  useLayoutEffect(() => {
    if (!focusLine) return;
    focusRef.current?.scrollIntoView({ block: 'start' });
  }, [focusLine]);

  return (
    <>
      {/* `MODE_LABELS` stays English in every language: BRTS, GSRTC and Indian
          Railways are the operators' own names, and "High-speed rail" is how
          GMRC names that mode on the MMI page (§6.7). Only the frame is ours. */}
      <SectionLabel
        text={facet ? t('search.connectsTo', { mode: MODE_LABELS[facet] }) : t('search.allStations')}
      />

      {/* Scrolls horizontally like the quick-chip row above it: four labels this
          long don't fit 375px, and wrapping them would push the first line group
          off the screen. */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
        {CONNECTION_FACETS.map(({ mode, ids }) => (
          <Chip
            key={mode}
            label={`${MODE_LABELS[mode]} ${ids.size}`}
            active={facet === mode}
            onClick={() => setFacet(facet === mode ? null : mode)}
          />
        ))}
      </div>

      {LINE_ORDER.map((line) => {
        const stns = facetIds
          ? STATIONS_BY_LINE[line]?.filter((s) => facetIds.has(s.id))
          : STATIONS_BY_LINE[line];
        if (!stns?.length) return null;
        return (
          <div key={line} data-line-group={line} ref={line === focusLine ? focusRef : undefined}>
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
              const meta = stationMeta(s, [
                t('search.phase', { number: s.phase }),
                s.interchange ? t('home.interchange') : null,
                s.operational === false ? t('search.openingSoon') : null,
              ]);
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

function Chip({
  icon,
  label,
  onClick,
  active,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  /**
   * Toggled facets carry the same accent fill as the Station Info tabs. Left
   * undefined by the plain action chips, so they don't announce themselves as
   * an un-pressed toggle.
   */
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-2 rounded-full px-4 min-h-[44px] shrink-0 whitespace-nowrap active:scale-95 transition-transform"
      style={{
        background: active ? 'var(--c-accent)' : 'var(--c-card)',
        border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
      }}
    >
      {icon}
      <span
        className="text-[13px] font-semibold"
        style={{ color: active ? 'var(--c-accent-fg)' : 'var(--c-text)' }}
      >
        {label}
      </span>
    </button>
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
