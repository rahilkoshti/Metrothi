import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  animate,
  type PanInfo,
} from 'framer-motion';
// Matches the feel of the other sheets in the app rather than a linear ease.
// Shared from `sheetMotion` because "the other sheets in the app" is a claim
// something has to keep true — `TrainRouteSheet` rises on the same spring.
import { SPRING } from './sheetMotion';

export type SheetSnap = 'collapsed' | 'mid' | 'full';

const SNAP_ORDER: SheetSnap[] = ['collapsed', 'mid', 'full'];

// Past this speed the gesture is a flick: honour its direction instead of
// snapping to whichever point happens to be nearest.
const FLICK_VELOCITY = 500; // px/s, framer's units

// The sheet is exactly as tall as its parent, so y ≈ 0 means it hides all of
// it. A hair of slack absorbs the spring's sub-pixel rest and the elastic
// overshoot past the top constraint.
const COVERED_EPSILON = 1; // px

/**
 * Bottom sheet with three snap points. Sits inside a
 * `position: relative; overflow: hidden` parent and is sized to it, so the
 * off-screen remainder is clipped by the parent rather than the viewport.
 *
 * Dragging is driven by framer-motion via `useDragControls`, with
 * `dragListener={false}` so the sheet only moves when a gesture explicitly
 * hands off to it — the header always, and the content area only when it's
 * scrolled to the top. Everything else in the content scrolls natively.
 *
 * Note the element must not span the full parent: at rest it covers only its
 * peek height, so the map behind it stays interactive.
 */
