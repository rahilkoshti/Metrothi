import { describe, it, expect } from 'vitest';
import {
  WALK_SPEED_PRESETS,
  DEFAULT_WALK_SPEED_KMH,
  DEPARTURE_USE_GPS,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  readWalkSpeed,
  readDefaultDeparture,
  readLanguage,
  walkSpeedPreset,
} from './preferences';
import en from '../i18n/locales/en.json';

/**
 * Preferences are stored as strings and arrive from two places that can both be
 * wrong: an older build of this app, and another device running a *newer* one
 * (§5.7 — the prefs table syncs like everything else). Every failure here is
 * silent — a bad parse doesn't throw, it just quietly plans journeys at a pace
 * nobody chose — so the fallbacks are what these assertions are for.
 */

describe('readWalkSpeed', () => {
  it('reads back what the setter writes, for every preset', () => {
    for (const preset of WALK_SPEED_PRESETS) {
      // `String(kmh)` is exactly what `useWalkSpeed`'s setter stores.
      expect(readWalkSpeed(String(preset.kmh))).toBe(preset.kmh);
    }
  });

  it('falls back to the default for an unset pref', () => {
    expect(readWalkSpeed(null)).toBe(DEFAULT_WALK_SPEED_KMH);
    expect(readWalkSpeed('')).toBe(DEFAULT_WALK_SPEED_KMH);
  });

  it.each([
    ['nonsense', 'not a number at all'],
    ['7', 'a speed a newer build offers and this one does not'],
    ['0', 'a speed that would divide the walk estimate by zero'],
    ['-5', 'a negative pace'],
    ['5.5', 'a plausible value that is still not one of the three'],
  ])('rejects %s (%s)', raw => {
    expect(readWalkSpeed(raw)).toBe(DEFAULT_WALK_SPEED_KMH);
  });

  it('offers the default as one of the choices', () => {
    // Otherwise the settings row renders three options with no check mark on
    // any of them, and a rider can't see what they're currently set to.
    expect(WALK_SPEED_PRESETS.some(p => p.kmh === DEFAULT_WALK_SPEED_KMH)).toBe(true);
  });
});

describe('walkSpeedPreset', () => {
  it('finds every preset by its own speed', () => {
    for (const preset of WALK_SPEED_PRESETS) {
      expect(walkSpeedPreset(preset.kmh)).toBe(preset);
    }
  });

  it('returns null for a speed it has no name for', () => {
    // Reachable: a `prefs` row can sync down from a build that offers a fourth
    // pace. The row renders the bare km/h rather than nothing.
    expect(walkSpeedPreset(7)).toBeNull();
  });

  it('names a real bundle key for every preset', () => {
    // The keys are plain strings, so a typo is invisible until the settings row
    // renders "you.paceBrsik" to a rider.
    for (const preset of WALK_SPEED_PRESETS) {
      expect(en.you[preset.labelKey.replace('you.', '') as keyof typeof en.you]).toBeTypeOf('string');
      expect(en.you[preset.detailKey.replace('you.', '') as keyof typeof en.you]).toBeTypeOf('string');
    }
  });
});

describe('readLanguage', () => {
  it('reads back every language the picker offers', () => {
    for (const lang of LANGUAGES) {
      expect(readLanguage(lang.code)).toBe(lang.code);
    }
  });

  it('falls back to English for an unset pref', () => {
    // Also the `undefined` case, which the other two parsers never see: this one
    // is called on `i18n.language`, which is undefined before init resolves.
    expect(readLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(readLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(readLanguage('')).toBe(DEFAULT_LANGUAGE);
  });

  it.each([
    ['hi-IN', 'hi'],
    ['gu-IN', 'gu'],
    ['en-GB', 'en'],
  ])('strips the region subtag: %s → %s', (raw, expected) => {
    // i18next hands back whatever it resolved, which can carry a region even
    // though we only ever write the bare code. An unstripped `hi-IN` would miss
    // the `[lang="hi"]` font rule and render Devanagari as tofu.
    expect(readLanguage(raw)).toBe(expected);
  });

  it.each([
    ['mr', 'a language a newer build offers and this one does not'],
    ['ta', 'a script we ship no font for'],
    ['nonsense', 'not a language tag at all'],
  ])('rejects %s (%s)', raw => {
    expect(readLanguage(raw)).toBe(DEFAULT_LANGUAGE);
  });

  it('offers the default as one of the choices', () => {
    expect(LANGUAGES.some(l => l.code === DEFAULT_LANGUAGE)).toBe(true);
  });
});

describe('readDefaultDeparture', () => {
  it('returns the stored station id', () => {
    expect(readDefaultDeparture('kalupur')).toBe('kalupur');
  });

  it('treats unset and the GPS sentinel identically', () => {
    // "Use my location" has to be storable, not just absent: clearing the pref
    // on one device must sync as a value, or the other device's tombstone-free
    // row would keep its old station.
    expect(readDefaultDeparture(null)).toBeNull();
    expect(readDefaultDeparture(DEPARTURE_USE_GPS)).toBeNull();
  });
});
