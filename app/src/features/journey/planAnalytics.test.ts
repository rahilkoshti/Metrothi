import { describe, it, expect } from 'vitest';
import { planJourney, rideMinsOf } from './engine/journeyEngine';
import { planEvents } from './planAnalytics';

/**
 * The plan branch, against real engine output (PRD §5.8).
 *
 * This is the test the inline version in `App.tsx` could not have: the only way
 * to reach `plan_impossible` for real is to plan at an hour when the last train
 * has gone, which is a wall-clock condition no amount of clicking a planner
 * reproduces on demand. `queryTime` makes it a parameter.
 */

/** An IST clock time on a fixed date, as the engine's own tests build one. */
function ist(hour: number): Date {
  const base = Date.UTC(2026, 0, 15, 0, 0, 0) - 5.5 * 3600 * 1000;
  return new Date(base + hour * 3600 * 1000);
}

describe('planEvents', () => {
  it('reports a normal plan once, with the ride time and not the wait', () => {
    const plan = planJourney('vastral-gam', 'thaltej-gam', { queryTime: ist(9) })!;
    expect(plan.feasible).toBe(true);

    const events = planEvents(plan);
    expect(events.map(e => e.name)).toEqual(['journey_planned']);

    const [e] = events;
    expect(e.fromStation).toBe('vastral-gam');
    expect(e.toStation).toBe('thaltej-gam');
    expect(e.props.transfers).toBe(plan.numTransfers);
    expect(e.props.fareRupees).toBe(plan.fare);

    // §5.5, the rule this file exists to not get wrong. `rideMinsOf` starts at
    // boarding; `totalMins` is platform wait *plus* ride. They differ here, so
    // this assertion fails if someone "simplifies" it to totalMins.
    expect(e.props.rideMins).toBe(rideMinsOf(plan));
    expect(e.props.rideMins).not.toBe(plan.totalMins);
  });

  it('reports an unreachable trip as impossible, not as a plan', () => {
    // Late enough that the line has finished for the day — the §7.3 case.
    const plan = planJourney('vastral-gam', 'thaltej-gam', { queryTime: ist(23.5) });
    expect(plan?.feasible ?? false).toBe(false);

    const events = planEvents(plan);
    expect(events.map(e => e.name)).toEqual(['plan_impossible']);
    // Recording this as a `journey_planned` would put an impossible trip in the
    // funnel's numerator and hide exactly the failure §7.3 is a criterion about.
    expect(events[0].props.noResult).toBe(plan == null);
  });

  it('reports a null result as impossible rather than throwing', () => {
    // `planJourney` returns null for input it cannot route at all. The shell
    // passes that straight through, so this branch is reachable in production.
    const events = planEvents(null);
    expect(events.map(e => e.name)).toEqual(['plan_impossible']);
    expect(events[0].props.noResult).toBe(true);
    expect(events[0].fromStation).toBeUndefined();
  });

  it('adds fare_unavailable alongside the plan when the fare did not resolve', () => {
    const plan = planJourney('vastral-gam', 'thaltej-gam', { queryTime: ist(9) })!;
    // §7.5: distance unresolved means the app shows nothing rather than a
    // guess, and that silence is the thing worth counting.
    const events = planEvents({ ...plan, fare: null });

    expect(events.map(e => e.name)).toEqual(['journey_planned', 'fare_unavailable']);
    expect(events[0].props.fareRupees).toBeNull();
    expect(events[1].fromStation).toBe('vastral-gam');
  });

  it('never carries a place name, only the station the engine routed from', () => {
    // A rider searching "GIFT City Club" plans from a PlaceNode. The POI name
    // is the most identifying thing they type, and it must not leave the
    // device (§5.8) — what travels is the station id the engine resolved to.
    const place = { name: 'GIFT City Club', lat: 23.1594, lng: 72.6845, isPlace: true } as never;
    const plan = planJourney(place, 'thaltej-gam', { queryTime: ist(9) })!;

    const serialised = JSON.stringify(planEvents(plan));
    expect(serialised).not.toContain('GIFT City Club');
    expect(planEvents(plan)[0].fromStation).toBe(plan.sourceStation.id);
  });
});
