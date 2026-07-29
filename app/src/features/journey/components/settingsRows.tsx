import { ChevronRight, ArrowUpRight } from "lucide-react";

/**
 * The YOU screen's row primitives.
 *
 * Extracted from `YouScreen.tsx` so the account card (§4.5) can build rows that
 * match the rest of settings without hand-rolling a second set — the same reason
 * both departure lists share `DepartureRow` (§4.6). If a row needs a new shape,
 * it goes in here; a local copy in one screen is how the two drift.
 */

export function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="text-[9px] font-bold uppercase tracking-widest px-5 pt-6 pb-2"
      style={{ color: 'var(--c-text-3)' }}
    >
      {label}
    </div>
  );
}

export function RowDivider() {
  return <div className="mx-5" style={{ height: 1, background: 'var(--c-border)' }} />;
}

/**
 * One settings row.
 *
 * Interactivity is derived from `onClick` / `href`, never declared: the old
 * `tappable` flag drew a button, a hover state and a chevron on rows that had
 * no handler at all, so every "tappable" row on this screen was a dead press.
 * A row that can't do anything now says so by having no affordance — the
 * `badge` ("Phase 4") is what tells you it's coming.
 *
 * `href` covers the three outbound kinds the reference rows need — `tel:`,
 * `mailto:` and an external page — and only the last of those opens a new tab.
 */
export function Row({
  icon: Icon,
  label,
  value,
  badge,
  onClick,
  href,
  external = false,
  danger = false,
  disabled = false,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
  /** Opens in a new tab and swaps the chevron for an outbound arrow. */
  external?: boolean;
  /** Destructive action — tints the label. Used by "Clear local data". */
  danger?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const interactive = Boolean((onClick || href) && !disabled);
  const Tag = href && !disabled ? "a" : onClick ? "button" : "div";
  const Chevron = external ? ArrowUpRight : ChevronRight;

  return (
    <Tag
      {...(href && !disabled ? { href } : {})}
      {...(href && external && !disabled ? { target: "_blank", rel: "noreferrer" } : {})}
      {...(Tag === "button" ? { type: "button" as const, onClick, disabled } : {})}
      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${interactive ? 'hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)] focus-visible:outline-none' : ''}`}
      style={{
        background: 'transparent',
        ...(interactive ? { cursor: 'pointer' } : {}),
        ...(disabled ? { opacity: 0.5 } : {}),
      }}
    >
      {Icon && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-card-alt)' }}>
          <Icon size={16} style={{ color: danger ? 'var(--c-danger)' : 'var(--c-text-2)' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] font-semibold"
          style={{ color: danger ? 'var(--c-danger)' : 'var(--c-text)' }}
        >
          {label}
        </div>
        {value && <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>{value}</div>}
      </div>
      {badge && (
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border mr-2"
          style={{ color: 'var(--c-text-3)', borderColor: 'var(--c-border-2)' }}
        >
          {badge}
        </span>
      )}
      {children}
      {interactive && !children && (
        <Chevron size={16} className="shrink-0" style={{ color: 'var(--c-text-4)' }} />
      )}
    </Tag>
  );
}

/** The rounded card every section's rows sit in. */
export function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      {children}
    </div>
  );
}
