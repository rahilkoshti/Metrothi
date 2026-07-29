import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Resets scroll to the top of the page on every route change. React Router does
 * not do this and nothing else did either, so tapping a station from a scrolled
 * screen used to land on `/stations/:id` partway down — measured at 1400px into
 * a reference page, which reads as a page that failed to load its top.
 *
 * Mount once inside `<BrowserRouter>`, as a child of whatever wraps the routes.
 * It renders an empty anchor rather than nothing, because *which* element to
 * reset is not obvious and must not be guessed: `<main>` carries
 * `overflow-y: auto` but never actually scrolls (it is `flex-1` with no height
 * cap, so it grows to its content and the *document* scrolls instead). Walking
 * up from a real node finds whichever of the two genuinely owns the scroll, and
 * keeps working if that ever changes.
 *
 * The walk stops at the first scrolling *ancestor*, so scrollers a screen owns
 * inside itself are left alone — `StationDetail` parks the next departure at the
 * top of its schedule list on mount, and this must not undo that.
 */
export function ScrollReset() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Back/forward is the one case where the previous offset is the right one:
    // the browser restores it for same-document history entries, and coming
    // back from a topic page to the YOU screen should land where you left it.
    if (navigationType === "POP") return;

    for (let el = anchorRef.current?.parentElement; el; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0 });
        return;
      }
    }
    document.scrollingElement?.scrollTo({ top: 0 });
  }, [pathname, navigationType]);

  return <span ref={anchorRef} className="hidden" aria-hidden />;
}
