import { ArrowLeft, Loader2, Search, Settings, X } from 'lucide-react';

// One pill, two states — so the search bar never changes shape between the home
// screen (idle) and the search overlay (active). The container geometry
// (height, width, padding, radius, surface) is defined once here and shared;
// only the leading/trailing controls swap. Settings lives *inside* the pill
// (Google-Maps style) so the home pill is full-width, matching the overlay.
const PILL_CLASS = 'flex items-center gap-1 rounded-full h-14 pl-2 pr-2';
const PILL_STYLE: React.CSSProperties = {
  background: 'var(--c-blur)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid var(--c-border-2)',
  boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
};
// Every leading/trailing control occupies the same 40px slot, so the text and
// input start at exactly the same x-offset in both states (no nudge on open).
const ICON_SLOT = 'w-10 h-10 flex items-center justify-center shrink-0';
const ICON_BTN = `${ICON_SLOT} rounded-full`;

type Props =
  | {
      variant: 'idle';
      placeholder: string;
      onOpen: () => void;
      onSettings: () => void;
    }
  | {
      variant: 'active';
      placeholder: string;
      value: string;
      onChange: (v: string) => void;
      onClose: () => void;
      onSettings: () => void;
      loading?: boolean;
      inputRef?: React.RefObject<HTMLInputElement | null>;
    };

export function SearchBar(props: Props) {
  if (props.variant === 'idle') {
    return (
      <div className={PILL_CLASS} style={PILL_STYLE}>
        {/* Decorative leading icon in the same 40px slot as the overlay's back
            button, so the placeholder lines up identically across states. */}
        <span className={ICON_SLOT} aria-hidden="true">
          <Search size={18} style={{ color: 'var(--c-text-3)' }} />
        </span>
        <button
          onClick={props.onOpen}
          aria-label={props.placeholder}
          className="flex-1 min-w-0 h-10 flex items-center text-left"
        >
          <span className="text-[16px] font-medium truncate" style={{ color: 'var(--c-text-3)' }}>
            {props.placeholder}
          </span>
        </button>
        <button onClick={props.onSettings} aria-label="Settings" className={ICON_BTN}>
          <Settings size={18} style={{ color: 'var(--c-text-3)' }} />
        </button>
      </div>
    );
  }

  return (
    <div className={PILL_CLASS} style={PILL_STYLE}>
      <button onClick={props.onClose} aria-label="Close search" className={ICON_BTN}>
        <ArrowLeft size={18} style={{ color: 'var(--c-text)' }} />
      </button>
      <input
        ref={props.inputRef}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] font-medium"
        style={{ color: 'var(--c-text)' }}
      />
      {props.loading && (
        <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--c-text-4)' }} />
      )}
      {props.value ? (
        <button onClick={() => props.onChange('')} aria-label="Clear search" className={ICON_BTN}>
          <X size={16} style={{ color: 'var(--c-text-3)' }} />
        </button>
      ) : (
        <button onClick={props.onSettings} aria-label="Settings" className={ICON_BTN}>
          <Settings size={18} style={{ color: 'var(--c-text-3)' }} />
        </button>
      )}
    </div>
  );
}
