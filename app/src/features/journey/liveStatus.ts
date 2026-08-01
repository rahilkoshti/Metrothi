import { clockTimeAfter, type PlanResult } from './engine/journeyEngine';
import type { JourneyState } from './hooks/useJourneySession';
import { LINE_NAMES } from './constants';

/**
 * What the live journey bar says, derived from the session rather than composed
 * in the component — the same reason the engine is React-free. Two surfaces
 * already read this state (the collapsed bar and the full timeline) and they
 * disagreed about which leg was "current"; the answer lives here now.
 *
 * Everything is in the session's own unit: minutes elapsed since the rider
 * tapped Start Journey. Deliberately *not* `totalMins`, which is measured from
 * the query and includes a platform wait that may already be spent (§5.5).
 */

/** Global stop index at which each leg begins. Legs overlap by one stop — a
 *  leg's last station is the next leg's first — so this is a running sum of
 *  `ids.length - 1` and has one more entry than there are legs. */
export function legOffsetsOf(legs: { ids: string[] }[] | null | undefined): number[] {
  const offsets = [0];
  (legs ?? []).forEach((leg) => offsets.push(offsets[offsets.length - 1] + leg.ids.length - 1));
  return offsets;
}

/** Which leg the rider is on. At an interchange the arriving and departing legs
 *  share a stop index and the *later* one wins — which is what someone standing
 *  on the concourse needs: the line they are about to board, not the one they
 *  just got off. */
export function activeLegIndexOf(legOffsets: number[], currentStopIndex: number): number {
  let k = 0;
  for (let i = 0; i < legOffsets.length - 1; i++) if (legOffsets[i] <= currentStopIndex) k = i;
  return k;
}

export type LiveTone = 'normal' | 'alert' | 'good';
export type LiveIcon = 'walk' | 'wait' | 'train' | 'transfer' | 'flag';

/**
 * A string this module has decided on but not written — a bundle key plus the
 * proper nouns to interpolate into it.
 *
 * This file is React-free for the same reason the engine is, which used to mean
 * it composed its sentences in English and every rider read "Board toward X" no
 * matter what language the rest of the sheet was in. Returning the key instead
 * keeps i18next out of here and still lets the one caller render it in the
 * rider's language — and it keeps *which* sentence to show a decision made in
 * one place, tested without a bundle.
 *
 * The values are station names, line names and headings, which stay English in
 * every language until §6.8's name source lands.
 */
export interface LiveText {
  key: string;
  values?: Record<string, string>;
}

export interface LiveStatus {
  /** The line whose colour identifies the bar right now. */
  line: string;
  icon: LiveIcon;
  /** The one thing to do next, as a sentence the caller renders. */
  instruction: LiveText;
  /** Right-aligned figure, and what it counts down *to*. Null when there is
   *  nothing left to wait for. The value is a duration and stays English until
   *  §6.6 phase 4; the label is a key. */
  countdown: { value: string; labelKey: string } | null;
  /** Where the rider leaves this train and when. Held separately from the
   *  instruction because it changes once per leg while the instruction changes
   *  every stop — a bar whose bottom line is stable is one you can read at a
   *  glance. Null once the trip is over. */
  alight: { name: string; clock: string; final: boolean } | null;
  tone: LiveTone;
  /** 0–1 through the whole trip, for the progress rail. */
  progress: number;
}

interface SessionSlice {
  currentState: JourneyState;
  currentStopIndex: number;
  stopTimeline: number[];
  elapsedMins: number;
  startedAt: number | null;
}

