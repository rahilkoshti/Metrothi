import { Info, AlertOctagon, Play } from "lucide-react";
import { formatDuration, formatLeaveIn } from "../../engine/journeyEngine";

/**
 * Mid-snap summary for a planned journey, shown inside the home sheet in place
 * of the old full-page results header. Leads with the next few departures
 * ("Upcoming trains"), then fare / total time / arrival, the ticket note, and
 * the primary Start Journey action.
 */
export function JourneySummary({
  result,
  active,
  options,
  selected,
  onSelect,
  onStart,
}: {
  result: any;
  active: any;
  options: any[];
  selected: number;
  onSelect: (idx: number) => void;
  onStart: () => void;
}) {
  const { fare, ticketInfo } = result;
  const isFeasible = active.feasible !== false;
  const upcoming = options.slice(0, 4);

  return (
    <div className="px-5 pt-1 pb-4 flex flex-col gap-4">
      {/* Upcoming trains — the next few departures, tap to select */}
      {upcoming.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--c-text-3)' }}>
            Upcoming trains
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {upcoming.map((opt: any, i: number) => {
              const isSel = i === selected;
              const optFeasible = opt.feasible !== false;
              // Catchable, but only if you're already walking - dimmed and
              // dashed so it never reads as the recommended departure.
              const isTight = !!opt.isTight;
              return (
                <button
                  key={i}
                  onClick={() => onSelect(i)}
                  className="shrink-0 rounded-xl px-3 py-2 text-left transition-all duration-200 active:scale-95"
                  style={{
                    background: isSel ? 'var(--c-accent)' : 'var(--c-card)',
                    border: isSel ? 'none' : isTight ? '1px dashed var(--c-border-2)' : '1px solid var(--c-border)',
                    opacity: !optFeasible ? 0.4 : isTight && !isSel ? 0.6 : 1,
                  }}
                >
                  <div className="text-[16px] font-bold leading-none tabular-nums" style={{ color: isSel ? 'var(--c-accent-fg)' : 'var(--c-text)' }}>
                    {opt.leaveClockTime}
                  </div>
                  <div
                    className="text-[10px] font-semibold mt-1 whitespace-nowrap"
                    style={{ color: isSel ? 'rgba(255,255,255,0.75)' : isTight ? '#f59e0b' : 'var(--c-text-4)' }}
                  >
                    {isTight ? 'Tight connection' : `Leave ${formatLeaveIn(opt.leaveInMins)}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isFeasible ? (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 text-red-400 font-bold mb-1.5 text-sm">
            <AlertOctagon size={16} />
            Route Not Possible
          </div>
          <p className="text-xs font-medium text-red-300/70 leading-snug">
            You'd be stuck at <strong className="text-red-300">{active.strandedAtLine}</strong>, which has finished service for the day.
          </p>
        </div>
      ) : (
        <>
          {/* Fare / journey time / arrival */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3.5 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Fare est.</div>
              <div className="text-2xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>{fare == null ? '—' : `₹${fare}`}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>{fare == null ? 'unavailable' : 'approx.'}</div>
            </div>
            <div className="rounded-2xl p-3.5 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Journey</div>
              <div className="text-2xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>{formatDuration(active.totalMins)}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>total</div>
            </div>
            <div className="rounded-2xl p-3.5 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Arrival</div>
              <div className="text-2xl font-bold leading-none mt-1 tabular-nums" style={{ color: 'var(--c-text)' }}>{active.arriveClockTime ?? '—'}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>est.</div>
            </div>
          </div>

          {/* Ticket note */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-blue-400/80 leading-snug">{ticketInfo.note}</p>
          </div>

          {/* Start Journey */}
          <button
            onClick={onStart}
            className="w-full py-4 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-transform"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
          >
            <Play size={16} fill="currentColor" /> Start Journey
          </button>
        </>
      )}
    </div>
  );
}
