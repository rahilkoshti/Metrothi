
import { MapPin, Train, Flag } from "lucide-react";
import { useJourneySession } from "../hooks/useJourneySession";

interface MinimizedJourneyBarProps {
  result: any;
  onMaximize: () => void;
}

export function MinimizedJourneyBar({ result, onMaximize }: MinimizedJourneyBarProps) {
  const { currentState, stopTimeline, currentStopIndex, elapsedMins } = useJourneySession(result);

  const getStatusMessage = () => {
    switch (currentState) {
      case 'NOT_STARTED': return 'Starting...';
      case 'WALKING_TO_STATION': return `Walk to ${result.source.name}`;
      case 'WAITING_FOR_TRAIN': return `Wait at ${result.source.name}`;
      case 'ON_TRAIN': return 'On Train';
      case 'APPROACHING_TRANSFER': return 'Approaching Transfer';
      case 'TRANSFERRING': return 'Transferring';
      case 'APPROACHING_DESTINATION': return `Approaching ${result.dest.name}`;
      case 'FINAL_WALK': return `Arrived at ${result.dest.name}`;
      case 'COMPLETED': return 'Completed';
      default: return '';
    }
  };

  const getStatusIcon = () => {
    switch (currentState) {
      case 'WALKING_TO_STATION':
      case 'FINAL_WALK':
      case 'TRANSFERRING':
        return <MapPin size={18} className="text-yellow-400" />;
      case 'WAITING_FOR_TRAIN':
      case 'ON_TRAIN':
      case 'APPROACHING_TRANSFER':
      case 'APPROACHING_DESTINATION':
        return <Train size={18} className="text-yellow-400" />;
      case 'COMPLETED':
        return <Flag size={18} className="text-green-500" />;
      default:
        return <MapPin size={18} className="text-yellow-400" />;
    }
  };

  const nextTarget = stopTimeline[currentStopIndex + 1];
  const minsRemaining = nextTarget ? Math.max(0, nextTarget - elapsedMins) : 0;
  
  // Only render if there's an active journey
  if (!result || currentState === 'COMPLETED') return null;

  return (
    <div className="absolute bottom-[80px] left-4 right-4 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <button 
        onClick={onMaximize}
        className="w-full flex items-center justify-between p-3 rounded-2xl shadow-xl border border-neutral-700/50 backdrop-blur-xl transition-transform active:scale-[0.98]"
        style={{ background: 'rgba(20,20,20,0.85)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400/10 shrink-0">
            {getStatusIcon()}
          </div>
          <div className="text-left">
            <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-0.5">Live Status</div>
            <div className="text-sm font-bold text-white leading-tight truncate max-w-[180px]">
              {getStatusMessage()}
            </div>
          </div>
        </div>
        {nextTarget != null && (
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-white">
              {Math.ceil(minsRemaining)} <span className="text-[10px] font-semibold text-neutral-400">min</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mt-0.5">
              to next stop
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
