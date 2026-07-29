/**
 * How well `target` answers `query`: exact beats prefix beats substring beats a
 * scattered subsequence, so "sabar" surfaces "Sabarmati" ahead of stations that
 * merely contain the run. 0 means no match at all.
 */
function matchScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = target.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 50;

  // Subsequence, spaces ignored on both sides, so "ohc" finds Old High Court.
  const qc = q.replace(/\s+/g, "");
  const tc = t.replace(/\s+/g, "");
  let qi = 0;
  for (let i = 0; i < tc.length; i++) {
    if (tc[i] === qc[qi] && ++qi === qc.length) return 10;
  }
  return 0;
}

/**
 * What a keyword hit is worth. Every tier lands below 10, the weakest name
 * tier, so a keyword can never outrank a station that is actually called that
 * (§4.4) — the alias exists to add results, not to reorder them.
 */
const KEYWORD_BAND: Record<number, number> = { 100: 8, 80: 6, 50: 4 };

/**
 * Best keyword hit, or 0. Subsequence matching is deliberately not offered
 * here: a keyword is a word you either typed or didn't, and "bus" scattered
 * through station names would drag half the network in behind it.
 */
function keywordScore(query: string, keywords: string[]): number {
  let best = 0;
  for (const k of keywords) {
    const band = KEYWORD_BAND[matchScore(query, k)] ?? 0;
    if (band > best) best = band;
  }
  return best;
}

/**
 * Ranked match over a list, best first, capped at 6. An empty query returns the
 * head of the list unchanged.
 *
 * `keywordsFn` supplies non-displayed aliases — the transport modes a station
 * connects to (§4.4), so a visitor searching "railway" or "bus" reaches the
 * stations that have one without knowing their names. Aliases only ever rank
 * below a name match, and sorting is stable, so equally-scored keyword hits
 * come back in list order.
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  keyFn: (item: T) => string,
  keywordsFn?: (item: T) => string[],
): T[] {
  if (!query.trim()) return items.slice(0, 6);

  return items
    .map((item) => {
      const name = matchScore(query, keyFn(item));
      const score = name > 0 ? name : keywordsFn ? keywordScore(query, keywordsFn(item)) : 0;
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
    .slice(0, 6);
}
