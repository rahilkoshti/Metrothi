import { Info, AlertOctagon, Play, Footprints } from "lucide-react";
import { formatDuration, rideMinsOf } from "../../engine/journeyEngine";

/** How many departures the picker shows before deferring to the list below. */
const PICKER_SLOTS = 4;

/** Splits "06:23 AM" into ["06:23", "AM"]; tolerates a missing meridiem. */
function splitClock(t: string | null | undefined): [string, string | undefined] {
  const [time, meridiem] = String(t ?? '—').split(' ');
  return [time, meridiem];
}

/**
 * Mid-snap summary for a planned journey, shown inside the home sheet.
 *
 * One hero and one supporting column, rather than the row of three equal stats
 * this replaced. The rider has exactly one thing to do next — leave — so the
 * countdown to that gets the only large figure; the trip reads beside it as a
 * span (depart → arrive) with the time actually spent on a train underneath.
 * That duration is `rideMinsOf`, never the option's `totalMins`: that number is
 * platform wait + ride, so at 4am it billed an 8-minute hop as a 2h 17m
 * journey, in the largest type on the screen.
 *
 * Arrival is not repeated in the sheet header above — the header owns the
 * route's static facts (stops, transfers), this owns the chosen departure's,
 * which change under it every time the picker moves.
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
  const { fare, ticketInfo, sourceWalkMins = 0, destWalkMins = 0 } = result;
  const isFeasible = active.feasible !== false;
  const isTight = !!active.isTight;

  const leaveIn = active.leaveInMins;
  const isNow = leaveIn == null || Math.round(leaveIn) <= 0 || isTight;
  // Urgency reads off the countdown itself; a tight option is the one case
  // where "now" is not quite enough and the colour has to say so.
  const tone = isTight
    ? '#f59e0b'
    : isNow || leaveIn <= 10
    ? 'var(--c-accent)'
    : 'var(--c-text)';

  // Only the arrival carries a meridiem: the pair almost always shares one, and
  // "06:24 AM → 06:31 AM" is a third wider for no added meaning.
  const [departTime] = splitClock(active.departClockTime ?? active.leaveClockTime);
  const [arriveTime, arriveMeridiem] = splitClock(active.arriveClockTime);

  const rideMins = rideMinsOf(active);

  const picker = options.slice(0, PICKER_SLOTS);
  const overflow = Math.max(0, options.length - picker.length);

  return (
    <div className="px-5 pt-1 pb-4 flex flex-col gap-4">
      {isFeasible ? (
        <div className="rounded-2xl p-4" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
          {/* Two columns on one row: what you do (leave in N) against what you
              get (depart → arrive). Stacking them cost ~70px and pushed Start
              Journey below the sheet's mid snap, so the trip's times ride
              alongside the countdown rather than under a rule. */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.09em]"
                style={{ color: isTight ? '#f59e0b' : 'var(--c-text-3)' }}
              >
                {isTight ? 'Leave now — tight' : isNow ? 'Leave' : 'Leave in'}
              </div>
              <div className="text-[32px] font-bold leading-none tabular-nums mt-1.5" style={{ color: tone }}>
                {isNow ? 'Now' : formatDuration(leaveIn)}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[16px] font-bold leading-none tabular-nums" style={{ color: 'var(--c-text)' }}>
                {departTime}
                <span className="mx-1 font-normal" style={{ color: 'var(--c-text-4)' }}>
                  →
                </span>
                {arriveTime}
                {arriveMeridiem && <span className="text-[11px] ml-1">{arriveMeridiem}</span>}
              </div>
              <div className="text-[11px] font-semibold mt-1.5 tabular-nums" style={{ color: 'var(--c-text-4)' }}>
                {formatDuration(rideMins ?? active.totalMins)} on train
                {fare != null && ` · ~₹${fare}`}
              </div>
            </div>
          </div>

          {isTight && (
            <p className="text-[12px] font-semibold mt-3 leading-snug" style={{ color: '#f59e0b' }}>
              The {departTime} train is still catchable, but only if you set off this minute.
            </p>
          )}

          {/* Door-to-door plans only; a station-to-station trip has no walk legs
              and the card just ends above. Summed rather than split by end — the
              route timeline below names each walk in full. */}
          {sourceWalkMins + destWalkMins > 0 && (
            <>
              <div className="h-px my-3" style={{ background: 'var(--c-border)' }} />
              <div
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: 'var(--c-text-4)' }}
              >
                <Footprints size={12} strokeWidth={2.4} className="shrink-0" />
                Includes {formatDuration(sourceWalkMins + destWalkMins)} walking
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <div className="flex items-center gap-2 text-red-400 font-bold mb-1.5 text-sm">
            <AlertOctagon size={16} />
            Route Not Possible
          </div>
          <p className="text-xs font-medium text-red-300/70 leading-snug">
            You'd be stuck at <strong className="text-red-300">{active.strandedAtLine}</strong>, which has finished
            service for the day. Pick a different departure below.
          </p>
        </div>
      )}

      {/* Departure picker — a segmented row rather than the old scroller. Four
          fixed cells always fit the sheet, so nothing is clipped by the fold and
          it doesn't compete with the sheet's own vertical drag. Each cell is
          only the clock time; the countdown lives once, in the hero above, which
          this control drives. Renders even when the selection is infeasible —
          that's precisely when the rider needs to switch. */}
      {picker.length > 1 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: 'var(--c-text-3)' }}>
              Departures
            </span>
            {overflow > 0 && (
              <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
                All trains below
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Choose a departure">
            {picker.map((opt: any, i: number) => {
              const isSel = i === selected;
              const optFeasible = opt.feasible !== false;
              const optTight = !!opt.isTight;
              const [time, meridiem] = splitClock(opt.departClockTime ?? opt.leaveClockTime);
              // The meridiem is printed only when it changes, timetable-style:
              // four consecutive departures nearly always share one, and
              // repeating it costs the width these cells don't have.
              const prevMeridiem = i > 0 ? splitClock(picker[i - 1].departClockTime ?? picker[i - 1].leaveClockTime)[1] : null;
              const showMeridiem = meridiem && meridiem !== prevMeridiem;
              // Difference is carried by colour, not opacity: a dimmed cell
              // reads as disabled, and both of these are still selectable.
              const color = isSel
                ? 'var(--c-accent-fg)'
                : !optFeasible
                ? 'var(--c-text-4)'
                : optTight
                ? '#f59e0b'
                : 'var(--c-text)';
              return (
                <button
                  key={opt.departTimeMs ?? i}
                  onClick={() => onSelect(i)}
                  aria-pressed={isSel}
                  className="rounded-xl px-1 py-2.5 text-center transition-all duration-200 active:scale-95"
                  style={{
                    background: isSel ? 'var(--c-accent)' : 'var(--c-bg)',
                    border: `1px solid ${isSel ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    boxShadow: isSel ? '0 4px 14px rgba(249,115,22,0.28)' : 'none',
                  }}
                >
                  <span
                    className="text-[15px] font-bold leading-none tabular-nums whitespace-nowrap"
                    style={{ color, textDecoration: optFeasible ? undefined : 'line-through' }}
                  >
                    {time}
                    {showMeridiem && <span className="text-[9px] ml-0.5 align-baseline">{meridiem}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket note — an aside, not a third coloured block competing with the
          picker and the CTA. `where` rides as a second line rather than a
          fourth sentence: the note is the constraint and this is what to do
          about it, and at 11px they stop being separable once run together. It
          only ever has content on a cross-phase trip (§4.2). */}
      <div className="flex items-start gap-2">
        <Info size={13} strokeWidth={2.4} className="shrink-0 mt-0.5" style={{ color: 'var(--c-text-4)' }} />
        <div className="text-[11px] font-semibold leading-snug" style={{ color: 'var(--c-text-4)' }}>
          <p>{ticketInfo.note}</p>
          {ticketInfo.where && (
            <p className="mt-1" style={{ color: 'var(--c-text-3)' }}>
              {ticketInfo.where}
            </p>
          )}
        </div>
      </div>

      {isFeasible && (
        <button
          onClick={onStart}
          className="w-full py-4 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-transform"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
        >
          <Play size={16} fill="currentColor" /> Start Journey
        </button>
      )}
    </div>
  );
}
