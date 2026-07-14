import { LocateFixed, MapPin, X } from "lucide-react";

interface StationInputProps {
  label: string;
  value: string;
  onFocus: () => void;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isAuto?: boolean;
}

export function StationInput({ label, value, onFocus, onChange, onClear, onKeyDown, isAuto }: StationInputProps) {
  return (
    <div className="flex items-center gap-3 py-3.5 group relative transition-colors">
      <div className="shrink-0 w-8 flex justify-center transition-colors" style={{ color: 'var(--c-text-3)' }}>
        {isAuto ? <LocateFixed size={17} /> : <MapPin size={17} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--c-text-3)' }}>{label}</div>
        <input
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={label === "From" ? "Your location" : "Where to?"}
          className="w-full bg-transparent border-none outline-none text-[17px] font-semibold truncate"
          style={{ color: 'var(--c-text)' }}
        />
      </div>
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="shrink-0 p-1.5 rounded-full transition-colors mr-1"
          style={{ color: 'var(--c-text-3)' }}
          aria-label={`Clear ${label}`}
        >
          <X size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
