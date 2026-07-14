
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation2, Navigation, Info } from 'lucide-react';
import { LineBadge } from '../../../components/LineBadge';
import { STATION_BY_ID, LINE_META } from '../../journey/engine/journeyEngine';

interface StationBottomSheetProps {
  stationId: string | null;
  onClose: () => void;
  onDirectionsTo: (stationId: string) => void;
  onDirectionsFrom: (stationId: string) => void;
  onViewDetails: (stationId: string) => void;
}

export function StationBottomSheet({
  stationId,
  onClose,
  onDirectionsTo,
  onDirectionsFrom,
  onViewDetails,
}: StationBottomSheetProps) {
  const station = stationId ? STATION_BY_ID[stationId] : null;

  // Mock live departures
  const liveDepartures = station ? [
    { line: station.line, destination: LINE_META[station.line]?.name.split('–')[1]?.replace(')', '').trim() || 'Terminal', mins: 2 },
    { line: station.line, destination: LINE_META[station.line]?.name.split('–')[0]?.replace('Line \\d* \\(', '').trim() || 'Terminal', mins: 8 },
    ...(station.secondLine ? [
      { line: station.secondLine, destination: LINE_META[station.secondLine]?.name.split('–')[1]?.replace(')', '').trim() || 'Terminal', mins: 4 }
    ] : [])
  ] : [];

  return (
    <AnimatePresence>
      {station && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-[1000] bg-black/20 backdrop-blur-[2px]"
          />
          
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-[1001] bg-white dark:bg-neutral-900 rounded-t-3xl shadow-2xl pb-safe"
            style={{ 
              boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'
            }}
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center py-3" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            <div className="px-6 pb-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                    {station.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <LineBadge line={station.line} size="md" />
                    {station.secondLine && <LineBadge line={station.secondLine} size="md" />}
                    {station.interchange && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                        Interchange
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => onDirectionsFrom(station.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Navigation className="text-blue-500" size={24} />
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">From Here</span>
                </button>
                <button
                  onClick={() => onDirectionsTo(station.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Navigation2 className="text-green-500" size={24} />
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">To Here</span>
                </button>
                <button
                  onClick={() => onViewDetails(station.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Info className="text-purple-500" size={24} />
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">Details</span>
                </button>
              </div>

              {/* Live Departures (Mock) */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Live Departures</h3>
                <div className="space-y-3">
                  {liveDepartures.map((dep, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-3">
                        <LineBadge line={dep.line} size="sm" />
                        <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">{dep.destination}</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-green-600 dark:text-green-400">
                        <span className="font-bold text-lg">{dep.mins}</span>
                        <span className="text-xs font-semibold">min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
