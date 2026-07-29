import type { LucideIcon } from "lucide-react";

/**
 * The small display parts the Station Info tab (§4.4.1) grew, shared with the
 * reference pages (§4.5.1) so the two read as one surface.
 *
 * They all say the same thing in the same voice: a labelled group of published
 * facts, where absent data is absent rather than placeheld. Nothing here holds
 * state or knows where its content came from — callers pass `cardBg` because
 * the same block sits on the white page and inside the white sheet, where the
 * card has to invert (see `StationDetailBody`'s `surface` prop).
 */

/** The uppercase label that titles a group of facts. */
export function SectionLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} style={{ color: "var(--c-text-4)" }} />
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
        {text}
      </span>
    </div>
  );
}

/** A small pill — one gate number, one transport mode, one facility. */
export function FactChip({
  text,
  tone = "plain",
  wrap = false,
}: {
  text: string;
  tone?: "plain" | "accent";
  /**
   * Let the label break across lines. Off by default, because a gate number or
   * a mode name is two words and a break would read as two chips. On for the
   * network-wide facilities, where GMRC's labels run to six words — at 320px
   * "Washrooms for differently abled passengers" is wider than the card it sits
   * in, and `nowrap` clips it rather than overflowing visibly.
   */
  wrap?: boolean;
}) {
  return (
    <span
      className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg${wrap ? " leading-snug" : " whitespace-nowrap"}`}
      style={
        tone === "accent"
          ? { background: "var(--c-accent)", color: "var(--c-accent-fg)" }
          : { color: "var(--c-text)", border: "1px solid var(--c-border-2)" }
      }
    >
      {text}
    </span>
  );
}

/** Fine print under a block — a source caveat, a caption, a legal basis. */
export function FactNote({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-semibold leading-snug mt-2.5" style={{ color: "var(--c-text-4)" }}>
      {text}
    </p>
  );
}

/** One figure over its label, in a 2-column grid. */
export function StatTile({
  value,
  label,
  cardBg,
  wide = false,
}: {
  value: React.ReactNode;
  label: string;
  cardBg: string;
  /** Spans both columns — for a fifth tile that would otherwise sit orphaned. */
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-3.5 text-center${wide ? " col-span-2" : ""}`}
      style={{ background: cardBg, border: "1px solid var(--c-border)" }}
    >
      <div className="text-lg font-bold leading-none" style={{ color: "var(--c-text)" }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: "var(--c-text-4)" }}>
        {label}
      </div>
    </div>
  );
}
