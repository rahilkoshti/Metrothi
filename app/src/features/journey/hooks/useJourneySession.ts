import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationService } from '../../../services/LocationService';
import { haversineKm, walkMinsForKm } from '../engine/journeyEngine';
import type { PlanResult, JourneyStop, LegDetail } from '../engine/journeyEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JourneyState =
  | 'NOT_STARTED'
  | 'WALKING_TO_STATION'
  | 'WAITING_FOR_TRAIN'
  | 'ON_TRAIN'
  | 'APPROACHING_TRANSFER'
  | 'TRANSFERRING'
  | 'APPROACHING_DESTINATION'
  | 'FINAL_WALK'
  | 'COMPLETED';

export interface Coords {
  lat: number;
  lng: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius within which we consider the user to have "arrived" at a station. */
const STATION_RADIUS_KM = 0.15; // 150 m

/** Radius within which we trigger APPROACHING_* states. */
const APPROACH_RADIUS_KM = 0.6; // 600 m

/** How often to run the time-based fallback tick (ms). */
const TICK_INTERVAL_MS = 5000;

/** Default assumed walk time to source station (mins) when distance is unknown. */
const DEFAULT_WALK_MINS = 5;

/** Minimum seconds to dwell in WAITING_FOR_TRAIN before the time-based departure
 *  fires. Prevents skipping the state entirely when initialWaitMins === 0. */
const MIN_WAIT_DWELL_SECS = 10;

// ─── Stop Timeline ────────────────────────────────────────────────────────────

/**
 * Given the planJourney result, compute `stopTimeline[i]` = the number of
 * elapsed minutes from journey start at which we expect to be at/passing stop[i].
 *
 * This is built from result.initialWaitMins + per-leg travelMins + bufferMins
 * already computed by the engine — no engine changes needed.
 */
function computeStopTimeline(result: PlanResult): number[] {
  const stops: JourneyStop[] = result.stops ?? [];
  const legs: LegDetail[] = result.legs ?? [];

  if (stops.length === 0) return [];
  if (legs.length === 0) return stops.map(() => 0);

  const timeline: number[] = new Array(stops.length).fill(0);

  // Find where each leg starts in the stops array (viaLine changes mark boundaries)
  const legStarts: number[] = [0];
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].viaLine !== stops[i - 1].viaLine) {
      legStarts.push(i);
    }
  }

  // elapsed = cumulative minutes from journey start
  // At stop[0], the train departs after initialWaitMins.
  let elapsed = result.initialWaitMins ?? 0;

  for (let legIdx = 0; legIdx < legs.length; legIdx++) {
    const leg = legs[legIdx];
    const legStartStop = legStarts[legIdx] ?? 0;
    // Last stop of this leg is one before the next leg's start, or the final stop.
    const legEndStop =
      legIdx < legStarts.length - 1
        ? legStarts[legIdx + 1] - 1
        : stops.length - 1;

    // For legs after the first, add interchange buffer + connection wait.
    if (legIdx > 0) {
      elapsed += (leg.bufferMins ?? 3) + (leg.waitMins ?? 0);
    }

    const numSegments = legEndStop - legStartStop;
    const segmentMins = numSegments > 0 ? (leg.travelMins ?? 0) / numSegments : 0;

    timeline[legStartStop] = elapsed;
    for (let s = legStartStop + 1; s <= legEndStop; s++) {
      elapsed += segmentMins;
      timeline[s] = elapsed;
    }
  }

  return timeline;
}

// ─── State Machine ────────────────────────────────────────────────────────────

interface TransitionContext {
  currentState: JourneyState;
  currentStopIndex: number;
  activeCoords: Coords | null;
  stops: JourneyStop[];
  startedAt: number;
  stopTimeline: number[];
  initialWalkMins: number;
}

interface TransitionResult {
  nextState: JourneyState;
  nextStopIndex?: number;
}

/**
 * Pure function: given the current context, return the next state (or null
 * if no transition should occur yet).
 *
 * Each state owns its own transition rules — no shared if/else soup.
 * GPS proximity is the primary signal; elapsed schedule time is the fallback.
 */
