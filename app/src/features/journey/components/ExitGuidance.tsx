import { Accessibility, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exitGuidanceFor } from "../exitGuidance";
import { gateNumbers } from "../stationFacilities";

/**
 * The destination's exit facts, as the closing lines of a journey (PRD §4.2) —
 * on the planned route's destination row and again on the live journey's final
 * stop, so the rider meets them while still on the train rather than in a
 * settings page they'd have read yesterday.
 *
 * Deliberately quiet: this sits under a station name that already carries the
 * row, in the same 11px sub-line both hosts use for "Board · toward …". It
 * renders nothing at all where GMRC publishes nothing — see `exitGuidanceFor`
 * for why that is silence rather than a "no step-free exit" line.
 */
export function ExitGuidance({ stationId }: { stationId: string | null | undefined }) {
  const { t } = useTranslation();
  const guidance = exitGuidanceFor(stationId);
  if (!guidance) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {guidance.stepFreeGates.length > 0 && (
        <Line icon={<Accessibility size={11} strokeWidth={2.4} />}>
          {t('journey.stepFreeExit', {
            gates: t('journey.gateList', {
              count: guidance.stepFreeGates.length,
              gates: gateNumbers(guidance.stepFreeGates),
            }),
          })}
        </Line>
      )}
      {guidance.connections.map((c, i) => (
        <Line key={i} icon={<ArrowLeftRight size={11} strokeWidth={2.4} />}>
          {c.gate !== null && (
            <>
              {/* GMRC's connection wording stays verbatim (§6.7); only the gate
                  label in front of it is ours to translate. */}
              <span style={{ color: "var(--c-text-3)" }}>
                {t('journey.gateList', { count: 1, gates: String(c.gate) })}
              </span>
              <span className="mx-1">·</span>
            </>
          )}
          {c.text}
        </Line>
      ))}
    </div>
  );
}

/** Icon and text, top-aligned so GMRC's longer wording wraps beside the icon. */
function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug"
      style={{ color: "var(--c-text-4)" }}
    >
      <span className="shrink-0 mt-[1px]">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
