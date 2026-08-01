import type { LanguageCode } from '../data/preferences';

/**
 * The Indic webfonts, requested only by the riders who need them (PRD §6.4).
 *
 * The app ships Space Grotesk, which has **zero** Devanagari or Gujarati
 * coverage — without this, Hindi and Gujarati render as tofu. The obvious fix is
 * to add both families to the `<link>` in `index.html`, and it was measured and
 * rejected: that stylesheet is render-blocking on every cold start, and adding
 * them takes it from 546 B gzip to 2,008 B. Paying 1.46 KB on the boot path for
 * a script the reader can't see is exactly the trade §5.6 exists to refuse, and
 * it's a quarter of what splitting `/you` bought back.
 *
 * So each family is its own stylesheet, injected when a language that needs it
 * is resolved — 569 B gzip for Devanagari, 1,563 B for Gujarati, and nothing at
 * all for the English default. Injection happens at module scope during i18n
 * init, so on a warm start the request goes out before React has rendered a
 * character.
 *
 * `index.css` puts Space Grotesk *first* in `--font-app` and the Noto family
 * second. Font fallback is per glyph, so Latin — which every station name still
 * is (§6.8) — keeps the app's typeface, and only Devanagari and Gujarati
 * characters fall through to Noto.
 *
 * **Offline caveat, and it is real:** `vite.config.ts` runtime-caches Google
 * Fonts, so a language you've used before works in airplane mode like the rest
 * of the app. Switching to Hindi or Gujarati for the *first* time while offline
 * gets the translations without the glyphs. Precaching both families for every
 * install would cost every rider ~100 KB of fonts to insure a first switch that
 * most will never make.
 */
const FONT_STYLESHEET: Partial<Record<LanguageCode, string>> = {
  hi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
  gu: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap',
};

/** Requests the language's font once. A no-op for English and for a repeat call. */
export function ensureLanguageFont(lang: LanguageCode) {
  const href = FONT_STYLESHEET[lang];
  if (!href) return;
  if (document.head.querySelector(`link[data-lang-font="${lang}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.langFont = lang;
  document.head.appendChild(link);
}
