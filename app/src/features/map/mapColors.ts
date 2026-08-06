/**
 * The map layer's palette, as literals — the one place in the app allowed to
 * hold them besides `journey/constants.ts` and `index.css`.
 *
 * The rule everywhere else is that no component declares a colour: they read
 * CSS custom properties, so the theme toggle works and every value has been
 * measured once. Leaflet cannot participate in that. `pathOptions.color` and
 * `fillColor` are written to SVG *presentation attributes* (`stroke`, `fill`),
 * and a presentation attribute cannot resolve `var()` — it would render as an
 * invalid value and the shape would fall back to black. So the map's colours
 * are gathered here, named, and switched on the theme in TypeScript instead.
 *
 * `scripts/check-design-tokens.mjs` allows literals in this file for that
 * reason and forbids them in every other component.
 */
import type { Theme } from '../../contexts/ThemeContext';

/** Behind the tiles, and visible for the moment before they load. */
export const MAP_BACKDROP: Record<Theme, string> = {
  light: '#ebe8e0',
  dark: '#0b0f14',
};

/**
 * The casing drawn under an active route's coloured line, so the route reads
 * as raised off the basemap rather than tangled in it. Inverts with the theme:
 * the halo has to contrast with the *map*, not with the line.
 */
export const ROUTE_CASING: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#000000',
};

/** The rider — their position, its accuracy halo, and the walking leg. */
export const USER_BLUE = '#3b82f6';

/** The stroke that separates any map marker from whatever is under it. */
export const MARKER_STROKE = '#ffffff';

/** Route endpoints: where the journey starts, and where it ends. The end takes
 *  the accent because that is the one a rider looks for. */
export const ROUTE_ORIGIN_FILL = '#111111';
export const ROUTE_DEST_FILL = '#F97316';

/** Drawn when a line id has no entry in `LINE_COLOR` — a line the data knows
 *  about and the palette doesn't. Deliberately drab: an unknown line should
 *  look unknown rather than borrow another line's identity. */
export const LINE_FALLBACK = '#666666';
