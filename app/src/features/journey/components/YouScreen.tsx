import { ChevronRight, ArrowUpRight, User, Moon, Sun, Footprints, MapPin, BookMarked, Clock, Train, Info, MessageSquare, Database, Building2, Zap, ArrowLeft } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import {
  RIDING_TOPICS,
  HELP_TOPICS,
  OFFICIAL_APP,
  GMRC_FEEDBACK_URL,
  officialAppStore,
  type TopicEntry,
} from "../../info/catalog";
import { dataProvenance } from "../../info/provenance";

// ─── Shared row components ────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="text-[9px] font-bold uppercase tracking-widest px-5 pt-6 pb-2"
      style={{ color: 'var(--c-text-3)' }}
    >
      {label}
    </div>
  );
}

function RowDivider() {
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
function Row({
  icon: Icon,
  label,
  value,
  badge,
  onClick,
  href,
  external = false,
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
  children?: React.ReactNode;
}) {
  const interactive = Boolean(onClick || href);
  const Tag = href ? "a" : onClick ? "button" : "div";
  const Chevron = external ? ArrowUpRight : ChevronRight;

  return (
    <Tag
      {...(href ? { href } : {})}
      {...(href && external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...(Tag === "button" ? { type: "button" as const, onClick } : {})}
      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${interactive ? 'hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)] focus-visible:outline-none' : ''}`}
      style={{
        background: 'transparent',
        ...(interactive ? { cursor: 'pointer' } : {}),
      }}
    >
      {Icon && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-card-alt)' }}>
          <Icon size={16} style={{ color: 'var(--c-text-2)' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>{label}</div>
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
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      {children}
    </div>
  );
}

/** A section of reference-page rows, divided, from the topic catalog. */
function TopicRows({ topics, onOpen }: { topics: TopicEntry[]; onOpen: (slug: string) => void }) {
  return (
    <>
      {topics.map((topic, i) => (
        <div key={topic.slug}>
          {i > 0 && <RowDivider />}
          <Row
            icon={topic.icon}
            label={topic.title}
            value={topic.blurb}
            onClick={() => onOpen(topic.slug)}
          />
        </div>
      ))}
    </>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="flex items-center gap-2 transition-all active:scale-95"
    >
      <Sun size={14} style={{ color: isDark ? 'var(--c-text-4)' : '#F59E0B' }} />
      {/* Track */}
      <div
        className="relative rounded-full transition-colors duration-300"
        style={{
          width: 44,
          height: 26,
          background: isDark ? 'var(--c-accent)' : 'var(--c-border-2)',
        }}
      >
        {/* Knob */}
        <div
          className="absolute top-1 rounded-full transition-all duration-300"
          style={{
            width: 18,
            height: 18,
            background: isDark ? '#000' : '#fff',
            left: isDark ? 22 : 4,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>
      <Moon size={14} style={{ color: isDark ? 'var(--c-accent)' : 'var(--c-text-4)' }} />
    </button>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function YouScreen() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const openTopic = (slug: string) => navigate(`/you/${slug}`);
  const appStore = officialAppStore();

  return (
    <div className="max-w-[var(--layout-max-width)] mx-auto pb-28" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Header / Avatar ──────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>
            {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>You</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
        >
          <ArrowLeft size={20} style={{ color: 'var(--c-text)' }} />
        </button>
      </div>

      {/* Avatar card */}
      <div className="mx-5 mb-2 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-4 p-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-card-alt)' }}
          >
            <User size={26} style={{ color: 'var(--c-text-3)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold" style={{ color: 'var(--c-text)' }}>Traveller</div>
            <div className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>Not signed in</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--c-border)' }}>
          <Row
            icon={Zap}
            label="Sign in to sync your data"
            value="Saved places, journeys & preferences"
            badge="Phase 5"
          />
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <SectionHeader label="Appearance" />
      <SectionCard>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-card-alt)' }}>
            {theme === 'dark'
              ? <Moon size={16} style={{ color: 'var(--c-text-2)' }} />
              : <Sun size={16} style={{ color: '#F59E0B' }} />
            }
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>Theme</div>
            <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </SectionCard>

      {/* ── Riding the metro ─────────────────────────────────────────────────
          Above Preferences / Saved / History on purpose: those are three
          sections of Phase-4 stubs, and this is the first content on the screen
          that actually does something. Live content doesn't get buried under
          promises. */}
      <SectionHeader label="Riding the metro" />
      <SectionCard>
        <TopicRows topics={RIDING_TOPICS} onOpen={openTopic} />
      </SectionCard>

      {/* ── Help & contact ───────────────────────────────────────────────── */}
      <SectionHeader label="Help & contact" />
      <SectionCard>
        <TopicRows topics={HELP_TOPICS} onOpen={openTopic} />
        <RowDivider />
        <Row
          icon={OFFICIAL_APP.icon}
          label={OFFICIAL_APP.title}
          value={`${OFFICIAL_APP.blurb} · ${appStore.label}`}
          href={appStore.href}
          external
        />
      </SectionCard>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <SectionHeader label="Preferences" />
      <SectionCard>
        <Row icon={Footprints} label="Walking speed" value="Normal (5 km/h)" badge="Phase 4" />
        <RowDivider />
        <Row icon={MapPin} label="Default departure station" value="Not set — uses GPS" badge="Phase 4" />
      </SectionCard>

      {/* ── Saved ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Saved" />
      <SectionCard>
        <Row icon={BookMarked} label="Saved places" value="Home, Work, and more" badge="Phase 4" />
        <RowDivider />
        <Row icon={Train} label="Saved journeys" value="Your frequent routes" badge="Phase 4" />
      </SectionCard>

      {/* ── History ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Journey History" />
      <SectionCard>
        <Row icon={Clock} label="Past trips" value="All your previous journeys" badge="Phase 4" />
      </SectionCard>

      {/* ── About & Data ─────────────────────────────────────────────────────
          Every line here is read from the data files' own `_meta`, so the dates
          stop needing a manual edit each time one is regenerated (§4.5.1). */}
      <SectionHeader label="About & Data" />
      <SectionCard>
        {dataProvenance().map((row, i) => (
          <div key={row.key}>
            {i > 0 && <RowDivider />}
            <Row
              icon={row.key === "live" ? Info : Database}
              label={row.label}
              value={row.detail}
              {...(row.href ? { href: row.href, external: true } : {})}
            />
          </div>
        ))}
      </SectionCard>

      {/* ── Feedback ─────────────────────────────────────────────────────────
          Split on purpose: a timetable error in *Metrothi* is ours, a complaint
          about *the metro* is GMRC's, and the two must not go to one inbox. */}
      <SectionHeader label="Feedback" />
      <SectionCard>
        <Row icon={MessageSquare} label="Report a timetable issue" value="A departure Metrothi gets wrong" />
        <RowDivider />
        <Row icon={MessageSquare} label="Suggest a feature" value="Something Metrothi should do" />
        <RowDivider />
        <Row
          icon={Building2}
          label="Feedback to GMRC"
          value="Complaints and suggestions about the metro itself"
          href={GMRC_FEEDBACK_URL}
          external
        />
      </SectionCard>

      {/* ── App version ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-4 text-center">
        <div className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
          Metrothi · v0.1.0-prototype
        </div>
        <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>
          Phase 1 — all features simulated, no auth
        </div>
      </div>

    </div>
  );
}
