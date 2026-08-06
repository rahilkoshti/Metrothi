import { useTranslation } from 'react-i18next';
import {
  findNearestStation,
  formatDuration,
  walkMinsForKm,
  type PlaceNode,
  type StationRecord,
} from '../engine/journeyEngine';
import { useWalkSpeed } from './usePreferences';

/**
 * What a landmark result actually differentiates itself by: which station it
 * puts you at, and how far you then walk.
 *
 * One definition, two consumers. The search overlay grew this treatment and the
 * planner did not, so the same query answered two different ways depending on
 * which surface you typed it into — the planner printed the constant
 * "Select to find nearest station" under every result, which is the row's
 * behaviour rather than its content and so told a rider nothing about *this*
 * row. Worse, the overlay carried its own nearest-station search rather than
 * the engine's, so the preview and the plan it previewed could in principle
 * disagree. Both now read `findNearestStation`, which is the function that
 * resolves the place for real once the rider commits.
 *
 * The rider's walking pace rides along, so changing it on the YOU screen moves
 * these estimates too (§8.1 phase E).
 */
export interface NearestStationHint {
  /** Null only if the network had no station to offer, which cannot happen with
   *  bundled data — but the empty answer still has a sentence rather than a
   *  crash, because "there is one" is an assertion here and not a proof. */
  station: StationRecord | null;
  /** "400 m · 5 min walk". Two independent facts joined by a separator, not a
   *  sentence assembled from clauses — each half is a whole key (§6.2). */
  meta: string;
}

export function useNearestStationHint(): (place: PlaceNode) => NearestStationHint {
  const { t } = useTranslation();
  const { walkSpeedKmh } = useWalkSpeed();

  return (place) => {
    const { station, distKm } = findNearestStation(place);
    if (!station) return { station: null, meta: t('search.noStationNearby') };
    return {
      station,
      meta: [
        distKm < 1
          ? t('common.distanceMetres', { value: Math.round(distKm * 1000) })
          : t('common.distanceKm', { value: distKm.toFixed(1) }),
        t('common.walk', { duration: formatDuration(walkMinsForKm(distKm, walkSpeedKmh)) }),
      ].join(' · '),
    };
  };
}
