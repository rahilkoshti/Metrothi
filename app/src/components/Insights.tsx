import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { matchPath, useLocation } from 'react-router-dom';

/**
 * Vercel Web Analytics + Speed Insights (§8.2 phase A).
 *
 * This is the "how many people" half of §5.8 and deliberately not the rest of
 * it: traffic, referrers, devices, and real-user Core Web Vitals — which is the
 * §7.1 criterion measured on riders instead of on a lab run. Product events
 * (did the plan work, did the fare resolve) are the `events` table, because a
 * beacon that dies underground can't answer them.
 *
 * Both packages inject their real script async and `defer`, so nothing here is
 * render-blocking. Measured over the build both ways, counting **every** file
 * `index.html` loads and not just the entry chunk (§5.6): 797,282 raw /
 * 244,432 gzip against 802,497 / 246,007 — **+1,575 bytes gzip (+5,215 raw) on
 * every cold start**, and no new boot file. That is under a third of what
 * taking `/you` off the boot path bought back, for the only measurement of
 * §7.1 that comes from real riders.
 *
 * Off Vercel — a local dev server, or a self-host — the script 404s and both
 * components no-op, which is the same shape as `getSupabase()` returning null.
 * In development the script is fetched cross-origin from `va.vercel-scripts.com`
 * and logs instead of sending; in production it is same-origin
 * `/_vercel/insights/script.js`. Neither needs a Workbox rule: the service
 * worker's only same-origin route is the `NavigationRoute`, which matches
 * `mode: 'navigate'` and so never sees a script request or a beacon.
 */

// The four patterns `App.tsx` declares, in the order `Routes` resolves them.
// Without a `route`, `/stations/motera` and `/stations/apparel-park` are 53
// separate rows in the dashboard rather than one route with 53 paths, and the
// per-route Web Vitals that make Speed Insights worth having never aggregate.
const PATTERNS = ['/', '/stations/:id', '/you', '/you/:topic'] as const;

function routeOf(pathname: string): string {
  for (const pattern of PATTERNS) {
    if (matchPath(pattern, pathname)) return pattern;
  }
  // `App.tsx`'s catch-all, which renders HomeScreen. Recorded as itself rather
  // than folded into '/', so a deep link that stopped resolving is visible.
  return '*';
}

/**
 * §5.8: place-search text never leaves the device.
 *
 * Nothing in this app puts a query string on a URL today — planning doesn't
 * navigate (§4.2) and Photon is a `fetch`, not a navigation — so this strips
 * nothing right now. It exists so that the day someone adds `?dest=…`, the
 * rider's typed destination doesn't begin flowing to a third party with no
 * error and no review. That is the whole failure mode the rule guards against.
 */
function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    // A malformed url is not worth a thrown beacon; send it as-is.
    return url;
  }
}

/**
 * Module scope, not an inline arrow, and generic so it satisfies both packages'
 * `beforeSend` — they each declare their own event type and Speed Insights
 * doesn't export its own, so the constraint is structural.
 *
 * The identity is what matters: both components register `beforeSend` from a
 * `useEffect` keyed on the prop, so a new closure per render re-registers on
 * every navigation. The registration is queued on `window.vaq` until the script
 * loads and drains it — and in this app the script may not load for a long time
 * or at all, because the rider is underground. An inline arrow grows that queue
 * for the whole session; a stable one queues it once.
 */
function cleaned<E extends { url: string }>(event: E): E {
  return { ...event, url: stripQuery(event.url) };
}

export function Insights() {
  const { pathname } = useLocation();

  return (
    <>
      {/* `path` is not optional here. Passing `route` alone sets the script's
          `disableAutoTrack`, and the component's own pageview effect is guarded
          by `if (props.route && props.path)` — so `route` without `path` turns
          automatic tracking off and never turns manual tracking on, and the
          dashboard records zero pageviews with nothing logged to say why. */}
      <Analytics route={routeOf(pathname)} path={pathname} beforeSend={cleaned} />
      {/* Speed Insights takes `route` alone: it forwards it to the script's
          `setRoute` and has no equivalent coupling. */}
      <SpeedInsights route={routeOf(pathname)} beforeSend={cleaned} />
    </>
  );
}
