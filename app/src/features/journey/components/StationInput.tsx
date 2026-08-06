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
  // Derived from the discriminator, so the two ends can never collide and the
  // id doesn't depend on a translated string. There is exactly one of each on
  // the planner.
  const inputId = `station-input-${field}`;

  return (
    /* `focus-within` rather than a ring on the input: the whole row is the
       control a rider sees, and the input inside it is transparent and
       borderless. It previously set `outline-none` with nothing in its place,
       so the planner's two main fields showed no focus at all. */
    <div className="flex items-center gap-3 py-3.5 group relative transition-colors rounded-control focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--c-border-focus)]">
      {!hideIcon && (
        <div className="shrink-0 w-8 flex justify-center transition-colors" style={{ color: 'var(--c-text-3)' }}>
          {isAuto ? <LocateFixed size={20} strokeWidth={2} /> : <MapPin size={20} strokeWidth={2} />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* A real <label>, associated by id. The visible FROM/TO was a 9px
            <div>, so a screen reader had nothing but the placeholder to
            announce — and a placeholder is not a label, because it disappears
            the moment the rider starts typing. */}
        <label
          htmlFor={inputId}
          className="block text-caption uppercase mb-0.5"
          style={{ color: 'var(--c-text-3)' }}
        >
          {t(isSource ? 'planner.from' : 'planner.to')}
        </label>
        <input
          id={inputId}
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(isSource ? 'planner.fromPlaceholder' : 'planner.toPlaceholder')}
          className="w-full bg-transparent border-none outline-none text-headline truncate"
          style={{ color: 'var(--c-text)' }}
          /* Station names are proper nouns the keyboard should leave alone,
             and this is a search field, not an address book entry — so no
             autocomplete, no autocorrect, no sentence-casing. `enterKeyHint`
             makes the on-screen return key say "search" rather than "go". */
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="hit-44 shrink-0 p-1.5 rounded-full transition-colors mr-1"
          style={{ color: 'var(--c-text-3)' }}
          /* A whole string per end, not "Clear " + the label: a sentence built
             from a translated fragment is the one shape that can drift without
             failing. */
          aria-label={t(isSource ? 'planner.clearFrom' : 'planner.clearTo')}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
