import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../engine/journeyEngine';
import { LineBadge } from '../../../../components/LineBadge';
import { useStationDepartures } from '../../hooks/useStationDepartures';

/**
 * The answer the home screen exists to give, at the size it deserves.
 *
 * The sheet header used to lead with the station's *identity* — a 10px eyebrow,
 * the name at 22px, then up to seven chips — and put the departure third, below
 * the fold's own furniture. But a rider standing on a platform with the app open
 * already knows which station they are in; the map behind this is telling them.
 * What they do not know is whether to run. So the countdown takes the largest
 * type in the app and the name becomes the eyebrow above it.
 *
 * Its own component for the reason `LineChip` is: this ticks on `useNow`, and a
 * per-minute re-render mounted at `HomeScreen` level would redraw the map.
 */
export function NextDepartureHero({ stationId }: { stationId: string }) {
  const { t } = useTranslation();
  const { next } = useStationDepartures(stationId);

  if (!next) {
    return (
      <div className="text-title-2" style={{ color: 'var(--c-text-3)' }}>
        {t('journey.noMoreTrains')}
      </div>
    );
  }

  // Bare minutes get the numeral-and-unit stack the whole app uses for a
  // countdown; anything past the hour reads better as one formatted string, and
  // "1h 05m" at hero size still fits beside the eyebrow's actions.
  const stackMin = next.waitMins > 0 && next.waitMins < 60;

  return (
    <div>
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="text-hero tabular-nums" style={{ color: 'var(--c-text)' }}>
          {next.waitMins <= 0
            ? t('journey.due')
            : stackMin
              ? Math.round(next.waitMins)
              : formatDuration(next.waitMins)}
        </span>
        {stackMin && (
          <span className="text-caption" style={{ color: 'var(--c-text-4)' }}>
            {t('journey.minUnit')}
          </span>
        )}
      </div>

      {/* A number with no direction is not an answer. The badge is what says
          which line, in a shape rather than only a hue. */}
      <div className="flex items-center gap-2 mt-1 min-w-0">
        <LineBadge line={next.line} size="xs" />
        <span className="text-subhead truncate" style={{ color: 'var(--c-text-2)' }}>
          {t('journey.towards', { station: next.destinationName })}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--c-text-4)' }}>·</span>
        <span className="text-subhead tabular-nums shrink-0" style={{ color: 'var(--c-text-3)' }}>
          {next.clockTime}
        </span>
      </div>
    </div>
  );
}
