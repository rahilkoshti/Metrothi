export class LocationService {
  static getCurrentPosition(
    onSuccess: (coords: { lat: number; lng: number }) => void,
    onError: () => void
  ) {
    if (!navigator.geolocation) {
      onError();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      onError,
      { timeout: 8000 }
    );
  }

  static watchPosition(
    onSuccess: (coords: { lat: number; lng: number }) => void,
    onError: () => void
  ): number | null {
    if (!navigator.geolocation) {
      onError();
      return null;
    }
    return navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      onError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  }

  static clearWatch(id: number) {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(id);
    }
  }
}
