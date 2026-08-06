import { describe, it, expect } from 'vitest';
import { legOffsetsOf, activeLegIndexOf, liveStatusOf } from './liveStatus';
import type { PlanResult } from './engine/journeyEngine';
import type { JourneyState } from './hooks/useJourneySession';
import en from '../../i18n/locales/en.json';

/** Dotted lookup into the bundle; `undefined` for a key that isn't there. */
function leafAt(obj: unknown, key: string): unknown {
  return key.split('.').reduce<any>((acc, part) => acc?.[part], obj);
}

/**
 * A two-leg trip A→B→[C]→D→E, changing at C. The interchange appears once in
 * `stops` and belongs to both legs, which is the case every index calculation
 * here has to get right.
 *
 *   stop index   0    1    2*   3    4
 *   timeline    10   13   16   23   26     (* = interchange)
 *
 * Leg 1 departs C at 16 + 3 buffer + 4 wait = 23, which is why stop 3 lands
 * there — the fixture matches what `computeStopTimeline` would build.
 */
const TIMELINE = [10, 13, 16, 23, 26];

function trip(over: Partial<PlanResult> = {}): PlanResult {
  return {
    source: { name: 'A' },
    dest: { name: 'E' },
    sourceStation: { name: 'A' },
    destStation: { name: 'E' },
    sourcePlace: null,
    destPlace: null,
    sourceWalkMins: 0,
    destWalkMins: 0,
    stops: [
      { name: 'A', viaLine: 'blue' },
      { name: 'B', viaLine: 'blue' },
      { name: 'C', viaLine: 'blue' },
      { name: 'D', viaLine: 'red' },
      { name: 'E', viaLine: 'red' },
    ],
    legs: [
      { ids: ['a', 'b', 'c'], line: 'blue', headingName: 'Bx', bufferMins: 0, waitMins: 0 },
      { ids: ['c', 'd', 'e'], line: 'red', headingName: 'Rx', bufferMins: 3, waitMins: 4 },
    ],
    ...over,
  } as unknown as PlanResult;
}

function status(
  currentState: JourneyState,
  currentStopIndex: number,
  elapsedMins: number,
  result: PlanResult = trip(),
  stopTimeline: number[] = TIMELINE
) {
  return liveStatusOf(result, {
    currentState,
    currentStopIndex,
    elapsedMins,
    stopTimeline,
    startedAt: null,
  });
}

describe('leg geometry', () => {
  it('offsets overlap by one stop per leg', () => {
    expect(legOffsetsOf(trip().legs)).toEqual([0, 2, 4]);
  });

  it('gives the interchange to the leg about to be boarded, not the one just left', () => {
    // The one moment it matters: standing on the concourse at C, the rider
    // needs the line they are getting on.
    expect(activeLegIndexOf([0, 2, 4], 1)).toBe(0);
    expect(activeLegIndexOf([0, 2, 4], 2)).toBe(1);
    expect(activeLegIndexOf([0, 2, 4], 4)).toBe(1);
  });
});

describe('the countdown counts to something the rider can act on', () => {
  it('walks to a departure, not to an arrival two stations away', () => {
    // The regression this whole bar was rebuilt around: the old summary read
    // `stopTimeline[currentStopIndex + 1]`, which while walking is stop 1 — an
    // arrival past the origin. Here that would print 11 min instead of 8.
    const s = status('WALKING_TO_STATION', 0, 2)!;
    expect(s.instruction).toEqual({ key: 'live.walkTo', values: { station: 'A' } });
    expect(s.countdown).toEqual({ mins: 8, labelKey: 'live.trainDeparts' });
  });

  it('counts a connection to when the connecting train leaves', () => {
    const s = status('TRANSFERRING', 2, 17)!;
    expect(s.line).toBe('red');
    expect(s.instruction).toEqual({
      key: 'live.changeToLine',
      values: { line: 'Red Line', heading: 'Rx' },
    });
    // 16 at the interchange + 3 buffer + 4 wait = 23.
    expect(s.countdown).toEqual({ mins: 6, labelKey: 'live.trainDeparts' });
    expect(s.tone).toBe('alert');
  });

  it('never prints a negative once a deadline has passed', () => {
    expect(status('WALKING_TO_STATION', 0, 40)!.countdown!.mins).toBe(0);
  });
});

describe('per-state instruction', () => {
  it('names the next stop rather than saying "On train"', () => {
    const s = status('ON_TRAIN', 1, 12)!;
    expect(s.instruction).toEqual({ key: 'live.nextStation', values: { station: 'C' } });
    expect(s.countdown).toEqual({ mins: 4, labelKey: 'live.nextStopLabel' });
  });

  it('names the direction while waiting, not the station underfoot', () => {
    expect(status('WAITING_FOR_TRAIN', 0, 5)!.instruction).toEqual({
      key: 'live.boardToward',
      values: { heading: 'Bx' },
    });
  });

  // Both APPROACHING_* states are entered only from a GPS proximity check, so
  // a schedule-driven run never reaches them and this is their only coverage.
  it('warns before an interchange', () => {
    const s = status('APPROACHING_TRANSFER', 1, 14)!;
    expect(s.instruction).toEqual({ key: 'live.changeAtNext', values: { station: 'C' } });
    expect(s.countdown).toEqual({ mins: 2, labelKey: 'live.getReady' });
    expect(s.tone).toBe('alert');
    expect(s.line).toBe('blue'); // still riding the first leg
  });

  it('warns before the destination', () => {
    const s = status('APPROACHING_DESTINATION', 3, 24)!;
    expect(s.instruction).toEqual({ key: 'live.getOffNext', values: { station: 'E' } });
    expect(s.tone).toBe('good');
  });
});

