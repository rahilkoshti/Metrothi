import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useDragControls, useMotionValue, animate, type PanInfo } from 'framer-motion';

export type SheetSnap = 'collapsed' | 'mid' | 'full';

const SNAP_ORDER: SheetSnap[] = ['collapsed', 'mid', 'full'];

// Matches the feel of the other sheets in the app rather than a linear ease —
// a drag that's released mid-flight should decelerate, not stop dead.
const SPRING = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const;

// Past this speed the gesture is a flick: honour its direction instead of
// snapping to whichever point happens to be nearest.
const FLICK_VELOCITY = 500; // px/s, framer's units

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
  topInset = 0,
  header,
  children,
  className = '',
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  collapsedHeight: number;
  midRatio?: number;
  /** Gap left above the sheet when fully open — how far short of the top it stops. */
  topInset?: number;
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [height, setHeight] = useState(0);

  const pointsFor = useCallback(
    (h: number) => ({
      collapsed: Math.max(0, h - collapsedHeight),
      mid: Math.round(h * midRatio),
      full: 0,
    }),
    [collapsedHeight, midRatio]
  );

  const snapY = useMemo(() => pointsFor(height), [pointsFor, height]);

  const initialised = useRef(false);
  // Read inside the layout effect for the initial park only, so a later snap
  // change doesn't re-run measurement.
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setHeight(h);
      // Seed the position before the first paint. Without this the sheet
      // renders at y=0 for a frame — covering the whole map — then slides down.
      if (!initialised.current && h > 0) {
        initialised.current = true;
        y.set(pointsFor(h)[snapRef.current]);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [y, pointsFor]);

  // Re-park whenever the snap changes from outside (selecting a station,
  // closing search) — but never on the very first measurement.
  useEffect(() => {
    if (height === 0 || !initialised.current) return;
    const controls = animate(y, snapY[snap], SPRING);
    return () => controls.stop();
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
        // Sized to the region it can occupy rather than the whole parent, so at
        // full extension nothing overflows the clip — otherwise the tail of the
        // scroll content sits below the cut and can never be reached.
        top: topInset,
        height: `calc(100% - ${topInset}px)`,
        background: 'var(--c-bg)',
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
        style={{ overflowY: snap === 'full' ? 'auto' : 'hidden', scrollbarWidth: 'none' }}
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
