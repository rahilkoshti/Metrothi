import { useTranslation } from 'react-i18next';
import { estimateLine, formatDuration } from '../engine/journeyEngine';
import { useNow } from '../hooks/useNow';
import { LINE_COLOR, LINE_NAMES } from '../constants';

const LINES = ['blue', 'red', 'yellow', 'violet'];

// Status text kept to a couple of words — these pills sit over the map and are
// scanned, not read. Returns a key and the duration to interpolate, so the tone
// and the pulse stay decided here while the wording comes from the bundle.
//
// The tones were raw palette hex authored against the dark theme: green 2.07,
// yellow 1.74 and violet 3.60 on the light background, which is the default and
// so what most riders see. This strip is also the first thing a new user looks
// at. Status tokens now, and note that the status is carried by the *word*
// ("Live", "Closed", "Bus only") before it is carried by the hue — these four
// hues are close cousins of the line palette and cannot be the only channel.
function label(est: ReturnType<typeof estimateLine>) {
  switch (est.status) {
    case 'running':
      return { key: 'line.live', tone: 'var(--c-good)', pulse: true };
    case 'before-first-train':
      return {
        key: 'line.inDuration',
        values: { duration: formatDuration(est.minsUntilFirst!) },
        tone: 'var(--c-warn)',
        pulse: false,
      };
    case 'bus-only':
      return { key: 'line.busOnly', tone: 'var(--c-info)', pulse: false };
    case 'after-last-train':
    default:
      return { key: 'line.closed', tone: 'var(--c-text-4)', pulse: false };
  }
}

// Tappable status indicators — each pill opens the search overlay scrolled to
// that line's stations.
export function LineStatusPills({ onSelectLine }: { onSelectLine?: (line: string) => void }) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    /* `group`, not `list`. These four are a set of controls, not a list of
       content: an explicit `role` *replaces* the implicit one, so `listitem`
       on the buttons below was handing assistive tech four list items with no
       indication they were pressable — while the accessible name each carries
       ends "View stations", an instruction the semantics then contradicted.
       A real `<li>` wrapper would restore the list and keep the button, but
       there is nothing list-like to convey here that the label doesn't. */
    <div
      className="flex gap-3 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none' }}
      role="group"
      aria-label={t('line.statusList')}
    >
      {LINES.map((line) => {
        const est = estimateLine(line, now);
        const { key, values, tone, pulse } = label(est);
        const text = t(key, values);
        const color = LINE_COLOR[line];
        // Safe to derive from `LINE_NAMES` because line names are English in
        // every language and stay that way (§6.8) — this is not the
        // `label === "From"` shape, which read a *translated* string back.
        const short = LINE_NAMES[line].replace(' Line', '');

        return (
          <button
            key={line}
            aria-label={t('line.pillAria', { line: LINE_NAMES[line], status: text })}
            onClick={() => onSelectLine?.(line)}
            /* `hit-44` rather than a taller pill: this strip floats over the
               map, and 44px of visible chrome across the top would cost more
               map than the target is worth. The gap above is 12px so the
               expanded regions of adjacent pills don't overlap. */
            className="hit-44 shrink-0 flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 active:scale-[0.97] transition-transform"
            style={{
              background: 'var(--surface-float)',
              backdropFilter: 'var(--blur-float)',
              WebkitBackdropFilter: 'var(--blur-float)',
              border: '1px solid var(--border-float)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            <span className="relative flex w-2 h-2 shrink-0">
              {pulse && (
                <span
                  className="absolute inline-flex w-full h-full rounded-full animate-ping"
                  style={{ background: color, opacity: 0.65 }}
                />
              )}
              <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
            </span>
            <span className="text-footnote font-bold" style={{ color: 'var(--c-text)' }}>
              {short}
            </span>
            <span className="text-footnote" style={{ color: tone }}>
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
