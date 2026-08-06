import { useState } from "react";
import { ChevronRight, ArrowUpRight, ChevronDown } from "lucide-react";

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
 * A row that can't do anything now says so by having no affordance.
 *
 * There was also a `badge` prop, which existed only to print "Phase 4" on rows
 * whose feature wasn't built. §8.1 phases D & E built the last five, so it had
 * no call sites left and was removed rather than kept warm for a stub that may
 * never come back.
 *
 * `href` covers the three outbound kinds the reference rows need — `tel:`,
 * `mailto:` and an external page — and only the last of those opens a new tab.
 */
export function Row({
  icon: Icon,
  label,
  value,
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
      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${interactive ? 'hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)]' : ''}`}
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
      {children}
      {interactive && !children && (
        <Chevron size={16} className="shrink-0" style={{ color: 'var(--c-text-4)' }} />
      )}
    </Tag>
  );
}

/**
 * A row that discloses its own content below it.
 *
 * Lives here rather than in either caller because §8.1 phases D & E each grew
 * one: the Saved/History lists and the walking-speed picker were byte-identical
 * down to the chevron's `rotate(180deg)`, and their expanded children had
 * already drifted to different padding on day one — which is exactly the fork
 * this module exists to prevent.
 *
 * `expandable` defaults to true because a picker always has choices to show.
 * The lists pass `count > 0`, so an empty one renders as a plain row with no
 * affordance rather than a press that opens nothing — the rule `Row` derives
 * its own interactivity from.
 *
 * `children` may be a function, which receives a `close` callback: a picker
 * collapses once a choice is made, while a list of things to remove stays open.
 * That's the only behaviour the two callers disagree on, so it's the only thing
 * passed back out.
 */
export function ExpandableRow({
  icon,
  label,
  value,
  expandable = true,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string;
  expandable?: boolean;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Row
        icon={icon}
        label={label}
        value={value}
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
      >
        {expandable && (
          <ChevronDown
            size={16}
            className="shrink-0 transition-transform duration-200"
            style={{ color: 'var(--c-text-4)', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </Row>
      {expandable && open && (typeof children === 'function' ? children(() => setOpen(false)) : children)}
    </>
  );
}

/**
 * A plain on/off switch, sized to sit in a {@link Row}'s trailing slot.
 *
 * Lives here rather than beside its one caller for the reason the file header
 * gives: a local copy in one screen is how two drift. `ThemeToggle` in
 * `YouScreen` is deliberately *not* refactored into this — it is a sun/moon
 * three-part control with an icon either side, not a switch with a label, and
 * collapsing them would mean a `variant` prop that exists to serve two
 * unrelated designs.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox: the track
 * and knob are divs, so without the role a screen reader is handed a button
 * with no state at all.
 */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Announced name — the row's visible label is not tied to this control. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      /* The track stays 44x26 — a switch that is 44px *tall* reads as a
         button — and `hit-44` grows only the axis that is short. */
      className="hit-44 relative rounded-full shrink-0 transition-colors duration-200 active:scale-[0.97]"
      style={{
        width: 44,
        height: 26,
        background: checked ? 'var(--c-accent)' : 'var(--c-border-2)',
      }}
    >
      <span
        className="absolute top-1 rounded-full transition-all duration-200"
        style={{
          width: 18,
          height: 18,
          background: checked ? 'var(--c-accent-fg)' : 'var(--c-card)',
          left: checked ? 22 : 4,
          boxShadow: 'var(--shadow-float)',
        }}
      />
    </button>
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
