import { Info, MapPin, Navigation2 } from 'lucide-react';
import { STATION_BY_ID } from '../../engine/journeyEngine';

/**
 * The station sheet's primary action pair.
 *
 * The primary button splits on proximity. At the nearest station the useful
 * thing is the walk to it, so "Get Directions" hands off to Google Maps —
 * street-level walking nav is not something this app models. Anywhere else the
 * useful thing is a metro journey ending here, so "Trip to here" seeds the
 * in-app planner via the same `home-plan-trip` event the station detail body
 * uses; `HomeScreen` catches it and opens the overlay with the map still
 * mounted beneath.
 */
export function StationSheetActions({
  stationId,
  /** True when this is the user's nearest station. */
  isNearest = false,
  /** Current position, used as the directions origin. Google Maps falls back to
   *  the device's own location when this is missing. */
  coords = null,
  /** Raise the sheet to its full snap — the detail already lives further down
   *  this same sheet, so it expands in place rather than pushing a page. */
  onExpand,
}: {
  stationId: string;
  isNearest?: boolean;
  coords?: { lat: number; lng: number } | null;
  onExpand?: () => void;
}) {
  const station = STATION_BY_ID[stationId];

  function openWalkingDirections() {
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

  return (
    <div className="flex gap-2.5">
      <button
        onClick={
          isNearest
            ? openWalkingDirections
            : () =>
                document.dispatchEvent(
                  new CustomEvent('home-plan-trip', { detail: { dest: stationId } })
                )
        }
        className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
      >
        {isNearest ? (
          <>
            <Navigation2 size={16} strokeWidth={2.5} fill="currentColor" />
            Get Directions
          </>
        ) : (
          <>
            <MapPin size={16} strokeWidth={2.5} />
            Trip to here
          </>
        )}
      </button>
      <button
        onClick={onExpand}
        className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        style={{ background: 'var(--c-card)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
      >
        <Info size={16} strokeWidth={2.5} />
        Station Details
      </button>
    </div>
  );
}
