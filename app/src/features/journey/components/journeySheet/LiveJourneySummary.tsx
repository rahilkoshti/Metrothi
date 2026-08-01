import { MapPin, Train, Flag, ChevronUp, ChevronDown, Footprints, ArrowLeftRight, ArrowRight } from "lucide-react";
import type { SheetSnap } from "../../../../components/DraggableSheet";
import type { useJourneySession } from "../../hooks/useJourneySession";
import { liveStatusOf, type LiveIcon, type LiveTone } from "../../liveStatus";
import { LINE_COLORS, LINE_TEXT } from "../../constants";

const ICONS: Record<LiveIcon, typeof Train> = {
  walk: Footprints,
  wait: MapPin,
  train: Train,
  transfer: ArrowLeftRight,
  flag: Flag,
};

const TONE: Record<LiveTone, string> = {
  normal: "var(--c-text)",
  alert: "var(--c-accent)",
  good: "var(--c-success)",
};

/**
 * Live-journey summary shown in the home sheet header once a trip is underway.
 * Tapping it walks the sheet up a step — collapsed to mid, mid to full — the
 * same ladder the station and planned-route headers use.
 *
 * Three bands, because this is the state a rider spends most of the journey in
 * and it has to answer more than one question without being expanded:
 *
 *   1. a progress rail — "am I nearly there", for 3px
 *   2. the instruction and its countdown — "what do I do next, and when"
 *   3. where this train is left, and at what time — "where do I get off"
 *
 * It is sized to *be* the sheet's collapsed peek. `LIVE_COLLAPSED_H` is a floor
 * below this height rather than a target, so the peek resolves to the header
 * itself (`DraggableSheet`'s `Math.max`) and a band that grows — a wrapped
 * instruction, a longer name — takes the peek with it instead of being sliced
 * off at the fold.
 *
 * Still English in every language, like the rest of the live journey: §6.6
 * phase 2 owns `LiveJourneyScreen` and this file as one unit, and translating
 * only the header would put a Hindi status line above an English timeline in
 * the same sheet.
 */
export function LiveJourneySummary({
  result,
  session,
  snap,
  onMaximize,
}: {
  result: any;
  session: ReturnType<typeof useJourneySession>;
  snap: SheetSnap;
  onMaximize: () => void;
}) {
  const status = liveStatusOf(result, session);
  if (!status) return null;

  // The chevron is the bar's only affordance, so it has to point where the tap
  // actually goes rather than always up.
  const Chevron = snap === 'full' ? ChevronDown : ChevronUp;

  const { line, instruction, countdown, alight, tone, progress } = status;
  const Icon = ICONS[status.icon];
  // Both maps are keyed by the same line ids the engine emits, so a miss means
  // a line we don't know about — fall back to a literal hex either way, since
  // the icon's tint is built by appending an alpha pair to it.
  const rail = LINE_COLORS[line] ?? "#71717a";
  const glyph = LINE_TEXT[line] ?? "#71717a";

  return (
    <button
      type="button"
      onClick={onMaximize}
      aria-expanded={snap !== 'collapsed'}
      aria-label={`Live journey: ${instruction}. ${snap === 'full' ? 'Collapse' : 'Expand'} journey details`}
      className="w-full text-left"
    >
      {/* Band 1 — progress. Full-bleed and only 3px tall: it reads as an edge of
          the sheet rather than a control, which is the point. The trip's line
          colour is otherwise absent from the collapsed bar entirely. */}
      <div className="relative h-[3px] w-full overflow-hidden" style={{ background: "var(--c-border)" }}>
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%`, background: rail }}
        />
      </div>

      <div className="px-4 pt-2.5 pb-3">
        {/* Band 2 — the instruction, and the one number that matters now. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${rail}1A`, color: glyph }}
            >
              <Icon size={18} strokeWidth={2.2} />
            </div>
            <div
              className="text-[15px] font-bold leading-tight truncate"
              style={{ color: "var(--c-text)" }}
            >
              {instruction}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {countdown && (
              <div className="text-right">
                <div className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: TONE[tone] }}>
                  {countdown.value}
                </div>
                <div
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--c-text-4)" }}
                >
                  {countdown.label}
                </div>
              </div>
            )}
            {/* Always present, including the arrived states where there is no
                countdown left to sit beside — it is the bar's only affordance. */}
            <Chevron size={16} style={{ color: "var(--c-text-4)" }} />
          </div>
        </div>

        {/* Band 3 — where this train is left, and when. The destination and its
            arrival time were previously reachable only at the full snap. */}
        {alight && (
          <div className="flex items-center gap-1.5 mt-2 text-[12px] font-semibold min-w-0">
            <ArrowRight size={12} strokeWidth={2.6} className="shrink-0" style={{ color: "var(--c-text-4)" }} />
            <span className="truncate" style={{ color: "var(--c-text-2)" }}>
              {alight.final ? alight.name : `Get off at ${alight.name}`}
            </span>
            {alight.clock && (
              <>
                <span style={{ color: "var(--c-text-4)" }}>·</span>
                <span className="tabular-nums shrink-0" style={{ color: "var(--c-text-3)" }}>
                  {alight.final ? `arr ${alight.clock}` : alight.clock}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
