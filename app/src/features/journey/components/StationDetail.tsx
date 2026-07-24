import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Navigation2, AlertTriangle, Clock } from "lucide-react";
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
import { LINE_COLORS, LINE_NAMES } from "../constants";
import { TrainRouteSheet } from "./TrainRouteSheet";

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
  const nextRef = useRef<HTMLButtonElement>(null);
  const [selectedTrain, setSelectedTrain] = useState<MergedTrain | null>(null);
  const color = LINE_COLORS[line];

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

  // Keep the upcoming trains in view as departures roll past.
  useEffect(() => {
    const el = nextRef.current;
    if (!el || !listRef.current) return;
    const container = listRef.current;
    const rowH = el.offsetHeight;
    container.scrollTo({ top: Math.max(0, el.offsetTop - rowH * 2), behavior: "smooth" });
  }, [firstUpcomingId]);

  return (
    <>
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ maxHeight: 360, scrollbarWidth: "none" }}
      >
        {trains.map((train, i) => {
          const isNext = train.isNext;
          const isDep = train.departed;
          const absMins = Math.abs(train.waitMins);

          return (
            <button
              key={train.id}
              ref={train.id === firstUpcomingId ? nextRef : undefined}
              onClick={() => setSelectedTrain(train)}
              className="w-full flex items-center justify-between px-4 text-left transition-colors active:opacity-70"
              style={{
                paddingTop: isNext ? 13 : 9,
                paddingBottom: isNext ? 13 : 9,
                borderBottom: i !== trains.length - 1 ? "1px solid var(--c-border)" : "none",
                background: isNext ? `${color}12` : "transparent",
              }}
            >
              {/* Left: destination + time */}
              <div className="flex items-center gap-3">
                {isNext && (
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ background: color }} />
                )}
                <div>
                  {/* Destination label */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ArrowRight size={11} strokeWidth={2.5} style={{ color: isDep ? "var(--c-text-4)" : color }} />
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: isDep ? "var(--c-text-4)" : "var(--c-text-2)" }}
                    >
                      {train.dir.destinationName}
                    </span>
                    {isNext && (
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                        · Next
                      </span>
                    )}
                  </div>
                  {/* Clock time */}
                  <div
                    className={`font-bold tabular-nums ${
                      isNext ? "text-xl" : isDep ? "text-[13px] line-through" : "text-[15px]"
                    }`}
                    style={{
                      color: isNext
                        ? "var(--c-text)"
                        : isDep
                        ? "var(--c-text-4)"
                        : "var(--c-text-2)",
                    }}
                  >
                    {train.clockTime}
                  </div>
                </div>
              </div>

              {/* Right: wait / departed */}
              <div className="text-right shrink-0">
                {isDep ? (
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: "var(--c-card-alt)", color: "var(--c-text-4)" }}
                  >
                    {absMins > 0 ? `${absMins}m ago` : "Departed"}
                  </span>
                ) : isNext ? (
                  <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>
                    {train.waitMins === 0 ? "Due" : formatDuration(train.waitMins)}
                  </div>
                ) : (
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--c-text-3)" }}>
                    {formatDuration(train.waitMins)}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        <div className="px-4 py-5 text-center">
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
function LineScheduleCard({ stationId, line, autoOpenDirDest }: { stationId: string; line: string; autoOpenDirDest?: string }) {
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
        style={{ background: "var(--c-card)" }}
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
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--c-card)" }}>
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

// ─── Shared detail body ──────────────────────────────────────────────
// Everything the station page shows below its sticky header. Extracted so the
// home screen's draggable sheet renders the identical content rather than a
// second, drifting copy of it.
export function StationDetailBody({
  stationId,
  openLine,
  openDirDest,
  showHero = true,
  onPlanIntent,
}: {
  stationId: string;
  openLine?: string;
  openDirDest?: string;
  /** The home sheet already names the station in its header, so it hides the
   *  hero to avoid repeating the identity. The standalone page keeps it. */
  showHero?: boolean;
  /** How to start a trip from the "From here" / "To here" buttons. When omitted
   *  (the home sheet), falls back to the `home-plan-trip` event that the mounted
   *  `HomeScreen` listens for. The standalone `/stations/:id` page — where no
   *  `HomeScreen` is mounted to catch that event — passes its own handler that
   *  navigates home carrying the intent. */
  onPlanIntent?: (detail: { source?: string } | { dest?: string }) => void;
}) {
  const station = STATION_BY_ID[stationId];

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
        style={{ background: "var(--c-accent)", color: "#000" }}
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

        {actions}

        {/* Schedule */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} style={{ color: "var(--c-text-4)" }} />
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "var(--c-text-4)" }}
            >
              Today&apos;s Schedule · tap any train for full route
            </span>
          </div>
          <div className="space-y-4">
            {lines.map((line) => (
              <LineScheduleCard
                key={line}
                stationId={stationId}
                line={line}
                autoOpenDirDest={openLine === line ? openDirDest : undefined}
              />
            ))}
          </div>
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
