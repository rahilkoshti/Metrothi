import { useState, useMemo } from "react";
import { ArrowLeft, Info, AlertOctagon } from "lucide-react";
import { formatDuration, LINE_META, planJourney } from "../engine/journeyEngine";
import { useNow } from "../hooks/useNow";

import { LineBadge } from "../../../components/LineBadge";
import { LINE_DOT_BG, LINE_TRACK_BG } from "../constants";
import { Countdown } from "./Countdown";

interface ResultsScreenProps {
  result: any;
  onBack: () => void;
  onStartJourney?: (selectedIndex: number, currentResult: any) => void;
}

export function ResultsScreen({ result, onBack, onStartJourney }: ResultsScreenProps) {
  const now = useNow(15000);
  
  const liveResult = useMemo(() => {
    return planJourney(
      result.sourcePlace || result.sourceStation,
      result.destPlace || result.destStation,
      { queryTime: result.queryTime, actualNow: now, arriveBy: result.arriveBy }
    ) || result;
  }, [result.sourcePlace, result.sourceStation, result.destPlace, result.destStation, result.queryTime, result.arriveBy, now]);

  const { source, dest, sourceStation, destStation, sourcePlace, destPlace, sourceWalkMins, destWalkMins, stops, totalStops, fare, ticketInfo, numTransfers, options } = liveResult;
  const [selected, setSelected] = useState(0);
  
  const activeSelected = selected < options.length ? selected : 0;
  const active = options[activeSelected] || liveResult;
  const isFeasible = active.feasible !== false;

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pb-12 animate-in fade-in duration-300">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6 text-sm font-semibold transition-colors"
        style={{ color: 'var(--c-text-3)' }}
        
        
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--c-card)' }}>
          <ArrowLeft size={16} strokeWidth={2.5} style={{ color: 'var(--c-text)' }} />
        </div>
        Back
      </button>

      {/* Route title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold" style={{ color: 'var(--c-text-3)' }}>{source.name}</span>
          <ArrowLeft size={14} className="rotate-180" style={{ color: 'var(--c-text-4)' }} />
          <span className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>{dest.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
            {totalStops} stops
          </span>
          {numTransfers > 0 && (
            <span className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
              {numTransfers} transfer{numTransfers > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Start Journey Button */}
      {isFeasible && onStartJourney && (
        <button 
          onClick={() => onStartJourney(activeSelected, liveResult)}
          className="w-full py-4 rounded-xl font-bold text-[15px] shadow-[0_4px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-transform"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
        >
          Start Journey
        </button>
      )}

      {/* Stat bar */}
      {!isFeasible ? (
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
            <AlertOctagon size={18} />
            Route Not Possible
          </div>
          <p className="text-sm font-medium text-red-300/70 leading-snug">
            You'd be stuck at <strong className="text-red-300">{active.strandedAtLine || result.strandedAtLine}</strong>, which has finished service for the day.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="col-span-1 rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--c-accent)' }}>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Leave by</div>
              <div className="text-3xl font-bold text-white leading-none mt-1">{active.leaveClockTime}</div>
              <div className="text-[11px] font-semibold text-white/70 mt-1">{formatDuration(active.totalMins)} journey</div>
            </div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Fare est.</div>
            <div className="text-3xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>₹{fare}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>approx.</div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Leave in</div>
            <div className="text-3xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>
              <Countdown targetMs={active.leaveTimeMs} />
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>from now</div>
          </div>
        </div>
      )}

      {/* Ticket / warnings */}
      <div className="space-y-2 mb-8">
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-blue-400/80 leading-snug">{ticketInfo.note}</p>
        </div>
        {active.warnings?.map((w: string, i: number) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.15)' }}>
            <AlertOctagon size={15} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-snug" style={{ color: 'var(--c-text-2)' }}>{w}</p>
          </div>
        ))}
      </div>

      {/* Route timeline */}
      <div className="rounded-2xl p-5 mb-8" style={{ background: 'var(--c-card)' }}>
        <h3 className="text-[9px] font-bold uppercase tracking-widest mb-6" style={{ color: 'var(--c-text-3)' }}>Route</h3>
        <div className="relative">
          {sourcePlace && (
            <div className="flex items-stretch gap-4">
              <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                <div className="rounded-full shrink-0 z-10 w-4 h-4 mt-[2px]" style={{ background: 'var(--c-border-2)' }} />
                <div className="w-0.5 flex-1 min-h-[28px] border-l-2 border-dashed opacity-50" style={{ borderColor: 'var(--c-border-2)' }} />
              </div>
              <div className="pb-5 pt-0 flex-1 min-w-0">
                <div className="leading-tight text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>
                  {sourcePlace.name}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>Walk {formatDuration(sourceWalkMins)} to {sourceStation.name}</span>
                </div>
              </div>
            </div>
          )}
          {(() => {
            let legIndex = 0;
            return stops.map((st: any, i: number) => {
              const isFirst = i === 0;
              const isLast = i === stops.length - 1;
              const isEndpoint = isFirst || isLast;
              const isInterchange = st.interchange && !isEndpoint;
              const lineKey = st.viaLine as string;
              
              let heading = "";
              if (isFirst) {
                heading = active.legs?.[0]?.headingName || "";
              } else if (isInterchange) {
                legIndex++;
                heading = active.legs?.[legIndex]?.headingName || "";
              }

              return (
              <div key={st.id + i} className="flex items-stretch gap-4">
                {/* Track column */}
                <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                  {/* Dot */}
                  <div
                    className={`rounded-full shrink-0 z-10 ${
                      isEndpoint
                        ? `w-4 h-4 ${LINE_DOT_BG[lineKey]}`
                        : isInterchange
                        ? "w-3.5 h-3.5 border-2"
                        : `w-2 h-2 ${LINE_DOT_BG[lineKey]} opacity-60`
                    }`}
                    style={{
                      marginTop: isEndpoint ? 2 : isInterchange ? 3 : 5,
                      ...(isInterchange ? { background: 'var(--c-bg)', borderColor: 'var(--c-text)' } : {}),
                    }}
                  />
                  {/* Track line */}
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[28px] ${LINE_TRACK_BG[lineKey]} opacity-40`}
                    />
                  )}
                  {isLast && destPlace && (
                    <div className="w-0.5 flex-1 min-h-[28px] border-l-2 border-dashed opacity-50" style={{ borderColor: 'var(--c-border-2)' }} />
                  )}
                </div>

                {/* Label column */}
                <div className="pb-5 pt-0 flex-1 min-w-0">
                  <div
                    className={`leading-tight ${
                      isEndpoint ? "text-[15px] font-bold" :
                      isInterchange ? "text-[14px] font-semibold" :
                      "text-[13px] font-medium"
                    }`}
                    style={{ color: isEndpoint || isInterchange ? 'var(--c-text)' : 'var(--c-text-3)' }}
                  >
                    {st.name}
                    {st.operational === false && (
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-yellow-700 border border-yellow-900 px-1 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  {isFirst && heading && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Board</span>
                      <LineBadge line={lineKey} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-2)' }}>
                        toward {heading}
                      </span>
                    </div>
                  )}
                  {isInterchange && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Change to</span>
                      <LineBadge line={stops[i + 1]?.viaLine || lineKey} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-2)' }}>
                        toward {heading || LINE_META[stops[i + 1]?.viaLine]?.name.split('(')[0].trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })})()}
          {destPlace && (
            <div className="flex items-stretch gap-4">
              <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                <div className="rounded-full shrink-0 z-10 w-4 h-4 mt-[2px]" style={{ background: 'var(--c-border-2)' }} />
              </div>
              <div className="pb-5 pt-0 flex-1 min-w-0">
                <div className="leading-tight text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>
                  {destPlace.name}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>Walk {formatDuration(destWalkMins)} from {destStation.name}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All trains today */}
      <div>
        <h3 className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--c-text-3)' }}>
          All trains today
        </h3>

        {options.length === 0 ? (
          <div className="p-4 text-center text-sm font-medium rounded-xl" style={{ background: 'var(--c-card)', color: 'var(--c-text-3)' }}>
            No more trains from {source.name} today.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((opt: any, i: number) => {
              const isSelected = i === activeSelected;
              const optFeasible = opt.feasible !== false;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className="w-full text-left rounded-2xl transition-all duration-200 overflow-hidden"
                  style={{
                    background: isSelected ? 'var(--c-accent)' : 'var(--c-card)',
                    border: isSelected ? 'none' : '1px solid var(--c-border)',
                    opacity: !optFeasible ? 0.4 : 1,
                  }}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-[18px] font-bold leading-none" style={{ color: isSelected ? 'var(--c-accent-fg)' : 'var(--c-text)' }}>{opt.leaveClockTime}</div>
                      <div className="text-[11px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--c-text-4)' }}>
                        {optFeasible ? `arrive ${opt.arriveClockTime}` : `stuck at ${opt.strandedAtLine}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-bold" style={{ color: isSelected ? 'var(--c-accent-fg)' : 'var(--c-text)' }}>{optFeasible ? formatDuration(opt.totalMins) : "—"}</div>
                      <div className="text-[11px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--c-text-4)' }}>
                        leave in {formatDuration(opt.leaveInMins)}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mx-4 border-t-2 border-dashed border-black/20" />
                  )}
                  {isSelected && opt.warnings?.length > 0 && (
                    <div className="px-4 py-2 text-[11px] font-bold text-black/60 flex items-center gap-1">
                      <AlertOctagon size={11} /> Warnings on this departure
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
