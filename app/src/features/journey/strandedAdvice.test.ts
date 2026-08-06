import { describe, it, expect } from 'vitest';
import { strandedAdviceOf } from './strandedAdvice';
import { LINE_META, type JourneyOption } from './engine/journeyEngine';
import en from '../../i18n/locales/en.json';

/** Dotted lookup into the bundle; `undefined` for a key that isn't there. */
function leafAt(obj: unknown, key: string): unknown {
  return key.split('.').reduce<any>((acc, part) => acc?.[part], obj);
}

const BLUE = LINE_META.blue.name;

function option(over: Partial<JourneyOption> = {}): JourneyOption {
  return {
    departClockTime: '06:23 AM',
    feasible: true,
    strandedAtLine: null,
    ...over,
  } as unknown as JourneyOption;
}

const stranded = option({ feasible: false, strandedAtLine: BLUE, departClockTime: '10:40 PM' });

// A Wednesday evening, well after any line has finished for the day. The
// "tomorrow" branch reads tomorrow's weekday rules, so the fixture has to be a
// real date rather than an offset from whenever the suite happens to run.
const WED_NIGHT = new Date('2026-08-05T17:30:00Z'); // 23:00 IST

describe('nothing to advise', () => {
  it('says nothing about a trip that works', () => {
    expect(strandedAdviceOf(option(), [option()], WED_NIGHT)).toBeNull();
  });

  it('says nothing when the engine named no stranding line', () => {
    expect(strandedAdviceOf(option({ feasible: false }), [], WED_NIGHT)).toBeNull();
  });

  it('says nothing about a line it cannot resolve back to an id', () => {
    // A display name from a build with different data. Better a plain
    // explanation than a confident time for the wrong line.
    const s = option({ feasible: false, strandedAtLine: 'Line 9 (Nowhere)' });
    expect(strandedAdviceOf(s, [], WED_NIGHT)).toBeNull();
  });
});

describe('when another departure today gets through', () => {
  it('names it rather than saying "pick a different departure"', () => {
    const later = option({ departClockTime: '05:50 AM' });
    expect(strandedAdviceOf(stranded, [stranded, later], WED_NIGHT)).toEqual({
      key: 'journey.strandedTakeInstead',
      values: { line: BLUE, time: '05:50 AM' },
    });
  });

  it('takes the soonest feasible one, not the last', () => {
    const first = option({ departClockTime: '05:50 AM' });
    const second = option({ departClockTime: '06:10 AM' });
    const advice = strandedAdviceOf(stranded, [stranded, first, second], WED_NIGHT)!;
    expect(advice.values.time).toBe('05:50 AM');
  });
});

describe('when the whole day is gone', () => {
  it('falls through to that line\'s first train tomorrow', () => {
    const advice = strandedAdviceOf(stranded, [stranded], WED_NIGHT)!;
    expect(advice.key).toBe('journey.strandedTomorrow');
    expect(advice.values.line).toBe(BLUE);
    // The exact clock time belongs to the timetable, not to this module — what
    // this asserts is that a time was resolved at all rather than an empty
    // placeholder reaching the sentence.
    expect(advice.values.time).toMatch(/\d{1,2}:\d{2}/);
  });

  it('answers with no options at all — the plan that produced none', () => {
    // `planJourney` returns `options: []` when the source station has no train
    // left today, which is the case where this sentence matters most.
    const advice = strandedAdviceOf(stranded, [], WED_NIGHT)!;
    expect(advice.key).toBe('journey.strandedTomorrow');
  });
});

/**
 * The same failure mode `liveStatus.test.ts` guards: an emitted key that isn't
 * in the bundle renders as the literal string `journey.strandedTomorrow`, and
 * nothing throws. `key` is a `string`, so the type system cannot help.
 */
describe('every emitted key exists in the English bundle', () => {
  const CASES: [string, StrandedAdviceCase][] = [
    ['another departure today', { options: [stranded, option({ departClockTime: '05:50 AM' })] }],
    ['nothing left today', { options: [stranded] }],
  ];

  it.each(CASES)('%s', (_name, { options }) => {
    const advice = strandedAdviceOf(stranded, options, WED_NIGHT)!;
    const text = leafAt(en, advice.key);
    expect(text, advice.key).toBeTypeOf('string');
    // And that every placeholder the English string asks for was supplied —
    // "You'd be stuck at , which…" is a complete-looking sentence missing the
    // only word that mattered.
    for (const [, name] of String(text).matchAll(/\{\{(\w+)\}\}/g)) {
      expect(advice.values[name], `${advice.key} got no ${name}`).toBeTruthy();
    }
  });
});

interface StrandedAdviceCase {
  options: JourneyOption[];
}
