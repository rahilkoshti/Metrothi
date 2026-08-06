import { useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { SectionLabel } from "../../components/FactPrimitives";
import { BlockView } from "./blocks";
import { getTopic } from "./topics";
import { track } from "../../services/analytics";

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
  // Only the back button's label: the topic's title, blurb, section labels and
  // every block below are GMRC's reference content, which stays English in all
  // three languages and says so on the YOU screen that links here (§6.7).
  const { t } = useTranslation();
  const { topic: slug } = useParams();
  const navigate = useNavigate();
  const topic = getTopic(slug);

  // Scroll is reset on route change by `<ScrollReset />` in `App.tsx`, once for
  // every route rather than here for this one.

  // §5.8: which reference topics riders actually open. Above the early return
  // because hooks cannot sit after one.
  //
  // `topic.slug` and deliberately not the `slug` URL param: the param is
  // whatever someone typed after `/you/`, and sending that would put arbitrary
  // free text in `props` — the one thing this file's props are never allowed to
  // carry. Resolving it through `getTopic` first means the value can only be one
  // of the eight §4.5.1 slugs, and an unknown one records nothing.
  const resolvedSlug = topic?.slug;
  useEffect(() => {
    if (resolvedSlug) track('topic_viewed', { props: { topic: resolvedSlug } });
  }, [resolvedSlug]);

  // An unknown slug is a stale link, not an error worth a page of its own —
  // send it back to the list it came from.
  if (!topic) return <Navigate to="/you" replace />;

  return (
    <div className="min-h-[100dvh] pb-28">
      {/* Sticky top bar — same chrome as the station page, so "a page you
          pushed onto the stack" looks the same everywhere in the app. */}
      <div
        className="sticky top-0 z-30 px-4 pb-3 flex items-center gap-3 transition-colors"
        style={{
          paddingTop: 'calc(var(--sat) + var(--sp-3))',
          background: "var(--surface-float)",
          borderBottom: "1px solid var(--c-border)",
          backdropFilter: "var(--blur-float)",
          WebkitBackdropFilter: "var(--blur-float)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.goBack')}
          className="hit-44 w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--c-card)" }}
        >
          <ArrowLeft size={18} style={{ color: "var(--c-text)" }} />
        </button>
        <span className="text-headline truncate" style={{ color: "var(--c-text)" }}>
          {topic.title}
        </span>
      </div>

      {/* `select-text` opts the whole page out of the app-wide selection lock
          (`index.css`). That lock exists because the map and the draggable
          sheet start their gestures with a pointerdown the browser would
          otherwise read as a text drag — nothing here is draggable, and a
          reference page is a document, where copying an address or a rule is
          the expected thing to do. */}
      {/* `--measure-read`, not `--layout-max-width`. The layout cap is right for
          rows and wrong for prose: these pages were setting 13px text across the
          full 768px, which is ≈110 characters a line against a 45–75 optimum —
          a measure you lose your place in. 34rem is ≈68. Below 400px nothing
          changes; this is what the page does when it has room. */}
      <div className="select-text p-5 max-w-[var(--measure-read)] mx-auto">
        <header className="pt-4 pb-2">
          <h1 className="text-read-title" style={{ color: "var(--c-text)" }}>
            {topic.title}
          </h1>
          {/* A lede, so it is set as prose rather than as a caption — this is
              the one screen in the app that is read rather than scanned. */}
          <p className="text-read-body mt-2" style={{ color: "var(--c-text-3)" }}>
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

        {/* Source footer. A `sourceNote` is a fact about the transcription — on
            the conduct page, that GMRC's poster carries Gujarati and Hindi
            columns too — so it sits with the link to the original rather than
            inside the content, where it would attach to whichever section
            happened to be last. */}
        <div className="mt-6" style={{ borderTop: "1px solid var(--c-border)" }}>
          {topic.sourceNote && (
            <p className="pt-3 px-1 text-read-label" style={{ color: "var(--c-text-4)" }}>
              {topic.sourceNote}
            </p>
          )}
          <BlockView block={{ kind: "sourceLink", href: topic.source }} />
        </div>
      </div>
    </div>
  );
}
