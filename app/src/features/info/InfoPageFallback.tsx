/**
 * What `/you/:topic` shows while its chunk is in flight.
 *
 * Statically imported — it is the one part of this feature that must not be in
 * the lazy chunk, since it exists to cover that chunk's download. It draws the
 * page's actual furniture (sticky bar, title, a few blocks) rather than a
 * spinner, so the layout doesn't jump when the real page lands. On any visit
 * after the first the service worker answers from cache and this is never seen.
 */
export function InfoPageFallback() {
  return (
    <div className="min-h-[100dvh] pb-28" aria-hidden>
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{
          background: "var(--c-blur)",
          borderBottom: "1px solid var(--c-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="w-9 h-9 rounded-full shrink-0" style={{ background: "var(--c-card)" }} />
      </div>
      {/* Tracks `InfoPage`'s own measure — the point of drawing real furniture
          is that nothing moves when the chunk lands, and a 768px placeholder
          under a 34rem page is exactly the jump this exists to avoid. */}
      <div className="p-5 max-w-[var(--measure-read)] mx-auto">
        <div className="h-9 rounded-lg mt-4" style={{ background: "var(--c-card)", width: "70%" }} />
        <div className="flex flex-col gap-2.5 mt-8">
          {[96, 140, 72].map((height) => (
            <div key={height} className="rounded-2xl" style={{ background: "var(--c-card)", height }} />
          ))}
        </div>
      </div>
    </div>
  );
}
