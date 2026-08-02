import { rideMinsOf, type PlanResult } from './engine/journeyEngine';

/**
 * Which analytics events a plan warrants (PRD §5.8).
 *
 * Off the React tree, and off `services/analytics.ts`, for the reason
 * `liveStatus.ts` and `exitGuidance.ts` are off both: this decides *which*
 * events a `PlanResult` produces, and the one caller emits them. That keeps the
 * branch — feasible, impossible, fare-less — testable against real engine
 * output instead of only reachable by driving a planner UI, which is how it was
 * written first and why it was moved.
 *
 * The engine itself stays free of this. It has no idea analytics exists, in the
 * same way it has no idea React does.
 */

/** An event to emit, in the shape `track()` takes. */
export interface PlanEvent {
  name: 'journey_planned' | 'plan_impossible' | 'fare_unavailable';
  fromStation?: string;
  toStation?: string;
  props: Record<string, string | number | boolean | null>;
}

export function planEvents(r: PlanResult | null): PlanEvent[] {
  // Station ids only. `source`/`dest` on a result may be a resolved PlaceNode
  // carrying the POI name the rider typed, and that never leaves the device
  // (§5.8) — the pair recorded is the one the engine actually routed between.
  const fromStation = r?.sourceStation.id;
  const toStation = r?.destStation.id;

  // §7.3 in the field: a trip the engine could not complete — the last train
  // gone at the transfer, or no service left at all. A test cannot produce this
  // for a real rider because it depends on the wall clock they happened to open
  // the app at, so this event is the only way it is ever observed.
  if (!r || !r.feasible) {
    return [{
      name: 'plan_impossible',
      fromStation,
      toStation,
      props: { strandedAt: r?.strandedAtLine ?? null, noResult: r == null },
    }];
  }

  const events: PlanEvent[] = [{
    name: 'journey_planned',
    fromStation,
    toStation,
    props: {
      transfers: r.numTransfers,
      fareRupees: r.fare,
      // §5.5: the trip's own duration is `rideMinsOf`, which starts at
      // boarding. `totalMins` is platform wait *plus* ride, and recording that
      // as the journey length reports an 8-minute hop as two hours whenever the
      // app is opened before service starts.
      rideMins: rideMinsOf(r),
    },
  }];

  // §7.5 in the field: the route resolved but its distance did not, so the app
  // showed nothing rather than a guessed fare. Should sit at zero.
  if (r.fare == null) {
    events.push({ name: 'fare_unavailable', fromStation, toStation, props: {} });
  }

  return events;
}
