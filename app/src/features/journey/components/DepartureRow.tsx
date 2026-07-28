import { forwardRef, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { formatDuration, LINE_PATHS } from '../engine/journeyEngine';
import { LINE_COLORS } from '../constants';

export interface DepartureRowProps {
  line: string;
  /** Terminal station ID the train ends at — picks which way the badge's
   *  direction arrow points (see LINE_PATHS). */
  destinationId?: string;
  destinationName: string;
  clockTime: string;
  waitMins: number;
  /**
   * Which figure takes the big right-hand slot; the other one drops into the
   * subtitle. The home sheet leads with the countdown ("2h 29m", clock time
   * below); the full-day schedule leads with the departure time, where the
   * timetable itself is what you're reading.
   */
  primary?: 'countdown' | 'time';
  /** Subtitle prefix — rendered in the line colour when `highlight` is set. */
  label?: string;
  /** Tints the border and the primary figure with the line colour. */
  highlight?: boolean;
  departed?: boolean;
  /** Slotted after the primary figure (e.g. the live indicator). */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Set when the row sits directly on the sheet surface (--c-card) rather
   *  than an already-grey scroller — renders as the grey inset card instead
   *  of white-on-white. */
  inset?: boolean;
}

/**
 * One departure card: line-tinted train icon, "Towards X", a subtitle, and one
 * big figure on the right. Shared by the station sheet's departure board and
 * the station page's full-day schedule so the two can't drift apart.
 */
export const DepartureRow = forwardRef<HTMLElement, DepartureRowProps>(function DepartureRow(
  {
    line,
    destinationId,
    destinationName,
    clockTime,
    waitMins,
    primary = 'countdown',
    label,
    highlight = false,
    departed = false,
    trailing,
    onClick,
    inset = false,
  },
  ref
) {
  const color = LINE_COLORS[line];
  // Two termini per line ⇒ the badge arrow points at whichever end of the
  // track `destinationId` is — a shape cue reads faster than a colour one,
  // and doesn't cost the line its single, recognisable colour.
  const path = LINE_PATHS[line];
  const towardEnd = !path || !destinationId || path[path.length - 1] === destinationId;
  const Tag = (onClick ? 'button' : 'div') as 'button';
  // Bare minutes get the big number + "min" stack of the reference; anything
  // over an hour reads better as one formatted string.
  const stackMin = primary === 'countdown' && waitMins > 0 && waitMins < 60;

  return (
    <Tag
      ref={ref as never}
      onClick={onClick}
      className={`w-full shrink-0 flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors${
        onClick ? ' active:opacity-70' : ''
      }`}
      style={{
        background: inset ? 'var(--c-bg)' : 'var(--c-card)',
        border: `1px solid ${highlight ? `${color}55` : 'var(--c-border)'}`,
        opacity: departed ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-1 shrink-0">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-bold leading-none"
          style={{
            background: departed ? 'var(--c-card-alt)' : `${color}1f`,
            color: departed ? 'var(--c-text-4)' : color,
          }}
          aria-hidden
        >
          {destinationName.trim().charAt(0).toUpperCase()}
        </span>
        <ArrowRight
          size={13}
          strokeWidth={3}
          style={{
            color: departed ? 'var(--c-text-4)' : color,
            transform: towardEnd ? undefined : 'rotate(180deg)',
          }}
          aria-hidden
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
          Towards {destinationName}
        </div>
        <div className="text-[12px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
          {departed ? (
            waitMins < 0 ? `${Math.abs(waitMins)}m ago` : 'Departed'
          ) : (
            <>
              {label && (
                <span className={highlight ? 'font-bold' : undefined} style={highlight ? { color } : undefined}>
                  {label} ·{' '}
                </span>
              )}
              <span className="tabular-nums">
                {primary === 'countdown'
                  ? clockTime
                  : waitMins === 0
                  ? 'Due now'
                  : `in ${formatDuration(waitMins)}`}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right leading-none">
          <div
            className={`font-bold tabular-nums ${
              highlight ? 'text-[22px]' : departed && primary === 'time' ? 'text-[16px] line-through' : 'text-[20px]'
            }`}
            style={{ color: highlight ? color : departed ? 'var(--c-text-4)' : 'var(--c-text)' }}
          >
            {primary === 'time'
              ? clockTime
              : waitMins <= 0
              ? 'Due'
              : stackMin
              ? Math.round(waitMins)
              : formatDuration(waitMins)}
          </div>
          {stackMin && (
            <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--c-text-4)' }}>
              min
            </div>
          )}
        </div>
        {trailing}
      </div>
    </Tag>
  );
});
