import { LocateFixed, MapPin, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * One end of the planner's origin/destination pair.
 *
 * Takes `field`, not `label`. It used to take the label and derive the other two
 * strings from it — `placeholder={label === "From" ? … }` and
 * `aria-label={\`Clear ${label}\`}` — which worked exactly as long as the label
 * was the English word "From". Under §6 it stopped being that: the comparison
 * failed for every non-English rider, so the *origin* field offered "Where to?",
 * and the clear button announced "Clear થી". Neither throws and neither is
 * visible in English, which is why the shape is now a discriminator rather than
 * a display string that behaviour reads back out of.
 */
interface StationInputProps {
  /** Which end this is. Drives all three of its strings; nothing infers them. */
  field: "source" | "dest";
  value: string;
  onFocus: () => void;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isAuto?: boolean;
  /** Hide the built-in leading glyph — the parent owns the connector rail gutter. */
  hideIcon?: boolean;
}

export function StationInput({ field, value, onFocus, onChange, onClear, onKeyDown, isAuto, hideIcon }: StationInputProps) {
  const { t } = useTranslation();
  const isSource = field === "source";

  return (
    <div className="flex items-center gap-3 py-3.5 group relative transition-colors">
      {!hideIcon && (
        <div className="shrink-0 w-8 flex justify-center transition-colors" style={{ color: 'var(--c-text-3)' }}>
          {isAuto ? <LocateFixed size={17} /> : <MapPin size={17} />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--c-text-3)' }}>
          {t(isSource ? 'planner.from' : 'planner.to')}
        </div>
        <input
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(isSource ? 'planner.fromPlaceholder' : 'planner.toPlaceholder')}
          className="w-full bg-transparent border-none outline-none text-[17px] font-semibold truncate"
          style={{ color: 'var(--c-text)' }}
        />
      </div>
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="shrink-0 p-1.5 rounded-full transition-colors mr-1"
          style={{ color: 'var(--c-text-3)' }}
          /* A whole string per end, not "Clear " + the label: a sentence built
             from a translated fragment is the one shape that can drift without
             failing. */
          aria-label={t(isSource ? 'planner.clearFrom' : 'planner.clearTo')}
        >
          <X size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