export function DraggableSheet({
  snap,
  onSnapChange,
  collapsedHeight,
  midRatio = 0.45,
  midContentHeight,
  header,
  children,
  onCoverageChange,
  onRestEdgeChange,
  className = '',
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  collapsedHeight: number;
  midRatio?: number;
  /** How much of the scrollable content the mid snap should reveal, in px.
   *  Overrides `midRatio` so the sheet can rest exactly at the end of a block
   *  rather than at an arbitrary fraction — no half-cropped row, nothing from
   *  the next section peeking. Falls back to `midRatio` when undefined. */
  midContentHeight?: number;
  header: React.ReactNode;
  children: React.ReactNode;
  /** Called when the sheet starts or stops hiding its parent entirely. Tracks
   *  the live position rather than the snap prop, so it only reports "covered"
   *  once the sheet has actually arrived — whatever is behind stays visible for
   *  the whole drag or spring up. */
  onCoverageChange?: (covered: boolean) => void;
  /** How tall the sheet stands at its current *snap*, in px from the parent's
   *  bottom edge — what a caller needs to float its own chrome clear of the
   *  sheet. Unlike `onCoverageChange` this tracks the snap rather than the live
   *  position: it fires once per settled snap, not per frame, so controls
   *  anchored to it don't re-render through a drag. The peek can exceed
   *  `collapsedHeight` when the header outgrows it, which is exactly the case a
   *  caller can't compute from its own constants. */
  onRestEdgeChange?: (px: number) => void;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [height, setHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  const pointsFor = useCallback(
    (h: number, headerH: number) => {
      // The peek is never shorter than the header, or a header that grew past
      // the caller's constant — a chip row wrapping to a second line — would be
      // cut off at the fold with no way to see it but expanding the sheet.
      const collapsed = Math.max(0, h - Math.max(collapsedHeight, headerH));
      // Never let a content fit swallow the whole screen — cap it at 60% of
      // viewport height so a floor of map (and the floating controls that sit
      // on it) stays clear even on a big interchange — nor rise above the
      // collapsed peek. Content taller than that caps here and scrolls once
      // expanded.
      const fitted =
        midContentHeight != null && headerH > 0
          ? Math.min(collapsed, Math.max(Math.round(h * 0.4), h - (headerH + midContentHeight)))
          : Math.round(h * midRatio);
      return { collapsed, mid: fitted, full: 0 };
    },
    [collapsedHeight, midRatio, midContentHeight]
  );

  const snapY = useMemo(() => pointsFor(height, headerHeight), [pointsFor, height, headerHeight]);

  const initialised = useRef(false);
  // Read inside the layout effect for the initial park only, so a later snap
  // change doesn't re-run measurement.
  const snapRef = useRef(snap);
  snapRef.current = snap;

  // Held in a ref so the callback's identity can't retrigger the measurement
  // effect below, which owns the ResizeObserver.
  const coverageCb = useRef(onCoverageChange);
  coverageCb.current = onCoverageChange;
  const covered = useRef(false);
  const reportCoverage = useCallback((position: number) => {
    // Before the first measurement y is a meaningless 0, which would read as
    // "covering everything" — the exact opposite of where the sheet parks.
    if (!initialised.current) return;
    const next = position <= COVERED_EPSILON;
    if (next === covered.current) return;
    covered.current = next;
    coverageCb.current?.(next);
  }, []);

  useMotionValueEvent(y, 'change', reportCoverage);

  const restEdgeCb = useRef(onRestEdgeChange);
  restEdgeCb.current = onRestEdgeChange;
  useEffect(() => {
    if (height === 0) return;
    restEdgeCb.current?.(height - snapY[snap]);
  }, [height, snapY, snap]);

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      // The header is measured here rather than in its own effect so the first
      // park below already knows it — a content-fitted mid snap needs both.
      const headerH = grabRef.current?.offsetHeight ?? 0;
      setHeight(h);
      setHeaderHeight(headerH);
      // Seed the position before the first paint. Without this the sheet
      // renders at y=0 for a frame — covering the whole map — then slides down.
      if (!initialised.current && h > 0) {
        initialised.current = true;
        y.set(pointsFor(h, headerH)[snapRef.current]);
      }
      // Setting y to a value it already holds doesn't notify, so a sheet that
      // parks at `full` would never announce itself. Report explicitly.
      reportCoverage(y.get());
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (grabRef.current) ro.observe(grabRef.current);
    measure();
    return () => ro.disconnect();
  }, [y, pointsFor, reportCoverage]);

  // Re-park whenever the snap changes from outside (selecting a station,
  // closing search) — but never on the very first measurement.
  const parkedSnap = useRef(snap);
  useEffect(() => {
    if (height === 0 || !initialised.current) return;
    // Only a genuine snap change is worth a spring. When the geometry moves
    // under a stationary sheet — a station with more departures, a rotation —
    // jump straight to the new point instead of sliding for no reason.
    if (parkedSnap.current !== snap) {
      parkedSnap.current = snap;
      const controls = animate(y, snapY[snap], SPRING);
      return () => controls.stop();
    }
    y.set(snapY[snap]);
  }, [snap, snapY, height, y]);

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    const current = y.get();
    const velocity = info.velocity.y;

    let next: SheetSnap;
    if (Math.abs(velocity) > FLICK_VELOCITY) {
      const idx = SNAP_ORDER.indexOf(snap);
      // Positive velocity is downward travel, i.e. collapsing one step.
      next = SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, idx + (velocity > 0 ? -1 : 1)))];
    } else {
      next = SNAP_ORDER.reduce((best, s) =>
        Math.abs(snapY[s] - current) < Math.abs(snapY[best] - current) ? s : best
      );
    }

    // Always animate — if the snap is unchanged the effect above won't re-run,
    // and the sheet would be left wherever the finger let go.
    animate(y, snapY[next], SPRING);
    if (next !== snap) onSnapChange(next);
  }

  // Gesture bookkeeping for the content area. `down` is the guard that keeps
  // hover moves from being mistaken for a drag.
  const contentGesture = useRef({ startY: 0, down: false });

  return (
    <motion.div
      ref={sheetRef}
      className={`absolute inset-x-0 flex flex-col rounded-t-[22px] overflow-hidden ${className}`}
      style={{
        y,
        // Spans the full parent so its `full` snap (y = 0) rises over the whole
        // map — covering the floating search row and status pills above it.
        top: 0,
        height: '100%',
        // The sheet is the light surface (--c-card); everything inset inside
        // it — chips, cards, pills — sits a shade darker at --c-bg. Matches
        // the design reference: a white sheet with grey inset content.
        background: 'var(--c-card)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.28)',
        border: '1px solid var(--c-border)',
        borderBottom: 'none',
      }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: snapY.collapsed }}
      dragElastic={{ top: 0.06, bottom: 0.06 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* Grab area — `touch-action: none` here (and only here) so dragging the
          header doesn't also scroll the page on touch. */}
      <div
        ref={grabRef}
        className="shrink-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--c-border-2)' }} />
        </div>
        {header}
      </div>

      <div
        ref={contentRef}
        className="flex-1 overscroll-contain"
        style={{
          overflowY: snap === 'full' ? 'auto' : 'hidden',
          // Matches overflowY: nothing scrolls below full snap, so the browser's
          // native pan gesture has no job to do — but left at 'auto' it still
          // claims the touch before our pointermove handoff sees enough delta,
          // cancelling the gesture and leaving only the touch-action:none grab
          // handle draggable. 'none' here lets a swipe anywhere on the card hand
          // off, while full snap keeps native scrolling.
          touchAction: snap === 'full' ? 'auto' : 'none',
          scrollbarWidth: 'none',
        }}
        onPointerDown={(e) => {
          contentGesture.current = { startY: e.clientY, down: true };
        }}
        onPointerMove={(e) => {
          const g = contentGesture.current;
          if (!g.down) return;
          // Expanded and scrolled into the content: that's a scroll, not a drag.
          if (snap === 'full' && (contentRef.current?.scrollTop ?? 0) > 0) return;
          const dy = e.clientY - g.startY;
          // Once expanded only a downward pull hands off, so upward gestures
          // still reach the scroller.
          const handoff = snap === 'full' ? dy > 8 : Math.abs(dy) > 8;
          if (handoff) {
            g.down = false;
            dragControls.start(e);
          }
        }}
        onPointerUp={() => {
          contentGesture.current.down = false;
        }}
        onPointerCancel={() => {
          contentGesture.current.down = false;
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
