import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SectionLabel } from "../../components/FactPrimitives";
import { BlockView } from "./blocks";
import { getTopic } from "./topics";

/**
 * One reference-content screen for all eight topics of §4.5.1 — the generic
 * `InfoPage` of §4.6, not nine hand-built pages. Everything specific to a topic
 * lives in `topics.ts` as data; this file only knows how to lay blocks out.
 *
 * It is a real route (`/you/:topic`) rather than an overlay for the same reason
 * `/stations/:id` is: reference content is exactly the kind of thing a rider
 * gets sent a link to. Default-exported because `App.tsx` reaches it through
 * `React.lazy`, which keeps 19 KB of GMRC prose out of the boot path of a
 * map-first app (§5.6).
 */
export default function InfoPage() {
  const { topic: slug } = useParams();
  const navigate = useNavigate();
  const topic = getTopic(slug);

  // Scroll is reset on route change by `<ScrollReset />` in `App.tsx`, once for
  // every route rather than here for this one.

  // An unknown slug is a stale link, not an error worth a page of its own —
  // send it back to the list it came from.
  if (!topic) return <Navigate to="/you" replace />;

  return (
    <div className="min-h-[100dvh] pb-28">
      {/* Sticky top bar — same chrome as the station page, so "a page you
          pushed onto the stack" looks the same everywhere in the app. */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          background: "var(--c-blur)",
          borderBottom: "1px solid var(--c-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--c-card)" }}
        >
          <ArrowLeft size={18} style={{ color: "var(--c-text)" }} />
        </button>
        <span className="font-bold text-[14px] truncate" style={{ color: "var(--c-text)" }}>
          {topic.title}
        </span>
      </div>

      {/* `select-text` opts the whole page out of the app-wide selection lock
          (`index.css`). That lock exists because the map and the draggable
          sheet start their gestures with a pointerdown the browser would
          otherwise read as a text drag — nothing here is draggable, and a
          reference page is a document, where copying an address or a rule is
          the expected thing to do. */}
      <div className="select-text p-5 max-w-[var(--layout-max-width)] mx-auto">
        <header className="pt-4 pb-2">
          <h1 className="text-4xl font-bold tracking-tight leading-tight" style={{ color: "var(--c-text)" }}>
            {topic.title}
          </h1>
          <p className="text-[13px] font-semibold mt-2" style={{ color: "var(--c-text-3)" }}>
            {topic.blurb}
          </p>
        </header>

        <div className="flex flex-col gap-7 mt-6">
          {topic.sections.map((section) => (
            <section key={section.label}>
              <SectionLabel icon={section.icon} text={section.label} />
              <div className="flex flex-col gap-2.5">
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6" style={{ borderTop: "1px solid var(--c-border)" }}>
          <BlockView block={{ kind: "sourceLink", href: topic.source }} />
        </div>
      </div>
    </div>
  );
}
