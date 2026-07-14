import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { STATIONS } from "../engine/journeyEngine";

import { LineBadge } from "../../../components/LineBadge";
import { LINE_BADGE_BG, LINE_NAMES } from "../constants";

const LINE_ORDER = ["blue", "red", "yellow", "violet"] as const;

export function StationsDirectory() {
  const [query, setQuery] = useState("");

  const filteredStations = useMemo(() => {
    const q = query.toLowerCase();
    return STATIONS.filter((s) => s.name.toLowerCase().includes(q));
  }, [query]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof STATIONS> = {};
    filteredStations.forEach((s) => { (groups[s.line] ??= []).push(s); });
    return groups;
  }, [filteredStations]);

  return (
    <div className="p-5 max-w-[var(--layout-max-width)] mx-auto pt-10 pb-24">
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>Network</div>
        <h1 className="text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--c-text)' }}>Stations</h1>
      </div>

      <div className="sticky top-0 z-30 pb-4 -mx-5 px-5 transition-colors" style={{ background: 'var(--c-bg)' }}>
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'var(--c-card)' }}>
          <Search size={18} className="shrink-0" style={{ color: 'var(--c-text-3)' }} />
          <input
            aria-label="Search all stations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all stations…"
            className="border-none outline-none w-full text-[15px] font-medium bg-transparent"
            style={{ color: 'var(--c-text)' }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-1 rounded-full transition-colors shrink-0" style={{ color: 'var(--c-text-3)' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8 mt-2">
        {LINE_ORDER.map((line) => {
          const stns = grouped[line];
          if (!stns || stns.length === 0) return null;
          return (
            <div key={line}>
              <div className="flex items-center gap-3 mb-3">
                <LineBadge line={line} size="md" />
                <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>{LINE_NAMES[line]}</span>
                <span className="text-xs font-bold ml-auto" style={{ color: 'var(--c-text-3)' }}>{stns.length}</span>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)' }}>
                {stns.map((s, idx) => (
                  <Link
                    key={s.id}
                    to={`/stations/${s.id}`}
                    className="flex items-center px-4 py-3.5 transition-colors group"
                    style={{ borderBottom: idx !== stns.length - 1 ? '1px solid var(--c-border)' : 'none' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--c-card-alt)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mr-4"
                      style={{ background: LINE_BADGE_BG[line], opacity: 0.7 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate leading-tight" style={{ color: 'var(--c-text)' }}>
                        {s.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium" style={{ color: 'var(--c-text-3)' }}>Ph.{s.phase}</span>
                        {s.interchange && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1 rounded" style={{ color: 'var(--c-text-3)', border: '1px solid var(--c-border-2)' }}>
                            Interchange
                          </span>
                        )}
                        {s.operational === false && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-700 px-1 rounded" style={{ border: '1px solid rgba(161,98,7,0.4)' }}>
                            Soon
                          </span>
                        )}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--c-text-4)' }}>
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {filteredStations.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--c-text-3)' }}>
            <Search size={28} className="mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-sm">No stations found for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
