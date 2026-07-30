import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPref, setPref } from '../../../data/db';
import { STATION_BY_ID, type StationRecord } from '../engine/journeyEngine';
import {
  PREF_WALK_SPEED,
  PREF_DEFAULT_DEPARTURE,
  DEFAULT_WALK_SPEED_KMH,
  DEPARTURE_USE_GPS,
  readWalkSpeed,
  readDefaultDeparture,
} from '../../../data/preferences';
import { syncNow } from '../../../services/syncEngine';

/**
 * Dexie-backed preference hooks (PRD §5.7, §8.1 phase E).
 *
 * Same shape as {@link useSavedStations}, for the same reasons: `useLiveQuery`
 * observes the `prefs` table, so a change made on the YOU screen reaches the
 * planner's walk estimate without either of them knowing about the other, and a
 * pref pulled down from another device lands the same way.
 *
 * Both hooks return the *default* for the first frame while IndexedDB is read.
 * That's deliberate and load-bearing on the boot path: an awaited read before
 * first paint is exactly what a map-first app can't afford (§5.7), and the cost
 * of being wrong for one frame is a walk estimate that ticks by a minute — not
 * the flash of the wrong theme that made theme the one synchronous exception.
 *
 * Writes are fire-and-forget: the write is local, the re-render comes from the
 * table, and sync follows when it can.
 */

/** The rider's walking pace in km/h, and a setter. Defaults to 5 km/h. */
export function useWalkSpeed() {
  const walkSpeedKmh = useLiveQuery(
    () => getPref(PREF_WALK_SPEED).then(readWalkSpeed),
    [],
    DEFAULT_WALK_SPEED_KMH,
  );

  const setWalkSpeed = useCallback((kmh: number) => {
    void setPref(PREF_WALK_SPEED, String(kmh)).then(() => syncNow());
  }, []);

  return { walkSpeedKmh, setWalkSpeed };
}

/**
 * The rider's default departure station, or `null` for "use my location".
 *
 * Resolved here rather than by each caller. An id with no station behind it — a
 * stale pref synced from a build with different data — has to read as unset,
 * and that rule belongs in one place: when it lived at the call sites, the
 * planner and the settings row each spelled it differently and a third consumer
 * would have inherited the duty. The raw id comes back too, because the
 * settings `<select>` binds to the stored value, not to the station.
 */
export function useDefaultDeparture(): {
  defaultDepartureId: string | null;
  defaultDeparture: StationRecord | null;
  setDefaultDeparture: (stationId: string | null) => void;
} {
  const defaultDepartureId = useLiveQuery(
    () => getPref(PREF_DEFAULT_DEPARTURE).then(readDefaultDeparture),
    [],
    null as string | null,
  );

  const defaultDeparture = (defaultDepartureId && STATION_BY_ID[defaultDepartureId]) || null;

  const setDefaultDeparture = useCallback((stationId: string | null) => {
    void setPref(PREF_DEFAULT_DEPARTURE, stationId ?? DEPARTURE_USE_GPS).then(() => syncNow());
  }, []);

  return { defaultDepartureId, defaultDeparture, setDefaultDeparture };
}
