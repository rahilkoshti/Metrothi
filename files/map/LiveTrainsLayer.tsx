import { useEffect, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { getActiveTrains } from '../../journey/engine/journeyEngine';
import type { ActiveTrain } from '../../journey/engine/journeyEngine';
import { trainPositionOnTrack } from '../geometry/trackGeometry';
import { LINE_COLORS } from '../../journey/constants';

interface LiveTrainsLayerProps {
  activeLines: Set<string>;
}

// Icons are per-line and static — build once, not per render.
const ICON_CACHE: Record<string, L.DivIcon> = {};
function trainIcon(color: string): L.DivIcon {
  if (ICON_CACHE[color]) return ICON_CACHE[color];
  const size = 14;
  ICON_CACHE[color] = L.divIcon({
    // 'train-glide' lets CSS transition the marker's transform between ticks.
    className: 'train-glide',
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
    tooltipAnchor: [10, 0],
    html: `
      <div style="position:relative;width:${size + 6}px;height:${size + 6}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:${size + 6}px;height:${size + 6}px;border-radius:50%;background-color:${color};opacity:0.25;animation:live-train-pulse 1.8s ease-out infinite;"></div>
        <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background-color:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
          <svg width="7" height="7" viewBox="0 0 24 24" fill="white" style="display:block;">
            <path d="M4 4h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v7h16V6H4zm2 9l-2 3h16l-2-3H6z"/>
          </svg>
        </div>
      </div>
    `,
  });
  return ICON_CACHE[color];
}

// Inject keyframes once.
if (typeof document !== 'undefined' && !document.getElementById('live-train-keyframes')) {
  const style = document.createElement('style');
  style.id = 'live-train-keyframes';
  style.textContent = `
    @keyframes live-train-pulse {
      0%   { transform: scale(0.8); opacity: 0.4; }
      50%  { transform: scale(1.6); opacity: 0.15; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/** Resolve a train's on-screen position: real track first, chord fallback. */
function trainLatLng(t: ActiveTrain): [number, number] {
  const onTrack = trainPositionOnTrack(t.line, t.fromStationId, t.toStationId, t.segmentProgress);
  return onTrack ?? [t.lat, t.lng];
}

export function LiveTrainsLayer({ activeLines }: LiveTrainsLayerProps) {
  const [trains, setTrains] = useState<ActiveTrain[]>([]);

  useEffect(() => {
    setTrains(getActiveTrains());
    const interval = setInterval(() => setTrains(getActiveTrains()), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleTrains = trains.filter((t) => activeLines.has(t.line));

  return (
    <>
      {visibleTrains.map((train) => {
        const color = LINE_COLORS[train.line] || '#666';
        return (
          <Marker
            key={train.id}
            position={trainLatLng(train)}
            icon={trainIcon(color)}
            zIndexOffset={1000}
          >
            <Tooltip direction="top" offset={[0, -10]} className="vignelli-label">
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, color }}>
                  {train.direction}
                  <span style={{
                    marginLeft: 6, fontSize: '0.7em', fontWeight: 800,
                    letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55,
                  }}>
                    Simulated
                  </span>
                </div>
                <div style={{ fontSize: '0.75em', opacity: 0.75 }}>
                  {train.fromStationName} → {train.toStationName}
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
