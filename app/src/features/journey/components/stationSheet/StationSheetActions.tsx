import { Route } from 'lucide-react';
import { STATION_BY_ID } from '../../engine/journeyEngine';

/**
 * Hand off to Google Maps for the street-level walk to a station — not
 * something this app models. Exported because the sheet no longer carries a
 * directions button of its own; whichever surface takes it over calls this.
 */
export function openWalkingDirections(
  stationId: string,
  coords: { lat: number; lng: number } | null = null
) {
  const station = STATION_BY_ID[stationId];
  // Coords where we have them; the name is the fallback for the handful of
  // unopened stations the dataset has no position for.
  const destination =
    station?.lat != null && station?.lng != null
      ? `${station.lat},${station.lng}`
      : `${station?.name ?? ''} Metro Station, Ahmedabad`;

  const params = new URLSearchParams({ api: '1', destination, travelmode: 'walking' });
  if (coords) params.set('origin', `${coords.lat},${coords.lng}`);

  // The universal link opens the Maps app on a phone and the site elsewhere.
  window.open(`https://www.google.com/maps/dir/?${params}`, '_blank', 'noopener,noreferrer');
}

/**
 * The station sheet's primary action: start planning a journey from here.
 *
 * Which end of the trip the station fills depends on proximity. At the nearest
 * station you're standing at the origin, so it seeds the source; anywhere else
 * you're looking at somewhere you want to get to, so it seeds the destination.
 * Either way it fires the same `home-plan-trip` event the station detail body
 * uses, which `HomeScreen` catches to open the planner overlay with the map
 * still mounted beneath.
 */
export function StationSheetActions({
  stationId,
  /** True when this is the user's nearest station. */
  isNearest = false,
}: {
  stationId: string;
  isNearest?: boolean;
}) {
  return (
    <button
      onClick={() =>
        document.dispatchEvent(
          new CustomEvent('home-plan-trip', {
            detail: isNearest ? { source: stationId } : { dest: stationId },
          })
        )
      }
      className="w-full py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
      style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
    >
      <Route size={16} strokeWidth={2.5} />
      Start Journey
    </button>
  );
}
