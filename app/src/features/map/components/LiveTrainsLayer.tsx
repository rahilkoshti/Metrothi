import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getActiveTrains } from '../../journey/engine/journeyEngine';
import type { ActiveTrain } from '../../journey/engine/journeyEngine';
import { trainPositionOnTrack } from '../geometry/trackGeometry';
import { LINE_COLORS } from '../../journey/constants';

interface LiveTrainsLayerProps {
  activeLines: Set<string>;
}

/** Custom Leaflet renderer for trains — positions update independently of zoom. */
class TrainRenderer extends L.Layer {
  private container: SVGGElement | null = null;
  private updateInterval: number | null = null;
  private activeLines: Set<string> = new Set();
  private trains: Map<string, ActiveTrain> = new Map();
  // Stable handler reference so onRemove's `off` actually detaches the listener
  // that onAdd's `on` attached.
  private readonly onMapMove = () => this.render();

  constructor(activeLines: Set<string>) {
    super();
    this.activeLines = activeLines;
  }

  onAdd(map: L.Map) {
    this.container = L.SVG.create('g');
    this.container.setAttribute('class', 'live-trains-layer');

    // Attach to the shared SVG renderer's root group — the same coordinate
    // space as the vector polylines, since our train points come from
    // latLngToLayerPoint. (Leaflet's SVG renderer exposes the <g> as
    // `_rootGroup` and the <svg> as `_container`; there is no `_svg`.)
    const renderer = (map as any).getRenderer(this) as any;
    const svgRoot: SVGElement | undefined = renderer?._rootGroup ?? renderer?._container;
    if (svgRoot) svgRoot.appendChild(this.container);

    this.startUpdating();
    map.on('move zoom', this.onMapMove);
    return this;
  }

  onRemove(map: L.Map) {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.stopUpdating();
    map.off('move zoom', this.onMapMove);
    return this;
  }

  private startUpdating() {
    this.updateInterval = window.setInterval(() => {
      const trains = getActiveTrains().filter((t) => this.activeLines.has(t.line));
      this.trains.clear();
      trains.forEach((t) => this.trains.set(t.id, t));
      this.render();
    }, 1000);
  }

  private stopUpdating() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  private render() {
    if (!this.container || !this._map) return;

    // Clear previous render
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Render each train
    this.trains.forEach((train) => {
      const latLng = this.getTrainLatLng(train);
      const point = this._map!.latLngToLayerPoint(latLng);
      const color = LINE_COLORS[train.line] || '#666';

      const size = 14;
      const group = L.SVG.create('g');
      group.setAttribute('class', 'train-marker');
      group.setAttribute('transform', `translate(${point.x},${point.y})`);

      // Pulse halo
      const halo = L.SVG.create('circle');
      halo.setAttribute('r', String(size + 6));
      halo.setAttribute('fill', color);
      halo.setAttribute('opacity', '0.25');
      halo.setAttribute('class', 'train-halo');
      group.appendChild(halo);

      // Main circle
      const circle = L.SVG.create('circle');
      circle.setAttribute('r', String(size / 2));
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('class', 'train-dot');
      group.appendChild(circle);

      // Directional arrowhead — points the way the train is travelling. Falls
      // back to a plain centre dot when the heading can't be derived.
      const headingDeg = this.trainHeadingDeg(train);
      if (headingDeg == null) {
        const dot = L.SVG.create('circle');
        dot.setAttribute('r', '2');
        dot.setAttribute('fill', 'white');
        group.appendChild(dot);
      } else {
        const arrow = L.SVG.create('path');
        arrow.setAttribute('d', 'M -2.5 -3.6 L 4.5 0 L -2.5 3.6 Z');
        arrow.setAttribute('fill', 'white');
        arrow.setAttribute('transform', `rotate(${headingDeg})`);
        group.appendChild(arrow);
      }

      this.container!.appendChild(group);
    });
  }

  private getTrainLatLng(train: ActiveTrain): L.LatLng {
    const onTrack = trainPositionOnTrack(
      train.line,
      train.fromStationId,
      train.toStationId,
      train.segmentProgress
    );
    const [lat, lng] = onTrack ?? [train.lat, train.lng];
    return L.latLng(lat, lng);
  }

  /**
   * On-screen heading of the train (degrees, clockwise from east), derived from
   * two track points straddling its current position — from→to is the travel
   * direction. Measured in layer-point space so it matches what's drawn.
   * Returns null when geometry is missing or the step is too small to trust.
   */
  private trainHeadingDeg(train: ActiveTrain): number | null {
    if (!this._map) return null;
    const step = 0.05;
    const p = train.segmentProgress;
    const behind = trainPositionOnTrack(train.line, train.fromStationId, train.toStationId, Math.max(0, p - step));
    const ahead = trainPositionOnTrack(train.line, train.fromStationId, train.toStationId, Math.min(1, p + step));
    if (!behind || !ahead) return null;
    const a = this._map.latLngToLayerPoint(L.latLng(behind[0], behind[1]));
    const b = this._map.latLngToLayerPoint(L.latLng(ahead[0], ahead[1]));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.25) return null;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
}

export function LiveTrainsLayer({ activeLines }: LiveTrainsLayerProps) {
  const map = useMap();
  const rendererRef = useRef<TrainRenderer | null>(null);

  useEffect(() => {
    if (!map) return;

    const renderer = new TrainRenderer(activeLines);
    renderer.addTo(map);
    rendererRef.current = renderer;

    return () => {
      if (rendererRef.current) {
        map.removeLayer(rendererRef.current);
      }
    };
  }, [map, activeLines]);

  return null;
}
