import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Accessibility,
  DoorOpen,
  MapPin,
  Navigation2,
  AlertTriangle,
  ChevronDown,
  Clock,
  Info,
  Layers,
  Waypoints,
  Milestone,
  Timer,
  Radio,
  MoonStar,
  Bus,
  type LucideIcon,
} from "lucide-react";
import {
  STATION_BY_ID,
  fullDayStationSchedule,
  estimateLine,
  formatDuration,
  LINE_META,
  LINE_PATHS,
} from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";
import type { DayScheduleDirection, DayTrain } from "../engine/journeyEngine";

import { LineBadge } from "../../../components/LineBadge";
import { SectionLabel, FactChip, FactNote, StatTile } from "../../../components/FactPrimitives";
import { LINE_NAMES } from "../constants";
import {
  stationFacilities,
  accessibleGates,
  gateNumbers,
  MODE_LABELS,
  type StationFacilities,
} from "../stationFacilities";
import { TrainRouteSheet } from "./TrainRouteSheet";
import { DepartureRow } from "./DepartureRow";
import { track } from "../../../services/analytics";

// ─── Per-direction departure board ───────────────────────────────────
type MergedTrain = DayTrain & { dir: DayScheduleDirection };

/** How many upcoming departures a direction shows before deferring to the
 *  full timetable. Six is roughly an hour on the busiest line and two on the
 *  quietest — past that a rider is reading a timetable, not catching a train. */
const UPCOMING_PREVIEW = 6;

/**
 * One direction's departures.
 *
 * This replaces a single time-sorted list of **the entire operating day** —
 * both directions interleaved, departed trains first, inside a 360px scroller
 * nested in the sheet's own scroller inside the sheet's drag. Three things were
 * wrong with that at once, and they were the same thing: nothing had decided
 * what the rider was here to find out.
 *
 *   - The first impression of a station was twenty-odd trains that had already
 *     gone. They collapse to one row now, and open if you want them.
 *   - "Which of these is mine" was answered by a colour and a first initial.
 *     A direction is a heading now, worded the way the platform words it.
 *   - Same-axis scrolling inside a drag is the one thing the HIG says never to
 *     do. Twelve rows fit; the scroller is gone, and with it the auto-anchor
 *     that existed to hide the departed trains it opened on — the next train is
 *     simply first now.
 */
function DirectionBoard({
  dir,
  line,
  onSelect,
}: {
  dir: DayScheduleDirection;
  line: string;
  onSelect: (train: DayTrain) => void;
}) {
  const { t } = useTranslation();
  const [showDeparted, setShowDeparted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const departed = dir.trains.filter((x) => x.departed);
  const upcoming = dir.trains.filter((x) => !x.departed);
  const shown = showAll ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW);
  const hidden = upcoming.length - shown.length;

  const row = (train: DayTrain) => (
    <DepartureRow
      key={train.id}
      line={line}
      destinationId={dir.destinationId}
      destinationName={dir.destinationName}
      clockTime={train.clockTime}
      waitMins={train.waitMins}
      primary="time"
      // No "Next ·" prefix any more: under a heading that names the direction,
      // the first row *is* the next one, and the label was printed on one row
      // per direction per line — four identical "Next"s at an interchange.
      highlight={train.isNext}
      departed={train.departed}
      onClick={() => onSelect(train)}
    />
  );

  return (
    <div
      className="flex flex-col gap-2 px-3 py-3 border-t first:border-t-0"
      style={{ background: "var(--c-bg)", borderColor: "var(--c-border)" }}
    >
      {/* The terminus, which is the word actually printed on the platform. */}
      <h3 className="text-caption uppercase px-1" style={{ color: "var(--c-text-3)" }}>
        {t('journey.towards', { station: dir.destinationName })}
      </h3>

      {departed.length > 0 && (
        <Disclosure
          open={showDeparted}
          onToggle={() => setShowDeparted((v) => !v)}
          label={t('journey.earlierTrains', { count: departed.length })}
        />
      )}
      {showDeparted && departed.map(row)}

      {shown.map(row)}

      {upcoming.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-5 text-center text-footnote"
          style={{ background: "var(--c-card)", color: "var(--c-text-4)" }}
        >
          {t('journey.noMoreTrains')}
        </div>
      ) : hidden > 0 ? (
        <Disclosure open={false} onToggle={() => setShowAll(true)} label={t('journey.fullTimetable')} />
      ) : (
        showAll && (
          <div className="py-2 text-center">
            <span className="text-caption uppercase" style={{ color: "var(--c-text-4)" }}>
              {t('station.endOfService')}
            </span>
          </div>
        )
      )}
    </div>
  );
}

