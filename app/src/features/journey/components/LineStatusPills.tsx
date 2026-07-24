import { estimateLine, formatDuration } from '../engine/journeyEngine';
import { useNow } from '../hooks/useNow';
import { LINE_COLORS, LINE_NAMES } from '../constants';

const LINES = ['blue', 'red', 'yellow', 'violet'];

// Status text kept to a couple of words — these pills sit over the map and are
// scanned, not read.
function label(est: ReturnType<typeof estimateLine>) {
  switch (est.status) {
    case 'running':
      return { text: 'Live', tone: '#22c55e', pulse: true };
    case 'before-first-train':
      return { text: `In ${formatDuration(est.minsUntilFirst!)}`, tone: '#eab308', pulse: false };
    case 'bus-only':
      return { text: 'Bus only', tone: '#a855f7', pulse: false };
    case 'after-last-train':
    default:
      return { text: 'Closed', tone: 'var(--c-text-4)', pulse: false };
  }
}

// Tappable status indicators — each pill opens the search overlay scrolled to
// that line's stations.
export function LineStatusPills({ onSelectLine }: { onSelectLine?: (line: string) => void }) {
  const now = useNow();

  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none' }}
      role="list"
      aria-label="Line service status"
    >
      {LINES.map((line) => {
        const est = estimateLine(line, now);
        const { text, tone, pulse } = label(est);
        const color = LINE_COLORS[line];
        const short = LINE_NAMES[line].replace(' Line', '');

        return (
          <button
            key={line}
            role="listitem"
            aria-label={`${LINE_NAMES[line]}: ${text}. View stations`}
            onClick={() => onSelectLine?.(line)}
            className="shrink-0 flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 active:scale-95 transition-transform"
            style={{
              background: 'var(--c-blur)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--c-border-2)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
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
            <span className="text-[11px] font-bold" style={{ color: 'var(--c-text)' }}>
              {short}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: tone }}>
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
