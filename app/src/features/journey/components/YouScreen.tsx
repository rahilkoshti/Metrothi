import { Moon, Sun, Footprints, MapPin, BookMarked, Clock, Train, Info, MessageSquare, Database, Building2, ArrowLeft } from "lucide-react";
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
import { AccountCard, DataSection } from "../../account/AccountCard";
// The row primitives moved to their own module so the account card renders rows
// identical to these instead of forking a second set (§4.6).
import { Row, RowDivider, SectionCard, SectionHeader } from "./settingsRows";

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

      {/* Account + sync (§4.5, §5.7). Real now, not a "Phase 5" stub. */}
      <AccountCard />

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

      {/* ── Data & sync ──────────────────────────────────────────────────── */}
      <DataSection />

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
          Live estimates simulated from the GMRC timetable
        </div>
      </div>

    </div>
  );
}
