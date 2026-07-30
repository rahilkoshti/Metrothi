/**
 * What `/you` shows while its chunk is in flight.
 *
 * Statically imported, for the same reason `InfoPageFallback` is: it exists to
 * cover the chunk it stands in for, so it cannot live inside it. It draws the
 * screen's real furniture — the title block and the section cards beneath it —
 * at the same margins and radii `settingsRows` uses, so the layout doesn't jump
 * when the real screen lands. Deliberately raw divs rather than `SectionCard`:
 * importing the row primitives here would pull them back onto the boot path,
 * which is the whole thing this route was split out to avoid.
 *
 * On any visit after the first the service worker answers from cache and this
 * is never seen.
 */
export function YouScreenFallback() {
  return (
    <div className="max-w-[var(--layout-max-width)] mx-auto pb-28" aria-hidden>
      {/* Title block — matches YouScreen's px-5 pt-8 pb-6 header. */}
      <div className="px-5 pt-8 pb-6 flex items-center justify-between">
        <div>
          <div className="h-3 rounded" style={{ background: "var(--c-card)", width: 88 }} />
          <div className="h-9 rounded-lg mt-2" style={{ background: "var(--c-card)", width: 108 }} />
        </div>
        <div className="w-10 h-10 rounded-full shrink-0" style={{ background: "var(--c-card)" }} />
      </div>

      {/* Account card, then the first sections. Heights are row counts × the
          61px a `Row` occupies, so the skeleton settles at roughly the real
          screen's scroll height rather than a third of it. */}
      <div className="flex flex-col gap-6">
        {[92, 61, 244].map((height) => (
          <div
            key={height}
            className="mx-5 rounded-2xl"
            style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", height }}
          />
        ))}
      </div>
    </div>
  );
}
