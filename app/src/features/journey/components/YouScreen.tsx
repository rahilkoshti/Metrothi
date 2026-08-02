import { Moon, Sun, Info, MessageSquare, Database, Building2, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../i18n/useLanguage";
import { LANGUAGES } from "../../../data/preferences";
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
import { SavedSection, HistorySection } from "./SavedData";
import { PreferencesSection } from "./PreferencesSection";
import koshtiWordmark from "../../../assets/koshti-wordmark.png";

/**
 * A section of reference-page rows, divided, from the topic catalog.
 *
 * **The titles and blurbs stay in English in every language, deliberately.**
 * They label GMRC's reference content, which §6.7 forbids us from translating
 * ourselves — a Hindi row opening an English page would promise more than the
 * page delivers. `EnglishOnlyNote` below says so out loud instead.
 */
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

/**
 * Printed under the two reference sections when the app isn't in English.
 *
 * A statement about *Metrothi*, not about GMRC: the Do's & Don'ts and Prohibited
 * Items posters are trilingual at source (§6.7), so "GMRC publishes these in
 * English only" would be false. What's true is that we haven't transcribed the
 * other two columns yet, which is §8 phase 7.
 */
function EnglishOnlyNote() {
  const { t, i18n } = useTranslation();
  if (i18n.language === 'en') return null;
  return (
    <div className="px-5 pt-2 text-[11px] font-medium" style={{ color: 'var(--c-text-4)' }}>
      {t('you.englishOnlyForNow')}
    </div>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={t(isDark ? 'you.switchToLight' : 'you.switchToDark')}
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

// ─── Language selector ───────────────────────────────────────────────────────

/**
 * Three-way segmented picker (§6.5).
 *
 * Each label is written in its own script, so it is legible to the rider who
 * wants it without depending on the language they're currently stuck in — the
 * one control on this screen that has to work for someone who can't read the
 * rest of it. The `lang` attribute goes on each button for the same reason it
 * goes on `<html>`: it is what picks the right font for that word, and what
 * tells a screen reader which voice to use.
 *
 * Segmented rather than an `ExpandableRow` picker like walking pace: with three
 * options the whole choice fits on one row, and a collapsed row would have to
 * print the current language in a script the rider may not read.
 */
function LanguagePicker() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className="flex items-center gap-1 m-3 p-1 rounded-xl"
      style={{ background: 'var(--c-card-alt)' }}
    >
      {LANGUAGES.map((l) => {
        const active = language === l.code;
        return (
          <button
            key={l.code}
            lang={l.code}
            onClick={() => setLanguage(l.code)}
            aria-pressed={active}
            className="flex-1 min-h-[44px] px-2 text-[13px] font-bold rounded-lg transition-all duration-200 active:scale-[0.98]"
            style={{
              background: active ? 'var(--c-accent)' : 'transparent',
              color: active ? 'var(--c-accent-fg)' : 'var(--c-text-2)',
              boxShadow: active ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Maker credit ────────────────────────────────────────────────────────────

/**
 * The Koshti wordmark under the version line.
 *
 * **A noun label, not "Designed by", and that is an i18n decision.** The name
 * sits *below* its label here, so a verb-and-preposition line would put the
 * verb before the name — which is the order English wants and the order Hindi
 * and Gujarati don't (§6.4, the same reason `live.walkTo` is four whole keys
 * rather than a sentence with fragments appended). "Design & development" is a
 * heading rather than a clause, so the name reads as its value in all three.
 *
 * **The asset is a mask, not a picture.** It ships as a single alpha-channel
 * PNG tinted with `currentColor`, so the mark takes the footer's own muted
 * colour in both themes — a black-and-white pair of images would need a theme
 * conditional and would print at full contrast in a block that is deliberately
 * the quietest thing on the screen. `mask-size: contain` letterboxes inside the
 * box, so the aspect ratio holds without the numbers having to be exact.
 *
 * Not a link: there is no URL for it in the repo, and inventing one would send
 * riders somewhere we haven't checked.
 */
function MakerCredit() {
  const { t } = useTranslation();

  return (
    <div className="px-5 pb-4 flex flex-col items-center gap-2">
      <div
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--c-text-4)' }}
      >
        {t('you.designCredit')}
      </div>
      {/* Proper noun — never translated, and here it isn't even text (§6.8). */}
      <div
        role="img"
        aria-label="Koshti"
        style={{
          width: 96,
          height: 12,
          color: 'var(--c-text-3)',
          background: 'currentColor',
          WebkitMaskImage: `url(${koshtiWordmark})`,
          maskImage: `url(${koshtiWordmark})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      <div className="text-[10px] font-medium" style={{ color: 'var(--c-text-4)' }}>
        © {new Date().getFullYear()}
      </div>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function YouScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const openTopic = (slug: string) => navigate(`/you/${slug}`);
  const appStore = officialAppStore();

  return (
    <div className="max-w-[var(--layout-max-width)] mx-auto pb-28" style={{ fontFamily: 'var(--font-app)' }}>

      {/* ── Header / Avatar ──────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-3)' }}>
            {t(theme === 'dark' ? 'you.darkModeBanner' : 'you.lightModeBanner')}
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>{t('you.title')}</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.goBack')}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-2)' }}
        >
          <ArrowLeft size={20} style={{ color: 'var(--c-text)' }} />
        </button>
      </div>

      {/* Account + sync (§4.5, §5.7). Real now, not a "Phase 5" stub. */}
      <AccountCard />

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <SectionHeader label={t('you.appearance')} />
      <SectionCard>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-card-alt)' }}>
            {theme === 'dark'
              ? <Moon size={16} style={{ color: 'var(--c-text-2)' }} />
              : <Sun size={16} style={{ color: '#F59E0B' }} />
            }
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>{t('you.theme')}</div>
            <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
              {t(theme === 'dark' ? 'you.dark' : 'you.light')}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </SectionCard>

      {/* ── Language ─────────────────────────────────────────────────────────
          §6.5. Its own section rather than a second row under Appearance: the
          header names it, so the picker doesn't have to repeat the word in a
          script the rider might be trying to get away from. */}
      <SectionHeader label={t('you.language')} />
      <SectionCard>
        <LanguagePicker />
      </SectionCard>

      {/* ── Riding the metro ─────────────────────────────────────────────────
          Above Preferences / Saved / History on purpose. That ordering was set
          when those three were Phase-4 stubs and live content couldn't be
          buried under promises; it stays now that they're real, because a rider
          on this screen is far likelier to want the fare rules than to want to
          change their walking pace. */}
      <SectionHeader label={t('you.ridingTheMetro')} />
      <SectionCard>
        <TopicRows topics={RIDING_TOPICS} onOpen={openTopic} />
      </SectionCard>
      <EnglishOnlyNote />

      {/* ── Help & contact ───────────────────────────────────────────────── */}
      <SectionHeader label={t('you.helpAndContact')} />
      <SectionCard>
        <TopicRows topics={HELP_TOPICS} onOpen={openTopic} />
        <RowDivider />
        <Row
          icon={OFFICIAL_APP.icon}
          label={OFFICIAL_APP.title}
          // GMRC's own blurb, then our sentence about where the link goes.
          value={`${OFFICIAL_APP.blurb} · ${t('you.opensStore', { store: appStore.store })}`}
          href={appStore.href}
          external
        />
      </SectionCard>
      <EnglishOnlyNote />

      {/* ── Preferences ──────────────────────────────────────────────────────
          Both rows printed their own default as if it were stored (§8.1 phase
          E). They're now `prefs` rows, so they sync like everything else. */}
      <PreferencesSection />

      {/* ── Saved & History ──────────────────────────────────────────────────
          Both sections read the live Dexie tables (§8.1 phase D). They were
          "Phase 4" stubs for as long as the data existed, which made this screen
          the only place in the app saying these features weren't built. */}
      <SavedSection />
      <HistorySection />

      {/* ── Data & sync ──────────────────────────────────────────────────── */}
      <DataSection />

      {/* ── About & Data ─────────────────────────────────────────────────────
          Every line here is read from the data files' own `_meta`, so the dates
          stop needing a manual edit each time one is regenerated (§4.5.1). */}
      <SectionHeader label={t('you.aboutAndData')} />
      <SectionCard>
        {dataProvenance().map((row, i) => (
          <div key={row.key}>
            {i > 0 && <RowDivider />}
            <Row
              icon={row.key === "live" ? Info : Database}
              label={t(row.labelKey)}
              // The date keeps GMRC's own dd.mm.yyyy format in every language —
              // it is the format printed on the timetable poster.
              value={t(row.detailKey, { date: row.date })}
              {...(row.href ? { href: row.href, external: true } : {})}
            />
          </div>
        ))}
      </SectionCard>

      {/* ── Feedback ─────────────────────────────────────────────────────────
          Split on purpose: a timetable error in *Metrothi* is ours, a complaint
          about *the metro* is GMRC's, and the two must not go to one inbox. */}
      <SectionHeader label={t('you.feedback')} />
      <SectionCard>
        <Row icon={MessageSquare} label={t('you.reportTimetable')} value={t('you.reportTimetableDetail')} />
        <RowDivider />
        <Row icon={MessageSquare} label={t('you.suggestFeature')} value={t('you.suggestFeatureDetail')} />
        <RowDivider />
        <Row
          icon={Building2}
          label={t('you.feedbackGmrc')}
          value={t('you.feedbackGmrcDetail')}
          href={GMRC_FEEDBACK_URL}
          external
        />
      </SectionCard>

      {/* ── App version ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-6 text-center">
        <div className="text-[11px] font-semibold" style={{ color: 'var(--c-text-4)' }}>
          Metrothi · v0.1.0-prototype
        </div>
        <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-4)' }}>
          {t('you.simulatedNote')}
        </div>
      </div>

      {/* ── Who made it ──────────────────────────────────────────────────────
          Last thing on the screen, below the version block: it is the one line
          here that is about Metrothi rather than about the metro. */}
      <MakerCredit />

    </div>
  );
}
