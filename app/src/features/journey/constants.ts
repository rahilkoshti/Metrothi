/** The line's colour as GMRC signs it. These are the one documented exception
 *  to "colours come from CSS custom properties": they map to physical signage
 *  and so are fixed across themes. Used for **fills** — badges, map polylines,
 *  track rails, dots — where the colour is a shape rather than a glyph.
 *
 *  Leaflet needs real hex here, not `var()`, which is the other reason this
 *  stays a JS map. */
export const LINE_COLOR: Record<string, string> = {
  blue: "#3B82F6", red: "#EF4444", yellow: "#EAB308", violet: "#A855F7",
};


/** The same line, where it has to carry *itself* as text or as a small glyph
 *  rather than as a filled shape. Theme-aware, so these are token references
 *  rather than literals — see the `--c-line-*` block in `index.css` for why
 *  the signage hex can't be used directly here (three of the four fail against
 *  a light surface; yellow by a factor of two). */
export const LINE_ON_SURFACE: Record<string, string> = {
  blue: "var(--c-line-blue)",
  red: "var(--c-line-red)",
  yellow: "var(--c-line-yellow)",
  violet: "var(--c-line-violet)",
};

/** The non-colour channel. Every place that signals something with a line's
 *  hue must also carry this letter or the line's name — colour alone fails
 *  WCAG 1.4.1, and four of this app's hues are already spent on line identity
 *  before status gets a look in. */
export const LINE_LETTER: Record<string, string> = {
  blue: "B", red: "R", yellow: "Y", violet: "V"
};

export const LINE_NAMES: Record<string, string> = {
  blue: "Blue Line", red: "Red Line", yellow: "Yellow Line", violet: "Violet Line",
};
