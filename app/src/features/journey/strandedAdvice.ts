import {
  LINE_META,
  clockTimeAfter,
  estimateLine,
  istDayStartMs,
  type JourneyOption,
} from './engine/journeyEngine';

/**
 * What to say when a rider cannot make the trip they asked for.
 *
 * "Route Not Possible" is true and useless. It names the line that has stopped
 * running and then tells the rider to "pick a different departure below" —
 * without saying whether a different departure exists, and there usually
 * isn't one, because a line that has finished for the day has finished for
 * every departure after this one too. The answer is already computed: either
 * some option in the list gets through, or none does and the honest next fact
 * is when that line runs again.
 *
 * React-free and off i18next, like `liveStatus.ts` and for the same reason:
 * it decides **which** sentence and hands back a key plus the proper nouns to
 * interpolate. The one caller renders it. Its test asserts the data and that
 * every key it can emit resolves in the English bundle — a key that doesn't
 * exist renders as the literal string `journey.strandedTomorrow` and nothing
 * throws.
 */

/**
 * Line display name → line id. The engine reports the stranding line as
 * `LINE_META[id].name`, and the "first train tomorrow" lookup needs the id.
 *
 * Reading behaviour back out of a string is normally the bug this codebase has
 * a rule against — but the rule is about *translated* strings, and these names
 * are module constants that are English in every language and stay that way
 * (§6.8). Same exemption `LineStatusPills` documents for `LINE_NAMES`.
 */
const LINE_ID_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LINE_META).map(([id, meta]) => [meta.name, id])
);

const DAY_MS = 86400000;

/** A sentence this module has chosen but not written. */
export interface StrandedAdvice {
  key: string;
  values: Record<string, string>;
}

/**
 * @param option   the departure the rider currently has selected
 * @param options  every departure the plan produced, in departure order
 * @returns null when the trip is feasible, or when neither answer can be
 *          computed — the caller then falls back to the plain explanation
 *          rather than printing a half-sentence.
 */
export function strandedAdviceOf(
  option: Pick<JourneyOption, 'feasible' | 'strandedAtLine'> | null | undefined,
  options: readonly JourneyOption[] | null | undefined,
  now: Date = new Date()
): StrandedAdvice | null {
  const line = option?.strandedAtLine;
  if (!option || option.feasible !== false || !line) return null;

  // Is there another train today that gets all the way through? `options` is
  // ordered by departure and has already had the departed ones filtered out on
  // a leave-now plan, so the first feasible entry is the soonest one still
  // catchable — which is the one worth naming.
  const alternative = options?.find((o) => o.feasible);
  if (alternative) {
    return {
      key: 'journey.strandedTakeInstead',
      values: { line, time: alternative.departClockTime },
    };
  }

  // Nothing today. Ask the same estimator the rest of the app uses, but at
  // tomorrow's midnight rather than now — `dayType` then picks up tomorrow's
  // weekday rules, which matters on a Friday night.
  const lineId = LINE_ID_BY_NAME[line];
  if (!lineId) return null;
  const tomorrow = new Date(istDayStartMs(now) + DAY_MS);
  const est = estimateLine(lineId, tomorrow);
  // Anything other than "hasn't started yet" at 00:00 means this line's rules
  // aren't shaped the way this answer assumes, and a wrong time is worse than
  // no time.
  if (est.status !== 'before-first-train' || est.minsUntilFirst == null) return null;

  return {
    key: 'journey.strandedTomorrow',
    values: { line, time: clockTimeAfter(tomorrow, est.minsUntilFirst) },
  };
}
