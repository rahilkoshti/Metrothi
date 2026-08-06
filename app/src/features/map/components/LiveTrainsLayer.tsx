import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getActiveTrains } from '../../journey/engine/journeyEngine';
import type { ActiveTrain } from '../../journey/engine/journeyEngine';
import { trainPositionOnTrack } from '../geometry/trackGeometry';
import { LINE_COLOR } from '../../journey/constants';
import { LINE_FALLBACK } from '../mapColors';

interface LiveTrainsLayerProps {
  activeLines: Set<string>;
  /** Stop the ticker while the map can't be seen — behind a fully raised sheet
   *  or a full-screen overlay. Rebuilding every train's SVG once a second is
   *  the map's only continuous cost, and none of it lands on screen. Resuming
   *  redraws immediately, so nothing stale survives the gap. */
  paused?: boolean;
}

/** Custom Leaflet renderer for trains — positions update independently of zoom. */
class TrainRenderer extends L.Layer {
  private container: SVGGElement | null = null;
  private updateInterval: number | null = null;
  private activeLines: Set<string> = new Set();
  private trains: Map<string, ActiveTrain> = new Map();
  // Set by the owner while the map is covered. Deliberately not tied to
  // `document.visibilityState` as well: browsers already throttle background
  // timers hard, and the dev preview reports itself hidden while plainly on
  // screen, which would leave the map trainless the whole time.
  private hidden = false;
  // Stable handler reference so onRemove's `off` actually detaches the listener
  // that onAdd's `on` attached.
  private readonly onMapMove = () => this.render();

  constructor(activeLines: Set<string>, hidden = false) {
    super();
    this.activeLines = activeLines;
    this.hidden = hidden;
  }

  /** Called from the React wrapper when the `paused` prop flips. */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.syncTicker();
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

    this.syncTicker();
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

  /** Runs the ticker exactly when the trains are on screen and worth drawing. */
  private syncTicker() {
    const shouldRun = !this.hidden && !!this._map;
    if (shouldRun === (this.updateInterval != null)) return;
    if (shouldRun) this.startUpdating();
    else this.stopUpdating();
  }

  private startUpdating() {
    // Tick straight away: on resume the positions held over from before the
    // pause are stale by however long it lasted, and waiting out the interval
    // would leave them on screen for another second.
    this.tick();
    this.updateInterval = window.setInterval(() => this.tick(), 1000);
  }

  private stopUpdating() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = null;
  }

  private tick() {
    const trains = getActiveTrains().filter((t) => this.activeLines.has(t.line));
    this.trains.clear();
    trains.forEach((t) => this.trains.set(t.id, t));
    this.render();
  }

  private render() {
    if (!this.container || !this._map) return;
    // A pan or zoom while hidden must not redraw; the resume tick repositions
    // everything anyway.
    if (this.hidden) return;

    // Clear previous render
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Render each train
    this.trains.forEach((train) => {
      const latLng = this.getTrainLatLng(train);
      const point = this._map!.latLngToLayerPoint(latLng);
      const color = LINE_COLOR[train.line] || LINE_FALLBACK;

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

export function LiveTrainsLayer({ activeLines, paused = false }: LiveTrainsLayerProps) {
  const map = useMap();
  const rendererRef = useRef<TrainRenderer | null>(null);
  // Seeds the renderer on mount without putting `paused` in the effect's deps,
  // which would tear the layer down and rebuild it on every toggle.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!map) return;

    const renderer = new TrainRenderer(activeLines, pausedRef.current);
    renderer.addTo(map);
    rendererRef.current = renderer;

    return () => {
      if (rendererRef.current) {
        map.removeLayer(rendererRef.current);
      }
    };
  }, [map, activeLines]);

  useEffect(() => {
    rendererRef.current?.setHidden(paused);
  }, [paused]);

  return null;
}
