import { ChevronRight, User, Moon, Sun, Footprints, MapPin, BookMarked, Clock, Train, Info, MessageSquare, Database, Zap, ArrowLeft } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

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

function Row({
  icon: Icon,
  label,
  value,
  badge,
  tappable = false,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string;
  badge?: string;
  tappable?: boolean;
  children?: React.ReactNode;
}) {
  const Tag = tappable ? "button" : "div";
  return (
    <Tag
      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${tappable ? 'hover:bg-[var(--c-card-alt)] focus-visible:bg-[var(--c-card-alt)] focus-visible:outline-none' : ''}`}
      style={{
        background: 'transparent',
        ...(tappable ? { cursor: 'pointer' } : {}),
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
      {tappable && !children && (
        <ChevronRight size={16} style={{ color: 'var(--c-text-4)' }} />
      )}
    </Tag>
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
            tappable
          />
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <SectionHeader label="Appearance" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
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
      </div>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <SectionHeader label="Preferences" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <Row icon={Footprints} label="Walking speed" value="Normal (5 km/h)" badge="Phase 4" tappable />
        <RowDivider />
        <Row icon={MapPin} label="Default departure station" value="Not set — uses GPS" badge="Phase 4" tappable />
      </div>

      {/* ── Saved ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Saved" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <Row icon={BookMarked} label="Saved places" value="Home, Work, and more" badge="Phase 4" tappable />
        <RowDivider />
        <Row icon={Train} label="Saved journeys" value="Your frequent routes" badge="Phase 4" tappable />
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Journey History" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <Row icon={Clock} label="Past trips" value="All your previous journeys" badge="Phase 4" tappable />
      </div>

      {/* ── About & Data ─────────────────────────────────────────────────── */}
      <SectionHeader label="About & Data" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <Row
          icon={Database}
          label="Timetable"
          value="Effective 18.05.2026 · Hand-transcribed from GMRC"
        />
        <RowDivider />
        <Row
          icon={Info}
          label="Fares"
          value="Estimates only — not sourced from GMRC"
        />
        <RowDivider />
        <Row
          icon={Info}
          label="Live estimates"
          value="Simulated from timetable — no real-time feed"
        />
      </div>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      <SectionHeader label="Feedback" />
      <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <Row icon={MessageSquare} label="Report a timetable issue" tappable />
        <RowDivider />
        <Row icon={MessageSquare} label="Suggest a feature" tappable />
      </div>

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
