import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, TileLayer, Tooltip, CircleMarker, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STATIONS, LINE_PATHS, STATION_BY_ID } from '../../journey/engine/journeyEngine';
import { LINE_COLORS } from '../../journey/constants';
import { useTheme } from '../../../contexts/ThemeContext';
import { trackPath, stationPointOnTrack, trackScreenAngleAtStation } from '../../map/geometry/trackGeometry';
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

// Panning is fenced to the metro's footprint (Ahmedabad + Gandhinagar) with a
// little breathing room. Users can roam anywhere inside this box — including
// close-up when zoomed in — but the drag stops solid at the edge (viscosity
// 1.0, no bounce-back), so they can never wander off into empty map.
const AREA_BOUNDS = NETWORK_BOUNDS.pad(0.25);
// Zoom floor: you can't zoom out past seeing the whole network (keeps the view
// on Ahmedabad + Gandhinagar). Ceiling leaves room to inspect any section.
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;

/** Create station marker icon. Interchange=square, terminal=rectangle, else=circle. */
function stationMarkerIcon(
  isSelected: boolean,
  isInterchange: boolean,
  isTerminal: boolean,
  color: string,
  rotationDeg = 0
): L.DivIcon {
  const size = isSelected ? 16 : isInterchange ? 12 : isTerminal ? 14 : 8;
  const w = isTerminal ? size + 4 : size;
  const h = size;
  const strokeWidth = isSelected ? 3 : 2;
  const totalW = w + strokeWidth * 2;
  const totalH = h + strokeWidth * 2;

  let shape: string;
  if (isInterchange) {
    // Square
    shape = `<rect x="${strokeWidth}" y="${strokeWidth}" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="${strokeWidth}" rx="2"/>`;
  } else if (isTerminal) {
    // Rectangle (wider)
    shape = `<rect x="${strokeWidth}" y="${strokeWidth}" width="${w}" height="${h}" fill="${color}" stroke="white" stroke-width="${strokeWidth}" rx="2"/>`;
  } else {
    // Circle
    shape = `<circle cx="${totalW / 2}" cy="${totalH / 2}" r="${size / 2}" fill="${color}" stroke="white" stroke-width="${strokeWidth}"/>`;
  }

  // Rotate the whole svg box rigidly about its centre (= the icon anchor), so
  // the marker stays pinned to the station while its shape turns. Rotating the
  // box rather than the shape inside keeps the shape from being clipped.
  const transform = rotationDeg ? ` style="transform:rotate(${rotationDeg}deg)"` : '';

  return L.divIcon({
    className: 'station-marker',
    iconSize: [totalW, totalH],
    iconAnchor: [totalW / 2, totalH / 2],
    tooltipAnchor: [10, 0],
    html: `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg"${transform}>${shape}</svg>`,
  });
}

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

/**
 * Fits the map to a freshly planned route, leaving room for the sheet at the
 * bottom and the search chrome at the top. Keyed on a route signature so it
 * fires once per new plan, not on every pan.
 */
function RouteFrame({
  routeLegs,
  routeKey,
  bottomPad,
}: {
  routeLegs: { line: string; coords: [number, number][] }[] | null;
  routeKey: string | null;
  bottomPad: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!routeLegs?.length) return;
    const all = routeLegs.flatMap((l) => l.coords);
    if (!all.length) return;
    map.fitBounds(L.latLngBounds(all), {
      paddingTopLeft: [40, 96],
      paddingBottomRight: [40, bottomPad],
      animate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, map]);
  return null;
}

/**
 * Toggles the `map-routing` class on the Leaflet container. Done imperatively
 * because react-leaflet fixes MapContainer's className at mount — a reactive
 * prop wouldn't update it when a route is planned after the map is already up.
 */
function RoutingClass({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle('map-routing', active);
    return () => el.classList.remove('map-routing');
  }, [map, active]);
  return null;
}

/**
 * Reports a tap on the map's own surface. Leaflet doesn't fire this for station
 * markers (they don't bubble) and suppresses it after a pan, so it only means
 * "the user reached past the sheet for the map".
 */
