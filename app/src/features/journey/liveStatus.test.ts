import { describe, it, expect } from 'vitest';
import { legOffsetsOf, activeLegIndexOf, liveStatusOf } from './liveStatus';
import type { PlanResult } from './engine/journeyEngine';
import type { JourneyState } from './hooks/useJourneySession';

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
    expect(s.instruction).toBe('Walk to A');
    expect(s.countdown).toEqual({ value: '8 min', label: 'Train departs' });
  });

  it('counts a connection to when the connecting train leaves', () => {
    const s = status('TRANSFERRING', 2, 17)!;
    expect(s.line).toBe('red');
    expect(s.instruction).toBe('Change to Red Line · toward Rx');
    // 16 at the interchange + 3 buffer + 4 wait = 23.
    expect(s.countdown).toEqual({ value: '6 min', label: 'Train departs' });
    expect(s.tone).toBe('alert');
  });

  it('never prints a negative once a deadline has passed', () => {
    expect(status('WALKING_TO_STATION', 0, 40)!.countdown!.value).toBe('0 min');
  });
});

describe('per-state instruction', () => {
  it('names the next stop rather than saying "On train"', () => {
    const s = status('ON_TRAIN', 1, 12)!;
    expect(s.instruction).toBe('Next: C');
    expect(s.countdown).toEqual({ value: '4 min', label: 'Next stop' });
  });

  it('names the direction while waiting, not the station underfoot', () => {
    expect(status('WAITING_FOR_TRAIN', 0, 5)!.instruction).toBe('Board toward Bx');
  });

  // Both APPROACHING_* states are entered only from a GPS proximity check, so
  // a schedule-driven run never reaches them and this is their only coverage.
  it('warns before an interchange', () => {
    const s = status('APPROACHING_TRANSFER', 1, 14)!;
    expect(s.instruction).toBe('Change at C — next stop');
    expect(s.countdown).toEqual({ value: '2 min', label: 'Get ready' });
    expect(s.tone).toBe('alert');
    expect(s.line).toBe('blue'); // still riding the first leg
  });

  it('warns before the destination', () => {
    const s = status('APPROACHING_DESTINATION', 3, 24)!;
    expect(s.instruction).toBe('Get off next — E');
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
    expect(s.instruction).toBe('Walk to A');
    expect(s.countdown).toBeNull();
    expect(s.progress).toBe(0);
  });

  it('returns nothing at all when there is no route to describe', () => {
    expect(status('ON_TRAIN', 0, 0, trip({ legs: [], stops: [] }))).toBeNull();
  });
});
