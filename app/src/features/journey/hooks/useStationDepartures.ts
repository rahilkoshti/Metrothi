import { useMemo } from 'react';
import { STATION_BY_ID, estimateLine, fullDayStationSchedule } from '../engine/journeyEngine';
import { useNow } from './useNow';

/** The next departure in one direction, flattened out of the day schedule. */
export interface NextDeparture {
  key: string;
  line: string;
  destinationId: string;
  destinationName: string;
  clockTime: string;
  waitMins: number;
}

/** One line the station serves, with its next departure per direction. */
export interface LineGroup {
  line: string;
  departures: NextDeparture[];
}

export interface StationDepartures {
  /** By line, then by direction, soonest first within each line. */
  groups: LineGroup[];
  /** The single soonest departure from this station, whichever line and
   *  direction it is on — the one figure the sheet header leads with. Null
   *  when the day is over. */
  next: NextDeparture | null;
  /** Whether "Live" can honestly be claimed: at least one of the station's
   *  lines is actually running right now. */
  anyRunning: boolean;
}

/**
 * Everything both departure surfaces on the home sheet need, derived once.
 *
 * The header leads with the soonest departure and the board below lists every
 * direction; those are two readings of one scan, and computing them separately
 * is how two views of the same data start disagreeing about which train is
 * next. Callers that only want the header figure still get the whole thing —
 * it is a pass over at most two lines' timetables, memoised to the minute.
 *
 * Ticks on its own `useNow`, so it belongs in a small component rather than in
 * a screen: mounting it high re-renders the map every 30 seconds.
 */
export function useStationDepartures(stationId: string | undefined): StationDepartures {
  const now = useNow();
  const station = stationId ? STATION_BY_ID[stationId] : undefined;

  const lines = useMemo(
    () => (station ? [station.line, ...(station.secondLine ? [station.secondLine] : [])] : []),
    [station]
  );

  return useMemo(() => {
    if (!station || station.operational === false) {
      return { groups: [], next: null, anyRunning: false };
    }

    const groups: LineGroup[] = [];
    for (const line of lines) {
      const departures: NextDeparture[] = [];
      for (const dir of fullDayStationSchedule(station.id, line, now)) {
        const upcoming = dir.trains.find((t) => !t.departed);
        if (!upcoming) continue;
        departures.push({
          key: `${line}-${dir.destinationId}`,
          line,
          destinationId: dir.destinationId,
          destinationName: dir.destinationName,
          clockTime: upcoming.clockTime,
          waitMins: upcoming.waitMins,
        });
      }
      if (departures.length) {
        departures.sort((a, b) => a.waitMins - b.waitMins);
        groups.push({ line, departures });
      }
    }

    const next = groups
      .flatMap((g) => g.departures)
      .reduce<NextDeparture | null>((best, d) => (!best || d.waitMins < best.waitMins ? d : best), null);

    return {
      groups,
      next,
      anyRunning: lines.some((l) => estimateLine(l, now).status === 'running'),
    };
    // The schedule only moves on the minute, so don't rebuild on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, lines, now.getMinutes()]);
}
