import { MapPin, Train, Flag, ChevronUp, ChevronDown, Footprints, ArrowLeftRight, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SheetSnap } from "../../../../components/DraggableSheet";
import type { useJourneySession } from "../../hooks/useJourneySession";
import { liveStatusOf, type LiveIcon, type LiveTone } from "../../liveStatus";
import { LINE_COLOR, LINE_ON_SURFACE } from "../../constants";
import { LINE_FALLBACK } from "../../../map/mapColors";

const ICONS: Record<LiveIcon, typeof Train> = {
  walk: Footprints,
  wait: MapPin,
  train: Train,
  transfer: ArrowLeftRight,
  flag: Flag,
};

// `alert` was --c-accent, which measures 2.80:1 on the light card — the app's
// "you need to move now" state rendered in the one colour it could not be read
// in. The accent stays the *fill* colour for the primary CTA, where it carries
// black text at 7.5:1; as a foreground it is not a legible tone.
const TONE: Record<LiveTone, string> = {
  normal: "var(--c-text)",
  alert: "var(--c-warn)",
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
 * off at the fold. Indic strings run longer than English, so that floor is what
 * keeps a wrapped Gujarati instruction from being cut in half rather than a
 * width this file gets to assume.
 *
 * The instruction is rendered here but *chosen* in `liveStatus.ts`, which hands
 * over a key and its proper nouns rather than a finished sentence — that module
 * is React-free and must stay i18next-free with it (§6.2).
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
  const { t } = useTranslation();
  const status = liveStatusOf(result, session);
  if (!status) return null;

  // The chevron is the bar's only affordance, so it has to point where the tap
  // actually goes rather than always up.
  const Chevron = snap === 'full' ? ChevronDown : ChevronUp;

  const { line, countdown, alight, tone, progress } = status;
  const instruction = t(status.instruction.key, status.instruction.values);
  const Icon = ICONS[status.icon];
  // Both maps are keyed by the same line ids the engine emits, so a miss means
  // a line we don't know about. `rail` falls back to a literal because the
  // icon's tint is built by appending an alpha pair to it, which only works on
  // a hex — `glyph` is only ever a colour and so can fall back to a token.
  const rail = LINE_COLOR[line] ?? LINE_FALLBACK;
  const glyph = LINE_ON_SURFACE[line] ?? "var(--c-text-4)";

  return (
    <button
      type="button"
      onClick={onMaximize}
      aria-expanded={snap !== 'collapsed'}
      /* A whole sentence per direction, not one with "Collapse"/"Expand"
         swapped into it — a label built from a translated fragment is the shape
         that drifts silently (see `StationInput`). */
      aria-label={t(snap === 'full' ? 'live.ariaCollapse' : 'live.ariaExpand', { instruction })}
      className="w-full text-left"
    >
      {/* Band 1 — progress. Full-bleed and only 3px tall: it reads as an edge of
          the sheet rather than a control, which is the point. The trip's line
          colour is otherwise absent from the collapsed bar entirely.

          It is also the app's only progress indicator, and it was three pixels
          of colour and nothing else — invisible to anyone not looking at it. */}
      <div
        className="relative h-[3px] w-full overflow-hidden"
        style={{ background: "var(--c-border)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t('live.progressAria')}
      >
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
            {/* The instruction and its countdown are the Species A facts of the
                whole app — "what do I do right now, and when" — and both were
                set at 15px, the same size as a chip, with the label under the
                countdown at 9px. A rider reads this one-handed, moving, at
                arm's length. The countdown takes the largest figure on the
                bar; the instruction takes the headline size.

                The live region is here and *not* around the countdown, which is
                deliberate: a polite region announces on every change to its
                contents, and the countdown changes once a minute for the whole
                trip. The instruction changes when the answer does — a stop
                passed, a transfer coming — which is exactly when a rider who
                cannot see the screen needs telling. `assertive` for the two
                states that are a deadline rather than a status; those are the
                ones worth interrupting for. */}
            <div
              className="text-headline leading-tight truncate"
              style={{ color: "var(--c-text)" }}
              aria-live={tone === 'alert' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {instruction}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {countdown && (
              <div className="text-right">
                {/* Numeral and unit apart, the unit smaller and quieter — the
                    same stack `DepartureRow` uses, for the same reason: this app
                    is times and counts, and the figure is the thing being read.
                    The unit is a bundle key rather than a literal, so it is one
                    of the few durations in the app that does translate. */}
                <div className="flex items-baseline justify-end gap-1 leading-none">
                  <span className="text-hero tabular-nums leading-none" style={{ color: TONE[tone] }}>
                    {countdown.mins}
                  </span>
                  <span className="text-caption" style={{ color: "var(--c-text-4)" }}>
                    {t('journey.minUnit')}
                  </span>
                </div>
                <div
                  className="text-caption uppercase mt-0.5"
                  style={{ color: "var(--c-text-4)" }}
                >
                  {t(countdown.labelKey)}
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
          <div className="flex items-center gap-1.5 mt-2 text-footnote min-w-0">
            <ArrowRight size={12} strokeWidth={2.6} className="shrink-0" style={{ color: "var(--c-text-4)" }} />
            <span className="truncate" style={{ color: "var(--c-text-2)" }}>
              {alight.final ? alight.name : t('live.getOffAt', { station: alight.name })}
            </span>
            {alight.clock && (
              <>
                <span style={{ color: "var(--c-text-4)" }}>·</span>
                <span className="tabular-nums shrink-0" style={{ color: "var(--c-text-3)" }}>
                  {alight.final ? t('live.arrivalClock', { time: alight.clock }) : alight.clock}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
