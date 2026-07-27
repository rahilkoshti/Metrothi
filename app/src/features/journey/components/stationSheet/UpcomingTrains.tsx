import { useMemo } from 'react';
import { ChevronRight, Rss } from 'lucide-react';
import {
  STATION_BY_ID,
  fullDayStationSchedule,
  estimateLine,
} from '../../engine/journeyEngine';
import { useNow } from '../../hooks/useNow';
import { DepartureRow } from '../DepartureRow';

/** The next departure in one direction, flattened out of the day schedule. */
interface NextDeparture {
  key: string;
  line: string;
  destinationName: string;
  clockTime: string;
  waitMins: number;
}

/**
 * The station sheet's departure board: the next train in each direction, for
 * every line the station serves. Deliberately a preview — "View all" expands
 * the sheet to its full snap, which renders the identical full-day schedule
 * (`StationDetailBody`) in place, keeping the map mounted underneath.
 */
export function UpcomingTrains({ stationId, onViewAll }: { stationId: string; onViewAll: () => void }) {
  const now = useNow();
  const station = STATION_BY_ID[stationId];

  const lines = useMemo(
    () => (station ? [station.line, ...(station.secondLine ? [station.secondLine] : [])] : []),
    [station]
  );

  const departures = useMemo(() => {
    const out: NextDeparture[] = [];
    for (const line of lines) {
      for (const dir of fullDayStationSchedule(stationId, line, now)) {
        const next = dir.trains.find((t) => !t.departed);
        if (!next) continue;
        out.push({
          key: `${line}-${dir.destinationId}`,
          line,
          destinationName: dir.destinationName,
          clockTime: next.clockTime,
          waitMins: next.waitMins,
        });
      }
    }
    return out.sort((a, b) => a.waitMins - b.waitMins);
    // The schedule only moves on the minute, so don't rebuild on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, lines, now.getMinutes()]);

  // "Live" is claimed only while at least one of the station's lines is running.
  const anyRunning = lines.some((l) => estimateLine(l, now).status === 'running');

  if (!station || station.operational === false) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[17px] font-bold" style={{ color: 'var(--c-text)' }}>
          Upcoming Trains
        </h2>
        {anyRunning && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
        <button
          onClick={onViewAll}
          className="ml-auto flex items-center gap-0.5 text-[13px] font-semibold active:opacity-60"
          style={{ color: 'var(--c-accent)' }}
        >
          View all
          <ChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      {departures.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-5 text-center text-[13px] font-semibold"
          style={{ background: 'var(--c-bg)', color: 'var(--c-text-4)' }}
        >
          No more trains today
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {departures.map((d) => (
            <DepartureRow
              key={d.key}
              line={d.line}
              destinationName={d.destinationName}
              clockTime={d.clockTime}
              waitMins={d.waitMins}
              primary="countdown"
              label="Next"
              trailing={anyRunning ? <Rss size={15} strokeWidth={2.4} className="text-green-500" /> : null}
              inset
            />
          ))}
        </div>
      )}
    </div>
  );
}
