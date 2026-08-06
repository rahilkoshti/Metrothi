import { AlertOctagon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDuration, formatLeaveIn, rideMinsOf } from "../../engine/journeyEngine";

/**
 * The day's departure options for a planned journey. Selecting a row lifts the
 * chosen departure up to the sheet, which re-derives the summary and the
 * "Start Journey" target from it. Extracted from the old ResultsScreen.
 */
export function AllTrainsList({
  options,
  selected,
  onSelect,
  sourceName,
}: {
  options: any[];
  selected: number;
  onSelect: (idx: number) => void;
  sourceName: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="text-caption uppercase mb-4" style={{ color: 'var(--c-text-3)' }}>
        {t('journey.allTrainsToday')}
      </h3>

      {options.length === 0 ? (
        <div className="p-4 text-center text-callout rounded-card" style={{ background: 'var(--c-bg)', color: 'var(--c-text-3)' }}>
          {t('journey.noMoreTrainsFrom', { station: sourceName })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {options.map((opt: any, i: number) => {
            const isSelected = i === selected;
            const optFeasible = opt.feasible !== false;
            // Still catchable, but the walk should already have started.
            const isTight = !!opt.isTight;
            // Was `opacity: 0.4` for infeasible and `0.6` for tight. Opacity
            // multiplies foreground *and* background toward the surface, so an
            // option the rider most needs to read carefully — "you cannot make
            // this trip", "start walking now" — was the one rendered hardest to
            // read. The state is carried by colour, a strike-through and the
            // dashed border instead, none of which cost contrast.
            const fgPrimary = isSelected
              ? 'var(--c-accent-fg)'
              : optFeasible ? 'var(--c-text)' : 'var(--c-text-3)';
            const fgSecondary = isSelected ? 'var(--c-accent-fg-2)' : 'var(--c-text-4)';
            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className="w-full text-left rounded-2xl transition-all duration-200 overflow-hidden"
                style={{
                  background: isSelected ? 'var(--c-accent)' : 'var(--c-bg)',
                  border: isSelected ? 'none' : isTight ? '1px dashed var(--c-border-2)' : '1px solid var(--c-border)',
                }}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    {/* The train's own departure time, matching the picker in
                        the summary above. A door-to-door plan's leave time is a
                        minute or two earlier, and showing that here made the
                        same train read as two different departures. */}
                    <div className="text-title-3 leading-none" style={{ color: fgPrimary, textDecoration: optFeasible ? undefined : 'line-through' }}>{opt.departClockTime ?? opt.leaveClockTime}</div>
                    <div className="text-caption mt-1 uppercase" style={{ color: fgSecondary }}>
                      {optFeasible
                        ? t('journey.arriveAt', { time: opt.arriveClockTime })
                        : t('journey.strandedAt', { line: opt.strandedAtLine })}
                    </div>
                  </div>
                  <div className="text-right">
                    {/* Ride time, not `totalMins` — see rideMinsOf. */}
                    <div className="text-headline" style={{ color: fgPrimary }}>{optFeasible ? formatDuration(rideMinsOf(opt) ?? opt.totalMins) : "—"}</div>
                    <div
                      className="text-caption mt-1 uppercase"
                      style={{ color: isSelected ? 'var(--c-accent-fg-2)' : isTight ? 'var(--c-warn)' : fgSecondary }}
                    >
                      {isTight
                        ? t('journey.tightConnection')
                        : t('journey.leaveAt', { when: formatLeaveIn(opt.leaveInMins) })}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="mx-4 border-t-2 border-dashed" style={{ borderColor: 'var(--c-accent-fg-2)', opacity: 0.3 }} />
                )}
                {isSelected && opt.warnings?.length > 0 && (
                  <div className="px-4 py-2 text-caption flex items-center gap-1" style={{ color: 'var(--c-accent-fg-2)' }}>
                    <AlertOctagon size={16} strokeWidth={2.2} /> {t('journey.warningsOnDeparture')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
