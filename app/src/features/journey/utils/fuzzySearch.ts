/**
 * Ranked substring/subsequence match over a list, best first, capped at 6.
 * Exact hit beats prefix beats substring beats a scattered subsequence, so
 * "sabar" surfaces "Sabarmati" ahead of stations that merely contain the run.
 * An empty query returns the head of the list unchanged.
 */
export function fuzzySearch<T>(query: string, items: T[], keyFn: (item: T) => string): T[] {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return items.slice(0, 6);

  const scored = items.map(item => {
    const target = keyFn(item).toLowerCase();
    const targetNoSpace = target.replace(/\s+/g, "");
    let score = -1;
    if (target === query.toLowerCase()) score = 100;
    else if (target.startsWith(query.toLowerCase())) score = 80;
    else if (target.includes(query.toLowerCase())) score = 50;
    else {
      let qIdx = 0;
      for (let i = 0; i < targetNoSpace.length && qIdx < q.length; i++) {
        if (targetNoSpace[i] === q[qIdx]) {
          qIdx++;
          if (qIdx === q.length) break;
        }
      }
      if (qIdx === q.length) score = 10;
    }
    return { item, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item)
    .slice(0, 6);
}
