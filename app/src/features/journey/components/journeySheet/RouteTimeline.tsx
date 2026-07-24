import { LINE_META } from "../../engine/journeyEngine";
import { formatDuration } from "../../engine/journeyEngine";
import { LineBadge } from "../../../../components/LineBadge";
import { LINE_DOT_BG, LINE_TRACK_BG } from "../../constants";

/**
 * The stops timeline for a planned journey — origin walk, every station with
 * board/interchange headings, and the destination walk. Lifted out of the old
 * full-page ResultsScreen so it can live inside the home sheet's full snap.
 *
 * `result` supplies the geography (source/dest places, stops); `active` is the
 * currently selected departure option, which owns the per-leg heading names.
 */
export function RouteTimeline({ result, active }: { result: any; active: any }) {
  const {
    sourceStation, destStation, sourcePlace, destPlace,
    sourceWalkMins, destWalkMins, stops,
  } = result;

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--c-card)' }}>
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
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[28px] ${LINE_TRACK_BG[lineKey]} opacity-40`} />
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
          });
        })()}
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
  );
}
