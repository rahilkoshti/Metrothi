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
    <div
      className="flex items-start gap-2.5 p-3 rounded-xl"
      style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.22)' }}
      role="status"
    >
      <LocateFixed size={14} className="text-yellow-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-yellow-600">
          {t(copy.title)}
        </div>
        {!compact && (
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
            {t(copy.hint)}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRetry(); }}
        className="flex items-center justify-center gap-1 text-[11px] font-bold px-3 min-h-[44px] rounded-lg shrink-0 active:opacity-70 transition-opacity text-yellow-600"
        style={{ border: '1px solid rgba(250,204,21,0.35)' }}
      >
        <RotateCw size={11} /> {t('location.retry')}
      </button>
    </div>
  );
}
