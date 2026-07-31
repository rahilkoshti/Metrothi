export const LINE_BADGE_BG: Record<string, string> = {
  blue: "#3B82F6", red: "#EF4444", yellow: "#EAB308", violet: "#A855F7",
};

export const LINE_COLORS: Record<string, string> = {
  blue: "#3B82F6", red: "#EF4444", yellow: "#EAB308", violet: "#A855F7",
};

/** The line's colour where it has to carry *itself* as text or as a small glyph
 *  on the sheet's light surface, rather than as a filled badge. Only yellow
 *  moves: raw #EAB308 is ~1.7:1 on white. Everything else is the signage colour
 *  unchanged, so the two maps agree wherever they can. */
export const LINE_TEXT: Record<string, string> = {
  blue: "#3B82F6", red: "#EF4444", yellow: "#CA8A04", violet: "#A855F7",
};

export const LINE_LETTER: Record<string, string> = {
  blue: "B", red: "R", yellow: "Y", violet: "V"
};

export const LINE_NAMES: Record<string, string> = {
  blue: "Blue Line", red: "Red Line", yellow: "Yellow Line", violet: "Violet Line",
};

export const LINE_DOT_BG: Record<string, string> = {
  blue: "bg-blue-500", red: "bg-red-500", yellow: "bg-yellow-400", violet: "bg-purple-500",
};

export const LINE_TRACK_BG: Record<string, string> = {
  blue: "bg-blue-500", red: "bg-red-500", yellow: "bg-yellow-400", violet: "bg-purple-500",
};
