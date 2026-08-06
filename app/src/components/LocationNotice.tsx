import { LocateFixed, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LocStatus } from '../App';

// Shown wherever we fall back to the default station. Without this the fallback
// is silent, so a blocked permission looks identical to a working app that just
// happens to think you're at Old High Court.
//
// Bundle keys, not strings — and the title carries "— showing default station"
// rather than having it appended at the call site. That suffix is the half of
// the line that says what the app *did*, and appending it to a translated
// title puts a clause after a Hindi sentence that has already ended.
const COPY: Record<string, { title: string; hint: string }> = {
  denied: { title: 'location.deniedTitle', hint: 'location.deniedHint' },
  unavailable: { title: 'location.unavailableTitle', hint: 'location.unavailableHint' },
  timeout: { title: 'location.timeoutTitle', hint: 'location.timeoutHint' },
};

export function LocationNotice({
  status,
  onRetry,
  compact = false,
}: {
  status: LocStatus;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const copy = COPY[status];
  if (!copy) return null;

  return (
    // The tinted block and its text were a hand-rolled yellow — text-yellow-600
    // on an 8% yellow tint, which measures 2.59:1. This is the state a rider
    // sees the very first time they open the app with location blocked, so it
    // is both the most common notice in the product and the least readable one.
    // Same 8%/22% shape, from the warn tokens, which clear 4.9:1 on their own
    // tint in both themes.
    <div
      className="flex items-start gap-3 p-3 rounded-card"
      style={{ background: 'var(--c-warn-bg)', border: '1px solid var(--c-warn-border)' }}
      role="status"
    >
      <LocateFixed size={16} strokeWidth={2.2} className="shrink-0 mt-0.5" style={{ color: 'var(--c-warn)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-footnote font-bold" style={{ color: 'var(--c-warn)' }}>
          {t(copy.title)}
        </div>
        {!compact && (
          <div className="text-footnote mt-0.5" style={{ color: 'var(--c-text-3)' }}>
            {t(copy.hint)}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRetry(); }}
        className="flex items-center justify-center gap-1 text-footnote font-bold px-3 rounded-control shrink-0 active:opacity-70 transition-opacity"
        style={{ minHeight: 'var(--touch-min)', color: 'var(--c-warn)', border: '1px solid var(--c-warn-border)' }}
      >
        <RotateCw size={16} strokeWidth={2.2} /> {t('location.retry')}
      </button>
    </div>
  );
}
