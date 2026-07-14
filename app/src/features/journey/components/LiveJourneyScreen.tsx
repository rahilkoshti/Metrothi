import { useState, useEffect } from "react";
import { MapPin, Train, Flag, XCircle, ChevronDown } from "lucide-react";
import { LINE_META, fullDayStationSchedule, LINE_PATHS } from "../engine/journeyEngine";
import { useJourneySession } from "../hooks/useJourneySession";
import { useNow } from "../hooks/useNow";
import { LINE_NAMES } from "../constants";
import { TrainRouteSheet } from "./TrainRouteSheet";
import { LineBadge } from "../../../components/LineBadge";

import { LINE_DOT_BG, LINE_TRACK_BG } from "../constants";

interface LiveJourneyScreenProps {
  result: any;
  activeOptionIdx?: number;
  onEnd: () => void;
  onMinimize: () => void;
}

export function LiveJourneyScreen({ result, activeOptionIdx, onEnd, onMinimize }: LiveJourneyScreenProps) {
  const { currentState, currentStopIndex, setSimulatedCoords, fastForward, elapsedMins, stopTimeline } = useJourneySession(result);
  const { source, dest, stops, legs } = result;

  const activeOption = result.options?.[activeOptionIdx ?? 0] || result;
  
  const [showDebug, setShowDebug] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showScheduleLegIdx, setShowScheduleLegIdx] = useState<number | null>(null);

  const now = useNow();

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      fastForward(0.5); // fast forward 30 seconds every 1 real second
    }, 1000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, fastForward]);

  const getStatusMessage = () => {
    switch (currentState) {
      case 'NOT_STARTED': return 'Starting Journey...';
      case 'WALKING_TO_STATION': return `Walk to ${source.name}`;
      case 'WAITING_FOR_TRAIN': return `Board your train from ${source.name}`;
      case 'ON_TRAIN': return 'On Train';
      case 'APPROACHING_TRANSFER': return 'Approaching Transfer';
      case 'TRANSFERRING': return 'Transfer to next line';
      case 'APPROACHING_DESTINATION': return `Approaching ${dest.name}`;
      case 'FINAL_WALK': return `Arrived at ${dest.name}`;
      case 'COMPLETED': return 'Journey Completed';
      default: return '';
    }
  };

  const getStatusIcon = () => {
    switch (currentState) {
      case 'WALKING_TO_STATION':
      case 'FINAL_WALK':
      case 'TRANSFERRING':
        return <MapPin size={24} className="text-yellow-400" />;
      case 'WAITING_FOR_TRAIN':
      case 'ON_TRAIN':
      case 'APPROACHING_TRANSFER':
      case 'APPROACHING_DESTINATION':
        return <Train size={24} className="text-yellow-400" />;
      case 'COMPLETED':
        return <Flag size={24} className="text-green-500" />;
      default:
        return <MapPin size={24} className="text-yellow-400" />;
    }
  };

  const currentLine = stops[currentStopIndex]?.viaLine || stops[currentStopIndex]?.line;
  const currentLegIdx = legs?.findIndex((l: any) => l.line === currentLine) ?? -1;
  
  const showRouteButton = (
    currentLegIdx >= 0 && 
    (currentState === 'ON_TRAIN' || currentState === 'WAITING_FOR_TRAIN' || currentState === 'APPROACHING_TRANSFER' || currentState === 'APPROACHING_DESTINATION')
  );

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pb-24 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMinimize}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95"
            style={{ background: 'var(--c-card)' }}
            aria-label="Minimize journey"
          >
            <ChevronDown size={20} strokeWidth={2.5} style={{ color: 'var(--c-text)' }} />
          </button>
          
          <button
            onClick={onEnd}
            className="flex items-center gap-2 text-sm font-semibold transition-colors bg-red-500/10 text-red-500 px-3 py-2 rounded-xl active:scale-95"
          >
            <XCircle size={16} strokeWidth={2.5} />
            End
          </button>
        </div>
        
        <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-neutral-500 opacity-50">
          Debug
        </button>
      </div>

      {/* Live Details Panel */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--c-card)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-4)' }}>ETA to Dest</div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--c-text)' }}>{activeOption.arriveClockTime || '...'}</div>
          <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--c-text-3)' }}>{Math.max(0, Math.ceil(activeOption.totalMins - elapsedMins))} mins left</div>
        </div>
        <div className="rounded-2xl p-4 shadow-sm flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-4)' }}>Fare est.</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--c-text)' }}>₹{result.fare}</div>
          </div>
          {currentLine && (
            <div className="mt-2 flex items-center gap-1.5">
               <LineBadge line={currentLine} size="sm" />
               <span className="text-[11px] font-bold" style={{ color: 'var(--c-text-2)' }}>{LINE_NAMES[currentLine as keyof typeof LINE_NAMES]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Status Banner */}
      <div className="rounded-2xl p-4 mb-8 flex items-center justify-between gap-4 shadow-lg transition-all" style={{ background: 'var(--c-card)', border: '1px solid rgba(250,204,21,0.3)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-400/10 shrink-0">
            {getStatusIcon()}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-1">Live Status</div>
            <div className="text-[17px] leading-tight font-bold" style={{ color: 'var(--c-text)' }}>{getStatusMessage()}</div>
          </div>
        </div>
        
        {showRouteButton && (
          <button 
            onClick={() => setShowScheduleLegIdx(currentLegIdx)}
            className="shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-yellow-400/10 text-yellow-500 active:scale-95 transition-transform"
          >
            Route
          </button>
        )}
      </div>

      {/* Route timeline */}
      <div className="rounded-2xl p-5 mb-8" style={{ background: 'var(--c-card)' }}>
        <h3 className="text-[9px] font-bold uppercase tracking-widest mb-6" style={{ color: 'var(--c-text-3)' }}>Journey Progress</h3>
        <div className="relative">
          {stops.map((st: any, i: number) => {
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            const isEndpoint = isFirst || isLast;
            const isInterchange = st.interchange && !isEndpoint;
            const lineKey = st.viaLine as string;

            const isCompleted = i < currentStopIndex;
            const isCurrent = i === currentStopIndex;
            
            // Determine styles based on progress
            const dotOpacity = isCompleted ? 'opacity-30' : isCurrent ? 'opacity-100 ring-4 ring-yellow-400/20' : 'opacity-100';
            const trackOpacity = i < currentStopIndex ? 'opacity-30' : 'opacity-100';
            const textStyle = isCompleted ? 'text-neutral-600 line-through' : isCurrent ? 'text-yellow-400 font-bold' : isEndpoint ? 'text-white font-bold' : 'text-neutral-300 font-medium';

            return (
              <div key={i} className="flex items-start gap-4 transition-all duration-500">
                {/* Track column */}
                <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                  {/* Dot */}
                  <div
                    className={`rounded-full shrink-0 z-10 transition-all duration-500 ${dotOpacity} ${
                      isEndpoint
                        ? `w-4 h-4 ${LINE_DOT_BG[lineKey]}`
                        : isInterchange
                        ? "w-3.5 h-3.5 bg-white border-2 border-neutral-900"
                        : `w-2 h-2 ${LINE_DOT_BG[lineKey]}`
                    }`}
                    style={{ marginTop: isEndpoint ? 2 : isInterchange ? 3 : 5 }}
                  />
                  {/* Track line */}
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[32px] transition-all duration-500 ${LINE_TRACK_BG[lineKey]} ${trackOpacity}`}
                    />
                  )}
                </div>

                {/* Label column */}
                <div className="pb-5 pt-0 flex-1 min-w-0">
                  <div className={`leading-tight text-[15px] transition-all duration-500 ${textStyle}`}>
                    {st.name}
                  </div>
                  {isInterchange && !isCompleted && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">Change to</span>
                      <LineBadge line={stops[i + 1]?.viaLine || lineKey} />
                      <span className="text-[10px] font-semibold text-neutral-500">
                        {LINE_META[stops[i + 1]?.viaLine]?.name.split('(')[0].trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="p-4 rounded-xl border border-dashed border-neutral-700 mt-8 space-y-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {/* State Inspector */}
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">State Inspector</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/40 p-3 rounded-lg text-neutral-300">
              <div>State: <span className="text-yellow-400">{currentState}</span></div>
              <div>Stop Index: <span className="text-white">{currentStopIndex}</span></div>
              <div>Elapsed: <span className="text-white">{elapsedMins.toFixed(1)}m</span></div>
              <div>Next Stop Tgt: <span className="text-white">{stopTimeline[currentStopIndex + 1]?.toFixed(1) || 'N/A'}m</span></div>
            </div>
          </div>

          {/* Time Travel */}
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Time Travel</div>
            <div className="flex gap-2">
              <button onClick={() => fastForward(1)} className="flex-1 py-2 bg-blue-900/40 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-900/60 transition">+1 Min</button>
              <button onClick={() => fastForward(5)} className="flex-1 py-2 bg-blue-900/40 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-900/60 transition">+5 Min</button>
              <button 
                onClick={() => setIsAutoPlaying(!isAutoPlaying)} 
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${isAutoPlaying ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}
              >
                {isAutoPlaying ? 'Stop Auto-Play' : '▶ Auto-Play (30x)'}
              </button>
            </div>
          </div>

          {/* Teleport */}
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Teleport GPS</div>
            <div className="flex flex-wrap gap-2">
              {stops.map((st: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (st.lat && st.lng) {
                       setSimulatedCoords({ lat: st.lat, lng: st.lng });
                    } else {
                       alert('No coordinates for this station');
                    }
                  }}
                  className="px-3 py-1.5 bg-neutral-800 rounded-lg text-[10px] font-semibold hover:bg-neutral-700 transition"
                >
                  {idx}: {st.name}
                </button>
              ))}
            </div>
            <button 
               onClick={() => setSimulatedCoords(null)}
               className="w-full mt-2 py-2 bg-red-900/30 text-red-400 rounded-lg text-xs font-semibold"
            >
               Reset GPS Simulation
            </button>
          </div>
        </div>
      )}

      {showScheduleLegIdx !== null && (() => {
        const legIdx = showScheduleLegIdx;
        const leg = legs[legIdx];
        const legDetail = activeOption.legs?.[legIdx] || activeOption.legDetails?.[legIdx];
        
        // Extract the stops for this leg
        const legStops = stops.filter((s: any) => s.viaLine === leg.line);
        if (legStops.length === 0) return null;
        
        const legOriginId = legStops[0].id;
        const legDestId = legStops[legStops.length - 1].id;
        
        const schedule = fullDayStationSchedule(legOriginId, leg.line, now);
        
        const path = LINE_PATHS[leg.line];
        const isForward = path.indexOf(legOriginId) < path.indexOf(legDestId);
        const terminusId = isForward ? path[path.length - 1] : path[0];
        
        const dir = schedule.find((d: any) => d.destinationId === terminusId);
        if (!dir) return null;
        
        const departTime = legDetail?.departClockTime;
        let train = dir.trains.find((t: any) => t.clockTime === departTime);
        if (!train) {
          train = dir.trains.find((t: any) => t.isNext && !t.departed) || dir.trains.find((t: any) => !t.departed) || dir.trains[0];
        }
        
        return (
          <TrainRouteSheet
            stationId={legOriginId}
            line={leg.line}
            dir={dir}
            train={train}
            now={new Date()}
            onClose={() => setShowScheduleLegIdx(null)}
          />
        );
      })()}

    </div>
  );
}
