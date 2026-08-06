import { forwardRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { formatDuration, LINE_PATHS } from '../engine/journeyEngine';
import { LINE_COLOR, LINE_ON_SURFACE } from '../constants';

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
  const { t } = useTranslation();
  // Two colours, one line. `fill` is the signage hex and is only ever used as
  // a background or a tint; `ink` is the theme-aware token used wherever the
  // line has to be *read*. The highlighted figure below is why: it was drawn
  // in the fill, which on the Yellow Line is #EAB308 at 22px on white —
  // 1.92:1, on the single most important number on the departure board.
  const fill = LINE_COLOR[line];
  const ink = LINE_ON_SURFACE[line];
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
        border: `1px solid ${highlight ? `${fill}55` : 'var(--c-border)'}`,
      }}
    >
      <div className="flex items-center gap-1 shrink-0">
        <span
          className="w-9 h-9 rounded-control flex items-center justify-center shrink-0 text-headline leading-none"
          style={{
            background: departed ? 'var(--c-card-alt)' : `${fill}1f`,
            color: departed ? 'var(--c-text-4)' : ink,
          }}
          aria-hidden
        >
          {destinationName.trim().charAt(0).toUpperCase()}
        </span>
        <ArrowRight
          size={16}
          strokeWidth={2.2}
          style={{
            color: departed ? 'var(--c-text-4)' : ink,
            transform: towardEnd ? undefined : 'rotate(180deg)',
          }}
          aria-hidden
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-headline truncate" style={{ color: departed ? 'var(--c-text-3)' : 'var(--c-text)' }}>
          {t('journey.towards', { station: destinationName })}
        </div>
        <div className="text-footnote" style={{ color: 'var(--c-text-4)' }}>
          {departed ? (
            // The "12m" half is a duration and stays English until §6.6 phase 4;
            // the sentence around it is ours.
            waitMins < 0
              ? t('journey.departedAgo', { duration: `${Math.abs(waitMins)}m` })
              : t('common.departed')
          ) : (
            <>
              {label && (
                <span className={highlight ? 'font-bold' : undefined} style={highlight ? { color: ink } : undefined}>
                  {label} ·{' '}
                </span>
              )}
              <span className="tabular-nums">
                {primary === 'countdown'
                  ? clockTime
                  : waitMins === 0
                  ? t('journey.dueNow')
                  : t('journey.inDuration', { duration: formatDuration(waitMins) })}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right leading-none">
          <div
            className={`tabular-nums ${highlight ? 'text-title-2' : 'text-title-3'}`}
            /* A departed row used to be dimmed with `opacity: 0.55`, which
               multiplies text *and* card toward the surface and took an
               already-marginal 4.83:1 down to roughly 2.9:1. The state is what
               the strike-through and the muted token are for; neither costs
               contrast. */
            style={{
              color: highlight ? ink : departed ? 'var(--c-text-4)' : 'var(--c-text)',
              textDecoration: departed ? 'line-through' : undefined,
            }}
          >
            {primary === 'time'
              ? clockTime
              : waitMins <= 0
              ? t('journey.due')
              : stackMin
              ? Math.round(waitMins)
              : formatDuration(waitMins)}
          </div>
          {stackMin && (
            <div className="text-caption mt-0.5" style={{ color: 'var(--c-text-4)' }}>
              {t('journey.minUnit')}
            </div>
          )}
        </div>
        {trailing}
      </div>
    </Tag>
  );
});