function evaluate(ctx: TransitionContext): TransitionResult | null {
  const {
    currentState,
    currentStopIndex,
    activeCoords,
    stops,
    startedAt,
    stopTimeline,
    initialWalkMins,
  } = ctx;

  const elapsedMins = (Date.now() - startedAt) / 60000;
  const source = stops[0];

  switch (currentState) {
    // ── NOT_STARTED ──────────────────────────────────────────────────────────
    case 'NOT_STARTED':
      // Immediately begin — folded into tick so it happens on the first tick
      // after result is set, not in a separate effect.
      return { nextState: 'WALKING_TO_STATION', nextStopIndex: 0 };

    // ── WALKING_TO_STATION ───────────────────────────────────────────────────
    case 'WALKING_TO_STATION': {
      // GPS primary: arrived at source station
      if (activeCoords && source.lat != null) {
        const distToSource = haversineKm(activeCoords, source as Coords);
        if (distToSource <= STATION_RADIUS_KM) {
          return { nextState: 'WAITING_FOR_TRAIN' };
        }
      }
      // Time fallback: scheduled walk time elapsed
      if (elapsedMins >= initialWalkMins) {
        return { nextState: 'WAITING_FOR_TRAIN' };
      }
      return null;
    }

    // ── WAITING_FOR_TRAIN ────────────────────────────────────────────────────
    case 'WAITING_FOR_TRAIN': {
      if (stops.length < 2) return { nextState: 'FINAL_WALK', nextStopIndex: 0 };

      // Time primary: scheduled departure time has passed.
      // Fix 5: require a minimum dwell so the state is not immediately skipped
      // when initialWaitMins === 0 (next train already at platform).
      const expectedDepartMins = stopTimeline[0] ?? 0; // = initialWaitMins
      const dwellSecs = (Date.now() - startedAt) / 1000 - initialWalkMins * 60;
      if (elapsedMins >= expectedDepartMins && dwellSecs >= MIN_WAIT_DWELL_SECS) {
        return { nextState: 'ON_TRAIN', nextStopIndex: 1 };
      }

      // GPS secondary: moving toward next stop (train has moved)
      if (activeCoords && source.lat != null && stops[1].lat != null) {
        const distToSource = haversineKm(activeCoords, source as Coords);
        const distToNext = haversineKm(activeCoords, stops[1] as Coords);
        const srcToNext = haversineKm(source as Coords, stops[1] as Coords);
        if (distToSource > STATION_RADIUS_KM && distToNext < srcToNext) {
          return { nextState: 'ON_TRAIN', nextStopIndex: 1 };
        }
      }
      return null;
    }

    // ── ON_TRAIN / APPROACHING_TRANSFER / APPROACHING_DESTINATION ────────────
    // These three states all share the "advance stop index" logic.
    // APPROACHING_* are informational overlays on ON_TRAIN; transitions
    // back to ON_TRAIN after stop advancement prevent any clobbering.
    case 'ON_TRAIN':
    case 'APPROACHING_TRANSFER':
    case 'APPROACHING_DESTINATION': {
      // 1. Determine if we've advanced to a new stop.
      let newStopIndex = currentStopIndex;

      // Fix 3: GPS checks only the immediately next stop.
      // Scanning all future stops simultaneously allowed GPS noise or a
      // tunnel-exit burst to jump multiple stations in one tick.
      // The time fallback below catches up if more than one stop has been passed.
      if (activeCoords) {
        const candidateStop = stops[currentStopIndex + 1];
        if (candidateStop && candidateStop.lat != null) {
          const dist = haversineKm(activeCoords, candidateStop as Coords);
          if (dist <= STATION_RADIUS_KM) {
            newStopIndex = currentStopIndex + 1;
          }
        }
      }

      // Time fallback: if we're past the scheduled arrival time for the next stop.
      if (
        newStopIndex === currentStopIndex &&
        currentStopIndex + 1 < stops.length
      ) {
        const nextExpected = stopTimeline[currentStopIndex + 1];
        if (nextExpected != null && elapsedMins >= nextExpected) {
          newStopIndex = currentStopIndex + 1;
        }
      }

      // 2. If we've advanced, determine next state.
      if (newStopIndex > currentStopIndex) {
        // Reached the final destination station.
        if (newStopIndex >= stops.length - 1) {
          return { nextState: 'FINAL_WALK', nextStopIndex: stops.length - 1 };
        }
        const arrivedAtStop = stops[newStopIndex];
        const nextStop = stops[newStopIndex + 1];
        // At an interchange where we need to change lines → TRANSFERRING.
        if (
          arrivedAtStop.interchange &&
          nextStop &&
          nextStop.viaLine !== arrivedAtStop.viaLine
        ) {
          return { nextState: 'TRANSFERRING', nextStopIndex: newStopIndex };
        }
        // Otherwise continue on train.
        return { nextState: 'ON_TRAIN', nextStopIndex: newStopIndex };
      }

      // 3. Proximity alerts (only from ON_TRAIN, not from APPROACHING_* —
      //    prevents re-entry into approach states unnecessarily).
      if (currentState === 'ON_TRAIN' && activeCoords) {
        const nextStop = stops[currentStopIndex + 1];
        if (nextStop && nextStop.lat != null) {
          const distToNext = haversineKm(activeCoords, nextStop as Coords);
          if (distToNext <= APPROACH_RADIUS_KM) {
            const isLastStop = currentStopIndex + 1 >= stops.length - 1;
            if (isLastStop) {
              return { nextState: 'APPROACHING_DESTINATION' };
            }
            // Upcoming interchange where we need to switch lines.
            const stopAfterNext = stops[currentStopIndex + 2];
            if (
              nextStop.interchange &&
              stopAfterNext &&
              stopAfterNext.viaLine !== nextStop.viaLine
            ) {
              return { nextState: 'APPROACHING_TRANSFER' };
            }
          }
        }
      }

      return null;
    }

    // ── TRANSFERRING ─────────────────────────────────────────────────────────
    case 'TRANSFERRING': {
      // Time primary: scheduled time for the next stop has elapsed, meaning
      // the connecting train has departed.
      const nextStopIdx = currentStopIndex + 1;
      if (nextStopIdx >= stops.length) {
        return { nextState: 'FINAL_WALK', nextStopIndex: currentStopIndex };
      }
      const expectedNextStopMins = stopTimeline[nextStopIdx];
      if (expectedNextStopMins != null && elapsedMins >= expectedNextStopMins) {
        return { nextState: 'ON_TRAIN', nextStopIndex: nextStopIdx };
      }

      // GPS secondary: moved away from interchange toward next stop.
      if (activeCoords) {
        const interchange = stops[currentStopIndex];
        const nextStop = stops[nextStopIdx];
        if (interchange.lat != null && nextStop && nextStop.lat != null) {
          const distToInterchange = haversineKm(activeCoords, interchange as Coords);
          const distToNext = haversineKm(activeCoords, nextStop as Coords);
          const interToNext = haversineKm(interchange as Coords, nextStop as Coords);
          if (distToInterchange > STATION_RADIUS_KM && distToNext < interToNext) {
            return { nextState: 'ON_TRAIN', nextStopIndex: nextStopIdx };
          }
        }
      }
      return null;
    }

    // ── FINAL_WALK ───────────────────────────────────────────────────────────
    case 'FINAL_WALK': {
      // Fix 1: The hook has no knowledge of the user's actual destination address —
      // only the destination metro station. The previous GPS branch incorrectly
      // completed the journey the instant the user stepped outside the station
      // gates (distToDest > STATION_RADIUS_KM is always true once they exit).
      //
      // Use time-only: complete 5 min after the scheduled arrival at the destination
      // station. A future `destinationCoords` prop can restore GPS-based completion
      // targeted at the real address rather than the station.
      const expectedArrivalMins = stopTimeline[stops.length - 1];
      if (
        expectedArrivalMins != null &&
        elapsedMins >= expectedArrivalMins + 5
      ) {
        return { nextState: 'COMPLETED' };
      }
      return null;
    }

    case 'COMPLETED':
      return null;

    default:
      return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJourneySession(result: PlanResult | null) {
  // Fix 2: Display-only React state — driven exclusively by refs (stateRef,
  // stopIndexRef). These are never read inside tick() to avoid stale-closure
  // double-transition issues.
  const [displayState, setDisplayState] = useState<JourneyState>('NOT_STARTED');
  const [displayStopIndex, setDisplayStopIndex] = useState(0);
  const [realCoords, setRealCoords] = useState<Coords | null>(null);
  const [simulatedCoords, setSimulatedCoords] = useState<Coords | null>(null);

  const activeCoords = simulatedCoords || realCoords;

  // Fix 2: Refs are the single source of truth for the tick loop. They are
  // written before setState so that rapid GPS re-entry (between a setState
  // dispatch and the next render) sees already-updated values and does not
  // re-fire the same transition.
  const stateRef = useRef<JourneyState>('NOT_STARTED');
  const stopIndexRef = useRef(0);
  const coordsRef = useRef<Coords | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stopTimelineRef = useRef<number[]>([]);
  const initialWalkMinsRef = useRef(DEFAULT_WALK_MINS);

  // Fix 4: Synchronously initialise startedAtRef (and reset state refs) the
  // moment result changes — before any effect or GPS event fires. This closes
  // the window where tick() would bail with `startedAtRef.current === null`
  // on the very first GPS update after a journey is started.
  const resultIdRef = useRef<PlanResult | null>(null);
  if (result !== resultIdRef.current) {
    resultIdRef.current = result;
    startedAtRef.current = result ? Date.now() : null;
    if (!result) {
      stateRef.current = 'NOT_STARTED';
      stopIndexRef.current = 0;
    }
  }

  // coordsRef is written during render — safe because it is only ever *read*
  // inside tick(), never written there. The render-time write always completes
  // before the effects that schedule tick().
  coordsRef.current = activeCoords;

  // ── Effect A: Journey lifecycle ─────────────────────────────────────────────
  // Fires only when result changes (i.e., a new journey is started or ended).
  // Responsible for: resetting display state, computing the stop timeline, and
  // managing the GPS position watcher.
  // Note: startedAtRef is already set synchronously above — not needed here.
  useEffect(() => {
    if (!result) {
      // Journey ended / cleared — reset display state.
      setDisplayState('NOT_STARTED');
      setDisplayStopIndex(0);
      setRealCoords(null);
      setSimulatedCoords(null);
      stopTimelineRef.current = [];
      return;
    }

    // Compute how long each stop should take to reach.
    stopTimelineRef.current = computeStopTimeline(result);

    // Estimate walk time to source station.
    // If the nearest station distance is known from result.source, use it.
    // Otherwise fall back to DEFAULT_WALK_MINS.
    // NOTE: no engine output actually carries `distanceKm` today, so this is
    // always the fallback — see DISCREPANCIES.md.
    const distanceKm = (result.source as { distanceKm?: number | null }).distanceKm;
    const sourceDistKm = distanceKm != null ? distanceKm : null;
    initialWalkMinsRef.current =
      sourceDistKm != null ? walkMinsForKm(sourceDistKm) : DEFAULT_WALK_MINS;

    // Start GPS watcher.
    const watchId = LocationService.watchPosition(
      (pos) => setRealCoords(pos),
      () =>
        console.warn(
          '[useJourneySession] GPS unavailable — using schedule time as fallback.'
        )
    );

    return () => {
      if (watchId !== null) LocationService.clearWatch(watchId);
    };
  }, [result]);

  const [, setTickCount] = useState(0);

  // ── Tick function ───────────────────────────────────────────────────────────
  // Reads all current values from refs to avoid stale closures.
  // Evaluates the state machine and applies any transition.
  const tick = useCallback(() => {
    if (!result || startedAtRef.current === null) return;
    setTickCount(c => c + 1);

    const ctx: TransitionContext = {
      currentState: stateRef.current,
      currentStopIndex: stopIndexRef.current,
      activeCoords: coordsRef.current,
      stops: result.stops,
      startedAt: startedAtRef.current,
      stopTimeline: stopTimelineRef.current,
      initialWalkMins: initialWalkMinsRef.current,
    };

    const transition = evaluate(ctx);
    if (transition) {
      // Fix 2: Write refs first so any tick re-entry before the next render
      // sees the updated state and does not re-fire the same transition.
      stateRef.current = transition.nextState;
      if (transition.nextStopIndex !== undefined) {
        stopIndexRef.current = transition.nextStopIndex;
      }
      setDisplayState(transition.nextState);
      if (transition.nextStopIndex !== undefined) {
        setDisplayStopIndex(transition.nextStopIndex);
      }
    }
  }, [result]);

  // ── Effect B: GPS-triggered tick ────────────────────────────────────────────
  // Fires immediately whenever the user's coordinates update.
  // This is the "fast path" — transitions that GPS can confirm right away.
  useEffect(() => {
    if (result) tick();
  }, [activeCoords, tick]);

  // ── Effect C: Time-based fallback tick ──────────────────────────────────────
  // Fires every TICK_INTERVAL_MS to advance the state machine even when GPS is
  // unavailable or the user is underground.
  useEffect(() => {
    if (!result) return;
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [result, tick]);

  const fastForward = useCallback((mins: number) => {
    if (startedAtRef.current !== null) {
      startedAtRef.current -= mins * 60000;
      tick();
    }
  }, [tick]);

  const elapsedMins = startedAtRef.current ? (Date.now() - startedAtRef.current) / 60000 : 0;

  return {
    currentState: displayState,
    currentStopIndex: displayStopIndex,
    activeCoords,
    setSimulatedCoords,
    fastForward,
    elapsedMins,
    /** Absolute timestamp (ms) when the journey was started. */
    startedAt: startedAtRef.current,
    /** Expected elapsed minutes from start for each stop index. */
    stopTimeline: stopTimelineRef.current,
  };
}
