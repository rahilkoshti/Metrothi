import { ArrowUpRight, Check, Ban, Phone, Mail, TriangleAlert } from "lucide-react";
import { FactChip, FactNote } from "../../components/FactPrimitives";

/**
 * The block model every reference page renders from (§4.6).
 *
 * The nine topics of §4.5.1 differ only in their content, and that content is
 * already structured in JSON — so they share one renderer rather than being
 * nine hand-built screens that drift apart. A block holds **strings**, never
 * composed JSX: §6.7 will resolve the two poster topics through Hindi and
 * Gujarati arrays with per-string English fallback, and that only works if the
 * text is still text by the time it reaches here.
 *
 * Every block draws its own card, except `note` and `sourceLink` — those are
 * fine print that belongs *under* the thing it qualifies, not inside another
 * box.
 */

/**
 * No `numbered` marker. Every list GMRC publishes turned out to be a set of
 * rules rather than a sequence of steps — even the lost-and-found one, which
 * reads like a procedure and isn't — and numbering a set invents an order.
 */
export type ListMarker = "bullet" | "do" | "dont";

export type InfoAction =
  | { kind: "tel"; label: string; value: string }
  | { kind: "mailto"; label: string; value: string }
  | { kind: "external"; label: string; value: string };

export type Block =
  | { kind: "list"; marker: ListMarker; items: string[] }
  | { kind: "chips"; items: string[] }
  | { kind: "keyValue"; rows: { label: string; value: string }[] }
  | { kind: "definitions"; items: { term: string; description: string }[] }
  | { kind: "prose"; text: string; tone?: "plain" | "warn" }
  | { kind: "note"; text: string }
  | { kind: "actions"; items: InfoAction[] }
  | { kind: "linkList"; items: { label: string; href: string }[] }
  | { kind: "sourceLink"; href: string };

// ─── Shared shell ────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}
    >
      {children}
    </div>
  );
}

/**
 * The reading voice, and the one place this feature departs from the rest of
 * the app. Everywhere else Metrothi speaks in 9–14px bold uppercase — right for
 * a countdown or a gate number, wrong for fourteen consecutive sentences of
 * GMRC's rules. Body text here is 14px medium on `--c-text-2` at relaxed
 * leading; the measure is already capped by `--layout-max-width`.
 */
function Body({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[14px] font-medium leading-relaxed" style={{ color: "var(--c-text-2)" }}>
      {children}
    </span>
  );
}

// ─── Individual blocks ───────────────────────────────────────────────────────

function Marker({ marker }: { marker: ListMarker }) {
  if (marker === "do") {
    return <Check size={15} strokeWidth={2.6} className="shrink-0 mt-1" style={{ color: "#22c55e" }} />;
  }
  if (marker === "dont") {
    return <Ban size={15} strokeWidth={2.6} className="shrink-0 mt-1" style={{ color: "#f87171" }} />;
  }
  return (
    <span
      className="shrink-0 rounded-full mt-2"
      style={{ width: 4, height: 4, background: "var(--c-text-4)" }}
    />
  );
}

function ListBlock({ marker, items }: { marker: ListMarker; items: string[] }) {
  return (
    <Card className="px-4 py-4">
      <ul className="flex flex-col gap-3.5">
        {items.map((text, i) => (
          <li key={i} className="flex gap-3">
            <Marker marker={marker} />
            <Body>{text}</Body>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Eighteen network-wide facilities as a bulleted list is a wall; as chips it is
 * a glance. Same component the Station Info tab uses for gate numbers, so the
 * two surfaces read as one app.
 */
function ChipsBlock({ items }: { items: string[] }) {
  return (
    <Card className="p-3.5">
      <div className="flex flex-wrap gap-2">
        {items.map((text) => (
          <FactChip key={text} text={text} wrap />
        ))}
      </div>
    </Card>
  );
}

function KeyValueBlock({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Card className="overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="flex items-start gap-4 px-4 py-3"
          style={{ borderTop: i === 0 ? "none" : "1px solid var(--c-border)" }}
        >
          <div className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: "var(--c-text-3)" }}>
            {row.label}
          </div>
          <div
            className="text-[13px] font-bold tabular-nums text-right shrink-0 max-w-[55%] leading-snug"
            style={{ color: "var(--c-text)" }}
          >
            {row.value}
          </div>
        </div>
      ))}
    </Card>
  );
}

/**
 * A named thing and what it is — the emergency equipment list, the registered
 * office. `keyValue` can't carry these: its right column is a figure, and these
 * "values" are sentences. Same content shape as the station page's
 * `AttributeCard`, laid out as rows instead of a grid.
 */
