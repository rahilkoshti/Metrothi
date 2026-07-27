export interface PlaceNode {
  isPlace: true;
  id: string; // usually stringified lat/lng
  name: string;
  lat: number;
  lng: number;
}

// Photon (komoot) GeoJSON response — only the fields we read.
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }; // [lng, lat]
  properties?: {
    name?: string;
    suburb?: string;
    district?: string;
    city?: string;
    county?: string;
  };
}

// Place search uses Photon (photon.komoot.io) — OSM-based, keyless,
// CORS-enabled, and its usage policy permits client-side autocomplete
// (Nominatim's doesn't), so it works with zero setup.
function toPlaceNode(name: string, lat: number, lng: number): PlaceNode {
  return { isPlace: true, id: `place_${lat}_${lng}`, name, lat, lng };
}

// How many suggestions the caller actually renders.
const MAX_RESULTS = 5;
// Photon applies `limit` before we get to dedupe, so asking for exactly
// MAX_RESULTS would let a cluster of duplicates collapse into two or three
// rows. Over-fetch, dedupe, then trim.
const FETCH_LIMIT = 15;
// OSM routinely maps one real place as several objects — a node, a way and
// another node metres apart, all identically tagged. Two entries this close
// that also share a base name are the same place, not neighbours.
const SAME_PLACE_KM = 0.05;

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Collapse the several OSM objects that stand for one place. Photon returns
 * them most-relevant first, so the first spelling of a place is the one kept.
 *
 * Two passes, because either alone leaks a duplicate: an exact label match
 * catches the common case (identical `name` *and* locality), while the
 * proximity check catches the same place tagged with different context — one
 * object carrying `suburb`, its twin only `district` — which renders as two
 * different strings for the same doorway.
 */
function dedupePlaces(candidates: { node: PlaceNode; baseName: string }[]): PlaceNode[] {
  const kept: { node: PlaceNode; baseName: string }[] = [];
  for (const c of candidates) {
    const label = c.node.name.trim().toLowerCase();
    const duplicate = kept.some(
      (k) =>
        k.node.name.trim().toLowerCase() === label ||
        (k.baseName === c.baseName && distanceKm(k.node, c.node) <= SAME_PLACE_KM)
    );
    if (!duplicate) kept.push(c);
  }
  return kept.map((k) => k.node);
}

async function searchViaPhoton(q: string): Promise<PlaceNode[]> {
  // Ahmedabad/Gandhinagar bounding box: 72.4,22.9 to 72.7,23.3
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&bbox=72.4,22.9,72.7,23.3&limit=${FETCH_LIMIT}&lang=en`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  const candidates = ((data.features ?? []) as PhotonFeature[])
    .filter((f) => f.geometry?.coordinates && f.properties?.name)
    .map((f) => {
      const [lng, lat] = f.geometry!.coordinates!;
      const p = f.properties!;
      // Append a locality so same-named places are tellable apart.
      const context = p.suburb || p.district || p.city || p.county;
      const name =
        context && context !== p.name ? `${p.name}, ${context}` : p.name!;
      return { node: toPlaceNode(name, lat, lng), baseName: p.name!.trim().toLowerCase() };
    });

  return dedupePlaces(candidates).slice(0, MAX_RESULTS);
}

export class GeocodingService {
  private static CACHE = new Map<string, PlaceNode[]>();
  private static PENDING_REQUESTS = new Map<string, Promise<PlaceNode[]>>();

  static async searchPlaces(query: string): Promise<PlaceNode[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];

    if (this.CACHE.has(q)) {
      return this.CACHE.get(q)!;
    }

    if (this.PENDING_REQUESTS.has(q)) {
      return this.PENDING_REQUESTS.get(q)!;
    }

    const promise = (async () => {
      try {
        const results = await searchViaPhoton(q);
        this.CACHE.set(q, results);
        return results;
      } catch (err) {
        console.error('Geocoding fetch error:', err);
        throw err;
      } finally {
        this.PENDING_REQUESTS.delete(q);
      }
    })();

    this.PENDING_REQUESTS.set(q, promise);
    return promise;
  }
}
