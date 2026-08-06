import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark, Share2, Clock, ChevronDown, Footprints,
  ArrowLeftRight, Flag, FastForward, Check, Train,
} from "lucide-react";
import { fullDayStationSchedule, LINE_PATHS, clockTimeAfter, formatDuration } from "../engine/journeyEngine";
import type { JourneyState, useJourneySession } from "../hooks/useJourneySession";
import { useNow } from "../hooks/useNow";
import { LINE_COLOR, LINE_ON_SURFACE } from "../constants";
import { legOffsetsOf, activeLegIndexOf } from "../liveStatus";
import { TrainRouteSheet } from "./TrainRouteSheet";
import { ExitGuidance } from "./ExitGuidance";
import { LineBadge } from "../../../components/LineBadge";
import { useLiveQuery } from "dexie-react-hooks";
import { isJourneySaved, toggleSavedJourney } from "../../../data/db";
import { syncNow } from "../../../services/syncEngine";

// ─── Layout constants ────────────────────────────────────────────────────────
/** Width of the thick colored track bar (px). */
const RAIL_W = 14;
/** Vertical offset of a station dot's center from its row top (px). */
const DOT_Y = 12;

// This screen used to print a duration four different ways — a local `fmtMins`
// giving "5 mins", the engine's `formatDuration` giving "5 min", and two inline
// templates giving "12min" and "3m" — all visible at once. `formatDuration` is
// the one formatter: it is where the hour rollover ("1h 05m") is already
// handled, and it is what every other screen in the app uses.

/**
 * The journey-state pill, as a tone and a glyph.
 *
 * Both halves are deliberate. The tone is a **status** token rather than a
 * literal because the six colours here were authored on the dark theme and
 * measured 3.68:1 at worst on the light one — and because three of the states
 * were painted `#EAB308`, byte-identical to the Yellow Line. A rider should
 * never have to work out whether yellow means "Yellow Line" or "warning";
 * four hues are already spent on line identity, so status gets its own set
 * chosen not to collide with them.
 *
 * The glyph is what stops the pill conveying its state by colour alone
 * (WCAG 1.4.1). It also replaces a pulsing dot, which was one of the four
 * always-on animations running with no reduced-motion guard.
 */
const STATE_PILL: Record<JourneyState, { tone: 'info' | 'warn' | 'good'; Icon: typeof Train }> = {
  NOT_STARTED:             { tone: 'info', Icon: Clock },
  WALKING_TO_STATION:      { tone: 'info', Icon: Footprints },
  WAITING_FOR_TRAIN:       { tone: 'warn', Icon: Clock },
  ON_TRAIN:                { tone: 'good', Icon: Train },
  APPROACHING_TRANSFER:    { tone: 'warn', Icon: ArrowLeftRight },
  TRANSFERRING:            { tone: 'warn', Icon: ArrowLeftRight },
  APPROACHING_DESTINATION: { tone: 'good', Icon: Flag },
  FINAL_WALK:              { tone: 'good', Icon: Footprints },
  COMPLETED:               { tone: 'good', Icon: Check },
};

// ─── Small building blocks ───────────────────────────────────────────────────