describe('the alight line', () => {
  it('points at the interchange on the first leg and the destination on the last', () => {
    expect(status('ON_TRAIN', 1, 12)!.alight).toMatchObject({ name: 'C', final: false });
    expect(status('ON_TRAIN', 3, 24)!.alight).toMatchObject({ name: 'E', final: true });
  });

  it('carries the walk out to a place, not just the last station', () => {
    const s = status(
      'ON_TRAIN',
      3,
      24,
      trip({ destPlace: { name: 'Office' } as never, destWalkMins: 6, dest: { name: 'Office' } as never })
    )!;
    expect(s.alight).toMatchObject({ name: 'Office', final: true });
    // 26 at the last station + 6 walking; halfway is 16, not 13.
    expect(status('ON_TRAIN', 2, 16, trip({ destPlace: { name: 'Office' } as never, destWalkMins: 6 }))!.progress)
      .toBeCloseTo(0.5);
  });

  it('drops once the trip is over — which is what keeps the collapsed peek short', () => {
    const s = status('COMPLETED', 4, 30)!;
    expect(s.alight).toBeNull();
    expect(s.progress).toBe(1);
  });
});

describe('the first frame of a journey', () => {
  it('still renders a bar before the session has built its timeline', () => {
    // Returning null here would collapse the sheet header to its drag handle
    // and then grow it again, and the sheet parks against the height it sees
    // when that spring starts.
    const s = status('WALKING_TO_STATION', 0, 0, trip(), [])!;
    expect(s).not.toBeNull();
    expect(s.instruction).toEqual({ key: 'live.walkTo', values: { station: 'A' } });
    expect(s.countdown).toBeNull();
    expect(s.progress).toBe(0);
  });

  it('returns nothing at all when there is no route to describe', () => {
    expect(status('ON_TRAIN', 0, 0, trip({ legs: [], stops: [] }))).toBeNull();
  });
});

/**
 * The failure mode this file's key/values shape introduced, and the reason it
 * gets its own test: a key that doesn't exist in the bundle renders as the
 * literal string `live.boardToward` in the sheet header. i18next doesn't throw,
 * `fallbackLng` has nothing to fall back to, and the type system can't help —
 * `key` is a `string`. Nothing else in the suite would go red.
 *
 * Every state is enumerated rather than sampled: the two APPROACHING_* states
 * are only ever entered from a GPS proximity check, so a typo in either would
 * otherwise reach a rider before it reached CI.
 */
describe('every emitted key exists in the English bundle', () => {
  const withPlace = trip({
    destPlace: { name: 'Office' } as never,
    destWalkMins: 6,
    dest: { name: 'Office' } as never,
  });

  const CASES: [JourneyState, number, number, PlanResult][] = [
    ['NOT_STARTED', 0, 0, trip()],
    ['WALKING_TO_STATION', 0, 2, trip()],
    ['WAITING_FOR_TRAIN', 0, 5, trip()],
    ['ON_TRAIN', 1, 12, trip()],
    ['ON_TRAIN', 4, 26, trip()], // no next stop — the bare "On train" branch
    ['APPROACHING_TRANSFER', 1, 14, trip()],
    ['TRANSFERRING', 2, 17, trip()],
    ['APPROACHING_DESTINATION', 3, 24, trip()],
    ['FINAL_WALK', 4, 26, trip()], // station ending
    ['FINAL_WALK', 4, 26, withPlace], // place ending — a different key
    ['COMPLETED', 4, 30, trip()],
  ];

  it.each(CASES)('%s @stop %i', (state, stop, elapsed, result) => {
    const s = status(state, stop, elapsed, result)!;
    expect(leafAt(en, s.instruction.key), s.instruction.key).toBeTypeOf('string');
    if (s.countdown) {
      expect(leafAt(en, s.countdown.labelKey), s.countdown.labelKey).toBeTypeOf('string');
    }
  });

  it('interpolates every placeholder the English string asks for', () => {
    // The other half of the same defect: a key that resolves but is handed no
    // `station` renders "Walk to " — a complete-looking sentence missing the
    // only word that mattered.
    for (const [state, stop, elapsed, result] of CASES) {
      const { key, values } = status(state, stop, elapsed, result)!.instruction;
      const wanted = [...String(leafAt(en, key)).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
      for (const name of wanted) {
        expect(values?.[name], `${key} got no ${name}`).toBeTruthy();
      }
    }
  });
});
