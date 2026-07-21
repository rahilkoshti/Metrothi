// Why a location request failed. The browser only gives us a numeric code, and
// the three cases need different wording and different recovery steps, so we
// keep them apart instead of collapsing everything into "denied".
export type LocationErrorKind = 'denied' | 'unavailable' | 'timeout';

function toErrorKind(err?: { code?: number }): LocationErrorKind {
  switch (err?.code) {
    case 1: return 'denied';      // PERMISSION_DENIED
    case 3: return 'timeout';     // TIMEOUT
    default: return 'unavailable'; // POSITION_UNAVAILABLE, or no geolocation API
  }
}

export class LocationService {
  static getCurrentPosition(
    onSuccess: (coords: { lat: number; lng: number }) => void,
    onError: (kind: LocationErrorKind) => void
  ) {
    if (!navigator.geolocation) {
      onError('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => onError(toErrorKind(err)),
      { timeout: 8000 }
    );
  }

  static watchPosition(
    onSuccess: (coords: { lat: number; lng: number }) => void,
    onError: (kind: LocationErrorKind) => void
  ): number | null {
    if (!navigator.geolocation) {
      onError('unavailable');
      return null;
    }
    return navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => onError(toErrorKind(err)),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  }

  static clearWatch(id: number) {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(id);
    }
  }
}
