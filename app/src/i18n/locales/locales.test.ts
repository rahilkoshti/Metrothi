import { describe, it, expect } from 'vitest';
import { createInstance } from 'i18next';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../../data/preferences';
import en from './en.json';
import hi from './hi.json';
import gu from './gu.json';

/**
 * Bundle parity (PRD §6.2).
 *
 * Every failure this file guards is silent. `fallbackLng: 'en'` means a missing
 * Hindi key renders English rather than throwing, so a half-translated bundle
 * ships green; and a translation that drops an interpolation placeholder renders
 * a sentence with the number simply gone — "अगली ट्रेन में" — which is worse
 * than English, because it reads as a complete sentence that says the wrong
 * thing.
 *
 * That second check is the same class of defect the 2026-07-29 source-fidelity
 * audit found in `topics.ts`: prose *composed* from parts, where the structure
 * is well-formed and the meaning isn't. Structure is what a test can hold, so
 * this holds it.
 */

const BUNDLES: Record<string, Record<string, unknown>> = { en, hi, gu };

/** Every leaf key, dotted, ignoring the `_meta` provenance block. */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>)
    .filter(([k]) => !(prefix === '' && k === '_meta'))
    .flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

function leafAt(obj: unknown, key: string): string {
  return key.split('.').reduce<any>((acc, part) => acc?.[part], obj);
}

/** `{{duration}}` / `<b>` style markers, which must survive translation. */
function markers(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}|<\/?(\w+)>/g)]
    .map(m => m[1] ?? m[2])
    .sort();
}

const EN_KEYS = leafKeys(en);
const TRANSLATIONS = LANGUAGES.map(l => l.code).filter(c => c !== DEFAULT_LANGUAGE);

describe('locale bundles', () => {
  it('ships one bundle per language the picker offers', () => {
    for (const lang of LANGUAGES) {
      expect(BUNDLES[lang.code], `no bundle for ${lang.code}`).toBeDefined();
    }
  });

  it.each(TRANSLATIONS)('%s translates every key English has', code => {
    const missing = EN_KEYS.filter(k => typeof leafAt(BUNDLES[code], k) !== 'string');
    expect(missing, `untranslated (would silently fall back to English)`).toEqual([]);
  });

  it.each(TRANSLATIONS)('%s adds no key English does not have', code => {
    // A key with no English source can never render — `en` is the fallback and
    // the only bundle the components are written against.
    const orphans = leafKeys(BUNDLES[code]).filter(k => !EN_KEYS.includes(k));
    expect(orphans, 'orphaned key with no English source').toEqual([]);
  });

  it.each(TRANSLATIONS)('%s keeps every interpolation placeholder and tag', code => {
    const broken = EN_KEYS.filter(k => {
      const source = leafAt(en, k);
      const target = leafAt(BUNDLES[code], k);
      if (typeof target !== 'string') return false; // covered by the parity test
      return markers(source).join() !== markers(target).join();
    });
    expect(broken, 'placeholder dropped, renamed or added').toEqual([]);
  });

  it('carries the sourcing rule in every bundle', () => {
    // Same convention as the scraped data files: an underscore-prefixed block
    // states where the strings came from and stays out of the UI (§5.6).
    for (const code of Object.keys(BUNDLES)) {
      const meta = (BUNDLES[code] as { _meta?: { rule?: string; source?: string } })._meta;
      expect(meta?.rule, `${code} has no _meta.rule`).toBeTruthy();
      expect(meta?.source, `${code} has no _meta.source`).toBeTruthy();
    }
  });

  /**
   * The bundles are only correct if *i18next* agrees, and the two ways it can
   * disagree are both silent. A plural suffix CLDR doesn't use for a language is
   * simply never selected — the key resolves through the fallback and renders
   * English. And `{{count}}` reaching a key with no `_one`/`_other` pair returns
   * the raw key, which looks like a bug in the data rather than the strings.
   */
  describe('resolved through i18next', () => {
    // Keys that render `{{count}}` itself. `journey.gateList` is also a plural
    // pair but interpolates a formatted `{{gates}}` list instead, so it can't
    // be checked the same way — it gets its own assertion below.
    const PLURALS = ['common.stops', 'common.transfers', 'live.changes', 'live.rideStops'];

    it.each(LANGUAGES.map(l => l.code))('%s selects a real plural form at 1 and at many', async code => {
      const i18n = createInstance();
      await i18n.init({
        resources: Object.fromEntries(
          Object.entries(BUNDLES).map(([k, v]) => [k, { translation: v }]),
        ),
        lng: code,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false },
      });

      for (const key of PLURALS) {
        for (const count of [1, 11]) {
          const out = i18n.t(key, { count });
          expect(out, `${code} ${key} @${count}`).not.toBe(key);
          expect(out).toContain(String(count));
          // The fallback would render the English word, which is the failure
          // this is really watching for — a suffix CLDR never asks hi/gu for.
          // One regex over every plural key's English noun: adding a key here
          // without adding its word leaves the new key half-guarded.
          if (code !== 'en') expect(out).not.toMatch(/stop|transfer|change|ride/i);
        }
      }
    });

    it.each(LANGUAGES.map(l => l.code))('%s interpolates a value into a sentence', async code => {
      const i18n = createInstance();
      await i18n.init({
        resources: Object.fromEntries(
          Object.entries(BUNDLES).map(([k, v]) => [k, { translation: v }]),
        ),
        lng: code,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false },
      });
      expect(i18n.t('planner.serviceStartsIn', { duration: '12 min' })).toContain('12 min');
      // Ampersands and the like must survive: `escapeValue: false` is what stops
      // a station name rendering as `Old &amp; New`.
      expect(i18n.t('home.walkingDirections', { station: 'A & B' })).toContain('A & B');
    });

    it.each(LANGUAGES.map(l => l.code))('%s pluralises the gate label around a list it does not contain', async code => {
      // `journey.gateList` is the one plural whose `{{count}}` never renders:
      // it selects the word ("Gate"/"Gates") while a separately-formatted list
      // of numbers fills `{{gates}}`. The failure that matters is the count
      // reaching the string as a stray "1" — or the list going missing.
      const i18n = createInstance();
      await i18n.init({
        resources: Object.fromEntries(
          Object.entries(BUNDLES).map(([k, v]) => [k, { translation: v }]),
        ),
        lng: code,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false },
      });
      for (const [count, gates] of [[1, '4'], [3, '1, 2 & 4']] as const) {
        const out = i18n.t('journey.gateList', { count, gates });
        expect(out, `${code} @${count}`).toContain(gates);
        expect(out).not.toBe('journey.gateList');
        if (code !== 'en') expect(out).not.toMatch(/gate/i);
      }
    });
  });

  it('has no empty string anywhere', () => {
    for (const code of Object.keys(BUNDLES)) {
      const blank = leafKeys(BUNDLES[code]).filter(k => leafAt(BUNDLES[code], k) === '');
      expect(blank, `${code} renders blank for these keys`).toEqual([]);
    }
  });
});
