import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPref, setPref } from '../data/db';
import { syncNow } from '../services/syncEngine';
import { track } from '../services/analytics';
import { PREF_LANGUAGE, readLanguage, type LanguageCode } from '../data/preferences';

/**
 * The rider's language, and a setter (PRD §6.1, §5.7).
 *
 * A pref row like walking pace, so it syncs — not a `ThemeContext`-shaped
 * provider, because i18next already holds the language globally and
 * `useTranslation` already re-renders every consumer when it changes. A context
 * on top would be a second source of truth for the same value.
 *
 * The write is local-first and unawaited, like every other pref: `changeLanguage`
 * repaints the UI immediately, and sync follows when it can.
 */
export function useLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = useCallback(
    (code: LanguageCode) => {
      void i18n.changeLanguage(code);
      void setPref(PREF_LANGUAGE, code).then(() => syncNow());
      // §6 is a large, measurable bet — +13.2 KB gzip on every cold start,
      // three quarters of it for scripts most riders can't read. This is the
      // only thing that will ever say whether anyone switched (§5.8).
      track('language_changed', { props: { to: code } });
    },
    [i18n],
  );

  return { language: readLanguage(i18n.language), setLanguage };
}

/**
 * Applies the stored language once IndexedDB has been read, and whenever the row
 * changes underneath — which is how a language chosen on another device arrives.
 *
 * Mounted once, renders nothing, and lives in a leaf for the same reason
 * `ScrollReset` does: the `useLiveQuery` subscription re-renders whatever holds
 * it, and holding it in the shell would re-render the route tree — map included
 * — for a value the shell only forwards. i18next notifies the components that
 * actually display text on its own.
 *
 * **No write-back guard is needed here, unlike `ThemeContext`.** That one holds
 * React state which both the hydrating read and the toggle set, so a cold start
 * could restamp `updatedAt` and beat a genuinely newer preference under
 * last-write-wins. This reads and never writes; the setter is the only writer.
 *
 * An absent row stays absent: the default language is not a choice anyone
 * expressed, and writing it would overwrite a real choice made elsewhere.
 */
export function LanguageSync() {
  const { i18n } = useTranslation();
  // `undefined` while Dexie is still being read, `null` once it comes back empty.
  const stored = useLiveQuery(() => getPref(PREF_LANGUAGE), [], undefined);

  useEffect(() => {
    if (stored == null) return;
    const lang = readLanguage(stored);
    if (lang !== readLanguage(i18n.language)) void i18n.changeLanguage(lang);
  }, [stored, i18n]);

  return null;
}
