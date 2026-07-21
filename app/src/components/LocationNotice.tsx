import { LocateFixed, RotateCw } from 'lucide-react';
import type { LocStatus } from '../App';

// Shown wherever we fall back to the default station. Without this the fallback
// is silent, so a blocked permission looks identical to a working app that just
// happens to think you're at Old High Court.
const COPY: Record<string, { title: string; hint: string }> = {
  denied: {
    title: 'Location access is blocked',
    hint: "Allow location for this site in your browser settings, then retry. On iPhone also check Settings → Privacy → Location Services.",
  },
  unavailable: {
    title: "Can't determine your location",
    hint: 'Your device did not return a position. Check that location services are on.',
  },
  timeout: {
    title: 'Location is taking too long',
    hint: 'No GPS fix yet — this is common indoors or underground.',
  },
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
          {copy.title} — showing default station
        </div>
        {!compact && (
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
            {copy.hint}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRetry(); }}
        className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg shrink-0 active:opacity-70 transition-opacity text-yellow-600"
        style={{ border: '1px solid rgba(250,204,21,0.35)' }}
      >
        <RotateCw size={11} /> Retry
      </button>
    </div>
  );
}