function ActionPill({
  onClick, active, danger, children,
}: {
  onClick?: () => void; active?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 rounded-2xl text-footnote shrink-0 transition-all active:scale-[0.97]"
      style={{
        // 44px floor: this row holds "End journey", which is destructive and
        // was a ~36px target. The danger tone used a literal #EF4444 (3.35:1
        // on the card) while --c-danger sat unused two files away.
        minHeight: 'var(--touch-min)',
        background: danger ? "var(--c-error-bg)" : active ? "var(--c-text)" : "var(--c-bg)",
        color: danger ? "var(--c-danger)" : active ? "var(--c-bg)" : "var(--c-text)",
        border: `1px solid ${danger ? "var(--c-error-border)" : "var(--c-border)"}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * One cell of the thick colored track. Each row draws its own slice of the
 * bar so the bar stays continuous no matter how rows expand or collapse.
 */
function RailCell({
  color, roundTop, roundBottom, passed, dot = true, dotSize = 6, glowFrac,
}: {
  color: string; roundTop?: boolean; roundBottom?: boolean; passed?: boolean;
  dot?: boolean; dotSize?: number; glowFrac?: number | null;
}) {
  const r = RAIL_W / 2;
  return (
    <div className="relative shrink-0 self-stretch" style={{ width: RAIL_W }}>
      <div
        className="absolute inset-x-0 overflow-hidden"
        style={{
          top: roundTop ? DOT_Y - r + 1 : 0,
          ...(roundBottom ? { height: DOT_Y + r - 1 - (roundTop ? DOT_Y - r + 1 : 0) } : { bottom: 0 }),
          borderRadius: `${roundTop ? r : 0}px ${roundTop ? r : 0}px ${roundBottom ? r : 0}px ${roundBottom ? r : 0}px`,
        }}
      >
        <div className="absolute inset-0" style={{ background: color }} />
        {passed && <div className="absolute inset-0 transition-opacity duration-500" style={{ background: "var(--c-bg)", opacity: 0.55 }} />}
      </div>
      {dot && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full z-10"
          // Same reasoning as LineBadge: a white station dot reaches 1.92:1 on
          // the Yellow Line's rail, under the 3:1 a meaningful graphic needs.
          // Black clears 5.31 on the worst of the four fills.
          style={{ top: DOT_Y - dotSize / 2, width: dotSize, height: dotSize, background: "var(--c-on-line)", opacity: 0.92 }}
        />
      )}
      {glowFrac != null && (
        <motion.div
          className="absolute left-1/2 z-20 pointer-events-none"
          initial={false}
          animate={{ top: `calc(${DOT_Y}px + ${glowFrac * 100}%)` }}
          transition={{ duration: 1, ease: "linear" }}
        >
          <div className="journey-glow-halo" />
          <div className="journey-glow-core" />
        </motion.div>
      )}
    </div>
  );
}

/** Dotted connector between legs, with a circular icon node on the rail. */
function ConnectorRow({
  icon, passed, highlight, children,
}: {
  icon: React.ReactNode; passed?: boolean; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-3.5 transition-opacity duration-500 ${passed ? "opacity-40" : ""}`}>
      <div className="w-10 shrink-0" />
      <div className="relative shrink-0 self-stretch flex justify-center" style={{ width: RAIL_W }}>
        <div className="h-full border-l-2 border-dotted" style={{ borderColor: "var(--c-border-2)" }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10"
          style={{
            left: (RAIL_W - 28) / 2,
            // The highlighted connector marks the transfer you are about to
            // make. It was filled #EAB308 — the Yellow Line's exact signage
            // hex — on a screen that also draws the Yellow Line.
            background: highlight ? "var(--c-warn)" : "var(--c-text)",
            color: highlight ? "var(--c-card)" : "var(--c-bg)",
            boxShadow: highlight ? "0 0 16px var(--c-warn-border)" : "none",
          }}
        >
          {icon}
        </div>
      </div>
      <div className="py-5 flex-1 min-w-0 flex flex-col justify-center">{children}</div>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface LiveJourneyScreenProps {
  result: any;
  activeOptionIdx?: number;
  onEnd: () => void;
  session: ReturnType<typeof useJourneySession>;
  /** Wraps everything the sheet should show above the fold at its mid snap.
   *  The host measures it and rests the sheet exactly at its bottom edge, so
   *  mid ends on the controls rather than part-way through a station row. */
  midBlockRef?: React.Ref<HTMLDivElement>;
}

export function LiveJourneyScreen({ result, activeOptionIdx, onEnd, session, midBlockRef }: LiveJourneyScreenProps) {
  const { t } = useTranslation();
  const { currentState, currentStopIndex, fastForward, elapsedMins, stopTimeline } = session;
  useNow(1000); // re-render every second so countdowns and the glow head stay live

  const { dest, stops, legs, sourceStation, destStation, sourcePlace, destPlace } = result;
  const activeOption = result.options?.[activeOptionIdx ?? 0] || result;

  const [isSimulating, setIsSimulating] = useState(false);
  const [expandedLegs, setExpandedLegs] = useState<Record<number, boolean>>({});
  const [showScheduleLegIdx, setShowScheduleLegIdx] = useState<number | null>(null);
  const [justShared, setJustShared] = useState(false);

  // Auto-play: the Simulate toggle fast-forwards the session clock 30x.
  useAutoPlay(isSimulating, fastForward);

  // Wall-clock anchor for displayed times: since useJourneySession is mounted in App.tsx, 
  // startedAt is stable across remounts. We use the true startedAt to anchor scheduled times, 
  // so they remain fixed when fast-forwarding rather than artificially shifting backwards.
  const startDate = session.startedAt ? new Date(session.startedAt) : null;

  // Global stop index of each leg's first station (leg k spans o[k] .. o[k+1]).
  // Shared with the collapsed summary — the two disagreed about which leg was
  // current at an interchange, which is the one moment it matters.
  const legOffsets = useMemo(() => legOffsetsOf(legs), [legs]);

  const cs = currentStopIndex;
  const activeLegIdx = activeLegIndexOf(legOffsets, cs);

  const isLegExpanded = (k: number) => expandedLegs[k] ?? k === activeLegIdx;

  // Where the glow head (train position) sits: a specific visible row of a
  // leg, or the collapsed "Ride N stops" row when its segment is hidden.
  const glow = useMemo(() => {
    if (!legs?.length || currentState === "COMPLETED" || currentState === "FINAL_WALK") return null;
    if (cs === 0) return { leg: 0, row: 0, frac: 0 }; // pulsing at the boarding dot
    const gs = cs - 1;
    let k = 0;
    for (let i = 0; i < legs.length; i++) if (legOffsets[i] <= gs) k = i;
    const t0 = stopTimeline[gs] ?? 0;
    const t1 = stopTimeline[cs] ?? t0 + 1;
    const segFrac = Math.min(1, Math.max(0, (elapsedMins - t0) / Math.max(0.01, t1 - t0)));
    const len = legs[k].ids.length;
    const hasButton = len - 2 >= 3;
    const collapsed = hasButton && !isLegExpanded(k);
    
    if (collapsed) {
      const rideStart = stopTimeline[legOffsets[k]] ?? 0;
      const rideEnd = stopTimeline[legOffsets[k] + len - 1] ?? rideStart + 1;
      const pct = Math.min(1, Math.max(0, (elapsedMins - rideStart) / Math.max(0.01, rideEnd - rideStart)));
      if (pct < 0.5) return { leg: k, row: 0, frac: pct * 2 };
      return { leg: k, row: -1, frac: (pct - 0.5) * 2 };
    }
    
    const row = gs - legOffsets[k];
    if (hasButton && row === 0) {
      if (segFrac < 0.5) return { leg: k, row: 0, frac: segFrac * 2 };
      return { leg: k, row: -1, frac: (segFrac - 0.5) * 2 };
    }
    
    return { leg: k, row, frac: segFrac };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, legOffsets, cs, elapsedMins, currentState, expandedLegs, activeLegIdx, stopTimeline]);

  // ── Save / Share ────────────────────────────────────────────────────────────
  const srcSt = sourceStation || result.source;
  const dstSt = destStation || result.dest;
  const saveKey = `${srcSt?.id}->${dstSt?.id}`;
  // Live from Dexie (§5.7). `saveKey` is in the deps so the star re-reads when
  // the rider changes the journey rather than reporting the previous one's state,
  // and `false` on the first frame matches the old read-on-mount behaviour.
  const isSaved = useLiveQuery(() => isJourneySaved(saveKey), [saveKey], false);

  function toggleSave() {
    void toggleSavedJourney({
      key: saveKey,
      sourceId: srcSt?.id,
      destId: dstSt?.id,
      sourceName: srcSt?.name,
      destName: dstSt?.name,
    }).then(() => syncNow());
  }

  async function share() {
    // Two whole keys rather than one with the fare concatenated on: the fare is
    // optional, and a translated sentence that gets a fragment appended is the
    // shape that drifts (§6.2). The station names inside stay English (§6.8).
    const text = t(result.fare == null ? 'live.shareText' : 'live.shareTextWithFare', {
      from: result.source.name,
      to: dest.name,
      depart: activeOption.departClockTime || t('journey.now'),
      arrive: activeOption.arriveClockTime || "—",
      fare: result.fare,
      stops: t('common.stops', { count: result.totalStops }),
    });
    try {
      if (navigator.share) await navigator.share({ title: t('live.shareTitle'), text });
      else {
        await navigator.clipboard.writeText(text);
        setJustShared(true);
        setTimeout(() => setJustShared(false), 1500);
      }
    } catch { /* user cancelled */ }
  }

  const totalMinsLeft = Math.max(0, Math.ceil((activeOption.totalMins ?? 0) - elapsedMins));
  const pill = STATE_PILL[currentState];

  if (!legs?.length || !stops?.length) return null;

  // ── Row renderers ───────────────────────────────────────────────────────────

  const renderLeg = (leg: any, k: number) => {
    const color = LINE_COLOR[leg.line];
    const len = leg.ids.length;
    const off = legOffsets[k];
    const isActive = k === activeLegIdx;
    const interCount = len - 2;
    const collapsible = interCount >= 3;
    const showList = !collapsible || isLegExpanded(k);
    const isLastLeg = k === legs.length - 1;

    const gi = (li: number) => off + li;
    const tAt = (li: number) => stopTimeline[gi(li)] ?? 0;
    const minsLeftAt = (li: number) => Math.max(0, Math.ceil(tAt(li) - elapsedMins));
    const clockAt = (li: number) => (startDate ? clockTimeAfter(startDate, tAt(li)) : "");
    const isPassed = (li: number) => gi(li) < cs;
    const isCurrent = (li: number) => gi(li) === cs;
    // Departure clock: timeline[o+1] already includes buffer + connection wait.
    const departClock = startDate
      ? clockTimeAfter(startDate, k === 0 ? (stopTimeline[0] ?? 0) : (stopTimeline[off + 1] ?? 0))
      : "";
    const glowHere = glow?.leg === k ? glow : null;

    const stationName = (li: number) => stops[gi(li)]?.name || "";

    const nameStyle = (li: number, base: string) =>
      isCurrent(li)
        ? { color: LINE_ON_SURFACE[leg.line], fontWeight: 700 }
        : { color: isPassed(li) ? "var(--c-text-4)" : base };

    const intermediateRow = (li: number) => (
      <div key={li} className="flex gap-3.5">
        <RailCell color={color} passed={isPassed(li)} glowFrac={glowHere?.row === li ? glowHere.frac : null} />
        <div className={`flex-1 min-w-0 pb-5 flex items-start justify-between gap-3 transition-opacity duration-500 ${isPassed(li) ? "opacity-50" : ""}`}>
          <div className="min-w-0">
            <div className="text-subhead leading-snug truncate transition-colors duration-500" style={nameStyle(li, "var(--c-text-2)")}>
              {stationName(li)}
            </div>
            {isActive && !isPassed(li) && (
              <div className="text-footnote mt-0.5 transition-colors duration-300" style={{ color: isCurrent(li) ? LINE_ON_SURFACE[leg.line] : "var(--c-text-4)" }}>
                {t('live.durationLeft', { duration: formatDuration(minsLeftAt(li)) })}
              </div>
            )}
          </div>
          {!isActive && (
            <div className="flex items-center gap-1 shrink-0 mt-0.5 text-footnote tabular-nums" style={{ color: "var(--c-text-4)" }}>
              <Clock size={12} aria-hidden="true" /> {formatDuration(minsLeftAt(li))}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div key={k} className="flex gap-3.5">
        {/* Line badge column — sticks below the header while its leg scrolls */}
        <div className="w-10 shrink-0">
          <div className="sticky z-10" style={{ top: 8 }}>
            <LineBadge line={leg.line} size="lg" />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Boarding station */}
          <div className="flex gap-3.5">
            <RailCell color={color} roundTop passed={isPassed(1)} dotSize={7} glowFrac={glowHere?.row === 0 ? glowHere.frac : null} />
            <div className={`flex-1 min-w-0 pb-4 transition-opacity duration-500 ${isPassed(0) && !isCurrent(0) ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-headline leading-snug" style={nameStyle(0, "var(--c-text)")}>
                  {stationName(0)}
                </div>
                <div className="text-footnote tabular-nums shrink-0 mt-1" style={{ color: "var(--c-text-3)" }}>
                  {departClock}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-footnote"
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}
                >
                  <LineBadge line={leg.line} size="xs" /> {leg.headingName}
                </span>
                <button
                  onClick={() => setShowScheduleLegIdx(k)}
                  className="hit-44 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-footnote active:scale-[0.97] transition-transform"
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}
                >
                  {/* Names what it opens rather than repeating the clock. This
                      printed `departClock` a second time, ~30px under the one
                      the row already right-aligns — the same duplication §4.2
                      removed from the plan sheet's header. */}
                  <Train size={12} /> {t('live.trainRoute')} <ChevronDown size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Collapsed summary of intermediate stops */}
          {collapsible && (
            <button className="flex gap-3.5 text-left w-full group" onClick={() => setExpandedLegs(e => ({ ...e, [k]: !isLegExpanded(k) }))}>
              <RailCell color={color} passed={cs >= gi(len - 1)} glowFrac={glowHere?.row === -1 ? glowHere.frac : null} dot={!showList} />
              <div className="flex-1 min-w-0 pb-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-subhead font-semibold" style={{ color: "var(--c-text)" }}>
                  <motion.span animate={{ rotate: showList ? 180 : 0 }} transition={{ duration: 0.25 }} className="flex">
                    <ChevronDown size={16} style={{ color: "var(--c-text-3)" }} />
                  </motion.span>
                  {t('live.rideStops', { count: len - 1 })}
                </span>
                <span className="flex items-center gap-1 text-footnote shrink-0" style={{ color: "var(--c-text-4)" }}>
                  <Clock size={12} aria-hidden="true" /> {formatDuration(leg.travelMins)}
                </span>
              </div>
            </button>
          )}

          {/* Intermediate stations */}
          <AnimatePresence initial={false}>
            {showList && interCount > 0 && (
              <motion.div
                key="stops"
                initial={collapsible ? { height: 0, opacity: 0 } : false}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.8, 0.25, 1] }}
                className="overflow-hidden flex flex-col"
              >
                {Array.from({ length: interCount }, (_, i) => intermediateRow(i + 1))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Alighting station */}
          <div className="flex gap-3.5">
            <RailCell color={color} roundBottom dotSize={7} glowFrac={glowHere?.row === len - 1 ? glowHere.frac : null} />
            <div className={`flex-1 min-w-0 pb-2 transition-opacity duration-500 ${isPassed(len - 1) ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-headline leading-snug" style={nameStyle(len - 1, "var(--c-text)")}>
                  {stationName(len - 1)}
                </div>
                <div className="text-footnote tabular-nums shrink-0 mt-1" style={{ color: "var(--c-text-3)" }}>
                  {clockAt(len - 1)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-footnote" style={{ color: "var(--c-text-4)" }}>
                {isLastLeg
                  ? <><Flag size={12} aria-hidden="true" /> {t('live.finalStop')}</>
                  : <><ArrowLeftRight size={12} aria-hidden="true" /> {t('live.changeHere')}</>}
              </div>
              {/* How to leave the station, under the stop you leave it at.
                  Rendered for the whole ride rather than only once the Arrived
                  state lands: the useful moment to read which exit to walk
                  toward is while you're still on the train. */}
              {isLastLeg && <ExitGuidance stationId={stops[gi(len - 1)]?.id} />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const walkPassed = !["NOT_STARTED", "WALKING_TO_STATION", "WAITING_FOR_TRAIN"].includes(currentState);

  return (
    <div className="relative">
      {/* ── Trip facts + live-state pill ──
          Deliberately *not* the route title any more. The collapsed bar above
          this is always on screen and already names the destination and its
          arrival clock, so repeating them here cost a 20px heading to say the
          same thing twice. What is left is what the bar has no room for: what
          the trip costs, how long it is, and where the times come from. The
          pill stays because "18 min left overall" is a different question from
          the bar's "2 min to the next stop". */}
      <div ref={midBlockRef} className="px-5 pt-1 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-footnote flex items-center gap-1.5 flex-wrap min-w-0" style={{ color: "var(--c-text-3)" }}>
            {result.fare != null && <span className="tabular-nums">₹{result.fare}</span>}
            {result.fare != null && <span style={{ color: "var(--c-text-4)" }}>·</span>}
            <span className="tabular-nums">{t('common.stops', { count: result.totalStops })}</span>
            {result.numTransfers > 0 && (
              <>
                <span style={{ color: "var(--c-text-4)" }}>·</span>
                <span className="tabular-nums">
                  {t('live.changes', { count: result.numTransfers })}
                </span>
              </>
            )}
            {/* The disclosure that these times are simulated rather than a live
                vehicle feed. It was 9px in --c-text-4 in the least-read corner
                of the screen — technically disclosed, not actually readable,
                which is not disclosure. One calm line at a legible size. */}
            <span className="text-footnote px-1.5 py-0.5 rounded-chip border shrink-0" style={{ borderColor: "var(--c-border-2)", color: "var(--c-text-3)" }}>
              {t('live.simulated')}
            </span>
          </div>
          <div
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-footnote transition-colors duration-500"
            style={{
              background: `var(--c-${pill.tone}-bg)`,
              color: `var(--c-${pill.tone})`,
              border: `1px solid var(--c-${pill.tone}-border)`,
            }}
          >
            <pill.Icon size={14} strokeWidth={2.2} aria-hidden="true" />
            {currentState === "COMPLETED"
              ? t('live.done')
              : t('live.durationLeft', { duration: formatDuration(totalMinsLeft) })}
          </div>
        </div>

        {/* Action pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-5 px-5">
          <ActionPill danger onClick={onEnd}>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-current" />
            </span>
            {t('common.end')}
          </ActionPill>
          <ActionPill onClick={toggleSave} active={isSaved}>
            <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} /> {isSaved ? t('common.saved') : t('common.save')}
          </ActionPill>
          <ActionPill onClick={share}>
            {justShared ? <Check size={14} /> : <Share2 size={14} />} {justShared ? t('common.copied') : t('common.share')}
          </ActionPill>
          {/* Development only. The session advances on wall-clock time and GPS,
              so walking a trip by hand is the only way to reach its later
              states without riding the metro — but these two are the one
              control on the screen that makes it lie. A rider who taps +5 min
              moves the state machine off the train they are actually on, and
              every countdown, the glow head and the arrival clock follow it.
              `import.meta.env.DEV` is inlined by Vite, so both pills leave the
              production bundle rather than being hidden in it.

              They were also what made the row a scroller: End, Save and Share
              are 271px against a 374px screen and fit on one line, while all
              five need 512px — so Share sat half off the edge and the two
              below could only be reached by a horizontal swipe that competes
              with the sheet's own drag.

              Left in English on purpose: these two never reach a rider, so a
              bundle key for each would be three translations of a string only
              this repo's developers ever see. */}
          {import.meta.env.DEV && (
            <>
              <ActionPill onClick={() => setIsSimulating(s => !s)}>
                Simulate
                <span className="w-8 h-[18px] rounded-full relative transition-colors" style={{ background: isSimulating ? "var(--c-good)" : "var(--c-border-2)" }}>
                  <span
                    className="absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-all"
                    style={{ left: isSimulating ? 18 : 2 }}
                  />
                </span>
              </ActionPill>
              <ActionPill onClick={() => fastForward(5)}>
                <FastForward size={14} /> +5 min
              </ActionPill>
            </>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="px-5 pt-2 pb-8">
        {/* Walk to the source station */}
        <ConnectorRow icon={<Footprints size={16} aria-hidden="true" />} passed={walkPassed}>
          <div className="text-headline leading-snug" style={{ color: "var(--c-text)" }}>
            {/* Four whole keys for the four shapes this line takes, rather than
                a base sentence with two optional fragments concatenated on.
                English tolerates the concatenation; Hindi and Gujarati put the
                verb last, so an appended clause lands in the middle of the
                sentence it was appended to. */}
            {(() => {
              const walkMins = sourcePlace && result.sourceWalkMins ? result.sourceWalkMins : null;
              const waits = result.initialWaitMins != null;
              const key = walkMins
                ? (waits ? 'live.walkDurationToThenWait' : 'live.walkDurationTo')
                : (waits ? 'live.walkToThenWait' : 'live.walkTo');
              return t(key, {
                station: srcSt?.name,
                duration: walkMins ? formatDuration(walkMins) : undefined,
                wait: waits ? formatDuration(result.initialWaitMins) : undefined,
              });
            })()}
          </div>
        </ConnectorRow>

        {legs.map((leg: any, k: number) => (
          <div key={k}>
            {renderLeg(leg, k)}
            {k < legs.length - 1 && (
              <ConnectorRow
                icon={<ArrowLeftRight size={16} aria-hidden="true" />}
                passed={cs > legOffsets[k + 1]}
                highlight={currentState === "TRANSFERRING" && cs === legOffsets[k + 1]}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-headline" style={{ color: "var(--c-text)" }}>{t('common.changeTo')}</span>
                  {/* The direction the next line takes you, not the station you
                      are standing in — the row directly above this already
                      names it and says "Change here", so the interchange was
                      printed three times running. Same badge-plus-heading chip
                      the boarding row uses, so it reads the same way. */}
                  <span
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-footnote"
                    style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}
                  >
                    <LineBadge line={legs[k + 1].line} size="xs" /> {legs[k + 1].headingName}
                  </span>
                </div>
                <div className="text-footnote mt-1" style={{ color: "var(--c-text-4)" }}>
                  {t(legs[k + 1].waitMins != null ? 'live.transferWalkAndWait' : 'live.transferWalk', {
                    duration: formatDuration(legs[k + 1].bufferMins || 3),
                    wait: legs[k + 1].waitMins != null ? formatDuration(legs[k + 1].waitMins) : undefined,
                  })}
                </div>
              </ConnectorRow>
            )}
          </div>
        ))}

        {/* Walk from the destination station to the final place */}
        {destPlace && (
          <ConnectorRow icon={<Footprints size={16} aria-hidden="true" />} passed={currentState === "COMPLETED"}>
            <div className="text-headline leading-snug" style={{ color: "var(--c-text)" }}>
              {t(result.destWalkMins ? 'live.walkDurationToPlace' : 'live.walkToPlace', {
                place: destPlace.name,
                duration: result.destWalkMins ? formatDuration(result.destWalkMins) : undefined,
              })}
            </div>
          </ConnectorRow>
        )}
      </div>

      {/* ── Per-leg schedule sheet ── portaled to the body so its fixed
          positioning escapes the draggable sheet's transform. ── */}
      {showScheduleLegIdx !== null && (() => {
        const legIdx = showScheduleLegIdx;
        const leg = legs[legIdx];
        const legOriginId = leg.ids[0];
        const legDestId = leg.ids[leg.ids.length - 1];

        const schedule = fullDayStationSchedule(legOriginId, leg.line, new Date());
        const path = LINE_PATHS[leg.line];
        const isForward = path.indexOf(legOriginId) < path.indexOf(legDestId);
        const terminusId = isForward ? path[path.length - 1] : path[0];
        const dir = schedule.find((d: any) => d.destinationId === terminusId);
        if (!dir) return null;

        const departTime = activeOption.legs?.[legIdx]?.departClockTime;
        let train = dir.trains.find((t: any) => t.clockTime === departTime);
        if (!train) {
          train = dir.trains.find((t: any) => t.isNext && !t.departed) || dir.trains.find((t: any) => !t.departed) || dir.trains[0];
        }

        return createPortal(
          <TrainRouteSheet
            stationId={legOriginId}
            line={leg.line}
            dir={dir}
            train={train}
            now={new Date()}
            onClose={() => setShowScheduleLegIdx(null)}
          />,
          document.body
        );
      })()}
    </div>
  );
}

// ─── Auto-play hook (Simulate toggle → 30x fast-forward) ────────────────────
function useAutoPlay(enabled: boolean, fastForward: (m: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => fastForward(0.5), 1000);
    return () => clearInterval(interval);
  }, [enabled, fastForward]);
}
