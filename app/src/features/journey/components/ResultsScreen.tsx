import { useState } from "react";
import { ArrowLeft, Info, AlertOctagon } from "lucide-react";
import { formatDuration, LINE_META } from "../engine/journeyEngine";

import { LineBadge } from "../../../components/LineBadge";
import { LINE_DOT_BG, LINE_TRACK_BG } from "../constants";

interface ResultsScreenProps {
  result: any;
  onBack: () => void;
  onStartJourney?: (selectedIndex: number) => void;
}

export function ResultsScreen({ result, onBack, onStartJourney }: ResultsScreenProps) {
  const { source, dest, sourceStation, destStation, sourcePlace, destPlace, sourceWalkMins, destWalkMins, stops, totalStops, fare, ticketInfo, numTransfers, options } = result;
  const [selected, setSelected] = useState(0);
  const active = options[selected] || result;
  const isFeasible = active.feasible !== false;

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pb-12 animate-in fade-in duration-300">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6 text-sm font-semibold transition-colors"
        style={{ color: 'var(--c-text-3)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)')}
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
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
            {totalStops} stops
          </span>
          {numTransfers > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: 'var(--c-card)', color: 'var(--c-text-2)' }}>
              {numTransfers} transfer{numTransfers > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Start Journey Button */}
      {isFeasible && onStartJourney && (
        <button
          onClick={() => onStartJourney(selected)}
          className="w-full py-4 rounded-2xl font-bold text-black text-lg mb-6 shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition-transform"
          style={{ background: '#FACC15' }}
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
          <div className="col-span-1 rounded-2xl p-4 flex flex-col justify-between" style={{ background: '#FACC15' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest text-black/60">Departs at</div>
            <div className="text-3xl font-bold text-black leading-none mt-1">{active.departClockTime}</div>
            <div className="text-[10px] font-semibold text-black/50 mt-1">{formatDuration(active.totalMins)} journey</div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Fare est.</div>
            <div className="text-3xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>₹{fare}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--c-text-4)' }}>approx.</div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--c-card)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Depart in</div>
            <div className="text-3xl font-bold leading-none mt-1" style={{ color: 'var(--c-text)' }}>{formatDuration(active.departInMins)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--c-text-4)' }}>from now</div>
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
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                <div className="rounded-full shrink-0 z-10 w-4 h-4 bg-neutral-500 mt-[2px]" />
                <div className="w-0.5 flex-1 min-h-[28px] border-l-2 border-dashed border-neutral-500 opacity-50" />
              </div>
              <div className="pb-5 pt-0 flex-1 min-w-0">
                <div className="leading-tight text-[15px] font-bold text-white">
                  {sourcePlace.name}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-neutral-400">Walk {formatDuration(sourceWalkMins)} to {sourceStation.name}</span>
                </div>
              </div>
            </div>
          )}
          {stops.map((st: any, i: number) => {
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            const isEndpoint = isFirst || isLast;
            const isInterchange = st.interchange && !isEndpoint;
            const lineKey = st.viaLine as string;

            return (
              <div key={st.id + i} className="flex items-start gap-4">
                {/* Track column */}
                <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                  {/* Dot */}
                  <div
                    className={`rounded-full shrink-0 z-10 ${
                      isEndpoint
                        ? `w-4 h-4 ${LINE_DOT_BG[lineKey]}`
                        : isInterchange
                        ? "w-3.5 h-3.5 bg-white border-2 border-neutral-900"
                        : `w-2 h-2 ${LINE_DOT_BG[lineKey]} opacity-60`
                    }`}
                    style={{ marginTop: isEndpoint ? 2 : isInterchange ? 3 : 5 }}
                  />
                  {/* Track line */}
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[28px] ${LINE_TRACK_BG[lineKey]} opacity-40`}
                    />
                  )}
                  {isLast && destPlace && (
                    <div className="w-0.5 flex-1 min-h-[28px] border-l-2 border-dashed border-neutral-500 opacity-50" />
                  )}
                </div>

                {/* Label column */}
                <div className="pb-5 pt-0 flex-1 min-w-0">
                  <div className={`leading-tight ${
                    isEndpoint ? "text-[15px] font-bold text-white" :
                    isInterchange ? "text-[14px] font-semibold text-white" :
                    "text-[13px] font-medium text-neutral-500"
                  }`}>
                    {st.name}
                    {st.operational === false && (
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-yellow-700 border border-yellow-900 px-1 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  {isInterchange && (
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
          {destPlace && (
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center" style={{ width: 20, minWidth: 20 }}>
                <div className="rounded-full shrink-0 z-10 w-4 h-4 bg-neutral-500 mt-[2px]" />
              </div>
              <div className="pb-5 pt-0 flex-1 min-w-0">
                <div className="leading-tight text-[15px] font-bold text-white">
                  {destPlace.name}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-neutral-400">Walk {formatDuration(destWalkMins)} from {destStation.name}</span>
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
              const isSelected = i === selected;
              const optFeasible = opt.feasible !== false;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className="w-full text-left rounded-2xl transition-all duration-200 overflow-hidden"
                  style={{
                    background: isSelected ? '#FACC15' : 'var(--c-card)',
                    border: isSelected ? 'none' : '1px solid var(--c-border)',
                    opacity: !optFeasible ? 0.4 : 1,
                  }}
                >
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-2xl font-bold leading-none" style={{ color: isSelected ? '#000' : 'var(--c-text)' }}>
                        {opt.departClockTime}
                      </div>
                      <div className="text-[11px] font-medium mt-1" style={{ color: isSelected ? 'rgba(0,0,0,0.5)' : 'var(--c-text-3)' }}>
                        {optFeasible ? `arrive ${opt.arriveClockTime}` : `stuck at ${opt.strandedAtLine}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: isSelected ? '#000' : 'var(--c-text-2)' }}>
                        {optFeasible ? formatDuration(opt.totalMins) : "—"}
                      </div>
                      <div className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: isSelected ? 'rgba(0,0,0,0.4)' : 'var(--c-text-4)' }}>
                        in {formatDuration(opt.departInMins)}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mx-4 border-t-2 border-dashed border-black/20" />
                  )}
                  {isSelected && opt.warnings?.length > 0 && (
                    <div className="px-4 py-2 text-[10px] font-bold text-black/60 flex items-center gap-1">
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
