import { useTranslation } from 'react-i18next';
import { ChevronRight, Rss } from 'lucide-react';
import { LineBadge } from '../../../../components/LineBadge';
import { LINE_NAMES } from '../../constants';
import { useStationDepartures } from '../../hooks/useStationDepartures';
import { DepartureRow } from '../DepartureRow';

/**
 * The station sheet's departure board: the next train in each direction, for
 * every line the station serves. Deliberately a preview — "View all" expands
 * the sheet to its full snap, which renders the identical full-day schedule
 * (`StationDetailBody`) in place, keeping the map mounted underneath.
 */
export function UpcomingTrains({ stationId, onViewAll }: { stationId: string; onViewAll: () => void }) {
  const { t } = useTranslation();
  // Shared with the sheet header, which leads with the soonest of these. Two
  // views of one scan, so they cannot disagree about which train is next.
  const { groups, anyRunning } = useStationDepartures(stationId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-title-3" style={{ color: 'var(--c-text)' }}>
          {t('journey.upcomingTrains')}
        </h2>
        {anyRunning && (
          <span className="flex items-center gap-1 text-footnote font-bold" style={{ color: 'var(--c-good)' }}>
            <Rss size={14} strokeWidth={2.2} aria-hidden="true" />
            {t('journey.liveBadge')}
          </span>
        )}
        <button
          onClick={onViewAll}
          className="hit-44 ml-auto flex items-center gap-0.5 text-footnote font-semibold active:opacity-60"
          style={{ color: 'var(--c-accent-text)' }}
        >
          {t('journey.viewAll')}
          <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-5 text-center text-footnote"
          style={{ background: 'var(--c-bg)', color: 'var(--c-text-4)' }}
        >
          {t('journey.noMoreTrains')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.line} className="flex flex-col gap-2">
              {/* Grouped by line, and headed by its name, only where there is a
                  choice to make. At an interchange this board showed up to four
                  rows all prefixed "Next", differing by a first initial and a
                  hue — and hue is already spent on line identity, so it can
                  never be the channel that says *which line*. A heading says it
                  in a word, once; the "Next" prefix comes off every row with
                  it, because under a heading the first row in each direction is
                  the next one by construction. A single-line station has
                  nothing to disambiguate, so it gets no heading at all. */}
              {groups.length > 1 && (
                <div className="flex items-center gap-2">
                  <LineBadge line={g.line} size="xs" />
                  <h3 className="text-caption uppercase" style={{ color: 'var(--c-text-3)' }}>
                    {LINE_NAMES[g.line]}
                  </h3>
                </div>
              )}
              {g.departures.map((d) => (
                <DepartureRow
                  key={d.key}
                  line={d.line}
                  destinationId={d.destinationId}
                  destinationName={d.destinationName}
                  clockTime={d.clockTime}
                  waitMins={d.waitMins}
                  primary="countdown"
                  trailing={
                    anyRunning ? (
                      <Rss size={16} strokeWidth={2.2} style={{ color: 'var(--c-good)' }} aria-hidden="true" />
                    ) : null
                  }
                  inset
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