/** The one control shape both disclosures on this board use. */
function Disclosure({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center justify-center gap-1.5 rounded-2xl text-footnote transition-colors active:opacity-70"
      style={{
        minHeight: 'var(--touch-min)',
        background: "var(--c-card)",
        border: "1px solid var(--c-border)",
        color: "var(--c-text-2)",
      }}
    >
      {label}
      <ChevronDown
        size={16}
        strokeWidth={2.2}
        aria-hidden="true"
        style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform var(--dur-state)" }}
      />
    </button>
  );
}

// ─── Per-line card ───────────────────────────────────────────────────
function LineScheduleCard({
  stationId,
  line,
  autoOpenDirDest,
  surface = "page",
}: {
  stationId: string;
  line: string;
  autoOpenDirDest?: string;
  /** "page" (default) sits on the standalone station page's grey --c-bg, so
   *  the card is white (--c-card). "sheet" sits inside the home sheet, which
   *  is itself --c-card, so the card goes grey (--c-bg) instead. */
  surface?: "page" | "sheet";
}) {
  const { t } = useTranslation();
  const cardBg = surface === "sheet" ? "var(--c-bg)" : "var(--c-card)";
  const now = useNow();
  const station = STATION_BY_ID[stationId];

  const schedule = useMemo(
    () => fullDayStationSchedule(stationId, line, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationId, line, now.getMinutes()]
  );

  // The route sheet a tapped train opens. Held here rather than per direction
  // so only one can be open at a time, and so the deep link below has one
  // place to write to.
  const [selectedTrain, setSelectedTrain] = useState<MergedTrain | null>(null);

  // Deep link: open the next train heading to the named terminal.
  useEffect(() => {
    if (!autoOpenDirDest) return;
    const dir = schedule.find(
      (d) => d.destinationName.toLowerCase() === autoOpenDirDest.toLowerCase()
    );
    const train = dir?.trains.find((x) => x.isNext && !x.departed) ?? dir?.trains.find((x) => !x.departed);
    if (dir && train) setSelectedTrain({ ...train, dir });
    // Only on mount — a link is followed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = estimateLine(line, now);

  if (station.operational === false) {
    return (
      <div
        className="rounded-2xl p-6 text-center flex flex-col items-center gap-3"
        style={{ background: cardBg }}
      >
        <AlertTriangle size={22} style={{ color: "var(--c-text-3)" }} />
        <p className="font-semibold text-sm" style={{ color: "var(--c-text-3)" }}>
          {t('station.notYetOpen')}
        </p>
      </div>
    );
  }

  if (schedule.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: cardBg }}>
      {/* Line header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        <LineBadge line={line} size="md" />
        <div>
          <div className="font-bold text-sm" style={{ color: "var(--c-text)" }}>
            {LINE_NAMES[line]}
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "var(--c-text-4)" }}>
            {t('station.everyMinsBothWays', { mins: LINE_META[line].avgFrequencyMins })}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {status.status === "running" && (
            <ServiceStatus tone="good" icon={Radio} label={t('line.live')} />
          )}
          {status.status === "after-last-train" && (
            <ServiceStatus tone="error" icon={MoonStar} label={t('line.serviceEnded')} />
          )}
          {status.status === "before-first-train" && (
            <ServiceStatus
              tone="warn"
              icon={Clock}
              label={t('line.startsIn', { duration: formatDuration(status.minsUntilFirst) })}
            />
          )}
          {status.status === "bus-only" && (
            <ServiceStatus tone="info" icon={Bus} label={t('line.busOnly')} />
          )}
        </div>
      </div>

      {schedule.map((dir) => (
        <DirectionBoard
          key={dir.destinationId}
          dir={dir}
          line={line}
          onSelect={(train) => setSelectedTrain({ ...train, dir })}
        />
      ))}

      {selectedTrain && (
        <TrainRouteSheet
          stationId={stationId}
          line={line}
          dir={selectedTrain.dir}
          train={selectedTrain}
          now={now}
          onClose={() => setSelectedTrain(null)}
        />
      )}
    </div>
  );
}

/**
 * Whether a line is running at this station right now.
 *
 * Four states that were four raw Tailwind palette classes at 9px — green
 * 2.28:1, yellow 1.92, red 2.77, violet 2.64 — bypassing the token layer
 * entirely, on what is safety information: whether there is a train coming at
 * all. The `live` state also spent an `animate-pulse` on it.
 *
 * The icon is not decoration. Three of these four hues are neighbours of the
 * line palette drawn six inches away on the same screen, so the glyph and the
 * word are what actually carry the state (WCAG 1.4.1) and the colour only
 * reinforces it.
 */
function ServiceStatus({
  tone,
  icon: Icon,
  label,
}: {
  tone: 'good' | 'warn' | 'error' | 'info';
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      className="flex items-center gap-1.5 text-footnote font-bold text-right"
      style={{ color: `var(--c-${tone})` }}
    >
      <Icon size={16} strokeWidth={2.2} className="shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── Schedule / Station Info tabs ──────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center justify-center gap-1.5 rounded-control text-footnote font-bold transition-all active:scale-[0.97]"
      style={{
        minHeight: 'var(--touch-min)',
        background: active ? "var(--c-accent)" : "var(--c-card-alt)",
        color: active ? "var(--c-accent-fg)" : "var(--c-text-3)",
      }}
    >
      <Icon size={16} strokeWidth={2.2} />
      {label}
    </button>
  );
}

function AttributeCard({
  icon: Icon,
  title,
  description,
  cardBg,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cardBg: string;
}) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
      <Icon size={20} strokeWidth={2} style={{ color: "var(--c-accent-text)" }} />
      <div>
        <div className="text-[13px] font-bold" style={{ color: "var(--c-text)" }}>
          {title}
        </div>
        <div className="text-[11px] font-semibold mt-0.5 leading-snug" style={{ color: "var(--c-text-4)" }}>
          {description}
        </div>
      </div>
    </div>
  );
}

/**
 * GMRC's kebab-cased amenity keys, as prose. English in every language: the
 * keys are GMRC's own names for what the station has, and there are three of
 * them across 54 stations — a bundle entry per key would be translating the
 * source rather than our chrome (§6.7).
 */
function amenityLabel(key: string): string {
  return key.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Which numbered gates are open, per GMRC. The numbers are theirs, reproduced
 * verbatim so they match the signage outside the station — never re-indexed to
 * 1..n. No denominator is shown ("6 of 8 open"): GMRC publishes the operational
 * gates, not the built ones, so the total is not ours to state.
 */
function EntrancesBlock({ facilities, cardBg }: { facilities: StationFacilities; cardBg: string }) {
  const { t } = useTranslation();
  if (facilities.gates.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={DoorOpen} text={t('station.entrances')} />
      <div className="rounded-2xl p-3.5" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
        <div className="flex flex-wrap gap-2">
          {facilities.gates.map((g) => (
            <FactChip key={g} text={t('journey.gateList', { count: 1, gates: String(g) })} />
          ))}
        </div>
        <FactNote text={t('station.entrancesNote')} />
      </div>
    </div>
  );
}

/**
 * Where the lifts are — stated positively only. GMRC publishes which gate each
 * lift serves; it never publishes where a lift is absent, so "Gate 2 has no
 * lift" is a claim the source does not make and this block does not imply it.
 * Lift numbers are GMRC's own (they aren't sequential with the gate numbers)
 * so a rider can match them to the signage.
 */
function StepFreeBlock({ facilities, cardBg }: { facilities: StationFacilities; cardBg: string }) {
  const { t } = useTranslation();
  const gates = accessibleGates(facilities);
  if (gates.length === 0) return null;
  /** "Gate 4" / "Gates 1, 2 & 4" — the inflecting word comes from the bundle,
   *  the numbers from the language-free helper. */
  const gateList = (g: number[]) => t('journey.gateList', { count: g.length, gates: gateNumbers(g) });
  return (
    <div>
      <SectionLabel icon={Accessibility} text={t('station.stepFreeAccess')} />
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
        <div className="px-4 py-3 text-[13px] font-bold" style={{ color: "var(--c-text)" }}>
          {t('station.stepFreeEntry', { gates: gateList(gates) })}
        </div>
        {facilities.lifts.map((l) => (
          <div
            key={l.lift}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderTop: "1px solid var(--c-border)" }}
          >
            <div className="flex-1 min-w-0 text-[12px] font-bold" style={{ color: "var(--c-text-3)" }}>
              {t('station.lift', { number: l.lift })}
            </div>
            <div className="text-[12px] font-bold tabular-nums" style={{ color: "var(--c-text)" }}>
              {gateList(l.gates)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The other transport this station physically connects to, on the 10 stations
 * GMRC names. Each connection carries GMRC's own wording and the Entry-Exit it
 * uses, which is the same numbering as `EntrancesBlock` above.
 *
 * Renders nothing at all on the other 43 — absence in the source means "GMRC
 * lists no *built* interchange here", not "no buses nearby", so a "No
 * connections" line would be a false negative (PRD §4.4.1, §7.6).
 */
function ConnectionsBlock({ facilities, cardBg }: { facilities: StationFacilities; cardBg: string }) {
  const { t } = useTranslation();
  const mm = facilities.multiModal;
  // PDEU is the one station with an amenity but no interchange, so this block
  // is keyed off having *something* to say rather than off `modes` alone.
  if (!mm || (mm.connections.length === 0 && !mm.amenities?.length)) return null;
  const hasChips = mm.modes.length > 0 || (mm.amenities?.length ?? 0) > 0;
  return (
    <div>
      <SectionLabel icon={ArrowLeftRight} text={t('station.connections')} />
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
        {hasChips && (
          <div className="flex flex-wrap gap-2 px-3.5 pt-3.5 pb-1">
            {mm.modes.map((m) => (
              <FactChip key={m} text={MODE_LABELS[m]} tone="accent" />
            ))}
            {mm.amenities?.map((a) => (
              <FactChip key={a} text={amenityLabel(a)} />
            ))}
          </div>
        )}
        {mm.connections.map((c, i) => (
          <div
            key={i}
            className="px-4 py-3"
            style={{ borderTop: i === 0 && !hasChips ? "none" : "1px solid var(--c-border)" }}
          >
            {c.gate !== null && (
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--c-text-4)" }}>
                {t('journey.gateList', { count: 1, gates: String(c.gate) })}
              </div>
            )}
            {/* GMRC's own wording, verbatim (§6.7) — never translated by us.
                Their sentences, so they are set as prose on the reference
                ladder rather than in the 12.5px the rest of this fact panel
                uses: this is the one Species C content on the Info tab. */}
            <div className="text-read-body" style={{ color: "var(--c-text-2)" }}>
              {c.text}
            </div>
          </div>
        ))}
        {mm.connections.length === 0 && (
          <div className="px-4 pb-3.5 pt-1 text-read-body" style={{ color: "var(--c-text-2)" }}>
            {mm.summary}
          </div>
        )}
        {mm.sourceNote && (
          <div className="px-4 pb-3.5">
            <FactNote text={mm.sourceNote} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The "Station Info" tab. Two sources, both first-party:
 *
 * - stations.json / the schedule engine — line membership, phase, position on
 *   the line, interchange/terminus, and today's real first/last train.
 * - `stationFacilities.json` (§5.6) — the station's *physical* facts: structure,
 *   which gates are open, which lift serves which gate, and the multi-modal
 *   interchange on the 10 stations that have one.
 *
 * What each block renders, why it's worded the way it is, and what deliberately
 * does not render is specified in PRD §4.4.1. The short version: gate numbers
 * are GMRC's, step-free access is stated positively only, and blocks close up
 * rather than showing a placeholder or a "none nearby" negative —
 * `stationFacilities()` returns null for the one station GMRC omits.
 *
 * Still genuinely unpublished per station, so still absent here: toilets,
 * Wi-Fi, ATMs, feeder-bus routes, and a landmark per gate (§5.6).
 */
function StationInfoPanel({ stationId, surface }: { stationId: string; surface: "page" | "sheet" }) {
  const { t } = useTranslation();
  const now = useNow();
  const station = STATION_BY_ID[stationId];
  const cardBg = surface === "sheet" ? "var(--c-bg)" : "var(--c-card)";
  const facilities = stationFacilities(stationId);

  const lines = useMemo(
    () => (station ? [station.line, ...(station.secondLine ? [station.secondLine] : [])] : []),
    [station]
  );

  const posOnLine = useMemo(() => {
    if (!station) return null;
    const path = LINE_PATHS[station.line];
    if (!path) return null;
    const idx = path.indexOf(stationId);
    return idx === -1 ? null : { idx, total: path.length - 1 };
  }, [stationId, station]);

  const timingRows = useMemo(
    () =>
      lines.flatMap((line) =>
        fullDayStationSchedule(stationId, line, now).map((dir) => ({
          key: `${line}-${dir.destinationId}`,
          line,
          destinationName: dir.destinationName,
          first: dir.trains[0]?.clockTime ?? "—",
          last: dir.trains[dir.trains.length - 1]?.clockTime ?? "—",
        }))
      ),
    // The schedule only moves on the minute, so don't rebuild every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationId, lines, now.getMinutes()]
  );

  if (!station) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel icon={Layers} text={t('station.overview')} />
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile cardBg={cardBg} value={lines.length} label={t('station.lineLabel', { count: lines.length })} />
          <StatTile cardBg={cardBg} value={t('station.phaseValue', { number: station.phase })} label={t('station.networkPhase')} />
          <StatTile
            cardBg={cardBg}
            value={posOnLine ? `${posOnLine.idx + 1} / ${posOnLine.total + 1}` : "—"}
            label={t('station.stopOnLine')}
          />
          <StatTile
            cardBg={cardBg}
            value={station.operational === false ? t('search.openingSoon') : t('station.operational')}
            label={t('station.statusLabel')}
          />
          {facilities && (
            <StatTile
              cardBg={cardBg}
              wide
              value={facilities.structure === "underground" ? t('station.underground') : t('station.elevated')}
              label={t('station.structure')}
            />
          )}
        </div>
      </div>

      <div>
        <SectionLabel icon={Info} text={t('station.details')} />
        <div className="grid grid-cols-2 gap-2.5">
          <AttributeCard
            cardBg={cardBg}
            icon={Waypoints}
            title={station.interchange ? t('home.interchange') : t('station.singleLine')}
            description={
              // Line names are interpolated, not translated — English in every
              // language until §6.8's source lands.
              station.interchange && station.secondLine
                ? t('station.connectsToLine', { line: LINE_NAMES[station.secondLine] })
                : t('station.servedOnlyBy', { line: LINE_NAMES[station.line] })
            }
          />
          <AttributeCard
            cardBg={cardBg}
            icon={Milestone}
            title={station.terminal ? t('live.terminus') : t('station.throughStation')}
            description={station.terminal ? t('station.terminusDesc') : t('station.throughStationDesc')}
          />
        </div>
      </div>

      {facilities && (
        <>
          <EntrancesBlock facilities={facilities} cardBg={cardBg} />
          <StepFreeBlock facilities={facilities} cardBg={cardBg} />
          <ConnectionsBlock facilities={facilities} cardBg={cardBg} />
        </>
      )}

      <div>
        <SectionLabel icon={Clock} text={t('station.firstAndLastTrain')} />
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
          {timingRows.map((row, i) => (
            <div
              key={row.key}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < timingRows.length - 1 ? "1px solid var(--c-border)" : "none" }}
            >
              <LineBadge line={row.line} size="sm" />
              <div className="flex-1 min-w-0 text-[13px] font-bold truncate" style={{ color: "var(--c-text)" }}>
                {t('journey.towards', { station: row.destinationName })}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                  {t('station.first')}
                </div>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: "var(--c-text)" }}>
                  {row.first}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                  {t('station.last')}
                </div>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: "var(--c-text)" }}>
                  {row.last}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Timer size={13} strokeWidth={2.4} className="shrink-0 mt-0.5" style={{ color: "var(--c-text-4)" }} />
        <p className="text-[11px] font-semibold leading-snug" style={{ color: "var(--c-text-4)" }}>
          {lines
            .map((l) => t('station.frequencyNote', { line: LINE_NAMES[l], mins: LINE_META[l].avgFrequencyMins }))
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

// ─── Shared detail body ──────────────────────────────────────────────
// Everything the station page shows below its sticky header. Extracted so the
// home screen's draggable sheet renders the identical content rather than a
// second, drifting copy of it.
export function StationDetailBody({
  stationId,
  openLine,
  openDirDest,
  showHero = true,
  showActions = true,
  surface = "page",
  onPlanIntent,
}: {
  stationId: string;
  openLine?: string;
  openDirDest?: string;
  /** The home sheet already names the station in its header, so it hides the
   *  hero to avoid repeating the identity. The standalone page keeps it. */
  showHero?: boolean;
  /** The home sheet renders its own Get Directions / Station Details pair above
   *  this body, so it suppresses the From here / To here buttons. */
  showActions?: boolean;
  /** "page" (default): the standalone /stations/:id page, grey (--c-bg)
   *  behind a white schedule card. "sheet": the home sheet's full snap, which
   *  is itself white (--c-card), so the schedule card goes grey instead. */
  surface?: "page" | "sheet";
  /** How to start a trip from the "From here" / "To here" buttons. When omitted
   *  (the home sheet), falls back to the `home-plan-trip` event that the mounted
   *  `HomeScreen` listens for. The standalone `/stations/:id` page — where no
   *  `HomeScreen` is mounted to catch that event — passes its own handler that
   *  navigates home carrying the intent. */
  onPlanIntent?: (detail: { source?: string } | { dest?: string }) => void;
}) {
  const { t } = useTranslation();
  const station = STATION_BY_ID[stationId];
  const [tab, setTab] = useState<"schedule" | "info">("schedule");

  // Hooks must run unconditionally, so this sits above the missing-station return.
  const posOnLine = useMemo(() => {
    if (!station) return null;
    const path = LINE_PATHS[station.line];
    if (!path) return null;
    const idx = path.indexOf(stationId);
    if (idx === -1) return null;
    return { idx, total: path.length - 1 };
  }, [stationId, station]);

  if (!station) return null;

  const lines = [station.line, ...(station.secondLine ? [station.secondLine] : [])];

  // Start a trip from the "From here" / "To here" buttons. In the home sheet the
  // default fires the `home-plan-trip` event the mounted HomeScreen catches to
  // open its planner overlay (map stays mounted beneath). The standalone page has
  // no HomeScreen to catch it, so it supplies `onPlanIntent` instead. "From here"
  // seeds the trip source, "To here" the destination.
  const planWith = (detail: { source?: string } | { dest?: string }) => {
    if (onPlanIntent) onPlanIntent(detail);
    else document.dispatchEvent(new CustomEvent("home-plan-trip", { detail }));
  };

  const actions = (
    <div className="flex gap-2.5">
      <button
        onClick={() => planWith({ source: station.id })}
        className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{ background: "var(--c-accent)", color: "var(--c-accent-fg)" }}
      >
        <ArrowUpRight size={16} strokeWidth={2.5} /> {t('station.fromHere')}
      </button>
      <button
        onClick={() => planWith({ dest: station.id })}
        className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{ background: "transparent", color: "var(--c-accent-text)", border: "1px solid var(--c-accent-text)" }}
      >
        <MapPin size={16} strokeWidth={2.5} /> {t('station.toHere')}
      </button>
    </div>
  );

  return (
      <div className="p-5 max-w-[var(--layout-max-width)] mx-auto space-y-6">
        {/* Hero — hidden in the home sheet, which already names the station. */}
        {showHero ? (
        <div className="pt-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex flex-col gap-2 pt-1">
              {lines.map((l) => (
                <LineBadge key={l} line={l} size="xl" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-4xl font-bold tracking-tight leading-tight"
                style={{ color: "var(--c-text)" }}
              >
                {station.name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                  style={{ color: "var(--c-text-3)", border: "1px solid var(--c-border-2)" }}
                >
                  {t('station.phaseValue', { number: station.phase })}
                </span>
                {station.interchange && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                    style={{ color: "var(--c-text)", border: "1px solid var(--c-border-2)" }}
                  >
                    {t('home.interchange')}
                  </span>
                )}
                {station.operational === false && (
                  <span
                    className="text-caption uppercase px-2 py-1 rounded-chip"
                    style={{ color: 'var(--c-warn)', border: '1px solid var(--c-warn-border)' }}
                  >
                    {t('search.openingSoon')}
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-3 flex-wrap">
                {lines.map((l) => (
                  <span key={l} className="text-xs font-semibold" style={{ color: "var(--c-text-3)" }}>
                    {LINE_NAMES[l]}
                  </span>
                ))}
              </div>
              {posOnLine && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Navigation2 size={11} style={{ color: "var(--c-text-4)" }} />
                  <span className="text-[11px]" style={{ color: "var(--c-text-4)" }}>
                    {t('station.stopOfTotal', { index: posOnLine.idx + 1, total: posOnLine.total + 1 })}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
        ) : null}

        {showActions ? actions : null}

        {/* Schedule / Station Info */}
        <div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")} icon={Clock} label={t('station.tabSchedule')} />
            <TabButton active={tab === "info"} onClick={() => setTab("info")} icon={Info} label={t('station.tabInfo')} />
          </div>

          {tab === "schedule" ? (
            <>
              <SectionLabel icon={Clock} text={t('station.tapTrainHint')} />
              <div className="space-y-4">
                {lines.map((line) => (
                  <LineScheduleCard
                    key={line}
                    stationId={stationId}
                    line={line}
                    autoOpenDirDest={openLine === line ? openDirDest : undefined}
                    surface={surface}
                  />
                ))}
              </div>
            </>
          ) : (
            <StationInfoPanel stationId={stationId} surface={surface} />
          )}
        </div>
      </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────
export function StationDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const station = id ? STATION_BY_ID[id] : undefined;

  // §5.8. Above the not-found early return, because a hook cannot live below
  // one. Keyed on `station`, which is a stable module-constant lookup, so this
  // reports each station navigated to and not each re-render of the same page.
  useEffect(() => {
    if (station) track('station_viewed', { fromStation: station.id });
  }, [station]);

  if (!id || !station) {
    return (
      <div className="p-8 text-center pt-24">
        <h2 className="text-xl font-bold" style={{ color: "var(--c-text)" }}>
          {t('station.notFound')}
        </h2>
        {/* Was text-yellow-400 on --c-bg: ~1.7:1, and the only way out of a
            dead end. `--c-accent-text` and not `--c-accent-strong`, which does
            not exist — an undefined custom property silently inherits, so the
            fix landed as "whatever colour the paragraph above happens to be". */}
        <button onClick={() => navigate(-1)} className="mt-4 text-headline" style={{ color: 'var(--c-accent-text)' }}>
          {t('common.goBack')}
        </button>
      </div>
    );
  }

  const deepLinkState = (location.state as { openLine?: string; openDirDest?: string } | null) ?? {};

  return (
    // The dead classes here were `fade-in slide-in-from-right-4`; only the fade
    // is restored. The 16px lateral part was built and measured first, and it
    // overflows: `<main>` carries `overflow-y: auto`, which per CSS makes its
    // `overflow-x` compute to `auto` rather than stay visible, so a page root
    // starting 16px right of its box gives `main` a real horizontal scroll
    // range — measured at 375px, `scrollWidth` 391 against `clientWidth` 375,
    // on the entrance's own first frame. Killing it would mean clipping
    // `<main>` for every route to buy one decorative slide. Don't re-add it.
    <motion.div
      className="min-h-[100dvh] pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Sticky top bar */}
      <div
        className="sticky top-0 z-30 px-4 pb-3 flex items-center gap-3 transition-colors"
        style={{
          paddingTop: 'calc(var(--sat) + var(--sp-3))',
          background: "var(--surface-float)",
          borderBottom: "1px solid var(--c-border)",
          backdropFilter: "var(--blur-float)",
          WebkitBackdropFilter: "var(--blur-float)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="hit-44 w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--c-card)" }}
        >
          <ArrowLeft size={18} style={{ color: "var(--c-text)" }} />
        </button>
        <span className="font-bold text-[14px] truncate" style={{ color: "var(--c-text)" }}>
          {station.name}
        </span>
      </div>

      <StationDetailBody
        stationId={id}
        openLine={deepLinkState.openLine}
        openDirDest={deepLinkState.openDirDest}
        onPlanIntent={(detail) => navigate("/", { state: { planTrip: detail } })}
      />
    </motion.div>
  );
}
