import { useMemo, useEffect, useState } from 'react';
import { MapContainer, CircleMarker, Polyline, TileLayer, Tooltip, useMap, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STATIONS, LINE_PATHS, STATION_BY_ID, planJourney } from '../../journey/engine/journeyEngine';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { StationBottomSheet } from './StationBottomSheet';
import { LiveTrainsLayer } from './LiveTrainsLayer';
import { Layers, MapPin } from 'lucide-react';

// Fix for default marker icons in Leaflet when using Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { LINE_COLORS } from '../../journey/constants';

function MapEffect({ coords, nearest }: { coords: any, nearest: any }) {
  const map = useMap();
  
  const recenter = () => {
    if (coords && nearest && nearest.lat && nearest.lng) {
      map.fitBounds([
        [coords.lat, coords.lng],
        [nearest.lat, nearest.lng]
      ], { padding: [120, 120], animate: true });
    } else if (coords) {
      map.flyTo([coords.lat, coords.lng], 16, { animate: true });
    }
  };

  useEffect(() => {
    recenter();
  }, [coords, nearest, map]);

  useEffect(() => {
    const handleRecenter = () => recenter();
    document.addEventListener('recenter-map', handleRecenter);
    return () => document.removeEventListener('recenter-map', handleRecenter);
  }, [map, coords, nearest]);

  return null;
}

