import { useEffect, useRef, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { SPRING } from "../../../components/sheetMotion";
import {
  STATION_BY_ID,
  LINE_META,
  LINE_PATHS,
  hourOf,
  istDayStartMs,
} from "../engine/journeyEngine";
import type { DayScheduleDirection, DayTrain } from "../engine/journeyEngine";
import { LineBadge } from "../../../components/LineBadge";
import { useDialog } from "../../../components/useDialog";
import { LINE_COLOR, LINE_NAMES } from "../constants";
import { track } from "../../../services/analytics";

// ─── Route stop type ────────────────────────────────────────────────
interface RouteStop {
  stationId: string;
  name: string;
  clockTime: string;
  isPast: boolean;
  isCurrent: boolean;
  isOrigin: boolean;
  isDestination: boolean;
}

export function computeTrainRoute(
  stationId: string,
  line: string,
  dir: DayScheduleDirection,
  train: DayTrain,
  now: Date
): RouteStop[] {
  const path = LINE_PATHS[line];
  if (!path) return [];
  const total = path.length - 1;
  const stationIdx = path.indexOf(stationId);
  if (stationIdx === -1) return [];

  const avgSegmentMins = LINE_META[line].avgSegmentMins;
  const hourNow = hourOf(now);

  // Determine direction: if originName matches path[0], we go forward
  const goForward = dir.originName === (STATION_BY_ID[path[0]]?.name ?? path[0]);

  // offsetHours = travel time from origin terminal to current station
  const offsetHours = goForward
    ? (stationIdx * avgSegmentMins) / 60
    : ((total - stationIdx) * avgSegmentMins) / 60;

  // Terminal departure time
  const terminalDeparture = train.hour - offsetHours;

  // Build ordered station list
  const orderedPath = goForward ? path : [...path].reverse();

  return orderedPath.map((sid, j) => {
    const arrivalHour = terminalDeparture + (j * avgSegmentMins) / 60;
    const isPast = arrivalHour < hourNow;
    const isCurrent = sid === stationId;
    const isOrigin = j === 0;
    const isDestination = j === orderedPath.length - 1;

    const clockTime = new Date(istDayStartMs(now) + arrivalHour * 3600000)
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

    return {
      stationId: sid,
      name: STATION_BY_ID[sid]?.name ?? sid,
      clockTime,
      isPast,
      isCurrent,
      isOrigin,
      isDestination,
    };
  });
}

// ─── Train Route Bottom Sheet ────────────────────────────────────────
export function TrainRouteSheet({
  stationId,
  line,
  dir,
  train,
  now,
  onClose,
}: {
  stationId: string;
  line: string;
  dir: DayScheduleDirection;
  train: DayTrain;
  now: Date;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const route = useMemo(
    () => computeTrainRoute(stationId, line, dir, train, now),
    [stationId, line, dir, train, now]
  );

  const currentRef = useRef<HTMLDivElement>(null);

  // §5.8: which schedules riders actually open. Tracked here rather than at the
  // two call sites (`StationDetail` and `LiveJourneyScreen`) for the reason
  // `DepartureRow` is one component — the pair drifted apart once already, and a
  // metric measured in two places is a metric that disagrees with itself.
  //
  // A station, a line and an hour is what identifies a train. `train.hour` is
  // fractional, so it is floored to the departure hour: the question is which
  // services get looked at, and 53 stations x 4 lines x 24 hours is already a
  // wide enough table without splitting 08:15 from 08:47.
  const trainHour = Math.floor(train.hour);
  useEffect(() => {
    track('train_viewed', { fromStation: stationId, props: { line, hour: trainHour } });
  }, [stationId, line, trainHour]);

  // The second sheet in the app that can sit over the first, and the one place
  // "Escape closes the topmost layer" has to mean something: opened from a live
  // journey it lands on top of the draggable sheet, and one Escape should peel
  // one layer. Station names stay English inside the label like everywhere else
  // (§6.8).
  const { ref: dialogRef, dialogProps } = useDialog<HTMLDivElement>({
    onClose,
    label: t('live.routeSheetAria', { from: dir.originName, to: dir.destinationName }),
  });

  // An explicit `behavior` in JS wins over the `scroll-behavior: auto` the
  // reduced-motion rule in index.css sets, so this is the one scroll that has
  // to ask.
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    setTimeout(() => {
      currentRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }, 150);
    // Only on mount: the sheet opens parked on the rider's own station.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = LINE_COLOR[line as keyof typeof LINE_COLOR];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      {/* Sheet. Entrance only, as the dead Tailwind classes specified — an exit
          would need `AnimatePresence` in both callers, which is a behaviour
          nobody has asked for and not what was being restored here. */}
      <motion.div
        ref={dialogRef}
        {...dialogProps}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{ background: "var(--c-bg)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={SPRING}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-2)" }} />
        </div>

        {/* Sheet header */}
        <div className="px-5 pt-2 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <LineBadge line={line} size="xs" />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                  {LINE_NAMES[line as keyof typeof LINE_NAMES]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base font-bold" style={{ color: "var(--c-text)" }}>{dir.originName}</span>
                <ArrowRight size={14} style={{ color: "var(--c-text-3)" }} />
                <span className="text-base font-bold" style={{ color: "var(--c-text)" }}>{dir.destinationName}</span>
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--c-text-3)" }}>
                {/* `Trans` because the tinted time has to be able to move: the
                    two Indic bundles close this sentence after it, English
                    opens with the verb. */}
                <Trans
                  i18nKey="live.departsAt"
                  values={{ station: dir.originName, time: route[0]?.clockTime }}
                  components={{ b: <span style={{ color }} /> }}
                />
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="hit-44 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
              style={{ background: "var(--c-card)" }}
            >
              <X size={15} style={{ color: "var(--c-text-3)" }} />
            </button>
          </div>
        </div>

        {/* Station list */}
        <div className="overflow-y-auto flex-1 px-5 py-4" style={{ scrollbarWidth: "none" }}>
          {route.map((stop, i) => {
            const isLast = i === route.length - 1;
            return (
              <div
                key={stop.stationId}
                ref={stop.isCurrent ? currentRef : undefined}
                className="flex items-stretch gap-4"
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center w-5 shrink-0">
                  {/* Dot */}
                  <div
                    className="shrink-0 rounded-full border-2 transition-all"
                    style={{
                      width: stop.isCurrent ? 14 : stop.isOrigin || isLast ? 12 : 8,
                      height: stop.isCurrent ? 14 : stop.isOrigin || isLast ? 12 : 8,
                      borderColor: stop.isPast && !stop.isCurrent ? "var(--c-border-2)" : color,
                      background: stop.isCurrent
                        ? color
                        : stop.isPast
                        ? "var(--c-card-alt)"
                        : "var(--c-bg)",
                      marginTop: 14,
                    }}
                  />
                  {/* Connector */}
                  {!isLast && (
                    <div
                      className="flex-1 w-0.5 mt-1"
                      style={{
                        background: stop.isPast ? "var(--c-border-2)" : color,
                        minHeight: 28,
                        opacity: stop.isPast ? 0.4 : 1,
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={`flex items-center justify-between flex-1 pb-4 ${
                    stop.isCurrent
                      ? "rounded-xl px-3 py-2 mb-1 -mx-1"
                      : ""
                  }`}
                  style={
                    stop.isCurrent
                      ? { background: `${color}14`, border: `1px solid ${color}33` }
                      : {}
                  }
                >
                  <div>
                    <div
                      className={`font-bold ${stop.isCurrent ? "text-base" : "text-[14px]"}`}
                      style={{
                        color: stop.isCurrent
                          ? "var(--c-text)"
                          : stop.isPast
                          ? "var(--c-text-4)"
                          : "var(--c-text-2)",
                        textDecoration: stop.isPast && !stop.isCurrent ? "line-through" : "none",
                      }}
                    >
                      {stop.name}
                    </div>
                    {stop.isCurrent && (
                      <div className="text-[11px] font-bold uppercase tracking-widest mt-0.5" style={{ color }}>
                        {t('live.youAreHere')}
                      </div>
                    )}
                    {stop.isOrigin && !stop.isCurrent && (
                      <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        {t('live.origin')}
                      </div>
                    )}
                    {isLast && !stop.isCurrent && (
                      <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        {t('live.terminus')}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <div
                      className="font-bold tabular-nums text-[14px]"
                      style={{
                        color: stop.isCurrent ? color : stop.isPast ? "var(--c-text-4)" : "var(--c-text-2)",
                      }}
                    >
                      {stop.clockTime}
                    </div>
                    {stop.isPast && !stop.isCurrent && (
                      <div className="text-[9px] uppercase font-bold mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        {t('common.departed')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="h-6" />
        </div>
      </motion.div>
    </>
  );
}