function MapTap({ onTap }: { onTap: () => void }) {
  useMapEvents({ click: onTap });
  return null;
}

function DynamicMinZoom({ areaBounds }: { areaBounds: L.LatLngBounds }) {
  const map = useMapEvents({
    resize: () => {
      map.setMinZoom(map.getBoundsZoom(areaBounds, false));
    }
  });

  useEffect(() => {
    map.setMinZoom(map.getBoundsZoom(areaBounds, false));
  }, [map, areaBounds]);

  return null;
}

export function HomeMap({
  coords,
  nearest,
  bottomInset,
  selectedStationId,
  onSelectStation,
  onMapTap,
  panTo,
  routeLegs = null,
  routeKey = null,
  routeEndpoints = null,
  routeBottomPad = 320,
  paused = false,
}: {
  coords: { lat: number; lng: number } | null;
  nearest: any;
  bottomInset: number;
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
  /** Tap on the map surface itself — not a station marker, not a pan. */
  onMapTap?: () => void;
  panTo: { lat: number; lng: number } | null;
  /** Per-leg track polylines for the planned route (routeLegSlices output). */
  routeLegs?: { line: string; coords: [number, number][] }[] | null;
  /** Stable id for the current route so the fit effect fires once per plan. */
  routeKey?: string | null;
  /** Origin/destination pins + optional place walk-dash geometry. */
  routeEndpoints?: {
    origin: [number, number] | null;
    dest: [number, number] | null;
    originWalk?: [number, number][] | null;
    destWalk?: [number, number][] | null;
  } | null;
  /** Bottom padding (px) reserved for the sheet when framing a route. */
  routeBottomPad?: number;
  /** The map is completely hidden — behind a fully raised sheet or a
   *  full-screen overlay. Stops the live-train ticker; the caller is expected
   *  to also take the map out of the paint path. */
  paused?: boolean;
}) {
  const { theme } = useTheme();
  const routeActive = !!routeLegs?.length;
  const [walkingRoute, setWalkingRoute] = useState<[number, number][] | null>(null);

  // Fetch walking route from OSRM when location or nearest station changes
  useEffect(() => {
    if (!coords || !nearest?.lat || !nearest?.lng) {
      setWalkingRoute(null);
      return;
    }

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/foot/${coords.lng},${coords.lat};${nearest.lng},${nearest.lat}?geometries=geojson&overview=full`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.[0]?.geometry?.coordinates) {
          // OSRM returns [lng, lat], we need [lat, lng]
          setWalkingRoute(
            data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])
          );
        }
      } catch (err) {
        console.error('Failed to fetch walking route:', err);
        setWalkingRoute(null);
      }
    };

    fetchRoute();
  }, [coords, nearest?.lat, nearest?.lng]);

  const polylines = useMemo(
    () =>
      Object.entries(LINE_PATHS).map(([lineId, path]) => {
        // Try to use actual track geometry; fall back to station coords if unavailable.
        const trackCoords = trackPath(lineId);
        const coords = trackCoords
          ? (trackCoords as [number, number][])
          : path
              .map((id) => STATION_BY_ID[id])
              .filter((s) => s && s.lat != null && s.lng != null)
              .map((s) => [s.lat!, s.lng!] as [number, number]);
        return { lineId, coords };
      }),
    []
  );

  const stations = useMemo(() => STATIONS.filter((s) => s.lat != null && s.lng != null), []);

  return (
    <MapContainer
      center={[NETWORK_CENTER.lat, NETWORK_CENTER.lng]}
      zoom={11}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={AREA_BOUNDS}
      maxBoundsViscosity={1.0}
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

      <DynamicMinZoom areaBounds={AREA_BOUNDS} />
      {onMapTap && <MapTap onTap={onMapTap} />}
      <RoutingClass active={routeActive} />
      <HomeFrame coords={coords} nearest={nearest} bottomInset={bottomInset} />
      <PanTo target={panTo} bottomInset={bottomInset} />
      <RouteFrame routeLegs={routeLegs} routeKey={routeKey} bottomPad={routeBottomPad} />

      {polylines.map((line) => (
        <Polyline
          key={line.lineId}
          positions={line.coords}
          smoothFactor={0}
          pathOptions={{
            color: LINE_COLORS[line.lineId] ?? '#666',
            weight: routeActive ? 4 : 5,
            // Fade the network back when a route is highlighted so the chosen
            // path reads as the foreground.
            opacity: routeActive ? 0.2 : 0.9,
            lineJoin: 'round',
            lineCap: 'round',
          }}
        />
      ))}

      {/* Highlighted route: dark casing beneath, line-colored legs on top. */}
      {routeActive && routeLegs!.map((leg, i) => (
        <Polyline
          key={`route-casing-${i}`}
          positions={leg.coords}
          pathOptions={{
            color: theme === 'dark' ? '#000' : '#fff',
            weight: 11,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
          }}
          interactive={false}
        />
      ))}
      {routeActive && routeLegs!.map((leg, i) => (
        <Polyline
          key={`route-${i}`}
          positions={leg.coords}
          pathOptions={{
            color: LINE_COLORS[leg.line] ?? '#666',
            weight: 6,
            opacity: 1,
            lineJoin: 'round',
            lineCap: 'round',
          }}
          interactive={false}
        />
      ))}

      {/* Walk-to-station / walk-from-station dashes when routing from a place. */}
      {routeActive && routeEndpoints?.originWalk && routeEndpoints.originWalk.length > 1 && (
        <Polyline
          positions={routeEndpoints.originWalk}
          pathOptions={{ color: '#3b82f6', weight: 2.5, opacity: 0.7, dashArray: '4, 7', lineCap: 'round' }}
          interactive={false}
        />
      )}
      {routeActive && routeEndpoints?.destWalk && routeEndpoints.destWalk.length > 1 && (
        <Polyline
          positions={routeEndpoints.destWalk}
          pathOptions={{ color: '#3b82f6', weight: 2.5, opacity: 0.7, dashArray: '4, 7', lineCap: 'round' }}
          interactive={false}
        />
      )}

      {/* Origin / destination endpoint pins for the route. */}
      {routeActive && routeEndpoints?.origin && (
        <CircleMarker
          center={routeEndpoints.origin}
          radius={7}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#111', fillOpacity: 1 }}
          interactive={false}
        />
      )}
      {routeActive && routeEndpoints?.dest && (
        <CircleMarker
          center={routeEndpoints.dest}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#F97316', fillOpacity: 1 }}
          interactive={false}
        />
      )}

      {stations.map((s) => {
        const isSelected = s.id === selectedStationId;
        const isInterchange = !!s.interchange;
        const isTerminal = !!s.terminal;
        // At network-wide zoom every label is noise — name only the anchors.
        const labelled = isSelected || isInterchange || isTerminal;
        const color = LINE_COLORS[s.line] ?? '#666';
        // Snap the marker onto the drawn track so it sits on the line, not
        // beside it; fall back to the raw coordinate when track data is missing.
        const position = stationPointOnTrack(s.line, s.id) ?? ([s.lat!, s.lng!] as [number, number]);
        // Terminal caps sit perpendicular to the line: rotate the rectangle's
        // long axis 90° off the track's on-screen direction.
        const trackAngle = isTerminal ? trackScreenAngleAtStation(s.line, s.id) : null;
        const rotationDeg = trackAngle == null ? 0 : trackAngle + 90;

        return (
          <Marker
            key={s.id}
            position={position}
            icon={stationMarkerIcon(isSelected, isInterchange, isTerminal, color, rotationDeg)}
            eventHandlers={{ click: () => onSelectStation(s.id) }}
          >
            {labelled && (
              <Tooltip permanent direction="right" offset={[6, 0]} className="vignelli-label">
                {s.name}
              </Tooltip>
            )}
          </Marker>
        );
      })}

      <LiveTrainsLayer activeLines={ALL_LINES} paused={paused} />

      {walkingRoute && walkingRoute.length > 0 && (
        <Polyline
          positions={walkingRoute}
          pathOptions={{
            color: '#3b82f6',
            weight: 2,
            opacity: 0.5,
            dashArray: '5, 5',
            lineCap: 'round',
            lineJoin: 'round',
          }}
          interactive={false}
        />
      )}

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