export function liveStatusOf(result: PlanResult, session: SessionSlice): LiveStatus | null {
  const { currentState, currentStopIndex: cs, stopTimeline, elapsedMins, startedAt } = session;
  const legs = result.legs ?? [];
  const stops = result.stops ?? [];
  if (!legs.length || stops.length < 2) return null;

  // The session fills its timeline in an effect, so the first frame of a
  // journey has legs but no times yet. The bar still renders — it just has no
  // numbers for one frame. Returning null instead would collapse the sheet's
  // header to the drag handle and then grow it again, and the sheet parks
  // itself against the header height it sees at the start of that spring.
  const ready = stopTimeline.length > 0;

  const offsets = legOffsetsOf(legs);
  const k = activeLegIndexOf(offsets, cs);
  const leg = legs[k];
  const lastIdx = stops.length - 1;
  const finalLeg = k === legs.length - 1;

  const at = (i: number) => stopTimeline[i] ?? 0;
  const clock = (m: number) => (ready && startedAt ? clockTimeAfter(new Date(startedAt), m) : '');
  /** A countdown, or nothing at all until the timeline exists — an unhedged
   *  "0 min" beside "Train departs" is worse than a blank slot. */
  const inMins = (m: number, labelKey: string) =>
    ready ? { value: `${Math.max(0, Math.ceil(m))} min`, labelKey } : null;

  // A door-to-door trip ends at a place a short walk past the last station, so
  // the trip's total and its arrival clock both have to carry that walk.
  const walkOut = result.destPlace ? result.destWalkMins ?? 0 : 0;
  const totalMins = at(lastIdx) + walkOut;
  const progress =
    currentState === 'COMPLETED'
      ? 1
      : !ready || totalMins <= 0
        ? 0
        : Math.min(1, Math.max(0, elapsedMins / totalMins));

  // Where this leg ends: the interchange, or — on the last leg — the trip's
  // destination, which is the *place* when there is one.
  const alightIdx = finalLeg ? lastIdx : offsets[k + 1];
  const alight =
    currentState === 'COMPLETED'
      ? null
      : {
          name: finalLeg ? result.dest.name : stops[alightIdx]?.name ?? '',
          clock: clock(at(alightIdx) + (finalLeg ? walkOut : 0)),
          final: finalLeg,
        };

  // When the train the rider is waiting for actually leaves. For the first leg
  // that is the timeline's own origin entry; for a connection it is the arrival
  // at the interchange plus the walk and wait the engine budgeted — the same
  // arithmetic `computeStopTimeline` uses to lay out the rest of the leg.
  const departMins =
    k === 0 ? at(0) : at(offsets[k]) + (leg.bufferMins ?? 3) + (leg.waitMins ?? 0);

  const base = { line: leg.line, alight, progress };

  switch (currentState) {
    case 'NOT_STARTED':
      return { ...base, icon: 'walk', instruction: { key: 'live.starting' }, countdown: null, tone: 'normal' };

    case 'WALKING_TO_STATION':
      return {
        ...base,
        icon: 'walk',
        instruction: { key: 'live.walkTo', values: { station: result.sourceStation.name } },
        // The deadline is the train leaving. This bar used to count to
        // `stopTimeline[1]` — an arrival two stations further on, which is both
        // a larger number and one a rider walking to the platform cannot act on.
        countdown: inMins(departMins - elapsedMins, 'live.trainDeparts'),
        tone: 'normal',
      };

    case 'WAITING_FOR_TRAIN':
      return {
        ...base,
        icon: 'wait',
        // Standing on the platform, the mistake to prevent is the direction, not
        // the station — the rider can see which one they're in.
        instruction: { key: 'live.boardToward', values: { heading: leg.headingName } },
        countdown: inMins(departMins - elapsedMins, 'live.trainDeparts'),
        tone: 'normal',
      };

    case 'ON_TRAIN': {
      const next = stops[cs + 1];
      return {
        ...base,
        icon: 'train',
        // "On train" told the rider the one thing they already knew.
        instruction: next
          ? { key: 'live.nextStation', values: { station: next.name } }
          : { key: 'live.onTrain' },
        countdown: next ? inMins(at(cs + 1) - elapsedMins, 'live.nextStopLabel') : null,
        tone: 'normal',
      };
    }

    case 'APPROACHING_TRANSFER': {
      const changeIdx = offsets[k + 1] ?? cs + 1;
      return {
        ...base,
        icon: 'transfer',
        instruction: { key: 'live.changeAtNext', values: { station: stops[changeIdx]?.name ?? '' } },
        countdown: inMins(at(changeIdx) - elapsedMins, 'live.getReady'),
        tone: 'alert',
      };
    }

    case 'TRANSFERRING':
      return {
        ...base,
        icon: 'transfer',
        instruction: {
          key: 'live.changeToLine',
          values: { line: LINE_NAMES[leg.line] ?? leg.line, heading: leg.headingName },
        },
        countdown: inMins(departMins - elapsedMins, 'live.trainDeparts'),
        tone: 'alert',
      };

    case 'APPROACHING_DESTINATION':
      return {
        ...base,
        icon: 'train',
        instruction: { key: 'live.getOffNext', values: { station: stops[lastIdx]?.name ?? '' } },
        countdown: inMins(at(lastIdx) - elapsedMins, 'live.arriveLabel'),
        tone: 'good',
      };

    case 'FINAL_WALK':
      return result.destPlace
        ? {
            ...base,
            icon: 'walk',
            instruction: { key: 'live.walkToPlace', values: { place: result.destPlace.name } },
            countdown: inMins(totalMins - elapsedMins, 'live.walkLabel'),
            tone: 'good',
          }
        : {
            ...base,
            icon: 'flag',
            instruction: { key: 'live.arrivedAt', values: { station: result.destStation.name } },
            countdown: null,
            tone: 'good',
          };

    case 'COMPLETED':
      return {
        ...base,
        icon: 'flag',
        instruction: { key: 'live.arrivedAtPlace', values: { place: result.dest.name } },
        countdown: null,
        tone: 'good',
      };

    default:
      return null;
  }
}
