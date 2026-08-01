import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  readLanguage,
  type LanguageCode,
} from '../data/preferences';
import { ensureLanguageFont } from './fonts';
import en from './locales/en.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';

/**
 * i18next setup (PRD §6.1).
 *
 * Imported by `main.tsx` for its side effects, before `createRoot`, so `t()`
 * resolves synchronously on the very first render. That only holds because the
 * three bundles are handed to `init` inline: with a backend plugin the first
 * frame would be keys, or English, or nothing.
 *
 * **All three bundles ship on the boot path, deliberately.** Splitting them per
 * language would save an English rider the ~1 KB gzip that Hindi and Gujarati
 * cost together, and buy it with a frame of English text on every cold start for
 * everyone else — the language equivalent of the theme flash that made theme the
 * one synchronous exception (§5.7). At this size that trade is not worth making;
 * if the bundles grow to where it is, split `hi`/`gu` and keep `en` static,
 * since `en` is the fallback and is needed either way.
 */

/**
 * Synchronous first-paint mirror of the language preference — the same pattern
 * theme uses, and for a reason that qualifies under the same rule (§5.7): the
 * first render has to know what language to render *in*, and IndexedDB can only
 * be read asynchronously.
 *
 * Unlike theme this needs **no inline script in `index.html`**. Theme paints the
 * document background before React exists, so it has to be resolved earlier than
 * any module can run; language only affects rendered text, and there is no text
 * until `main.tsx` runs. Reading the hint at import time is early enough.
 *
 * Dexie remains the source of truth and the thing that syncs; this key is a
 * cache allowed to be one frame stale.
 */
const PAINT_HINT_KEY = 'metrothi-lang';

function readPaintHint(): LanguageCode {
  try {
    return readLanguage(localStorage.getItem(PAINT_HINT_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Everything a language change touches outside React: the `<html lang>` the CSS
 * font rules key off, the webfont that language needs, and the paint hint.
 *
 * Driven off i18next's own `languageChanged` event rather than called by the
 * setter, so a language that arrives from another device via sync lands exactly
 * the same way a tap on the selector does.
 */
function applyLanguage(lang: LanguageCode) {
  document.documentElement.lang = lang;
  ensureLanguageFont(lang);
  try {
    localStorage.setItem(PAINT_HINT_KEY, lang);
  } catch { /* private mode — Dexie still has it */ }
}

const initialLanguage = readPaintHint();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    gu: { translation: gu },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map(l => l.code),
  // React escapes everything it renders already; leaving this on double-escapes
  // any interpolated station name carrying an ampersand.
  interpolation: { escapeValue: false },
});

applyLanguage(initialLanguage);
i18n.on('languageChanged', lng => applyLanguage(readLanguage(lng)));

export default i18n;
