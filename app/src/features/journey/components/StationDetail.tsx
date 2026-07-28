import { useEffect, useRef, useState, useMemo } from "react";
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
  Clock,
  Info,
  Layers,
  Waypoints,
  Milestone,
  Timer,
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
import { LINE_NAMES } from "../constants";
import {
  stationFacilities,
  accessibleGates,
  formatGateList,
  MODE_LABELS,
  type StationFacilities,
} from "../stationFacilities";
import { TrainRouteSheet } from "./TrainRouteSheet";
import { DepartureRow } from "./DepartureRow";

// ─── Merged schedule list (both directions, time-sorted) ─────────────
type MergedTrain = DayTrain & { dir: DayScheduleDirection };

function MergedTrainList({
  trains,
  line,
  stationId,
  autoOpenDest,
}: {
  trains: MergedTrain[];
  line: string;
  stationId: string;
  /** Deep-link: terminal name whose next train should auto-open on mount. */
  autoOpenDest?: string;
}) {
  const now = useNow();
  const listRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLElement>(null);
  const [selectedTrain, setSelectedTrain] = useState<MergedTrain | null>(null);

  // The earliest still-upcoming train — the scroll anchor and the point where
  // the list transitions from departed (greyed) to upcoming.
  const firstUpcomingId = useMemo(
    () => trains.find((t) => !t.departed)?.id ?? null,
    [trains]
  );

  // Auto-open the next train heading to the deep-linked terminal.
  useEffect(() => {
    if (!autoOpenDest) return;
    const match = (t: MergedTrain) =>
      t.dir.destinationName.toLowerCase() === autoOpenDest.toLowerCase();
    const t =
      trains.find((x) => match(x) && x.isNext && !x.departed) ??
      trains.find((x) => match(x) && !x.departed) ??
      null;
    if (t) setSelectedTrain(t);
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Park the first upcoming train at the top of the list, and keep it there as
  // departures roll past. `offsetTop` is measured from the nearest positioned
  // ancestor — not this scroller — so the offset is derived from the rects
  // instead, which stays correct however the sheet above is laid out.
  const didAnchor = useRef(false);
  useEffect(() => {
    const el = nextRef.current;
    const container = listRef.current;
    if (!el || !container) return;
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    // The first anchor is a jump — smooth-scrolling from an arbitrary start
    // position on mount is what reads as "the list loaded mid-scroll".
    container.scrollTo({
      top: Math.max(0, top),
      behavior: didAnchor.current ? "smooth" : "auto",
    });
    didAnchor.current = true;
  }, [firstUpcomingId]);

  return (
    <>
      {/* The rows are cards, so the scroller carries the page background to sit
          them on — same treatment as the home sheet's departure board. */}
      <div
        ref={listRef}
        className="overflow-y-auto flex flex-col gap-2 px-3 py-3"
        style={{ maxHeight: 360, scrollbarWidth: "none", background: "var(--c-bg)" }}
      >
        {trains.map((train) => (
          <DepartureRow
            key={train.id}
            ref={train.id === firstUpcomingId ? nextRef : undefined}
            line={line}
            destinationId={train.dir.destinationId}
            destinationName={train.dir.destinationName}
            clockTime={train.clockTime}
            waitMins={train.waitMins}
            primary="time"
            label={train.isNext ? "Next" : undefined}
            highlight={train.isNext}
            departed={train.departed}
            onClick={() => setSelectedTrain(train)}
          />
        ))}

        <div className="py-4 text-center">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
            End of service
          </span>
        </div>
      </div>

      {/* Route sheet */}
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
    </>
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
  const cardBg = surface === "sheet" ? "var(--c-bg)" : "var(--c-card)";
  const now = useNow();
  const station = STATION_BY_ID[stationId];

  const schedule = useMemo(
    () => fullDayStationSchedule(stationId, line, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationId, line, now.getMinutes()]
  );

  // Both directions folded into one time-sorted list. The engine already flags
  // the next upcoming train per direction, so the merged list keeps a "next"
  // highlight for each way.
  const merged = useMemo(() => {
    const all: MergedTrain[] = [];
    for (const d of schedule) for (const t of d.trains) all.push({ ...t, dir: d });
    all.sort((a, b) => a.hour - b.hour);
    return all;
  }, [schedule]);

  const status = estimateLine(line, now);

  if (station.operational === false) {
    return (
      <div
        className="rounded-2xl p-6 text-center flex flex-col items-center gap-3"
        style={{ background: cardBg }}
      >
        <AlertTriangle size={22} style={{ color: "var(--c-text-3)" }} />
        <p className="font-semibold text-sm" style={{ color: "var(--c-text-3)" }}>
          Station not yet open
        </p>
      </div>
    );
  }

  if (merged.length === 0) return null;

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
            Every ~{LINE_META[line].avgFrequencyMins} min · both directions
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {status.status === "running" && (
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {status.status === "after-last-train" && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
              Service ended
            </span>
          )}
          {status.status === "before-first-train" && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-500">
              Starts in {formatDuration(status.minsUntilFirst)}
            </span>
          )}
          {status.status === "bus-only" && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400">
              Bus only
            </span>
          )}
        </div>
      </div>

      <MergedTrainList
        trains={merged}
        line={line}
        stationId={stationId}
        autoOpenDest={autoOpenDirDest}
      />
    </div>
  );
}

// ─── Schedule / Station Info tabs ──────────────────────────────────────
function SectionLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} style={{ color: "var(--c-text-4)" }} />
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
        {text}
      </span>
    </div>
  );
}

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
      className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98]"
      style={{
        background: active ? "var(--c-accent)" : "var(--c-card-alt)",
        color: active ? "var(--c-accent-fg)" : "var(--c-text-3)",
      }}
    >
      <Icon size={14} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function StatTile({
  value,
  label,
  cardBg,
  wide = false,
}: {
  value: React.ReactNode;
  label: string;
  cardBg: string;
  /** Spans both columns — for a fifth tile that would otherwise sit orphaned. */
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-3.5 text-center${wide ? " col-span-2" : ""}`}
      style={{ background: cardBg, border: "1px solid var(--c-border)" }}
    >
      <div className="text-lg font-bold leading-none" style={{ color: "var(--c-text)" }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: "var(--c-text-4)" }}>
        {label}
      </div>
    </div>
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
      <Icon size={18} strokeWidth={2.2} style={{ color: "var(--c-accent)" }} />
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

/** A small pill — one gate number, one transport mode. */
function FactChip({ text, tone = "plain" }: { text: string; tone?: "plain" | "accent" }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg whitespace-nowrap"
      style={
        tone === "accent"
          ? { background: "var(--c-accent)", color: "var(--c-accent-fg)" }
          : { color: "var(--c-text)", border: "1px solid var(--c-border-2)" }
      }
    >
      {text}
    </span>
  );
}

function FactNote({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-semibold leading-snug mt-2.5" style={{ color: "var(--c-text-4)" }}>
      {text}
    </p>
  );
}

/** GMRC's kebab-cased amenity keys, as prose. */
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
  if (facilities.gates.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={DoorOpen} text="Entrances" />
      <div className="rounded-2xl p-3.5" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
        <div className="flex flex-wrap gap-2">
          {facilities.gates.map((g) => (
            <FactChip key={g} text={`Gate ${g}`} />
          ))}
        </div>
        <FactNote text="Open entry / exit gates. Numbers match the signage at the station." />
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
  const gates = accessibleGates(facilities);
  if (gates.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={Accessibility} text="Step-free access" />
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
        <div className="px-4 py-3 text-[13px] font-bold" style={{ color: "var(--c-text)" }}>
          Step-free entry at {formatGateList(gates)}
        </div>
        {facilities.lifts.map((l) => (
          <div
            key={l.lift}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderTop: "1px solid var(--c-border)" }}
          >
            <div className="flex-1 min-w-0 text-[12px] font-bold" style={{ color: "var(--c-text-3)" }}>
              Lift {l.lift}
            </div>
            <div className="text-[12px] font-bold tabular-nums" style={{ color: "var(--c-text)" }}>
              {formatGateList(l.gates)}
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
  const mm = facilities.multiModal;
  // PDEU is the one station with an amenity but no interchange, so this block
  // is keyed off having *something* to say rather than off `modes` alone.
  if (!mm || (mm.connections.length === 0 && !mm.amenities?.length)) return null;
  const hasChips = mm.modes.length > 0 || (mm.amenities?.length ?? 0) > 0;
  return (
    <div>
      <SectionLabel icon={ArrowLeftRight} text="Connections" />
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
                Gate {c.gate}
              </div>
            )}
            <div className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--c-text)" }}>
              {c.text}
            </div>
          </div>
        ))}
        {mm.connections.length === 0 && (
          <div className="px-4 pb-3.5 pt-1 text-[12.5px] font-semibold leading-snug" style={{ color: "var(--c-text)" }}>
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
        <SectionLabel icon={Layers} text="Station Overview" />
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile cardBg={cardBg} value={lines.length} label={lines.length > 1 ? "Lines" : "Line"} />
          <StatTile cardBg={cardBg} value={`Phase ${station.phase}`} label="Network Phase" />
          <StatTile
            cardBg={cardBg}
            value={posOnLine ? `${posOnLine.idx + 1} / ${posOnLine.total + 1}` : "—"}
            label="Stop on Line"
          />
          <StatTile
            cardBg={cardBg}
            value={station.operational === false ? "Opening soon" : "Operational"}
            label="Status"
          />
          {facilities && (
            <StatTile
              cardBg={cardBg}
              wide
              value={facilities.structure === "underground" ? "Underground" : "Elevated"}
              label="Structure"
            />
          )}
        </div>
      </div>

      <div>
        <SectionLabel icon={Info} text="Station Details" />
        <div className="grid grid-cols-2 gap-2.5">
          <AttributeCard
            cardBg={cardBg}
            icon={Waypoints}
            title={station.interchange ? "Interchange" : "Single Line"}
            description={
              station.interchange && station.secondLine
                ? `Connects to ${LINE_NAMES[station.secondLine]}`
                : `Served only by ${LINE_NAMES[station.line]}`
            }
          />
          <AttributeCard
            cardBg={cardBg}
            icon={Milestone}
            title={station.terminal ? "Terminus" : "Through Station"}
            description={station.terminal ? "Start or end of the line" : "Trains pass through both ways"}
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
        <SectionLabel icon={Clock} text="First & Last Train Today" />
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: "1px solid var(--c-border)" }}>
          {timingRows.map((row, i) => (
            <div
              key={row.key}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < timingRows.length - 1 ? "1px solid var(--c-border)" : "none" }}
            >
              <LineBadge line={row.line} size="sm" />
              <div className="flex-1 min-w-0 text-[13px] font-bold truncate" style={{ color: "var(--c-text)" }}>
                Towards {row.destinationName}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                  First
                </div>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: "var(--c-text)" }}>
                  {row.first}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                  Last
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
          {lines.map((l) => `${LINE_NAMES[l]}: every ~${LINE_META[l].avgFrequencyMins} min`).join(" · ")}
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
        <ArrowUpRight size={16} strokeWidth={2.5} /> From here
      </button>
      <button
        onClick={() => planWith({ dest: station.id })}
        className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{ background: "transparent", color: "var(--c-accent)", border: "1px solid var(--c-accent)" }}
      >
        <MapPin size={16} strokeWidth={2.5} /> To here
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
                  Phase {station.phase}
                </span>
                {station.interchange && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                    style={{ color: "var(--c-text)", border: "1px solid var(--c-border-2)" }}
                  >
                    Interchange
                  </span>
                )}
                {station.operational === false && (
                  <span className="text-[11px] font-bold uppercase tracking-widest text-yellow-600 border border-yellow-900/40 px-2 py-1 rounded">
                    Opening Soon
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
                    Stop {posOnLine.idx + 1} of {posOnLine.total + 1}
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
            <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")} icon={Clock} label="Schedule" />
            <TabButton active={tab === "info"} onClick={() => setTab("info")} icon={Info} label="Station Info" />
          </div>

          {tab === "schedule" ? (
            <>
              <SectionLabel icon={Clock} text="Tap any train for its full route" />
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
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const station = id ? STATION_BY_ID[id] : undefined;

  if (!id || !station) {
    return (
      <div className="p-8 text-center pt-24">
        <h2 className="text-xl font-bold" style={{ color: "var(--c-text)" }}>
          Station not found
        </h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-yellow-400 font-semibold">
          Go back
        </button>
      </div>
    );
  }

  const deepLinkState = (location.state as { openLine?: string; openDirDest?: string } | null) ?? {};

  return (
    <div className="min-h-[100dvh] pb-28 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Sticky top bar */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          background: "var(--c-blur)",
          borderBottom: "1px solid var(--c-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
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
    </div>
  );
}
