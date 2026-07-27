import { AlertOctagon } from "lucide-react";
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
  return (
    <div>
      <h3 className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--c-text-3)' }}>
        All trains today
      </h3>

      {options.length === 0 ? (
        <div className="p-4 text-center text-sm font-medium rounded-xl" style={{ background: 'var(--c-bg)', color: 'var(--c-text-3)' }}>
          No more trains from {sourceName} today.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {options.map((opt: any, i: number) => {
            const isSelected = i === selected;
            const optFeasible = opt.feasible !== false;
            // Still catchable, but the walk should already have started.
            const isTight = !!opt.isTight;
            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className="w-full text-left rounded-2xl transition-all duration-200 overflow-hidden"
                style={{
                  background: isSelected ? 'var(--c-accent)' : 'var(--c-bg)',
                  border: isSelected ? 'none' : isTight ? '1px dashed var(--c-border-2)' : '1px solid var(--c-border)',
                  opacity: !optFeasible ? 0.4 : isTight && !isSelected ? 0.6 : 1,
                }}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    {/* The train's own departure time, matching the picker in
                        the summary above. A door-to-door plan's leave time is a
                        minute or two earlier, and showing that here made the
                        same train read as two different departures. */}
                    <div className="text-[18px] font-bold leading-none" style={{ color: isSelected ? 'var(--c-accent-fg)' : 'var(--c-text)' }}>{opt.departClockTime ?? opt.leaveClockTime}</div>
                    <div className="text-[11px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--c-text-4)' }}>
                      {optFeasible ? `arrive ${opt.arriveClockTime}` : `stuck at ${opt.strandedAtLine}`}
                    </div>
                  </div>
                  <div className="text-right">
                    {/* Ride time, not `totalMins` — see rideMinsOf. */}
                    <div className="text-[15px] font-bold" style={{ color: isSelected ? 'var(--c-accent-fg)' : 'var(--c-text)' }}>{optFeasible ? formatDuration(rideMinsOf(opt) ?? opt.totalMins) : "—"}</div>
                    <div
                      className="text-[11px] font-semibold mt-0.5 uppercase tracking-wide"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : isTight ? '#f59e0b' : 'var(--c-text-4)' }}
                    >
                      {isTight ? 'tight connection' : `leave ${formatLeaveIn(opt.leaveInMins)}`}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="mx-4 border-t-2 border-dashed border-black/20" />
                )}
                {isSelected && opt.warnings?.length > 0 && (
                  <div className="px-4 py-2 text-[11px] font-bold text-black/60 flex items-center gap-1">
                    <AlertOctagon size={11} /> Warnings on this departure
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
