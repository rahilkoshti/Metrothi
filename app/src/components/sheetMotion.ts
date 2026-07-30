/**
 * How sheets move.
 *
 * Its own module rather than an export on `DraggableSheet`, for two reasons:
 * that file exporting a non-component costs it fast refresh, and importing it
 * from `TrainRouteSheet` would pull the whole drag implementation along for
 * four numbers. Both sheets read the spring from here, so "matches the feel of
 * the other sheets in the app" stays a fact rather than two copies that agree
 * today.
 */

// A sheet released mid-flight should decelerate, not stop dead.
export const SPRING = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const;