export function MapScreen({ coords, nearest }: { coords: any, nearest: any }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [routeStartId, setRouteStartId] = useState<string | null>(null);
  const [routeEndId, setRouteEndId] = useState<string | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set(Object.keys(LINE_PATHS)));
  const [showFilters, setShowFilters] = useState(false);

  const plannedJourney = useMemo(() => {
    if (routeStartId && routeEndId) {
      return planJourney(routeStartId, routeEndId);
    }
    return null;
  }, [routeStartId, routeEndId]);

  const plannedRouteCoords = useMemo(() => {
    if (plannedJourney && plannedJourney.stops) {
      return plannedJourney.stops
        .filter((s: any) => s.lat !== null && s.lng !== null)
        .map((s: any) => [s.lat, s.lng] as [number, number]);
    }
    return null;
  }, [plannedJourney]);

  useEffect(() => {
    if (coords && nearest && nearest.lat && nearest.lng) {
      fetch(`https://router.project-osrm.org/route/v1/foot/${coords.lng},${coords.lat};${nearest.lng},${nearest.lat}?geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const path = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
            setRoutePath(path);
          }
        })
        .catch(err => console.error("OSRM fetch error:", err));
    }
  }, [coords, nearest]);

  // Central coordinate for the map (Old High Court)
  const center: [number, number] = [23.037559, 72.567011];

  // Filter stations that have valid coordinates and are on an active line
  const validStations = STATIONS.filter(s => {
    if (s.lat === null || s.lng === null) return false;
    // If routing, only show stations on the route
    if (plannedJourney) {
      return plannedJourney.stops.some((ps: any) => ps.id === s.id);
    }
    if (activeLines.has(s.line)) return true;
    if (s.secondLine && activeLines.has(s.secondLine)) return true;
    return false;
  });

  // Generate polylines for each line
  const polylines = useMemo(() => {
    return Object.entries(LINE_PATHS)
      .filter(([lineId]) => activeLines.has(lineId))
      .map(([lineId, path]) => {
        const lineCoords: [number, number][] = [];
        path.forEach(stationId => {
          const station = STATION_BY_ID[stationId];
          if (station && station.lat !== null && station.lng !== null) {
            lineCoords.push([station.lat, station.lng]);
          }
        });
        return { lineId, coords: lineCoords };
      });
  }, [activeLines]);

  return (
    <div className="w-full h-[calc(100vh-80px)] relative z-0">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full bg-[#ebe8e0]"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={theme === 'dark' 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
        />

        <MapEffect coords={coords} nearest={nearest} />

        {/* User Location Marker & Route */}
        {coords && nearest && nearest.lat && nearest.lng && (
          <>
            <Polyline
              positions={routePath || [[coords.lat, coords.lng], [nearest.lat, nearest.lng]]}
              pathOptions={{ color: theme === 'dark' ? '#fff' : '#000', weight: 4, dashArray: '6, 8', opacity: 0.6 }}
            />
            <CircleMarker
              center={[coords.lat, coords.lng]}
              radius={6}
              pathOptions={{
                color: '#3b82f6',
                weight: 2,
                fillColor: '#60a5fa',
                fillOpacity: 1
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -5]} className="vignelli-label">
                <span style={{ color: '#3b82f6' }}>You are here</span>
              </Tooltip>
            </CircleMarker>
          </>
        )}

        {polylines.map(line => (
          <Polyline
            key={line.lineId}
            positions={line.coords}
            pathOptions={{ 
              color: LINE_COLORS[line.lineId] || '#666', 
              weight: plannedJourney ? 4 : 9, 
              opacity: plannedJourney ? 0.3 : 1,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
        ))}

        {plannedRouteCoords && (
          <Polyline
            positions={plannedRouteCoords}
            pathOptions={{
              color: theme === 'dark' ? '#fff' : '#000',
              weight: 8,
              opacity: 0.9,
              dashArray: '10, 10'
            }}
          />
        )}

        {validStations.map(station => {
          const isInterchange = station.interchange;
          const isSelected = selectedStationId === station.id;
          
          let html = '';
          if (isInterchange) {
            html = `<div class="${isSelected ? 'ring-4 ring-blue-500/50 scale-125' : ''}" style="background-color: ${LINE_COLORS[station.line]}; color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.3); transition: all 0.2s ease-out;"></div>`;
          } else {
            html = `<div class="${isSelected ? 'ring-4 ring-blue-500/50 scale-125' : ''}" style="background-color: white; border: 3px solid ${LINE_COLORS[station.line]}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: all 0.2s ease-out;"></div>`;
          }

          const icon = L.divIcon({
            html,
            className: '',
            iconSize: isInterchange ? [16, 16] : [12, 12],
            iconAnchor: isInterchange ? [8, 8] : [6, 6],
            popupAnchor: [0, -10],
            tooltipAnchor: [12, 0],
          });

          return (
            <Marker 
              key={station.id} 
              position={[station.lat!, station.lng!]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  setSelectedStationId(station.id);
                }
              }}
            >
              <Tooltip 
                permanent 
                direction="right" 
                className="vignelli-label"
                offset={isInterchange ? [7, 0] : [4, 0]}
              >
                {station.name}
              </Tooltip>
            </Marker>
          );
        })}

        <LiveTrainsLayer activeLines={activeLines} />
      </MapContainer>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2">
        <div className="relative">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-full shadow-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
          >
            <Layers size={20} />
          </button>
          {showFilters && (
            <div className="absolute top-12 right-0 bg-white dark:bg-neutral-900 rounded-xl shadow-xl p-3 min-w-[120px] border border-neutral-100 dark:border-neutral-800">
              {Object.keys(LINE_PATHS).map(lineId => (
                <label key={lineId} className="flex items-center gap-2 p-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={activeLines.has(lineId)}
                    onChange={(e) => {
                      const newLines = new Set(activeLines);
                      if (e.target.checked) newLines.add(lineId);
                      else newLines.delete(lineId);
                      setActiveLines(newLines);
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold capitalize text-neutral-700 dark:text-neutral-300">{lineId}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        
        {coords && (
          <button 
            onClick={() => {
              document.dispatchEvent(new CustomEvent('recenter-map'));
            }}
            className="w-10 h-10 mt-1 bg-white dark:bg-neutral-800 rounded-full shadow-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <MapPin size={20} />
          </button>
        )}
      </div>

      {/* Clear Route Button */}
      {(routeStartId || routeEndId) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400]">
          <button 
            onClick={() => {
              setRouteStartId(null);
              setRouteEndId(null);
            }}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-full shadow-lg hover:scale-105 transition-transform"
          >
            Clear Route
          </button>
        </div>
      )}

      <StationBottomSheet 
        stationId={selectedStationId}
        onClose={() => setSelectedStationId(null)}
        onDirectionsFrom={(id: string) => {
          setRouteStartId(id);
          setSelectedStationId(null);
        }}
        onDirectionsTo={(id: string) => {
          setRouteEndId(id);
          setSelectedStationId(null);
          // TODO: Fetch route if start is also set
        }}
        onViewDetails={(id: string) => navigate(`/stations/${id}`)}
      />
    </div>
  );
}

