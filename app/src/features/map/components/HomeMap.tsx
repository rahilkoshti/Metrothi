import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Polyline, TileLayer, Tooltip, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STATIONS, LINE_PATHS, STATION_BY_ID } from '../../journey/engine/journeyEngine';
import { LINE_COLORS } from '../../journey/constants';
import { useTheme } from '../../../contexts/ThemeContext';
import { LiveTrainsLayer } from './LiveTrainsLayer';

// Fraction of the network the home frame must span, per the brief: the frame
// centres on you and your nearest station but never tightens past this.
const MIN_NETWORK_FRACTION = 1 / 3;

const ALL_LINES = new Set(Object.keys(LINE_PATHS));

// Bounding box of every station with coordinates — the "whole metro map".
const NETWORK_BOUNDS = (() => {
  const pts = STATIONS.filter((s) => s.lat != null && s.lng != null).map(
    (s) => [s.lat!, s.lng!] as [number, number]
  );
  return L.latLngBounds(pts);
})();

const NETWORK_CENTER = NETWORK_BOUNDS.getCenter();

/** Shrink `bounds` about its centre so it spans `f` of the original in each axis. */
function scaleBounds(bounds: L.LatLngBounds, f: number, center: L.LatLng) {
  const latSpan = (bounds.getNorth() - bounds.getSouth()) * f;
  const lngSpan = (bounds.getEast() - bounds.getWest()) * f;
  return L.latLngBounds(
    [center.lat - latSpan / 2, center.lng - lngSpan / 2],
    [center.lat + latSpan / 2, center.lng + lngSpan / 2]
  );
}

/**
 * Frames the map on the user and their nearest station, then zooms back out
 * until at least a third of the network is on screen. Only runs on first fix
 * (and on explicit recentre) so panning isn't fought by a re-frame.
 */
function HomeFrame({
  coords,
  nearest,
  bottomInset,
}: {
  coords: { lat: number; lng: number } | null;
  nearest: any;
  bottomInset: number;
}) {
  const map = useMap();
  const framed = useRef(false);

  useEffect(() => {
    const frame = () => {
      const focus: [number, number][] = [];
      if (coords) focus.push([coords.lat, coords.lng]);
      if (nearest?.lat != null && nearest?.lng != null) focus.push([nearest.lat, nearest.lng]);

      const center = focus.length ? L.latLngBounds(focus).getCenter() : NETWORK_CENTER;

      // Zoom that fits you + your station, and the zoom at which a third of the
      // network fills the viewport. The lower (wider) of the two wins.
      const zoomForFocus = focus.length
        ? map.getBoundsZoom(L.latLngBounds(focus).pad(0.6), false)
        : 20;
      const zoomForNetwork = map.getBoundsZoom(
        scaleBounds(NETWORK_BOUNDS, MIN_NETWORK_FRACTION, center),
        false
      );
      const zoom = Math.min(zoomForFocus, zoomForNetwork);

      // Nudge the centre up so the collapsed sheet doesn't sit on top of it.
      const shifted = map.unproject(map.project(center, zoom).add([0, bottomInset / 2]), zoom);
      map.setView(shifted, zoom, { animate: framed.current });
    };

    if (!framed.current) {
      frame();
      // Only latch once we have a real fix; otherwise re-frame when it lands.
      if (coords) framed.current = true;
    }

    document.addEventListener('home-recenter', frame);
    return () => document.removeEventListener('home-recenter', frame);
  }, [map, coords, nearest, bottomInset]);

  return null;
}

/** Eases to a newly selected station without changing the zoom level. */
function PanTo({ target, bottomInset }: { target: { lat: number; lng: number } | null; bottomInset: number }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const zoom = map.getZoom();
    const shifted = map.unproject(
      map.project([target.lat, target.lng], zoom).add([0, bottomInset / 2]),
      zoom
    );
    map.panTo(shifted, { animate: true, duration: 0.4 });
  }, [map, target, bottomInset]);

  return null;
}

export function HomeMap({
  coords,
  nearest,
  bottomInset,
  selectedStationId,
  onSelectStation,
  panTo,
}: {
  coords: { lat: number; lng: number } | null;
  nearest: any;
  bottomInset: number;
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
  panTo: { lat: number; lng: number } | null;
}) {
  const { theme } = useTheme();

  const polylines = useMemo(
    () =>
      Object.entries(LINE_PATHS).map(([lineId, path]) => ({
        lineId,
        coords: path
          .map((id) => STATION_BY_ID[id])
          .filter((s) => s && s.lat != null && s.lng != null)
          .map((s) => [s.lat!, s.lng!] as [number, number]),
      })),
    []
  );

  const stations = useMemo(() => STATIONS.filter((s) => s.lat != null && s.lng != null), []);

  return (
    <MapContainer
      center={[NETWORK_CENTER.lat, NETWORK_CENTER.lng]}
      zoom={11}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      className="w-full h-full"
      style={{ background: theme === 'dark' ? '#0b0f14' : '#ebe8e0' }}
    >
      <TileLayer
        url={
          theme === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        }
      />

      <HomeFrame coords={coords} nearest={nearest} bottomInset={bottomInset} />
      <PanTo target={panTo} bottomInset={bottomInset} />

      {polylines.map((line) => (
        <Polyline
          key={line.lineId}
          positions={line.coords}
          pathOptions={{
            color: LINE_COLORS[line.lineId] ?? '#666',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
          }}
        />
      ))}

      {stations.map((s) => {
        const isSelected = s.id === selectedStationId;
        // At network-wide zoom every label is noise — name only the anchors.
        const labelled = isSelected || s.interchange;
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat!, s.lng!]}
            radius={isSelected ? 8 : s.interchange ? 6 : 4}
            pathOptions={{
              color: isSelected ? 'var(--c-text)' : '#ffffff',
              weight: isSelected ? 3 : 2,
              fillColor: LINE_COLORS[s.line] ?? '#666',
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelectStation(s.id) }}
          >
            {labelled && (
              <Tooltip permanent direction="right" offset={[6, 0]} className="vignelli-label">
                {s.name}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}

      <LiveTrainsLayer activeLines={ALL_LINES} />

      {coords && (
        <>
          <CircleMarker
            center={[coords.lat, coords.lng]}
            radius={14}
            pathOptions={{ stroke: false, fillColor: '#3b82f6', fillOpacity: 0.18 }}
            interactive={false}
          />
          <CircleMarker
            center={[coords.lat, coords.lng]}
            radius={6}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}
    </MapContainer>
  );
}
