import { MapPin, Train, Flag, ChevronUp } from "lucide-react";
import type { useJourneySession } from "../../hooks/useJourneySession";

/**
 * Live-journey summary shown in the home sheet header once a trip is underway.
 * Tapping it maximizes the full-screen LiveJourneyScreen. Replaces the old
 * floating MinimizedJourneyBar so the live state lives in the same bottom
 * overlay as planning did.
 */
export function LiveJourneySummary({
  result,
  session,
  onMaximize,
}: {
  result: any;
  session: ReturnType<typeof useJourneySession>;
  onMaximize: () => void;
}) {
  const { currentState, stopTimeline, currentStopIndex, elapsedMins } = session;

  const statusMessage = (() => {
    switch (currentState) {
      case 'NOT_STARTED': return 'Starting…';
      case 'WALKING_TO_STATION': return `Walk to ${result.source.name}`;
      case 'WAITING_FOR_TRAIN': return `Wait at ${result.source.name}`;
      case 'ON_TRAIN': return 'On train';
      case 'APPROACHING_TRANSFER': return 'Approaching transfer';
      case 'TRANSFERRING': return 'Transferring';
      case 'APPROACHING_DESTINATION': return `Approaching ${result.dest.name}`;
      case 'FINAL_WALK': return `Arrived at ${result.dest.name}`;
      case 'COMPLETED': return 'Completed';
      default: return '';
    }
  })();

  const statusIcon = (() => {
    switch (currentState) {
      case 'WALKING_TO_STATION':
      case 'FINAL_WALK':
      case 'TRANSFERRING':
        return <MapPin size={18} className="text-yellow-400" />;
      case 'COMPLETED':
        return <Flag size={18} className="text-green-500" />;
      default:
        return <Train size={18} className="text-yellow-400" />;
    }
  })();

  const nextTarget = stopTimeline[currentStopIndex + 1];
  const minsRemaining = nextTarget != null ? Math.max(0, nextTarget - elapsedMins) : null;

  return (
    <div
      className="flex items-center justify-between px-4 pb-3 gap-3"
      onClick={onMaximize}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400/10 shrink-0">
          {statusIcon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--c-accent)' }}>Live status</div>
          <div className="text-[15px] font-bold leading-tight truncate" style={{ color: 'var(--c-text)' }}>
            {statusMessage}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {minsRemaining != null && currentState !== 'COMPLETED' && (
          <div className="text-right">
            <div className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
              {Math.ceil(minsRemaining)}<span className="text-[11px] font-semibold ml-0.5" style={{ color: 'var(--c-text-4)' }}>min</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-4)' }}>to next stop</div>
          </div>
        )}
        <ChevronUp size={16} style={{ color: 'var(--c-text-4)' }} />
      </div>
    </div>
  );
}
