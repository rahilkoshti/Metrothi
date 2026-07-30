import { describe, it, expect } from 'vitest';
import {
  WALK_SPEED_PRESETS,
  DEFAULT_WALK_SPEED_KMH,
  DEPARTURE_USE_GPS,
  readWalkSpeed,
  readDefaultDeparture,
  walkSpeedLabel,
} from './preferences';

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

describe('walkSpeedLabel', () => {
  it('names every preset', () => {
    for (const preset of WALK_SPEED_PRESETS) {
      expect(walkSpeedLabel(preset.kmh)).toContain(preset.label);
    }
  });

  it('still says something for a speed it has no name for', () => {
    expect(walkSpeedLabel(7)).toBe('7 km/h');
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
