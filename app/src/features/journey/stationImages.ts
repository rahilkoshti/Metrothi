import doordarshanKendra from '../../assets/stations/doordarshan-kendra.webp';

/**
 * Photos of the stations themselves, keyed by station id.
 *
 * Only the stations that have actually been shot appear here — there is no
 * placeholder and no per-line stand-in, because a photo of the wrong station is
 * worse than no photo in a wayfinding app. Callers must handle a miss.
 *
 * Assets are square (the slots that use them are), pre-cropped on the station
 * structure and compressed at build-input time rather than resized in CSS from
 * a multi-megabyte original.
 */
export const STATION_IMAGES: Record<string, string> = {
  'doordarshan-kendra': doordarshanKendra,
};

/** The station's photo, or null when we don't have one for it. */
export function stationImage(stationId: string | null | undefined): string | null {
  if (!stationId) return null;
  return STATION_IMAGES[stationId] ?? null;
}
