import { useState, useEffect } from "react";

// Tracks browser connectivity via navigator.onLine and the online/offline
// events. Used to give offline-specific copy where a network call would
// otherwise fail silently or with a misleading "unavailable" message —
// place search and the map tile layer both degrade offline, but the rest of
// the app (station search, journey planning, fares) works fully offline.
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