function DefinitionsBlock({ items }: { items: { term: string; description: string }[] }) {
  return (
    <Card className="overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.term}
          className="px-4 py-3.5"
          style={{ borderTop: i === 0 ? "none" : "1px solid var(--c-border)" }}
        >
          <div className="text-[13px] font-bold" style={{ color: "var(--c-text)" }}>
            {item.term}
          </div>
          <div className="text-[12.5px] font-medium leading-snug mt-1" style={{ color: "var(--c-text-4)" }}>
            {item.description}
          </div>
        </div>
      ))}
    </Card>
  );
}

function ProseBlock({ text, tone = "plain" }: { text: string; tone?: "plain" | "warn" }) {
  if (tone === "warn") {
    return (
      <div
        className="rounded-2xl p-4 flex gap-3"
        style={{ background: "var(--c-card)", border: "1px solid #f59e0b" }}
      >
        <TriangleAlert size={16} strokeWidth={2.4} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
        <Body>{text}</Body>
      </div>
    );
  }
  return (
    <Card className="px-4 py-3.5">
      <Body>{text}</Body>
    </Card>
  );
}

/**
 * `tel:` and `mailto:` as real actions, not copyable text (§4.5.1) — but the
 * literal value is printed under each button anyway, because `tel:` does
 * nothing on a desktop browser and the number still has to be readable there.
 * `.select-text` opts those spans out of the app-wide selection lock so they
 * can actually be copied (see `index.css`).
 *
 * Stacked full-width rather than paired side by side: an email address at 13px
 * does not survive a half-width button at 375px.
 */
function ActionsBlock({ items }: { items: InfoAction[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((action) => {
        const href =
          action.kind === "tel"
            ? `tel:${action.value.replace(/\s/g, "")}`
            : action.kind === "mailto"
              ? `mailto:${action.value}`
              : action.value;
        const primary = action.kind === "tel";
        const Icon = action.kind === "tel" ? Phone : action.kind === "mailto" ? Mail : ArrowUpRight;
        return (
          <div key={`${action.kind}-${action.value}`}>
            <a
              href={href}
              {...(action.kind === "external" ? { target: "_blank", rel: "noreferrer" } : {})}
              className="w-full py-4 px-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={
                primary
                  ? { background: "var(--c-accent)", color: "var(--c-accent-fg)" }
                  : { color: "var(--c-accent)", border: "1px solid var(--c-accent)" }
              }
            >
              <Icon size={16} strokeWidth={2.5} />
              {action.label}
            </a>
            {action.kind !== "external" && (
              <div
                className="select-text text-center text-[12px] font-semibold mt-1.5 break-all"
                style={{ color: "var(--c-text-4)" }}
              >
                {action.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LinkListBlock({ items }: { items: { label: string; href: string }[] }) {
  return (
    <Card className="overflow-hidden">
      {items.map((item, i) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)] focus-visible:outline-none"
          style={{ borderTop: i === 0 ? "none" : "1px solid var(--c-border)" }}
        >
          <span className="flex-1 min-w-0 text-[14px] font-semibold" style={{ color: "var(--c-text)" }}>
            {item.label}
          </span>
          <ArrowUpRight size={16} className="shrink-0" style={{ color: "var(--c-text-4)" }} />
        </a>
      ))}
    </Card>
  );
}

/**
 * Every page carries a link to the GMRC page it was transcribed from, so a
 * rider can always check us against the source (§4.5.1). This is principle 1
 * (§1) as a component: we never ask to be taken on trust.
 */
function SourceLinkBlock({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 px-1 py-2 text-[12px] font-semibold"
      style={{ color: "var(--c-text-4)" }}
    >
      Read the original on gujaratmetrorail.com
      <ArrowUpRight size={13} strokeWidth={2.4} />
    </a>
  );
}

// ─── Switch ──────────────────────────────────────────────────────────────────

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "list":
      return <ListBlock marker={block.marker} items={block.items} />;
    case "chips":
      return <ChipsBlock items={block.items} />;
    case "keyValue":
      return <KeyValueBlock rows={block.rows} />;
    case "definitions":
      return <DefinitionsBlock items={block.items} />;
    case "prose":
      return <ProseBlock text={block.text} tone={block.tone} />;
    case "note":
      return <FactNote text={block.text} />;
    case "actions":
      return <ActionsBlock items={block.items} />;
    case "linkList":
      return <LinkListBlock items={block.items} />;
    case "sourceLink":
      return <SourceLinkBlock href={block.href} />;
  }
}
