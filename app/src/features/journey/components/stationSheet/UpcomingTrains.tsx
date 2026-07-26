import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Rss, TrainFront } from 'lucide-react';
import {
  STATION_BY_ID,
  fullDayStationSchedule,
  estimateLine,
  formatDuration,
} from '../../engine/journeyEngine';
import { useNow } from '../../hooks/useNow';
import { LINE_COLORS } from '../../constants';

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
 * every line the station serves. Deliberately a preview — "View all" hands off
 * to the station page for the full day's schedule.
 */
export function UpcomingTrains({ stationId }: { stationId: string }) {
  const navigate = useNavigate();
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
          onClick={() => navigate(`/stations/${stationId}`)}
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
          style={{ background: 'var(--c-card)', color: 'var(--c-text-4)' }}
        >
          No more trains today
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {departures.map((d) => (
            <div
              key={d.key}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${LINE_COLORS[d.line]}1f` }}
              >
                <TrainFront size={18} strokeWidth={2.2} style={{ color: LINE_COLORS[d.line] }} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
                  Towards {d.destinationName}
                </div>
                <div className="text-[12px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
                  Next · {d.clockTime}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right leading-none">
                  {/* Bare minutes get the big number + "min" stack of the
                      reference; anything over an hour reads better as one
                      formatted string. */}
                  <div className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
                    {d.waitMins === 0
                      ? 'Due'
                      : d.waitMins >= 60
                      ? formatDuration(d.waitMins)
                      : Math.round(d.waitMins)}
                  </div>
                  {d.waitMins > 0 && d.waitMins < 60 && (
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--c-text-4)' }}>
                      min
                    </div>
                  )}
                </div>
                {anyRunning && <Rss size={15} strokeWidth={2.4} className="text-green-500" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
