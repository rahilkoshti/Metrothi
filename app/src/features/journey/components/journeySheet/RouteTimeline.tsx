import { useTranslation } from "react-i18next";
import { LINE_META } from "../../engine/journeyEngine";
import { formatDuration } from "../../engine/journeyEngine";
import { LineBadge } from "../../../../components/LineBadge";
import { ExitGuidance } from "../ExitGuidance";
import { LINE_COLOR } from "../../constants";

/**
 * The stops timeline for a planned journey — origin walk, every station with
 * board/interchange headings, and the destination walk. Lifted out of the old
 * full-page ResultsScreen so it can live inside the home sheet's full snap.
 *
 * `result` supplies the geography (source/dest places, stops); `active` is the
 * currently selected departure option, which owns the per-leg heading names.
 */
export function RouteTimeline({ result, active }: { result: any; active: any }) {
  const { t } = useTranslation();
  const {
    sourceStation, destStation, sourcePlace, destPlace,
    sourceWalkMins, destWalkMins, stops,
  } = result;

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--c-bg)' }}>
      <h3 className="text-caption font-bold uppercase mb-6" style={{ color: 'var(--c-text-3)' }}>{t('journey.route')}</h3>
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
                <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
                  {t('journey.walkToStation', { duration: formatDuration(sourceWalkMins), station: sourceStation.name })}
                </span>
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
                  {/* The dot and rail were Tailwind class strings whose yellow
                      (bg-yellow-400, #facc15) disagreed with the signage hex
                      every other surface uses (#EAB308) — the same line drawn
                      in two different yellows depending on which component you
                      were looking at. One map, one fill. */}
                  <div
                    className={`rounded-full shrink-0 z-10 ${
                      isEndpoint
                        ? "w-4 h-4"
                        : isInterchange
                        ? "w-3.5 h-3.5 border-2"
                        : "w-2 h-2 opacity-60"
                    }`}
                    style={{
                      marginTop: isEndpoint ? 2 : isInterchange ? 3 : 5,
                      ...(isInterchange
                        ? { background: 'var(--c-bg)', borderColor: 'var(--c-text)' }
                        : { background: LINE_COLOR[lineKey] }),
                    }}
                  />
                  {!isLast && (
                    <div className="w-0.5 flex-1 min-h-[28px] opacity-40" style={{ background: LINE_COLOR[lineKey] }} />
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
                      <span
                        className="ml-2 text-caption font-bold uppercase px-1 rounded-chip"
                        style={{ color: 'var(--c-warn)', border: '1px solid var(--c-warn-border)' }}
                      >
                        {t('journey.soon')}
                      </span>
                    )}
                  </div>
                  {isFirst && heading && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>{t('common.board')}</span>
                      <LineBadge line={lineKey} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-2)' }}>
                        {t('common.toward', { heading })}
                      </span>
                    </div>
                  )}
                  {isInterchange && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>{t('common.changeTo')}</span>
                      <LineBadge line={stops[i + 1]?.viaLine || lineKey} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-2)' }}>
                        {t('common.toward', {
                          heading: heading || LINE_META[stops[i + 1]?.viaLine]?.name.split('(')[0].trim(),
                        })}
                      </span>
                    </div>
                  )}
                  {/* The destination row is the one stop you leave the system
                      at, so it's the only one that gets the exit facts. */}
                  {isLast && <ExitGuidance stationId={st.id} />}
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
                <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
                  {t('journey.walkFromStation', { duration: formatDuration(destWalkMins), station: destStation.name })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
